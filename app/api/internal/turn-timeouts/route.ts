import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '../../../../src/lib/supabase/admin';
import { submitTimeoutAction } from '../../../../src/server/game-service';
import { ApiError, handleApiError, noStoreJson } from '../../../../src/server/http';
import { dispatchPendingTurnEmails } from '../../../../src/server/turn-email';

export const dynamic = 'force-dynamic';

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

export async function POST(request: NextRequest) {
  try {
    const expected = process.env.TURN_TIMEOUT_SECRET;
    const received = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    if (!expected || !constantTimeEqual(received, expected)) throw new ApiError(401, 'INVALID_WORKER_SECRET', 'Unauthorized.');
    const admin = createSupabaseAdminClient();
    if (!admin) throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'Cloud games are not configured yet.');
    const workerToken = crypto.randomUUID();
    const { data, error } = await admin.rpc('claim_overdue_games', { worker_token: workerToken, batch_size: 25 });
    if (error) throw new ApiError(500, 'TIMEOUT_CLAIM_FAILED', 'The timeout queue could not be claimed.');
    const results = [];
    for (const game of data ?? []) {
      const result = await submitTimeoutAction(game.game_id, game.state_version);
      results.push({ gameId: game.game_id, processed: Boolean(result) });
    }
    const email = await dispatchPendingTurnEmails(10);
    return noStoreJson({ claimed: results.length, results, email });
  } catch (error) { return handleApiError(error); }
}
