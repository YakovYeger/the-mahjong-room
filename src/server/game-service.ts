import { createGame, getPublicGameState } from '../game/engine';
import { runBotAction } from '../game/bots';
import type { GameEvent, GameState, Seat } from '../game/types';
import { advanceBotsUntilHumanDecision, applyHumanActionAndAdvance, deadlineForState, requiredHumanPlayers } from '../multiplayer/game-flow';
import { sanitizePublicEvent, snapshotForPlayer } from '../multiplayer/projections';
import type { ActionEnvelope, GameMode, GameSnapshot, GameStatus, RoomDetails, RoomPlayer } from '../multiplayer/types';
import { createSupabaseAdminClient } from '../lib/supabase/admin';
import { createSupabaseServerClient } from '../lib/supabase/server';
import type { Json } from '../lib/supabase/database.types';
import { displayNameForUser } from './auth';
import { ApiError } from './http';
import { recordOperationalEvent } from './observability';

interface DbGame {
  id: string;
  owner_id: string;
  status: GameStatus;
  mode: GameMode;
  state_version: number;
  event_sequence: number;
  turn_seconds: number;
  response_seconds: number;
  deadline_at: string | null;
  invite_expires_at: string | null;
  updated_at: string;
}

interface DbPlayer {
  game_id: string;
  user_id: string | null;
  player_key: string;
  seat: Seat;
  controller_type: 'human' | 'bot';
  assistance_level: 0 | 1 | 2 | 3 | 4;
  display_name: string;
  join_status: 'joined' | 'disconnected' | 'replaced';
  timeout_count: number;
}

interface CanonicalRecord {
  game: DbGame;
  players: DbPlayer[];
  state: GameState | null;
}

const seats: Seat[] = ['east', 'south', 'west', 'north'];
const inviteAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function adminClient() {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'Cloud games are not configured yet. Guest play remains available.');
  return admin;
}

function randomInviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => inviteAlphabet[byte % inviteAlphabet.length]).join('');
}

function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function deterministicUuid(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function roomPlayer(row: DbPlayer): RoomPlayer {
  return {
    userId: row.user_id,
    playerKey: row.player_key,
    seat: row.seat,
    controllerType: row.controller_type,
    assistanceLevel: row.assistance_level,
    displayName: row.display_name,
    joinStatus: row.join_status,
    timeoutCount: row.timeout_count,
  };
}

function roomDetails(record: CanonicalRecord): RoomDetails {
  return {
    id: record.game.id,
    ownerId: record.game.owner_id,
    status: record.game.status,
    mode: record.game.mode,
    turnSeconds: record.game.turn_seconds,
    responseSeconds: record.game.response_seconds,
    inviteExpiresAt: record.game.invite_expires_at,
    players: record.players.map(roomPlayer),
  };
}

export function isActionEnvelope(value: unknown): value is ActionEnvelope {
  if (!value || typeof value !== 'object') return false;
  const envelope = value as Record<string, unknown>;
  if (typeof envelope.actionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(envelope.actionId)) return false;
  if (!Number.isInteger(envelope.expectedStateVersion) || Number(envelope.expectedStateVersion) < 1) return false;
  if (!envelope.action || typeof envelope.action !== 'object') return false;
  const action = envelope.action as Record<string, unknown>;
  const stringArray = (candidate: unknown, max: number) => Array.isArray(candidate) && candidate.length <= max && candidate.every((item) => typeof item === 'string' && item.length <= 120);
  switch (action.type) {
    case 'PASS_TILES': return stringArray(action.tileIds, 3) && (action.blindCount === undefined || (Number.isInteger(action.blindCount) && Number(action.blindCount) >= 0 && Number(action.blindCount) <= 2));
    case 'COURTESY_PASS': return stringArray(action.tileIds, 3);
    case 'CHOOSE_SECOND_CHARLESTON': return typeof action.continue === 'boolean';
    case 'DRAW_TILE':
    case 'PASS_ON_DISCARD': return true;
    case 'DISCARD_TILE': return typeof action.tileId === 'string' && action.tileId.length <= 120;
    case 'CALL_TILE': return stringArray(action.rackTileIds, 5);
    case 'EXCHANGE_JOKER': return ['exposureOwnerId', 'exposureId', 'rackTileId', 'jokerTileId'].every((key) => typeof action[key] === 'string' && String(action[key]).length <= 120);
    case 'DECLARE_MAHJONG': return action.useDiscard === undefined || typeof action.useDiscard === 'boolean';
    default: return false;
  }
}

export async function loadCanonicalGame(gameId: string): Promise<CanonicalRecord> {
  const { data, error } = await adminClient().rpc('load_canonical_game', { requested_game_id: gameId });
  if (error || !data) throw new ApiError(404, 'GAME_NOT_FOUND', 'That game was not found.');
  return data as unknown as CanonicalRecord;
}

function playerForUser(record: CanonicalRecord, userId: string) {
  const player = record.players.find((item) => item.user_id === userId);
  if (!player) throw new ApiError(403, 'NOT_A_PARTICIPANT', 'You are not a current player in this game.');
  return player;
}

export async function listGames(userId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'Cloud games are not configured yet.');
  const { data, error } = await supabase
    .from('games')
    .select('id,owner_id,status,mode,state_version,deadline_at,updated_at,game_players(controller_type)')
    .order('updated_at', { ascending: false });
  if (error) throw new ApiError(500, 'GAMES_UNAVAILABLE', 'Saved games could not be loaded.');
  return (data ?? []).map((game) => {
    const players = Array.isArray(game.game_players) ? game.game_players : [];
    return {
      id: game.id,
      ownerId: game.owner_id,
      status: game.status,
      mode: game.mode,
      stateVersion: game.state_version,
      deadlineAt: game.deadline_at,
      updatedAt: game.updated_at,
      playerCount: players.length,
      humanCount: players.filter((player) => player.controller_type === 'human').length,
      isMine: game.owner_id === userId,
    };
  });
}

