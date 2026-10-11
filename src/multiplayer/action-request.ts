import type { ActionEnvelope } from './types';

// One immediate network retry uses the identical receipt key and payload.
// HTTP errors are returned to the caller; moves are never queued offline.
export async function sendActionRequest(url: string, envelope: ActionEnvelope, request: typeof fetch = fetch): Promise<Response> {
  const body = JSON.stringify(envelope);
  const send = () => request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  try {
    return await send();
  } catch {
    return send();
  }
}
