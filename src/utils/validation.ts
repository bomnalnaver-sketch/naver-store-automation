/**
 * @file validation.ts
 * @description 유효성 검증 유틸리티
 * @responsibilities
 * - 데이터 유효성 검증
 * - 타입 검증
 */

/**
 * 빈 값 확인 (null, undefined, 빈 문자열)
 */
export function isEmpty(value: any): boolean {
  return value === null || value === undefined || value === '';
}

/**
 * 숫자 여부 확인
 */
export function isNumber(value: any): boolean {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * 양수 여부 확인
 */
export function isPositive(value: number): boolean {
  return isNumber(value) && value > 0;
}

/**
 * 날짜 형식 확인 (YYYY-MM-DD)
 */
export function isValidDate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;

  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * 이메일 형식 확인
 */
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * URL 형식 확인
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 범위 내 값 확인
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}
