import { describe, expect, it } from 'vitest';
import { charlestonHandOptions, charlestonShuffleDirections, dealCharlestonShuffle, exchangeCharlestonTiles } from '../src/game/charleston-shuffle';

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

  it('reports the strongest three lines in descending tile fit', () => {
    const rack = dealCharlestonShuffle(2026).players[0].rack;
    const options = charlestonHandOptions(rack);
    expect(options).toHaveLength(3);
    expect(options.map(option => option.fit)).toEqual(options.map(option => option.fit).sort((a, b) => b - a));
    expect(options.every(option => option.fit >= 0 && option.fit <= 14)).toBe(true);
  });
});
