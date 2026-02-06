/**
 * @file keyword-actions.ts
 * @description 불필요 키워드 사전 관리 Server Actions
 */

'use server';

import { createServerSupabase } from '@/lib/supabase/client';
import { revalidatePath } from 'next/cache';

/** 불필요 키워드 추가 */
export async function addRedundantKeyword(keyword: string) {
  const supabase = createServerSupabase();
  await supabase.from('redundant_keywords_dict').insert({ keyword, verified: false });
  revalidatePath('/settings');
}

/** 불필요 키워드 삭제 */
export async function removeRedundantKeyword(id: number) {
  const supabase = createServerSupabase();
  await supabase.from('redundant_keywords_dict').delete().eq('id', id);
  revalidatePath('/settings');
}

/** 검증 상태 토글 */
export async function toggleRedundantKeywordVerified(id: number, verified: boolean) {
  const supabase = createServerSupabase();
  await supabase.from('redundant_keywords_dict').update({ verified }).eq('id', id);
  revalidatePath('/settings');
}
