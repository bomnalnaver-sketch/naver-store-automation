/**
 * @file performance-evaluator.ts
 * @description 키워드 성과 평가
 * @responsibilities
 * - 테스트 성공/실패 판정
 * - 1페이지 진입 일수 추적
 * - 연속 진입 일수 추적
 * - 최고 순위 갱신
 */

import {
  KeywordCandidate,
  KeywordLifecycleMetrics,
  RankResult,
} from '@/types/keyword.types';
import { KEYWORD_CANDIDATE_CONFIG } from '@/config/app-config';
import {
  calculateTestDays,
  isTestTimedOut,
  TransitionResult,
  transitionToActive,
  transitionToFailed,
  transitionToWarning,
  transitionToRecovered,
} from './state-manager';
import { logger } from '@/utils/logger';

const { TEST, TOP_PAGE, WARNING } = KEYWORD_CANDIDATE_CONFIG;

/**
 * 성과 평가 결과
 */
export interface EvaluationResult {
  candidate: KeywordCandidate;
  evaluation: {
    isInTop40: boolean;
    currentRank: number | null;
    daysInTop40Updated: number;
    consecutiveDaysUpdated: number;
    bestRankUpdated: number | null;
  };
  stateTransition?: TransitionResult;
}

/**
 * 1페이지(40위) 내인지 확인
 */
export function isInTop40(rank: number | null): boolean {
  if (rank === null) return false;
  return rank <= TOP_PAGE.RANK_LIMIT;
}

/**
 * 순위 결과로 후보 성과 업데이트
 * @param candidate 키워드 후보
 * @param rankResult 순위 조회 결과
 * @returns 평가 결과
 */
export function evaluatePerformance(
  candidate: KeywordCandidate,
  rankResult: RankResult
): EvaluationResult {
  const currentRank = rankResult.rank;
  const inTop40 = isInTop40(currentRank);

  // 성과 지표 업데이트
  let daysInTop40Updated = candidate.daysInTop40;
  let consecutiveDaysUpdated = candidate.consecutiveDaysInTop40;
  let bestRankUpdated = candidate.bestRank;

  if (inTop40) {
    daysInTop40Updated++;
    consecutiveDaysUpdated++;

    // 최고 순위 갱신
    if (bestRankUpdated === null || currentRank! < bestRankUpdated) {
      bestRankUpdated = currentRank;
    }
  } else {
    // 1페이지 이탈 시 연속 일수 초기화
    consecutiveDaysUpdated = 0;
  }

  // 후보 업데이트
  const updatedCandidate: KeywordCandidate = {
    ...candidate,
    currentRank,
    daysInTop40: daysInTop40Updated,
    consecutiveDaysInTop40: consecutiveDaysUpdated,
    bestRank: bestRankUpdated,
    updatedAt: new Date(),
  };

  const evaluation = {
    isInTop40: inTop40,
    currentRank,
    daysInTop40Updated,
    consecutiveDaysUpdated,
    bestRankUpdated,
  };

  // 상태 전이 확인
  const stateTransition = checkStateTransition(updatedCandidate, evaluation);

  return {
    candidate: stateTransition?.candidate || updatedCandidate,
    evaluation,
    stateTransition,
  };
}

/**
 * 상태 전이 필요 여부 확인 및 처리
 */
function checkStateTransition(
  candidate: KeywordCandidate,
  evaluation: EvaluationResult['evaluation']
): TransitionResult | undefined {
  const metrics: KeywordLifecycleMetrics = {
    rank: evaluation.currentRank,
    daysInTop40: evaluation.daysInTop40Updated,
    consecutiveDaysInTop40: evaluation.consecutiveDaysUpdated,
    testDays: calculateTestDays(candidate),
  };

  switch (candidate.status) {
    case 'testing':
      return evaluateTestingCandidate(candidate, evaluation, metrics);

    case 'active':
      return evaluateActiveCandidate(candidate, evaluation, metrics);

    case 'warning':
      return evaluateWarningCandidate(candidate, evaluation, metrics);

    default:
      return undefined;
  }
}

/**
 * 테스트 중인 후보 평가
 */
