import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '../../../src/server/auth';
import { createSupabaseAdminClient } from '../../../src/lib/supabase/admin';
import { createSupabaseServerClient } from '../../../src/lib/supabase/server';
import { assertAccountOrigin } from '../../../src/server/account';
import { ApiError, handleApiError, noStoreJson, readJson } from '../../../src/server/http';
import { enforceRateLimit } from '../../../src/server/rate-limit';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const identity = await requireUser();
    const admin = createSupabaseAdminClient();
    const supabase = await createSupabaseServerClient();
    if (!admin || !supabase) throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'Account services are not configured yet.');
    const [profile, auth] = await Promise.all([
      admin.from('profiles').select('display_name,username,created_at').eq('user_id', identity.id).single(),
      supabase.auth.getUser(),
    ]);
    if (auth.error || !auth.data.user || auth.data.user.id !== identity.id) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
    if (profile.error) throw new ApiError(503, 'PROFILE_UNAVAILABLE', 'Your profile could not be loaded.');
    return noStoreJson({ profile: profile.data, email: auth.data.user.email,
      providers: auth.data.user.identities?.map(item => item.provider) ?? [] });
  } catch (error) { return handleApiError(error); }
}
export async function POST(request: NextRequest) {
  try {
    assertAccountOrigin(request);
    const user = await requireUser();
    await enforceRateLimit('account_profile', user.id, 20, 900);
    const body = z.object({ displayName: z.string().trim().min(1).max(48).regex(/^[^\u0000-\u001f\u007f]+$/) }).strict().safeParse(await readJson(request));
    if (!body.success) throw new ApiError(400, 'INVALID_PROFILE', 'Use a display name of 1–48 characters.');
    const admin = createSupabaseAdminClient();
    if (!admin) throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'Account services are not configured yet.');
    const { data, error } = await admin.from('profiles').update({ display_name: body.data.displayName, updated_at: new Date().toISOString() }).eq('user_id', user.id).select('display_name').single();
    if (error) throw new ApiError(503, 'PROFILE_SAVE_FAILED', 'Your profile could not be saved.');
    return noStoreJson({ displayName: data.display_name, message: 'Display name saved. New tables will use this name.' });
  } catch (error) { return handleApiError(error); }
}
