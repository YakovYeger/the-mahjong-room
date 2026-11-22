import { describe, expect, it } from 'vitest';
import { getCardProvider } from '../src/game/cards';
import { referenceHands } from '../src/game/reference-card';
import { charlestonShuffleDirections, dealCharlestonShuffle, exchangeCharlestonTiles } from '../src/game/charleston-shuffle';

function physicalTiles(game: ReturnType<typeof dealCharlestonShuffle>) {
  return [...game.wall, ...game.players.flatMap(player => player.rack)].map(tile => tile.id).sort();
}

describe('Charleston Shuffle', () => {
  it('exchanges three physical tiles per pass, then stops before the second Charleston', () => {
    const opening = dealCharlestonShuffle(2026);
    let game = opening;
    for (const direction of charlestonShuffleDirections) {
      const outgoing = game.players[0].rack.filter(tile => tile.type.kind !== 'joker').slice(0, 3);
      const result = exchangeCharlestonTiles(game, outgoing.map(tile => tile.id))!;
      expect(result.received).toHaveLength(3);
      expect(result.received.every(tile => tile.type.kind !== 'joker')).toBe(true);
      expect(result.game.players[0].rack).toHaveLength(14);
      expect(outgoing.some(tile => result.game.players[0].rack.some(held => held.id === tile.id))).toBe(false);
      expect(result.game.events.at(-1)).toMatchObject({ type: 'CHARLESTON_PASS_COMPLETED', direction: direction.toLowerCase() });
      expect(physicalTiles(result.game)).toEqual(physicalTiles(opening));
      game = result.game;
    }
    expect(game.charlestonAwaitingDecision).toBe(true);
    const nextPass = game.players[0].rack.filter(tile => tile.type.kind !== 'joker').slice(0, 3).map(tile => tile.id);
    expect(exchangeCharlestonTiles(game, nextPass)).toBeNull();
  });

  it('rejects duplicate tiles, partial passes, and Jokers without changing the rack', () => {
    const game = dealCharlestonShuffle(2026);
    const [one, two] = game.players[0].rack.filter(tile => tile.type.kind !== 'joker');
    const joker = game.players[0].rack.find(tile => tile.type.kind === 'joker')!;
    expect(exchangeCharlestonTiles(game, [one.id, two.id])).toBeNull();
    expect(exchangeCharlestonTiles(game, [one.id, one.id, two.id])).toBeNull();
    expect(exchangeCharlestonTiles(game, [one.id, two.id, joker.id])).toBeNull();
    expect(game.players[0].rack).toEqual(dealCharlestonShuffle(2026).players[0].rack);
  });

  it('deals and ranks every printed 2025 Card line once', () => {
    const game = dealCharlestonShuffle(2026);
    expect(game.cardId).toBe('photo-2025');
    const options = getCardProvider(game.cardId).analyzeCandidates(game.players[0].rack);
    const rowIds = options.map(option => option.handId.split(':')[0]);
    expect(rowIds.sort()).toEqual(referenceHands.map(hand => hand.id).sort());
    const fits = options.map(option => option.matchingTileIds.length);
    expect(fits).toEqual([...fits].sort((a, b) => b - a));
  });
});
