import { clearGuestProgress, loadGuestProgress, mergeProgress } from './guest-progress';
import type { PlayerProgressRow, ProgressSyncResult } from './types';

export async function syncGuestProgress(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  request: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
): Promise<ProgressSyncResult> {
  const guest = loadGuestProgress(storage);
  if (!guest) return { ok: true, message: 'No guest progress needs migration.' };
  const currentResponse = await request('/api/progress', { headers: { accept: 'application/json' } });
  if (currentResponse.status === 401) return { ok: false, message: 'Sign in before saving guest progress.' };
  if (!currentResponse.ok) return { ok: false, message: 'Could not read saved progress.' };
  const current = (await currentResponse.json()) as { progress: PlayerProgressRow | null };
  const merged = mergeProgress(current.progress, guest);
  const saveResponse = await request('/api/progress', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(merged),
  });
  if (!saveResponse.ok) return { ok: false, message: 'Guest progress is still safe on this device; saving failed.' };
  const saved = (await saveResponse.json()) as { progress: PlayerProgressRow };
  clearGuestProgress(storage);
  return { ok: true, progress: saved.progress, message: 'Your guest progress is now saved to your account.' };
}
