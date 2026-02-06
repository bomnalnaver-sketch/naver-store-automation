/**
 * @file products.ts
 * @description 상품 데이터 조회 함수
 */

import { createServerSupabase } from '@/lib/supabase/client';
import type { ProductRow } from '@/lib/supabase/types';

/** 전체 활성 상품 목록 */
export async function fetchProducts(): Promise<ProductRow[]> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('excluded_from_test', false)
    .order('id', { ascending: true });
  return data ?? [];
}

/** 상품 상세 */
export async function fetchProductById(id: number): Promise<ProductRow | null> {
  const supabase = createServerSupabase();
  const { data } = await supabase.from('products').select('*').eq('id', id).single();
  return data;
}

/** 상품에 연결된 키워드 목록 (매핑 + 키워드 정보) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchProductKeywords(productId: number): Promise<any[]> {
  const supabase = createServerSupabase();

  const { data: mappings } = await supabase
    .from('keyword_product_mapping')
    .select('keyword_id, placement, priority')
    .eq('product_id', productId)
    .order('priority', { ascending: true });

  if (!mappings || mappings.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const keywordIds = mappings.map((m: any) => m.keyword_id);
  const { data: keywords } = await supabase
    .from('keywords')
    .select('*')
    .in('id', keywordIds);

  if (!keywords) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mappingMap = new Map(mappings.map((m: any) => [m.keyword_id, m]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return keywords.map((k: any) => {
    const m = mappingMap.get(k.id);
    return { ...k, placement: m?.placement ?? 'none', priority: m?.priority ?? 0 };
  });
}

/** 상품의 키워드별 순위 기록 (최근 30일) */
export async function fetchProductRankings(naverProductId: string) {
  const supabase = createServerSupabase();
  const startDate = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data } = await supabase
    .from('keyword_ranking_daily')
    .select('keyword, rank, checked_at')
    .eq('product_id', naverProductId)
    .gte('checked_at', startDate)
    .order('checked_at', { ascending: true });

  return data ?? [];
}
