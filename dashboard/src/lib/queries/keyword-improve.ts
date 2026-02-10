/**
 * @file keyword-improve.ts
 * @description 키워드 개선 페이지용 쿼리 함수
 * @responsibilities
 * - 상품별 키워드 현황 조회
 * - 매핑된 키워드 + 순위 + 기여도 조회
 * - 후보 키워드 조회
 */

import { createServerSupabase } from '@/lib/supabase/client';
import type {
  ProductRow,
  KeywordRow,
  KeywordType,
  ColorClass,
  CompetitionIndex,
} from '@/lib/supabase/types';

/** 매핑 부분 조회 결과 */
interface MappingPartial {
  keyword_id: number;
  placement: string;
  priority: number;
}

// ============================================
// 타입 정의
// ============================================

/** 상품 요약 (키워드 개선 목록용) */
export interface ProductKeywordSummary {
  productId: number;
  naverProductId: string;
  productName: string;
  representativeKeyword: string | null;
  popularityStage: string | null;
  mappedKeywordCount: number;
  candidateCount: number;
  lastOptimizedAt: string | null;
}

/** 매핑된 키워드 + 순위/기여도 정보 */
export interface MappedKeywordWithMetrics {
  keywordId: number;
  keyword: string;
  keywordType: KeywordType | null;
  colorClass: ColorClass | null;
  placement: string;
  priority: number;
  monthlyTotalSearch: number;
  competitionIndex: CompetitionIndex | null;
  latestRank: number | null;
  contributionScore: number;
  priorityScore: number;
}

/** 후보 키워드 (개선 페이지용) */
export interface CandidateKeywordForImprove {
  id: number;
  keyword: string;
  source: string;
  monthlySearchVolume: number;
  competitionIndex: CompetitionIndex | null;
  candidateScore: number;
  status: string;
  approvalStatus: string;
  bestRank: number | null;
  contributionScore: number;
}

// ============================================
// 상품 목록 (키워드 개선용)
// ============================================

/**
 * 키워드 개선 목록에 표시할 상품 목록 조회
 */
