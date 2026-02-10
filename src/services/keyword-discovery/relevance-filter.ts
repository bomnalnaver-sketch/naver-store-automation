/**
 * @file relevance-filter.ts
 * @description 키워드 관련성 필터링 (블랙리스트 + 카테고리 검증)
 * @responsibilities
 * - 브랜드/수식어 블랙리스트 필터링
 * - 카테고리 관련성 검증
 * - 필터링 결과 및 사유 제공
 */

import { shoppingSearchApi } from '@/services/naver-api/shopping-search-api';
import {
  checkBlacklist,
  isBlacklistedBrand,
  isBlacklistedModifier,
} from '@/config/brand-blacklist';
import { DiscoveredKeyword } from '@/types/keyword.types';
import { logger } from '@/utils/logger';

/**
 * 수동 승인 대상 키워드 (카테고리 매치율 포함)
 */
export interface NeedsApprovalKeyword extends DiscoveredKeyword {
  categoryMatchRatio?: number;
}

/**
 * 관련성 필터링 결과
 */
export interface RelevanceFilterResult {
  passed: DiscoveredKeyword[];
  rejected: Array<{
    keyword: DiscoveredKeyword;
    reason: string;
    details?: string;
  }>;
  needsApproval: NeedsApprovalKeyword[];
}

/**
 * 카테고리 관련성 검증 결과
 */
export interface CategoryRelevanceResult {
  keyword: string;
  isRelevant: boolean;
  matchRatio: number;
  myCategoryId: string;
  topCategories: Array<{ categoryId: string; count: number }>;
}

/**
 * 단일 키워드 블랙리스트 필터링
 */
export function filterByBlacklist(
  keyword: string
): { passed: boolean; reason?: string } {
  const result = checkBlacklist(keyword);

  if (result.isBlacklisted) {
    const reasonText =
      result.reason === 'brand'
        ? `경쟁 브랜드 (${result.matchedTerm})`
        : `무의미 수식어 (${result.matchedTerm})`;

    return { passed: false, reason: reasonText };
  }

  return { passed: true };
}

/**
 * 카테고리 관련성 검증
 * 키워드 검색 결과의 카테고리와 내 상품 카테고리 비교
 * @param keyword 검증할 키워드
 * @param myCategoryId 내 상품 카테고리 ID
 * @param minMatchRatio 최소 일치율 (기본 30%)
 */
export async function checkCategoryRelevance(
  keyword: string,
  myCategoryId: string,
  minMatchRatio: number = 0.3
): Promise<CategoryRelevanceResult> {
  try {
    const searchResults = await shoppingSearchApi.searchTop40(keyword);

    // 검색 결과 없으면 관련성 판단 불가 → 일단 통과
    if (searchResults.length === 0) {
      return {
        keyword,
        isRelevant: true,
        matchRatio: 1.0,
        myCategoryId,
        topCategories: [],
      };
    }

    // 카테고리별 등장 횟수 집계
    const categoryCount = new Map<string, number>();
    let myMatch = 0;

    for (const item of searchResults) {
      // 카테고리 ID 추출 (category1 ~ category4 중 가장 세부적인 것)
      const categoryId =
        item.category4 || item.category3 || item.category2 || item.category1;

      if (categoryId) {
        categoryCount.set(categoryId, (categoryCount.get(categoryId) || 0) + 1);

        // 내 카테고리와 일치 여부 (대분류 기준으로도 확인)
        if (
          categoryId === myCategoryId ||
          item.category1 === myCategoryId ||
          item.category2 === myCategoryId ||
          item.category3 === myCategoryId
        ) {
          myMatch++;
        }
      }
    }

    const matchRatio = myMatch / searchResults.length;

    // 상위 카테고리 정렬
    const topCategories = Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([categoryId, count]) => ({ categoryId, count }));

    return {
      keyword,
      isRelevant: matchRatio >= minMatchRatio,
      matchRatio,
      myCategoryId,
      topCategories,
    };
  } catch (error) {
    logger.warn('카테고리 관련성 검증 실패, 일단 통과 처리', {
      keyword,
      error: error instanceof Error ? error.message : String(error),
    });

    // API 에러 시 일단 통과
    return {
      keyword,
      isRelevant: true,
      matchRatio: 1.0,
      myCategoryId,
      topCategories: [],
    };
  }
}

/**
 * 발굴된 키워드 관련성 필터링
 * 1차: 블랙리스트 필터링
 * 2차: 카테고리 관련성 검증
 * @param keywords 발굴된 키워드 목록
 * @param myCategoryId 내 상품 카테고리 ID
 * @param options 필터링 옵션
 */
export async function filterByRelevance(
  keywords: DiscoveredKeyword[],
  myCategoryId: string,
  options: {
    skipCategoryCheck?: boolean;
    minCategoryMatchRatio?: number;
  } = {}
): Promise<RelevanceFilterResult> {
  const { skipCategoryCheck = false, minCategoryMatchRatio = 0.3 } = options;

  const passed: DiscoveredKeyword[] = [];
  const rejected: RelevanceFilterResult['rejected'] = [];
  const needsApproval: NeedsApprovalKeyword[] = [];

  logger.debug('관련성 필터링 시작', {
    totalKeywords: keywords.length,
    myCategoryId,
    skipCategoryCheck,
  });

  for (const keyword of keywords) {
    // 1차: 블랙리스트 필터링
    const blacklistResult = filterByBlacklist(keyword.keyword);
    if (!blacklistResult.passed) {
      rejected.push({
        keyword,
        reason: 'blacklist',
        details: blacklistResult.reason,
      });
      continue;
    }

    // 2차: 카테고리 관련성 검증 (옵션)
    if (!skipCategoryCheck && myCategoryId) {
      const relevanceResult = await checkCategoryRelevance(
        keyword.keyword,
        myCategoryId,
        minCategoryMatchRatio
      );

      if (!relevanceResult.isRelevant) {
        // 관련성 낮은 키워드는 수동 승인 대상 (매치율 포함)
        needsApproval.push({
          ...keyword,
          categoryMatchRatio: relevanceResult.matchRatio,
        });
        logger.debug('카테고리 관련성 낮음 → 수동 승인 필요', {
          keyword: keyword.keyword,
          matchRatio: relevanceResult.matchRatio,
          minRequired: minCategoryMatchRatio,
        });
        continue;
      }

      // 통과한 키워드에도 카테고리 매치율 저장
      keyword.categoryMatchRatio = relevanceResult.matchRatio;
    }

    // 모든 필터 통과
    passed.push(keyword);
  }

  logger.info('관련성 필터링 완료', {
    total: keywords.length,
    passed: passed.length,
    rejected: rejected.length,
    needsApproval: needsApproval.length,
  });

  return { passed, rejected, needsApproval };
}

/**
 * 빠른 블랙리스트 필터링 (카테고리 검증 없이)
 */
export function quickFilterByBlacklist(
  keywords: DiscoveredKeyword[]
): RelevanceFilterResult {
  const passed: DiscoveredKeyword[] = [];
  const rejected: RelevanceFilterResult['rejected'] = [];

  for (const keyword of keywords) {
    const result = filterByBlacklist(keyword.keyword);
    if (result.passed) {
      passed.push(keyword);
    } else {
      rejected.push({
        keyword,
        reason: 'blacklist',
        details: result.reason,
      });
    }
  }

  return { passed, rejected, needsApproval: [] };
}
