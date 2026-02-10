/**
 * @file discover-keywords.ts
 * @description 키워드 발굴 + 선정만 독립 실행하는 스크립트
 * @responsibilities
 * - Phase 3 (키워드 발굴) 실행
 * - Phase 4 (키워드 선정/점수화) 실행
 * - 대시보드에서 수동 트리거 가능
 */

import { db } from '@/db/client';
import { logger } from '@/utils/logger';
import { discoverKeywords } from '@/services/keyword-discovery';
import { selectKeywords } from '@/services/keyword-selector';
import { KeywordCandidate } from '@/types/keyword.types';

interface Product {
  id: number;
  naver_product_id: string;
  product_name: string;
  category_id: string;
  representative_keyword: string;
  representative_keyword_rank: number | null;
}

interface DiscoverResult {
  success: boolean;
  totalDiscovered: number;
  totalSelected: number;
  pendingApproval: number;
  productsProcessed: number;
  duration: number;
  errors: string[];
}

/**
 * 키워드 발굴 + 선정 실행
 */
async function runKeywordDiscovery(): Promise<DiscoverResult> {
  const startTime = Date.now();
  const result: DiscoverResult = {
    success: false,
    totalDiscovered: 0,
    totalSelected: 0,
    pendingApproval: 0,
    productsProcessed: 0,
    duration: 0,
    errors: [],
  };

  logger.info('=== 키워드 발굴 수동 실행 시작 ===');

  try {
    // 활성 상품 조회
    const productsResult = await db.query(
      `SELECT id, naver_product_id, product_name, category_id,
              representative_keyword, representative_keyword_rank
       FROM products
       WHERE COALESCE(excluded_from_test, false) = false
       ORDER BY id`
    );
    const products: Product[] = productsResult.rows;

    logger.info(`활성 상품 ${products.length}개 조회`);

    // 금지어 사전 조회 (전 상품 공통, 한 번만)
    const redundantResult = await db.query(
      `SELECT keyword FROM redundant_keywords_dict`
    );
    const globalBlacklist = redundantResult.rows.map((r: any) => r.keyword);

    // Phase 3: 키워드 발굴
    for (const product of products) {
      if (!product.representative_keyword) continue;

      try {
        // 기존 키워드 목록
        const existingResult = await db.query(
          `SELECT keyword FROM keyword_candidates WHERE product_id = $1`,
          [product.id]
        );
        const existingKeywords = existingResult.rows.map((r: any) => r.keyword);

        // 실패/퇴역/거부 키워드 + 금지어 사전
        const failedResult = await db.query(
          `SELECT keyword FROM keyword_candidates WHERE product_id = $1 AND status IN ('failed', 'retired', 'rejected')`,
          [product.id]
        );
        const failedKeywords = [
          ...failedResult.rows.map((r: any) => r.keyword),
          ...globalBlacklist,
        ];

        // 키워드 발굴 (실패/금지어 제외)
        const discoveryResult = await discoverKeywords({
          productId: product.id,
          productName: product.product_name,
          representativeKeyword: product.representative_keyword,
          existingKeywords,
          failedKeywords,
          categoryId: product.category_id,
        });

        result.totalDiscovered += discoveryResult.totalDiscovered;

        // 발굴된 키워드 DB 저장 (기존 데이터도 검색량/경쟁지수/관련성 업데이트)
        for (const keyword of discoveryResult.discoveredKeywords) {
          await db.query(
            `INSERT INTO keyword_candidates
             (product_id, keyword, source, competition_index, monthly_search_volume, category_match_ratio, candidate_score, approval_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved')
             ON CONFLICT (product_id, keyword) DO UPDATE SET
               competition_index = COALESCE(EXCLUDED.competition_index, keyword_candidates.competition_index),
               monthly_search_volume = CASE WHEN EXCLUDED.monthly_search_volume > 0 THEN EXCLUDED.monthly_search_volume ELSE keyword_candidates.monthly_search_volume END,
               category_match_ratio = COALESCE(EXCLUDED.category_match_ratio, keyword_candidates.category_match_ratio),
               updated_at = NOW()`,
            [
              product.id,
              keyword.keyword,
              keyword.source,
              keyword.competitionIndex || null,
              keyword.monthlySearchVolume || 0,
              keyword.categoryMatchRatio ?? null,
              0,
            ]
          );
        }

        // 수동 승인 대기 키워드 (검색량, 경쟁지수, 관련성 비율 포함)
        if (discoveryResult.filterResult?.needsApproval) {
          for (const keyword of discoveryResult.filterResult.needsApproval) {
            await db.query(
              `INSERT INTO keyword_candidates
               (product_id, keyword, source, status, approval_status, filter_reason,
                competition_index, monthly_search_volume, category_match_ratio)
               VALUES ($1, $2, $3, 'pending_approval', 'pending', $4, $5, $6, $7)
               ON CONFLICT (product_id, keyword) DO UPDATE SET
                 competition_index = COALESCE(EXCLUDED.competition_index, keyword_candidates.competition_index),
                 monthly_search_volume = CASE WHEN EXCLUDED.monthly_search_volume > 0 THEN EXCLUDED.monthly_search_volume ELSE keyword_candidates.monthly_search_volume END,
                 category_match_ratio = COALESCE(EXCLUDED.category_match_ratio, keyword_candidates.category_match_ratio),
                 updated_at = NOW()`,
              [
                product.id,
                keyword.keyword,
                keyword.source,
                '카테고리 관련성 낮음',
                keyword.competitionIndex || null,
                keyword.monthlySearchVolume || 0,
                keyword.categoryMatchRatio ?? null,
              ]
            );
            result.pendingApproval++;
          }
        }

        result.productsProcessed++;
      } catch (error: any) {
        result.errors.push(`상품 ${product.id} 발굴 실패: ${error.message}`);
        logger.error(`상품 ${product.id} 키워드 발굴 실패`, { error: error.message });
      }
    }

    logger.info(`Phase 3 완료: ${result.totalDiscovered}개 발굴`);

    // Phase 4: 키워드 점수 업데이트 (승인 대기 포함 전체)
    for (const product of products) {
      try {
        // 승인된 후보 + 승인 대기 후보 모두 점수 산정
        const candidatesResult = await db.query(
          `SELECT * FROM keyword_candidates
           WHERE product_id = $1 AND status IN ('candidate', 'pending_approval')`,
          [product.id]
        );

        if (candidatesResult.rows.length === 0) continue;

        const candidates: KeywordCandidate[] = candidatesResult.rows.map(rowToCandidate);

        const testingResult = await db.query(
          `SELECT * FROM keyword_candidates WHERE product_id = $1 AND status = 'testing'`,
          [product.id]
        );
        const existingCandidates: KeywordCandidate[] = testingResult.rows.map(rowToCandidate);

        const failedResult = await db.query(
          `SELECT keyword FROM keyword_candidates WHERE product_id = $1 AND status IN ('failed', 'retired')`,
          [product.id]
        );
        const failedKeywords = failedResult.rows.map((r: any) => r.keyword);

        const selectionResult = await selectKeywords({
          productId: product.id,
          representativeKeywordRank: product.representative_keyword_rank,
          discoveredKeywords: candidates.map((c) => ({
            keyword: c.keyword,
            source: c.source,
            competitionIndex: c.competitionIndex || undefined,
            monthlySearchVolume: c.monthlySearchVolume,
          })),
          existingCandidates,
          failedKeywords,
        });

        // 선정된 키워드 점수 업데이트
        for (const { candidate, scoreDetails } of selectionResult.selectedCandidates) {
          await db.query(
            `UPDATE keyword_candidates
             SET candidate_score = $1, updated_at = NOW()
             WHERE product_id = $2 AND keyword = $3`,
            [scoreDetails.totalScore, product.id, candidate.keyword]
          );
          result.totalSelected++;
        }

        // 선정되지 않은 키워드도 점수 업데이트 (대시보드 비교용)
        for (const { candidate } of selectionResult.rejectedCandidates) {
          if (candidate.candidateScore > 0) {
            await db.query(
              `UPDATE keyword_candidates
               SET candidate_score = $1, updated_at = NOW()
               WHERE product_id = $2 AND keyword = $3`,
              [candidate.candidateScore, product.id, candidate.keyword]
            );
          }
        }
      } catch (error: any) {
        result.errors.push(`상품 ${product.id} 선정 실패: ${error.message}`);
        logger.error(`상품 ${product.id} 키워드 선정 실패`, { error: error.message });
      }
    }

    result.success = true;
    result.duration = Date.now() - startTime;

    logger.info('=== 키워드 발굴 수동 실행 완료 ===', {
      totalDiscovered: result.totalDiscovered,
      totalSelected: result.totalSelected,
      pendingApproval: result.pendingApproval,
      productsProcessed: result.productsProcessed,
      duration: result.duration,
    });

    return result;
  } catch (error: any) {
    result.errors.push(error.message);
    result.duration = Date.now() - startTime;
    logger.error('키워드 발굴 수동 실행 실패', { error: error.message });
    return result;
  }
}

