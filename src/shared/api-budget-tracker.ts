/**
 * @file api-budget-tracker.ts
 * @description 일일 API 호출 예산 추적기
 * @responsibilities
 * - 쇼핑 검색 API 일일 호출 수 추적
 * - 기능별 예산 분배 관리 (순위추적 / 색깔분류 / 예비)
 * - 예산 초과 방지
 */

import { SHOPPING_API_CONFIG } from '@/config/app-config';
import { logger } from '@/utils/logger';

export type BudgetFeature = 'ranking' | 'color_analysis' | 'reserve';

interface BudgetStatus {
  ranking: { used: number; limit: number; remaining: number };
  colorAnalysis: { used: number; limit: number; remaining: number };
  reserve: { used: number; limit: number; remaining: number };
  total: { used: number; limit: number; remaining: number };
}

/**
 * API 호출 예산 추적기
 * 일일 25,000회 한도를 기능별로 분배 관리
 */
class ApiBudgetTracker {
  private counts: Record<BudgetFeature, number> = {
    ranking: 0,
    color_analysis: 0,
    reserve: 0,
  };

  private limits: Record<BudgetFeature, number>;
  private dailyLimit: number;
  private resetDate: string;

  constructor() {
    this.dailyLimit = SHOPPING_API_CONFIG.DAILY_CALL_LIMIT;
    this.limits = {
      ranking: SHOPPING_API_CONFIG.API_BUDGET.RANKING,
      color_analysis: SHOPPING_API_CONFIG.API_BUDGET.COLOR_ANALYSIS,
      reserve: SHOPPING_API_CONFIG.API_BUDGET.RESERVE,
    };
    this.resetDate = new Date().toISOString().split('T')[0]!;
  }

  /**
   * 해당 기능의 API 호출이 가능한지 확인
   */
  canMakeCall(feature: BudgetFeature): boolean {
    this.checkDailyReset();

    const totalUsed = this.getTotalUsed();
    if (totalUsed >= this.dailyLimit) {
      logger.warn('일일 API 호출 한도 초과', { totalUsed, dailyLimit: this.dailyLimit });
      return false;
    }

    if (this.counts[feature] >= this.limits[feature]) {
      // 예비 예산에서 차감 시도
      if (feature !== 'reserve' && this.counts.reserve < this.limits.reserve) {
        return true;
      }
      logger.warn('기능별 API 예산 초과', { feature, used: this.counts[feature], limit: this.limits[feature] });
      return false;
    }

    return true;
  }

  /**
   * API 호출 기록
   */
  recordCall(feature: BudgetFeature, count: number = 1): void {
    this.checkDailyReset();

    if (this.counts[feature] + count > this.limits[feature]) {
      // 초과분은 reserve에서 차감
      const overflow = (this.counts[feature] + count) - this.limits[feature];
      this.counts[feature] = this.limits[feature];
      this.counts.reserve += overflow;
    } else {
      this.counts[feature] += count;
    }
  }

  /**
   * 현재 예산 상태 조회
   */
  getStatus(): BudgetStatus {
    this.checkDailyReset();
    const totalUsed = this.getTotalUsed();

    return {
      ranking: {
        used: this.counts.ranking,
        limit: this.limits.ranking,
        remaining: Math.max(0, this.limits.ranking - this.counts.ranking),
      },
      colorAnalysis: {
        used: this.counts.color_analysis,
        limit: this.limits.color_analysis,
        remaining: Math.max(0, this.limits.color_analysis - this.counts.color_analysis),
      },
      reserve: {
        used: this.counts.reserve,
        limit: this.limits.reserve,
        remaining: Math.max(0, this.limits.reserve - this.counts.reserve),
      },
      total: {
        used: totalUsed,
        limit: this.dailyLimit,
        remaining: Math.max(0, this.dailyLimit - totalUsed),
      },
    };
  }

  /**
   * 일일 리셋 (새 날짜면 카운터 초기화)
   */
  resetDaily(): void {
    this.counts = { ranking: 0, color_analysis: 0, reserve: 0 };
    this.resetDate = new Date().toISOString().split('T')[0]!;
    logger.info('API 예산 일일 리셋 완료');
  }

  private getTotalUsed(): number {
    return this.counts.ranking + this.counts.color_analysis + this.counts.reserve;
  }

  private checkDailyReset(): void {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.resetDate) {
      this.resetDaily();
    }
  }
}

/** 싱글톤 인스턴스 */
export const shoppingApiBudget = new ApiBudgetTracker();
