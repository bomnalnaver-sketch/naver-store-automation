/**
 * @file index.ts
 * @description Slack 상세 리포트 서비스
 * @responsibilities
 * - 일일 자동화 상세 리포트 생성
 * - 승인 대기 후보, 순위 변동, A/B 테스트, AI 의사결정 현황 보고
 */

import { db } from '@/db/client';
import { logger } from '@/utils/logger';

/** 상세 리포트 데이터 */
export interface DetailedReportData {
  // 기본 요약
  summary: {
    productsProcessed: number;
    rankingsCollected: number;
    keywordsClassified: number;
    optimizationReports: number;
    alertsGenerated: number;
    keywordsDiscovered: number;
    testsStarted: number;
    testsPassed: number;
    testsFailed: number;
    pendingApproval: number;
  };

  // 순위 변동
  rankingChanges: {
    improved: RankingChange[];
    declined: RankingChange[];
    newTop40: RankingChange[];
    droppedFromTop40: RankingChange[];
  };

  // 승인 대기 후보
  pendingCandidates: PendingCandidate[];

  // A/B 테스트 현황
  abTests: {
    active: ABTestStatus[];
    completedToday: ABTestStatus[];
  };

  // AI 의사결정
  aiDecisions: {
    pendingCount: number;
    executedToday: AIDecisionSummary[];
  };

  // 자동 실행 결과
  autoExecution: {
    mode: string;
    productNameChanges: number;
    bidAdjustments: number;
    keywordChanges: number;
  };

  // API 예산
  apiBudget: {
    total: { used: number; remaining: number; limit: number };
    ranking: { remaining: number };
    colorAnalysis: { remaining: number };
  };

  // Phase 실패
  failedPhases: { phase: number; name: string; error: string }[];
}

interface RankingChange {
  productName: string;
  keyword: string;
  previousRank: number | null;
  currentRank: number | null;
  change: number;
}

interface PendingCandidate {
  productName: string;
  keyword: string;
  source: string;
  score: number;
  searchVolume: number;
  competition: string;
}

interface ABTestStatus {
  productName: string;
  testType: string;
  variantA: string;
  variantB: string;
  status: string;
  winner?: string;
  daysRunning: number;
}

interface AIDecisionSummary {
  productName: string;
  actionType: string;
  recommendation: string;
  executed: boolean;
}

/**
 * 상세 리포트 데이터 수집
 */
export async function collectDetailedReportData(
  summary: DetailedReportData['summary'],
  apiBudget: DetailedReportData['apiBudget'],
  failedPhases: DetailedReportData['failedPhases'],
  autoExecutionResult?: any
): Promise<DetailedReportData> {
  const reportData: DetailedReportData = {
    summary,
    rankingChanges: { improved: [], declined: [], newTop40: [], droppedFromTop40: [] },
    pendingCandidates: [],
    abTests: { active: [], completedToday: [] },
    aiDecisions: { pendingCount: 0, executedToday: [] },
    autoExecution: {
      mode: 'manual_approval',
      productNameChanges: 0,
      bidAdjustments: 0,
      keywordChanges: 0,
    },
    apiBudget,
    failedPhases,
  };

  try {
    // 1. 순위 변동 수집
    await collectRankingChanges(reportData);

    // 2. 승인 대기 후보 수집
    await collectPendingCandidates(reportData);

    // 3. A/B 테스트 현황 수집
    await collectABTestStatus(reportData);

    // 4. AI 의사결정 현황 수집
    await collectAIDecisions(reportData);

    // 5. 자동 실행 결과 반영
    if (autoExecutionResult) {
      reportData.autoExecution = {
        mode: autoExecutionResult.mode || 'manual_approval',
        productNameChanges: autoExecutionResult.productNameChanges?.applied || 0,
        bidAdjustments: autoExecutionResult.bidAdjustments?.applied || 0,
        keywordChanges: autoExecutionResult.aiDecisions?.executed || 0,
      };
    }
  } catch (error: any) {
    logger.error('상세 리포트 데이터 수집 실패', { error: error.message });
  }

  return reportData;
}

/**
 * 순위 변동 수집 (오늘 vs 어제)
 */