export async function getEntitlement() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'Cloud games are not configured yet.');
  const { data, error } = await supabase.from('user_entitlements').select('plan_id,valid_until,plans(name,active_game_limit)').maybeSingle();
  if (error || !data) return { planId: 'free', name: 'Free', activeGameLimit: 1, validUntil: null };
  const plan = Array.isArray(data.plans) ? data.plans[0] : data.plans;
  return { planId: data.plan_id, name: plan?.name ?? 'Free', activeGameLimit: plan?.active_game_limit ?? 1, validUntil: data.valid_until };
}

export async function createRoom(user: Parameters<typeof displayNameForUser>[0], input: { mode: GameMode; turnSeconds?: number; responseSeconds?: number }) {
  const admin = adminClient();
  const mode = input.mode;
  const turnSeconds = mode === 'async' ? 86_400 : Math.max(15, Math.min(input.turnSeconds ?? 60, 3600));
  const responseSeconds = mode === 'async' ? 14_400 : Math.max(5, Math.min(input.responseSeconds ?? 15, 300));
  const inviteCode = randomInviteCode();
  const playerKey = `player-${crypto.randomUUID()}`;
  const { data: profile } = await admin.from('profiles').select('username,display_name').eq('user_id', user.id).maybeSingle();
  const fallback = profile?.username ?? user.email?.split('@')[0] ?? 'Player';
  const displayName = profile?.display_name ?? displayNameForUser(user, fallback);
  const { data, error } = await admin.rpc('create_game_room', {
    owner_user_id: user.id,
    owner_player_key: playerKey,
    owner_display_name: displayName,
    game_mode_value: mode,
    turn_seconds_value: turnSeconds,
    response_seconds_value: responseSeconds,
    invite_code_value: inviteCode,
    invite_expires_value: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  });
  if (error) {
    if (error.message.includes('ACTIVE_GAME_LIMIT_REACHED')) throw new ApiError(403, 'ACTIVE_GAME_LIMIT_REACHED', 'Your plan has reached its active-game limit.');
    throw new ApiError(500, 'ROOM_CREATE_FAILED', 'The room could not be created.');
  }
  return { game: data as unknown as DbGame, inviteCode };
}

