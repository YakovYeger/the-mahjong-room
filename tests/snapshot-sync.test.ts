import { describe, expect, it, vi } from 'vitest';
import { createGame } from '../src/game/engine';
import { snapshotForPlayer } from '../src/multiplayer/projections';
import { createSnapshotRefresher, reconcileSelection, SnapshotSynchronizer } from '../src/multiplayer/snapshot-sync';

function snapshot() {
  const game = createGame(91);
  return snapshotForPlayer(game, game.players[0].id, 'active', 'live', null, game.events)!;
}

describe('table snapshot synchronization', () => {
  it('rejects a fetch that finishes after a newer move acknowledgement', () => {
    const sync = new SnapshotSynchronizer();
    const first = snapshot();
    sync.accept(first);
    const started = sync.revision;
    const newer = { ...first, stateVersion: first.stateVersion + 2 };
    expect(sync.accept(newer)).toBe(true);
    expect(sync.accept(first, started)).toBe(false);
    expect(sync.current).toBe(newer);
  });

  it('rejects a same-version stale response after a pause update', () => {
    const sync = new SnapshotSynchronizer();
    const first = snapshot();
    sync.accept(first);
    const started = sync.revision;
    const paused = { ...first, status: 'paused' as const };
    sync.accept(paused);
    expect(sync.accept(first, started)).toBe(false);
    expect(sync.current?.status).toBe('paused');
  });

  it('preserves surviving selections on refresh and clears them on a different decision', () => {
    const first = snapshot();
    const ids = first.privateState.rack.slice(0, 2).map((tile) => tile.id);
    expect(reconcileSelection(ids, first, structuredClone(first))).toEqual(ids);
    const next = structuredClone(first);
    next.privateState.rack = next.privateState.rack.filter((tile) => tile.id !== ids[0]);
    expect(reconcileSelection(ids, first, next)).toEqual([ids[1]]);
    next.publicState.charlestonActorId = 'another-seat';
    expect(reconcileSelection(ids, first, next)).toEqual([]);
  });

  it('coalesces broadcasts and follows a newer version received during a fetch', async () => {
    let finish!: (version: number) => void;
    const load = vi.fn().mockImplementationOnce(() => new Promise<number>((resolve) => { finish = resolve; })).mockResolvedValue(8);
    const refresh = createSnapshotRefresher(load);
    const first = refresh(7);
    const second = refresh(8);
    expect(second).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);
    finish(7);
    await first;
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('fetches again when a pause refresh arrives during an older same-version request', async () => {
    let finish!: (version: number) => void;
    const load = vi.fn().mockImplementationOnce(() => new Promise<number>((resolve) => { finish = resolve; })).mockResolvedValue(7);
    const refresh = createSnapshotRefresher(load);
    const first = refresh(7);
    expect(refresh()).toBe(first);
    finish(7);
    await first;
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('allows a later refresh after a failed fetch', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(4);
    const refresh = createSnapshotRefresher(load);
    await expect(refresh()).rejects.toThrow('offline');
    await expect(refresh()).resolves.toBeUndefined();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
