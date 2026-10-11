import { onlineManager, queryOptions, replaceEqualDeep, type QueryClient } from '@tanstack/react-query';
import type { GameAction } from '../game/types';
import type { ActionEnvelope, GameSnapshot } from './types';
import { CloudApiError, cloudJson, ContractError, isAccessError, isTransientError } from './cloud-api';
import { parseTableData, roomSchema, snapshotSchema, type TableData } from './table-schema';
import { createSnapshotRefresher } from './snapshot-sync';

export const tableKey = (userId: string, gameId: string) => ['cloud', userId, 'table', gameId] as const;

export function newestTable(previous: TableData | null | undefined, incoming: TableData | null): TableData | null {
  if (!incoming || !previous) return incoming;
  if (incoming.stateVersion < previous.stateVersion
    || (incoming.stateVersion === previous.stateVersion && Date.parse(incoming.updatedAt) < Date.parse(previous.updatedAt))) return previous;
  // Heartbeats update players independently of the game version/timestamp.
  const players = incoming.room.players.map((player) => {
    const old = previous.room.players.find((item) => item.playerKey === player.playerKey && item.userId === player.userId);
    return old && Date.parse(old.lastActivityAt) > Date.parse(player.lastActivityAt)
      ? { ...player, lastActivityAt: old.lastActivityAt } : player;
  });
  return { ...incoming, room: { ...incoming.room, players } };
}

export class TableQuery {
  readonly key;
  private abort = new AbortController();
  private listeners = new Set<() => void>();
  private revision = 0;
  private sending = false;
  private nextRecoveryAt = 0;
  private disposed = false;
  revoked = false;
  pending: ActionEnvelope | null = null;
  uncertain = false;
  confirmedActionId: string | null = null;
  private queuedRefresh: ReturnType<typeof createSnapshotRefresher>;

  constructor(readonly client: QueryClient, readonly userId: string, readonly gameId: string, private request: typeof fetch = fetch) {
    this.key = tableKey(userId, gameId);
    this.queuedRefresh = createSnapshotRefresher(async () => {
      if (this.disposed || this.revoked) return 0;
      await this.client.invalidateQueries({ queryKey: this.key, exact: true, refetchType: 'none' });
      const data = await this.client.fetchQuery({ ...this.options(), staleTime: 0 });
      return data?.stateVersion ?? 0;
    });
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getRevision = () => this.revision;
  private changed() { this.revision += 1; this.listeners.forEach((listener) => listener()); }
  get data() { return this.client.getQueryData<TableData | null>(this.key) ?? null; }

  options() {
    return queryOptions({
      queryKey: this.key,
      queryFn: async ({ signal }): Promise<TableData | null> => {
        try {
          const response = await cloudJson(`/api/games/${this.gameId}/snapshot`, { signal }, this.request);
          if (signal.aborted || this.disposed) throw new DOMException('Table closed.', 'AbortError');
          let data: TableData;
          try { data = parseTableData(response, this.gameId, this.userId); }
          catch { throw new ContractError('The table returned an invalid or private snapshot.'); }
          return newestTable(this.data, data);
        } catch (error) {
          if (isAccessError(error) && !this.disposed) this.revoke();
          throw error;
        }
      },
      enabled: !this.revoked && !this.disposed,
      staleTime: 1000, gcTime: 0,
      retry: (count, error) => count < 2 && isTransientError(error) && !this.disposed && !this.revoked,
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 5000),
      refetchOnWindowFocus: 'always', refetchOnReconnect: 'always',
      refetchInterval: (query) => {
        // A terminal snapshot does not prove that this client's move receipt arrived.
        if (this.pending) return 15000;
        const data = query.state.data;
        if (!data || data.room.status === 'completed' || data.room.status === 'abandoned') return false;
        return data.room.status === 'lobby' ? 5000 : data.room.mode === 'live' ? 15000 : 30000;
      },
      refetchIntervalInBackground: false,
      structuralSharing: (previous, incoming) => replaceEqualDeep(previous, newestTable(previous as TableData | null | undefined, incoming as TableData | null)),
    });
  }

  async refresh(minimumVersion = 0) {
    if (this.disposed || this.revoked) return;
    return this.queuedRefresh(minimumVersion);
  }
  invalidate() {
    if (!this.disposed && !this.revoked) return this.client.invalidateQueries({ queryKey: this.key, exact: true });
    return Promise.resolve();
  }
  private revoke() {
    this.revoked = true;
    this.pending = null; this.uncertain = false;
    this.client.setQueryData(this.key, null);
    this.changed();
  }
  dispose() {
    this.disposed = true;
    this.abort.abort();
    void this.client.cancelQueries({ queryKey: this.key, exact: true });
    this.client.removeQueries({ queryKey: this.key, exact: true });
    this.pending = null; this.uncertain = false;
  }
  activate() { this.disposed = false; if (this.abort.signal.aborted) this.abort = new AbortController(); }

