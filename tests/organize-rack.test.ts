import { expect, it } from 'vitest';
import { organizeTileIds } from '../src/game/tiles';
import type { Tile } from '../src/game/types';

it('organizes a rack by suit and ascending number without changing tiles or duplicate order', () => {
  const rack: Tile[] = [
    { id: 'joker', type: { kind: 'joker' } },
    { id: 'dot', type: { kind: 'number', suit: 'dots', rank: 1 } },
    { id: 'bam9', type: { kind: 'number', suit: 'bamboo', rank: 9 } },
    { id: 'bam2-b', type: { kind: 'number', suit: 'bamboo', rank: 2 } },
    { id: 'crak', type: { kind: 'number', suit: 'characters', rank: 3 } },
    { id: 'flower', type: { kind: 'flower', index: 1 } },
    { id: 'wind', type: { kind: 'wind', wind: 'east' } },
    { id: 'dragon', type: { kind: 'dragon', dragon: 'red' } },
    { id: 'bam2-a', type: { kind: 'number', suit: 'bamboo', rank: 2 } },
  ];
  const before = structuredClone(rack);
  const sorted = organizeTileIds(rack);
  expect(sorted).toEqual(['bam2-b', 'bam2-a', 'bam9', 'crak', 'dot', 'wind', 'dragon', 'flower', 'joker']);
  expect(rack).toEqual(before);
  expect(new Set(sorted)).toEqual(new Set(rack.map(tile => tile.id)));
  const byId = new Map(rack.map(tile => [tile.id, tile]));
  expect(organizeTileIds(sorted.map(id => byId.get(id)!))).toEqual(sorted);
});

import { organizeRack } from '../src/game/rack-order';
import { getCardProvider } from '../src/game/cards';
import { cardTileKey } from '../src/game/training-card';
import { createCoachPreview } from '../src/coach/design-fixtures';

it('puts followed-hand groups before off-pattern tiles instead of sorting by suit', () => {
  const rack = createCoachPreview('sets').players[0].rack;
  const hand = getCardProvider('training-card').getHands().find(hand => hand.name === 'Evening Dots')!;
  const byId = new Map(rack.map(tile => [tile.id, tile]));
  const result = organizeRack(rack, [], hand);
  const keys = result.map(id => cardTileKey(byId.get(id)!));
  expect(keys.slice(0, 3)).toEqual(['dots-2', 'dots-2', 'dots-2']);
  expect(keys.slice(-4)).toEqual(['bamboo-9', 'characters-1', 'wind-west', 'flower-any']);
  expect(result).not.toEqual(organizeTileIds(rack));
  expect(new Set(result)).toEqual(new Set(rack.map(tile => tile.id)));
  expect(organizeRack(rack, [])).toEqual(organizeTileIds(rack));
});

it('never moves exposed tiles into the concealed rack when arranging a followed hand', () => {
  const rack = createCoachPreview('sets').players[0].rack;
  const exposed = rack.splice(0, 3);
  const hand = getCardProvider('training-card').getHands().find(hand => hand.name === 'Evening Dots')!;
  const result = organizeRack(rack, [{ id: 'called-set', kind: 'pung', tiles: exposed, calledFromPlayerId: 'other-player' }], hand);
  expect(result).toHaveLength(rack.length);
  expect(new Set(result)).toEqual(new Set(rack.map(tile => tile.id)));
  expect(result.some(id => exposed.some(tile => tile.id === id))).toBe(false);
});
