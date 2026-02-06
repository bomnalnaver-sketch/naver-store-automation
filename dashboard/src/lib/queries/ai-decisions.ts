/**
 * @file ai-decisions.ts
 * @description AI 의사결정 데이터 조회
 */

import { createServerSupabase } from '@/lib/supabase/client';
import type { AiDecisionRow, AiDecisionResultRow } from '@/lib/supabase/types';

/** AI 의사결정 목록 */
export async function fetchAiDecisions(limit = 50): Promise<AiDecisionRow[]> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from('ai_decisions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** AI 의사결정 상세 */
export async function fetchAiDecisionById(id: number): Promise<AiDecisionRow | null> {
  const supabase = createServerSupabase();
  const { data } = await supabase.from('ai_decisions').select('*').eq('id', id).single();
  return data;
}

/** 의사결정 결과 목록 */
export async function fetchAiDecisionResults(decisionId: number): Promise<AiDecisionResultRow[]> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from('ai_decision_results')
    .select('*')
    .eq('decision_id', decisionId)
    .order('created_at');
  return data ?? [];
}

/** 토큰 사용량 (최근 30일 일별) */
export async function fetchTokenUsage(): Promise<{ date: string; tokens: number }[]> {
  const supabase = createServerSupabase();
  const startDate = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  const { data } = await supabase
    .from('ai_decisions')
    .select('created_at, tokens_used')
    .gte('created_at', `${startDate}T00:00:00`)
    .order('created_at');

  const dateMap = new Map<string, number>();
  for (const row of data ?? []) {
    const date = row.created_at.slice(0, 10);
    dateMap.set(date, (dateMap.get(date) ?? 0) + (row.tokens_used ?? 0));
  }

  return Array.from(dateMap.entries()).map(([date, tokens]) => ({ date, tokens }));
}
