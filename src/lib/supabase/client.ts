import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

declare global {
  interface Window {
    __MAHJONG_RUNTIME_CONFIG__?: {
      supabaseUrl?: string;
      supabasePublishableKey?: string;
    };
  }
}

export function createSupabaseBrowserClient() {
  const runtimeConfig = typeof window === 'undefined' ? undefined : window.__MAHJONG_RUNTIME_CONFIG__;
  const url = runtimeConfig?.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = runtimeConfig?.supabasePublishableKey ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  return createBrowserClient<Database>(url, publishableKey);
}
