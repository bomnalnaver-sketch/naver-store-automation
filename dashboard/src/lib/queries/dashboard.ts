/**
 * @file dashboard.ts
 * @description 메인 대시보드 데이터 조회 함수
 * @responsibilities
 * - KPI 수치 조회
 * - 최근 알림 목록 조회
 * - API 예산 현황 조회
 * - 일일 성과 트렌드 조회
 */

import { createServerSupabase } from '@/lib/supabase/client';
import type { KeywordRankingAlertRow } from '@/lib/supabase/types';

export interface DashboardKpi {
  totalProducts: number;
  activeKeywords: number;
  avgRoas7d: number | null;
  unreadAlerts: number;
}

/** KPI 카드 데이터 조회 */
export async function fetchDashboardKpi(): Promise<DashboardKpi> {
  const supabase = createServerSupabase();

  const [productsRes, keywordsRes, roasRes, alertsRes] = await Promise.all([
    // 전체 활성 상품 수
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('excluded_from_test', false),

    // 활성 키워드 수
    supabase
      .from('keywords')
      .select('id', { count: 'exact', head: true }),

    // 7일 평균 ROAS
    supabase
      .from('ad_keyword_daily_stats')
      .select('roas')
      .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
      .not('roas', 'is', null),

    // 미확인 알림 수
    supabase
      .from('keyword_ranking_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false),
  ]);

  // 평균 ROAS 계산
  let avgRoas: number | null = null;
  if (roasRes.data && roasRes.data.length > 0) {
    const sum = roasRes.data.reduce((acc, row) => acc + (Number(row.roas) || 0), 0);
    avgRoas = Math.round((sum / roasRes.data.length) * 100) / 100;
  }

  return {
    totalProducts: productsRes.count ?? 0,
    activeKeywords: keywordsRes.count ?? 0,
    avgRoas7d: avgRoas,
    unreadAlerts: alertsRes.count ?? 0,
  };
}

/** 최근 순위 변동 알림 조회 */
export async function fetchRecentAlerts(limit = 10): Promise<KeywordRankingAlertRow[]> {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from('keyword_ranking_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('알림 조회 실패:', error.message);
    return [];
  }

  return data ?? [];
}

export interface DailyTrend {
  date: string;
  totalSales: number;
  totalCost: number;
}

/** 일일 매출/비용 트렌드 (30일) */
export async function fetchDailyTrends(days = 30): Promise<DailyTrend[]> {
  const supabase = createServerSupabase();
  const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  const [salesRes, costRes] = await Promise.all([
    supabase
      .from('product_daily_stats')
      .select('date, sales')
      .gte('date', startDate)
      .order('date', { ascending: true }),

    supabase
      .from('ad_keyword_daily_stats')
      .select('date, cost')
      .gte('date', startDate)
      .order('date', { ascending: true }),
  ]);

  // 날짜별 집계
  const dateMap = new Map<string, DailyTrend>();

  for (const row of salesRes.data ?? []) {
    const existing = dateMap.get(row.date) ?? { date: row.date, totalSales: 0, totalCost: 0 };
    existing.totalSales += Number(row.sales) || 0;
    dateMap.set(row.date, existing);
  }

  for (const row of costRes.data ?? []) {
    const existing = dateMap.get(row.date) ?? { date: row.date, totalSales: 0, totalCost: 0 };
    existing.totalCost += Number(row.cost) || 0;
    dateMap.set(row.date, existing);
  }

  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export interface ApiBudgetStatus {
  total: { used: number; limit: number };
  ranking: { used: number; limit: number };
  colorAnalysis: { used: number; limit: number };
}

/** API 예산 현황 조회 (settings 테이블에서) */
export async function fetchApiBudgetStatus(): Promise<ApiBudgetStatus> {
  const supabase = createServerSupabase();
  const today = new Date().toISOString().split('T')[0];

  const [settingsRes, usageRes] = await Promise.all([
    supabase
      .from('settings')
      .select('key, value')
      .in('key', ['shopping_api_daily_budget', 'ranking_api_budget', 'color_analysis_api_budget']),

    // 오늘 사용량: 순위 추적 API 호출 수
    supabase
      .from('keyword_ranking_daily')
      .select('api_calls')
      .gte('checked_at', `${today}T00:00:00`),
  ]);

  const settings = new Map<string, number>();
  for (const row of settingsRes.data ?? []) {
    settings.set(row.key, Number(row.value) || 0);
  }

  const totalApiUsed = (usageRes.data ?? []).reduce(
    (acc, r) => acc + (Number(r.api_calls) || 0),
    0
  );

  const totalLimit = settings.get('shopping_api_daily_budget') ?? 25000;
  const rankingLimit = settings.get('ranking_api_budget') ?? 15000;
  const colorLimit = settings.get('color_analysis_api_budget') ?? 5000;

  return {
    total: { used: totalApiUsed, limit: totalLimit },
    ranking: { used: Math.min(totalApiUsed, rankingLimit), limit: rankingLimit },
    colorAnalysis: { used: 0, limit: colorLimit },
  };
}
