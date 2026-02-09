/**
 * @file index.ts
 * @description 키워드 라이프사이클 모듈 통합 진입점
 * @responsibilities
 * - 상태 관리 통합
 * - 성과 평가 통합
 * - 기여도 분석 통합
 * - 일일 라이프사이클 업데이트 오케스트레이션
 */

import {
  KeywordCandidate,
  KeywordLifecycleMetrics,
  RankResult,
} from '@/types/keyword.types';
// 내부에서 사용하는 함수만 import
import {
  transitionToTesting,
  transitionToFailed,
  calculateTestDays,
  isTestTimedOut,
  groupByStatus,
  TransitionResult,
} from './state-manager';
import { evaluateBatch, summarizeTestProgress, EvaluationResult } from './performance-evaluator';
import { analyzeContributions, summarizeContributions, ContributionAnalysis } from './contribution-analyzer';
import { logger } from '@/utils/logger';
import { db } from '@/db/client';

// Re-export (사용하지 않는 함수도 외부에서 사용할 수 있도록)
export {
  transitionToTesting,
  transitionToActive,
  transitionToFailed,
  transitionToWarning,
  transitionToRecovered,
  transitionToRetired,
  calculateTestDays,
  isTestTimedOut,
  groupByStatus,
  isValidTransition,
} from './state-manager';
export type { TransitionResult, StateTransition } from './state-manager';

export {
  evaluatePerformance,
  evaluateBatch,
  isInTop40,
  summarizeTestProgress,
} from './performance-evaluator';
export type { EvaluationResult } from './performance-evaluator';

export {
  calculateContribution,
  analyzeContributions,
  getTopContributors,
  getBottomContributors,
  applyContributionScores,
  summarizeContributions,
} from './contribution-analyzer';
export type { ContributionAnalysis } from './contribution-analyzer';

/**
 * 일일 라이프사이클 업데이트 입력
 */
export interface DailyUpdateInput {
  productId: number;
  candidates: KeywordCandidate[];
  rankResults: Map<string, RankResult>;
}

/**
 * 일일 라이프사이클 업데이트 결과
 */
export interface DailyUpdateResult {
  productId: number;
  evaluations: EvaluationResult[];
  contributions: ContributionAnalysis[];
  transitions: TransitionResult[];
  summary: {
    totalCandidates: number;
    statusCounts: Record<string, number>;
    newlyActivated: number;
    newlyFailed: number;
    newlyWarning: number;
    recovered: number;
  };
}

/**
 * 일일 라이프사이클 업데이트 실행
 * 순위 결과 기반으로 모든 후보의 상태를 업데이트
 */
export async function runDailyLifecycleUpdate(
  input: DailyUpdateInput
): Promise<DailyUpdateResult> {
  const { productId, candidates, rankResults } = input;

  logger.info('일일 라이프사이클 업데이트 시작', {
    productId,
    totalCandidates: candidates.length,
    rankResults: rankResults.size,
  });

  // 1. 테스트/활성/경고 상태 후보 필터
  const targetCandidates = candidates.filter(
    (c) =>
      c.status === 'testing' ||
      c.status === 'active' ||
      c.status === 'warning'
  );

  // 2. 성과 평가
  const evaluations = evaluateBatch(targetCandidates, rankResults);

  // 3. 상태 전이 수집
  const transitions = evaluations
    .filter((e) => e.stateTransition)
    .map((e) => e.stateTransition!);

  // 4. 기여도 분석 (활성 상태만)
  const activeCandidates = evaluations
    .filter(
      (e) =>
        e.candidate.status === 'active' || e.candidate.status === 'warning'
    )
    .map((e) => e.candidate);

  const contributions = analyzeContributions(activeCandidates);

  // 5. 요약 생성
  const groups = groupByStatus(candidates);
  const summary = {
    totalCandidates: candidates.length,
    statusCounts: {
      candidate: groups.candidate.length,
      testing: groups.testing.length,
      active: groups.active.length,
      warning: groups.warning.length,
      failed: groups.failed.length,
      retired: groups.retired.length,
    },
    newlyActivated: transitions.filter(
      (t) => t.success && t.transition?.toStatus === 'active'
    ).length,
    newlyFailed: transitions.filter(
      (t) => t.success && t.transition?.toStatus === 'failed'
    ).length,
    newlyWarning: transitions.filter(
      (t) => t.success && t.transition?.toStatus === 'warning'
    ).length,
    recovered: transitions.filter(
      (t) =>
        t.success &&
        t.transition?.fromStatus === 'warning' &&
        t.transition?.toStatus === 'active'
    ).length,
  };

  logger.info('일일 라이프사이클 업데이트 완료', {
    productId,
    ...summary,
  });

  return {
    productId,
    evaluations,
    contributions,
    transitions,
    summary,
  };
}

