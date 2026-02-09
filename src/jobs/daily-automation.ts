/**
 * @file daily-automation.ts
 * @description 일일 자동화 메인 작업 (키워드 발굴/선정/라이프사이클 + 분석 + 최적화)
 * @responsibilities
 * - 8 Phase 파이프라인 실행
 * - Phase 1: 순위 수집
 * - Phase 2: 키워드 라이프사이클 업데이트
 * - Phase 3: 키워드 발굴
 * - Phase 4: 키워드 선정
 * - Phase 5: 키워드 노출 분석 (색깔 분류 + 유형 분류)
 * - Phase 6: AI 전략 수립 (상품명 최적화 점수 + 개선 제안)
 * - Phase 7: 자동 실행 (승인된 변경사항 적용)
 * - Phase 8: 기록 및 알림 (DB 저장 + Slack)
 */

import { db } from '@/db/client';
import { logger } from '@/utils/logger';
import { shoppingApiBudget } from '@/shared/api-budget-tracker';
import { runDailyRankingJob } from '@/services/ranking-tracker';
import { runFullClassificationForProduct } from '@/services/keyword-classification';
import { analyzeProductName } from '@/services/product-name-optimizer';
import { discoverKeywords } from '@/services/keyword-discovery';
import { selectKeywords } from '@/services/keyword-selector';
import {
  runDailyLifecycleUpdate,
  handleTestTimeouts,
} from '@/services/keyword-lifecycle';
import { KeywordCandidate, RankResult } from '@/types/keyword.types';
import {
  runAutoExecution,
  isAutoExecutionEnabled,
  getExecutionMode,
  AutoExecutionResult,
} from '@/services/auto-executor';
import {
  collectDetailedReportData,
  sendSlackDetailedReport,
} from '@/services/slack-reporter';
import { batchUpdateShoppingIds } from '@/services/product-manager';

/** 일일 자동화에서 사용하는 상품 정보 (DB products 테이블 부분 타입) */
interface Product {
  id: number;
  naver_product_id: string;
  product_name: string;
  category_id: string;
  representative_keyword: string;
  representative_keyword_rank: number | null;
  is_active: boolean;
}

/** 각 Phase의 실행 결과 */
interface PhaseResult {
  phase: number;
  name: string;
  success: boolean;
  duration: number;
  details: Record<string, any>;
  error?: string;
}

/** 일일 자동화 전체 결과 */
interface DailyAutomationResult {
  startedAt: string;
  completedAt: string;
  totalDuration: number;
  phases: PhaseResult[];
  summary: {
    productsProcessed: number;
    keywordsClassified: number;
    rankingsCollected: number;
    optimizationReports: number;
    alertsGenerated: number;
    // 키워드 후보 관련
    keywordsDiscovered: number;
    keywordsSelected: number;
    testsStarted: number;
    testsPassed: number;
    testsFailed: number;
    pendingApproval: number;
  };
}

/**
 * 일일 자동화 메인 실행 함수
 * 8 Phase 파이프라인을 순차적으로 실행
 */