async function collectRankingChanges(reportData: DetailedReportData): Promise<void> {
  try {
    const result = await db.query(`
      WITH today_ranks AS (
        SELECT
          krs.keyword_id,
          k.keyword,
          p.product_name,
          krs.rank as current_rank,
          krs.created_at::date as check_date
        FROM keyword_rank_snapshots krs
        JOIN keywords k ON k.id = krs.keyword_id
        JOIN products p ON p.id = k.product_id
        WHERE krs.created_at::date = CURRENT_DATE
      ),
      yesterday_ranks AS (
        SELECT
          krs.keyword_id,
          krs.rank as previous_rank
        FROM keyword_rank_snapshots krs
        WHERE krs.created_at::date = CURRENT_DATE - INTERVAL '1 day'
      )
      SELECT
        t.product_name,
        t.keyword,
        y.previous_rank,
        t.current_rank,
        COALESCE(y.previous_rank, 999) - COALESCE(t.current_rank, 999) as change
      FROM today_ranks t
      LEFT JOIN yesterday_ranks y ON y.keyword_id = t.keyword_id
      WHERE y.previous_rank IS DISTINCT FROM t.current_rank
      ORDER BY ABS(COALESCE(y.previous_rank, 999) - COALESCE(t.current_rank, 999)) DESC
      LIMIT 20
    `);

    for (const row of result.rows) {
      const change: RankingChange = {
        productName: truncate(row.product_name, 20),
        keyword: row.keyword,
        previousRank: row.previous_rank,
        currentRank: row.current_rank,
        change: row.change,
      };

      if (row.change > 0) {
        // 순위 상승 (숫자 감소)
        if (row.previous_rank > 40 && row.current_rank <= 40) {
          reportData.rankingChanges.newTop40.push(change);
        } else {
          reportData.rankingChanges.improved.push(change);
        }
      } else if (row.change < 0) {
        // 순위 하락 (숫자 증가)
        if (row.previous_rank <= 40 && row.current_rank > 40) {
          reportData.rankingChanges.droppedFromTop40.push(change);
        } else {
          reportData.rankingChanges.declined.push(change);
        }
      }
    }
  } catch (error: any) {
    logger.warn('순위 변동 수집 실패', { error: error.message });
  }
}

/**
 * 승인 대기 후보 수집
 */
async function collectPendingCandidates(reportData: DetailedReportData): Promise<void> {
  try {
    const result = await db.query(`
      SELECT
        p.product_name,
        kc.keyword,
        kc.source,
        kc.candidate_score as score,
        kc.monthly_search_volume as search_volume,
        kc.competition_index as competition
      FROM keyword_candidates kc
      JOIN products p ON p.id = kc.product_id
      WHERE kc.status = 'pending_approval'
      ORDER BY kc.candidate_score DESC
      LIMIT 10
    `);

    reportData.pendingCandidates = result.rows.map((row) => ({
      productName: truncate(row.product_name, 20),
      keyword: row.keyword,
      source: row.source,
      score: row.score || 0,
      searchVolume: row.search_volume || 0,
      competition: row.competition || 'UNKNOWN',
    }));
  } catch (error: any) {
    logger.warn('승인 대기 후보 수집 실패', { error: error.message });
  }
}

/**
 * A/B 테스트 현황 수집
 */
async function collectABTestStatus(reportData: DetailedReportData): Promise<void> {
  try {
    // 진행 중인 테스트
    const activeResult = await db.query(`
      SELECT
        p.product_name,
        abt.test_type,
        abt.variant_a,
        abt.variant_b,
        abt.status,
        abt.winner,
        EXTRACT(DAY FROM NOW() - abt.created_at)::int as days_running
      FROM ab_tests abt
      JOIN products p ON p.id = abt.product_id
      WHERE abt.status = 'running'
      ORDER BY abt.created_at DESC
      LIMIT 5
    `);

    reportData.abTests.active = activeResult.rows.map((row) => ({
      productName: truncate(row.product_name, 20),
      testType: row.test_type,
      variantA: truncate(row.variant_a, 15),
      variantB: truncate(row.variant_b, 15),
      status: row.status,
      winner: row.winner,
      daysRunning: row.days_running || 0,
    }));

    // 오늘 완료된 테스트
    const completedResult = await db.query(`
      SELECT
        p.product_name,
        abt.test_type,
        abt.variant_a,
        abt.variant_b,
        abt.status,
        abt.winner,
        EXTRACT(DAY FROM abt.ended_at - abt.created_at)::int as days_running
      FROM ab_tests abt
      JOIN products p ON p.id = abt.product_id
      WHERE abt.ended_at::date = CURRENT_DATE
      ORDER BY abt.ended_at DESC
      LIMIT 5
    `);

    reportData.abTests.completedToday = completedResult.rows.map((row) => ({
      productName: truncate(row.product_name, 20),
      testType: row.test_type,
      variantA: truncate(row.variant_a, 15),
      variantB: truncate(row.variant_b, 15),
      status: row.status,
      winner: row.winner,
      daysRunning: row.days_running || 0,
    }));
  } catch (error: any) {
    logger.warn('A/B 테스트 현황 수집 실패', { error: error.message });
  }
}

/**
 * AI 의사결정 현황 수집
 */
