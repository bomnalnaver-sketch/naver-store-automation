/**
 * @file index.ts
 * @description 자동 실행 서비스 - 승인된 변경사항 적용
 * @responsibilities
 * - A/B 테스트 승자 적용
 * - AI 결정 실행
 * - 키워드 후보 활성화
 * - 입찰가 조정 실행
 */

import { db } from '@/db/client';
import { logger } from '@/utils/logger';
import { commerceApi } from '@/services/naver-api/commerce-api';
import { searchAdApi } from '@/services/naver-api/search-ad-api';

/**
 * 자동 실행 결과
 */
export interface AutoExecutionResult {
  productNameChanges: {
    applied: number;
    failed: number;
    details: Array<{ productId: number; oldName: string; newName: string; success: boolean; error?: string }>;
  };
  aiDecisions: {
    executed: number;
    failed: number;
    details: Array<{ decisionId: number; actionType: string; success: boolean; error?: string }>;
  };
  bidAdjustments: {
    applied: number;
    failed: number;
    details: Array<{ keywordId: string; oldBid: number; newBid: number; success: boolean; error?: string }>;
  };
}

/**
 * 자동 실행 메인 함수
 * Phase 7에서 호출되어 승인된 모든 변경사항을 적용
 */
export async function runAutoExecution(): Promise<AutoExecutionResult> {
  logger.info('자동 실행 시작');

  const result: AutoExecutionResult = {
    productNameChanges: { applied: 0, failed: 0, details: [] },
    aiDecisions: { executed: 0, failed: 0, details: [] },
    bidAdjustments: { applied: 0, failed: 0, details: [] },
  };

  // 1. A/B 테스트 승자 적용
  await applyAbTestWinners(result);

  // 2. 대기 중인 AI 결정 실행
  await executePendingAiDecisions(result);

  // 3. 입찰가 조정 실행
  await applyBidAdjustments(result);

  // 4. 실행 이력 저장
  const mode = await getExecutionMode();
  await saveExecutionLog(mode, result);

  logger.info('자동 실행 완료', {
    productNameChanges: result.productNameChanges.applied,
    aiDecisions: result.aiDecisions.executed,
    bidAdjustments: result.bidAdjustments.applied,
  });

  return result;
}

/**
 * A/B 테스트 승자 적용
 * winner가 'b'인 완료된 테스트의 상품명 변경을 적용
 */
async function applyAbTestWinners(result: AutoExecutionResult): Promise<void> {
  try {
    // 승자가 'b'이고 아직 적용되지 않은 테스트 조회
    const testsQuery = await db.query(`
      SELECT
        t.id as test_id,
        t.product_id,
        p.naver_product_id,
        p.product_name as current_name,
        v.product_name as new_name
      FROM product_ab_tests t
      INNER JOIN products p ON p.id = t.product_id
      INNER JOIN product_variants v ON v.test_id = t.id AND v.variant_type = 'b'
      WHERE t.status = 'completed'
        AND t.winner = 'b'
        AND t.test_type = 'product_name'
        AND v.product_name IS NOT NULL
        AND v.product_name != p.product_name
      ORDER BY t.test_ended_at DESC
      LIMIT 10
    `);

    if (testsQuery.rows.length === 0) {
      logger.info('적용할 A/B 테스트 승자 없음');
      return;
    }

    for (const test of testsQuery.rows) {
      try {
        // 네이버 Commerce API로 상품명 변경
        await commerceApi.updateProduct(test.naver_product_id, {
          name: test.new_name,
        });

        // 로컬 DB 업데이트
        await db.query(
          `UPDATE products SET product_name = $1, updated_at = NOW() WHERE id = $2`,
          [test.new_name, test.product_id]
        );

        // 테스트 상태를 'applied'로 변경
        await db.query(
          `UPDATE product_ab_tests SET status = 'applied', updated_at = NOW() WHERE id = $1`,
          [test.test_id]
        );

        result.productNameChanges.applied++;
        result.productNameChanges.details.push({
          productId: test.product_id,
          oldName: test.current_name,
          newName: test.new_name,
          success: true,
        });

        logger.info('상품명 변경 적용 완료', {
          productId: test.product_id,
          oldName: test.current_name,
          newName: test.new_name,
        });
      } catch (error: any) {
        result.productNameChanges.failed++;
        result.productNameChanges.details.push({
          productId: test.product_id,
          oldName: test.current_name,
          newName: test.new_name,
          success: false,
          error: error.message,
        });

        logger.error('상품명 변경 적용 실패', {
          productId: test.product_id,
          error: error.message,
        });
      }
    }
  } catch (error: any) {
    logger.error('A/B 테스트 승자 적용 조회 실패', { error: error.message });
  }
}

/**
 * 대기 중인 AI 결정 실행
 */
