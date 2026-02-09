/**
 * @file state-manager.ts
 * @description 키워드 후보 상태 전이 관리
 * @responsibilities
 * - 상태 전이 규칙 정의
 * - 상태 변경 및 로그 기록
 * - 전이 유효성 검사
 */

import {
  KeywordCandidate,
  CandidateStatus,
  TestResult,
  KeywordLifecycleMetrics,
} from '@/types/keyword.types';
import { KEYWORD_CANDIDATE_CONFIG } from '@/config/app-config';
import { logger } from '@/utils/logger';

/**
 * 상태 전이 규칙
 * candidate → testing → active → warning → retired
 *                    ↘ failed → retired
 */
const VALID_TRANSITIONS: Record<CandidateStatus, CandidateStatus[]> = {
  candidate: ['testing', 'retired'], // 발굴 → 테스트 시작 또는 폐기
  testing: ['active', 'failed', 'retired'], // 테스트 중 → 성공/실패/폐기
  active: ['warning', 'retired'], // 활성 → 경고/퇴역
  warning: ['active', 'retired'], // 경고 → 회복/퇴역
  failed: ['retired', 'candidate'], // 실패 → 퇴역 또는 재시도
  retired: [], // 퇴역은 최종 상태
};

/**
 * 상태 전이 요청
 */
export interface StateTransition {
  candidateId: number;
  fromStatus: CandidateStatus;
  toStatus: CandidateStatus;
  reason: string;
  metrics?: KeywordLifecycleMetrics;
}

/**
 * 상태 전이 결과
 */
export interface TransitionResult {
  success: boolean;
  candidate: KeywordCandidate;
  transition?: StateTransition;
  error?: string;
}

/**
 * 상태 전이 유효성 검사
 */
export function isValidTransition(
  from: CandidateStatus,
  to: CandidateStatus
): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed.includes(to);
}

/**
 * 후보를 테스트 상태로 전이
 * candidate → testing
 */
export function transitionToTesting(
  candidate: KeywordCandidate,
  reason: string = '테스트 시작'
): TransitionResult {
  if (candidate.status !== 'candidate') {
    return {
      success: false,
      candidate,
      error: `candidate 상태에서만 testing으로 전이 가능 (현재: ${candidate.status})`,
    };
  }

  const updated: KeywordCandidate = {
    ...candidate,
    status: 'testing',
    testStartedAt: new Date(),
    updatedAt: new Date(),
  };

  const transition: StateTransition = {
    candidateId: candidate.id,
    fromStatus: 'candidate',
    toStatus: 'testing',
    reason,
    metrics: {
      candidateScore: candidate.candidateScore,
    },
  };

  logger.info('키워드 테스트 시작', {
    candidateId: candidate.id,
    keyword: candidate.keyword,
  });

  return { success: true, candidate: updated, transition };
}

/**
 * 테스트 성공 처리
 * testing → active
 */
export function transitionToActive(
  candidate: KeywordCandidate,
  metrics: KeywordLifecycleMetrics,
  reason: string = '테스트 성공'
): TransitionResult {
  if (candidate.status !== 'testing') {
    return {
      success: false,
      candidate,
      error: `testing 상태에서만 active로 전이 가능 (현재: ${candidate.status})`,
    };
  }

  const updated: KeywordCandidate = {
    ...candidate,
    status: 'active',
    testEndedAt: new Date(),
    testResult: 'pass',
    updatedAt: new Date(),
  };

  const transition: StateTransition = {
    candidateId: candidate.id,
    fromStatus: 'testing',
    toStatus: 'active',
    reason,
    metrics,
  };

  logger.info('키워드 테스트 성공', {
    candidateId: candidate.id,
    keyword: candidate.keyword,
    daysInTop40: metrics.daysInTop40,
  });

  return { success: true, candidate: updated, transition };
}

/**
 * 테스트 실패 처리
 * testing → failed
 */
export function transitionToFailed(
  candidate: KeywordCandidate,
  metrics: KeywordLifecycleMetrics,
  reason: string
): TransitionResult {
  if (candidate.status !== 'testing') {
    return {
      success: false,
      candidate,
      error: `testing 상태에서만 failed로 전이 가능 (현재: ${candidate.status})`,
    };
  }

  const updated: KeywordCandidate = {
    ...candidate,
    status: 'failed',
    testEndedAt: new Date(),
    testResult: reason.includes('타임아웃') ? 'timeout' : 'fail',
    updatedAt: new Date(),
  };

  const transition: StateTransition = {
    candidateId: candidate.id,
    fromStatus: 'testing',
    toStatus: 'failed',
    reason,
    metrics,
  };

  logger.info('키워드 테스트 실패', {
    candidateId: candidate.id,
    keyword: candidate.keyword,
    reason,
  });

  return { success: true, candidate: updated, transition };
}

