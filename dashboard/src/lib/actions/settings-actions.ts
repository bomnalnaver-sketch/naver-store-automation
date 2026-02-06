/**
 * @file settings-actions.ts
 * @description 설정 관련 Server Actions
 */

'use server';

import { createServerSupabase } from '@/lib/supabase/client';
import { revalidatePath } from 'next/cache';

/** 설정값 업데이트 */
export async function updateSetting(key: string, value: string) {
  const supabase = createServerSupabase();
  await supabase.from('settings').update({ value }).eq('key', key);
  revalidatePath('/settings');
}
