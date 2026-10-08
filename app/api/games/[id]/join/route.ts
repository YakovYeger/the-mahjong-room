import type { NextRequest } from 'next/server';
import { requireUser } from '../../../../../src/server/auth';
import { joinRoom } from '../../../../../src/server/game-service';
import { ApiError, handleApiError, noStoreJson, readJson, requestSubject } from '../../../../../src/server/http';
import { enforceRateLimit } from '../../../../../src/server/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await readJson(request) as Record<string, unknown>;
    const inviteCode = typeof body.inviteCode === 'string' ? body.inviteCode : id;
    if (!inviteCode) throw new ApiError(400, 'INVITE_REQUIRED', 'Enter the room code.');
    await enforceRateLimit('join_game', requestSubject(request, inviteCode), 20, 900);
    return noStoreJson({ game: await joinRoom(user, inviteCode) });
  } catch (error) { return handleApiError(error); }
}