async function executePendingAiDecisions(result: AutoExecutionResult): Promise<void> {
  try {
    // pending 상태인 AI 결정 조회
    const decisionsQuery = await db.query(`
      SELECT
        r.id as result_id,
        r.decision_id,
        r.action_type,
        r.action_data
      FROM ai_decision_results r
      WHERE r.status = 'pending'
      ORDER BY r.created_at ASC
      LIMIT 20
    `);

    if (decisionsQuery.rows.length === 0) {
      logger.info('실행할 대기 중인 AI 결정 없음');
      return;
    }

    for (const decision of decisionsQuery.rows) {
      try {
        const actionData = decision.action_data;
        let resultData: any = null;

        // 액션 타입별 실행
        switch (decision.action_type) {
          case 'add_keyword':
            resultData = await executeAddKeyword(actionData);
            break;

          case 'remove_keyword':
            resultData = await executeRemoveKeyword(actionData);
            break;

          case 'update_bid':
            resultData = await executeUpdateBid(actionData);
            break;

          case 'update_product':
            resultData = await executeUpdateProduct(actionData);
            break;

          default:
            logger.warn('알 수 없는 AI 액션 타입', { actionType: decision.action_type });
            resultData = { skipped: true, reason: 'unknown_action_type' };
        }

        // 결과 업데이트
        await db.query(
          `UPDATE ai_decision_results
           SET status = 'success', result_data = $1, executed_at = NOW()
           WHERE id = $2`,
          [JSON.stringify(resultData), decision.result_id]
        );

        result.aiDecisions.executed++;
        result.aiDecisions.details.push({
          decisionId: decision.decision_id,
          actionType: decision.action_type,
          success: true,
        });

        logger.info('AI 결정 실행 완료', {
          decisionId: decision.decision_id,
          actionType: decision.action_type,
        });
      } catch (error: any) {
        // 실패 시 상태 업데이트
        await db.query(
          `UPDATE ai_decision_results
           SET status = 'failed', error_message = $1, executed_at = NOW()
           WHERE id = $2`,
          [error.message, decision.result_id]
        );

        result.aiDecisions.failed++;
        result.aiDecisions.details.push({
          decisionId: decision.decision_id,
          actionType: decision.action_type,
          success: false,
          error: error.message,
        });

        logger.error('AI 결정 실행 실패', {
          decisionId: decision.decision_id,
          error: error.message,
        });
      }
    }
  } catch (error: any) {
    logger.error('AI 결정 조회 실패', { error: error.message });
  }
}

/**
 * 입찰가 조정 실행
 * ad_keywords 테이블에서 조정이 필요한 키워드 처리
 */
async function applyBidAdjustments(result: AutoExecutionResult): Promise<void> {
  try {
    // 입찰가 조정 예약된 키워드 조회 (settings에서 pending_bid_adjustments 키 확인)
    const settingsQuery = await db.query(
      `SELECT value FROM settings WHERE key = 'pending_bid_adjustments'`
    );

    if (settingsQuery.rows.length === 0 || !settingsQuery.rows[0].value) {
      logger.info('예약된 입찰가 조정 없음');
      return;
    }

    const pendingAdjustments = settingsQuery.rows[0].value;
    if (!Array.isArray(pendingAdjustments) || pendingAdjustments.length === 0) {
      return;
    }

    for (const adjustment of pendingAdjustments) {
      try {
        const { keywordId, naverKeywordId, oldBid, newBid } = adjustment;

        // 네이버 검색광고 API로 입찰가 변경
        await searchAdApi.updateKeyword(naverKeywordId, {
          bidAmt: newBid,
        });

        // 로컬 DB 업데이트
        await db.query(
          `UPDATE ad_keywords SET bid_amount = $1, updated_at = NOW() WHERE id = $2`,
          [newBid, keywordId]
        );

        result.bidAdjustments.applied++;
        result.bidAdjustments.details.push({
          keywordId: naverKeywordId,
          oldBid,
          newBid,
          success: true,
        });

        logger.info('입찰가 조정 완료', {
          keywordId: naverKeywordId,
          oldBid,
          newBid,
        });
      } catch (error: any) {
        result.bidAdjustments.failed++;
        result.bidAdjustments.details.push({
          keywordId: adjustment.naverKeywordId,
          oldBid: adjustment.oldBid,
          newBid: adjustment.newBid,
          success: false,
          error: error.message,
        });

        logger.error('입찰가 조정 실패', {
          keywordId: adjustment.naverKeywordId,
          error: error.message,
        });
      }
    }

    // 처리 완료된 조정 목록 삭제
    await db.query(`DELETE FROM settings WHERE key = 'pending_bid_adjustments'`);
  } catch (error: any) {
    logger.error('입찰가 조정 조회 실패', { error: error.message });
  }
}

// ============================================
// AI 액션 실행 함수들
// ============================================

/**
 * 키워드 추가 액션 실행
 */
