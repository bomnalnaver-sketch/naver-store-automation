/**
 * @file date.ts
 * @description 날짜 처리 유틸리티
 * @responsibilities
 * - 날짜 포맷 변환
 * - 날짜 계산
 * - 시간대 처리
 */

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

/**
 * 날짜를 YYYY-MM-DD HH:mm:ss 형식으로 포맷
 */
export function formatDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').split('.')[0]!;
}

/**
 * 오늘 날짜 (YYYY-MM-DD)
 */
export function today(): string {
  return formatDate(new Date());
}

/**
 * 어제 날짜 (YYYY-MM-DD)
 */
export function yesterday(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return formatDate(date);
}

/**
 * N일 전 날짜 (YYYY-MM-DD)
 */
export function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date);
}

/**
 * N일 후 날짜 (YYYY-MM-DD)
 */
export function daysAfter(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

/**
 * 두 날짜 사이의 일수 차이
 */
export function daysBetween(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;

  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 날짜 범위 생성
 */
export function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * 문자열을 Date로 변환 (YYYY-MM-DD)
 */
export function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00Z');
}
