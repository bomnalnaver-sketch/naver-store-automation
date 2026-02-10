/**
 * @file metrics-enricher.ts
 * @description 키워드 검색량/경쟁강도 보강 서비스
 * @responsibilities
 * - keywords 마스터 테이블의 검색량/경쟁강도 업데이트
 * - keyword_candidates 테이블의 검색량/경쟁강도 업데이트
 * - 네이버 검색광고 API를 통한 메트릭 조회
 */

import { db } from '@/db/client';
import { getKeywordMetrics } from './source-search-ad';
import { logger } from '@/utils/logger';

// ============================================
// 타입 정의
// ============================================

export interface EnrichmentResult {
  totalKeywords: number;
  enriched: number;
  failed: number;
  skipped: number;
}

// ============================================
// keywords 마스터 테이블 보강
// ============================================

/**
 * 상품에 매핑된 키워드의 검색량/경쟁강도를 API에서 조회하여 keywords 테이블 업데이트
 */
export async function enrichMappedKeywordMetrics(
  productId: number
): Promise<EnrichmentResult> {
  const result: EnrichmentResult = { totalKeywords: 0, enriched: 0, failed: 0, skipped: 0 };

  // 매핑된 키워드 조회
  const rows = await db.queryMany<{ keyword_id: number; keyword: string }>(
    `SELECT k.id AS keyword_id, k.keyword
     FROM keyword_product_mapping m
     JOIN keywords k ON k.id = m.keyword_id
     WHERE m.product_id = $1`,
    [productId]
  );

  result.totalKeywords = rows.length;
  if (rows.length === 0) return result;

  logger.info('매핑 키워드 검색량 보강 시작', {
    productId,
    keywordCount: rows.length,
  });

  for (const row of rows) {
    try {
      const metrics = await getKeywordMetrics(row.keyword);

      if (!metrics) {
        result.skipped++;
        continue;
      }

      await db.query(
        `UPDATE keywords SET
           monthly_pc_search = $1,
           monthly_mobile_search = $2,
           monthly_total_search = $3,
           competition_index = $4,
           updated_at = NOW()
         WHERE id = $5`,
        [
          metrics.monthlyPcQcCnt,
          metrics.monthlyMobileQcCnt,
          metrics.monthlyPcQcCnt + metrics.monthlyMobileQcCnt,
          metrics.compIdx || null,
          row.keyword_id,
        ]
      );

      result.enriched++;
    } catch (error) {
      result.failed++;
      logger.warn('키워드 검색량 보강 실패', {
        keyword: row.keyword,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('매핑 키워드 검색량 보강 완료', {
    productId,
    ...result,
  });

  return result;
}

// ============================================
// keyword_candidates 테이블 보강
// ============================================

/**
 * 상품의 후보 키워드 중 검색량이 없는 것을 API에서 조회하여 업데이트
 */
export async function enrichCandidateMetrics(
  productId: number
): Promise<EnrichmentResult> {
  const result: EnrichmentResult = { totalKeywords: 0, enriched: 0, failed: 0, skipped: 0 };

  // 검색량이 0이거나 경쟁강도가 없는 후보 조회
  const rows = await db.queryMany<{ id: number; keyword: string }>(
    `SELECT id, keyword FROM keyword_candidates
     WHERE product_id = $1
       AND (monthly_search_volume = 0 OR monthly_search_volume IS NULL OR competition_index IS NULL)
       AND approval_status IN ('pending', 'approved')`,
    [productId]
  );

  result.totalKeywords = rows.length;
  if (rows.length === 0) return result;

  logger.info('후보 키워드 검색량 보강 시작', {
    productId,
    keywordCount: rows.length,
  });

  for (const row of rows) {
    try {
      const metrics = await getKeywordMetrics(row.keyword);

      if (!metrics) {
        result.skipped++;
        continue;
      }

      const totalSearch = metrics.monthlyPcQcCnt + metrics.monthlyMobileQcCnt;

      await db.query(
        `UPDATE keyword_candidates SET
           monthly_search_volume = $1,
           competition_index = $2,
           updated_at = NOW()
         WHERE id = $3`,
        [totalSearch, metrics.compIdx || null, row.id]
      );

      result.enriched++;
    } catch (error) {
      result.failed++;
      logger.warn('후보 키워드 검색량 보강 실패', {
        keyword: row.keyword,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('후보 키워드 검색량 보강 완료', {
    productId,
    ...result,
  });

  return result;
}

// ============================================
// 통합 보강 (매핑 + 후보)
// ============================================

/**
 * 상품의 모든 키워드(매핑 + 후보) 검색량/경쟁강도 일괄 보강
 */
export async function enrichAllKeywordMetrics(
  productId: number
): Promise<{ mapped: EnrichmentResult; candidates: EnrichmentResult }> {
  const mapped = await enrichMappedKeywordMetrics(productId);
  const candidates = await enrichCandidateMetrics(productId);

  return { mapped, candidates };
}

/**
 * 전체 상품의 키워드 검색량 보강 (일일 자동화용)
 */
export async function enrichAllProductKeywordMetrics(): Promise<{
  productsProcessed: number;
  totalEnriched: number;
  totalFailed: number;
}> {
  const products = await db.queryMany<{ id: number }>(
    `SELECT id FROM products WHERE excluded_from_test = false ORDER BY id`
  );

  let totalEnriched = 0;
  let totalFailed = 0;

  for (const product of products) {
    try {
      const result = await enrichAllKeywordMetrics(product.id);
      totalEnriched += result.mapped.enriched + result.candidates.enriched;
      totalFailed += result.mapped.failed + result.candidates.failed;
    } catch (error) {
      totalFailed++;
      logger.error('상품 키워드 검색량 보강 실패', {
        productId: product.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    productsProcessed: products.length,
    totalEnriched,
    totalFailed,
  };
}
