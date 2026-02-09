/**
 * @file candidates.ts
 * @description 키워드 후보 관련 쿼리 함수
 * @responsibilities
 * - 승인 대기 중인 후보 목록 조회
 * - 후보 상세 정보 조회
 * - 필터/정렬 조회
 */

import { createServerSupabase } from '@/lib/supabase/client';
import type {
  KeywordCandidateWithProduct,
  ApprovalStatus,
  CandidateSource,
  CompetitionIndex
} from '@/lib/supabase/types';

// ============================================
// 타입 정의
// ============================================

export interface CandidatesFilter {
  approvalStatus?: ApprovalStatus;
  source?: CandidateSource;
  competitionIndex?: CompetitionIndex;
  minSearchVolume?: number;
  maxSearchVolume?: number;
  productId?: number;
}

export interface CandidatesSortOption {
  field: 'candidate_score' | 'monthly_search_volume' | 'category_match_ratio' | 'discovered_at';
  direction: 'asc' | 'desc';
}

export interface PaginationOption {
  page: number;
  pageSize: number;
}

// ============================================
// 승인 대기 후보 조회
// ============================================

/**
 * 승인 대기 중인 키워드 후보 목록 조회
 */
export async function getPendingApprovalCandidates(
  pagination?: PaginationOption,
  sort?: CandidatesSortOption
): Promise<{ data: KeywordCandidateWithProduct[]; total: number }> {
  const supabase = createServerSupabase();

  const sortField = sort?.field ?? 'candidate_score';
  const sortDir = sort?.direction ?? 'desc';
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  // 총 개수 조회
  const { count } = await supabase
    .from('keyword_candidates')
    .select('id', { count: 'exact', head: true })
    .eq('approval_status', 'pending');

  // 데이터 조회 (상품 정보 조인)
  const { data, error } = await supabase
    .from('keyword_candidates')
    .select(`
      *,
      products:product_id (
        product_name,
        store_name
      )
    `)
    .eq('approval_status', 'pending')
    .order(sortField, { ascending: sortDir === 'asc' })
    .range(offset, offset + pageSize - 1);

  if (error) {
    // 테이블이 없는 경우 빈 배열 반환 (마이그레이션 미실행 상태)
    // PGRST205: Supabase schema cache에서 테이블을 찾을 수 없음
    // 42P01: PostgreSQL 테이블 없음 에러
    if (error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('does not exist')) {
      console.warn('keyword_candidates table not found. Run migration 003-keyword-candidates.sql');
      return { data: [], total: 0 };
    }
    console.error('Failed to fetch pending candidates:', error);
    throw error;
  }

  // 데이터 변환
  const candidates: KeywordCandidateWithProduct[] = (data ?? []).map((row) => {
    const product = row.products as { product_name: string; store_name: string | null } | null;
    return {
      ...row,
      product_name: product?.product_name,
      store_name: product?.store_name,
    };
  });

  return {
    data: candidates,
    total: count ?? 0,
  };
}

// ============================================
// 필터 조회
// ============================================

/**
 * 필터 조건으로 키워드 후보 조회
 */
export async function getCandidatesWithFilter(
  filter: CandidatesFilter,
  pagination?: PaginationOption,
  sort?: CandidatesSortOption
): Promise<{ data: KeywordCandidateWithProduct[]; total: number }> {
  const supabase = createServerSupabase();

  const sortField = sort?.field ?? 'candidate_score';
  const sortDir = sort?.direction ?? 'desc';
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  // 기본 쿼리 빌더
  let query = supabase
    .from('keyword_candidates')
    .select(`
      *,
      products:product_id (
        product_name,
        store_name
      )
    `, { count: 'exact' });

  // 필터 적용
  if (filter.approvalStatus) {
    query = query.eq('approval_status', filter.approvalStatus);
  }
  if (filter.source) {
    query = query.eq('source', filter.source);
  }
  if (filter.competitionIndex) {
    query = query.eq('competition_index', filter.competitionIndex);
  }
  if (filter.minSearchVolume !== undefined) {
    query = query.gte('monthly_search_volume', filter.minSearchVolume);
  }
  if (filter.maxSearchVolume !== undefined) {
    query = query.lte('monthly_search_volume', filter.maxSearchVolume);
  }
  if (filter.productId) {
    query = query.eq('product_id', filter.productId);
  }

  // 정렬 및 페이지네이션
  const { data, count, error } = await query
    .order(sortField, { ascending: sortDir === 'asc' })
    .range(offset, offset + pageSize - 1);

  if (error) {
    console.error('Failed to fetch candidates with filter:', error);
    throw error;
  }

  // 데이터 변환
  const candidates: KeywordCandidateWithProduct[] = (data ?? []).map((row) => {
    const product = row.products as { product_name: string; store_name: string | null } | null;
    return {
      ...row,
      product_name: product?.product_name,
      store_name: product?.store_name,
    };
  });

  return {
    data: candidates,
    total: count ?? 0,
  };
}

// ============================================
// 단일 후보 조회
// ============================================

/**
 * ID로 키워드 후보 조회
 */
export async function getCandidateById(
  id: number
): Promise<KeywordCandidateWithProduct | null> {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from('keyword_candidates')
    .select(`
      *,
      products:product_id (
        product_name,
        store_name
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Failed to fetch candidate:', error);
    throw error;
  }

  const product = data.products as { product_name: string; store_name: string | null } | null;
  return {
    ...data,
    product_name: product?.product_name,
    store_name: product?.store_name,
  };
}

// ============================================
// 통계 조회
// ============================================

export interface CandidateStats {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  bySource: {
    product_name: number;
    search_ad: number;
    competitor: number;
  };
}

const EMPTY_STATS: CandidateStats = {
  totalPending: 0,
  totalApproved: 0,
  totalRejected: 0,
  bySource: {
    product_name: 0,
    search_ad: 0,
    competitor: 0,
  },
};

/**
 * 키워드 후보 통계 조회
 */
export async function getCandidateStats(): Promise<CandidateStats> {
  const supabase = createServerSupabase();

  // 승인 상태별 개수
  const [pendingResult, approvedResult, rejectedResult] = await Promise.all([
    supabase
      .from('keyword_candidates')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'pending'),
    supabase
      .from('keyword_candidates')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'approved'),
    supabase
      .from('keyword_candidates')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'rejected'),
  ]);

  // 테이블이 없는 경우 빈 통계 반환
  // PGRST205: Supabase schema cache에서 테이블을 찾을 수 없음
  if (pendingResult.error?.code === 'PGRST205' || pendingResult.error?.code === '42P01' || pendingResult.error?.message?.includes('does not exist')) {
    console.warn('keyword_candidates table not found. Run migration 003-keyword-candidates.sql');
    return EMPTY_STATS;
  }

  // 소스별 pending 개수
  const [productNameResult, searchAdResult, competitorResult] = await Promise.all([
    supabase
      .from('keyword_candidates')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'pending')
      .eq('source', 'product_name'),
    supabase
      .from('keyword_candidates')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'pending')
      .eq('source', 'search_ad'),
    supabase
      .from('keyword_candidates')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'pending')
      .eq('source', 'competitor'),
  ]);

  return {
    totalPending: pendingResult.count ?? 0,
    totalApproved: approvedResult.count ?? 0,
    totalRejected: rejectedResult.count ?? 0,
    bySource: {
      product_name: productNameResult.count ?? 0,
      search_ad: searchAdResult.count ?? 0,
      competitor: competitorResult.count ?? 0,
    },
  };
}
