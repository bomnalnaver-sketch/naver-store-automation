/**
 * @file source-competitor.ts
 * @description 경쟁사 상품명 분석 기반 키워드 발굴
 * @responsibilities
 * - 상위 40개 경쟁사 상품 조회
 * - 경쟁사 상품명 토큰화
 * - 빈도 분석 (3개+ 상품에서 등장하는 키워드만 채택)
 * - 내 상품에 없는 키워드만 필터
 */

import { shoppingSearchApi } from '@/services/naver-api/shopping-search-api';
import {
  tokenize,
  generateCombinations,
  stripHtmlTags,
} from '@/services/keyword-classification/keyword-tokenizer';
import { DiscoveredKeyword, CompetitorKeywordAnalysis } from '@/types/keyword.types';
import { ShoppingSearchItem } from '@/types/shopping-api.types';
import { KEYWORD_CANDIDATE_CONFIG } from '@/config/app-config';
import { logger } from '@/utils/logger';

/**
 * 경쟁사 분석 발굴 입력
 */
export interface CompetitorDiscoveryInput {
  productId: number;
  targetKeyword: string;
  myProductName: string;
  existingKeywords: string[];
  minFrequency?: number;
}

/**
 * 경쟁사 분석 발굴 결과
 */
export interface CompetitorDiscoveryResult {
  productId: number;
  targetKeyword: string;
  competitorCount: number;
  keywordFrequency: Map<string, KeywordFrequencyData>;
  discoveredKeywords: DiscoveredKeyword[];
  analysisData: CompetitorKeywordAnalysis;
}

/**
 * 키워드 빈도 데이터
 */
export interface KeywordFrequencyData {
  keyword: string;
  frequency: number;
  sources: string[]; // 출처 상품명들
}

/** 최소 토큰 길이 */
const MIN_TOKEN_LENGTH = 2;

/** 무시할 단어 */
const IGNORE_WORDS = new Set([
  '추천',
  '인기',
  '베스트',
  '핫딜',
  '특가',
  '세일',
  '할인',
  '정품',
  '무료배송',
  '당일발송',
  'S',
  'M',
  'L',
  'XL',
  'XXL',
]);

/**
 * 토큰 유효성 검사
 */
function isValidToken(token: string): boolean {
  if (token.length < MIN_TOKEN_LENGTH) return false;
  if (IGNORE_WORDS.has(token.toUpperCase())) return false;
  if (/^\d+$/.test(token)) return false;
  if (/^[^a-zA-Z가-힣0-9]+$/.test(token)) return false;
  return true;
}

/**
 * 조합 유효성 검사
 */
function isValidCombination(combination: string): boolean {
  if (combination.length < 3) return false;
  if (!/[가-힣a-zA-Z]/.test(combination)) return false;
  return true;
}

/**
 * 경쟁사 상품명에서 토큰 및 조합 추출
 */
function extractKeywordsFromProductName(productName: string): string[] {
  const cleanName = stripHtmlTags(productName);
  const tokens = tokenize(cleanName).filter(isValidToken);

  // 개별 토큰 (3자 이상만)
  const singleTokens = tokens.filter((t) => t.length >= 3);

  // 2-gram, 3-gram 조합
  const combinations = generateCombinations(tokens, 2, 3).filter(
    isValidCombination
  );

  return [...singleTokens, ...combinations];
}

/**
 * 경쟁사 상품명 분석으로 키워드 발굴
 * @param input 발굴 입력
 * @returns 발굴 결과
 */
export async function discoverFromCompetitors(
  input: CompetitorDiscoveryInput
): Promise<CompetitorDiscoveryResult> {
  const {
    productId,
    targetKeyword,
    myProductName,
    existingKeywords,
    minFrequency = KEYWORD_CANDIDATE_CONFIG.COMPETITOR.MIN_FREQUENCY,
  } = input;

  logger.debug('경쟁사 분석 키워드 발굴 시작', {
    productId,
    targetKeyword,
  });

  // 1. 상위 40개 경쟁사 상품 조회
  let competitors: ShoppingSearchItem[];
  try {
    competitors = await shoppingSearchApi.searchTop40(targetKeyword);
  } catch (error) {
    logger.error('경쟁사 상품 조회 실패', {
      targetKeyword,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      productId,
      targetKeyword,
      competitorCount: 0,
      keywordFrequency: new Map(),
      discoveredKeywords: [],
      analysisData: {
        targetKeyword,
        competitorCount: 0,
        discoveredKeywords: [],
        analysisDate: new Date(),
      },
    };
  }

  // 2. 내 상품과 기존 키워드 준비
  const myProductTokens = new Set(
    extractKeywordsFromProductName(myProductName).map((k) => k.toLowerCase())
  );
  const existingSet = new Set(existingKeywords.map((k) => k.toLowerCase()));

  // 3. 빈도 분석
  const frequencyMap = new Map<string, KeywordFrequencyData>();

  for (const competitor of competitors) {
    const productTitle = stripHtmlTags(competitor.title);
    const keywords = extractKeywordsFromProductName(productTitle);

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();

      // 내 상품명에 이미 있는 키워드 제외
      if (myProductTokens.has(lowerKeyword)) continue;

      // 기존 등록 키워드 제외
      if (existingSet.has(lowerKeyword)) continue;

      // 빈도 업데이트
      const existing = frequencyMap.get(lowerKeyword);
      if (existing) {
        // 같은 상품에서 중복 등장은 무시
        if (!existing.sources.includes(productTitle)) {
          existing.frequency++;
          existing.sources.push(productTitle);
        }
      } else {
        frequencyMap.set(lowerKeyword, {
          keyword,
          frequency: 1,
          sources: [productTitle],
        });
      }
    }
  }

  // 4. minFrequency 이상인 키워드만 채택
  const frequentKeywords = Array.from(frequencyMap.values())
    .filter((data) => data.frequency >= minFrequency)
    .sort((a, b) => b.frequency - a.frequency);

  // 5. DiscoveredKeyword 형태로 변환
  const discoveredKeywords: DiscoveredKeyword[] = frequentKeywords.map(
    (data) => ({
      keyword: data.keyword,
      source: 'competitor' as const,
      frequency: data.frequency,
      sourceDetails: data.sources.slice(0, 5), // 최대 5개 출처만 기록
    })
  );

  // 6. 분석 데이터 생성
  const analysisData: CompetitorKeywordAnalysis = {
    targetKeyword,
    competitorCount: competitors.length,
    discoveredKeywords: frequentKeywords.map((data) => ({
      keyword: data.keyword,
      frequency: data.frequency,
      sources: data.sources.slice(0, 5),
    })),
    analysisDate: new Date(),
  };

  logger.info('경쟁사 분석 키워드 발굴 완료', {
    productId,
    targetKeyword,
    competitorCount: competitors.length,
    totalKeywords: frequencyMap.size,
    frequentKeywords: discoveredKeywords.length,
  });

  return {
    productId,
    targetKeyword,
    competitorCount: competitors.length,
    keywordFrequency: frequencyMap,
    discoveredKeywords,
    analysisData,
  };
}

/**
 * 경쟁사 분석 결과 캐싱 (DB에 저장하기 위한 데이터 변환)
 */
export function toAnalysisCacheData(result: CompetitorDiscoveryResult): {
  targetKeyword: string;
  discoveredKeywords: object;
  competitorCount: number;
  analysisDate: Date;
} {
  return {
    targetKeyword: result.targetKeyword,
    discoveredKeywords: result.analysisData.discoveredKeywords,
    competitorCount: result.competitorCount,
    analysisDate: result.analysisData.analysisDate,
  };
}
