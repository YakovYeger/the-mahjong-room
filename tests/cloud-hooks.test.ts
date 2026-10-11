// @vitest-environment jsdom
import { createElement, StrictMode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudQueryProvider } from '../src/multiplayer/cloud-query-provider';
import { useCloudTable } from '../src/multiplayer/use-cloud-table';
import { useCloudGames } from '../src/multiplayer/use-cloud-games';
import { tableKey } from '../src/multiplayer/table-query';
import { snapshotForPlayer } from '../src/multiplayer/projections';
import { cloudAuthority, cloudFixture } from './helpers/cloud-table';

const auth = vi.hoisted(() => ({ userId: 'alice', listeners: new Set<(event: string, session: { user: { id: string } } | null) => void>(), channels: [] as Array<{ broadcast: (payload: { payload: { stateVersion: number } }) => void; status: (status: string) => void }> }));
vi.mock('../src/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({
  auth: {
    getSession: async () => ({ data: { session: auth.userId ? { user: { id: auth.userId } } : null } }),
    onAuthStateChange: (callback: (event: string, session: { user: { id: string } } | null) => void) => {
      auth.listeners.add(callback); return { data: { subscription: { unsubscribe: () => auth.listeners.delete(callback) } } };
    },
  },
  channel: () => {
    const callbacks = { broadcast: (_payload: { payload: { stateVersion: number } }) => { void _payload; }, status: (_status: string) => { void _status; } };
    auth.channels.push(callbacks);
    const channel = {
      on: (event: string, _filter: unknown, callback: typeof callbacks.broadcast) => { if (event === 'broadcast') callbacks.broadcast = callback; return channel; },
      subscribe: (callback: (status: string) => void) => { callbacks.status = callback; queueMicrotask(() => callback('SUBSCRIBED')); return channel; },
      track: async () => {}, presenceState: () => ({ alice: [] }),
    };
    return channel;
  }, removeChannel: async () => {},
}) }));

function session(userId: string) {
  auth.userId = userId;
  auth.listeners.forEach((callback) => callback(userId ? 'SIGNED_IN' : 'SIGNED_OUT', userId ? { user: { id: userId } } : null));
}
const wrapper = ({ children }: { children: React.ReactNode }) => createElement(CloudQueryProvider, null, children);
beforeEach(() => { auth.userId = 'alice'; auth.channels.length = 0; onlineManager.setOnline(true); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); onlineManager.setOnline(true); auth.listeners.clear(); });