export async function runDailyAutomation(): Promise<DailyAutomationResult> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const phases: PhaseResult[] = [];

  const summary = {
    productsProcessed: 0,
    keywordsClassified: 0,
    rankingsCollected: 0,
    optimizationReports: 0,
    alertsGenerated: 0,
    keywordsDiscovered: 0,
    keywordsSelected: 0,
    testsStarted: 0,
    testsPassed: 0,
    testsFailed: 0,
    pendingApproval: 0,
  };

  logger.info('=== 일일 자동화 작업 시작 ===');

  // API 예산 상태 확인
  const budgetStatus = shoppingApiBudget.getStatus();
  logger.info('API 예산 상태', {
    total: budgetStatus.total,
    ranking: budgetStatus.ranking,
    colorAnalysis: budgetStatus.colorAnalysis,
  });

  // 활성 상품 목록 조회
  let products: Product[] = [];
  try {
    const result = await db.query(
      `SELECT id, naver_product_id, product_name, category_id,
              representative_keyword, representative_keyword_rank,
              COALESCE(excluded_from_test, false) = false as is_active
       FROM products
       WHERE COALESCE(excluded_from_test, false) = false
       ORDER BY id`
    );
    products = result.rows;
    logger.info(`활성 상품 ${products.length}개 조회 완료`);
  } catch (error: any) {
    logger.error('활성 상품 조회 실패', { error: error.message });
    return buildResult(startedAt, startTime, phases, summary);
  }

  // Phase 1: 순위 수집
  const phase1Result = await runPhase1RankingCollection(summary);
  phases.push(phase1Result);

  // Phase 2: 키워드 라이프사이클 업데이트
  phases.push(await runPhase2LifecycleUpdate(products, summary));

  // Phase 3: 키워드 발굴
  phases.push(await runPhase3Discovery(products, summary));

  // Phase 4: 키워드 선정
  phases.push(await runPhase4Selection(products, summary));

  // Phase 5: 키워드 노출 분석 (색깔 + 유형 분류)
  phases.push(await runPhase5KeywordClassification(products, summary));

  // Phase 6: AI 전략 수립 (상품명 최적화)
  phases.push(await runPhase6Optimization(products, summary));

  // Phase 7: 자동 실행 (변경사항 적용)
  phases.push(await runPhase7Execution(summary));

  // Phase 8: 기록 및 알림
  phases.push(await runPhase8Reporting(phases, summary));

  const result = buildResult(startedAt, startTime, phases, summary);

  logger.info('=== 일일 자동화 작업 완료 ===', {
    totalDuration: result.totalDuration,
    summary: result.summary,
    phaseResults: phases.map((p) => ({
      phase: p.phase,
      name: p.name,
      success: p.success,
      duration: p.duration,
    })),
  });

  return result;
}

/**
 * Phase 1: 순위 수집
 */
async function runPhase1RankingCollection(
  summary: DailyAutomationResult['summary']
): Promise<PhaseResult> {
  const startTime = Date.now();
  logger.info('[Phase 1] 순위 수집 시작');

  try {
    // 네이버 쇼핑 ID 미설정 상품 자동 업데이트
    const shoppingIdUpdate = await batchUpdateShoppingIds();
    if (shoppingIdUpdate.updated > 0) {
      logger.info('네이버 쇼핑 ID 자동 업데이트 완료', shoppingIdUpdate);
    }

    const rankingResult = await runDailyRankingJob();

    summary.rankingsCollected = rankingResult.collectResult.totalKeywords;
    summary.alertsGenerated += rankingResult.alerts.length;

    // 순위 결과는 Phase 2에서 DB에서 직접 조회
    // collectResult는 요약 정보만 포함

    return {
      phase: 1,
      name: '순위 수집',
      success: true,
      duration: Date.now() - startTime,
      details: {
        totalProducts: rankingResult.collectResult.totalProducts,
        totalKeywords: rankingResult.collectResult.totalKeywords,
        totalApiCalls: rankingResult.collectResult.totalApiCalls,
        executionTimeMs: rankingResult.collectResult.executionTimeMs,
        alertsGenerated: rankingResult.alerts.length,
        surgeDetected: rankingResult.surgeDetected,
      },
    };
  } catch (error: any) {
    logger.error('[Phase 1] 순위 수집 실패', { error: error.message });
    return {
      phase: 1,
      name: '순위 수집',
      success: false,
      duration: Date.now() - startTime,
      details: { rankResults: new Map() },
      error: error.message,
    };
  }
}

/**
 * Phase 2: 키워드 라이프사이클 업데이트
 */
