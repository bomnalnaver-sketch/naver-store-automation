/**
 * @file store-name-analyzer.ts
 * @description 스토어명 연동 분석 엔진
 * @responsibilities
 * - 스토어명 토큰 분리 및 상품명 토큰과 교차 조합
 * - 스토어명 + 상품명 결합으로 추가 노출 가능한 키워드 탐색
 * - 보너스 키워드 리포트 생성
 */

import {
  tokenize,
} from '@/services/keyword-classification/keyword-tokenizer';
import type {
  KeywordMaster,
  ExposedKeyword,
  StoreNameAnalysisResult,
} from '@/types/keyword.types';
import { extractExposedKeywords } from './exposure-simulator';
import { logger } from '@/utils/logger';

// ============================================
// 상수
// ============================================

/** 교차 조합 최소 검색량 필터 */
const MIN_SEARCH_VOLUME_FOR_BONUS = 0;

// ============================================
// 스토어명 분석
// ============================================

/**
 * 스토어명 + 상품명 결합 보너스 키워드 분석
 * 스토어명 토큰과 상품명 토큰의 교차 조합으로 추가 노출 가능한 키워드를 탐색
 * @param storeName 스토어명
 * @param productName 상품명
 * @param keywordDb 키워드 마스터 목록
 * @returns 스토어명 분석 결과
 */
export function analyzeStoreNameBonus(
  storeName: string,
  productName: string,
  keywordDb: KeywordMaster[]
): StoreNameAnalysisResult {
  const storeTokens = tokenize(storeName);
  const productTokens = tokenize(productName);

  logger.debug('Store name analysis started', {
    storeName,
    productName,
    storeTokenCount: storeTokens.length,
    productTokenCount: productTokens.length,
  });

  // 상품명 단독 노출 키워드
  const productOnlyKeywords = extractExposedKeywords(productName, keywordDb);
  const productOnlySet = new Set(
    productOnlyKeywords.map((k) => k.keyword.toLowerCase())
  );

  // 교차 조합으로 보너스 키워드 탐색
  const combinationDetails: StoreNameAnalysisResult['combinationDetails'] = [];
  const bonusKeywords: ExposedKeyword[] = [];
  const addedKeywordSet = new Set<string>();

  for (const storeToken of storeTokens) {
    for (const productToken of productTokens) {
      // 스토어 토큰 + 상품 토큰 결합 (두 방향 모두 확인)
      const combinations = [
        { combined: `${storeToken} ${productToken}`, st: storeToken, pt: productToken },
        { combined: `${productToken} ${storeToken}`, st: storeToken, pt: productToken },
        { combined: `${storeToken}${productToken}`, st: storeToken, pt: productToken },
        { combined: `${productToken}${storeToken}`, st: storeToken, pt: productToken },
      ];

      for (const combo of combinations) {
        const match = findKeywordInDb(combo.combined, keywordDb);

        if (!match) continue;
        if (match.monthlyTotalSearch <= MIN_SEARCH_VOLUME_FOR_BONUS) continue;

        const keyLower = match.keyword.toLowerCase();

        // 상품명 단독으로는 노출 불가능한 키워드만 보너스
        if (productOnlySet.has(keyLower)) continue;

        // 중복 방지
        if (addedKeywordSet.has(keyLower)) continue;
        addedKeywordSet.add(keyLower);

        combinationDetails.push({
          storeToken: combo.st,
          productToken: combo.pt,
          combinedKeyword: match.keyword,
          monthlySearchVolume: match.monthlyTotalSearch,
        });

        bonusKeywords.push({
          keyword: match.keyword,
          monthlySearchVolume: match.monthlyTotalSearch,
          keywordType: match.keywordType,
        });
      }
    }
  }

  logger.info('Store name analysis completed', {
    storeName,
    bonusKeywordCount: bonusKeywords.length,
    totalBonusVolume: bonusKeywords.reduce((sum, k) => sum + k.monthlySearchVolume, 0),
  });

  return {
    storeName,
    storeTokens,
    bonusKeywords,
    combinationDetails,
  };
}

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 키워드 DB에서 주어진 문자열과 일치하는 키워드 찾기
 * 붙여쓰기/띄어쓰기 모두 비교
 * @param combined 검색할 조합 문자열
 * @param keywordDb 키워드 마스터 목록
 * @returns 일치하는 키워드 마스터 또는 null
 */
function findKeywordInDb(
  combined: string,
  keywordDb: KeywordMaster[]
): KeywordMaster | null {
  const combinedLower = combined.toLowerCase().trim();
  const combinedNoSpace = combinedLower.replace(/\s+/g, '');

  for (const kw of keywordDb) {
    const kwLower = kw.keyword.toLowerCase();
    const kwNoSpace = kwLower.replace(/\s+/g, '');

    // 정확한 문자열 일치 (띄어쓰기 유무 무관)
    if (kwLower === combinedLower || kwNoSpace === combinedNoSpace) {
      return kw;
    }
  }

  return null;
}
