/**
 * @file enrich-metrics.ts
 * @description 키워드 검색량/경쟁강도 보강 스크립트
 * @responsibilities
 * - 매핑 키워드 + 후보 키워드의 월간 검색량/경쟁강도 업데이트
 * - 네이버 검색광고 API 호출
 * - 대시보드에서 수동 트리거 가능
 */

import { db } from '@/db/client';
import { logger } from '@/utils/logger';
import { enrichAllProductKeywordMetrics } from '@/services/keyword-discovery';

async function main() {
  logger.info('키워드 검색량 보강 스크립트 시작');

  try {
    const result = await enrichAllProductKeywordMetrics();

    const output = {
      success: true,
      productsProcessed: result.productsProcessed,
      totalEnriched: result.totalEnriched,
      totalFailed: result.totalFailed,
    };

    logger.info('키워드 검색량 보강 완료', output);
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('키워드 검색량 보강 실패', { error: message });
    console.log(JSON.stringify({
      success: false,
      error: message,
    }));
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();
