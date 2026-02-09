/**
 * @file index.ts
 * @description 키워드 발굴 모듈 통합 진입점
 * @responsibilities
 * - 3가지 소스 통합 발굴
 * - 발굴 결과 중복 제거 및 병합
 * - DiscoveryResult 생성
 */

import {
  discoverFromProductName,
  TokenizerDiscoveryInput,
} from './source-tokenizer';
import {
  discoverFromSearchAd,
  SearchAdDiscoveryInput,
} from './source-search-ad';
import {
  discoverFromCompetitors,
  CompetitorDiscoveryInput,
} from './source-competitor';
import {
  filterByRelevance,
  RelevanceFilterResult,
} from './relevance-filter';
import { DiscoveredKeyword, DiscoveryResult } from '@/types/keyword.types';
import { logger } from '@/utils/logger';

// Re-export individual functions
export { discoverFromProductName } from './source-tokenizer';
export { discoverFromSearchAd, getKeywordMetrics } from './source-search-ad';
export {
  discoverFromCompetitors,
  toAnalysisCacheData,
} from './source-competitor';
export {
  filterByRelevance,
  quickFilterByBlacklist,
  checkCategoryRelevance,
} from './relevance-filter';
export type { RelevanceFilterResult } from './relevance-filter';

/**
 * 통합 발굴 입력
 */
export interface DiscoveryInput {
  productId: number;
  productName: string;
  representativeKeyword: string;
  existingKeywords: string[];
  categoryId?: string;
  options?: {
    skipProductName?: boolean;
    skipSearchAd?: boolean;
    skipCompetitor?: boolean;
    seedKeywords?: string[];
    skipRelevanceFilter?: boolean;
    minCategoryMatchRatio?: number;
  };
}

/**
 * 통합 발굴 결과 (필터링 포함)
 */
export interface DiscoveryResultWithFilter extends DiscoveryResult {
  filterResult?: RelevanceFilterResult;
}

/**
 * 키워드 통합 발굴
 * 3가지 소스에서 키워드를 발굴하고 중복 제거 후 병합
 * @param input 발굴 입력
 * @returns 통합 발굴 결과
 */