function rowToCandidate(row: any): KeywordCandidate {
  return {
    id: row.id,
    productId: row.product_id,
    keywordId: row.keyword_id,
    keyword: row.keyword,
    source: row.source,
    discoveredAt: new Date(row.discovered_at),
    status: row.status,
    competitionIndex: row.competition_index,
    monthlySearchVolume: row.monthly_search_volume || 0,
    testStartedAt: row.test_started_at ? new Date(row.test_started_at) : null,
    testEndedAt: row.test_ended_at ? new Date(row.test_ended_at) : null,
    testResult: row.test_result,
    bestRank: row.best_rank,
    currentRank: row.current_rank,
    daysInTop40: row.days_in_top40 || 0,
    consecutiveDaysInTop40: row.consecutive_days_in_top40 || 0,
    contributionScore: parseFloat(row.contribution_score) || 0,
    candidateScore: parseFloat(row.candidate_score) || 0,
    approvalStatus: row.approval_status || 'approved',
    approvalReason: row.approval_reason,
    approvalAt: row.approval_at ? new Date(row.approval_at) : null,
    filterReason: row.filter_reason,
    categoryMatchRatio: row.category_match_ratio ? parseFloat(row.category_match_ratio) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// 메인 실행
runKeywordDiscovery()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('키워드 발굴 실패:', error);
    process.exit(1);
  });