/**
 * 테스트 시작 (여러 후보 일괄)
 */
export function startTests(
  candidates: KeywordCandidate[],
  maxConcurrent: number
): TransitionResult[] {
  // candidate 상태인 것만 필터
  const eligibleCandidates = candidates
    .filter((c) => c.status === 'candidate')
    .sort((a, b) => b.candidateScore - a.candidateScore) // 점수 높은 순
    .slice(0, maxConcurrent);

  const results = eligibleCandidates.map((candidate) =>
    transitionToTesting(candidate)
  );

  logger.info('테스트 일괄 시작', {
    eligible: eligibleCandidates.length,
    started: results.filter((r) => r.success).length,
  });

  return results;
}

/**
 * 타임아웃된 테스트 처리
 */
export function handleTestTimeouts(
  candidates: KeywordCandidate[]
): TransitionResult[] {
  const timedOutCandidates = candidates.filter(
    (c) => c.status === 'testing' && isTestTimedOut(c)
  );

  const results = timedOutCandidates.map((candidate) => {
    const metrics: KeywordLifecycleMetrics = {
      testDays: calculateTestDays(candidate),
      daysInTop40: candidate.daysInTop40,
      consecutiveDaysInTop40: candidate.consecutiveDaysInTop40,
    };

    return transitionToFailed(
      candidate,
      metrics,
      `테스트 타임아웃 (${metrics.testDays}일 경과)`
    );
  });

  if (results.length > 0) {
    logger.info('테스트 타임아웃 처리', {
      count: results.length,
    });
  }

  return results;
}

/**
 * 라이프사이클 상태 요약 생성
 */
export function generateLifecycleSummary(candidates: KeywordCandidate[]): {
  statusDistribution: Record<string, number>;
  testProgress: ReturnType<typeof summarizeTestProgress>;
  contributionSummary: ReturnType<typeof summarizeContributions>;
} {
  const groups = groupByStatus(candidates);

  // 테스트 진행 요약
  const testProgress = summarizeTestProgress(candidates);

  // 기여도 분석 (활성 상태만)
  const activeCandidates = [...groups.active, ...groups.warning];
  const contributions = analyzeContributions(activeCandidates);
  const contributionSummary = summarizeContributions(contributions);

  return {
    statusDistribution: {
      candidate: groups.candidate.length,
      testing: groups.testing.length,
      active: groups.active.length,
      warning: groups.warning.length,
      failed: groups.failed.length,
      retired: groups.retired.length,
    },
    testProgress,
    contributionSummary,
  };
}

/**
 * 대표 키워드 자동 갱신 결과
 */
export interface RepresentativeKeywordUpdateResult {
  productId: number;
  updated: boolean;
  previousKeyword: string | null;
  newKeyword: string | null;
  reason: string;
}

/**
 * 기여도 점수 기반 대표 키워드 자동 갱신
 * - 활성 상태 키워드 중 기여도 점수가 가장 높은 키워드로 갱신
 * - 현재 대표 키워드보다 20% 이상 높은 점수일 때만 변경
 */
