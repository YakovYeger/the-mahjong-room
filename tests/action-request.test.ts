import { describe, expect, it, vi } from 'vitest';
import { sendActionRequest } from '../src/multiplayer/action-request';

const envelope = { actionId: '86cfac50-30ce-46b4-84ab-dbd68e37d050', expectedStateVersion: 3, action: { type: 'PASS_ON_DISCARD' as const } };

describe('action transport retries', () => {
  it('reuses the exact envelope when the first response is lost', async () => {
    const response = new Response('{}');
    const request = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce(response);
    expect(await sendActionRequest('/actions', envelope, request)).toBe(response);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]).toEqual(request.mock.calls[1]);
  });

  it('does not retry a rejected move or continue retrying offline', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('{}', { status: 409 }));
    expect((await sendActionRequest('/actions', envelope, request)).status).toBe(409);
    expect(request).toHaveBeenCalledTimes(1);
    request.mockReset().mockRejectedValue(new TypeError('offline'));
    await expect(sendActionRequest('/actions', envelope, request)).rejects.toThrow('offline');
    expect(request).toHaveBeenCalledTimes(2);
  });
});