async function runPhase2LifecycleUpdate(
  products: Product[],
  summary: DailyAutomationResult['summary']
): Promise<PhaseResult> {
  const startTime = Date.now();
  logger.info('[Phase 2] 키워드 라이프사이클 업데이트 시작');

  let totalTransitions = 0;
  let passed = 0;
  let failed = 0;

  try {
    // 오늘 날짜 기준 순위 결과 조회
    const rankResultsQuery = await db.query(
      `SELECT keyword, rank, product_id
       FROM keyword_ranking_daily
       WHERE checked_at::date = CURRENT_DATE`
    );

    // 순위 결과를 Map으로 변환
    const rankResults = new Map<string, RankResult>();
    for (const row of rankResultsQuery.rows) {
      rankResults.set(row.keyword.toLowerCase(), {
        keyword: row.keyword,
        productId: row.product_id,
        rank: row.rank,
        apiCalls: 0,
        checkedAt: new Date(),
      });
    }

    for (const product of products) {
      // 해당 상품의 후보 키워드 조회
      const candidatesResult = await db.query(
        `SELECT * FROM keyword_candidates
         WHERE product_id = $1 AND status IN ('testing', 'active', 'warning')`,
        [product.id]
      );

      if (candidatesResult.rows.length === 0) continue;

      const candidates: KeywordCandidate[] = candidatesResult.rows.map(rowToCandidate);

      // 라이프사이클 업데이트
      const updateResult = await runDailyLifecycleUpdate({
        productId: product.id,
        candidates,
        rankResults,
      });

      totalTransitions += updateResult.transitions.length;
      passed += updateResult.summary.newlyActivated;
      failed += updateResult.summary.newlyFailed;

      // 타임아웃 처리
      const timeoutResults = handleTestTimeouts(candidates);
      failed += timeoutResults.filter(r => r.success).length;

      // DB 업데이트
      for (const evaluation of updateResult.evaluations) {
        await updateCandidateInDb(evaluation.candidate);
      }
    }

    summary.testsPassed = passed;
    summary.testsFailed = failed;

    return {
      phase: 2,
      name: '키워드 라이프사이클 업데이트',
      success: true,
      duration: Date.now() - startTime,
      details: {
        totalTransitions,
        passed,
        failed,
      },
    };
  } catch (error: any) {
    logger.error('[Phase 2] 라이프사이클 업데이트 실패', { error: error.message });
    return {
      phase: 2,
      name: '키워드 라이프사이클 업데이트',
      success: false,
      duration: Date.now() - startTime,
      details: { totalTransitions, passed, failed },
      error: error.message,
    };
  }
}

/**
 * Phase 3: 키워드 발굴
 */
async function runPhase3Discovery(
  products: Product[],
  summary: DailyAutomationResult['summary']
): Promise<PhaseResult> {
  const startTime = Date.now();
  logger.info('[Phase 3] 키워드 발굴 시작');

  let totalDiscovered = 0;
  let totalPendingApproval = 0;

  try {
    for (const product of products) {
      if (!product.representative_keyword) continue;

      // 기존 키워드 목록 조회
      const existingResult = await db.query(
        `SELECT keyword FROM keyword_candidates WHERE product_id = $1`,
        [product.id]
      );
      const existingKeywords = existingResult.rows.map((r: any) => r.keyword);

      // 키워드 발굴
      const discoveryResult = await discoverKeywords({
        productId: product.id,
        productName: product.product_name,
        representativeKeyword: product.representative_keyword,
        existingKeywords,
        categoryId: product.category_id,
      });

      totalDiscovered += discoveryResult.totalDiscovered;

      // 발굴된 키워드 DB 저장
      for (const keyword of discoveryResult.discoveredKeywords) {
        await db.query(
          `INSERT INTO keyword_candidates
           (product_id, keyword, source, competition_index, monthly_search_volume, candidate_score, approval_status)
           VALUES ($1, $2, $3, $4, $5, $6, 'approved')
           ON CONFLICT (product_id, keyword) DO NOTHING`,
          [
            product.id,
            keyword.keyword,
            keyword.source,
            keyword.competitionIndex || null,
            keyword.monthlySearchVolume || 0,
            0, // 점수는 Phase 4에서 계산
          ]
        );
      }

      // 수동 승인 대기 키워드 저장
      if (discoveryResult.filterResult?.needsApproval) {
        for (const keyword of discoveryResult.filterResult.needsApproval) {
          await db.query(
            `INSERT INTO keyword_candidates
             (product_id, keyword, source, status, approval_status, filter_reason)
             VALUES ($1, $2, $3, 'pending_approval', 'pending', $4)
             ON CONFLICT (product_id, keyword) DO NOTHING`,
            [
              product.id,
              keyword.keyword,
              keyword.source,
              '카테고리 관련성 낮음',
            ]
          );
          totalPendingApproval++;
        }
      }
    }

    summary.keywordsDiscovered = totalDiscovered;
    summary.pendingApproval = totalPendingApproval;

    return {
      phase: 3,
      name: '키워드 발굴',
      success: true,
      duration: Date.now() - startTime,
      details: {
        totalDiscovered,
        pendingApproval: totalPendingApproval,
      },
    };
  } catch (error: any) {
    logger.error('[Phase 3] 키워드 발굴 실패', { error: error.message });
    return {
      phase: 3,
      name: '키워드 발굴',
      success: false,
      duration: Date.now() - startTime,
      details: { totalDiscovered, pendingApproval: totalPendingApproval },
      error: error.message,
    };
  }
}

