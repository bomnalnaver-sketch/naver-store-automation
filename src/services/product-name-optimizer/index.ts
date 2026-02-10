/**
 * @file index.ts
 * @description 상품명 최적화 통합 진입점
 * @responsibilities
 * - 상품명 분석 파이프라인 실행
 * - DB에서 키워드 데이터 조회
 * - 현재 vs 개선안 비교 분석
 * - 하위 모듈 re-export
 */

import { db } from '@/db/client';
import { logger } from '@/utils/logger';
import type {
  KeywordMaster,
  ProductNameAnalysisReport,
  ExposureSimulationResult,
} from '@/types/keyword.types';

import { calculateOptimizationScore } from './scoring-engine';
import { simulateExposureChange } from './exposure-simulator';
import { analyzeStoreNameBonus } from './store-name-analyzer';

// ============================================
// 통합 분석 함수
// ============================================

/**
 * 상품명 종합 분석
 * DB에서 키워드 데이터를 조회하고 점수/노출/스토어명 분석을 실행
 * @param productId 상품 ID
 * @param productName 분석 대상 상품명
 * @param storeName 스토어명 (선택)
 * @returns 상품명 분석 리포트
 */
export async function analyzeProductName(
  productId: number,
  productName: string,
  storeName?: string
): Promise<ProductNameAnalysisReport> {
  logger.info('Product name analysis started', { productId, productName });

  // DB에서 해당 상품에 매핑된 키워드 목록 조회
  const keywordDb = await fetchMappedKeywords(productId);
  const redundantDict = await fetchRedundantDictionary();

  // 최적화 점수 산출
  const score = calculateOptimizationScore(productName, keywordDb, redundantDict);

  // 스토어명 분석 (선택)
  const storeNameAnalysis = storeName
    ? analyzeStoreNameBonus(storeName, productName, keywordDb)
    : null;

  logger.info('Product name analysis completed', {
    productId,
    finalScore: score.finalScore,
    grade: score.grade,
  });

  return {
    productId,
    productName,
    score,
    exposureSimulation: null,
    storeNameAnalysis,
    analyzedAt: new Date(),
  };
}

/**
 * 현재 상품명 vs 개선 상품명 비교 분석
 * @param productId 상품 ID
 * @param productName 현재 상품명
 * @param suggestedName 개선 상품명
 * @param storeName 스토어명 (선택)
 * @returns 현재/개선 리포트 및 노출 시뮬레이션 결과
 */
export async function analyzeAndSuggestImprovement(
  productId: number,
  productName: string,
  suggestedName: string,
  storeName?: string
): Promise<{
  currentReport: ProductNameAnalysisReport;
  suggestedReport: ProductNameAnalysisReport;
  exposureSimulation: ExposureSimulationResult;
}> {
  logger.info('Improvement comparison started', {
    productId,
    currentName: productName,
    suggestedName,
  });

  const keywordDb = await fetchMappedKeywords(productId);
  const redundantDict = await fetchRedundantDictionary();

  // 현재 상품명 분석
  const currentScore = calculateOptimizationScore(productName, keywordDb, redundantDict);
  const currentStoreAnalysis = storeName
    ? analyzeStoreNameBonus(storeName, productName, keywordDb)
    : null;

  // 개선 상품명 분석
  const suggestedScore = calculateOptimizationScore(suggestedName, keywordDb, redundantDict);
  const suggestedStoreAnalysis = storeName
    ? analyzeStoreNameBonus(storeName, suggestedName, keywordDb)
    : null;

  // 노출 시뮬레이션
  const exposureSimulation = simulateExposureChange(productName, suggestedName, keywordDb);

  logger.info('Improvement comparison completed', {
    productId,
    currentScore: currentScore.finalScore,
    suggestedScore: suggestedScore.finalScore,
    deltaExposure: exposureSimulation.deltaExposureCount,
  });

  return {
    currentReport: {
      productId,
      productName,
      score: currentScore,
      exposureSimulation,
      storeNameAnalysis: currentStoreAnalysis,
      analyzedAt: new Date(),
    },
    suggestedReport: {
      productId,
      productName: suggestedName,
      score: suggestedScore,
      exposureSimulation,
      storeNameAnalysis: suggestedStoreAnalysis,
      analyzedAt: new Date(),
    },
    exposureSimulation,
  };
}

// ============================================
// DB 조회 함수
// ============================================

/**
 * 상품에 매핑된 키워드 마스터 목록 조회
 * keyword_product_mapping JOIN keywords 테이블
 * @param productId 상품 ID
 * @returns 키워드 마스터 배열
 */
export async function fetchMappedKeywords(productId: number): Promise<KeywordMaster[]> {
  const sql = `
    SELECT k.*
    FROM keywords k
    INNER JOIN keyword_product_mapping kpm ON kpm.keyword_id = k.id
    WHERE kpm.product_id = $1
    ORDER BY k.monthly_total_search DESC
  `;

  const rows = await db.queryMany<any>(sql, [productId]);

  return rows.map(mapRowToKeywordMaster);
}

/**
 * 불필요 키워드 사전 조회
 * @returns 불필요 키워드 문자열 배열
 */
export async function fetchRedundantDictionary(): Promise<string[]> {
  const sql = `
    SELECT keyword FROM redundant_keywords_dict
    WHERE is_active = true
    ORDER BY keyword
  `;

  const rows = await db.queryMany<{ keyword: string }>(sql);

  return rows.map((r) => r.keyword);
}

/**
 * DB 행을 KeywordMaster 인터페이스로 매핑
 * @param row DB 쿼리 결과 행
 * @returns KeywordMaster 객체
 */
function mapRowToKeywordMaster(row: any): KeywordMaster {
  return {
    id: row.id,
    keyword: row.keyword,
    keywordType: row.keyword_type,
    keywordTypeConfidence: row.keyword_type_confidence,
    synonymGroupId: row.synonym_group_id,
    colorClass: row.color_class,
    titleMatchRatio: row.title_match_ratio,
    categoryMatchRatio: row.category_match_ratio,
    monthlyPcSearch: row.monthly_pc_search ?? 0,
    monthlyMobileSearch: row.monthly_mobile_search ?? 0,
    monthlyTotalSearch: row.monthly_total_search ?? 0,
    competitionIndex: row.competition_index,
    registeredCountJoined: row.registered_count_joined,
    registeredCountSpaced: row.registered_count_spaced,
    registeredCountReversed: row.registered_count_reversed,
    lastTypeClassifiedAt: row.last_type_classified_at,
    lastColorClassifiedAt: row.last_color_classified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================
// Re-exports
// ============================================

export {
  calculateOptimizationScore,
  determineGrade,
  checkRedundantKeywords,
  checkSynonymDuplicates,
  checkIntegralSplit,
  checkOrderFixedWrong,
  checkOrderFixedInsert,
  checkCompositeRepeat,
  checkCompositeSpaceSaving,
  checkKeywordDensity,
  checkIntegralCorrect,
} from './scoring-engine';

export {
  generateRecommendations,
  generateSummary,
} from './recommendation-engine';

export {
  extractExposedKeywords,
  simulateExposureChange,
} from './exposure-simulator';

export {
  analyzeStoreNameBonus,
} from './store-name-analyzer';

export {
  reorderProductKeywords,
} from './keyword-reorder';
export type { ReorderResult } from './keyword-reorder';
