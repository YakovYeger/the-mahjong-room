import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../src/lib/supabase/admin';
import { requireUser } from '../../../../../src/server/auth';
import { ApiError, handleApiError, noStoreJson, readJson } from '../../../../../src/server/http';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const body = await readJson(request) as Record<string, unknown>;
    const vote = body.vote === 'pause' || body.vote === 'resume' ? body.vote : null;
    if (!vote) throw new ApiError(400, 'INVALID_PAUSE_VOTE', 'Vote to pause or resume.');
    const { id } = await context.params;
    const admin = createSupabaseAdminClient();
    if (!admin) throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'Cloud games are not configured yet.');
    const { data, error } = await admin.rpc('cast_pause_vote', { requested_game_id: id, voting_user_id: user.id, requested_vote: vote });
    if (error) {
      if (error.message.includes('ASYNC_CANNOT_PAUSE')) throw new ApiError(409, 'ASYNC_CANNOT_PAUSE', 'Async games do not need pausing.');
      if (error.message.includes('NOT_A_PARTICIPANT')) throw new ApiError(403, 'NOT_A_PARTICIPANT', 'You are not a current player.');
      throw new ApiError(409, 'PAUSE_VOTE_FAILED', 'That pause vote cannot be applied now.');
    }
    return noStoreJson(data);
  } catch (error) { return handleApiError(error); }
}
