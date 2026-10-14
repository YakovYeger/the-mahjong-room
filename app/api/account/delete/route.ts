import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { assertAccountOrigin, verifiedAccount } from '../../../../src/server/account';
import { ApiError, handleApiError, noStoreJson, readJson } from '../../../../src/server/http';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    assertAccountOrigin(request);
    const body = z.object({ confirmation: z.literal('DELETE'), currentPassword: z.string().max(128).optional() }).strict().safeParse(await readJson(request));
    if (!body.success) throw new ApiError(400, 'CONFIRMATION_REQUIRED', 'Type DELETE to confirm account deletion.');
    const { user, supabase, admin } = await verifiedAccount('delete', body.data.currentPassword);
    // The database trigger guards open games and redacts retained history in the
    // same transaction as Auth deletion. Failed deletion leaves the account intact.
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      // Auth masks trigger errors, so classify an open table with an independent
      // service-side read while the actual race-safe check remains in the trigger.
      const { data, error: lookupError } = await admin.from('game_players').select('games!inner(status)').eq('user_id', user.id).in('games.status', ['lobby', 'active', 'paused']).limit(1);
      if (!lookupError && data?.length) throw new ApiError(409, 'ACCOUNT_HAS_OPEN_GAMES', 'Finish your open tables, or ask the host to end them, before deleting your account.');
      throw new ApiError(503, 'ACCOUNT_DELETE_FAILED', 'Your account could not be deleted. It remains available; please try again.');
    }
    await supabase.auth.signOut({ scope: 'local' });
    return noStoreJson({ message: 'Your account has been deleted. You can still play as a guest.' });
  } catch (error) { return handleApiError(error); }
}
