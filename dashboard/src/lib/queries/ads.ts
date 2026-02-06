/**
 * @file ads.ts
 * @description 광고 키워드 성과 데이터 조회
 */

import { createServerSupabase } from '@/lib/supabase/client';
import type { AdKeywordRow, ProductAbTestRow } from '@/lib/supabase/types';

export interface AdKeywordWithStats extends AdKeywordRow {
  total_impressions: number;
  total_clicks: number;
  total_cost: number;
  total_conversions: number;
  total_sales: number;
  avg_roas: number | null;
}

/** 광고 키워드 + 최근 7일 성과 집계 */
export async function fetchAdKeywordsWithStats(): Promise<AdKeywordWithStats[]> {
  const supabase = createServerSupabase();
  const startDate = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const { data: keywords } = await supabase
    .from('ad_keywords')
    .select('*')
    .order('id');

  if (!keywords || keywords.length === 0) return [];

  const keywordIds = keywords.map((k: AdKeywordRow) => k.id);
  const { data: stats } = await supabase
    .from('ad_keyword_daily_stats')
    .select('keyword_id, impressions, clicks, cost, conversions, sales, roas')
    .in('keyword_id', keywordIds)
    .gte('date', startDate);

  // 키워드별 집계
  const statsMap = new Map<number, { imp: number; clk: number; cost: number; conv: number; sales: number; roasSum: number; roasCount: number }>();
  for (const s of stats ?? []) {
    const existing = statsMap.get(s.keyword_id) ?? { imp: 0, clk: 0, cost: 0, conv: 0, sales: 0, roasSum: 0, roasCount: 0 };
    existing.imp += s.impressions || 0;
    existing.clk += s.clicks || 0;
    existing.cost += s.cost || 0;
    existing.conv += s.conversions || 0;
    existing.sales += s.sales || 0;
    if (s.roas != null) { existing.roasSum += Number(s.roas); existing.roasCount++; }
    statsMap.set(s.keyword_id, existing);
  }

  return keywords.map((k: AdKeywordRow) => {
    const s = statsMap.get(k.id);
    return {
      ...k,
      total_impressions: s?.imp ?? 0,
      total_clicks: s?.clk ?? 0,
      total_cost: s?.cost ?? 0,
      total_conversions: s?.conv ?? 0,
      total_sales: s?.sales ?? 0,
      avg_roas: s && s.roasCount > 0 ? Math.round((s.roasSum / s.roasCount) * 100) / 100 : null,
    };
  });
}

/** A/B 테스트 목록 */
export async function fetchAbTests(): Promise<ProductAbTestRow[]> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from('product_ab_tests')
    .select('*')
    .order('created_at', { ascending: false });
  return data ?? [];
}
