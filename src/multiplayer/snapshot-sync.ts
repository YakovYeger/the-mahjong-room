import type { GameSnapshot } from './types';

export function reconcileSelection(selected: string[], previous: GameSnapshot | null, next: GameSnapshot): string[] {
  if (!previous || previous.privateState.playerId !== next.privateState.playerId
    || previous.status !== next.status || previous.privateState.pendingAction !== next.privateState.pendingAction
    || previous.publicState.turnCount !== next.publicState.turnCount
    || previous.publicState.charlestonActorId !== next.publicState.charlestonActorId
    || previous.publicState.charlestonPassIndex !== next.publicState.charlestonPassIndex
    || previous.publicState.callWindow?.discard.id !== next.publicState.callWindow?.discard.id) return [];
  const rackIds = new Set(next.privateState.rack.map((tile) => tile.id));
  return selected.filter((id) => rackIds.has(id));
}

// A response begun before a mutation must not roll the table back, including
// same-version pause/room updates. Each mounted table owns its own coordinator.
export class SnapshotSynchronizer {
  current: GameSnapshot | null = null;
  revision = 0;

  invalidate() { this.revision += 1; }

  accept(next: GameSnapshot, startedAtRevision = this.revision): boolean {
    if (this.current && (next.stateVersion < this.current.stateVersion
      || (startedAtRevision !== this.revision && next.stateVersion <= this.current.stateVersion))) return false;
    this.current = next;
    this.revision += 1;
    return true;
  }
}

// Broadcast bursts share a fetch. If a newer version arrives during it, fetch
// again before resolving, with a bounded retry for an unavailable version.
export function createSnapshotRefresher(load: () => Promise<number>) {
  let pending: Promise<void> | null = null;
  let requestedVersion = 0;
  let refreshAgain = false;
  return (minimumVersion = 0): Promise<void> => {
    requestedVersion = Math.max(requestedVersion, minimumVersion);
    if (pending) {
      if (minimumVersion === 0) refreshAgain = true;
      return pending;
    }
    pending = (async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        refreshAgain = false;
        const version = await load();
        if (version >= requestedVersion && !refreshAgain) break;
      }
    })().finally(() => { pending = null; requestedVersion = 0; });
    return pending;
  };
}
