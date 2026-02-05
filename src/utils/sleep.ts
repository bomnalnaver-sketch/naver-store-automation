/**
 * @file sleep.ts
 * @description 지연 유틸리티
 * @responsibilities
 * - Promise 기반 지연
 */

/**
 * 지정된 시간만큼 대기
 * @param ms 대기 시간 (밀리초)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