export async function joinRoom(user: Parameters<typeof displayNameForUser>[0], inviteCode: string) {
  const admin = adminClient();
  const normalized = inviteCode.trim().toUpperCase();
  if (!/^[A-Z2-9]{8}$/.test(normalized)) throw new ApiError(404, 'INVITE_NOT_FOUND', 'That room code is invalid or expired.');
  const { data: profile } = await admin.from('profiles').select('username,display_name').eq('user_id', user.id).maybeSingle();
  const fallback = profile?.username ?? user.email?.split('@')[0] ?? 'Player';
  const { data, error } = await admin.rpc('join_game_room', {
    joining_user_id: user.id,
    joining_player_key: `player-${crypto.randomUUID()}`,
    joining_display_name: profile?.display_name ?? displayNameForUser(user, fallback),
    invite_code_value: normalized,
  });
  if (error) {
    if (error.message.includes('ACTIVE_GAME_LIMIT_REACHED')) throw new ApiError(403, 'ACTIVE_GAME_LIMIT_REACHED', 'Your plan has reached its active-game limit.');
    if (error.message.includes('ROOM_FULL')) throw new ApiError(409, 'ROOM_FULL', 'That room already has four human players.');
    if (error.message.includes('SEATS_LOCKED')) throw new ApiError(409, 'SEATS_LOCKED', 'That game has already started.');
    throw new ApiError(404, 'INVITE_NOT_FOUND', 'That room code is invalid or expired.');
  }
  return data as unknown as DbGame;
}

export async function getRoom(gameId: string, userId: string) {
  const record = await loadCanonicalGame(gameId);
  playerForUser(record, userId);
  return roomDetails(record);
}

export async function startRoom(gameId: string, userId: string): Promise<GameSnapshot> {
  const admin = adminClient();
  const record = await loadCanonicalGame(gameId);
  if (record.game.owner_id !== userId) throw new ApiError(403, 'HOST_REQUIRED', 'Only the host can start this room.');
  if (record.game.status !== 'lobby') throw new ApiError(409, 'GAME_ALREADY_STARTED', 'This game has already started.');
  const occupied = new Map(record.players.map((player) => [player.seat, player]));
  const roster: RoomPlayer[] = seats.map((seat, index) => {
    const joined = occupied.get(seat);
    if (joined) return roomPlayer(joined);
    return {
      userId: null,
      playerKey: `bot-${seat}-${crypto.randomUUID()}`,
      seat,
      controllerType: 'bot',
      assistanceLevel: 4,
      displayName: ['Mara', 'June', 'Theo', 'Sage'][index],
      joinStatus: 'joined',
      timeoutCount: 0,
    };
  });
  const seed = randomSeed();
  const initial = createGame({
    id: gameId,
    seed,
    players: roster.map((player) => ({
      id: player.playerKey,
      name: player.displayName,
      seat: player.seat,
      type: player.controllerType,
      assistanceLevel: player.assistanceLevel,
    })),
  });
  const advanced = advanceBotsUntilHumanDecision(initial);
  const state = advanced.state;
  const deadlineAt = deadlineForState(state, record.game.mode, record.game.turn_seconds, record.game.response_seconds);
  const seedReference = crypto.randomUUID();
  const { error } = await admin.rpc('start_game_room', {
    requested_game_id: gameId,
    requesting_user_id: userId,
    roster: roster.map((player) => ({
      userId: player.userId ?? '', playerKey: player.playerKey, seat: player.seat,
      controllerType: player.controllerType, assistanceLevel: player.assistanceLevel, displayName: player.displayName,
    })),
    initial_state: toJson(state),
    initial_public_state: toJson(getPublicGameState(state)),
    initial_deadline: deadlineAt as unknown as string,
    seed_reference: seedReference,
  });
  if (error) throw new ApiError(409, 'START_FAILED', error.message.includes('HOST_REQUIRED') ? 'Only the host can start this room.' : 'The game could not be started.');
  await createTurnNotification({ ...record, game: { ...record.game, status: 'active', deadline_at: deadlineAt } }, state);
  const player = roster.find((item) => item.userId === userId)!;
  return snapshotForPlayer(state, player.playerKey, 'active', record.game.mode, deadlineAt, state.events.map(sanitizePublicEvent))!;
}

