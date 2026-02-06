/**
 * @file keywords.ts
 * @description 키워드 데이터 조회 함수
 */

import { createServerSupabase } from '@/lib/supabase/client';
import type { KeywordRow, KeywordType, ColorClass } from '@/lib/supabase/types';

/** 전체 키워드 목록 */
export async function fetchKeywords(): Promise<KeywordRow[]> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from('keywords')
    .select('*')
    .order('monthly_total_search', { ascending: false });
  return data ?? [];
}

/** 유형별 카운트 */
export async function fetchKeywordTypeCounts(): Promise<Record<KeywordType, number>> {
  const supabase = createServerSupabase();
  const result: Record<KeywordType, number> = {
    composite: 0, integral: 0, order_fixed: 0, synonym: 0, redundant: 0,
  };

  const types: KeywordType[] = ['composite', 'integral', 'order_fixed', 'synonym', 'redundant'];
  const queries = types.map((t) =>
    supabase.from('keywords').select('id', { count: 'exact', head: true }).eq('keyword_type', t)
  );

  const results = await Promise.all(queries);
  types.forEach((t, i) => { result[t] = results[i].count ?? 0; });

  return result;
}

/** 색깔별 카운트 */
export async function fetchColorCounts(): Promise<Record<ColorClass, number>> {
  const supabase = createServerSupabase();
  const result: Record<ColorClass, number> = {
    yellow: 0, gray: 0, green: 0, blue: 0, orange: 0,
  };

  const colors: ColorClass[] = ['yellow', 'gray', 'green', 'blue', 'orange'];
  const queries = colors.map((c) =>
    supabase.from('keywords').select('id', { count: 'exact', head: true }).eq('color_class', c)
  );

  const results = await Promise.all(queries);
  colors.forEach((c, i) => { result[c] = results[i].count ?? 0; });

  return result;
}
