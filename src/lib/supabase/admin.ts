import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let adminClient: SupabaseClient<Database> | null = null;

export function createSupabaseAdminClient(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) return null;
  if (!adminClient) {
    adminClient = createClient<Database>(url, secretKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { headers: { 'X-Client-Info': 'mahjong-room-authoritative-service' } },
    });
  }
  return adminClient;
}