function evaluateTestingCandidate(
  candidate: KeywordCandidate,
  evaluation: EvaluationResult['evaluation'],
  metrics: KeywordLifecycleMetrics
): TransitionResult | undefined {
  // 테스트 성공 조건: 연속 3일 이상 1페이지 진입
  if (evaluation.consecutiveDaysUpdated >= TEST.SUCCESS_CONSECUTIVE_DAYS) {
    return transitionToActive(
      candidate,
      metrics,
      `1페이지 ${evaluation.consecutiveDaysUpdated}일 연속 진입`
    );
  }

  // 테스트 타임아웃 확인
  if (isTestTimedOut(candidate)) {
    return transitionToFailed(
      candidate,
      metrics,
      `테스트 기간 ${TEST.TIMEOUT_DAYS}일 초과 (타임아웃)`
    );
  }

  // 계속 테스트 중
  return undefined;
}

/**
 * 활성 후보 평가
 */
function evaluateActiveCandidate(
  candidate: KeywordCandidate,
  evaluation: EvaluationResult['evaluation'],
  metrics: KeywordLifecycleMetrics
): TransitionResult | undefined {
  // 1페이지 이탈 확인
  if (!evaluation.isInTop40) {
    // 바로 경고가 아니라, 연속 이탈 일수 확인 필요
    // 여기서는 단순히 이탈 시 경고로 전환
    // 실제로는 연속 이탈 일수를 추적해야 함
    return transitionToWarning(
      candidate,
      metrics,
      `1페이지 이탈 (현재 순위: ${evaluation.currentRank || '순위권 밖'})`
    );
  }

  return undefined;
}

/**
 * 경고 상태 후보 평가
 */
function evaluateWarningCandidate(
  candidate: KeywordCandidate,
  evaluation: EvaluationResult['evaluation'],
  metrics: KeywordLifecycleMetrics
): TransitionResult | undefined {
  // 1페이지 재진입 시 회복
  if (evaluation.isInTop40) {
    return transitionToRecovered(
      candidate,
      metrics,
      `1페이지 재진입 (순위: ${evaluation.currentRank})`
    );
  }

  // TODO: 경고 상태 지속 일수 추적 및 퇴역 처리
  // 현재는 단순화하여 처리

  return undefined;
}

/**
 * 일괄 성과 평가
 * @param candidates 후보 목록
 * @param rankResults 순위 결과 (keyword 기준 매핑)
 */
export function evaluateBatch(
  candidates: KeywordCandidate[],
  rankResults: Map<string, RankResult>
): EvaluationResult[] {
  const results: EvaluationResult[] = [];

  for (const candidate of candidates) {
    const rankResult = rankResults.get(candidate.keyword.toLowerCase());

    if (!rankResult) {
      logger.warn('순위 결과 없음', {
        candidateId: candidate.id,
        keyword: candidate.keyword,
      });
      continue;
    }

    const evaluation = evaluatePerformance(candidate, rankResult);
    results.push(evaluation);
  }

  logger.info('일괄 성과 평가 완료', {
    total: candidates.length,
    evaluated: results.length,
    transitions: results.filter((r) => r.stateTransition?.success).length,
  });

  return results;
}

/**
 * 테스트 진행 상황 요약
 */
export function summarizeTestProgress(candidates: KeywordCandidate[]): {
  testing: number;
  passed: number;
  failed: number;
  avgDaysInTop40: number;
  avgTestDays: number;
} {
  const testing = candidates.filter((c) => c.status === 'testing');
  const passed = candidates.filter((c) => c.testResult === 'pass');
  const failed = candidates.filter(
    (c) => c.testResult === 'fail' || c.testResult === 'timeout'
  );

  const totalDaysInTop40 = testing.reduce(
    (sum, c) => sum + c.daysInTop40,
    0
  );
  const totalTestDays = testing.reduce(
    (sum, c) => sum + calculateTestDays(c),
    0
  );

  return {
    testing: testing.length,
    passed: passed.length,
    failed: failed.length,
    avgDaysInTop40: testing.length > 0 ? totalDaysInTop40 / testing.length : 0,
    avgTestDays: testing.length > 0 ? totalTestDays / testing.length : 0,
  };
}