export async function updateRepresentativeKeyword(
  productId: number
): Promise<RepresentativeKeywordUpdateResult> {
  try {
    // 1. 현재 상품 정보 조회
    const productResult = await db.query(
      `SELECT representative_keyword FROM products WHERE id = $1`,
      [productId]
    );

    if (productResult.rows.length === 0) {
      return {
        productId,
        updated: false,
        previousKeyword: null,
        newKeyword: null,
        reason: '상품을 찾을 수 없음',
      };
    }

    const currentKeyword = productResult.rows[0].representative_keyword;

    // 2. 활성 상태 키워드 중 기여도 점수가 가장 높은 키워드 조회
    const candidatesResult = await db.query(
      `SELECT keyword, contribution_score, best_rank, days_in_top40
       FROM keyword_candidates
       WHERE product_id = $1
         AND status IN ('active', 'testing')
         AND contribution_score > 0
       ORDER BY contribution_score DESC, best_rank ASC NULLS LAST
       LIMIT 1`,
      [productId]
    );

    if (candidatesResult.rows.length === 0) {
      return {
        productId,
        updated: false,
        previousKeyword: currentKeyword,
        newKeyword: null,
        reason: '활성 키워드 없음',
      };
    }

    const bestCandidate = candidatesResult.rows[0];
    const bestKeyword = bestCandidate.keyword;

    // 3. 현재 대표 키워드와 동일하면 갱신 불필요
    if (currentKeyword === bestKeyword) {
      return {
        productId,
        updated: false,
        previousKeyword: currentKeyword,
        newKeyword: bestKeyword,
        reason: '이미 최적 키워드',
      };
    }

    // 4. 현재 대표 키워드의 기여도 점수 확인
    const currentScoreResult = await db.query(
      `SELECT contribution_score FROM keyword_candidates
       WHERE product_id = $1 AND keyword = $2`,
      [productId, currentKeyword]
    );

    const currentScore = currentScoreResult.rows[0]?.contribution_score || 0;
    const bestScore = bestCandidate.contribution_score;

    // 5. 20% 이상 높은 점수일 때만 변경 (안정성 확보)
    const THRESHOLD_RATIO = 1.2;
    if (currentScore > 0 && bestScore < currentScore * THRESHOLD_RATIO) {
      return {
        productId,
        updated: false,
        previousKeyword: currentKeyword,
        newKeyword: bestKeyword,
        reason: `점수 차이 부족 (현재: ${currentScore.toFixed(1)}, 후보: ${bestScore.toFixed(1)})`,
      };
    }

    // 6. 대표 키워드 갱신
    await db.query(
      `UPDATE products
       SET representative_keyword = $1,
           representative_keyword_rank = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [bestKeyword, bestCandidate.best_rank, productId]
    );

    logger.info('대표 키워드 자동 갱신', {
      productId,
      previousKeyword: currentKeyword,
      newKeyword: bestKeyword,
      previousScore: currentScore,
      newScore: bestScore,
    });

    return {
      productId,
      updated: true,
      previousKeyword: currentKeyword,
      newKeyword: bestKeyword,
      reason: `기여도 점수 우수 (${bestScore.toFixed(1)}점, 순위 ${bestCandidate.best_rank || 'N/A'}위)`,
    };
  } catch (error: any) {
    logger.error('대표 키워드 갱신 실패', { productId, error: error.message });
    return {
      productId,
      updated: false,
      previousKeyword: null,
      newKeyword: null,
      reason: `오류: ${error.message}`,
    };
  }
}

/**
 * 모든 상품의 대표 키워드 일괄 갱신
 */
export async function batchUpdateRepresentativeKeywords(): Promise<{
  total: number;
  updated: number;
  results: RepresentativeKeywordUpdateResult[];
}> {
  const results: RepresentativeKeywordUpdateResult[] = [];

  try {
    // 활성 상품 목록 조회
    const productsResult = await db.query(
      `SELECT id FROM products WHERE COALESCE(excluded_from_test, false) = false`
    );

    for (const product of productsResult.rows) {
      const result = await updateRepresentativeKeyword(product.id);
      results.push(result);
    }

    const updated = results.filter((r) => r.updated).length;

    logger.info('대표 키워드 일괄 갱신 완료', {
      total: results.length,
      updated,
    });

    return {
      total: results.length,
      updated,
      results,
    };
  } catch (error: any) {
    logger.error('대표 키워드 일괄 갱신 실패', { error: error.message });
    return {
      total: 0,
      updated: 0,
      results,
    };
  }
}
