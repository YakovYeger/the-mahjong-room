import { requireUser } from '../../../../../src/server/auth';
import { heartbeatPlayer } from '../../../../../src/server/game-service';
import { handleApiError, noStoreJson } from '../../../../../src/server/http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    return noStoreJson({ room: await heartbeatPlayer(id, user.id) });
  } catch (error) { return handleApiError(error); }
}
