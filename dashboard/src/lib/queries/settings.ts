/**
 * @file settings.ts
 * @description 설정 데이터 조회
 */

import { createServerSupabase } from '@/lib/supabase/client';
import type { SettingRow, RedundantKeywordDictRow } from '@/lib/supabase/types';

/** 전체 설정 목록 */
export async function fetchSettings(): Promise<SettingRow[]> {
  const supabase = createServerSupabase();
  const { data } = await supabase.from('settings').select('*').order('key');
  return data ?? [];
}

/** 불필요 키워드 사전 */
export async function fetchRedundantKeywords(): Promise<RedundantKeywordDictRow[]> {
  const supabase = createServerSupabase();
  const { data } = await supabase.from('redundant_keywords_dict').select('*').order('keyword');
  return data ?? [];
}
