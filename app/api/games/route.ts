import type { NextRequest } from 'next/server';
import { requireUser } from '../../../src/server/auth';
import { createRoom, getEntitlement, listGames } from '../../../src/server/game-service';
import { ApiError, handleApiError, noStoreJson, readJson, requestSubject } from '../../../src/server/http';
import { enforceRateLimit } from '../../../src/server/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();
    const [games, entitlement] = await Promise.all([listGames(user.id), getEntitlement()]);
    return noStoreJson({ games, entitlement });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    await enforceRateLimit('create_game', requestSubject(request, user.id), 12, 3600);
    const body = await readJson(request) as Record<string, unknown>;
    const mode = body.mode === 'async' ? 'async' : body.mode === 'live' ? 'live' : null;
    if (!mode) throw new ApiError(400, 'INVALID_MODE', 'Choose live or async play.');
    const result = await createRoom(user, {
      mode,
      turnSeconds: typeof body.turnSeconds === 'number' ? body.turnSeconds : undefined,
      responseSeconds: typeof body.responseSeconds === 'number' ? body.responseSeconds : undefined,
    });
    return noStoreJson(result, { status: 201 });
  } catch (error) { return handleApiError(error); }
}
