import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '../src/game/engine';
import { snapshotForPlayer } from '../src/multiplayer/projections';
import { submitAction } from '../src/server/game-service';

const { rpc, recordEvent } = vi.hoisted(() => ({ rpc: vi.fn(), recordEvent: vi.fn() }));
vi.mock('../src/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }));
vi.mock('../src/server/observability', () => ({ recordOperationalEvent: recordEvent }));

function fixture() {
  const state = createGame(73);
  const player = state.players[0];
  const snapshot = snapshotForPlayer(state, player.id, 'active', 'live', null, state.events)!;
  const envelope = { actionId: '86cfac50-30ce-46b4-84ab-dbd68e37d050', expectedStateVersion: state.stateVersion,
    action: { type: 'PASS_TILES' as const, tileIds: player.rack.filter((tile) => tile.type.kind !== 'joker').slice(0, 3).map((tile) => tile.id) } };
  const record = { game: { id: 'room', owner_id: 'alice', status: 'active', mode: 'live', state_version: state.stateVersion, turn_seconds: 60, response_seconds: 15 }, state,
    players: [{ user_id: 'alice', player_key: player.id, controller_type: 'human', last_activity_at: new Date().toISOString() }] };
  return { snapshot, envelope, record };
}

describe('saved action retries', () => {
  beforeEach(() => { rpc.mockReset(); recordEvent.mockReset(); });

  it('replays a saved response after the game ends and the reconnect grace expires', async () => {
    const { record, snapshot, envelope } = fixture();
    record.game.status = 'completed';
    record.game.state_version += 10;
    record.players[0].last_activity_at = '2020-01-01T00:00:00Z';
    rpc.mockResolvedValueOnce({ data: { record, receipt: { duplicate: true, response: snapshot } } });
    expect(await submitAction('room', 'alice', envelope)).toBe(snapshot);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe('load_player_action_context');
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it('rejects an action ID reused for a different request', async () => {
    const { envelope } = fixture();
    rpc.mockResolvedValueOnce({ error: { message: 'ACTION_ID_REUSED' } });
    await expect(submitAction('room', 'alice', envelope)).rejects.toMatchObject({ status: 409, code: 'ACTION_ID_REUSED' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('checks membership before returning a private receipt', async () => {
    const { record, envelope } = fixture();
    rpc.mockResolvedValueOnce({ data: { record, receipt: null } });
    await expect(submitAction('room', 'intruder', envelope)).rejects.toMatchObject({ status: 403 });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('still rejects stale versions for requests without a receipt', async () => {
    const { record, envelope } = fixture();
    record.game.state_version += 2;
    rpc.mockResolvedValueOnce({ data: { record, receipt: null } });
    await expect(submitAction('room', 'alice', envelope)).rejects.toMatchObject({ status: 409, code: 'STATE_CONFLICT' });
  });

  it('does not send turn notifications when a concurrent commit returns a duplicate', async () => {
    const { record, envelope, snapshot } = fixture();
    record.game.mode = 'async';
    rpc.mockResolvedValueOnce({ data: { record, receipt: null } })
      .mockResolvedValueOnce({ data: { duplicate: true, response: snapshot } });
    expect(await submitAction('room', 'alice', envelope)).toBe(snapshot);
    // The fake admin has no notification-table API: a duplicate must skip it.
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('commits a fresh action after checking for a receipt', async () => {
    const { record, envelope } = fixture();
    rpc.mockResolvedValueOnce({ data: { record, receipt: null } }).mockResolvedValueOnce({ data: {} });
    const result = await submitAction('room', 'alice', envelope);
    expect(result?.stateVersion).toBeGreaterThan(envelope.expectedStateVersion);
    expect(rpc.mock.calls[1][0]).toBe('commit_player_action');
    expect(rpc.mock.calls[0][1].request_hash_value).toBe(rpc.mock.calls[1][1].request_hash_value);
  });
});
