/**
 * @file rank-checker.ts
 * @description 키워드별 상품 순위 조회 서비스
 * @responsibilities
 * - 단일 키워드에 대한 상품 순위 조회
 * - 페이지네이션을 통한 순위 탐색 (조기 종료 최적화)
 * - API 에러 시 재시도 로직 (지수 백오프 / 선형 대기)
 * - API 호출 예산 추적 연동
 */

import { shoppingSearchApi } from '@/services/naver-api/shopping-search-api';
import { shoppingApiBudget } from '@/shared/api-budget-tracker';
import { logger } from '@/utils/logger';
import { sleep } from '@/utils/sleep';
import { RANKING_CONFIG } from '@/config/app-config';
import { RankCheckConfig, RankResult } from '@/types/keyword.types';
import { db } from '@/db/client';

/** 재시도 기본 횟수 */
const DEFAULT_MAX_RETRIES = 3;

/** 429 에러 시 지수 백오프 기본 딜레이 (ms) */
const RATE_LIMIT_BASE_DELAY = 1000;

/** 서버 에러 시 선형 대기 기본 딜레이 (ms) */
const SERVER_ERROR_BASE_DELAY = 1000;

/**
 * 키워드에서 특정 상품의 순위를 조회
 * 페이지를 순차 탐색하며 상품을 발견하면 즉시 반환 (조기 종료 최적화)
 * @param keyword 검색 키워드
 * @param productId 순위를 조회할 상품의 네이버 쇼핑 productId
 * @param config 순위 조회 설정 (기본값: RANKING_CONFIG)
 * @returns 순위 결과 (rank=null이면 순위권 밖)
 */
export async function getProductRank(
  keyword: string,
  productId: string,
  config?: Partial<RankCheckConfig>
): Promise<RankResult> {
  const rankCheckLimit = config?.RANK_CHECK_LIMIT ?? RANKING_CONFIG.RANK_CHECK_LIMIT;
  const displayPerRequest = config?.DISPLAY_PER_REQUEST ?? RANKING_CONFIG.DISPLAY_PER_REQUEST;
  const rateLimitDelay = config?.RATE_LIMIT_DELAY ?? RANKING_CONFIG.RATE_LIMIT_DELAY;

  let apiCalls = 0;

  logger.debug('순위 조회 시작', { keyword, productId, rankCheckLimit });

  for (let start = 1; start <= rankCheckLimit; start += displayPerRequest) {
    // API 호출
    const response = await shoppingSearchApi.searchPage(keyword, start, displayPerRequest);
    apiCalls++;

    // API 예산 기록
    shoppingApiBudget.recordCall('ranking');

    // 내 상품 찾기
    const index = response.items.findIndex(
      (item) => item.productId === productId
    );

    if (index !== -1) {
      // 발견: 순위 계산 후 즉시 반환 (조기 종료)
      const rank = start + index;

      logger.debug('순위 발견', { keyword, productId, rank, apiCalls });

      return {
        keyword,
        productId,
        rank,
        checkedAt: new Date(),
        apiCalls,
      };
    }

    // 다음 페이지 요청 전 Rate limit 딜레이
    if (start + displayPerRequest <= rankCheckLimit) {
      await sleep(rateLimitDelay);
    }
  }

  // 순위권 밖
  logger.debug('순위권 밖', { keyword, productId, rankCheckLimit, apiCalls });

  return {
    keyword,
    productId,
    rank: null,
    checkedAt: new Date(),
    apiCalls,
  };
}

/**
 * API 에러 코드를 추출
 * @param error 발생한 에러 객체
 * @returns HTTP 상태 코드 또는 undefined
 */
function getErrorStatusCode(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status;
  }
  return undefined;
}

/**
 * 순위 조회 실패 시 ranking_error_logs 테이블에 에러 기록
 * @param keyword 검색 키워드
 * @param productId 상품 ID
 * @param error 발생한 에러
 */
async function logRankingError(
  keyword: string,
  productId: string,
  error: unknown
): Promise<void> {
  try {
    const errorCode = String(getErrorStatusCode(error) ?? 'UNKNOWN');
    const errorMsg = error instanceof Error ? error.message : String(error);

    await db.query(
      `INSERT INTO ranking_error_logs (keyword, product_id, error_code, error_msg)
       VALUES ($1, $2, $3, $4)`,
      [keyword, productId, errorCode, errorMsg]
    );
  } catch (logError) {
    // 에러 로깅 실패는 원본 에러를 가리지 않도록 경고만 출력
    logger.warn('순위 에러 로그 저장 실패', {
      keyword,
      productId,
      logError: logError instanceof Error ? logError.message : String(logError),
    });
  }
}

/**
 * 재시도 로직이 포함된 순위 조회
 * - 429 (Rate Limit) 에러: 지수 백오프 (1000 * 2^attempt ms)
 * - 500+ (서버) 에러: 선형 대기 (1000 * attempt ms)
 * - 그 외 에러: 즉시 throw
 * @param keyword 검색 키워드
 * @param productId 상품 ID
 * @param config 순위 조회 설정
 * @param maxRetries 최대 재시도 횟수 (기본: 3)
 * @returns 순위 결과
 */
export async function getProductRankWithRetry(
  keyword: string,
  productId: string,
  config?: Partial<RankCheckConfig>,
  maxRetries: number = DEFAULT_MAX_RETRIES
): Promise<RankResult> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await getProductRank(keyword, productId, config);
    } catch (error) {
      lastError = error;
      const statusCode = getErrorStatusCode(error);

      if (statusCode === 429) {
        // Rate Limit: 지수 백오프
        const delay = RATE_LIMIT_BASE_DELAY * Math.pow(2, attempt);
        logger.warn('Rate limit 발생, 지수 백오프 대기', {
          keyword,
          attempt: attempt + 1,
          maxRetries,
          delayMs: delay,
        });
        await sleep(delay);
      } else if (statusCode !== undefined && statusCode >= 500) {
        // 서버 에러: 선형 대기
        const delay = SERVER_ERROR_BASE_DELAY * (attempt + 1);
        logger.warn('서버 에러 발생, 선형 대기 후 재시도', {
          keyword,
          attempt: attempt + 1,
          maxRetries,
          statusCode,
          delayMs: delay,
        });
        await sleep(delay);
      } else {
        // 그 외 에러: 즉시 throw
        logger.error('순위 조회 중 복구 불가 에러 발생', {
          keyword,
          productId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
  }

  // 모든 재시도 실패: 에러 기록 후 throw
  logger.error('순위 조회 최대 재시도 초과', {
    keyword,
    productId,
    maxRetries,
  });

  await logRankingError(keyword, productId, lastError);

  throw lastError;
}
