/**
 * @file alert-actions.ts
 * @description 알림 읽음 처리 Server Actions
 */

'use server';

import { createServerSupabase } from '@/lib/supabase/client';
import { revalidatePath } from 'next/cache';

/** 단일 알림 읽음 처리 */
export async function markAlertAsRead(alertId: number) {
  const supabase = createServerSupabase();
  await supabase
    .from('keyword_ranking_alerts')
    .update({ is_read: true })
    .eq('id', alertId);
  revalidatePath('/rankings');
}

/** 전체 알림 읽음 처리 */
export async function markAllAlertsAsRead() {
  const supabase = createServerSupabase();
  await supabase
    .from('keyword_ranking_alerts')
    .update({ is_read: true })
    .eq('is_read', false);
  revalidatePath('/rankings');
  revalidatePath('/');
}
