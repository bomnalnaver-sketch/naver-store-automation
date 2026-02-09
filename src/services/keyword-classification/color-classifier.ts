/**
 * @file color-classifier.ts
 * @description 키워드 색깔 분류 서비스
 * @responsibilities
 * - 상위 40개 상품 분석 기반 색깔 분류 (yellow / gray / green / blue / orange)
 * - title/category 매칭 비율 계산
 * - 색깔 변동 감지
 * - 분류 결과 및 스냅샷 DB 저장
 */

import { shoppingSearchApi } from '@/services/naver-api/shopping-search-api';
import { shoppingApiBudget } from '@/shared/api-budget-tracker';
import { db } from '@/db/client';
import { logger } from '@/utils/logger';
import { sleep } from '@/utils/sleep';
import { KEYWORD_CLASSIFICATION_CONFIG, RANKING_CONFIG } from '@/config/app-config';
import { containsToken } from './keyword-tokenizer';
import type { ColorClass, ColorClassificationResult } from '@/types/keyword.types';
import type { ShoppingSearchItem } from '@/types/shopping-api.types';

// ============================================
// 상수
// ============================================

const { COLOR_THRESHOLDS } = KEYWORD_CLASSIFICATION_CONFIG;

/** API 호출 간 딜레이 (ms) */
const API_CALL_DELAY_MS = RANKING_CONFIG.RATE_LIMIT_DELAY;

// ============================================
// 색깔 분류 핵심 로직
// ============================================

/**
 * 키워드 색깔 분류
 * 쇼핑 검색 상위 40개 상품의 title/category에서 targetWord 포함 비율을 분석하여 색깔 판정
 *
 * 판정 기준:
 * - yellow (상품명전용): titleMatchRatio >= 95%
 * - gray (카테고리): categoryMatchRatio >= 80%
 * - green (속성): titleMatchRatio >= 50%
 * - blue (태그): titleMatchRatio < 50% AND categoryMatchRatio < 30%
 * - orange (혼합): 그 외 → AI 판단 필요
 *
 * @param keyword 검색 키워드
 * @param targetWord 분석 대상 수식어 (title/category에서 검색할 단어)
 * @returns 색깔 분류 결과
 */
