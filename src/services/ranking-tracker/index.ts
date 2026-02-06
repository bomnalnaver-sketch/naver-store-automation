/**
 * @file index.ts
 * @description 순위 추적 모듈 통합 진입점
 * @responsibilities
 * - 일일 순위 수집 잡 실행 (수집 -> 분석 -> 알림 저장)
 * - 하위 모듈 re-export
 */

import { logger } from '@/utils/logger';
import { db } from '@/db/client';
import { collectDailyRankings } from '@/services/ranking-tracker/batch-processor';
import {
  analyzeRankChanges,
  saveAlerts,
  detectPopularitySurge,
} from '@/services/ranking-tracker/alert-analyzer';
import { RankAlert } from '@/types/keyword.types';

/** 일일 순위 수집 잡 결과 타입 */
interface DailyRankingJobResult {
  collectResult: {
    totalProducts: number;
    totalKeywords: number;
    totalApiCalls: number;
    executionTimeMs: number;
  };
  alerts: RankAlert[];
  surgeDetected: boolean;
}

/**
 * 일일 순위 수집 잡 실행
 * 1. 전체 활성 상품의 순위 수집
 * 2. 각 상품별 순위 변동 분석
 * 3. 알림 저장
 * 4. 인기도 급변 감지
 * @returns 수집 결과, 알림 목록, 급변 감지 여부
 */
export async function runDailyRankingJob(): Promise<DailyRankingJobResult> {
  logger.info('일일 순위 수집 잡 시작');

  // 1. 순위 수집
  const collectResult = await collectDailyRankings();

  // 2. 각 상품별 순위 변동 분석
  const today = new Date();
  const allAlerts: RankAlert[] = [];
  let surgeDetected = false;

  // 활성 상품 목록 조회 (수집된 상품만 분석)
  const products = await db.queryMany<{ naver_shopping_product_id: string }>(
    `SELECT DISTINCT naver_shopping_product_id
     FROM products
     WHERE excluded_from_test = false
       AND naver_shopping_product_id IS NOT NULL`
  );

  for (const product of products) {
    const alerts = await analyzeRankChanges(
      product.naver_shopping_product_id,
      today
    );

    if (alerts.length > 0) {
      await saveAlerts(alerts);
      allAlerts.push(...alerts);

      // 인기도 급변 감지
      if (detectPopularitySurge(product.naver_shopping_product_id, alerts)) {
        surgeDetected = true;
      }
    }
  }

  logger.info('일일 순위 수집 잡 완료', {
    totalProducts: collectResult.totalProducts,
    totalKeywords: collectResult.totalKeywords,
    totalApiCalls: collectResult.totalApiCalls,
    executionTimeMs: collectResult.executionTimeMs,
    alertCount: allAlerts.length,
    surgeDetected,
  });

  return {
    collectResult,
    alerts: allAlerts,
    surgeDetected,
  };
}

// ============================================
// Re-exports
// ============================================

export { getProductRank, getProductRankWithRetry } from '@/services/ranking-tracker/rank-checker';
export { batchGetProductRanks, collectDailyRankings, saveRankResult, saveRankResults } from '@/services/ranking-tracker/batch-processor';
export { analyzeRankChanges, detectPopularitySurge, saveAlerts, getUnreadAlerts, markAlertsAsRead } from '@/services/ranking-tracker/alert-analyzer';
