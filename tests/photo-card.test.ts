import { describe, expect, it } from 'vitest';
import { PhotoCardProvider } from '../src/game/photo-card';
import { referenceHands, referenceSections } from '../src/game/reference-card';
import { cardTileKey, getLegalCallOptions, TrainingCardProvider, createCardProvider } from '../src/game/training-card';
import { createWall } from '../src/game/tiles';
import { applyGameAction, createGame } from '../src/game/engine';
import { getCoachVisibleContext } from '../src/coach/analyze';
import type { HandDefinition, Tile, Exposure } from '../src/game/types';

function example(hand: HandDefinition): Tile[] {
  const wall = createWall();
  // Reserve naturals for singles/pairs before spending extras on joker-eligible groups.
  return [...hand.groups].sort((a,b) => Number(a.jokerAllowed) - Number(b.jokerAllowed)).flatMap(group => Array.from({length: group.count}, () => {
    let index = wall.findIndex(tile => cardTileKey(tile) === group.tileKey);
    if (index === -1 && group.jokerAllowed) index = wall.findIndex(tile => tile.type.kind === 'joker');
    if (index === -1) throw new Error(`Impossible ${hand.name}: ${group.tileKey}`);
    return wall.splice(index,1)[0];
  }));
}

describe('Photographed 2025 playable card', () => {
  it('contains all 55 photographed lines across nine sections, with 14 tiles in every variation', () => {
    expect(referenceHands).toHaveLength(55);
    expect(referenceSections).toHaveLength(9);
    const hands = PhotoCardProvider.getHands();
    expect(new Set(hands.map(h => h.id.split(':')[0])).size).toBe(55);
    for (const hand of hands) {
      expect(hand.groups.reduce((n,g) => n + g.count,0)).toBe(14);
      expect(example(hand)).toHaveLength(14);
      for (const group of hand.groups) if (/^(bamboo|dots|characters)-/.test(group.tileKey)) expect(Number(group.tileKey.split('-')[1])).toBeGreaterThanOrEqual(1);
      for (const group of hand.groups) if (/^(bamboo|dots|characters)-/.test(group.tileKey)) expect(Number(group.tileKey.split('-')[1])).toBeLessThanOrEqual(9);
    }
  });
  it('validates a physical example of every printed line', () => {
    for (const row of referenceHands) {
      const hand = PhotoCardProvider.getHands().find(h => h.id.startsWith(`${row.id}:`))!;
      expect(PhotoCardProvider.validateMahjong(example(hand)).valid, row.id).toBe(true);
    }
  });
  it('uses White Dragons as natural zeros and rejects a joker in the concealed year hand', () => {
    const hand = PhotoCardProvider.getHands().find(h => h.id.startsWith('photo-2025-55:'))!;
    const tiles = example(hand);
    expect(tiles.filter(t => cardTileKey(t) === 'dragon-white')).toHaveLength(3);
    const invalid = [...tiles];
    invalid[invalid.findIndex(t => cardTileKey(t) === 'dragon-white')] = createWall().find(t => t.type.kind === 'joker')!;
    expect(PhotoCardProvider.validateMahjong(invalid).valid).toBe(false);
  });
  it('supports quints with jokers, and keeps concealed hands out of legal calls', () => {
    const quint = PhotoCardProvider.getHands().find(h => h.id.startsWith('photo-2025-17:'))!;
    const tiles = example(quint);
    expect(tiles.filter(t => t.type.kind === 'joker')).toHaveLength(2);
    expect(PhotoCardProvider.validateMahjong(tiles).valid).toBe(true);
    const concealed = PhotoCardProvider.getHands().find(h => h.id.startsWith('photo-2025-55:'))!;
    expect(getLegalCallOptions(example(concealed).slice(1), [], example(concealed)[0], [concealed])).toEqual([]);
  });
  it('keeps exposed naturals locked instead of spending them on a concealed pair', () => {
    const hand: HandDefinition = { id: 'locked-pair', section: 'Test', name: 'Locked pair', description: '', teachingPoint: '', exposure: 'exposed', groups: [
      {id:'pair',tileKey:'bamboo-1',kind:'pair',count:2,jokerAllowed:false},
      {id:'kong',tileKey:'bamboo-1',kind:'kong',count:4,jokerAllowed:true},
      {id:'dots',tileKey:'dots-2',kind:'kong',count:4,jokerAllowed:true},
      {id:'craks',tileKey:'characters-3',kind:'kong',count:4,jokerAllowed:true},
    ] };
    const wall = createWall(), pick = (key: string, n: number) => wall.filter(t => cardTileKey(t) === key).slice(0,n);
    const exposure: Exposure = { id:'called',kind:'kong',tiles:pick('bamboo-1',4),calledFromPlayerId:'other' };
    const invalid = [...exposure.tiles, ...pick('joker',2), ...pick('dots-2',4), ...pick('characters-3',4)];
    expect(createCardProvider('test','Test',[hand]).validateMahjong(invalid,[exposure]).valid).toBe(false);
  });
  it('uses the selected card for declarations and coaching, while preserving legacy defaults', () => {
    const hand = PhotoCardProvider.getHands().find(h => h.id.startsWith('photo-2025-55:'))!;
    const game = createGame({seed: 123, cardId: 'photo-2025'});
    game.phase = 'playing'; game.players[0].rack = example(hand);
    expect(getCoachVisibleContext(game, 'human')!.candidates[0].completionDistance).toBe(0);
    expect(TrainingCardProvider.validateMahjong(game.players[0].rack).valid).toBe(false);
    expect(applyGameAction(game, 'human', {type:'DECLARE_MAHJONG'}).ok).toBe(true);
    expect(createGame().cardId).toBe('training-card');
  });
});
