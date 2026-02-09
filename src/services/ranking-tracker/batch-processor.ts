/**
 * @file batch-processor.ts
 * @description 다중 키워드 일괄 순위 수집 서비스
 * @responsibilities
 * - 상품별 다중 키워드 일괄 순위 조회
 * - 일일 순위 수집 전체 흐름 (활성 상품 조회 -> 키워드 수집 -> DB 저장)
 * - 순위 결과 DB 저장 (단건/일괄)
 * - API 예산 확인 및 보호
 */

import { getProductRankWithRetry } from '@/services/ranking-tracker/rank-checker';
import { shoppingApiBudget } from '@/shared/api-budget-tracker';
import { logger } from '@/utils/logger';
import { sleep } from '@/utils/sleep';
import { db } from '@/db/client';
import { RANKING_CONFIG } from '@/config/app-config';
import { RankCheckConfig, RankResult, BatchRankResult } from '@/types/keyword.types';

/** 활성 상품 조회 결과 타입 */
interface ActiveProduct {
  id: number;
  naver_shopping_product_id: string | undefined;
  representative_keyword: string | null;
}

/** 추적 대상 키워드 조회 결과 타입 */
interface TrackedKeyword {
  keyword: string;
}

/** 일일 순위 수집 결과 타입 */
interface DailyCollectionResult {
  totalProducts: number;
  totalKeywords: number;
  totalApiCalls: number;
  executionTimeMs: number;
}

/**
 * 특정 상품의 다중 키워드 순위를 일괄 조회
 * 각 키워드를 순차 처리하며 Rate limit 딜레이를 적용
 * @param productId 네이버 쇼핑 상품 ID
 * @param keywords 조회할 키워드 배열
 * @param config 순위 조회 설정
 * @returns 일괄 조회 결과 (결과 배열, 총 API 호출 수, 실행 시간)
 */
export async function batchGetProductRanks(
  productId: string,
  keywords: string[],
  config?: Partial<RankCheckConfig>
): Promise<BatchRankResult> {
  const startTime = Date.now();
  const results: RankResult[] = [];
  let totalApiCalls = 0;
  const rateLimitDelay = config?.RATE_LIMIT_DELAY ?? RANKING_CONFIG.RATE_LIMIT_DELAY;

  logger.info('일괄 순위 조회 시작', {
    productId,
    keywordCount: keywords.length,
  });

  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    if (!keyword) continue;

    try {
      const result = await getProductRankWithRetry(keyword, productId, config);
      results.push(result);
      totalApiCalls += result.apiCalls;
    } catch (error) {
      // 개별 키워드 실패 시 null rank로 기록하고 계속 진행
      logger.error('키워드 순위 조회 실패, 건너뜀', {
        keyword,
        productId,
        error: error instanceof Error ? error.message : String(error),
      });

      results.push({
        keyword,
        productId,
        rank: null,
        checkedAt: new Date(),
        apiCalls: 0,
      });
    }

    // 마지막 키워드가 아닐 때만 딜레이 적용
    if (i < keywords.length - 1) {
      await sleep(rateLimitDelay);
    }
  }

  const executionTimeMs = Date.now() - startTime;

  logger.info('일괄 순위 조회 완료', {
    productId,
    keywordCount: keywords.length,
    totalApiCalls,
    executionTimeMs,
  });

  return {
    results,
    totalApiCalls,
    executionTimeMs,
  };
}

/**
 * 활성 상품 목록 조회 (excluded_from_test = false)
 * @returns 활성 상품 배열
 */
async function getActiveProducts(): Promise<ActiveProduct[]> {
  return db.queryMany<ActiveProduct>(
    `SELECT id, naver_shopping_product_id, representative_keyword
     FROM products
     WHERE excluded_from_test = false
       AND naver_shopping_product_id IS NOT NULL`
  );
}

/**
 * 상품에 연결된 추적 대상 키워드 목록 조회
 * @param productId 내부 상품 ID (products.id)
 * @returns 키워드 문자열 배열
 */
async function getTrackedKeywords(productId: number): Promise<string[]> {
  const rows = await db.queryMany<TrackedKeyword>(
    `SELECT k.keyword
     FROM keyword_product_mapping kpm
     JOIN keywords k ON k.id = kpm.keyword_id
     WHERE kpm.product_id = $1
       AND kpm.is_tracked = true`,
    [productId]
  );

  return rows.map((row) => row.keyword);
}

