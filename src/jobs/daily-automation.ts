/**
 * @file daily-automation.ts
 * @description 일일 자동화 메인 작업 (키워드 분석 + 순위 추적 + 상품명 최적화)
 * @responsibilities
 * - 5 Phase 파이프라인 실행
 * - Phase 1: 데이터 수집 (순위 추적 + 쇼핑 검색)
 * - Phase 2: 키워드 노출 분석 (색깔 분류 + 유형 분류)
 * - Phase 3: AI 전략 수립 (상품명 최적화 점수 + 개선 제안)
 * - Phase 4: 자동 실행 (승인된 변경사항 적용)
 * - Phase 5: 기록 및 알림 (DB 저장 + Slack)
 */

import { db } from '@/db/client';
import { logger } from '@/utils/logger';
import { shoppingApiBudget } from '@/shared/api-budget-tracker';
import { runDailyRankingJob } from '@/services/ranking-tracker';
import { runFullClassificationForProduct } from '@/services/keyword-classification';
import { analyzeProductName } from '@/services/product-name-optimizer';

/** 일일 자동화에서 사용하는 상품 정보 (DB products 테이블 부분 타입) */
interface Product {
  id: number;
  product_name: string;
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
  };
}

/**
 * 일일 자동화 메인 실행 함수
 * 5 Phase 파이프라인을 순차적으로 실행
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
      `SELECT * FROM products WHERE is_active = true ORDER BY id`
    );
    products = result.rows;
    logger.info(`활성 상품 ${products.length}개 조회 완료`);
  } catch (error: any) {
    logger.error('활성 상품 조회 실패', { error: error.message });
    return buildResult(startedAt, startTime, phases, summary);
  }

  // Phase 1: 데이터 수집 (순위 추적)
  phases.push(await runPhase1RankingCollection(summary));

  // Phase 2: 키워드 노출 분석 (색깔 + 유형 분류)
  phases.push(await runPhase2KeywordClassification(products, summary));

  // Phase 3: AI 전략 수립 (상품명 최적화)
  phases.push(await runPhase3Optimization(products, summary));

  // Phase 4: 자동 실행 (변경사항 적용)
  phases.push(await runPhase4Execution(summary));

  // Phase 5: 기록 및 알림
  phases.push(await runPhase5Reporting(phases, summary));

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
 * Phase 1: 데이터 수집 — 순위 추적
 */
