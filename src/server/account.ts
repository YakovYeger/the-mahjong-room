import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '../lib/supabase/admin';
import { createSupabaseServerClient } from '../lib/supabase/server';
import { requireUser } from './auth';
import { ApiError } from './http';
import { enforceRateLimit } from './rate-limit';

export function assertAccountOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if ((origin && origin !== request.nextUrl.origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new ApiError(403, 'INVALID_ORIGIN', 'Open account settings on this site to continue.');
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(415, 'INVALID_CONTENT_TYPE', 'Send a JSON request.');
}

const methodSchema = z.array(z.object({ method: z.string(), timestamp: z.number().int() }));
export function hasRecentAuthentication(amr: unknown, allowRecovery = false, now = Date.now()) {
  const methods = methodSchema.safeParse(amr);
  // Supabase currently records email recovery verification as otp. A fresh
  // verified email proof can reset a password; it cannot authorize deletion.
  const allowed = allowRecovery ? ['password', 'oauth', 'recovery', 'otp'] : ['password', 'oauth'];
  return methods.success && methods.data.some(({ method, timestamp }) =>
    allowed.includes(method) && timestamp <= Math.floor(now / 1000) && timestamp >= Math.floor(now / 1000) - 300);
}

export async function verifiedAccount(action: 'password' | 'delete', currentPassword?: string) {
  const user = await requireUser();
  await enforceRateLimit(`account_${action}`, user.id, 5, 900);
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'Account services are not configured yet.');
  // Re-read the live Auth user; deleted identities cannot use cached claims.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.id !== user.id) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
  if (currentPassword) {
    if (!data.user.email) throw new ApiError(403, 'REAUTH_REQUIRED', 'Sign in again before continuing.');
    const result = await supabase.auth.signInWithPassword({ email: data.user.email, password: currentPassword });
    if (result.error || result.data.user?.id !== user.id) throw new ApiError(403, 'REAUTH_REQUIRED', 'Your current password was not recognized.');
  } else {
    const claims = await supabase.auth.getClaims();
    if (claims.error || claims.data?.claims.sub !== user.id || !hasRecentAuthentication(claims.data.claims.amr, action === 'password')) {
      throw new ApiError(403, 'REAUTH_REQUIRED', 'Enter your current password or sign in again, then retry within five minutes.');
    }
  }
  return { user: data.user, supabase, admin };
}
