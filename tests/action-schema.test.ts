import { describe, expect, it } from 'vitest';
import { isActionEnvelope, isGameAction } from '../src/multiplayer/action-schema';

describe('shared network action contract', () => {
  it.each([
    { type: 'PASS_TILES', tileIds: ['a', 'b'], blindCount: 1 },
    { type: 'COURTESY_PASS', tileIds: [] },
    { type: 'CHOOSE_SECOND_CHARLESTON', continue: false },
    { type: 'DRAW_TILE' }, { type: 'DISCARD_TILE', tileId: 'a' },
    { type: 'CALL_TILE', rackTileIds: ['a', 'b', 'c', 'd', 'e'] },
    { type: 'PASS_ON_DISCARD' }, { type: 'DECLARE_MAHJONG', useDiscard: true },
    { type: 'EXCHANGE_JOKER', exposureOwnerId: 'a', exposureId: 'b', rackTileId: 'c', jokerTileId: 'd' },
  ])('accepts $type', (action) => expect(isGameAction(action)).toBe(true));

  it.each([
    null, [], { type: 'UNKNOWN' }, { type: 'DRAW_TILE', seed: 123 },
    { type: 'DISCARD_TILE', tileId: '' }, { type: 'DISCARD_TILE', tileId: 'a'.repeat(121) },
    { type: 'PASS_TILES', tileIds: ['a', 'a'] }, { type: 'PASS_TILES', tileIds: ['a'], blindCount: 1.5 },
    { type: 'PASS_TILES', tileIds: ['a', 'b', 'c', 'd'] },
    { type: 'CALL_TILE', rackTileIds: ['a', 'b', 'c', 'd', 'e', 'f'] },
    { type: 'COURTESY_PASS', tileIds: [42] }, { type: 'DECLARE_MAHJONG', useDiscard: 'true' },
  ])('rejects malformed or extra action fields: %j', (action) => expect(isGameAction(action)).toBe(false));

  it('does not coerce envelope versions or accept extra envelope fields', () => {
    const envelope = { actionId: '86cfac50-30ce-46b4-84ab-dbd68e37d050', expectedStateVersion: 1, action: { type: 'DRAW_TILE' } };
    expect(isActionEnvelope(envelope)).toBe(true);
    expect(isActionEnvelope({ ...envelope, expectedStateVersion: '1' })).toBe(false);
    expect(isActionEnvelope({ ...envelope, userId: 'another-user' })).toBe(false);
  });
});