async function runPhase1RankingCollection(
  summary: DailyAutomationResult['summary']
): Promise<PhaseResult> {
  const startTime = Date.now();
  logger.info('[Phase 1] 데이터 수집 시작 — 순위 추적');

  try {
    const rankingResult = await runDailyRankingJob();

    summary.rankingsCollected = rankingResult.collectResult.totalKeywords;
    summary.alertsGenerated += rankingResult.alerts.length;

    return {
      phase: 1,
      name: '데이터 수집 (순위 추적)',
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
    logger.error('[Phase 1] 순위 추적 실패', { error: error.message });
    return {
      phase: 1,
      name: '데이터 수집 (순위 추적)',
      success: false,
      duration: Date.now() - startTime,
      details: {},
      error: error.message,
    };
  }
}

/**
 * Phase 2: 키워드 노출 분석 — 색깔 + 유형 분류
 */
async function runPhase2KeywordClassification(
  products: Product[],
  summary: DailyAutomationResult['summary']
): Promise<PhaseResult> {
  const startTime = Date.now();
  logger.info('[Phase 2] 키워드 노출 분석 시작');

  let classified = 0;
  let errors = 0;

  try {
    for (const product of products) {
      try {
        // API 예산 확인
        if (!shoppingApiBudget.canMakeCall('color_analysis')) {
          logger.warn('[Phase 2] 색깔 분류 API 예산 소진, 중단');
          break;
        }

        await runFullClassificationForProduct(product.id);
        classified++;
        summary.productsProcessed++;
      } catch (error: any) {
        errors++;
        logger.error(`[Phase 2] 상품 ${product.id} 키워드 분류 실패`, {
          error: error.message,
        });
      }
    }

    summary.keywordsClassified = classified;

    return {
      phase: 2,
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
    logger.error('[Phase 2] 키워드 분류 전체 실패', { error: error.message });
    return {
      phase: 2,
      name: '키워드 노출 분석',
      success: false,
      duration: Date.now() - startTime,
      details: { classified, errors },
      error: error.message,
    };
  }
}

/**
 * Phase 3: AI 전략 수립 — 상품명 최적화 점수 + 개선 제안
 */
async function runPhase3Optimization(
  products: Product[],
  summary: DailyAutomationResult['summary']
): Promise<PhaseResult> {
  const startTime = Date.now();
  logger.info('[Phase 3] AI 전략 수립 시작 — 상품명 최적화');

  let reports = 0;
  let errors = 0;

  try {
    for (const product of products) {
      try {
        await analyzeProductName(product.id, product.product_name);
        reports++;
      } catch (error: any) {
        errors++;
        logger.error(`[Phase 3] 상품 ${product.id} 최적화 분석 실패`, {
          error: error.message,
        });
      }
    }

    summary.optimizationReports = reports;

    return {
      phase: 3,
      name: 'AI 전략 수립 (상품명 최적화)',
      success: errors === 0,
      duration: Date.now() - startTime,
      details: { reports, errors },
    };
  } catch (error: any) {
    logger.error('[Phase 3] 상품명 최적화 전체 실패', { error: error.message });
    return {
      phase: 3,
      name: 'AI 전략 수립 (상품명 최적화)',
      success: false,
      duration: Date.now() - startTime,
      details: { reports, errors },
      error: error.message,
    };
  }
}

/**
 * Phase 4: 자동 실행 — 승인된 변경사항 적용
 * (현재는 수동 승인 방식으로, 자동 적용은 미래 구현)
 */
async function runPhase4Execution(
  _summary: DailyAutomationResult['summary']
): Promise<PhaseResult> {
  const startTime = Date.now();
  logger.info('[Phase 4] 자동 실행 — 현재 수동 승인 모드');

  // TODO: 자동 실행 로직 구현
  // - 승인된 상품명 변경 적용
  // - 광고 키워드 입찰가 조정
  // - A/B 테스트 결과 적용

  return {
    phase: 4,
    name: '자동 실행',
    success: true,
    duration: Date.now() - startTime,
    details: {
      mode: 'manual_approval',
      message: '현재 수동 승인 모드 — 자동 실행 미적용',
    },
  };
}

/**
 * Phase 5: 기록 및 알림 — DB 저장 + Slack
 */
async function runPhase5Reporting(
  phases: PhaseResult[],
  summary: DailyAutomationResult['summary']
): Promise<PhaseResult> {
  const startTime = Date.now();
  logger.info('[Phase 5] 기록 및 알림 시작');

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

    // Slack 알림 (웹훅 URL이 설정되어 있을 때만)
    const slackSent = await sendSlackReport(phases, summary, budgetStatus);

    return {
      phase: 5,
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
    logger.error('[Phase 5] 기록/알림 실패', { error: error.message });
    return {
      phase: 5,
      name: '기록 및 알림',
      success: false,
      duration: Date.now() - startTime,
      details: {},
      error: error.message,
    };
  }
}

/**
 * Slack 일일 리포트 발송
 */
async function sendSlackReport(
  phases: PhaseResult[],
  summary: DailyAutomationResult['summary'],
  budgetStatus: any
): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.info('Slack 웹훅 URL 미설정, 알림 생략');
    return false;
  }

  const failedPhases = phases.filter((p) => !p.success);
  const statusEmoji = failedPhases.length === 0 ? '✅' : '⚠️';

  const text = [
    `${statusEmoji} *일일 자동화 리포트*`,
    '',
    `*처리 현황*`,
    `• 상품 처리: ${summary.productsProcessed}개`,
    `• 키워드 분류: ${summary.keywordsClassified}개`,
    `• 순위 수집: ${summary.rankingsCollected}개`,
    `• 최적화 리포트: ${summary.optimizationReports}개`,
    `• 알림 생성: ${summary.alertsGenerated}개`,
    '',
    `*API 예산 잔여*`,
    `• 전체: ${budgetStatus.total.remaining.toLocaleString()} / ${budgetStatus.total.limit.toLocaleString()}`,
    `• 순위추적: ${budgetStatus.ranking.remaining.toLocaleString()}`,
    `• 색깔분류: ${budgetStatus.colorAnalysis.remaining.toLocaleString()}`,
    '',
    failedPhases.length > 0
      ? `*⚠️ 실패 Phase*\n${failedPhases.map((p) => `• Phase ${p.phase}: ${p.name} — ${p.error}`).join('\n')}`
      : '*모든 Phase 정상 완료*',
  ].join('\n');

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return true;
  } catch (error: any) {
    logger.error('Slack 알림 발송 실패', { error: error.message });
    return false;
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
