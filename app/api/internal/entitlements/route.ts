import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '../../../../src/lib/supabase/admin';
import { ApiError, handleApiError, noStoreJson, readJson } from '../../../../src/server/http';

export const dynamic = 'force-dynamic';

function authorized(request: NextRequest) {
  const expected = process.env.ENTITLEMENT_ADMIN_SECRET ?? '';
  const actual = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!expected || expected.length !== actual.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
  return mismatch === 0;
}

export async function POST(request: NextRequest) {
  try {
    if (!authorized(request)) throw new ApiError(401, 'UNAUTHORIZED', 'Unauthorized.');
    const body = await readJson(request) as Record<string, unknown>;
    const userId = typeof body.userId === 'string' ? body.userId : '';
    const planId = body.planId === 'free' || body.planId === 'plus' || body.planId === 'club' ? body.planId : null;
    const validUntil = body.validUntil === null || typeof body.validUntil === 'string' ? body.validUntil : null;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId) || !planId) throw new ApiError(400, 'INVALID_ENTITLEMENT', 'Provide a user ID and valid plan.');
    const admin = createSupabaseAdminClient();
    if (!admin) throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'Entitlements are not configured.');
    const { error } = await admin.from('user_entitlements').upsert({ user_id: userId, plan_id: planId, source: 'admin', valid_until: validUntil, updated_at: new Date().toISOString() });
    if (error) throw new ApiError(500, 'ENTITLEMENT_UPDATE_FAILED', 'The entitlement could not be updated.');
    return noStoreJson({ userId, planId, validUntil });
  } catch (error) { return handleApiError(error); }
}
