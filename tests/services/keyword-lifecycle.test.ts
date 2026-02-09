/**
 * @file keyword-lifecycle.test.ts
 * @description 키워드 라이프사이클 서비스 테스트
 */

import {
  transitionToTesting,
  transitionToActive,
  transitionToFailed,
  transitionToWarning,
  calculateTestDays,
  isTestTimedOut,
  groupByStatus,
  isValidTransition,
} from '@/services/keyword-lifecycle';
import { KeywordCandidate } from '@/types/keyword.types';

// Logger 모킹
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// 테스트용 후보 생성 헬퍼
function createCandidate(overrides: Partial<KeywordCandidate> = {}): KeywordCandidate {
  return {
    id: 1,
    productId: 100,
    keywordId: null,
    keyword: '테스트키워드',
    source: 'product_name',
    discoveredAt: new Date(),
    status: 'candidate',
    approvalStatus: 'approved',
    approvalReason: null,
    approvalAt: null,
    filterReason: null,
    categoryMatchRatio: null,
    competitionIndex: 'LOW',
    monthlySearchVolume: 1000,
    testStartedAt: null,
    testEndedAt: null,
    testResult: null,
    bestRank: null,
    currentRank: null,
    daysInTop40: 0,
    consecutiveDaysInTop40: 0,
    contributionScore: 0,
    candidateScore: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('Keyword Lifecycle State Manager', () => {
  describe('isValidTransition', () => {
    it('should allow transition from candidate to testing', () => {
      expect(isValidTransition('candidate', 'testing')).toBe(true);
    });

    it('should allow transition from testing to active', () => {
      expect(isValidTransition('testing', 'active')).toBe(true);
    });

    it('should allow transition from testing to failed', () => {
      expect(isValidTransition('testing', 'failed')).toBe(true);
    });

    it('should allow transition from active to warning', () => {
      expect(isValidTransition('active', 'warning')).toBe(true);
    });

    it('should allow transition from warning to active (recovery)', () => {
      expect(isValidTransition('warning', 'active')).toBe(true);
    });

    it('should allow transition from pending_approval to candidate', () => {
      expect(isValidTransition('pending_approval', 'candidate')).toBe(true);
    });

    it('should allow transition from pending_approval to rejected', () => {
      expect(isValidTransition('pending_approval', 'rejected')).toBe(true);
    });

    it('should not allow invalid transitions', () => {
      expect(isValidTransition('candidate', 'active')).toBe(false);
      expect(isValidTransition('retired', 'active')).toBe(false);
      expect(isValidTransition('failed', 'active')).toBe(false);
    });
  });

  describe('transitionToTesting', () => {
    it('should transition candidate to testing', () => {
      const candidate = createCandidate({ status: 'candidate' });
      const result = transitionToTesting(candidate);

      expect(result.success).toBe(true);
      expect(result.candidate.status).toBe('testing');
      expect(result.candidate.testStartedAt).toBeDefined();
      expect(result.transition?.fromStatus).toBe('candidate');
      expect(result.transition?.toStatus).toBe('testing');
    });

    it('should fail if candidate is not in candidate status', () => {
      const candidate = createCandidate({ status: 'testing' });
      const result = transitionToTesting(candidate);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('transitionToActive', () => {
    it('should transition testing to active when metrics meet criteria', () => {
      const candidate = createCandidate({
        status: 'testing',
        testStartedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7일 전
      });

      const metrics = {
        daysInTop40: 5,
        consecutiveDaysInTop40: 3,
        testDays: 7,
      };

      const result = transitionToActive(candidate, metrics);

      expect(result.success).toBe(true);
      expect(result.candidate.status).toBe('active');
      expect(result.candidate.testResult).toBe('pass');
    });
  });

  describe('transitionToFailed', () => {
    it('should transition testing to failed', () => {
      const candidate = createCandidate({
        status: 'testing',
        testStartedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      });

      const metrics = {
        daysInTop40: 1,
        consecutiveDaysInTop40: 0,
        testDays: 14,
      };

      const result = transitionToFailed(candidate, metrics, '테스트 실패');

      expect(result.success).toBe(true);
      expect(result.candidate.status).toBe('failed');
      expect(result.candidate.testResult).toBe('fail');
    });
  });

  describe('transitionToWarning', () => {
    it('should transition active to warning', () => {
      const candidate = createCandidate({ status: 'active' });

      const metrics = {
        rank: 50,
        daysInTop40: 10,
        consecutiveDaysInTop40: 0,
      };

      const result = transitionToWarning(candidate, metrics, '순위 하락');

      expect(result.success).toBe(true);
      expect(result.candidate.status).toBe('warning');
    });
  });

  describe('calculateTestDays', () => {
    it('should calculate correct test days', () => {
      // 정확히 7일 전 같은 시각 설정 (경계 조건 방지)
      const now = new Date();
      now.setHours(12, 0, 0, 0); // 정오로 고정
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const candidate = createCandidate({
        status: 'testing',
        testStartedAt: sevenDaysAgo,
      });

      const days = calculateTestDays(candidate);
      // 시간대에 따라 7 또는 8일이 될 수 있음
      expect(days).toBeGreaterThanOrEqual(7);
      expect(days).toBeLessThanOrEqual(8);
    });

    it('should return 0 if testStartedAt is null', () => {
      const candidate = createCandidate({
        status: 'testing',
        testStartedAt: null,
      });

      const days = calculateTestDays(candidate);
      expect(days).toBe(0);
    });
  });

  describe('isTestTimedOut', () => {
    it('should return true if test exceeded timeout days', () => {
      const now = new Date();
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

      const candidate = createCandidate({
        status: 'testing',
        testStartedAt: fifteenDaysAgo,
      });

      expect(isTestTimedOut(candidate)).toBe(true);
    });

    it('should return false if test is within timeout period', () => {
      const now = new Date();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

      const candidate = createCandidate({
        status: 'testing',
        testStartedAt: fiveDaysAgo,
      });

      expect(isTestTimedOut(candidate)).toBe(false);
    });

    it('should return false if candidate is not in testing status', () => {
      const candidate = createCandidate({ status: 'active' });
      expect(isTestTimedOut(candidate)).toBe(false);
    });
  });

  describe('groupByStatus', () => {
    it('should group candidates by status', () => {
      const candidates: KeywordCandidate[] = [
        createCandidate({ id: 1, status: 'candidate' }),
        createCandidate({ id: 2, status: 'candidate' }),
        createCandidate({ id: 3, status: 'testing' }),
        createCandidate({ id: 4, status: 'active' }),
        createCandidate({ id: 5, status: 'warning' }),
        createCandidate({ id: 6, status: 'failed' }),
        createCandidate({ id: 7, status: 'retired' }),
        createCandidate({ id: 8, status: 'pending_approval' }),
        createCandidate({ id: 9, status: 'rejected' }),
      ];

      const groups = groupByStatus(candidates);

      expect(groups.candidate.length).toBe(2);
      expect(groups.testing.length).toBe(1);
      expect(groups.active.length).toBe(1);
      expect(groups.warning.length).toBe(1);
      expect(groups.failed.length).toBe(1);
      expect(groups.retired.length).toBe(1);
      expect(groups.pending_approval.length).toBe(1);
      expect(groups.rejected.length).toBe(1);
    });

    it('should handle empty array', () => {
      const groups = groupByStatus([]);

      expect(groups.candidate.length).toBe(0);
      expect(groups.testing.length).toBe(0);
      expect(groups.active.length).toBe(0);
    });
  });
});
