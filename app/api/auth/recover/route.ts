import { type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '../../../../src/lib/supabase/server';
import { ApiError, handleApiError, noStoreJson, readJson, requestSubject } from '../../../../src/server/http';
import { enforceRateLimit } from '../../../../src/server/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request) as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    await enforceRateLimit('recovery', requestSubject(request, email), 4, 3600);
    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'Account services are not configured yet.');
    if (/^\S+@\S+\.\S+$/.test(email)) {
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${request.nextUrl.origin}/auth/confirm?next=/account&recovery=1` });
    }
    return noStoreJson({ message: 'If that account exists, a recovery email is on its way.' });
  } catch (error) {
    return handleApiError(error);
  }
}
