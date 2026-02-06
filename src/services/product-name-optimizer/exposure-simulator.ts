/**
 * @file exposure-simulator.ts
 * @description 유효 노출량 시뮬레이션 엔진
 * @responsibilities
 * - 상품명에서 노출 가능한 키워드 추출
 * - 상품명 변경 전후 노출량 비교 시뮬레이션
 * - 키워드 유형별 노출 규칙 적용
 */

import {
  tokenize,
  joinKeyword,
  containsTokenInOrder,
  containsToken,
} from '@/services/keyword-classification/keyword-tokenizer';
import type {
  KeywordMaster,
  ExposedKeyword,
  ExposureSimulationResult,
} from '@/types/keyword.types';
import { logger } from '@/utils/logger';

// ============================================
// 노출 키워드 추출
// ============================================

/**
 * 상품명에서 노출 가능한 키워드 추출
 * 키워드 유형별 노출 규칙을 적용하여 실제 검색 노출 가능한 키워드 목록을 반환
 * @param productName 상품명
 * @param keywordDb 키워드 마스터 목록
 * @returns 노출 가능 키워드 배열 (검색량 포함)
 */
export function extractExposedKeywords(
  productName: string,
  keywordDb: KeywordMaster[]
): ExposedKeyword[] {
  const tokens = tokenize(productName);

  if (tokens.length === 0) {
    logger.warn('Empty product name provided to exposure simulator');
    return [];
  }

  const exposedMap = new Map<string, ExposedKeyword>();

  // 키워드 DB의 각 키워드에 대해 노출 가능 여부 확인
  for (const kw of keywordDb) {
    // 불필요 키워드는 제외
    if (kw.keywordType === 'redundant') continue;

    const isExposed = checkExposure(productName, tokens, kw);

    if (isExposed) {
      const keyLower = kw.keyword.toLowerCase();

      // 동의어 그룹 중복 제거: 같은 synonymGroupId면 먼저 등록된 것만 유지
      if (kw.keywordType === 'synonym' && kw.synonymGroupId != null) {
        const existingSynonym = findExistingSynonym(exposedMap, keywordDb, kw.synonymGroupId);

        if (existingSynonym) continue;
      }

      if (!exposedMap.has(keyLower)) {
        exposedMap.set(keyLower, {
          keyword: kw.keyword,
          monthlySearchVolume: kw.monthlyTotalSearch,
          keywordType: kw.keywordType,
        });
      }
    }
  }

  const result = Array.from(exposedMap.values());

  logger.debug('Exposed keywords extracted', {
    productName,
    exposedCount: result.length,
    totalSearchVolume: result.reduce((sum, k) => sum + k.monthlySearchVolume, 0),
  });

  return result;
}

/**
 * 키워드 유형별 노출 가능 여부 확인
 * @param productName 상품명
 * @param tokens 상품명 토큰 배열
 * @param keyword 확인할 키워드
 * @returns 노출 가능 여부
 */
function checkExposure(
  productName: string,
  tokens: string[],
  keyword: KeywordMaster
): boolean {
  const kwTokens = tokenize(keyword.keyword);

  switch (keyword.keywordType) {
    case 'composite':
      return checkCompositeExposure(tokens, kwTokens);

    case 'integral':
      return checkIntegralExposure(productName, keyword.keyword);

    case 'order_fixed':
      return checkOrderFixedExposure(productName, kwTokens);

    case 'synonym':
      return checkSynonymExposure(tokens, kwTokens);

    default:
      // 유형 미분류 키워드: 토큰이 모두 포함되면 노출 가능으로 간주
      return kwTokens.every((t) => containsToken(productName, t));
  }
}

/**
 * 조합형 키워드 노출 확인
 * 구성 토큰이 상품명에 모두 존재하면 (순서 무관) 노출 가능
 * @param nameTokens 상품명 토큰 배열
 * @param kwTokens 키워드 토큰 배열
 * @returns 노출 가능 여부
 */
function checkCompositeExposure(nameTokens: string[], kwTokens: string[]): boolean {
  return kwTokens.every((kwToken) =>
    nameTokens.some((nt) => nt.toLowerCase() === kwToken.toLowerCase())
  );
}

/**
 * 일체형 키워드 노출 확인
 * 붙여쓰기 형태가 상품명에 그대로 존재해야 노출 가능
 * @param productName 상품명
 * @param keyword 키워드 문자열
 * @returns 노출 가능 여부
 */