async function executeAddKeyword(actionData: any): Promise<any> {
  const { productId, keyword, bidAmount = 70 } = actionData;

  // 로컬 DB에 키워드 추가
  const result = await db.query(
    `INSERT INTO ad_keywords (product_id, keyword, bid_amount, status, is_test)
     VALUES ($1, $2, $3, 'active', true)
     ON CONFLICT (product_id, keyword) DO NOTHING
     RETURNING id`,
    [productId, keyword, bidAmount]
  );

  return {
    action: 'add_keyword',
    productId,
    keyword,
    keywordId: result.rows[0]?.id || null,
    bidAmount,
  };
}

/**
 * 키워드 삭제 액션 실행
 */
async function executeRemoveKeyword(actionData: any): Promise<any> {
  const { keywordId, naverKeywordId } = actionData;

  // 네이버 API에서 삭제 (있는 경우)
  if (naverKeywordId) {
    try {
      await searchAdApi.deleteKeyword(naverKeywordId);
    } catch (error: any) {
      // 이미 삭제된 경우 무시
      if (!error.message.includes('not found')) {
        throw error;
      }
    }
  }

  // 로컬 DB에서 상태 변경
  await db.query(
    `UPDATE ad_keywords SET status = 'removed', updated_at = NOW() WHERE id = $1`,
    [keywordId]
  );

  return {
    action: 'remove_keyword',
    keywordId,
    naverKeywordId,
  };
}

/**
 * 입찰가 변경 액션 실행
 */
async function executeUpdateBid(actionData: any): Promise<any> {
  const { keywordId, naverKeywordId, newBid } = actionData;

  // 네이버 API로 입찰가 변경
  await searchAdApi.updateKeyword(naverKeywordId, {
    bidAmt: newBid,
  });

  // 로컬 DB 업데이트
  await db.query(
    `UPDATE ad_keywords SET bid_amount = $1, updated_at = NOW() WHERE id = $2`,
    [newBid, keywordId]
  );

  return {
    action: 'update_bid',
    keywordId,
    naverKeywordId,
    newBid,
  };
}

/**
 * 상품 업데이트 액션 실행
 */
async function executeUpdateProduct(actionData: any): Promise<any> {
  const { productId, naverProductId, updates } = actionData;

  // 네이버 Commerce API로 상품 업데이트
  await commerceApi.updateProduct(naverProductId, updates);

  // 로컬 DB 업데이트 (상품명이 포함된 경우)
  if (updates.name) {
    await db.query(
      `UPDATE products SET product_name = $1, updated_at = NOW() WHERE id = $2`,
      [updates.name, productId]
    );
  }

  return {
    action: 'update_product',
    productId,
    naverProductId,
    updates,
  };
}

/**
 * 자동 실행 활성화 여부 확인
 */
export async function isAutoExecutionEnabled(): Promise<boolean> {
  try {
    const result = await db.query(
      `SELECT value FROM settings WHERE key = 'auto_run_enabled'`
    );
    if (result.rows.length === 0) return false;

    const value = result.rows[0].value;
    return value === true || value === 'true';
  } catch (error) {
    return false;
  }
}

/**
 * 자동 실행 모드 조회
 * 'auto': 완전 자동 / 'manual_approval': 수동 승인 필요
 */
export async function getExecutionMode(): Promise<'auto' | 'manual_approval'> {
  try {
    const result = await db.query(
      `SELECT value FROM settings WHERE key = 'execution_mode'`
    );
    if (result.rows.length === 0) return 'manual_approval';

    const value = result.rows[0].value;
    // JSON 문자열인 경우 파싱
    const parsed = typeof value === 'string' ? value.replace(/"/g, '') : value;
    return parsed === 'auto' ? 'auto' : 'manual_approval';
  } catch (error) {
    return 'manual_approval';
  }
}

/**
 * 자동 실행 이력 저장
 */
export async function saveExecutionLog(
  mode: string,
  result: AutoExecutionResult
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO auto_execution_logs (
        execution_mode,
        product_name_applied, product_name_failed,
        ai_decisions_executed, ai_decisions_failed,
        bid_adjustments_applied, bid_adjustments_failed,
        details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        mode,
        result.productNameChanges.applied,
        result.productNameChanges.failed,
        result.aiDecisions.executed,
        result.aiDecisions.failed,
        result.bidAdjustments.applied,
        result.bidAdjustments.failed,
        JSON.stringify({
          productNameChanges: result.productNameChanges.details,
          aiDecisions: result.aiDecisions.details,
          bidAdjustments: result.bidAdjustments.details,
        }),
      ]
    );
  } catch (error: any) {
    // 테이블이 없는 경우 경고만 출력
    if (error.code === '42P01') {
      logger.warn('auto_execution_logs 테이블 없음 - 마이그레이션 필요');
    } else {
      logger.error('자동 실행 이력 저장 실패', { error: error.message });
    }
  }
}

/**
 * 최근 자동 실행 이력 조회
 */
export async function getRecentExecutionLogs(limit = 10): Promise<any[]> {
  try {
    const result = await db.query(
      `SELECT * FROM auto_execution_logs
       ORDER BY executed_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch (error) {
    return [];
  }
}