/**
 * 단일 순위 결과를 keyword_ranking_daily 테이블에 저장
 * @param result 순위 조회 결과
 */
export async function saveRankResult(result: RankResult): Promise<void> {
  await db.query(
    `INSERT INTO keyword_ranking_daily
       (product_id, keyword, rank, rank_limit, checked_at, api_calls)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      result.productId,
      result.keyword,
      result.rank,
      RANKING_CONFIG.RANK_CHECK_LIMIT,
      result.checkedAt,
      result.apiCalls,
    ]
  );
}

/**
 * 다중 순위 결과를 트랜잭션으로 일괄 저장
 * @param results 순위 조회 결과 배열
 * @param rankLimit 측정에 사용한 순위 범위
 */
export async function saveRankResults(
  results: RankResult[],
  rankLimit: number
): Promise<void> {
  if (results.length === 0) return;

  await db.transaction(async (client) => {
    for (const result of results) {
      await client.query(
        `INSERT INTO keyword_ranking_daily
           (product_id, keyword, rank, rank_limit, checked_at, api_calls)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          result.productId,
          result.keyword,
          result.rank,
          rankLimit,
          result.checkedAt,
          result.apiCalls,
        ]
      );
    }
  });

  logger.debug('순위 결과 일괄 저장 완료', { count: results.length });
}

/**
 * 일일 순위 수집 전체 실행
 * 1. 활성 상품 목록 조회
 * 2. 각 상품의 추적 키워드 조회
 * 3. API 예산 확인 후 순위 수집
 * 4. 결과 DB 저장
 * @returns 수집 통계 (상품 수, 키워드 수, API 호출 수, 실행 시간)
 */
export async function collectDailyRankings(): Promise<DailyCollectionResult> {
  const startTime = Date.now();
  let totalProducts = 0;
  let totalKeywords = 0;
  let totalApiCalls = 0;

  logger.info('일일 순위 수집 시작');

  // 1. 활성 상품 목록 조회
  const activeProducts = await getActiveProducts();

  if (activeProducts.length === 0) {
    logger.info('추적할 활성 상품이 없습니다');
    return { totalProducts: 0, totalKeywords: 0, totalApiCalls: 0, executionTimeMs: 0 };
  }

  logger.info('활성 상품 조회 완료', { count: activeProducts.length });

  // 2. 각 상품별 순위 수집
  for (const product of activeProducts) {
    // API 예산 확인
    if (!shoppingApiBudget.canMakeCall('ranking')) {
      logger.warn('API 예산 부족으로 순위 수집 중단', {
        processedProducts: totalProducts,
        remainingProducts: activeProducts.length - totalProducts,
      });
      break;
    }

    // naver_shopping_product_id가 없으면 건너뜀
    if (!product.naver_shopping_product_id) {
      logger.debug('네이버 쇼핑 상품 ID 없음, 건너뜀', { productId: product.id });
      continue;
    }

    // 추적 키워드 조회
    let keywords = await getTrackedKeywords(product.id);

    // 추적 키워드가 없으면 대표 키워드 사용
    if (keywords.length === 0 && product.representative_keyword) {
      keywords = [product.representative_keyword];
      logger.debug('추적 키워드 없음, 대표 키워드 사용', {
        productId: product.id,
        keyword: product.representative_keyword,
      });
    }

    if (keywords.length === 0) {
      logger.debug('추적/대표 키워드 없음, 건너뜀', { productId: product.id });
      continue;
    }

    // 순위 수집
    const batchResult = await batchGetProductRanks(
      product.naver_shopping_product_id,
      keywords
    );

    // 결과 저장
    await saveRankResults(batchResult.results, RANKING_CONFIG.RANK_CHECK_LIMIT);

    totalProducts++;
    totalKeywords += keywords.length;
    totalApiCalls += batchResult.totalApiCalls;
  }

  const executionTimeMs = Date.now() - startTime;

  logger.info('일일 순위 수집 완료', {
    totalProducts,
    totalKeywords,
    totalApiCalls,
    executionTimeMs,
  });

  return {
    totalProducts,
    totalKeywords,
    totalApiCalls,
    executionTimeMs,
  };
}
