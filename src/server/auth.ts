import type { User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '../lib/supabase/server';
import { ApiError } from './http';

export async function requireUser(): Promise<User> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'Account services are not configured yet.');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
  return data.user;
}

export function normalizeUsername(value: string) {
  return value.trim().normalize('NFKC').toLowerCase();
}

export function validateUsername(value: string) {
  const normalized = normalizeUsername(value);
  return /^[a-z0-9_]{3,24}$/.test(normalized) ? normalized : null;
}

export function displayNameForUser(user: User, fallback: string) {
  const metadataName = user.user_metadata?.display_name ?? user.user_metadata?.full_name;
  return typeof metadataName === 'string' && metadataName.trim() ? metadataName.trim().slice(0, 48) : fallback;
}
