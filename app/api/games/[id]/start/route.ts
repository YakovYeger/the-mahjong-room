import { requireUser } from '../../../../../src/server/auth';
import { startRoom } from '../../../../../src/server/game-service';
import { handleApiError, noStoreJson } from '../../../../../src/server/http';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    return noStoreJson({ snapshot: await startRoom(id, user.id) });
  } catch (error) { return handleApiError(error); }
}
