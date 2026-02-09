/**
 * @file auto-executor.test.ts
 * @description 자동 실행 서비스 테스트
 */

import {
  runAutoExecution,
  isAutoExecutionEnabled,
  getExecutionMode,
  AutoExecutionResult,
} from '@/services/auto-executor';
import { db } from '@/db/client';

// DB 모킹
jest.mock('@/db/client', () => ({
  db: {
    query: jest.fn(),
  },
}));

// Commerce API 모킹
jest.mock('@/services/naver-api/commerce-api', () => ({
  commerceApi: {
    updateProduct: jest.fn().mockResolvedValue({}),
  },
}));

// Search Ad API 모킹
jest.mock('@/services/naver-api/search-ad-api', () => ({
  searchAdApi: {
    updateKeyword: jest.fn().mockResolvedValue({}),
    deleteKeyword: jest.fn().mockResolvedValue(undefined),
  },
}));

// Logger 모킹
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('AutoExecutor Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isAutoExecutionEnabled', () => {
    it('should return true when auto_run_enabled is true', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ value: 'true' }],
      });

      const result = await isAutoExecutionEnabled();
      expect(result).toBe(true);
    });

    it('should return false when auto_run_enabled is false', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ value: 'false' }],
      });

      const result = await isAutoExecutionEnabled();
      expect(result).toBe(false);
    });

    it('should return false when setting does not exist', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const result = await isAutoExecutionEnabled();
      expect(result).toBe(false);
    });

    it('should return false on database error', async () => {
      (db.query as jest.Mock).mockRejectedValueOnce(new Error('DB Error'));

      const result = await isAutoExecutionEnabled();
      expect(result).toBe(false);
    });
  });

  describe('getExecutionMode', () => {
    it('should return "auto" when execution_mode is auto', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ value: '"auto"' }],
      });

      const result = await getExecutionMode();
      expect(result).toBe('auto');
    });

    it('should return "manual_approval" when execution_mode is manual_approval', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ value: '"manual_approval"' }],
      });

      const result = await getExecutionMode();
      expect(result).toBe('manual_approval');
    });

    it('should return "manual_approval" when setting does not exist', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const result = await getExecutionMode();
      expect(result).toBe('manual_approval');
    });

    it('should return "manual_approval" on database error', async () => {
      (db.query as jest.Mock).mockRejectedValueOnce(new Error('DB Error'));

      const result = await getExecutionMode();
      expect(result).toBe('manual_approval');
    });
  });

  describe('runAutoExecution', () => {
    it('should return empty results when no pending changes exist', async () => {
      // A/B 테스트 조회 - 빈 결과
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // AI 결정 조회 - 빈 결과
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // 입찰가 조정 조회 - 빈 결과
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // execution_mode 조회
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ value: '"manual_approval"' }] });
      // auto_execution_logs 저장
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result: AutoExecutionResult = await runAutoExecution();

      expect(result.productNameChanges.applied).toBe(0);
      expect(result.productNameChanges.failed).toBe(0);
      expect(result.aiDecisions.executed).toBe(0);
      expect(result.aiDecisions.failed).toBe(0);
      expect(result.bidAdjustments.applied).toBe(0);
      expect(result.bidAdjustments.failed).toBe(0);
    });

    it('should handle A/B test winner application', async () => {
      // A/B 테스트 조회 - 승자 있음
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            test_id: 1,
            product_id: 100,
            naver_product_id: 'NAVER_123',
            current_name: '기존 상품명',
            new_name: '새 상품명',
          },
        ],
      });
      // 상품 업데이트
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // 테스트 상태 업데이트
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // AI 결정 조회 - 빈 결과
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // 입찰가 조정 조회 - 빈 결과
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // execution_mode 조회
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ value: '"auto"' }] });
      // auto_execution_logs 저장
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await runAutoExecution();

      expect(result.productNameChanges.applied).toBe(1);
      expect(result.productNameChanges.failed).toBe(0);
      expect(result.productNameChanges.details[0]).toMatchObject({
        productId: 100,
        oldName: '기존 상품명',
        newName: '새 상품명',
        success: true,
      });
    });

    it('should handle AI decision execution', async () => {
      // A/B 테스트 조회 - 빈 결과
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // AI 결정 조회 - add_keyword 액션
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            result_id: 1,
            decision_id: 10,
            action_type: 'add_keyword',
            action_data: { productId: '100', keyword: '테스트키워드', bidAmount: 100 },
          },
        ],
      });
      // 키워드 추가
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 1 }] });
      // 결과 업데이트
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // 입찰가 조정 조회 - 빈 결과
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // execution_mode 조회
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ value: '"auto"' }] });
      // auto_execution_logs 저장
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await runAutoExecution();

      expect(result.aiDecisions.executed).toBe(1);
      expect(result.aiDecisions.failed).toBe(0);
      expect(result.aiDecisions.details[0]).toMatchObject({
        decisionId: 10,
        actionType: 'add_keyword',
        success: true,
      });
    });

    it('should handle bid adjustment execution', async () => {
      // A/B 테스트 조회 - 빈 결과
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // AI 결정 조회 - 빈 결과
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // 입찰가 조정 조회 - 조정 있음
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            value: [
              { keywordId: 1, naverKeywordId: 'NAVER_KW_1', oldBid: 100, newBid: 150 },
            ],
          },
        ],
      });
      // 키워드 업데이트
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // 조정 목록 삭제
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // execution_mode 조회
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ value: '"auto"' }] });
      // auto_execution_logs 저장
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await runAutoExecution();

      expect(result.bidAdjustments.applied).toBe(1);
      expect(result.bidAdjustments.failed).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      // A/B 테스트 조회 실패
      (db.query as jest.Mock).mockRejectedValueOnce(new Error('DB Error'));
      // AI 결정 조회 - 빈 결과
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // 입찰가 조정 조회 - 빈 결과
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // execution_mode 조회
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ value: '"manual_approval"' }] });
      // auto_execution_logs 저장
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      // 에러가 발생해도 전체 함수는 실패하지 않아야 함
      const result = await runAutoExecution();

      expect(result.productNameChanges.applied).toBe(0);
      // 다른 작업은 계속 진행됨
    });
  });
});
