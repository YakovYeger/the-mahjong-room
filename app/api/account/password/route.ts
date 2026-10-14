import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { assertAccountOrigin, verifiedAccount } from '../../../../src/server/account';
import { ApiError, handleApiError, noStoreJson, readJson } from '../../../../src/server/http';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    assertAccountOrigin(request);
    const body = z.object({ newPassword: z.string().min(8).max(128), currentPassword: z.string().max(128).optional() }).strict().safeParse(await readJson(request));
    if (!body.success) throw new ApiError(400, 'INVALID_PASSWORD', 'Use a password of 8–128 characters.');
    const { supabase } = await verifiedAccount('password', body.data.currentPassword);
    const { error } = await supabase.auth.updateUser({ password: body.data.newPassword });
    if (error) throw new ApiError(400, 'PASSWORD_UPDATE_FAILED', 'Your password could not be updated. Try a different password or request a new recovery link.');
    const logout = await supabase.auth.signOut({ scope: 'global' });
    if (logout.error) throw new ApiError(503, 'SIGNOUT_FAILED', 'Your password changed, but sessions could not be closed. Sign out and retry signing out on all devices.');
    return noStoreJson({ message: 'Password updated. Sign in again with your new password.' });
  } catch (error) { return handleApiError(error); }
}
