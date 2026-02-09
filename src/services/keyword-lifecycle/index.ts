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
import {
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
  TransitionResult,
  StateTransition,
} from './state-manager';
import {
  evaluatePerformance,
  evaluateBatch,
  isInTop40,
  summarizeTestProgress,
  EvaluationResult,
} from './performance-evaluator';
import {
  calculateContribution,
  analyzeContributions,
  getTopContributors,
  getBottomContributors,
  applyContributionScores,
  summarizeContributions,
  ContributionAnalysis,
} from './contribution-analyzer';
import { logger } from '@/utils/logger';

// Re-export
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