export async function getSnapshot(gameId: string, userId: string) {
  const startedAt = Date.now();
  const record = await loadCanonicalGame(gameId);
  const player = playerForUser(record, userId);
  if (!record.state) throw new ApiError(409, 'GAME_NOT_STARTED', 'The room is waiting for the host to start.');
  const recent = record.state.events.slice(-24);
  const snapshot = snapshotForPlayer(record.state, player.player_key, record.game.status, record.game.mode, record.game.deadline_at, recent);
  if (snapshot && player.join_status === 'replaced') {
    snapshot.privateState.rack = [];
    snapshot.privateState.pendingAction = 'wait';
  }
  void recordOperationalEvent({ eventType: 'snapshot.fetch', gameId, userId, stateVersion: record.game.state_version, durationMs: Date.now() - startedAt });
  return snapshot;
}

async function createTurnNotification(record: CanonicalRecord, state: GameState) {
  if (record.game.mode !== 'async') return;
  const playerKeys = requiredHumanPlayers(state);
  const users = record.players.filter((player) => player.user_id && playerKeys.includes(player.player_key));
  if (!users.length) return;
  const admin = adminClient();
  for (const player of users) {
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { count } = await admin.from('player_notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', player.user_id!).eq('game_id', record.game.id).eq('kind', 'turn_started').gte('created_at', since);
    await admin.from('player_notifications').insert({
      user_id: player.user_id!,
      game_id: record.game.id,
      kind: 'turn_started',
      payload: toJson({ gameId: record.game.id, deadlineAt: record.game.deadline_at }),
      email_status: count ? 'not_requested' : 'pending',
    });
  }
}

export async function submitAction(gameId: string, userId: string, envelope: ActionEnvelope) {
  const startedAt = Date.now();
  const admin = adminClient();
  const record = await loadCanonicalGame(gameId);
  const player = playerForUser(record, userId);
  if (record.game.status !== 'active') throw new ApiError(409, 'GAME_NOT_ACTIVE', 'This game is not currently active.');
  if (!record.state) throw new ApiError(409, 'GAME_NOT_STARTED', 'This game has not started.');
  if (player.controller_type !== 'human') throw new ApiError(403, 'SEAT_CONTROLLED_BY_BOT', 'This seat is now controlled by a bot.');
  if (record.game.state_version !== envelope.expectedStateVersion) {
    void recordOperationalEvent({ eventType: 'action.conflict', gameId, userId, stateVersion: record.game.state_version, durationMs: Date.now() - startedAt, metadata: { expectedVersion: envelope.expectedStateVersion } });
    throw new ApiError(409, 'STATE_CONFLICT', `The game advanced to version ${record.game.state_version}. Refresh the snapshot.`);
  }
  const result = applyHumanActionAndAdvance(record.state, player.player_key, envelope.action);
  if ('violation' in result) throw new ApiError(422, result.code, result.violation);
  const status: GameStatus = result.state.phase === 'completed' ? 'completed' : 'active';
  const deadlineAt = deadlineForState(result.state, record.game.mode, record.game.turn_seconds, record.game.response_seconds);
  const snapshot = snapshotForPlayer(result.state, player.player_key, status, record.game.mode, deadlineAt, result.events);
  const requestHash = await sha256(JSON.stringify({ gameId, userId, envelope }));
  const { data, error } = await admin.rpc('commit_game_action', {
    requested_game_id: gameId,
    requested_action_id: envelope.actionId,
    acting_user_id: userId,
    acting_player_key: player.player_key,
    expected_version: envelope.expectedStateVersion,
    action_type_value: envelope.action.type,
    request_hash_value: requestHash,
    next_state: toJson(result.state),
    next_public_state: toJson(getPublicGameState(result.state)),
    emitted_events: toJson(result.events),
    next_deadline: deadlineAt as unknown as string,
    next_status: status,
    next_phase: result.state.phase,
    response_value: toJson(snapshot),
    response_status_value: 200,
  });
  if (error) {
    if (error.message.includes('ACTION_ID_REUSED')) throw new ApiError(409, 'ACTION_ID_REUSED', 'That action ID was already used for a different request.');
    throw new ApiError(500, 'ACTION_COMMIT_FAILED', 'The action could not be saved.');
  }
  const committed = data as unknown as { conflict?: boolean; latestVersion?: number; response?: GameSnapshot } | null;
  if (committed?.conflict) throw new ApiError(409, 'STATE_CONFLICT', `The game advanced to version ${committed.latestVersion}. Refresh the snapshot.`);
  await createTurnNotification({ ...record, game: { ...record.game, deadline_at: deadlineAt } }, result.state);
  void recordOperationalEvent({ eventType: 'action.accepted', gameId, userId, stateVersion: result.state.stateVersion, durationMs: Date.now() - startedAt, metadata: { actionType: envelope.action.type, botEvents: Math.max(0, result.events.length - 1) } });
  return committed?.response ?? snapshot;
}

