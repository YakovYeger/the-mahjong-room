import { requireUser } from '../../../../../src/server/auth';
import { getRoom, getSnapshot } from '../../../../../src/server/game-service';
import { handleApiError, noStoreJson } from '../../../../../src/server/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const room = await getRoom(id, user.id);
    if (room.status === 'lobby') return noStoreJson({ room, snapshot: null });
    return noStoreJson({ room, snapshot: await getSnapshot(id, user.id) });
  } catch (error) { return handleApiError(error); }
}
