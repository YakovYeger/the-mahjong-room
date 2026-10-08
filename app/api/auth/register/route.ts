import { type NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '../../../../src/lib/supabase/admin';
import { createSupabaseServerClient } from '../../../../src/lib/supabase/server';
import { ApiError, handleApiError, noStoreJson, readJson, requestSubject } from '../../../../src/server/http';
import { enforceRateLimit } from '../../../../src/server/rate-limit';
import { validateUsername } from '../../../../src/server/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request) as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const username = typeof body.username === 'string' ? validateUsername(body.username) : null;
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || !username) {
      throw new ApiError(400, 'INVALID_REGISTRATION', 'Use a valid email, an 8+ character password, and a 3–24 character username.');
    }
    await enforceRateLimit('register', requestSubject(request, email), 5, 900);
    const admin = createSupabaseAdminClient();
    const supabase = await createSupabaseServerClient();
    if (!admin || !supabase) throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'Account services are not configured yet.');
    const { data: taken } = await admin.from('profiles').select('user_id').eq('username', username).maybeSingle();
    if (taken) throw new ApiError(409, 'USERNAME_UNAVAILABLE', 'That username is unavailable.');
    const redirectTo = new URL('/auth/confirm', request.nextUrl.origin);
    redirectTo.searchParams.set('next', '/account');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo.toString(), data: { username, display_name: username } },
    });
    if (error) {
      const collision = /username|duplicate|profiles_username/i.test(error.message);
      throw new ApiError(collision ? 409 : 400, collision ? 'USERNAME_UNAVAILABLE' : 'REGISTRATION_FAILED', collision ? 'That username is unavailable.' : 'Unable to create that account.');
    }
    return noStoreJson({ userId: data.user?.id ?? null, signedIn: Boolean(data.session), confirmationRequired: !data.session }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
