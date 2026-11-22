import { describe, expect, it } from 'vitest';
import { reviewCharlestonPasses, type CharlestonExchange } from '../src/game/charleston-review';
import { arrangeHand, TrainingCardProvider } from '../src/game/training-card';
import { createWall } from '../src/game/tiles';
import type { HandDefinition, Tile } from '../src/game/types';

function swap(rack: Tile[], sent: Tile[], received: Tile[]) {
  const ids = new Set(rack.map(tile => tile.id));
  if (received.some(tile => ids.has(tile.id)) || sent.some(tile => !ids.has(tile.id) || tile.type.kind === 'joker')) return null;
  return [...rack.filter(tile => !sent.some(outgoing => tile.id === outgoing.id)), ...received];
}

function rackFit(tiles: Tile[], hands: HandDefinition[]) {
  return Math.max(...hands.map(hand => arrangeHand(tiles, [], hand).matchingTileIds.length));
}

// Using all eight physical Jokers keeps a complete enumeration small enough for a regression test.
function exhaustiveBest(rack: Tile[], arrivals: Tile[][], hands: HandDefinition[]): number {
  if (!arrivals.length) return rackFit(rack, hands);
  const eligible = rack.filter(tile => tile.type.kind !== 'joker');
  let best = -1;
  for (let a = 0; a < eligible.length - 2; a += 1) {
    for (let b = a + 1; b < eligible.length - 1; b += 1) {
      for (let c = b + 1; c < eligible.length; c += 1) {
        const next = swap(rack, [eligible[a], eligible[b], eligible[c]], arrivals[0]);
        if (next) best = Math.max(best, exhaustiveBest(next, arrivals.slice(1), hands));
      }
    }
  }
  return best;
}

describe('Charleston Shuffle pass review', () => {
  it('matches an exhaustive search and reconstructs legal passes when physical tiles return', () => {
    const wall = createWall();
    const opening = [...wall.slice(0, 6), ...wall.filter(tile => tile.type.kind === 'joker')];
    const arrivals = [[wall[6], wall[7], wall[8]], [wall[0], wall[9], wall[10]], [wall[6], wall[11], wall[12]]];
    const sent = [[wall[0], wall[1], wall[2]], [wall[3], wall[4], wall[6]], [wall[5], wall[7], wall[8]]];
    const exchanges: CharlestonExchange[] = sent.map((tiles, i) => ({ sent: tiles, received: arrivals[i] }));
    const actual = exchanges.reduce((rack, exchange) => swap(rack, exchange.sent, exchange.received)!, opening);
    const hands = TrainingCardProvider.getHands().slice(0, 1);
    const actualFit = rackFit(actual, hands);
    const expected = exhaustiveBest(opening, arrivals, hands);
    const result = reviewCharlestonPasses(opening, exchanges, hands, actualFit)!;

    expect(expected).toBeGreaterThan(actualFit);
    expect(result.bestFit).toBe(expected);
    const alternative = result.alternative!;
    const alternateExchanges = alternative.outgoing.map((tiles, i) => ({ sent: tiles, received: arrivals[i] }));
    const alternateRack = alternateExchanges.reduce((rack, exchange) => {
      expect(exchange.sent).toHaveLength(3);
      const next = swap(rack, exchange.sent, exchange.received);
      expect(next).not.toBeNull();
      expect(new Set(next!.map(tile => tile.id)).size).toBe(14);
      return next!;
    }, opening);
    expect(rackFit(alternateRack, hands)).toBe(expected);
    expect(reviewCharlestonPasses(opening, alternateExchanges, hands, expected)).toEqual({ bestFit: expected, alternative: null });
  });
});
