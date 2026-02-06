/**
 * @file index.ts
 * @description 키워드 분류 통합 진입점
 * @responsibilities
 * - 유형 분류 + 색깔 분류 통합 실행
 * - 상품별 전체 키워드 분류 실행
 * - 하위 모듈 re-export
 */

import { db } from '@/db/client';
import { logger } from '@/utils/logger';
import { sleep } from '@/utils/sleep';
import { RANKING_CONFIG } from '@/config/app-config';
import {
  classifyKeywordType,
  saveClassificationResult,
} from './type-classifier';
import {
  classifyKeywordColor,
  detectColorChange,
  saveColorClassification,
} from './color-classifier';
import type {
  KeywordClassificationResult,
  ColorClassificationResult,
} from '@/types/keyword.types';

// ============================================
// 상수
// ============================================

/** API 호출 간 딜레이 (ms) */
const API_CALL_DELAY_MS = RANKING_CONFIG.RATE_LIMIT_DELAY;

// ============================================
// 통합 분류
// ============================================

/**
 * 키워드 유형 + 색깔 통합 분류
 * targetWord가 없으면 색깔 분류는 건너뜀
 * @param keyword 분류 대상 키워드
 * @param targetWord 색깔 분류 대상 수식어 (선택)
 * @returns 유형 분류 결과 + 색깔 분류 결과 (nullable)
 */
export async function classifyKeyword(
  keyword: string,
  targetWord?: string
): Promise<{
  type: KeywordClassificationResult;
  color: ColorClassificationResult | null;
}> {
  const startTime = Date.now();

  try {
    logger.info('키워드 통합 분류 시작', { keyword, targetWord });

    // 1. 유형 분류 (항상 실행)
    const typeResult = await classifyKeywordType(keyword);

    // 2. 색깔 분류 (targetWord가 있을 때만 실행)
    let colorResult: ColorClassificationResult | null = null;

    if (targetWord) {
      await sleep(API_CALL_DELAY_MS);
      colorResult = await classifyKeywordColor(keyword, targetWord);
    }

    const executionTime = Date.now() - startTime;

    logger.info('키워드 통합 분류 완료', {
      keyword,
      type: typeResult.type,
      colorClass: colorResult?.colorClass ?? 'skipped',
      executionTimeMs: executionTime,
    });

    return { type: typeResult, color: colorResult };
  } catch (error) {
    logger.error('키워드 통합 분류 실패', {
      keyword,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================
// 상품별 전체 분류
// ============================================

/**
 * 특정 상품에 매핑된 전체 키워드 분류 실행
 * 1. keyword_product_mapping에서 해당 상품의 키워드 목록 조회
 * 2. 각 키워드에 대해 classifyKeyword 실행
 * 3. 결과 DB 반영
 * 4. 색깔 분류 변동 감지 시 로그 기록
 * @param productId 상품 ID
 */
export async function runFullClassificationForProduct(
  productId: number
): Promise<void> {
  const startTime = Date.now();

  try {
    logger.info('상품별 전체 키워드 분류 시작', { productId });

    // 1. 해당 상품의 키워드 목록 조회
    const mappings = await db.queryMany<{
      keyword_id: number;
      keyword: string;
      target_word: string | null;
    }>(
      `SELECT kpm.keyword_id, k.keyword, kpm.target_word
       FROM keyword_product_mapping kpm
       JOIN keywords k ON k.id = kpm.keyword_id
       WHERE kpm.product_id = $1
       ORDER BY kpm.priority ASC`,
      [productId]
    );

    if (mappings.length === 0) {
      logger.warn('상품에 매핑된 키워드 없음', { productId });
      return;
    }

    logger.info('분류 대상 키워드 조회 완료', {
      productId,
      keywordCount: mappings.length,
    });

    // 2. 각 키워드에 대해 분류 실행
    let classifiedCount = 0;
    let colorChangedCount = 0;

    for (const mapping of mappings) {
      try {
        const { type: typeResult, color: colorResult } = await classifyKeyword(
          mapping.keyword,
          mapping.target_word ?? undefined
        );

        // 3. 유형 분류 결과 DB 저장
        await saveClassificationResult(mapping.keyword_id, typeResult);

        // 4. 색깔 분류 결과 DB 저장 + 변동 감지
        if (colorResult) {
          const { changed, prevColor } = await detectColorChange(
            mapping.keyword_id,
            colorResult
          );

          await saveColorClassification(mapping.keyword_id, colorResult);

          if (changed) {
            colorChangedCount++;
            logger.info('색깔 분류 변동 기록', {
              productId,
              keywordId: mapping.keyword_id,
              keyword: mapping.keyword,
              prevColor,
              newColor: colorResult.colorClass,
            });

            // 변동 로그 DB 기록
            await db.query(
              `INSERT INTO keyword_analysis_logs (
                 keyword_id, analysis_type, result_data, created_at
               ) VALUES ($1, $2, $3, NOW())`,
              [
                mapping.keyword_id,
                'color_change',
                JSON.stringify({
                  prevColor,
                  newColor: colorResult.colorClass,
                  titleMatchRatio: colorResult.titleMatchRatio,
                  categoryMatchRatio: colorResult.categoryMatchRatio,
                }),
              ]
            );
          }
        }

        classifiedCount++;
      } catch (error) {
        logger.error('개별 키워드 분류 실패 (계속 진행)', {
          productId,
          keywordId: mapping.keyword_id,
          keyword: mapping.keyword,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      // 다음 키워드 전 딜레이
      await sleep(API_CALL_DELAY_MS);
    }

    const executionTime = Date.now() - startTime;

    logger.info('상품별 전체 키워드 분류 완료', {
      productId,
      totalKeywords: mappings.length,
      classifiedCount,
      colorChangedCount,
      executionTimeMs: executionTime,
    });
  } catch (error) {
    logger.error('상품별 전체 키워드 분류 실패', {
      productId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================
// Re-exports
// ============================================

// Tokenizer
export {
  stripHtmlTags,
  tokenize,
  generateCombinations,
  reverseKeyword,
  joinKeyword,
  containsToken,
  containsTokenInOrder,
} from './keyword-tokenizer';

// Type Classifier
export {
  classifyKeywordType,
  checkSynonymPair,
  checkRedundant,
  batchClassifyKeywords,
  saveClassificationResult,
} from './type-classifier';

// Color Classifier
export {
  classifyKeywordColor,
  batchClassifyColors,
  detectColorChange,
  saveColorClassification,
  saveAnalysisSnapshot,
} from './color-classifier';