export async function classifyKeywordColor(
  keyword: string,
  targetWord: string
): Promise<ColorClassificationResult> {
  const startTime = Date.now();

  try {
    logger.info('키워드 색깔 분류 시작', { keyword, targetWord });

    // API 예산 확인
    if (!shoppingApiBudget.canMakeCall('color_analysis')) {
      throw new Error('색깔 분류 API 예산 소진');
    }

    // 상위 40개 상품 조회
    const items = await shoppingSearchApi.searchTop40(keyword);
    shoppingApiBudget.recordCall('color_analysis');

    const totalAnalyzed = items.length;

    if (totalAnalyzed === 0) {
      logger.warn('검색 결과 없음, 기본값(orange) 반환', { keyword });
      return buildResult(keyword, 'orange', 0, 0, 0, 0, 0, 'ai_review');
    }

    // title 매칭 카운트 (HTML 태그 제거 후)
    const titleMatchCount = countTitleMatches(items, targetWord);

    // category 매칭 카운트
    const categoryMatchCount = countCategoryMatches(items, targetWord);

    // 비율 계산
    const titleMatchRatio = (titleMatchCount / totalAnalyzed) * 100;
    const categoryMatchRatio = (categoryMatchCount / totalAnalyzed) * 100;

    // 색깔 판정
    const { colorClass, recommendedPlacement } = determineColor(
      titleMatchRatio,
      categoryMatchRatio
    );

    const executionTime = Date.now() - startTime;

    const result: ColorClassificationResult = {
      keyword,
      colorClass,
      titleMatchRatio,
      categoryMatchRatio,
      titleMatchCount,
      categoryMatchCount,
      totalAnalyzed,
      recommendedPlacement,
    };

    logger.info('키워드 색깔 분류 완료', {
      keyword,
      targetWord,
      colorClass,
      titleMatchRatio: titleMatchRatio.toFixed(1),
      categoryMatchRatio: categoryMatchRatio.toFixed(1),
      executionTimeMs: executionTime,
    });

    return result;
  } catch (error) {
    logger.error('키워드 색깔 분류 실패', {
      keyword,
      targetWord,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================
// 내부 헬퍼
// ============================================

/**
 * 상품 title에서 targetWord 포함 수 카운트
 */
function countTitleMatches(
  items: ShoppingSearchItem[],
  targetWord: string
): number {
  return items.filter((item) => containsToken(item.title, targetWord)).length;
}

/**
 * 상품 category1~4에서 targetWord 포함 수 카운트
 * 하나의 상품에서 category1~4 중 하나라도 포함하면 1회로 카운트
 */
function countCategoryMatches(
  items: ShoppingSearchItem[],
  targetWord: string
): number {
  return items.filter((item) => {
    const categories = [
      item.category1,
      item.category2,
      item.category3,
      item.category4,
    ].filter(Boolean);

    return categories.some((cat) => containsToken(cat, targetWord));
  }).length;
}

/**
 * 비율 기반 색깔 판정
 */
function determineColor(
  titleMatchRatio: number,
  categoryMatchRatio: number
): { colorClass: ColorClass; recommendedPlacement: ColorClassificationResult['recommendedPlacement'] } {
  // 순서 중요: yellow → gray → green → blue → orange
  if (titleMatchRatio >= COLOR_THRESHOLDS.YELLOW_TITLE_RATIO) {
    return { colorClass: 'yellow', recommendedPlacement: 'product_name' };
  }

  if (categoryMatchRatio >= COLOR_THRESHOLDS.GRAY_CATEGORY_RATIO) {
    return { colorClass: 'gray', recommendedPlacement: 'ai_review' };
  }

  if (titleMatchRatio >= COLOR_THRESHOLDS.GREEN_TITLE_RATIO) {
    return { colorClass: 'green', recommendedPlacement: 'product_name' };
  }

  if (
    titleMatchRatio < COLOR_THRESHOLDS.BLUE_TITLE_MAX &&
    categoryMatchRatio < COLOR_THRESHOLDS.BLUE_CATEGORY_MAX
  ) {
    return { colorClass: 'blue', recommendedPlacement: 'tag' };
  }

  return { colorClass: 'orange', recommendedPlacement: 'ai_review' };
}

/**
 * ColorClassificationResult 빌더 헬퍼
 */
function buildResult(
  keyword: string,
  colorClass: ColorClass,
  titleMatchRatio: number,
  categoryMatchRatio: number,
  titleMatchCount: number,
  categoryMatchCount: number,
  totalAnalyzed: number,
  recommendedPlacement: ColorClassificationResult['recommendedPlacement']
): ColorClassificationResult {
  return {
    keyword,
    colorClass,
    titleMatchRatio,
    categoryMatchRatio,
    titleMatchCount,
    categoryMatchCount,
    totalAnalyzed,
    recommendedPlacement,
  };
}

// ============================================
// 배치 분류
// ============================================

/**
 * 다중 키워드 색깔 일괄 분류
 * @param inputs 키워드 + targetWord 배열
 * @returns 색깔 분류 결과 배열
 */
export async function batchClassifyColors(
  inputs: Array<{ keyword: string; targetWord: string }>
): Promise<ColorClassificationResult[]> {
  logger.info('키워드 배치 색깔 분류 시작', { count: inputs.length });

  const results: ColorClassificationResult[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    if (!input) continue;
    const { keyword, targetWord } = input;

    if (!shoppingApiBudget.canMakeCall('color_analysis')) {
      logger.warn('API 예산 소진으로 배치 색깔 분류 중단', {
        completed: i,
        total: inputs.length,
      });
      break;
    }

    try {
      const result = await classifyKeywordColor(keyword, targetWord);
      results.push(result);
    } catch (error) {
      logger.error('배치 색깔 분류 중 개별 키워드 실패', {
        keyword,
        targetWord,
        index: i,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    if (i < inputs.length - 1) {
      await sleep(API_CALL_DELAY_MS);
    }
  }

  logger.info('키워드 배치 색깔 분류 완료', {
    total: inputs.length,
    classified: results.length,
  });

  return results;
}

// ============================================
// 변동 감지
// ============================================

/**
 * 이전 색깔 분류와 비교하여 변동 감지
 * @param keywordId 키워드 ID
 * @param newResult 새로운 분류 결과
 * @returns 변동 여부 및 이전 색깔
 */
export async function detectColorChange(
  keywordId: number,
  newResult: ColorClassificationResult
): Promise<{ changed: boolean; prevColor: string | null }> {
  try {
    const prev = await db.queryOne<{ color_class: string }>(
      `SELECT color_class FROM keywords WHERE id = $1`,
      [keywordId]
    );

    const prevColor = prev?.color_class ?? null;
    const changed = prevColor !== null && prevColor !== newResult.colorClass;

    if (changed) {
      logger.info('키워드 색깔 분류 변동 감지', {
        keywordId,
        prevColor,
        newColor: newResult.colorClass,
        keyword: newResult.keyword,
      });
    }

    return { changed, prevColor };
  } catch (error) {
    logger.error('색깔 변동 감지 실패', {
      keywordId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================
// DB 저장
// ============================================

/**
 * 색깔 분류 결과를 DB에 저장
 * @param keywordId 키워드 ID
 * @param result 색깔 분류 결과
 * @param analysisLogId 연관 분석 로그 ID (선택)
 */
export async function saveColorClassification(
  keywordId: number,
  result: ColorClassificationResult,
  analysisLogId?: number
): Promise<void> {
  try {
    // keywords 테이블 업데이트
    await db.query(
      `UPDATE keywords
       SET color_class = $1,
           title_match_ratio = $2,
           category_match_ratio = $3,
           last_color_classified_at = NOW(),
           updated_at = NOW()
       WHERE id = $4`,
      [result.colorClass, result.titleMatchRatio, result.categoryMatchRatio, keywordId]
    );

    // 분석 로그 기록 (API 예산 추적에 사용됨)
    await db.query(
      `INSERT INTO keyword_analysis_logs (
         keyword_id, analysis_type, new_color_class,
         title_match_count, category_match_count, total_products_analyzed,
         title_match_ratio, category_match_ratio, api_calls_used, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, NOW())`,
      [
        keywordId,
        'color_classification',
        result.colorClass,
        result.titleMatchCount,
        result.categoryMatchCount,
        result.totalAnalyzed,
        result.titleMatchRatio,
        result.categoryMatchRatio,
      ]
    );

    logger.info('색깔 분류 결과 저장 완료', {
      keywordId,
      colorClass: result.colorClass,
    });
  } catch (error) {
    logger.error('색깔 분류 결과 저장 실패', {
      keywordId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 색깔 분류 시 사용된 검색 결과 스냅샷 저장
 * 추후 분류 근거 확인 및 추이 분석에 활용
 * @param keywordId 키워드 ID
 * @param items 검색 결과 상품 배열
 * @param analysisLogId 연관 분석 로그 ID (선택)
 */
export async function saveAnalysisSnapshot(
  keywordId: number,
  items: ShoppingSearchItem[],
  analysisLogId?: number
): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    await db.query(
      `INSERT INTO keyword_analysis_snapshots (
         keyword_id, search_results, snapshot_date, analysis_log_id, created_at
       ) VALUES ($1, $2, $3, $4, NOW())`,
      [
        keywordId,
        JSON.stringify(items),
        today,
        analysisLogId ?? null,
      ]
    );

    logger.debug('색깔 분류 스냅샷 저장 완료', {
      keywordId,
      itemCount: items.length,
    });
  } catch (error) {
    logger.error('색깔 분류 스냅샷 저장 실패', {
      keywordId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