async function collectAIDecisions(reportData: DetailedReportData): Promise<void> {
  try {
    // 대기 중인 의사결정 수
    const pendingResult = await db.query(`
      SELECT COUNT(*) as count
      FROM ai_analysis_results
      WHERE status = 'pending'
    `);
    reportData.aiDecisions.pendingCount = parseInt(pendingResult.rows[0]?.count || '0', 10);

    // 오늘 실행된 의사결정
    const executedResult = await db.query(`
      SELECT
        p.product_name,
        aar.action_type,
        aar.recommendation,
        aar.status = 'executed' as executed
      FROM ai_analysis_results aar
      JOIN products p ON p.id = aar.product_id
      WHERE aar.updated_at::date = CURRENT_DATE
        AND aar.status IN ('executed', 'approved')
      ORDER BY aar.updated_at DESC
      LIMIT 10
    `);

    reportData.aiDecisions.executedToday = executedResult.rows.map((row) => ({
      productName: truncate(row.product_name, 20),
      actionType: row.action_type,
      recommendation: truncate(row.recommendation, 30),
      executed: row.executed,
    }));
  } catch (error: any) {
    logger.warn('AI 의사결정 현황 수집 실패', { error: error.message });
  }
}

/**
 * Slack 상세 리포트 메시지 생성
 */