function checkIntegralExposure(productName: string, keyword: string): boolean {
  const joined = joinKeyword(keyword).toLowerCase();
  return productName.toLowerCase().includes(joined);
}

/**
 * 순서고정 키워드 노출 확인
 * 원래 순서로 나란히 존재해야 노출 가능
 * @param productName 상품명
 * @param kwTokens 키워드 토큰 배열
 * @returns 노출 가능 여부
 */
function checkOrderFixedExposure(productName: string, kwTokens: string[]): boolean {
  return containsTokenInOrder(productName, kwTokens);
}

/**
 * 동의어 키워드 노출 확인
 * 구성 토큰이 상품명에 모두 존재하면 노출 가능
 * @param nameTokens 상품명 토큰 배열
 * @param kwTokens 키워드 토큰 배열
 * @returns 노출 가능 여부
 */
function checkSynonymExposure(nameTokens: string[], kwTokens: string[]): boolean {
  return kwTokens.every((kwToken) =>
    nameTokens.some((nt) => nt.toLowerCase() === kwToken.toLowerCase())
  );
}

// ============================================
// 노출량 시뮬레이션
// ============================================

/**
 * 상품명 변경 전후 노출량 비교 시뮬레이션
 * @param currentName 현재 상품명
 * @param improvedName 개선 상품명
 * @param keywordDb 키워드 마스터 목록
 * @returns 노출 시뮬레이션 결과
 */
export function simulateExposureChange(
  currentName: string,
  improvedName: string,
  keywordDb: KeywordMaster[]
): ExposureSimulationResult {
  const beforeKeywords = extractExposedKeywords(currentName, keywordDb);
  const afterKeywords = extractExposedKeywords(improvedName, keywordDb);

  const beforeSet = new Set(beforeKeywords.map((k) => k.keyword.toLowerCase()));
  const afterSet = new Set(afterKeywords.map((k) => k.keyword.toLowerCase()));

  // after에만 있는 키워드 (추가된 노출)
  const addedKeywords = afterKeywords.filter(
    (k) => !beforeSet.has(k.keyword.toLowerCase())
  );

  // before에만 있는 키워드 (제거된 노출)
  const removedKeywords = beforeKeywords.filter(
    (k) => !afterSet.has(k.keyword.toLowerCase())
  );

  const deltaExposureCount = afterKeywords.length - beforeKeywords.length;
  const beforeVolume = sumSearchVolume(beforeKeywords);
  const afterVolume = sumSearchVolume(afterKeywords);
  const deltaSearchVolume = afterVolume - beforeVolume;

  const improvementRate = beforeKeywords.length > 0
    ? (deltaExposureCount / beforeKeywords.length) * 100
    : 0;

  logger.info('Exposure simulation completed', {
    currentName,
    improvedName,
    beforeCount: beforeKeywords.length,
    afterCount: afterKeywords.length,
    deltaExposureCount,
    deltaSearchVolume,
    improvementRate: `${improvementRate.toFixed(1)}%`,
  });

  return {
    beforeKeywords,
    afterKeywords,
    addedKeywords,
    removedKeywords,
    deltaExposureCount,
    deltaSearchVolume,
    improvementRate,
  };
}

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 키워드 배열의 월간 검색량 합산
 * @param keywords 키워드 배열
 * @returns 총 월간 검색량
 */
function sumSearchVolume(keywords: ExposedKeyword[]): number {
  return keywords.reduce((sum, k) => sum + k.monthlySearchVolume, 0);
}

/**
 * 이미 노출 맵에 등록된 동의어 그룹 키워드가 있는지 확인
 * @param exposedMap 노출 키워드 맵
 * @param keywordDb 키워드 마스터 목록
 * @param synonymGroupId 동의어 그룹 ID
 * @returns 이미 등록된 동의어가 있으면 true
 */
function findExistingSynonym(
  exposedMap: Map<string, ExposedKeyword>,
  keywordDb: KeywordMaster[],
  synonymGroupId: number
): boolean {
  const sameGroupKeywords = keywordDb.filter(
    (kw) => kw.synonymGroupId === synonymGroupId
  );

  for (const groupKw of sameGroupKeywords) {
    if (exposedMap.has(groupKw.keyword.toLowerCase())) {
      return true;
    }
  }

  return false;
}
