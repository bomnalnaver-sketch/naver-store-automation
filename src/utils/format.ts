/**
 * @file format.ts
 * @description 데이터 포맷 변환 유틸리티
 * @responsibilities
 * - 숫자 포맷팅
 * - 퍼센트 포맷팅
 * - 통화 포맷팅
 */

/**
 * 숫자를 천 단위 쉼표로 포맷
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('ko-KR');
}

/**
 * 숫자를 통화 형식으로 포맷
 */
export function formatCurrency(amount: number): string {
  return `${formatNumber(amount)}원`;
}

/**
 * 숫자를 퍼센트로 포맷
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * ROAS 계산 및 포맷
 */
export function calculateRoas(sales: number, cost: number): number {
  if (cost === 0) return 0;
  return (sales / cost) * 100;
}

/**
 * 클릭률(CTR) 계산
 */
export function calculateCtr(clicks: number, impressions: number): number {
  if (impressions === 0) return 0;
  return (clicks / impressions) * 100;
}

/**
 * 전환율 계산
 */
export function calculateConversionRate(conversions: number, clicks: number): number {
  if (clicks === 0) return 0;
  return (conversions / clicks) * 100;
}

/**
 * 평균 클릭 비용 계산
 */
export function calculateAvgClickCost(cost: number, clicks: number): number {
  if (clicks === 0) return 0;
  return Math.round(cost / clicks);
}

/**
 * 안전한 나눗셈 (0으로 나누기 방지)
 */
export function safeDivide(numerator: number, denominator: number, defaultValue: number = 0): number {
  if (denominator === 0) return defaultValue;
  return numerator / denominator;
}
