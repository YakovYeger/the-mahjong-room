import { z } from 'zod';
import type { GameEvent, Tile } from '../game/types';
import type { GameSnapshot, RoomDetails } from './types';

const id = z.string().min(1).max(120);
const timestamp = z.iso.datetime({ offset: true });
const integer = z.number().int().nonnegative();
const seat = z.enum(['east', 'south', 'west', 'north']);
const status = z.enum(['lobby', 'active', 'paused', 'completed', 'abandoned']);
const mode = z.enum(['live', 'async']);
const exposureKind = z.enum(['pung', 'kong', 'quint', 'sextet']);
export const tileSchema = z.strictObject({ id, type: z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('number'), rank: z.number().int().min(1).max(9), suit: z.enum(['bamboo', 'characters', 'dots']) }),
  z.strictObject({ kind: z.literal('wind'), wind: seat }),
  z.strictObject({ kind: z.literal('dragon'), dragon: z.enum(['red', 'green', 'white']) }),
  z.strictObject({ kind: z.literal('flower'), index: z.number().int().min(1).max(8) }),
  z.strictObject({ kind: z.literal('joker') }),
]) }) satisfies z.ZodType<Tile>;
const exposure = z.strictObject({ id, kind: exposureKind, tiles: z.array(tileSchema).max(6), calledFromPlayerId: id });
const event = <T extends string, S extends z.ZodRawShape>(type: T, fields: S) => z.strictObject({ type: z.literal(type), sequence: integer, ...fields });
const gameEvent = z.discriminatedUnion('type', [
  event('GAME_CREATED', {}), event('TILES_DEALT', {}),
  event('TILES_PASSED', { playerId: id, tileIds: z.array(id).max(0) }),
  event('CHARLESTON_PASS_COMPLETED', { direction: z.enum(['right', 'across', 'left']) }),
  event('SECOND_CHARLESTON_CHOSEN', { continue: z.boolean() }),
  event('COURTESY_PASS_COMPLETED', {}), event('CHARLESTON_COMPLETED', {}),
  event('TILE_DRAWN', { playerId: id, tileId: z.literal('private') }),
  event('TILE_DISCARDED', { playerId: id, tileId: id }), event('DISCARD_CALLED', { playerId: id, tileId: id }),
  event('CALL_RESPONSE_RECORDED', { playerId: id, response: z.enum(['pass', 'exposure', 'mahjong']) }),
  event('EXPOSURE_CREATED', { playerId: id, exposureId: id, kind: exposureKind }),
  event('CALL_WINDOW_CLOSED', { playerId: id }),
  event('JOKER_EXCHANGED', { playerId: id, exposureOwnerId: id, exposureId: id, jokerTileId: id }),
  event('MAHJONG_DECLARED', { playerId: id }),
  event('PLAYER_CONTROL_CHANGED', { playerId: id, controllerType: z.literal('bot'), reason: z.enum(['disconnect', 'timeouts']) }),
  event('TURN_AUTO_RESOLVED', { playerId: id, reason: z.literal('timeout') }),
  event('GAME_ABANDONED', { reason: z.enum(['no_human_players', 'host_ended']) }),
  event('GAME_COMPLETED', { winnerId: id.nullable() }),
]) satisfies z.ZodType<GameEvent>;
export const snapshotSchema = z.strictObject({
  stateVersion: z.number().int().positive(), eventSequence: integer, deadlineAt: timestamp.nullable(), status, mode,
  publicState: z.strictObject({
    id, phase: z.enum(['charleston', 'playing', 'completed']), stateVersion: z.number().int().positive(),
    turnIndex: z.number().int().min(0).max(3), turnCount: integer, wallCount: integer.max(152),
    discards: z.array(tileSchema).max(152),
    callWindow: z.strictObject({ discard: tileSchema, discardedByPlayerId: id, responseCount: integer.max(3) }).nullable(),
    players: z.array(z.strictObject({ id, name: z.string().max(120), seat, type: z.enum(['human', 'bot']),
      assistanceLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      exposures: z.array(exposure).max(5), rackCount: integer.max(14), revealedRack: z.array(tileSchema).max(14).optional(),
    })).length(4), winnerId: id.nullable(), charlestonPassIndex: integer.max(6),
    charlestonAwaitingDecision: z.boolean(), charlestonCourtesy: z.boolean(), charlestonActorId: id.nullable(),
  }),
  privateState: z.strictObject({ playerId: id, rack: z.array(tileSchema).max(14),
    pendingAction: z.enum(['charleston_pass', 'charleston_decision', 'courtesy_pass', 'draw', 'discard', 'discard_response', 'wait', 'completed']),
  }), recentEvents: z.array(gameEvent).max(1000),
}).superRefine((value, ctx) => {
  if (value.stateVersion !== value.publicState.stateVersion) ctx.addIssue({ code: 'custom', message: 'Snapshot versions disagree.' });
  if (new Set(value.publicState.players.map((player) => player.id)).size !== 4
    || new Set(value.publicState.players.map((player) => player.seat)).size !== 4) ctx.addIssue({ code: 'custom', message: 'Invalid seat roster.' });
  if (value.status !== 'completed' && value.publicState.players.some((player) => player.revealedRack)) ctx.addIssue({ code: 'custom', message: 'Concealed racks were exposed.' });
}) satisfies z.ZodType<GameSnapshot>;
export const roomSchema = z.strictObject({
  id, ownerId: id, status, mode, turnSeconds: integer.positive(), responseSeconds: integer.positive(),
  inviteExpiresAt: timestamp.nullable(), inviteCode: z.string().max(8).nullable(),
  players: z.array(z.strictObject({ userId: id.nullable(), playerKey: id, seat,
    controllerType: z.enum(['human', 'bot']), assistanceLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    displayName: z.string().max(120), joinStatus: z.enum(['joined', 'disconnected', 'replaced']),
    timeoutCount: integer, lastActivityAt: timestamp,
  })).max(4),
}) satisfies z.ZodType<RoomDetails>;
export const tableDataSchema = z.strictObject({ room: roomSchema, snapshot: snapshotSchema.nullable(), updatedAt: timestamp, stateVersion: z.number().int().nonnegative() })
  .superRefine((data, ctx) => {
    if (data.snapshot && (data.snapshot.publicState.id !== data.room.id || data.snapshot.status !== data.room.status
      || data.snapshot.mode !== data.room.mode || data.snapshot.stateVersion !== data.stateVersion)) ctx.addIssue({ code: 'custom', message: 'Room and snapshot disagree.' });
    if (!data.snapshot && data.room.status !== 'lobby') ctx.addIssue({ code: 'custom', message: 'A started table needs a snapshot.' });
  });
export interface TableData { room: RoomDetails; snapshot: GameSnapshot | null; updatedAt: string; stateVersion: number }

export function parseTableData(value: unknown, gameId: string, userId: string): TableData {
  const data = tableDataSchema.parse(value);
  if (data.room.id !== gameId || (data.snapshot && !data.room.players.some((player) => player.userId === userId && player.playerKey === data.snapshot!.privateState.playerId))) {
    throw new Error('The table response belongs to a different player or room.');
  }
  return data;
}
