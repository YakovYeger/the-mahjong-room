import type { User } from '@supabase/supabase-js';
import { z } from 'zod';
import { createSupabaseServerClient } from '../lib/supabase/server';
import { ApiError } from './http';

export type AuthenticatedUser = Pick<User, 'id' | 'email' | 'user_metadata'>;
const identitySchema = z.object({ sub: z.uuid(), role: z.literal('authenticated'), email: z.string().optional(),
  user_metadata: z.record(z.string(), z.unknown()).optional() });

export async function requireUser(): Promise<AuthenticatedUser> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'Account services are not configured yet.');
  // The SDK verifies signature and expiry. Asymmetric keys use its JWKS cache;
  // symmetric projects fall back to Auth verification. Never trust getSession alone.
  const { data, error } = await supabase.auth.getClaims();
  const identity = identitySchema.safeParse(data?.claims);
  if (error || !identity.success) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
  return { id: identity.data.sub, email: identity.data.email, user_metadata: identity.data.user_metadata ?? {} };
}

export function normalizeUsername(value: string) {
  return value.trim().normalize('NFKC').toLowerCase();
}

export function validateUsername(value: string) {
  const normalized = normalizeUsername(value);
  return /^[a-z0-9_]{3,24}$/.test(normalized) ? normalized : null;
}

export function displayNameForUser(user: AuthenticatedUser, fallback: string) {
  const metadataName = user.user_metadata?.display_name ?? user.user_metadata?.full_name;
  return typeof metadataName === 'string' && metadataName.trim() ? metadataName.trim().slice(0, 48) : fallback;
}