export async function discoverKeywords(
  input: DiscoveryInput
): Promise<DiscoveryResultWithFilter> {
  const {
    productId,
    productName,
    representativeKeyword,
    existingKeywords,
    categoryId,
    options = {},
  } = input;

  logger.info('키워드 통합 발굴 시작', {
    productId,
    productName,
    representativeKeyword,
    existingCount: existingKeywords.length,
  });

  const allDiscovered: DiscoveredKeyword[] = [];
  const sources = {
    productName: 0,
    searchAd: 0,
    competitor: 0,
  };

  // 중복 제거를 위한 Set
  const seenKeywords = new Set(existingKeywords.map((k) => k.toLowerCase()));

  // 1. 상품명 토큰화 발굴
  if (!options.skipProductName) {
    try {
      const tokenizerInput: TokenizerDiscoveryInput = {
        productId,
        productName,
        existingKeywords: Array.from(seenKeywords),
      };

      const tokenizerResult = await discoverFromProductName(tokenizerInput);

      for (const keyword of tokenizerResult.discoveredKeywords) {
        const lower = keyword.keyword.toLowerCase();
        if (!seenKeywords.has(lower)) {
          seenKeywords.add(lower);
          allDiscovered.push(keyword);
          sources.productName++;
        }
      }
    } catch (error) {
      logger.warn('상품명 토큰화 발굴 실패', {
        productId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 2. 검색광고 연관 키워드 발굴
  if (!options.skipSearchAd) {
    try {
      // 시드 키워드: 대표 키워드 + 옵션으로 전달된 시드
      const seedKeywords = [
        representativeKeyword,
        ...(options.seedKeywords || []),
      ];

      const searchAdInput: SearchAdDiscoveryInput = {
        productId,
        seedKeywords: [...new Set(seedKeywords)], // 중복 제거
        existingKeywords: Array.from(seenKeywords),
      };

      const searchAdResult = await discoverFromSearchAd(searchAdInput);

      for (const keyword of searchAdResult.discoveredKeywords) {
        const lower = keyword.keyword.toLowerCase();
        if (!seenKeywords.has(lower)) {
          seenKeywords.add(lower);
          allDiscovered.push(keyword);
          sources.searchAd++;
        }
      }
    } catch (error) {
      logger.warn('검색광고 연관 키워드 발굴 실패', {
        productId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 3. 경쟁사 상품명 분석 발굴
  if (!options.skipCompetitor) {
    try {
      const competitorInput: CompetitorDiscoveryInput = {
        productId,
        targetKeyword: representativeKeyword,
        myProductName: productName,
        existingKeywords: Array.from(seenKeywords),
      };

      const competitorResult = await discoverFromCompetitors(competitorInput);

      for (const keyword of competitorResult.discoveredKeywords) {
        const lower = keyword.keyword.toLowerCase();
        if (!seenKeywords.has(lower)) {
          seenKeywords.add(lower);
          allDiscovered.push(keyword);
          sources.competitor++;
        }
      }
    } catch (error) {
      logger.warn('경쟁사 분석 발굴 실패', {
        productId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 4. 관련성 필터링 (블랙리스트 + 카테고리)
  let filterResult: RelevanceFilterResult | undefined;

  if (!options.skipRelevanceFilter) {
    filterResult = await filterByRelevance(allDiscovered, categoryId || '', {
      skipCategoryCheck: !categoryId,
      minCategoryMatchRatio: options.minCategoryMatchRatio || 0.3,
    });

    logger.info('관련성 필터링 적용', {
      productId,
      beforeFilter: allDiscovered.length,
      passed: filterResult.passed.length,
      rejected: filterResult.rejected.length,
      needsApproval: filterResult.needsApproval.length,
    });
  }

  const result: DiscoveryResultWithFilter = {
    productId,
    productName,
    discoveredKeywords: filterResult ? filterResult.passed : allDiscovered,
    totalDiscovered: filterResult
      ? filterResult.passed.length
      : allDiscovered.length,
    sources,
    filterResult,
  };

  logger.info('키워드 통합 발굴 완료', {
    productId,
    totalDiscovered: result.totalDiscovered,
    sources: result.sources,
    needsApproval: filterResult?.needsApproval.length || 0,
  });

  return result;
}

/**
 * 발굴된 키워드를 소스별로 정렬
 * competitor > search_ad > product_name 순 (검증된 키워드 우선)
 */
export function sortBySourcePriority(
  keywords: DiscoveredKeyword[]
): DiscoveredKeyword[] {
  const priority: Record<string, number> = {
    competitor: 3,
    search_ad: 2,
    product_name: 1,
  };

  return [...keywords].sort((a, b) => {
    const priorityDiff = (priority[b.source] || 0) - (priority[a.source] || 0);
    if (priorityDiff !== 0) return priorityDiff;

    // 같은 소스면 검색량 기준
    return (b.monthlySearchVolume || 0) - (a.monthlySearchVolume || 0);
  });
}

/**
 * 발굴된 키워드 중 특정 경쟁강도만 필터
 */
export function filterByCompetition(
  keywords: DiscoveredKeyword[],
  allowedCompetitions: readonly ('LOW' | 'MEDIUM' | 'HIGH')[]
): DiscoveredKeyword[] {
  return keywords.filter((k) => {
    // 경쟁강도 정보가 없으면 일단 포함
    if (!k.competitionIndex) return true;
    return allowedCompetitions.includes(k.competitionIndex);
  });
}

/**
 * 발굴된 키워드 중 검색량 범위로 필터
 */
export function filterBySearchVolume(
  keywords: DiscoveredKeyword[],
  maxVolume: number
): DiscoveredKeyword[] {
  return keywords.filter((k) => {
    // 검색량 정보가 없으면 일단 포함
    if (k.monthlySearchVolume === undefined) return true;
    return k.monthlySearchVolume <= maxVolume;
  });
}
