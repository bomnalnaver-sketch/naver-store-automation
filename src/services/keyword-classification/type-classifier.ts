/**
 * @file type-classifier.ts
 * @description 키워드 유형 자동 판별 서비스 (5-type system)
 * @responsibilities
 * - 등록상품수 기반 키워드 유형 판별 (composite / integral / order_fixed)
 * - 동의어(synonym) 판별
 * - 불필요(redundant) 키워드 판별
 * - 분류 결과 DB 저장
 */

import { shoppingSearchApi } from '@/services/naver-api/shopping-search-api';
import { shoppingApiBudget } from '@/shared/api-budget-tracker';
import { db } from '@/db/client';
import { logger } from '@/utils/logger';
import { sleep } from '@/utils/sleep';
import { KEYWORD_CLASSIFICATION_CONFIG, RANKING_CONFIG } from '@/config/app-config';
import { joinKeyword, reverseKeyword } from './keyword-tokenizer';
import type {
  KeywordType,
  KeywordClassificationResult,
} from '@/types/keyword.types';

// ============================================
// 상수
// ============================================

/** API 호출 간 딜레이 (ms) - 순위추적 설정 재사용 */
const API_CALL_DELAY_MS = RANKING_CONFIG.RATE_LIMIT_DELAY;

/** 등록상품수 동일 판정 허용 비율 */
const TOLERANCE_RATIO = KEYWORD_CLASSIFICATION_CONFIG.REGISTERED_COUNT_TOLERANCE_RATIO;

// ============================================
// 내부 헬퍼
// ============================================

/**
 * 등록상품수가 동일한지 비교 (허용 오차 적용)
 * 5% 이내의 차이는 동일로 판정
 * @param a 등록상품수 A
 * @param b 등록상품수 B
 * @returns 동일 여부
 */
function areCountsEqual(a: number, b: number): boolean {
  if (a === 0 && b === 0) return true;

  const avg = (a + b) / 2;
  if (avg === 0) return true;

  const diff = Math.abs(a - b);
  return (diff / avg) <= TOLERANCE_RATIO;
}

/**
 * 분류 결과의 신뢰도 계산
 * 등록상품수 차이가 클수록 높은 신뢰도
 * @param countJoined 붙여쓰기 등록상품수
 * @param countSpaced 띄어쓰기 등록상품수
 * @param countReversed 순서반전 등록상품수
 * @returns 신뢰도 (0~1)
 */
function calculateConfidence(
  countJoined: number,
  countSpaced: number,
  countReversed: number
): number {
  const maxCount = Math.max(countJoined, countSpaced, countReversed, 1);

  // 붙여쓰기 vs 띄어쓰기 차이 비율
  const joinedSpacedDiff = Math.abs(countJoined - countSpaced) / maxCount;

  // 띄어쓰기 vs 순서반전 차이 비율
  const spacedReversedDiff = Math.abs(countSpaced - countReversed) / maxCount;

  // 차이가 크면 분류가 명확하므로 높은 신뢰도
  const avgDiff = (joinedSpacedDiff + spacedReversedDiff) / 2;

  // 0.5 ~ 1.0 범위로 정규화 (차이가 없어도 최소 0.5)
  return Math.min(1, 0.5 + avgDiff * 0.5);
}

// ============================================
// 유형 분류 핵심 로직
// ============================================

/**
 * 키워드 유형 자동 판별
 * 쇼핑 검색 API로 붙여쓰기/띄어쓰기/순서반전 각각의 등록상품수를 조회하여 유형 판별
 *
 * 판별 로직:
 * 1. countJoined != countSpaced → integral (일체형)
 * 2. countJoined == countSpaced && countSpaced != countReversed → order_fixed (순서고정)
 * 3. countJoined == countSpaced && countSpaced == countReversed → composite (조합형)
 *
 * @param keyword 판별 대상 키워드
 * @returns 분류 결과
 */