/**
 * Phase 4: 키워드 선정
 */
async function runPhase4Selection(
  products: Product[],
  summary: DailyAutomationResult['summary']
): Promise<PhaseResult> {
  const startTime = Date.now();
  logger.info('[Phase 4] 키워드 선정 시작');

  let totalSelected = 0;
  let totalTestsStarted = 0;

  try {
    for (const product of products) {
      // 후보 키워드 조회 (승인된 것만)
      const candidatesResult = await db.query(
        `SELECT * FROM keyword_candidates
         WHERE product_id = $1 AND status = 'candidate' AND approval_status = 'approved'`,
        [product.id]
      );

      if (candidatesResult.rows.length === 0) continue;

      const candidates: KeywordCandidate[] = candidatesResult.rows.map(rowToCandidate);

      // 기존 테스트 중인 후보 조회
      const testingResult = await db.query(
        `SELECT * FROM keyword_candidates
         WHERE product_id = $1 AND status = 'testing'`,
        [product.id]
      );
      const existingCandidates: KeywordCandidate[] = testingResult.rows.map(rowToCandidate);

      // 키워드 선정
      const selectionResult = await selectKeywords({
        productId: product.id,
        representativeKeywordRank: product.representative_keyword_rank,
        discoveredKeywords: candidates.map(c => ({
          keyword: c.keyword,
          source: c.source,
          competitionIndex: c.competitionIndex || undefined,
          monthlySearchVolume: c.monthlySearchVolume,
        })),
        existingCandidates,
      });

      totalSelected += selectionResult.selectedCandidates.length;

      // 선정된 키워드 점수 업데이트 및 테스트 시작
      for (const { candidate, scoreDetails } of selectionResult.selectedCandidates) {
        await db.query(
          `UPDATE keyword_candidates
           SET candidate_score = $1, status = 'testing', test_started_at = NOW(), updated_at = NOW()
           WHERE product_id = $2 AND keyword = $3`,
          [scoreDetails.totalScore, product.id, candidate.keyword]
        );
        totalTestsStarted++;
      }
    }

    summary.keywordsSelected = totalSelected;
    summary.testsStarted = totalTestsStarted;

    return {
      phase: 4,
      name: '키워드 선정',
      success: true,
      duration: Date.now() - startTime,
      details: {
        totalSelected,
        testsStarted: totalTestsStarted,
      },
    };
  } catch (error: any) {
    logger.error('[Phase 4] 키워드 선정 실패', { error: error.message });
    return {
      phase: 4,
      name: '키워드 선정',
      success: false,
      duration: Date.now() - startTime,
      details: { totalSelected, testsStarted: totalTestsStarted },
      error: error.message,
    };
  }
}

/**
 * Phase 5: 키워드 노출 분석 — 색깔 + 유형 분류
 */
async function runPhase5KeywordClassification(
  products: Product[],
  summary: DailyAutomationResult['summary']
): Promise<PhaseResult> {
  const startTime = Date.now();
  logger.info('[Phase 5] 키워드 노출 분석 시작');

  let classified = 0;
  let errors = 0;

  try {
    for (const product of products) {
      try {
        // API 예산 확인
        if (!shoppingApiBudget.canMakeCall('color_analysis')) {
          logger.warn('[Phase 5] 색깔 분류 API 예산 소진, 중단');
          break;
        }

        await runFullClassificationForProduct(product.id);
        classified++;
        summary.productsProcessed++;
      } catch (error: any) {
        errors++;
        logger.error(`[Phase 5] 상품 ${product.id} 키워드 분류 실패`, {
          error: error.message,
        });
      }
    }

    summary.keywordsClassified = classified;

    return {
      phase: 5,
      name: '키워드 노출 분석',
      success: errors === 0,
      duration: Date.now() - startTime,
      details: {
        productsProcessed: summary.productsProcessed,
        keywordsClassified: classified,
        errors,
      },
    };
  } catch (error: any) {
    logger.error('[Phase 5] 키워드 분류 전체 실패', { error: error.message });
    return {
      phase: 5,
      name: '키워드 노출 분석',
      success: false,
      duration: Date.now() - startTime,
      details: { classified, errors },
      error: error.message,
    };
  }
}