export function buildDetailedSlackMessage(data: DetailedReportData): string {
  const statusEmoji = data.failedPhases.length === 0 ? '✅' : '⚠️';
  const lines: string[] = [];

  // 헤더
  lines.push(`${statusEmoji} *네이버 스토어 일일 자동화 리포트*`);
  lines.push(`📅 ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}`);
  lines.push('');

  // ─────────────────────────────────────
  // 1. 요약 섹션
  // ─────────────────────────────────────
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('📊 *처리 현황*');
  lines.push(`• 상품: ${data.summary.productsProcessed}개 | 순위수집: ${data.summary.rankingsCollected}개`);
  lines.push(`• 키워드 분류: ${data.summary.keywordsClassified}개 | 최적화 리포트: ${data.summary.optimizationReports}개`);
  lines.push('');

  // ─────────────────────────────────────
  // 2. 순위 변동 섹션
  // ─────────────────────────────────────
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('📈 *순위 변동 현황*');

  // 1페이지 신규 진입
  if (data.rankingChanges.newTop40.length > 0) {
    lines.push('');
    lines.push('🎉 *1페이지(40위) 신규 진입*');
    for (const item of data.rankingChanges.newTop40.slice(0, 3)) {
      lines.push(`  • [${item.keyword}] ${item.previousRank || '권외'}위 → ${item.currentRank}위 (+${item.change})`);
    }
  }

  // 1페이지 이탈
  if (data.rankingChanges.droppedFromTop40.length > 0) {
    lines.push('');
    lines.push('⚠️ *1페이지 이탈*');
    for (const item of data.rankingChanges.droppedFromTop40.slice(0, 3)) {
      lines.push(`  • [${item.keyword}] ${item.previousRank}위 → ${item.currentRank || '권외'}위 (${item.change})`);
    }
  }

  // 순위 상승 TOP 3
  if (data.rankingChanges.improved.length > 0) {
    lines.push('');
    lines.push('📈 *순위 상승 TOP 3*');
    for (const item of data.rankingChanges.improved.slice(0, 3)) {
      lines.push(`  • [${item.keyword}] ${item.previousRank}위 → ${item.currentRank}위 (+${item.change})`);
    }
  }

  // 순위 하락 TOP 3
  if (data.rankingChanges.declined.length > 0) {
    lines.push('');
    lines.push('📉 *순위 하락 TOP 3*');
    for (const item of data.rankingChanges.declined.slice(0, 3)) {
      lines.push(`  • [${item.keyword}] ${item.previousRank}위 → ${item.currentRank}위 (${item.change})`);
    }
  }

  if (
    data.rankingChanges.newTop40.length === 0 &&
    data.rankingChanges.droppedFromTop40.length === 0 &&
    data.rankingChanges.improved.length === 0 &&
    data.rankingChanges.declined.length === 0
  ) {
    lines.push('  • 변동 없음');
  }
  lines.push('');

  // ─────────────────────────────────────
  // 3. 키워드 후보 섹션
  // ─────────────────────────────────────
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('🔍 *키워드 후보 현황*');
  lines.push(`• 신규 발굴: ${data.summary.keywordsDiscovered}개`);
  lines.push(`• 테스트 시작: ${data.summary.testsStarted}개`);
  lines.push(`• 테스트 성공: ${data.summary.testsPassed}개 | 실패: ${data.summary.testsFailed}개`);
  lines.push(`• 승인 대기: ${data.summary.pendingApproval}개`);

  // 승인 대기 상세
  if (data.pendingCandidates.length > 0) {
    lines.push('');
    lines.push('📋 *승인 대기 후보 (상위 5개)*');
    for (const cand of data.pendingCandidates.slice(0, 5)) {
      const sourceIcon = cand.source === 'competitor' ? '🏪' : cand.source === 'search_ad' ? '🔎' : '📝';
      lines.push(`  ${sourceIcon} [${cand.keyword}] 점수:${cand.score} | 검색량:${cand.searchVolume.toLocaleString()} | 경쟁:${cand.competition}`);
    }
  }
  lines.push('');

  // ─────────────────────────────────────
  // 4. A/B 테스트 섹션
  // ─────────────────────────────────────
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('🧪 *A/B 테스트 현황*');

  if (data.abTests.completedToday.length > 0) {
    lines.push('');
    lines.push('✅ *오늘 완료된 테스트*');
    for (const test of data.abTests.completedToday) {
      const winnerIcon = test.winner === 'A' ? '🅰️' : test.winner === 'B' ? '🅱️' : '➖';
      lines.push(`  ${winnerIcon} [${test.productName}] ${test.testType} — 승자: ${test.winner || '없음'} (${test.daysRunning}일)`);
    }
  }

  if (data.abTests.active.length > 0) {
    lines.push('');
    lines.push('🔄 *진행 중인 테스트*');
    for (const test of data.abTests.active) {
      lines.push(`  • [${test.productName}] ${test.testType} — ${test.daysRunning}일째`);
    }
  }

  if (data.abTests.active.length === 0 && data.abTests.completedToday.length === 0) {
    lines.push('  • 진행 중인 테스트 없음');
  }
  lines.push('');

  // ─────────────────────────────────────
  // 5. AI 의사결정 섹션
  // ─────────────────────────────────────
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('🤖 *AI 의사결정 현황*');
  lines.push(`• 승인 대기: ${data.aiDecisions.pendingCount}건`);

  if (data.aiDecisions.executedToday.length > 0) {
    lines.push('');
    lines.push('✅ *오늘 실행된 결정*');
    for (const decision of data.aiDecisions.executedToday.slice(0, 5)) {
      const icon = decision.executed ? '✓' : '○';
      lines.push(`  ${icon} [${decision.productName}] ${decision.actionType}: ${decision.recommendation}`);
    }
  }
  lines.push('');

  // ─────────────────────────────────────
  // 6. 자동 실행 결과 섹션
  // ─────────────────────────────────────
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('⚡ *자동 실행 결과*');
  lines.push(`• 실행 모드: ${data.autoExecution.mode === 'auto' ? '🟢 자동' : '🟡 수동 승인'}`);
  lines.push(`• 상품명 변경: ${data.autoExecution.productNameChanges}건`);
  lines.push(`• 입찰가 조정: ${data.autoExecution.bidAdjustments}건`);
  lines.push(`• 키워드 변경: ${data.autoExecution.keywordChanges}건`);
  lines.push('');

  // ─────────────────────────────────────
  // 7. API 예산 섹션
  // ─────────────────────────────────────
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('💰 *API 예산 현황*');
  const usagePercent = Math.round((data.apiBudget.total.used / data.apiBudget.total.limit) * 100);
  const usageBar = getProgressBar(usagePercent);
  lines.push(`• 전체: ${usageBar} ${usagePercent}% (${data.apiBudget.total.remaining.toLocaleString()} 남음)`);
  lines.push(`• 순위추적: ${data.apiBudget.ranking.remaining.toLocaleString()} | 색깔분류: ${data.apiBudget.colorAnalysis.remaining.toLocaleString()}`);
  lines.push('');

  // ─────────────────────────────────────
  // 8. 실패 Phase (있는 경우)
  // ─────────────────────────────────────
  if (data.failedPhases.length > 0) {
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('❌ *실패한 Phase*');
    for (const phase of data.failedPhases) {
      lines.push(`• Phase ${phase.phase}: ${phase.name} — ${phase.error}`);
    }
    lines.push('');
  }

  // 푸터
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('_🤖 네이버 스마트스토어 AI 자동화 시스템_');

  return lines.join('\n');
}

/**
 * 진행률 바 생성
 */
function getProgressBar(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * 문자열 자르기
 */
function truncate(str: string, maxLength: number): string {
  if (!str) return '';
  return str.length > maxLength ? str.substring(0, maxLength - 2) + '..' : str;
}

/**
 * Slack 웹훅으로 메시지 발송
 */
export async function sendSlackDetailedReport(data: DetailedReportData): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.info('Slack 웹훅 URL 미설정, 알림 생략');
    return false;
  }

  const message = buildDetailedSlackMessage(data);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });

    if (!response.ok) {
      logger.error('Slack 발송 실패', { status: response.status });
      return false;
    }

    logger.info('Slack 상세 리포트 발송 완료');
    return true;
  } catch (error: any) {
    logger.error('Slack 알림 발송 실패', { error: error.message });
    return false;
  }
}