export async function classifyKeywordType(
  keyword: string
): Promise<KeywordClassificationResult> {
  const startTime = Date.now();

  try {
    logger.info('키워드 유형 분류 시작', { keyword });

    // 키워드 변형 생성
    const joined = joinKeyword(keyword);
    const reversed = reverseKeyword(keyword);

    // 쇼핑 검색 API로 등록상품수 조회 (3회 호출)
    const countJoined = await shoppingSearchApi.getRegisteredProductCount(joined);
    shoppingApiBudget.recordCall('color_analysis');

    await sleep(API_CALL_DELAY_MS);

    const countSpaced = await shoppingSearchApi.getRegisteredProductCount(keyword);
    shoppingApiBudget.recordCall('color_analysis');

    await sleep(API_CALL_DELAY_MS);

    const countReversed = await shoppingSearchApi.getRegisteredProductCount(reversed);
    shoppingApiBudget.recordCall('color_analysis');

    // 유형 판별
    let type: KeywordType;

    if (!areCountsEqual(countJoined, countSpaced)) {
      // 붙여쓰기 != 띄어쓰기 → 일체형
      type = 'integral';
    } else if (!areCountsEqual(countSpaced, countReversed)) {
      // 띄어쓰기 != 순서반전 → 순서고정
      type = 'order_fixed';
    } else {
      // 모두 동일 → 조합형
      type = 'composite';
    }

    const confidence = calculateConfidence(countJoined, countSpaced, countReversed);
    const executionTime = Date.now() - startTime;

    const result: KeywordClassificationResult = {
      keyword,
      type,
      confidence,
      details: {
        countJoined,
        countSpaced,
        countReversed,
      },
    };

    logger.info('키워드 유형 분류 완료', {
      keyword,
      type,
      confidence,
      countJoined,
      countSpaced,
      countReversed,
      executionTimeMs: executionTime,
    });

    return result;
  } catch (error) {
    logger.error('키워드 유형 분류 실패', {
      keyword,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================
// 동의어 / 불필요 키워드 판별
// ============================================

/**
 * 두 키워드가 동의어인지 판별
 * 등록상품수(total)가 동일하면 동의어로 판정
 * @param keywordA 키워드 A
 * @param keywordB 키워드 B
 * @returns 동의어 여부
 */
export async function checkSynonymPair(
  keywordA: string,
  keywordB: string
): Promise<boolean> {
  try {
    logger.debug('동의어 판별 시작', { keywordA, keywordB });

    const countA = await shoppingSearchApi.getRegisteredProductCount(keywordA);
    shoppingApiBudget.recordCall('color_analysis');

    await sleep(API_CALL_DELAY_MS);

    const countB = await shoppingSearchApi.getRegisteredProductCount(keywordB);
    shoppingApiBudget.recordCall('color_analysis');

    const isSynonym = areCountsEqual(countA, countB);

    logger.debug('동의어 판별 완료', {
      keywordA,
      keywordB,
      countA,
      countB,
      isSynonym,
    });

    return isSynonym;
  } catch (error) {
    logger.error('동의어 판별 실패', {
      keywordA,
      keywordB,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 수식어가 불필요한지 판별
 * "수식어+핵심어" 등록상품수 == "핵심어" 등록상품수이면 불필요
 * @param modifier 수식어
 * @param coreKeyword 핵심 키워드
 * @returns 불필요 여부
 */
export async function checkRedundant(
  modifier: string,
  coreKeyword: string
): Promise<boolean> {
  try {
    const combined = `${modifier} ${coreKeyword}`;
    logger.debug('불필요 키워드 판별 시작', { modifier, coreKeyword, combined });

    const countCombined = await shoppingSearchApi.getRegisteredProductCount(combined);
    shoppingApiBudget.recordCall('color_analysis');

    await sleep(API_CALL_DELAY_MS);

    const countCore = await shoppingSearchApi.getRegisteredProductCount(coreKeyword);
    shoppingApiBudget.recordCall('color_analysis');

    const isRedundant = areCountsEqual(countCombined, countCore);

    logger.debug('불필요 키워드 판별 완료', {
      modifier,
      coreKeyword,
      countCombined,
      countCore,
      isRedundant,
    });

    return isRedundant;
  } catch (error) {
    logger.error('불필요 키워드 판별 실패', {
      modifier,
      coreKeyword,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================
// 배치 분류
// ============================================

/**
 * 다중 키워드 유형 일괄 분류
 * 각 키워드 분류 사이에 딜레이를 두어 API Rate Limit 방지
 * @param keywords 분류 대상 키워드 배열
 * @returns 분류 결과 배열
 */
export async function batchClassifyKeywords(
  keywords: string[]
): Promise<KeywordClassificationResult[]> {
  logger.info('키워드 배치 유형 분류 시작', { count: keywords.length });

  const results: KeywordClassificationResult[] = [];

  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    if (!keyword) continue;

    // API 예산 확인
    if (!shoppingApiBudget.canMakeCall('color_analysis')) {
      logger.warn('API 예산 소진으로 배치 분류 중단', {
        completed: i,
        total: keywords.length,
      });
      break;
    }

    try {
      const result = await classifyKeywordType(keyword);
      results.push(result);
    } catch (error) {
      logger.error('배치 분류 중 개별 키워드 실패', {
        keyword,
        index: i,
        error: error instanceof Error ? error.message : String(error),
      });
      // 개별 실패는 건너뛰고 계속 진행
      continue;
    }

    // 다음 키워드 분류 전 딜레이
    if (i < keywords.length - 1) {
      await sleep(API_CALL_DELAY_MS);
    }
  }

  logger.info('키워드 배치 유형 분류 완료', {
    total: keywords.length,
    classified: results.length,
  });

  return results;
}

// ============================================
// DB 저장
// ============================================

/**
 * 키워드 유형 분류 결과를 DB에 저장
 * keywords 테이블 UPDATE + keyword_analysis_logs INSERT
 * @param keywordId 키워드 ID
 * @param result 분류 결과
 */
export async function saveClassificationResult(
  keywordId: number,
  result: KeywordClassificationResult
): Promise<void> {
  try {
    // keywords 테이블 업데이트
    await db.query(
      `UPDATE keywords
       SET keyword_type = $1,
           keyword_type_confidence = $2,
           registered_count_joined = $3,
           registered_count_spaced = $4,
           registered_count_reversed = $5,
           last_type_classified_at = NOW(),
           updated_at = NOW()
       WHERE id = $6`,
      [
        result.type,
        result.confidence,
        result.details.countJoined,
        result.details.countSpaced,
        result.details.countReversed,
        keywordId,
      ]
    );

    // 분석 로그 기록
    await db.query(
      `INSERT INTO keyword_analysis_logs (
         keyword_id, analysis_type, result_data, created_at
       ) VALUES ($1, $2, $3, NOW())`,
      [
        keywordId,
        'type_classification',
        JSON.stringify(result),
      ]
    );

    logger.info('키워드 유형 분류 결과 저장 완료', {
      keywordId,
      type: result.type,
      confidence: result.confidence,
    });
  } catch (error) {
    logger.error('키워드 유형 분류 결과 저장 실패', {
      keywordId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
