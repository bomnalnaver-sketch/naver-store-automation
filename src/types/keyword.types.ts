/**
 * @file keyword.types.ts
 * @description 키워드 분석 관련 타입 정의
 * @responsibilities
 * - 키워드 분류 타입 (5-type + 색깔 분류)
 * - 상품명 최적화 점수 타입
 * - 순위 추적 타입
 * - 인기도 단계 타입
 * - 키워드 후보 및 라이프사이클 타입
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

// ============================================
// 키워드 후보 (Keyword Candidate)
// ============================================

/** 키워드 발굴 소스 */
export type KeywordSource = 'product_name' | 'search_ad' | 'competitor';

/** 키워드 후보 상태 */
export type CandidateStatus =
  | 'pending_approval' // 수동 승인 대기 (관련성 낮음)
  | 'candidate' // 발굴됨, 테스트 대기
  | 'testing' // 테스트 중
  | 'active' // 테스트 통과, 활성
  | 'warning' // 성과 하락 경고
  | 'failed' // 테스트 실패
  | 'rejected' // 사용자가 거부
  | 'retired'; // 퇴역

/** 승인 상태 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

/** 테스트 결과 */
export type TestResult = 'pass' | 'fail' | 'timeout';

/** 키워드 후보 */
export interface KeywordCandidate {
  id: number;
  productId: number;
  keywordId: number | null;
  keyword: string;
  source: KeywordSource;
  discoveredAt: Date;
  status: CandidateStatus;
  competitionIndex: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  monthlySearchVolume: number;
  testStartedAt: Date | null;
  testEndedAt: Date | null;
  testResult: TestResult | null;
  bestRank: number | null;
  currentRank: number | null;
  daysInTop40: number;
  consecutiveDaysInTop40: number;
  contributionScore: number;
  candidateScore: number;
  // 승인 관련
  approvalStatus: ApprovalStatus;
  approvalReason: string | null; // 승인/거부 사유
  approvalAt: Date | null;
  filterReason: string | null; // 필터링된 이유 (관련성 낮음 등)
  categoryMatchRatio: number | null; // 카테고리 일치율
  createdAt: Date;
  updatedAt: Date;
}

/** 키워드 후보 생성 입력 */
export interface KeywordCandidateCreateInput {
  productId: number;
  keyword: string;
  source: KeywordSource;
  competitionIndex?: 'LOW' | 'MEDIUM' | 'HIGH';
  monthlySearchVolume?: number;
  candidateScore?: number;
}

// ============================================
// 키워드 라이프사이클
// ============================================

/** 상태 전이 로그 */
export interface KeywordLifecycleLog {
  id: number;
  candidateId: number;
  prevStatus: CandidateStatus | null;
  newStatus: CandidateStatus;
  reason: string | null;
  metrics: KeywordLifecycleMetrics | null;
  createdAt: Date;
}

/** 라이프사이클 메트릭 */
export interface KeywordLifecycleMetrics {
  rank?: number | null;
  daysInTop40?: number;
  consecutiveDaysInTop40?: number;
  contributionScore?: number;
  testDays?: number;
}

// ============================================
// 키워드 발굴 (Discovery)
// ============================================

/** 발굴된 키워드 */
export interface DiscoveredKeyword {
  keyword: string;
  source: KeywordSource;
  competitionIndex?: 'LOW' | 'MEDIUM' | 'HIGH';
  monthlySearchVolume?: number;
  frequency?: number; // 경쟁사 분석시 등장 횟수
  sourceDetails?: string[]; // 출처 상세 (상품명 등)
}

/** 발굴 결과 */
export interface DiscoveryResult {
  productId: number;
  productName: string;
  discoveredKeywords: DiscoveredKeyword[];
  totalDiscovered: number;
  sources: {
    productName: number;
    searchAd: number;
    competitor: number;
  };
}

// ============================================
// 키워드 선정 (Selector)
// ============================================

/** 선정 점수 상세 */
export interface CandidateScoreDetails {
  searchVolumeScore: number; // 0~30
  competitionScore: number; // 0~40
  sourceScore: number; // 0~20
  noveltyScore: number; // 0~10
  totalScore: number; // 0~100
}

/** 선정 결과 */
export interface SelectionResult {
  productId: number;
  popularityStage: PopularityStage;
  selectedCandidates: Array<{
    candidate: KeywordCandidate;
    scoreDetails: CandidateScoreDetails;
  }>;
  rejectedCandidates: Array<{
    candidate: KeywordCandidate;
    reason: string;
  }>;
}

// ============================================
// 경쟁사 분석
// ============================================

/** 경쟁사 키워드 분석 결과 */
export interface CompetitorKeywordAnalysis {
  targetKeyword: string;
  competitorCount: number;
  discoveredKeywords: Array<{
    keyword: string;
    frequency: number;
    sources: string[];
  }>;
  analysisDate: Date;
}

/** 경쟁사 분석 캐시 */
export interface CompetitorAnalysisCache {
  id: number;
  targetKeyword: string;
  discoveredKeywords: CompetitorKeywordAnalysis['discoveredKeywords'];
  competitorCount: number;
  analysisDate: Date;
  createdAt: Date;
}
