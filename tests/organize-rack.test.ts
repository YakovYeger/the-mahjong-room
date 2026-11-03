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
