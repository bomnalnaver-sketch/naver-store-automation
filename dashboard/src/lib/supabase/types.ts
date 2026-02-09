/**
 * @file types.ts
 * @description DB 테이블 행 타입 정의 (Supabase 쿼리 결과용)
 * @responsibilities
 * - 모든 DB 테이블의 행 타입 정의
 * - Supabase 쿼리에서 제네릭으로 사용
 */

// ============================================
// 키워드 관련
// ============================================

export type KeywordType = 'composite' | 'integral' | 'order_fixed' | 'synonym' | 'redundant';
export type ColorClass = 'yellow' | 'gray' | 'green' | 'blue' | 'orange';
export type CompetitionIndex = 'LOW' | 'MEDIUM' | 'HIGH';

export interface KeywordRow {
  id: number;
  keyword: string;
  keyword_type: KeywordType | null;
  keyword_type_confidence: number | null;
  synonym_group_id: number | null;
  color_class: ColorClass | null;
  title_match_ratio: number | null;
  category_match_ratio: number | null;
  monthly_pc_search: number;
  monthly_mobile_search: number;
  monthly_total_search: number;
  competition_index: CompetitionIndex | null;
  registered_count_joined: number | null;
  registered_count_spaced: number | null;
  registered_count_reversed: number | null;
  last_type_classified_at: string | null;
  last_color_classified_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// 상품 관련
// ============================================

export type PopularityStage = 'extreme_early' | 'growth' | 'stable';

export interface ProductRow {
  id: number;
  naver_product_id: string;
  product_name: string;
  category_id: string | null;
  category_name: string | null;
  tags: string[] | null;
  attributes: Record<string, unknown> | null;
  excluded_from_test: boolean;
  store_name: string | null;
  naver_shopping_product_id: string | null;
  current_popularity_stage: PopularityStage | null;
  representative_keyword: string | null;
  representative_keyword_rank: number | null;
  weekly_orders: number | null;
  weekly_sales: number | null;
  weekly_sales_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductDailyStatsRow {
  id: number;
  product_id: number;
  date: string;
  views: number;
  clicks: number;
  orders: number;
  sales: number;
  click_rate: number | null;
  conversion_rate: number | null;
  created_at: string;
}

// ============================================
// 키워드-상품 매핑
// ============================================

export type KeywordPlacement = 'product_name' | 'tag' | 'attribute' | 'none';

export interface KeywordProductMappingRow {
  id: number;
  keyword_id: number;
  product_id: number;
  placement: KeywordPlacement;
  is_tracked: boolean;
  priority: number;
  target_word: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// 순위 추적
// ============================================

export type RankAlertType = 'SURGE' | 'DROP' | 'ENTER' | 'EXIT';

export interface KeywordRankingDailyRow {
  id: number;
  product_id: string;
  keyword: string;
  rank: number | null;
  rank_limit: number;
  checked_at: string;
  api_calls: number;
  created_at: string;
}

export interface KeywordRankingAlertRow {
  id: number;
  product_id: string;
  keyword: string;
  prev_rank: number | null;
  curr_rank: number | null;
  change_amount: number;
  alert_type: RankAlertType;
  is_read: boolean;
  created_at: string;
}

// ============================================
// 광고 키워드
// ============================================

export type AdKeywordStatus = 'active' | 'paused' | 'removed';

export interface AdKeywordRow {
  id: number;
  product_id: string;
  keyword: string;
  naver_keyword_id: string | null;
  status: AdKeywordStatus;
  bid_amount: number;
  is_test: boolean;
  test_started_at: string | null;
  test_ended_at: string | null;
  is_protected: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdKeywordDailyStatsRow {
  id: number;
  keyword_id: number;
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  sales: number;
  click_rate: number | null;
  conversion_rate: number | null;
  roas: number | null;
  avg_click_cost: number | null;
  created_at: string;
}

export interface AdKeywordTestRow {
  id: number;
  keyword_id: number;
  test_started_at: string;
  test_ended_at: string | null;
  test_result: 'pass' | 'fail' | 'protected' | 'manual_stop' | null;
  total_impressions: number;
  total_clicks: number;
  total_cost: number;
  total_conversions: number;
  total_sales: number;
  final_roas: number | null;
  removal_reason: string | null;
  created_at: string;
}

// ============================================
// A/B 테스트
// ============================================

export type AbTestStatus = 'running' | 'completed' | 'stopped';

export interface ProductAbTestRow {
  id: number;
  product_id: number;
  test_type: string;
  status: AbTestStatus;
  variant_a_id: number | null;
  variant_b_id: number | null;
  test_started_at: string;
  test_ended_at: string | null;
  winner: 'a' | 'b' | 'tie' | null;
  created_at: string;
  updated_at: string;
}

export interface ProductVariantRow {
  id: number;
  test_id: number;
  variant_type: 'a' | 'b';
  product_name: string | null;
  tags: string[] | null;
  category_id: string | null;
  attributes: Record<string, unknown> | null;
  total_views: number;
  total_clicks: number;
  total_orders: number;
  total_sales: number;
  click_rate: number | null;
  conversion_rate: number | null;
  created_at: string;
}

// ============================================
// AI 의사결정
// ============================================

export interface AiDecisionRow {
  id: number;
  decision_type: string;
  input_data: Record<string, unknown>;
  ai_response: Record<string, unknown>;
  actions: Record<string, unknown>;
  model: string | null;
  tokens_used: number | null;
  execution_time_ms: number | null;
  created_at: string;
}

export interface AiDecisionResultRow {
  id: number;
  decision_id: number;
  action_type: string;
  action_data: Record<string, unknown>;
  status: 'pending' | 'success' | 'failed';
  result_data: Record<string, unknown> | null;
  error_message: string | null;
  executed_at: string | null;
  created_at: string;
}

// ============================================
// 설정
// ============================================

export interface SettingRow {
  id: number;
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

export interface ProtectedItemRow {
  id: number;
  item_type: 'keyword' | 'product';
  item_id: number;
  reason: string | null;
  created_at: string;
}

// ============================================
// 불필요 키워드 사전
// ============================================

export interface RedundantKeywordDictRow {
  id: number;
  keyword: string;
  verified: boolean;
  note: string | null;
  created_at: string;
}

// ============================================
// 분석 로그
// ============================================

export interface KeywordAnalysisLogRow {
  id: number;
  keyword_id: number;
  analysis_type: string;
  result_data: Record<string, unknown> | null;
  prev_color_class: ColorClass | null;
  new_color_class: ColorClass | null;
  prev_keyword_type: KeywordType | null;
  new_keyword_type: KeywordType | null;
  title_match_count: number | null;
  category_match_count: number | null;
  total_products_analyzed: number | null;
  title_match_ratio: number | null;
  category_match_ratio: number | null;
  api_calls_used: number;
  execution_time_ms: number | null;
  created_at: string;
}

// ============================================
// 키워드 후보
// ============================================

export type CandidateSource = 'product_name' | 'search_ad' | 'competitor';
export type CandidateStatus = 'pending_approval' | 'candidate' | 'testing' | 'active' | 'warning' | 'failed' | 'rejected' | 'retired';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type TestResult = 'pass' | 'fail' | 'timeout';

export interface KeywordCandidateRow {
  id: number;
  product_id: number;
  keyword_id: number | null;
  keyword: string;

  // 발굴 정보
  source: CandidateSource;
  discovered_at: string;

  // 상태 관리
  status: CandidateStatus;

  // 승인 관련
  approval_status: ApprovalStatus;
  approval_reason: string | null;
  approval_at: string | null;
  filter_reason: string | null;
  category_match_ratio: number | null;

  // 경쟁강도/검색량
  competition_index: CompetitionIndex | null;
  monthly_search_volume: number;

  // 테스트 관련
  test_started_at: string | null;
  test_ended_at: string | null;
  test_result: TestResult | null;

  // 성과 지표
  best_rank: number | null;
  current_rank: number | null;
  days_in_top40: number;
  consecutive_days_in_top40: number;
  contribution_score: number;

  // 후보 점수
  candidate_score: number;

  created_at: string;
  updated_at: string;
}

// 조인된 후보 데이터 (상품 정보 포함)
export interface KeywordCandidateWithProduct extends KeywordCandidateRow {
  product_name?: string;
  store_name?: string | null;
}
