// Opt-in real backend test. Uses .env.local credentials, creates/ends its own
// rooms, and never deletes history or logs credentials. Not part of npm test.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { parseTableData, snapshotSchema } from '../src/multiplayer/table-schema';
import type { GameAction } from '../src/game/types';

const env = parseEnv(readFileSync('.env.local', 'utf8'));
const origin = 'http://localhost:5180';
let cookie = '';
const responseSchema = z.looseObject({ user: z.object({ id: z.string() }).optional(), game: z.object({ id: z.string() }).optional(),
  error: z.object({ code: z.string(), message: z.string().optional() }).optional(), snapshot: snapshotSchema.nullable().optional() });
async function request(path: string, method = 'GET', body?: unknown, authenticated = true) {
  let response!: Response;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetch(origin + path, { method, signal: AbortSignal.timeout(20000), headers: {
    ...(authenticated ? { cookie } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }),
  }, body: body === undefined ? undefined : JSON.stringify(body) });
      break;
    } catch (error) {
      // Exact action envelopes are safe to replay; room creation is not retried.
      if (attempt === 2 || !(method === 'GET' || path.endsWith('/actions') || path.endsWith('/heartbeat'))) throw error;
    }
  }
  const data = responseSchema.parse(await response.json());
  return { response, data };
}
async function login() {
  const result = await request('/api/auth/login', 'POST', { identifier: env.LOCAL_USER, password: env.LOCAL_USER_PASS }, false);
  assert.equal(result.response.status, 200, 'Login must succeed');
  cookie = result.response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
  assert.ok(result.data.user);
  return result.data.user.id;
}
const userId = await login();
const requestedExisting = process.argv[2];
for (const mode of ['live', 'async'] as const) {
  let gameId = mode === 'live' ? requestedExisting : undefined;
  if (!gameId) {
    const created = await request('/api/games', 'POST', { mode, turnSeconds: 300 });
    assert.equal(created.response.status, 201, 'Create room');
    assert.ok(created.data.game);
    gameId = created.data.game.id;
    const lobby = await request(`/api/games/${gameId}/snapshot`);
    assert.equal(parseTableData(lobby.data, gameId, userId).stateVersion, 0);
    assert.equal((await request(`/api/games/${gameId}/start`, 'POST')).response.status, 200);
  }
  const path = `/api/games/${gameId}`;
  async function read() {
    const result = await request(path + '/snapshot');
    assert.equal(result.response.status, 200);
    assert.match(result.response.headers.get('cache-control') ?? '', /no-store/);
    return parseTableData(result.data, gameId!, userId);
  }
  let data = await read();
  if (data.room.status === 'lobby') {
    assert.equal((await request(path + '/start', 'POST')).response.status, 200);
    data = await read();
  }
  assert.equal(data.room.status, 'active', 'Use an active or lobby test room');
  assert.equal(data.room.mode, mode);
  assert.equal((await request(path + '/snapshot', 'GET', undefined, false)).response.status, 401);
  const capped = await request('/api/games', 'POST', { mode });
  assert.equal(capped.data.error?.code, 'ACTIVE_GAME_LIMIT_REACHED');
  let accepted = 0;
  let recoveredConflicts = 0;
  let lastEnvelope: unknown;
  let lastSnapshot: unknown;
  for (let step = 0; step < 80 && accepted < 8 && data.snapshot!.status === 'active'; step++) {
    assert.equal((await request(path + '/heartbeat', 'POST')).response.status, 200);
    const snapshot = data.snapshot!;
    const rack = snapshot.privateState.rack;
    let action: GameAction;
    switch (snapshot.privateState.pendingAction) {
      case 'charleston_pass': action = { type: 'PASS_TILES', tileIds: rack.filter((tile) => tile.type.kind !== 'joker').slice(0, 3).map((tile) => tile.id) }; break;
      case 'charleston_decision': action = { type: 'CHOOSE_SECOND_CHARLESTON', continue: false }; break;
      case 'courtesy_pass': action = { type: 'COURTESY_PASS', tileIds: [] }; break;
      case 'draw': action = { type: 'DRAW_TILE' }; break;
      case 'discard': action = { type: 'DISCARD_TILE', tileId: rack[0].id }; break;
      case 'discard_response': action = { type: 'PASS_ON_DISCARD' }; break;
      default: throw new Error('Table stalled without a human decision');
    }
    const envelope = { actionId: crypto.randomUUID(), expectedStateVersion: snapshot.stateVersion, action };
    if (step === 0 && mode === 'live') {
      assert.equal((await request(path + '/pause-votes', 'POST', { vote: 'pause' })).response.status, 200);
      assert.equal((await request(path + '/actions', 'POST', envelope)).data.error?.code, 'GAME_NOT_ACTIVE');
      assert.equal((await request(path + '/pause-votes', 'POST', { vote: 'resume' })).response.status, 200);
    }
    const moved = await request(path + '/actions', 'POST', envelope);
    if (moved.response.status === 409 && ['DEADLINE_EXPIRED', 'STATE_CONFLICT'].includes(moved.data.error?.code ?? '')) {
      data = await read(); recoveredConflicts++; continue;
    }
    assert.equal(moved.response.status, 200, JSON.stringify(moved.data.error));
    const saved = snapshotSchema.parse(moved.data.snapshot);
    const replay = await request(path + '/actions', 'POST', envelope);
    assert.equal(replay.response.status, 200);
    assert.deepEqual(replay.data.snapshot, moved.data.snapshot);
    const changed = await request(path + '/actions', 'POST', { ...envelope, action: action.type === 'DRAW_TILE'
      ? { type: 'DISCARD_TILE', tileId: 'not-owned' } : { type: 'DRAW_TILE' } });
    assert.equal(changed.response.status, 409);
    assert.equal(changed.data.error?.code, 'ACTION_ID_REUSED');
    lastEnvelope = envelope; lastSnapshot = moved.data.snapshot;
    data = await read();
    assert.ok(data.stateVersion >= saved.stateVersion, 'Canonical reads cannot roll back an accepted move');
    accepted++;
    if (accepted % 4 === 0) console.log(JSON.stringify({ mode, acceptedMoves: accepted, pendingAction: data.snapshot?.privateState.pendingAction }));
  }
  assert.ok(accepted > 0);
  if (data.room.status === 'active') assert.equal((await request(path + '/end', 'POST')).response.status, 200);
  data = await read();
  assert.ok(['completed', 'abandoned'].includes(data.room.status));
  const replayAfterEnd = await request(path + '/actions', 'POST', lastEnvelope);
  assert.equal(replayAfterEnd.response.status, 200);
  assert.deepEqual(replayAfterEnd.data.snapshot, lastSnapshot);
  console.log(JSON.stringify({ mode, gameId, acceptedMoves: accepted, recoveredConflicts, replayVerified: true, terminalStatus: data.room.status }));
}
console.log('Authenticated real-backend journey passed.');
