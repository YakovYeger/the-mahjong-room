import { afterEach, describe, expect, it, vi } from 'vitest';
import { cloudJson, ContractError, isAccessError, isTransientError } from '../src/multiplayer/cloud-api';

afterEach(() => vi.useRealTimers());

describe('cloud HTTP boundary', () => {
  it('aborts a stalled request at the bounded timeout', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const request: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
      signal = init?.signal ?? undefined;
      signal?.addEventListener('abort', () => reject(signal?.reason), { once: true });
    });
    const outcome = expect(cloudJson('/table', {}, request, 8000)).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(8000);
    await outcome;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('forwards cancellation and removes its timeout', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const request: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    });
    const outcome = expect(cloudJson('/table', { signal: controller.signal }, request)).rejects.toThrow('Left table');
    controller.abort(new Error('Left table'));
    await outcome;
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([403, 502])('preserves HTTP status %i even when a proxy returns HTML', async (status) => {
    const error = await cloudJson('/table', {}, async () => new Response('<html>error</html>', { status })).catch((failure: unknown) => failure);
    expect(error).toMatchObject({ status });
    expect(isAccessError(error)).toBe(status === 403);
    expect(isTransientError(error)).toBe(status === 502);
  });

  it('does not retry a malformed successful read', async () => {
    const error = await cloudJson('/table', {}, async () => new Response('broken')).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(ContractError);
    expect(isTransientError(error)).toBe(false);
  });

  it('keeps table access when a participant has lost human control or host privileges', async () => {
    for (const code of ['SEAT_CONTROLLED_BY_BOT', 'HOST_REQUIRED']) {
      const error = await cloudJson('/table', {}, async () => Response.json({ error: { code } }, { status: 403 })).catch((failure: unknown) => failure);
      expect(isAccessError(error)).toBe(false);
      expect(isTransientError(error)).toBe(false);
    }
  });
});
