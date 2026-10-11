import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getTable } from '../app/api/games/[id]/snapshot/route';
import { POST as postAction } from '../app/api/games/[id]/actions/route';
import { ApiError } from '../src/server/http';
import { parseTableData } from '../src/multiplayer/table-schema';
import { cloudFixture } from './helpers/cloud-table';

const { rpc, requireUser } = vi.hoisted(() => ({ rpc: vi.fn(), requireUser: vi.fn() }));
vi.mock('../src/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }));
vi.mock('../src/server/auth', () => ({ requireUser, displayNameForUser: () => 'alice' }));
vi.mock('../src/server/observability', () => ({ recordOperationalEvent: vi.fn() }));
const params = { params: Promise.resolve({ id: 'room' }) };

function database() {
  const fixture = cloudFixture();
  const record = { game: { id: 'room', owner_id: 'alice', status: 'active', phase: 'charleston', mode: 'live', state_version: fixture.state.stateVersion,
    event_sequence: fixture.state.eventSequence, turn_seconds: 300, response_seconds: 15, deadline_at: null as string | null,
    invite_expires_at: null, invite_code: null, updated_at: new Date().toISOString() }, state: fixture.state,
    players: fixture.data.room.players.map((player) => ({ user_id: player.userId, player_key: player.playerKey, seat: player.seat,
      controller_type: player.controllerType, assistance_level: player.assistanceLevel, display_name: player.displayName,
      join_status: player.joinStatus, timeout_count: player.timeoutCount, last_activity_at: new Date().toISOString() })),
  };
  const receipts = new Map<string, unknown>();
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'load_canonical_game') return { data: structuredClone(record) };
    if (name === 'load_player_action_context') return { data: { record: structuredClone(record), receipt: receipts.get(String(args.requested_action_id)) ?? null } };
    if (name === 'commit_player_action' || name === 'commit_timeout_action') {
      if (record.game.status !== 'active') return { error: { message: 'GAME_NOT_ACTIVE' } };
      if (args.expected_version !== record.game.state_version) return { data: { conflict: true, latestVersion: record.game.state_version } };
      record.state = structuredClone(args.next_state) as typeof record.state;
      record.game.state_version = record.state.stateVersion;
      record.game.event_sequence = record.state.eventSequence;
      record.game.status = String(args.next_status); record.game.phase = String(args.next_phase);
      record.game.deadline_at = args.next_deadline as string | null;
      record.game.updated_at = new Date().toISOString();
      const response = { duplicate: false, response: args.response_value };
      receipts.set(String(args.requested_action_id), response);
      return { data: response };
    }
    throw new Error(`Unexpected RPC: ${name}`);
  });
  return { fixture, record, receipts };
}
beforeEach(() => { rpc.mockReset(); requireUser.mockReset().mockResolvedValue({ id: 'alice' }); });
const request = (value: unknown) => new NextRequest('http://localhost/api/games/room/actions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });

describe('cloud route → rules → commit → safe snapshot', () => {
  it('loads room and participant snapshot from one canonical read', async () => {
    database();
    const response = await getTable(new Request('http://localhost/api/games/room/snapshot'), params);
    const data = parseTableData(await response.json(), 'room', 'alice');
    expect(data.snapshot?.privateState.rack).toHaveLength(14);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('validates, commits, and replays a real Charleston action only once', async () => {
    const { fixture, record, receipts } = database();
    const envelope = { actionId: crypto.randomUUID(), expectedStateVersion: record.game.state_version, action: fixture.action };
    const first = await postAction(request(envelope), params);
    const second = await postAction(request(envelope), params);
    expect(first.status).toBe(200); expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
    expect(receipts.size).toBe(1);
    expect(rpc.mock.calls.filter(([name]) => name === 'commit_player_action')).toHaveLength(1);
    const response = await getTable(new Request('http://localhost/api/games/room/snapshot'), params);
    const data = parseTableData(await response.json(), 'room', 'alice');
    expect(data.snapshot?.privateState.pendingAction).toBe('wait');
    expect(data.snapshot?.publicState.players.every((player) => !('rack' in player))).toBe(true);
  });

  it('rejects malformed bodies before touching canonical state', async () => {
    database();
    const response = await postAction(request({ actionId: crypto.randomUUID(), expectedStateVersion: 1, action: { type: 'DRAW_TILE', seed: 99 } }), params);
    expect(response.status).toBe(400); expect(rpc).not.toHaveBeenCalled();
  });

  it('does not commit a candidate if the room paused after it was loaded', async () => {
    const { fixture, record } = database();
    const delegate = rpc.getMockImplementation()!;
    rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      const result = await delegate(name, args);
      if (name === 'load_player_action_context') record.game.status = 'paused';
      return result;
    });
    const response = await postAction(request({ actionId: crypto.randomUUID(), expectedStateVersion: 1, action: fixture.action }), params);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: 'GAME_NOT_ACTIVE' } });
    expect(record.state.stateVersion).toBe(1);
  });

  it('resolves an expired decision on read without waiting for the scheduled worker', async () => {
    const { record } = database(); record.state.phase = 'playing'; record.game.phase = 'playing';
    record.game.deadline_at = new Date(Date.now() - 1000).toISOString();
    const response = await getTable(new Request('http://localhost/api/games/room/snapshot'), params);
    expect(response.status).toBe(200);
    const data = parseTableData(await response.json(), 'room', 'alice');
    expect(data.stateVersion).toBeGreaterThan(1);
    expect(rpc.mock.calls.some(([name]) => name === 'commit_timeout_action')).toBe(true);
  });

  it('returns a private, uncached auth error without loading racks', async () => {
    database(); requireUser.mockRejectedValueOnce(new ApiError(401, 'SIGN_IN_REQUIRED', 'Sign in.'));
    const response = await getTable(new Request('http://localhost/api/games/room/snapshot'), params);
    expect(response.status).toBe(401); expect(rpc).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).not.toHaveProperty('snapshot');
  });
});
