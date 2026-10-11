import { describe, expect, it } from 'vitest';
import { arrangeHand, cardTileKey, createCardProvider, TrainingCardProvider } from '../src/game/training-card';
import { PhotoCardProvider } from '../src/game/photo-card';
import { createWall } from '../src/game/tiles';
import type { Exposure, HandDefinition, Tile } from '../src/game/types';

function physicalHand(hand: HandDefinition): Tile[] {
  const wall = createWall();
  return [...hand.groups].sort((a, b) => Number(a.jokerAllowed) - Number(b.jokerAllowed)).flatMap(group => Array.from({ length: group.count }, () => {
    let index = wall.findIndex(tile => cardTileKey(tile) === group.tileKey);
    if (index < 0 && group.jokerAllowed) index = wall.findIndex(tile => tile.type.kind === 'joker');
    return wall.splice(index, 1)[0];
  }));
}

describe('Card companion arrangement', () => {
  it('aligns all concrete card variants without losing or duplicating tiles', () => {
    for (const provider of [TrainingCardProvider, PhotoCardProvider]) for (const hand of provider.getHands()) {
      const tiles = physicalHand(hand).reverse();
      const layout = arrangeHand(tiles, [], hand);
      expect(layout.viable, hand.id).toBe(true);
      expect(layout.matchingTileIds, hand.id).toHaveLength(14);
      expect(new Set(layout.matchingTileIds).size).toBe(14);
      expect(layout.extras).toHaveLength(0);
      for (const group of layout.groups) for (const tile of group.slots) {
        expect(tile && (cardTileKey(tile) === group.required.tileKey || (tile.type.kind === 'joker' && group.required.jokerAllowed))).toBe(true);
      }
    }
  });
  it('reserves naturals for a pair when a Joker can fill the same tile in a pung', () => {
    const hand: HandDefinition = { id: 'duplicate', name: 'Duplicate', section: 'Test', description: '', exposure: 'exposed', teachingPoint: '', groups: [
      { id: 'pung', tileKey: 'bamboo-1', kind: 'pung', count: 3, jokerAllowed: true },
      { id: 'pair', tileKey: 'bamboo-1', kind: 'pair', count: 2, jokerAllowed: false },
      { id: 'other', tileKey: 'flower-any', kind: 'single', count: 1, jokerAllowed: false },
    ] };
    const tiles = createWall().filter(tile => cardTileKey(tile) === 'bamboo-1' || tile.type.kind === 'joker').slice(0, 5);
    const layout = arrangeHand(tiles, [], hand);
    expect(layout.groups[1].slots.every(tile => tile && cardTileKey(tile) === 'bamboo-1')).toBe(true);
    expect(layout.groups[0].slots.some(tile => tile?.type.kind === 'joker')).toBe(true);
    expect(layout.groups[2].slots).toEqual([null]);
  });
  it('locks exposed sets to their group and marks incompatible exposures as blocked', () => {
    const hand = TrainingCardProvider.getHands().find(hand => hand.id === 'evening-dots')!;
    const tiles = physicalHand(hand);
    const exposure: Exposure = { id: 'e', kind: 'pung', tiles: tiles.filter(tile => cardTileKey(tile) === 'dots-2'), calledFromPlayerId: 'other' };
    const layout = arrangeHand(tiles, [exposure], hand);
    expect(layout.groups[0].exposed).toBe(true);
    expect(layout.groups[0].slots.map(tile => tile?.id)).toEqual(exposure.tiles.map(tile => tile.id));
    expect(layout.matchingTileIds).toHaveLength(14);
    const concealed = TrainingCardProvider.getHands().find(hand => hand.id === 'garden-path')!;
    expect(arrangeHand(tiles, [exposure], concealed).viable).toBe(false);
    expect(arrangeHand(tiles, [{ ...exposure, kind: 'kong' }], hand).viable).toBe(false);
  });
  it('separates extras and never treats a Joker as a missing natural pair', () => {
    const hand = TrainingCardProvider.getHands().find(hand => hand.id === 'garden-path')!;
    const tiles = physicalHand(hand);
    const joker = createWall().find(tile => tile.type.kind === 'joker')!;
    tiles[0] = joker;
    const layout = arrangeHand(tiles, [], hand);
    expect(layout.matchingTileIds).toHaveLength(13);
    expect(layout.extras).toEqual([joker]);
    expect(createCardProvider('test', 'Test', [hand]).validateMahjong(tiles).valid).toBe(false);
  });
});
