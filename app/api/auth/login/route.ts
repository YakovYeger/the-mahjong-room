import { type NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '../../../../src/lib/supabase/admin';
import { createSupabaseServerClient } from '../../../../src/lib/supabase/server';
import { ApiError, handleApiError, noStoreJson, readJson, requestSubject } from '../../../../src/server/http';
import { enforceRateLimit } from '../../../../src/server/rate-limit';
import { normalizeUsername } from '../../../../src/server/auth';

export const dynamic = 'force-dynamic';
const genericMessage = 'The login details were not recognized.';

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request) as Record<string, unknown>;
    const identifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!identifier || !password) throw new ApiError(400, 'INVALID_CREDENTIALS', genericMessage);
    await enforceRateLimit('login', requestSubject(request, identifier), 10, 900);
    const admin = createSupabaseAdminClient();
    const supabase = await createSupabaseServerClient();
    if (!admin || !supabase) throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'Account services are not configured yet.');
    let email = identifier.toLowerCase();
    if (!identifier.includes('@')) {
      const { data } = await admin.rpc('resolve_login_identifier', { identifier_value: normalizeUsername(identifier) });
      if (typeof data !== 'string') throw new ApiError(400, 'INVALID_CREDENTIALS', genericMessage);
      email = data;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new ApiError(400, 'INVALID_CREDENTIALS', genericMessage);
    return noStoreJson({ user: { id: data.user.id, email: data.user.email } });
  } catch (error) {
    return handleApiError(error);
  }
}
