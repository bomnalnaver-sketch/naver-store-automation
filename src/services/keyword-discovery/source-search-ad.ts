/**
 * @file source-search-ad.ts
 * @description 네이버 검색광고 연관 키워드 기반 발굴
 * @responsibilities
 * - 연관 키워드 API 호출
 * - 경쟁강도/검색량 데이터 추출
 * - 기존 등록 키워드 제외
 */

import { searchAdApi } from '@/services/naver-api/search-ad-api';
import { DiscoveredKeyword } from '@/types/keyword.types';
import { SearchAdRelatedKeyword } from '@/types/naver-api.types';
import { AD_KEYWORD_CONFIG } from '@/config/app-config';
import { logger } from '@/utils/logger';

/**
 * 검색광고 연관 키워드 발굴 입력
 */
export interface SearchAdDiscoveryInput {
  productId: number;
  seedKeywords: string[];
  existingKeywords: string[];
  maxResults?: number;
}

/**
 * 검색광고 연관 키워드 발굴 결과
 */
export interface SearchAdDiscoveryResult {
  productId: number;
  seedKeywords: string[];
  relatedKeywordsRaw: SearchAdRelatedKeyword[];
  discoveredKeywords: DiscoveredKeyword[];
}

/**
 * 연관 키워드 API 응답을 DiscoveredKeyword로 변환
 */
function toDiscoveredKeyword(
  relKeyword: SearchAdRelatedKeyword,
  seedKeyword: string
): DiscoveredKeyword {
  const totalMonthlySearch =
    relKeyword.monthlyPcQcCnt + relKeyword.monthlyMobileQcCnt;

  return {
    keyword: relKeyword.relKeyword,
    source: 'search_ad' as const,
    competitionIndex: relKeyword.compIdx,
    monthlySearchVolume: totalMonthlySearch,
    sourceDetails: [`seed: ${seedKeyword}`],
  };
}

/**
 * 검색광고 연관 키워드 발굴
 * @param input 발굴 입력
 * @returns 발굴 결과
 */
export async function discoverFromSearchAd(
  input: SearchAdDiscoveryInput
): Promise<SearchAdDiscoveryResult> {
  const {
    productId,
    seedKeywords,
    existingKeywords,
    maxResults = AD_KEYWORD_CONFIG.MAX_RELATED_KEYWORDS,
  } = input;

  logger.debug('검색광고 연관 키워드 발굴 시작', {
    productId,
    seedKeywordCount: seedKeywords.length,
  });

  const existingSet = new Set(existingKeywords.map((k) => k.toLowerCase()));
  const allRelatedKeywords: SearchAdRelatedKeyword[] = [];
  const keywordMap = new Map<string, DiscoveredKeyword>();

  // 각 시드 키워드에서 연관 키워드 조회
  for (const seedKeyword of seedKeywords) {
    try {
      const relatedKeywords = await searchAdApi.getRelatedKeywords(seedKeyword);

      allRelatedKeywords.push(...relatedKeywords);

      for (const relKeyword of relatedKeywords) {
        const keyword = relKeyword.relKeyword;
        const lowerKeyword = keyword.toLowerCase();

        // 기존 키워드 제외
        if (existingSet.has(lowerKeyword)) continue;

        // 시드 키워드와 동일한 경우 제외
        if (seedKeywords.some((s) => s.toLowerCase() === lowerKeyword)) continue;

        // 중복 방지 (이미 발견된 키워드는 더 높은 검색량 기준 유지)
        const existing = keywordMap.get(lowerKeyword);
        const discovered = toDiscoveredKeyword(relKeyword, seedKeyword);

        if (
          !existing ||
          (discovered.monthlySearchVolume || 0) >
            (existing.monthlySearchVolume || 0)
        ) {
          keywordMap.set(lowerKeyword, discovered);
        }
      }
    } catch (error) {
      logger.warn('연관 키워드 조회 실패', {
        seedKeyword,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 검색량 기준 정렬 후 상위 N개만 선택
  const discoveredKeywords = Array.from(keywordMap.values())
    .sort((a, b) => (b.monthlySearchVolume || 0) - (a.monthlySearchVolume || 0))
    .slice(0, maxResults);

  logger.info('검색광고 연관 키워드 발굴 완료', {
    productId,
    totalRelated: allRelatedKeywords.length,
    uniqueNew: keywordMap.size,
    selected: discoveredKeywords.length,
  });

  return {
    productId,
    seedKeywords,
    relatedKeywordsRaw: allRelatedKeywords,
    discoveredKeywords,
  };
}

/**
 * 단일 키워드의 연관 키워드 발굴 (간편 버전)
 */
export async function discoverRelatedKeywords(
  keyword: string,
  existingKeywords: string[] = []
): Promise<DiscoveredKeyword[]> {
  const result = await discoverFromSearchAd({
    productId: 0,
    seedKeywords: [keyword],
    existingKeywords,
  });

  return result.discoveredKeywords;
}

/**
 * 연관 키워드의 검색량/경쟁강도 조회
 * 단순히 API 응답을 그대로 반환
 */
export async function getKeywordMetrics(
  keyword: string
): Promise<SearchAdRelatedKeyword | null> {
  try {
    const relatedKeywords = await searchAdApi.getRelatedKeywords(keyword);

    // 입력 키워드 자체의 정보를 찾거나, 첫 번째 결과 반환
    const exactMatch = relatedKeywords.find(
      (rk) => rk.relKeyword.toLowerCase() === keyword.toLowerCase()
    );

    return exactMatch || null;
  } catch (error) {
    logger.warn('키워드 메트릭 조회 실패', {
      keyword,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