/**
 * 경고 상태로 전이
 * active → warning
 */
export function transitionToWarning(
  candidate: KeywordCandidate,
  metrics: KeywordLifecycleMetrics,
  reason: string = '1페이지 이탈'
): TransitionResult {
  if (candidate.status !== 'active') {
    return {
      success: false,
      candidate,
      error: `active 상태에서만 warning으로 전이 가능 (현재: ${candidate.status})`,
    };
  }

  const updated: KeywordCandidate = {
    ...candidate,
    status: 'warning',
    updatedAt: new Date(),
  };

  const transition: StateTransition = {
    candidateId: candidate.id,
    fromStatus: 'active',
    toStatus: 'warning',
    reason,
    metrics,
  };

  logger.warn('키워드 경고 상태 전이', {
    candidateId: candidate.id,
    keyword: candidate.keyword,
    rank: metrics.rank,
  });

  return { success: true, candidate: updated, transition };
}

/**
 * 경고에서 활성으로 회복
 * warning → active
 */
export function transitionToRecovered(
  candidate: KeywordCandidate,
  metrics: KeywordLifecycleMetrics,
  reason: string = '1페이지 재진입'
): TransitionResult {
  if (candidate.status !== 'warning') {
    return {
      success: false,
      candidate,
      error: `warning 상태에서만 active로 회복 가능 (현재: ${candidate.status})`,
    };
  }

  const updated: KeywordCandidate = {
    ...candidate,
    status: 'active',
    updatedAt: new Date(),
  };

  const transition: StateTransition = {
    candidateId: candidate.id,
    fromStatus: 'warning',
    toStatus: 'active',
    reason,
    metrics,
  };

  logger.info('키워드 회복', {
    candidateId: candidate.id,
    keyword: candidate.keyword,
    rank: metrics.rank,
  });

  return { success: true, candidate: updated, transition };
}

/**
 * 퇴역 처리
 * any → retired
 */
export function transitionToRetired(
  candidate: KeywordCandidate,
  metrics: KeywordLifecycleMetrics,
  reason: string
): TransitionResult {
  if (candidate.status === 'retired') {
    return {
      success: false,
      candidate,
      error: '이미 퇴역 상태',
    };
  }

  if (!isValidTransition(candidate.status, 'retired')) {
    return {
      success: false,
      candidate,
      error: `${candidate.status} 상태에서 retired로 전이 불가`,
    };
  }

  const updated: KeywordCandidate = {
    ...candidate,
    status: 'retired',
    updatedAt: new Date(),
  };

  const transition: StateTransition = {
    candidateId: candidate.id,
    fromStatus: candidate.status,
    toStatus: 'retired',
    reason,
    metrics,
  };

  logger.info('키워드 퇴역', {
    candidateId: candidate.id,
    keyword: candidate.keyword,
    prevStatus: candidate.status,
    reason,
  });

  return { success: true, candidate: updated, transition };
}

/**
 * 테스트 기간 계산 (일)
 */
export function calculateTestDays(candidate: KeywordCandidate): number {
  if (!candidate.testStartedAt) return 0;

  const startDate = new Date(candidate.testStartedAt);
  const endDate = candidate.testEndedAt
    ? new Date(candidate.testEndedAt)
    : new Date();

  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 테스트 타임아웃 확인
 */
export function isTestTimedOut(candidate: KeywordCandidate): boolean {
  if (candidate.status !== 'testing') return false;

  const testDays = calculateTestDays(candidate);
  return testDays >= KEYWORD_CANDIDATE_CONFIG.TEST.TIMEOUT_DAYS;
}

/**
 * 상태별 후보 분류
 */
export function groupByStatus(
  candidates: KeywordCandidate[]
): Record<CandidateStatus, KeywordCandidate[]> {
  const groups: Record<CandidateStatus, KeywordCandidate[]> = {
    candidate: [],
    testing: [],
    active: [],
    warning: [],
    failed: [],
    retired: [],
  };

  for (const c of candidates) {
    groups[c.status].push(c);
  }

  return groups;
}
