/**
 * @file client.ts
 * @description Supabase 클라이언트 생성
 * @responsibilities
 * - Server Component용 Supabase 클라이언트
 * - Client Component용 Supabase 클라이언트
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Server Component에서 사용하는 Supabase 클라이언트 (service_role 키 우선) */
export function createServerSupabase() {
  return createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey);
}

/** Client Component에서 사용하는 Supabase 싱글턴 */
let clientInstance: ReturnType<typeof createClient> | null = null;

export function createBrowserSupabase() {
  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return clientInstance;
}
