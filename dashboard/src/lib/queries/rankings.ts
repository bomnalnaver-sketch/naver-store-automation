/**
 * @file rankings.ts
 * @description 순위 추적 데이터 조회 함수
 */

import { createServerSupabase } from '@/lib/supabase/client';
import type { KeywordRankingAlertRow, ProductRow } from '@/lib/supabase/types';

/** 최근 순위 알림 조회 */
export async function fetchRankingAlerts(limit = 50): Promise<KeywordRankingAlertRow[]> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from('keyword_ranking_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** 인기도 단계별 상품 그룹 */
export async function fetchProductsByPopularity(): Promise<{
  extreme_early: ProductRow[];
  growth: ProductRow[];
  stable: ProductRow[];
}> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('excluded_from_test', false)
    .order('id');

  const products = data ?? [];
  return {
    extreme_early: products.filter((p: ProductRow) => p.current_popularity_stage === 'extreme_early'),
    growth: products.filter((p: ProductRow) => p.current_popularity_stage === 'growth'),
    stable: products.filter((p: ProductRow) => p.current_popularity_stage === 'stable'),
  };
}

/** 최신 순위 매트릭스 (오늘 기준) */
export async function fetchLatestRankings() {
  const supabase = createServerSupabase();
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('keyword_ranking_daily')
    .select('product_id, keyword, rank')
    .gte('checked_at', `${today}T00:00:00`)
    .order('keyword');

  return data ?? [];
}
