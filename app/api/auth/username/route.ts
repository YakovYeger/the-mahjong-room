import { type NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '../../../../src/lib/supabase/admin';
import { requireUser, validateUsername } from '../../../../src/server/auth';
import { ApiError, handleApiError, noStoreJson, readJson, requestSubject } from '../../../../src/server/http';
import { enforceRateLimit } from '../../../../src/server/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const username = validateUsername(request.nextUrl.searchParams.get('value') ?? '');
    if (!username) throw new ApiError(400, 'INVALID_USERNAME', 'Use 3–24 letters, numbers, or underscores.');
    await enforceRateLimit('username_check', requestSubject(request, username), 20, 900);
    const admin = createSupabaseAdminClient();
    if (!admin) throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'Account services are not configured yet.');
    const { data, error } = await admin.from('profiles').select('user_id').eq('username', username).maybeSingle();
    if (error) throw new ApiError(503, 'USERNAME_CHECK_UNAVAILABLE', 'Username availability could not be checked.');
    return noStoreJson({ username, available: !data });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request) as Record<string, unknown>;
    const username = typeof body.username === 'string' ? validateUsername(body.username) : null;
    if (!username) throw new ApiError(400, 'INVALID_USERNAME', 'Use 3–24 letters, numbers, or underscores.');
    await enforceRateLimit('username', requestSubject(request, username), 10, 900);
    const admin = createSupabaseAdminClient();
    if (!admin) throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'Account services are not configured yet.');
    const user = await requireUser();
    const { data, error } = await admin.rpc('claim_username_for_user', { requesting_user_id: user.id, requested_username: username });
    if (error) throw new ApiError(409, 'USERNAME_UNAVAILABLE', 'That username is unavailable.');
    return noStoreJson({ profile: data });
  } catch (error) {
    return handleApiError(error);
  }
}
