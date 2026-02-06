/**
 * @file keyword.types.ts
 * @description 키워드 분석 관련 타입 정의
 * @responsibilities
 * - 키워드 분류 타입 (5-type + 색깔 분류)
 * - 상품명 최적화 점수 타입
 * - 순위 추적 타입
 * - 인기도 단계 타입
 */

import { ShoppingSearchItem } from './shopping-api.types';

// ============================================
// 키워드 유형 분류 (Doc 1: Section 1)
// ============================================

/** 키워드 5가지 유형 */
export type KeywordType =
  | 'composite' // 조합형
  | 'integral' // 일체형
  | 'order_fixed' // 순서고정
  | 'synonym' // 동의어
  | 'redundant'; // 불필요

/** 색깔 분류 (Doc 2: Section 3) */
export type ColorClass =
  | 'yellow' // 🟡 상품명전용 (title >= 95%)
  | 'gray' // ⚪ 카테고리 (category >= 80%)
  | 'green' // 🟢 속성 (title >= 50%)
  | 'blue' // 🔵 태그 (title < 50% & category < 30%)
  | 'orange'; // 🟠 혼합 (else → AI 판단)

// ============================================
// 키워드 마스터 데이터
// ============================================

export interface KeywordMaster {
  id: number;
  keyword: string;
  keywordType: KeywordType | null;
  keywordTypeConfidence: number | null;
  synonymGroupId: number | null;
  colorClass: ColorClass | null;
  titleMatchRatio: number | null;
  categoryMatchRatio: number | null;
  monthlyPcSearch: number;
  monthlyMobileSearch: number;
  monthlyTotalSearch: number;
  competitionIndex: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  registeredCountJoined: number | null;
  registeredCountSpaced: number | null;
  registeredCountReversed: number | null;
  lastTypeClassifiedAt: Date | null;
  lastColorClassifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 키워드 유형 판별 (Doc 1: Section 2)
// ============================================

export interface KeywordClassificationInput {
  keyword: string;
  countJoined: number; // 붙여쓰기 등록상품수
  countSpaced: number; // 띄어쓰기 등록상품수
  countReversed: number; // 순서반전 등록상품수
}

export interface KeywordClassificationResult {
  keyword: string;
  type: KeywordType;
  confidence: number;
  details: {
    countJoined: number;
    countSpaced: number;
    countReversed: number;
  };
}

// ============================================
// 색깔 분류 (Doc 2: Section 3.4)
// ============================================

export interface ColorClassificationInput {
  keyword: string;
  targetWord: string; // 분석 대상 수식어
  searchResults: ShoppingSearchItem[];
}

export interface ColorClassificationResult {
  keyword: string;
  colorClass: ColorClass;
  titleMatchRatio: number;
  categoryMatchRatio: number;
  titleMatchCount: number;
  categoryMatchCount: number;
  totalAnalyzed: number;
  recommendedPlacement: 'product_name' | 'tag' | 'attribute' | 'ai_review';
}

// ============================================
// 상품명 최적화 점수 (Doc 1: Section 4)
// ============================================

export type ScoreGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface PenaltyItem {
  ruleId: string; // 예: 'R-01', 'I-01', 'O-01'
  type:
    | 'redundant_keyword'
    | 'synonym_duplicate'
    | 'integral_split'
    | 'order_fixed_wrong'
    | 'order_fixed_insert'
    | 'composite_repeat';
  keyword: string;
  points: number; // 음수
  description: string;
  recommendation: string;
}

export interface BonusItem {
  type: 'composite_space_saving' | 'high_keyword_density' | 'integral_correct';
  keyword: string;
  points: number; // 양수
  description: string;
}

export interface OptimizationScoreResult {
  baseScore: number; // 100
  totalBonus: number;
  totalPenalty: number;
  finalScore: number;
  grade: ScoreGrade;
  penalties: PenaltyItem[];
  bonuses: BonusItem[];
  recommendations: string[];
}

// ============================================
// 노출 시뮬레이션 (Doc 1: Section 6)
// ============================================

export interface ExposedKeyword {
  keyword: string;
  monthlySearchVolume: number;
  keywordType: KeywordType | null;
}

export interface ExposureSimulationResult {
  beforeKeywords: ExposedKeyword[];
  afterKeywords: ExposedKeyword[];
  addedKeywords: ExposedKeyword[];
  removedKeywords: ExposedKeyword[];
  deltaExposureCount: number;
  deltaSearchVolume: number;
  improvementRate: number; // %
}

// ============================================
// 스토어명 분석 (Doc 1: Section 7)
// ============================================

export interface StoreNameAnalysisResult {
  storeName: string;
  storeTokens: string[];
  bonusKeywords: ExposedKeyword[];
  combinationDetails: Array<{
    storeToken: string;
    productToken: string;
    combinedKeyword: string;
    monthlySearchVolume: number;
  }>;
}

// ============================================
// 순위 추적 (Doc 3)
// ============================================

export interface RankCheckConfig {
  RANK_CHECK_LIMIT: number; // 기본: 1000
  DISPLAY_PER_REQUEST: number; // 고정: 100
  RATE_LIMIT_DELAY: number; // ms
}

export interface RankResult {
  keyword: string;
  productId: string;
  rank: number | null; // null = 순위권 밖
  checkedAt: Date;
  apiCalls: number;
}

export interface BatchRankResult {
  results: RankResult[];
  totalApiCalls: number;
  executionTimeMs: number;
}

export type RankAlertType = 'SURGE' | 'DROP' | 'ENTER' | 'EXIT';

export interface RankAlert {
  productId: string;
  keyword: string;
  prevRank: number | null;
  currRank: number | null;
  changeAmount: number;
  alertType: RankAlertType;
}

// ============================================
// 인기도 단계 (Doc 2: Section 5.2)
// ============================================

export type PopularityStage =
  | 'extreme_early' // 극초반: 대표키워드 순위 500위+
  | 'growth' // 성장기: 100~500위
  | 'stable'; // 안정기: 100위 이내

// ============================================
// 상품명 분석 최종 리포트
// ============================================

export interface ProductNameAnalysisReport {
  productId: number;
  productName: string;
  score: OptimizationScoreResult;
  exposureSimulation: ExposureSimulationResult | null;
  storeNameAnalysis: StoreNameAnalysisResult | null;
  analyzedAt: Date;
}

// ============================================
// 키워드-상품 매핑
// ============================================

export type KeywordPlacement = 'product_name' | 'tag' | 'attribute' | 'none';

export interface KeywordProductMapping {
  id: number;
  keywordId: number;
  productId: number;
  placement: KeywordPlacement;
  isTracked: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}