  async heartbeat() {
    if (this.disposed || this.revoked || this.data?.snapshot?.status !== 'active') return;
    try {
      const response = await cloudJson(`/api/games/${this.gameId}/heartbeat`, { method: 'POST', signal: this.abort.signal }, this.request);
      const result = roomSchema.safeParse((response as { room?: unknown })?.room);
      if (!result.success || result.data.id !== this.gameId) throw new ContractError('Invalid heartbeat response.');
      if (this.disposed) return;
      this.client.setQueryData<TableData | null>(this.key, (current) => {
        if (!current) return null;
        const players = current.room.players.map((player) => {
          const fresh = result.data.players.find((row) => row.playerKey === player.playerKey && row.userId === player.userId);
          return fresh && Date.parse(fresh.lastActivityAt) > Date.parse(player.lastActivityAt)
            ? { ...player, lastActivityAt: fresh.lastActivityAt, joinStatus: player.joinStatus === 'replaced' ? 'replaced' as const : fresh.joinStatus } : player;
        });
        return { ...current, room: { ...current.room, players } };
      });
    } catch (error) {
      if (error instanceof CloudApiError && error.status === 409) void this.invalidate();
      else if (isAccessError(error) && !this.disposed) this.revoke();
      // Read polling and reconnect refresh remain available after a failed heartbeat.
    }
  }

  async command(command: 'pause' | 'resume' | 'end') {
    if (this.pending || this.sending) throw new CloudApiError(409, 'MOVE_PENDING', 'Confirm the previous move first.');
    if (!onlineManager.isOnline() || this.disposed || this.revoked) throw new CloudApiError(0, 'OFFLINE', 'Reconnect before changing the table.');
    this.sending = true; this.changed();
    try {
      await this.client.cancelQueries({ queryKey: this.key, exact: true });
      return await cloudJson(`/api/games/${this.gameId}/${command === 'end' ? 'end' : 'pause-votes'}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: command === 'end' ? undefined : JSON.stringify({ vote: command }), signal: this.abort.signal,
      }, this.request);
    } finally { this.sending = false; this.changed(); void this.invalidate(); }
  }

  private acceptMove(snapshot: GameSnapshot) {
    const current = this.data;
    if (this.disposed || !current || snapshot.publicState.id !== this.gameId
      || snapshot.privateState.playerId !== current.snapshot?.privateState.playerId) {
      throw new ContractError('The move response belongs to a different seat.');
    }
    this.client.setQueryData<TableData | null>(this.key, (data) => data ? newestTable(data, {
      ...data, snapshot, stateVersion: snapshot.stateVersion,
      room: { ...data.room, status: snapshot.status },
    }) : null);
  }

  async submit(action: GameAction) {
    if (this.sending || this.pending) throw new CloudApiError(409, 'MOVE_PENDING', 'The previous move is still being confirmed.');
    if (!onlineManager.isOnline()) throw new CloudApiError(0, 'OFFLINE', 'Reconnect before sending a move.');
    const snapshot = this.data?.snapshot;
    if (!snapshot || snapshot.status !== 'active' || this.revoked || this.disposed) throw new CloudApiError(409, 'GAME_NOT_ACTIVE', 'Refresh the table before making a move.');
    this.pending = { actionId: crypto.randomUUID(), expectedStateVersion: snapshot.stateVersion, action };
    return this.deliver();
  }
  async recover(force = true) {
    if (!force && Date.now() < this.nextRecoveryAt) return;
    if (!this.pending || !this.uncertain || this.sending || this.disposed || this.revoked || !onlineManager.isOnline()) return;
    return this.deliver();
  }
  private async deliver() {
    const envelope = this.pending!;
    this.sending = true; this.uncertain = false; this.changed();
    try {
      const body = JSON.stringify(envelope);
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await cloudJson(`/api/games/${this.gameId}/actions`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body, signal: this.abort.signal,
          }, this.request);
          const parsed = snapshotSchema.safeParse((response as { snapshot?: unknown })?.snapshot);
          if (!parsed.success) throw new ContractError('The table did not confirm the move.');
          if (!this.disposed) this.acceptMove(parsed.data);
          this.pending = null;
          this.confirmedActionId = envelope.actionId;
          void this.invalidate();
          return parsed.data;
        } catch (error) {
          const uncertain = !(error instanceof CloudApiError) || isTransientError(error);
          if (attempt === 0 && uncertain && !this.abort.signal.aborted && !(error instanceof CloudApiError && error.status === 429)) continue;
          throw error;
        }
      }
    } catch (error) {
      if (!this.disposed) {
        this.uncertain = !(error instanceof CloudApiError) || isTransientError(error);
        if (this.uncertain) this.nextRecoveryAt = Date.now() + 15000;
        if (!this.uncertain) this.pending = null;
        if (isAccessError(error)) this.revoke();
        else void this.invalidate();
      }
      throw error;
    } finally { this.sending = false; this.changed(); }
  }
}