/**
 * Phase 6: AI 전략 수립 — 상품명 최적화 점수 + 개선 제안
 */
async function runPhase6Optimization(
  products: Product[],
  summary: DailyAutomationResult['summary']
): Promise<PhaseResult> {
  const startTime = Date.now();
  logger.info('[Phase 6] AI 전략 수립 시작 — 상품명 최적화');

  let reports = 0;
  let errors = 0;

  try {
    for (const product of products) {
      try {
        await analyzeProductName(product.id, product.product_name);
        reports++;
      } catch (error: any) {
        errors++;
        logger.error(`[Phase 6] 상품 ${product.id} 최적화 분석 실패`, {
          error: error.message,
        });
      }
    }

    summary.optimizationReports = reports;

    return {
      phase: 6,
      name: 'AI 전략 수립 (상품명 최적화)',
      success: errors === 0,
      duration: Date.now() - startTime,
      details: { reports, errors },
    };
  } catch (error: any) {
    logger.error('[Phase 6] 상품명 최적화 전체 실패', { error: error.message });
    return {
      phase: 6,
      name: 'AI 전략 수립 (상품명 최적화)',
      success: false,
      duration: Date.now() - startTime,
      details: { reports, errors },
      error: error.message,
    };
  }
}

/**
 * Phase 7: 자동 실행 — 승인된 변경사항 적용
 * - A/B 테스트 승자 적용 (상품명 변경)
 * - AI 결정 실행 (키워드 추가/삭제/입찰가 조정)
 * - 예약된 입찰가 조정 적용
 */
async function runPhase7Execution(
  _summary: DailyAutomationResult['summary']
): Promise<PhaseResult> {
  const startTime = Date.now();
  logger.info('[Phase 7] 자동 실행 시작');

  try {
    // 자동 실행 활성화 여부 확인
    const isEnabled = await isAutoExecutionEnabled();
    const mode = await getExecutionMode();

    if (!isEnabled) {
      logger.info('[Phase 7] 자동 실행 비활성화 상태');
      return {
        phase: 7,
        name: '자동 실행',
        success: true,
        duration: Date.now() - startTime,
        details: {
          mode: 'disabled',
          message: '자동 실행 비활성화 상태',
        },
      };
    }

    if (mode === 'manual_approval') {
      logger.info('[Phase 7] 수동 승인 모드 — 승인된 항목만 실행');
    }

    // 자동 실행 수행
    const executionResult: AutoExecutionResult = await runAutoExecution();

    const totalApplied =
      executionResult.productNameChanges.applied +
      executionResult.aiDecisions.executed +
      executionResult.bidAdjustments.applied;

    const totalFailed =
      executionResult.productNameChanges.failed +
      executionResult.aiDecisions.failed +
      executionResult.bidAdjustments.failed;

    logger.info('[Phase 7] 자동 실행 완료', {
      productNameChanges: executionResult.productNameChanges.applied,
      aiDecisions: executionResult.aiDecisions.executed,
      bidAdjustments: executionResult.bidAdjustments.applied,
      totalFailed,
    });

    return {
      phase: 7,
      name: '자동 실행',
      success: totalFailed === 0,
      duration: Date.now() - startTime,
      details: {
        mode,
        productNameChanges: {
          applied: executionResult.productNameChanges.applied,
          failed: executionResult.productNameChanges.failed,
        },
        aiDecisions: {
          executed: executionResult.aiDecisions.executed,
          failed: executionResult.aiDecisions.failed,
        },
        bidAdjustments: {
          applied: executionResult.bidAdjustments.applied,
          failed: executionResult.bidAdjustments.failed,
        },
        totalApplied,
        totalFailed,
        // Phase 8 상세 리포트에 전달
        autoExecutionResult: executionResult,
      },
    };
  } catch (error: any) {
    logger.error('[Phase 7] 자동 실행 실패', { error: error.message });
    return {
      phase: 7,
      name: '자동 실행',
      success: false,
      duration: Date.now() - startTime,
      details: { mode: 'error' },
      error: error.message,
    };
  }
}

