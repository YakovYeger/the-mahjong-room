import type { NextRequest } from 'next/server';
import { requireUser } from '../../../../../src/server/auth';
import { isActionEnvelope, submitAction } from '../../../../../src/server/game-service';
import { ApiError, handleApiError, noStoreJson, readJson } from '../../../../../src/server/http';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const envelope = await readJson(request);
    if (!isActionEnvelope(envelope)) throw new ApiError(400, 'INVALID_ACTION', 'Send a valid action envelope.');
    const { id } = await context.params;
    return noStoreJson({ snapshot: await submitAction(id, user.id, envelope) });
  } catch (error) { return handleApiError(error); }
}
