/**
 * @file retry.ts
 * @description 재시도 로직 유틸리티
 * @responsibilities
 * - 실패 시 자동 재시도
 * - 지수 백오프
 * - 타임아웃 처리
 */

import { API_CONFIG } from '@/config/app-config';
import { sleep } from './sleep';
import { logger } from './logger';

/**
 * 재시도 옵션
 */
export interface RetryOptions {
  maxRetries?: number;
  delay?: number;
  exponentialBackoff?: boolean;
  timeout?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * 타임아웃과 함께 Promise 실행
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * 재시도 로직과 함께 함수 실행
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = API_CONFIG.MAX_RETRIES,
    delay = API_CONFIG.RETRY_DELAY,
    exponentialBackoff = API_CONFIG.EXPONENTIAL_BACKOFF,
    timeout = API_CONFIG.TIMEOUT,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 타임아웃과 함께 실행
      return await withTimeout(fn(), timeout);
    } catch (error) {
      lastError = error as Error;

      // 마지막 시도면 에러 던지기
      if (attempt === maxRetries) {
        logger.error(`Failed after ${maxRetries + 1} attempts`, lastError);
        throw lastError;
      }

      // 재시도 콜백 호출
      if (onRetry) {
        onRetry(lastError, attempt + 1);
      }

      // 지연 시간 계산
      const waitTime = exponentialBackoff ? delay * Math.pow(2, attempt) : delay;

      logger.warn(`Attempt ${attempt + 1} failed, retrying in ${waitTime}ms`, {
        error: lastError.message,
      });

      // 대기
      await sleep(waitTime);
    }
  }

  throw lastError!;
}