describe('mounted cloud integration', () => {
  it('subscribes in a version-zero lobby and receives the game start immediately', async () => {
    const fixture = cloudFixture();
    let data = { ...fixture.data, snapshot: null, stateVersion: 0, room: { ...fixture.data.room, status: 'lobby' as const } } as typeof fixture.data;
    vi.stubGlobal('fetch', async () => Response.json(data));
    const { result } = renderHook(() => useCloudTable('room'), { wrapper });
    await waitFor(() => expect(result.current.data?.room.status).toBe('lobby'));
    await waitFor(() => expect(auth.channels).toHaveLength(1));
    data = { ...fixture.data, updatedAt: '2026-10-09T10:00:01Z' };
    await act(async () => { auth.channels[0].broadcast({ payload: { stateVersion: data.stateVersion } }); });
    await waitFor(() => expect(result.current.data?.snapshot?.status).toBe('active'));
  });

  it('keeps the game list available when the turn inbox fails and rejects offline room writes', async () => {
    const fixture = cloudFixture();
    const request = vi.fn<typeof fetch>().mockImplementation(async (input) => String(input).endsWith('/notifications')
      ? Response.json({ error: { code: 'UNAVAILABLE' } }, { status: 503 })
      : Response.json({ games: [{ id: 'room', ownerId: 'alice', status: 'lobby', mode: 'live', stateVersion: 0, deadlineAt: null,
        updatedAt: fixture.data.updatedAt, playerCount: 1, humanCount: 1, isMine: true }],
      entitlement: { planId: 'free', name: 'Free', activeGameLimit: 1 } }));
    vi.stubGlobal('fetch', request);
    const { result } = renderHook(() => useCloudGames(), { wrapper });
    await waitFor(() => expect(result.current.games).toHaveLength(1));
    expect(result.current.games[0].stateVersion).toBe(0);
    onlineManager.setOnline(false);
    await act(async () => { await expect(result.current.mutate({ path: '/api/games' })).rejects.toMatchObject({ code: 'OFFLINE' }); });
    expect(request.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
    expect(result.current.games).toHaveLength(1);
  });

  it('updates the table after a real rules move without recreating the realtime subscription', async () => {
    const server = cloudAuthority(); vi.stubGlobal('fetch', server.request);
    const { result } = renderHook(() => useCloudTable('room'), { wrapper });
    await waitFor(() => expect(result.current.data?.snapshot?.privateState.playerId).toBe('alice'));
    await waitFor(() => expect(auth.channels).toHaveLength(1));
    await act(async () => { await result.current.submit(server.action); });
    expect(result.current.data?.stateVersion).toBe(server.data.stateVersion);
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(auth.channels).toHaveLength(1);
    await act(async () => { auth.channels[0].status('SUBSCRIBED'); });
    await waitFor(() => expect(server.requests.filter((row) => row.path.endsWith('/snapshot')).length).toBeGreaterThan(1));
  });

  it('handles same-version pause broadcasts and missed updates on reconnect', async () => {
    const fixture = cloudFixture(); let data = fixture.data;
    vi.stubGlobal('fetch', async (input: string) => Response.json(String(input).endsWith('/heartbeat') ? { room: data.room } : data));
    const { result } = renderHook(() => useCloudTable('room'), { wrapper });
    await waitFor(() => expect(result.current.data?.snapshot?.status).toBe('active'));
    const paused = structuredClone(data); paused.room.status = 'paused'; paused.snapshot!.status = 'paused'; paused.updatedAt = '2026-10-09T10:00:01Z'; data = paused;
    await act(async () => { auth.channels[0].broadcast({ payload: { stateVersion: data.stateVersion } }); });
    await waitFor(() => expect(result.current.data?.snapshot?.status).toBe('paused'));
    const resumed = structuredClone(data); resumed.room.status = 'active'; resumed.snapshot!.status = 'active'; resumed.updatedAt = '2026-10-09T10:00:02Z'; data = resumed;
    await act(async () => { auth.channels[0].status('SUBSCRIBED'); });
    await waitFor(() => expect(result.current.data?.snapshot?.status).toBe('active'));
  });

  it('clears the old account cache on logout and cancels its late private response', async () => {
    const fixture = cloudFixture(); let finish!: (response: Response) => void;
    const request = vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    vi.stubGlobal('fetch', request);
    const { result } = renderHook(() => ({ cloud: useCloudTable('room'), client: useQueryClient() }), { wrapper });
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    const previous = result.current.client;
    await act(async () => { session(''); });
    await act(async () => { finish(Response.json(fixture.data)); });
    expect(result.current.cloud.signedOut).toBe(true);
    expect(result.current.cloud.data).toBeUndefined();
    expect(previous.getQueryData(tableKey('alice', 'room'))).toBeUndefined();
    expect(previous.getQueryCache().getAll()).toHaveLength(0);
  });

  it('keeps a new account rack separate after an account switch', async () => {
    const fixture = cloudFixture();
    vi.stubGlobal('fetch', async (input: string) => {
      const data = { ...fixture.data, snapshot: snapshotForPlayer(fixture.state, auth.userId, 'active', 'live', null, fixture.state.events) };
      return Response.json(String(input).endsWith('/heartbeat') ? { room: data.room } : data);
    });
    const { result } = renderHook(() => useCloudTable('room'), { wrapper });
    await waitFor(() => expect(result.current.data?.snapshot?.privateState.playerId).toBe('alice'));
    await act(async () => { session('bea'); });
    await waitFor(() => expect(result.current.data?.snapshot?.privateState.playerId).toBe('bea'));
    expect(result.current.data?.snapshot?.privateState.rack.map((tile) => tile.id)).toEqual(fixture.state.players[1].rack.map((tile) => tile.id));
  });

  it('remains usable under React StrictMode setup/cleanup replay', async () => {
    const server = cloudAuthority(); vi.stubGlobal('fetch', server.request);
    const strictWrapper = ({ children }: { children: React.ReactNode }) => createElement(StrictMode, null, createElement(CloudQueryProvider, null, children));
    const { result } = renderHook(() => useCloudTable('room'), { wrapper: strictWrapper });
    await waitFor(() => expect(result.current.data?.snapshot?.privateState.playerId).toBe('alice'));
    await act(async () => { await result.current.submit(server.action); });
    expect(result.current.data?.snapshot?.privateState.pendingAction).toBe('wait');
  });
});