/**
 * Phase 8: 기록 및 알림 — DB 저장 + Slack
 */
async function runPhase8Reporting(
  phases: PhaseResult[],
  summary: DailyAutomationResult['summary']
): Promise<PhaseResult> {
  const startTime = Date.now();
  logger.info('[Phase 8] 기록 및 알림 시작');

  try {
    // 실행 이력 DB 저장
    const today = new Date().toISOString().split('T')[0];
    await db.query(
      `INSERT INTO settings (key, value)
       VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      [
        `daily_automation_${today}`,
        JSON.stringify({
          summary,
          phaseResults: phases.map((p) => ({
            phase: p.phase,
            name: p.name,
            success: p.success,
            duration: p.duration,
          })),
        }),
      ]
    );

    // API 예산 사용 현황 기록
    const budgetStatus = shoppingApiBudget.getStatus();
    logger.info('API 예산 사용 현황', {
      total: budgetStatus.total,
      ranking: budgetStatus.ranking,
      colorAnalysis: budgetStatus.colorAnalysis,
    });

    // Phase 7 결과에서 자동 실행 결과 추출
    const phase7 = phases.find((p) => p.phase === 7);
    const autoExecutionResult = phase7?.details?.autoExecutionResult;

    // 실패한 Phase 목록
    const failedPhases = phases
      .filter((p) => !p.success)
      .map((p) => ({ phase: p.phase, name: p.name, error: p.error || '알 수 없는 오류' }));

    // 상세 리포트 데이터 수집
    const reportData = await collectDetailedReportData(
      summary,
      {
        total: {
          used: budgetStatus.total.limit - budgetStatus.total.remaining,
          remaining: budgetStatus.total.remaining,
          limit: budgetStatus.total.limit,
        },
        ranking: { remaining: budgetStatus.ranking.remaining },
        colorAnalysis: { remaining: budgetStatus.colorAnalysis.remaining },
      },
      failedPhases,
      autoExecutionResult
    );

    // Slack 상세 리포트 발송
    const slackSent = await sendSlackDetailedReport(reportData);

    return {
      phase: 8,
      name: '기록 및 알림',
      success: true,
      duration: Date.now() - startTime,
      details: {
        dbSaved: true,
        slackSent,
        budgetRemaining: budgetStatus.total.remaining,
      },
    };
  } catch (error: any) {
    logger.error('[Phase 8] 기록/알림 실패', { error: error.message });
    return {
      phase: 8,
      name: '기록 및 알림',
      success: false,
      duration: Date.now() - startTime,
      details: {},
      error: error.message,
    };
  }
}

/**
 * 최종 결과 객체 생성
 */
function buildResult(
  startedAt: string,
  startTime: number,
  phases: PhaseResult[],
  summary: DailyAutomationResult['summary']
): DailyAutomationResult {
  return {
    startedAt,
    completedAt: new Date().toISOString(),
    totalDuration: Date.now() - startTime,
    phases,
    summary,
  };
}

/**
 * DB row를 KeywordCandidate 객체로 변환
 */
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

/**
 * KeywordCandidate DB 업데이트
 */
async function updateCandidateInDb(candidate: KeywordCandidate): Promise<void> {
  await db.query(
    `UPDATE keyword_candidates SET
      status = $1,
      current_rank = $2,
      best_rank = $3,
      days_in_top40 = $4,
      consecutive_days_in_top40 = $5,
      contribution_score = $6,
      test_ended_at = $7,
      test_result = $8,
      updated_at = NOW()
    WHERE id = $9`,
    [
      candidate.status,
      candidate.currentRank,
      candidate.bestRank,
      candidate.daysInTop40,
      candidate.consecutiveDaysInTop40,
      candidate.contributionScore,
      candidate.testEndedAt,
      candidate.testResult,
      candidate.id,
    ]
  );
}

// 메인 실행
runDailyAutomation()
  .then((result) => {
    console.log('일일 자동화 완료:', JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error('일일 자동화 실패:', error);
    process.exit(1);
  });