export async function fetchProductsForKeywordImprove(): Promise<ProductKeywordSummary[]> {
  const supabase = createServerSupabase();

  // 활성 상품 목록
  const { data: products, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('excluded_from_test', false)
    .order('id', { ascending: true });

  if (productError || !products?.length) return [];

  const productIds = products.map((p: ProductRow) => p.id);

  // 키워드 매핑 수 집계
  const { data: mappings } = await supabase
    .from('keyword_product_mapping')
    .select('product_id')
    .in('product_id', productIds);

  const mappingCountMap = new Map<number, number>();
  for (const m of mappings ?? []) {
    const pid = m.product_id as number;
    mappingCountMap.set(pid, (mappingCountMap.get(pid) ?? 0) + 1);
  }

  // 후보 수 집계 (pending + approved)
  const { data: candidates } = await supabase
    .from('keyword_candidates')
    .select('product_id, approval_status')
    .in('product_id', productIds)
    .in('approval_status', ['pending', 'approved']);

  const candidateCountMap = new Map<number, number>();
  for (const c of candidates ?? []) {
    const pid = c.product_id as number;
    candidateCountMap.set(pid, (candidateCountMap.get(pid) ?? 0) + 1);
  }

  return products.map((p: ProductRow) => ({
    productId: p.id,
    naverProductId: p.naver_product_id,
    productName: p.product_name,
    representativeKeyword: p.representative_keyword,
    popularityStage: p.current_popularity_stage,
    mappedKeywordCount: mappingCountMap.get(p.id) ?? 0,
    candidateCount: candidateCountMap.get(p.id) ?? 0,
    lastOptimizedAt: p.updated_at,
  }));
}

// ============================================
// 상품별 매핑 키워드 + 메트릭
// ============================================

/**
 * 상품에 매핑된 키워드 + 순위/기여도 조회
 */
export async function fetchMappedKeywordsWithMetrics(
  productId: number
): Promise<MappedKeywordWithMetrics[]> {
  const supabase = createServerSupabase();

  // 매핑 조회
  const { data: mappings } = await supabase
    .from('keyword_product_mapping')
    .select('keyword_id, placement, priority')
    .eq('product_id', productId)
    .order('priority', { ascending: true });

  if (!mappings?.length) return [];

  const keywordIds = mappings.map((m: MappingPartial) => m.keyword_id);

  // 키워드 정보
  const { data: keywords } = await supabase
    .from('keywords')
    .select('*')
    .in('id', keywordIds);

  if (!keywords?.length) return [];

  // 최신 순위 조회
  const { data: rankData } = await supabase
    .from('keyword_ranking_daily')
    .select('keyword, rank, checked_at')
    .eq('product_id', productId.toString())
    .order('checked_at', { ascending: false });

  const latestRankMap = new Map<string, number>();
  for (const r of rankData ?? []) {
    const kwLower = (r.keyword as string).toLowerCase();
    if (!latestRankMap.has(kwLower) && r.rank != null) {
      latestRankMap.set(kwLower, r.rank as number);
    }
  }

  // 기여도 조회
  const { data: contribData } = await supabase
    .from('keyword_candidates')
    .select('keyword, contribution_score')
    .eq('product_id', productId)
    .gt('contribution_score', 0);

  const contribMap = new Map<string, number>();
  for (const c of contribData ?? []) {
    contribMap.set(
      (c.keyword as string).toLowerCase(),
      c.contribution_score as number
    );
  }

  // 매핑 맵
  const mappingMap = new Map(
    mappings.map((m: MappingPartial) => [m.keyword_id, m])
  );

  // 점수 계산 함수
  function rankToScore(rank: number | null): number {
    if (rank === null) return 10;
    if (rank <= 10) return 100;
    if (rank <= 40) return 80;
    if (rank <= 100) return 60;
    if (rank <= 500) return 40;
    return 20;
  }

  return keywords.map((k: KeywordRow) => {
    const m = mappingMap.get(k.id);
    const kwLower = k.keyword.toLowerCase();
    const latestRank = latestRankMap.get(kwLower) ?? null;
    const contrib = contribMap.get(kwLower) ?? 0;
    const rankScore = rankToScore(latestRank);
    const salesScore = Math.min(100, Math.max(0, contrib));
    const priorityScore = rankScore * 0.5 + salesScore * 0.5;

    return {
      keywordId: k.id,
      keyword: k.keyword,
      keywordType: k.keyword_type,
      colorClass: k.color_class,
      placement: m?.placement ?? 'none',
      priority: m?.priority ?? 0,
      monthlyTotalSearch: k.monthly_total_search,
      competitionIndex: k.competition_index,
      latestRank,
      contributionScore: contrib,
      priorityScore,
    };
  }).sort((a: MappedKeywordWithMetrics, b: MappedKeywordWithMetrics) =>
    b.priorityScore - a.priorityScore
  );
}

// ============================================
// 후보 키워드 (개선용)
// ============================================

/**
 * 상품별 후보 키워드 조회 (approved + pending)
 */
export async function fetchCandidatesForImprove(
  productId: number
): Promise<CandidateKeywordForImprove[]> {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from('keyword_candidates')
    .select('*')
    .eq('product_id', productId)
    .in('approval_status', ['pending', 'approved'])
    .order('candidate_score', { ascending: false });

  if (error || !data?.length) return [];

  return data.map((row) => ({
    id: row.id as number,
    keyword: row.keyword as string,
    source: row.source as string,
    monthlySearchVolume: row.monthly_search_volume as number,
    competitionIndex: row.competition_index as CompetitionIndex | null,
    candidateScore: row.candidate_score as number,
    status: row.status as string,
    approvalStatus: row.approval_status as string,
    bestRank: row.best_rank as number | null,
    contributionScore: row.contribution_score as number,
  }));
}

// ============================================
// 상품명 분석 정보
// ============================================

/** 현재 상품명의 토큰 + 키워드 매칭 현황 */
export interface ProductNameAnalysis {
  productName: string;
  charCount: number;
  tokens: string[];
  mappedTokenCount: number;
  unmappedTokens: string[];
  score: number | null;
}

/**
 * 상품명 분석 (토큰화 + 매핑률)
 */
export async function analyzeProductName(
  productId: number
): Promise<ProductNameAnalysis | null> {
  const supabase = createServerSupabase();

  const { data: product } = await supabase
    .from('products')
    .select('product_name')
    .eq('id', productId)
    .single();

  if (!product) return null;

  const productName = product.product_name as string;
  // 간단 토큰화 (공백 기준)
  const tokens = productName.split(/\s+/).filter(Boolean);

  // 매핑된 키워드 목록
  const mapped = await fetchMappedKeywordsWithMetrics(productId);
  const mappedKeywords = new Set(mapped.map((m) => m.keyword.toLowerCase()));

  // 토큰 중 키워드에 해당하는 것 찾기
  const unmappedTokens = tokens.filter(
    (t) => !mappedKeywords.has(t.toLowerCase())
  );

  return {
    productName,
    charCount: productName.length,
    tokens,
    mappedTokenCount: tokens.length - unmappedTokens.length,
    unmappedTokens,
    score: null,
  };
}