export async function submitTimeoutAction(gameId: string, expectedVersion: number) {
  const startedAt = Date.now();
  const admin = adminClient();
  const record = await loadCanonicalGame(gameId);
  if (!record.state || record.game.status !== 'active' || record.game.state_version !== expectedVersion) return null;
  const timedOutKeys = requiredHumanPlayers(record.state);
  if (!timedOutKeys.length) return null;
  let state = structuredClone(record.state);
  const events: GameEvent[] = [];
  const replaced: string[] = [];
  for (const playerKey of timedOutKeys) {
    const dbPlayer = record.players.find((player) => player.player_key === playerKey);
    if (!dbPlayer) continue;
    const nextTimeoutCount = Math.min(3, dbPlayer.timeout_count + 1);
    const before = state.eventSequence;
    if (nextTimeoutCount >= 3) {
      const statePlayer = state.players.find((player) => player.id === playerKey);
      if (statePlayer) statePlayer.type = 'bot';
      replaced.push(playerKey);
    }
    if (state.charlestonAwaitingDecision) {
      const action = { type: 'CHOOSE_SECOND_CHARLESTON', continue: false } as const;
      const applied = applyHumanActionAndAdvance(state, playerKey, action);
      if (!('violation' in applied)) { state = applied.state; events.push(...applied.events); }
    } else {
      state = runBotAction(state, playerKey);
      if (nextTimeoutCount >= 3) state = advanceBotsUntilHumanDecision(state).state;
    }
    events.push(...state.events.filter((event) => event.sequence > before && !events.some((existing) => existing.sequence === event.sequence)));
  }
  if (state.stateVersion <= expectedVersion) return null;
  const status: GameStatus = state.phase === 'completed' ? 'completed' : 'active';
  const deadlineAt = deadlineForState(state, record.game.mode, record.game.turn_seconds, record.game.response_seconds);
  const actionId = await deterministicUuid(`timeout:${gameId}:${expectedVersion}:${timedOutKeys.sort().join(',')}`);
  const response = { stateVersion: state.stateVersion, timedOutPlayerKeys: timedOutKeys, replacedPlayerKeys: replaced };
  const { data, error } = await admin.rpc('commit_game_action', {
    requested_game_id: gameId,
    requested_action_id: actionId,
    acting_user_id: null as unknown as string,
    acting_player_key: timedOutKeys.join(','),
    expected_version: expectedVersion,
    action_type_value: 'TIMEOUT',
    request_hash_value: await sha256(JSON.stringify(response)),
    next_state: toJson(state),
    next_public_state: toJson(getPublicGameState(state)),
    emitted_events: toJson(events),
    next_deadline: deadlineAt as unknown as string,
    next_status: status,
    next_phase: state.phase,
    response_value: toJson(response),
    response_status_value: 200,
    timeout_player_keys: toJson(timedOutKeys),
    replacement_player_keys: toJson(replaced),
  });
  const committed = data as unknown as { conflict?: boolean } | null;
  if (error || committed?.conflict) return null;
  void recordOperationalEvent({ eventType: 'timeout.processed', gameId, stateVersion: state.stateVersion, durationMs: Date.now() - startedAt, metadata: { timedOutPlayerKeys: timedOutKeys, replacedPlayerKeys: replaced } });
  return response;
}
