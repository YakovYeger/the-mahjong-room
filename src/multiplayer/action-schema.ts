import { z } from 'zod';
import type { GameAction } from '../game/types';
import type { ActionEnvelope } from './types';

const id = z.string().min(1).max(120);
const ids = (maximum: number) => z.array(id).max(maximum).refine((values) => new Set(values).size === values.length);

// Keep the transport contract shared. Legality still belongs to the rules engine.
export const gameActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('PASS_TILES'), tileIds: ids(3), blindCount: z.number().int().min(0).max(2).optional() }),
  z.strictObject({ type: z.literal('COURTESY_PASS'), tileIds: ids(3) }),
  z.strictObject({ type: z.literal('CHOOSE_SECOND_CHARLESTON'), continue: z.boolean() }),
  z.strictObject({ type: z.literal('DRAW_TILE') }),
  z.strictObject({ type: z.literal('PASS_ON_DISCARD') }),
  z.strictObject({ type: z.literal('DISCARD_TILE'), tileId: id }),
  z.strictObject({ type: z.literal('CALL_TILE'), rackTileIds: ids(5) }),
  z.strictObject({ type: z.literal('EXCHANGE_JOKER'), exposureOwnerId: id, exposureId: id, rackTileId: id, jokerTileId: id }),
  z.strictObject({ type: z.literal('DECLARE_MAHJONG'), useDiscard: z.boolean().optional() }),
]) satisfies z.ZodType<GameAction>;

export const actionEnvelopeSchema = z.strictObject({
  actionId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  expectedStateVersion: z.number().int().min(1),
  action: gameActionSchema,
}) satisfies z.ZodType<ActionEnvelope>;

export function isGameAction(value: unknown): value is GameAction {
  return gameActionSchema.safeParse(value).success;
}

export function isActionEnvelope(value: unknown): value is ActionEnvelope {
  return actionEnvelopeSchema.safeParse(value).success;
}
