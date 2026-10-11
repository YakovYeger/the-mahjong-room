import { QueryClient, QueryObserver, onlineManager } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TableQuery, newestTable, tableKey } from '../src/multiplayer/table-query';
import { parseTableData } from '../src/multiplayer/table-schema';
import { cloudAuthority, cloudFixture } from './helpers/cloud-table';

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach((fn) => fn()); onlineManager.setOnline(true); });
function table(request: typeof fetch) {
  const client = new QueryClient();
  const controller = new TableQuery(client, 'alice', 'room', request);
  const observer = new QueryObserver(client, { ...controller.options(), enabled: false });
  const unsubscribe = observer.subscribe(() => undefined);
  cleanups.push(() => { unsubscribe(); controller.dispose(); client.clear(); });
  return controller;
}

describe('TanStack table integration', () => {
  it('bounds failed read retries and rejects invalid responses without retrying', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: { code: 'UNAVAILABLE' } }, { status: 503 }));
    const controller = table(request);
    await expect(controller.client.fetchQuery({ ...controller.options(), retryDelay: 0 })).rejects.toMatchObject({ status: 503 });
    expect(request).toHaveBeenCalledTimes(3);
    request.mockClear().mockResolvedValue(Response.json({ snapshot: 'invalid' }));
    await expect(controller.client.fetchQuery({ ...controller.options(), retryDelay: 0 })).rejects.toThrow('invalid or private');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('keeps terminal tables polling until an uncertain move is confirmed and throttles automatic recovery', async () => {
    const server = cloudAuthority(); const controller = table(server.request);
    await controller.refresh(); server.loseResponses(2);
    await expect(controller.submit(server.action)).rejects.toThrow('Response lost');
    const readsBefore = server.requests.filter((row) => row.path.endsWith('/actions')).length;
    await controller.recover(false);
    expect(server.requests.filter((row) => row.path.endsWith('/actions'))).toHaveLength(readsBefore);
    const terminal = structuredClone(controller.data!);
    terminal.room.status = 'completed'; terminal.snapshot!.status = 'completed';
    controller.client.setQueryData(controller.key, terminal);
    const interval = controller.options().refetchInterval;
    const query = new QueryObserver(controller.client, controller.options()).getCurrentQuery();
    expect(typeof interval === 'function' && interval(query)).toBe(15000);
    await controller.recover();
    expect(controller.confirmedActionId).toBeTypeOf('string');
    expect(controller.pending).toBeNull();
    terminal.stateVersion = controller.data!.stateVersion;
    terminal.updatedAt = '2026-10-09T10:00:05Z';
    controller.client.setQueryData(controller.key, terminal);
    expect(typeof interval === 'function' && interval(query)).toBe(false);
  });

  it('runs a real rules move and saves the acknowledged snapshot in the query cache', async () => {
    const server = cloudAuthority(); const controller = table(server.request);
    await controller.refresh();
    await controller.submit(server.action);
    expect(controller.data?.snapshot?.privateState.pendingAction).toBe('wait');
    expect(controller.data?.stateVersion).toBe(server.data.stateVersion);
    expect(server.receipts.size).toBe(1);
  });

  it('retries a lost response with the same action ID and commits exactly once', async () => {
    const server = cloudAuthority(); const controller = table(server.request);
    await controller.refresh(); server.loseResponses(1);
    await controller.submit(server.action);
    const posts = server.requests.filter((row) => row.path.endsWith('/actions'));
    expect(posts).toHaveLength(2);
    expect(posts[0].init?.body).toBe(posts[1].init?.body);
    expect(server.receipts.size).toBe(1);
    expect(controller.pending).toBeNull();
  });

  it('retains an uncertain move across refresh and recovers the original receipt', async () => {
    const server = cloudAuthority(); const controller = table(server.request);
    await controller.refresh(); server.loseResponses(2);
    await expect(controller.submit(server.action)).rejects.toThrow('Response lost');
    const pending = controller.pending;
    expect(controller.uncertain).toBe(true);
    await expect(controller.submit(server.action)).rejects.toMatchObject({ code: 'MOVE_PENDING' });
    await controller.refresh(); await controller.recover();
    const posts = server.requests.filter((row) => row.path.endsWith('/actions'));
    expect(posts.every((post) => JSON.parse(String(post.init?.body)).actionId === pending?.actionId)).toBe(true);
    expect(server.receipts.size).toBe(1);
    expect(controller.uncertain).toBe(false);
    expect(controller.pending).toBeNull();
  });

  it('does not queue a new move offline', async () => {
    const server = cloudAuthority(); const controller = table(server.request);
    await controller.refresh(); onlineManager.setOnline(false);
    await expect(controller.submit(server.action)).rejects.toMatchObject({ code: 'OFFLINE' });
    onlineManager.setOnline(true);
    expect(controller.pending).toBeNull();
    expect(server.requests.filter((row) => row.path.endsWith('/actions'))).toHaveLength(0);
  });

  it('does not retry an illegal move and releases the mutation lock', async () => {
    const server = cloudAuthority(); const controller = table(server.request);
    await controller.refresh();
    await expect(controller.submit({ type: 'DISCARD_TILE', tileId: 'missing' })).rejects.toMatchObject({ status: 422 });
    expect(controller.pending).toBeNull();
    await controller.submit(server.action);
    expect(server.receipts.size).toBe(1);
  });

  it('coalesces burst refreshes and catches a newer version arriving during a fetch', async () => {
    const fixture = cloudFixture();
    let finish!: (response: Response) => void;
    const newer = structuredClone(fixture.data);
    newer.stateVersion += 1; newer.snapshot!.stateVersion += 1; newer.snapshot!.publicState.stateVersion += 1;
    const request = vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce(Response.json(newer));
    const controller = table(request);
    const first = controller.refresh(fixture.data.stateVersion);
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    const second = controller.refresh(newer.stateVersion);
    finish(Response.json(fixture.data));
    await Promise.all([first, second]);
    expect(request).toHaveBeenCalledTimes(2);
    expect(controller.data?.stateVersion).toBe(newer.stateVersion);
  });

  it('never rolls back a newer pause or an acknowledged move with a delayed GET', async () => {
    const fixture = cloudFixture();
    let finish!: (response: Response) => void;
    const controller = table(() => new Promise((resolve) => { finish = resolve; }));
    controller.client.setQueryData(controller.key, fixture.data);
    const refresh = controller.refresh();
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    const paused = structuredClone(fixture.data);
    paused.updatedAt = '2026-10-09T10:00:01.000Z'; paused.room.status = 'paused'; paused.snapshot!.status = 'paused';
    controller.client.setQueryData(controller.key, paused);
    finish(Response.json(fixture.data)); await refresh;
    expect(controller.data?.snapshot?.status).toBe('paused');
  });

  it('drops concealed state when table access is revoked', async () => {
    const fixture = cloudFixture();
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: { code: 'NOT_A_PARTICIPANT', message: 'Not a participant' } }, { status: 403 }));
    const controller = table(request); controller.client.setQueryData(controller.key, fixture.data);
    await expect(controller.refresh()).rejects.toMatchObject({ status: 403 });
    expect(controller.data).toBeNull(); expect(controller.revoked).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('rejects cross-seat snapshots and extra canonical secrets without replacing a valid cache', async () => {
    const fixture = cloudFixture(); const invalid = structuredClone(fixture.data);
    invalid.snapshot!.privateState.playerId = 'bea';
    expect(() => parseTableData(invalid, 'room', 'alice')).toThrow();
    expect(() => parseTableData({ ...fixture.data, seed: 73 }, 'room', 'alice')).toThrow();
    const controller = table(async () => Response.json(invalid));
    controller.client.setQueryData(controller.key, fixture.data);
    await expect(controller.refresh()).rejects.toThrow('invalid or private');
    expect(controller.data?.snapshot?.privateState.playerId).toBe('alice');
  });

  it('keeps accounts separate and prevents disposed requests from restoring private cache data', async () => {
    expect(tableKey('alice', 'room')).not.toEqual(tableKey('bea', 'room'));
    const fixture = cloudFixture(); let finish!: (response: Response) => void;
    const controller = table(() => new Promise((resolve) => { finish = resolve; }));
    const pending = controller.refresh();
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    controller.dispose(); finish(Response.json(fixture.data));
    await expect(pending).rejects.toBeDefined();
    expect(controller.data).toBeNull();
  });

  it('keeps heartbeat activity monotonic across snapshot updates', () => {
    const { data } = cloudFixture(); const old = structuredClone(data);
    old.room.players[0].lastActivityAt = '2026-10-09T09:00:00Z';
    expect(newestTable(data, old)?.room.players[0].lastActivityAt).toBe(data.room.players[0].lastActivityAt);
  });
});
