import { arrangeHand, cardTileKey } from './training-card';
import type { HandDefinition, Tile } from './types';

export interface CharlestonExchange {
  sent: Tile[];
  received: Tile[];
}

interface Occurrence {
  tile: Tile;
  arrival: number;
  returnsAt?: number;
}

interface Alternative {
  hand: HandDefinition;
  outgoing: Tile[][];
  rack: Tile[];
}

export interface CharlestonReview {
  bestFit: number;
  alternative: Alternative | null;
}

/** Expand a matching by moving previously assigned tiles into other eligible slots. */
function assignSlot(slot: number, edges: number[][], assigned: number[], seen: Set<number>): boolean {
  for (const occurrence of edges[slot]) {
    if (seen.has(occurrence)) continue;
    seen.add(occurrence);
    const previous = assigned[occurrence];
    if (previous !== -1 && !assignSlot(previous, edges, assigned, seen)) continue;
    assigned[occurrence] = slot;
    return true;
  }
  return false;
}

/** Find the best finish if the incoming physical tiles are fixed for each pass. */
export function reviewCharlestonPasses(opening: Tile[], exchanges: CharlestonExchange[], hands: HandDefinition[], actualFit: number): CharlestonReview | null {
  if (opening.length !== 14 || exchanges.length !== 3 || exchanges.some(exchange => exchange.sent.length !== 3 || exchange.received.length !== 3)) return null;
  if (actualFit === 14) return { bestFit: 14, alternative: null };

  const occurrences: Occurrence[] = [opening, ...exchanges.map(exchange => exchange.received)]
    .flatMap((tiles, arrival) => tiles.map(tile => ({ tile, arrival })));
  const nextArrival = new Map<string, number>();
  for (const occurrence of [...occurrences].reverse()) {
    occurrence.returnsAt = nextArrival.get(occurrence.tile.id);
    nextArrival.set(occurrence.tile.id, occurrence.arrival);
  }

  const finalPool = occurrences.filter(occurrence => occurrence.returnsAt === undefined).map(occurrence => occurrence.tile);
  const passEdges: number[][] = [];
  const startingAssignment = occurrences.map(() => -1);
  for (const [index, exchange] of exchanges.entries()) {
    const pass = index + 1;
    const eligible = occurrences.flatMap(({ tile, arrival, returnsAt }, i) =>
      tile.type.kind !== 'joker' && arrival < pass && (returnsAt === undefined || pass < returnsAt) ? [i] : []);
    for (const sent of exchange.sent) {
      const occurrence = eligible.find(i => occurrences[i].tile.id === sent.id);
      if (occurrence === undefined || startingAssignment[occurrence] !== -1) return null;
      startingAssignment[occurrence] = passEdges.length;
      passEdges.push(eligible);
    }
  }
  if (occurrences.some(({ returnsAt }, i) => returnsAt !== undefined && startingAssignment[i] === -1)) return null;

  // Seed each search with the actual nine pass slots. Augmenting this matching can
  // move tiles between legal slots, while keeping those slots and all copies that
  // must leave before a later receipt assigned. Any unassigned tiles stay in the rack.
  let bestFit = actualFit;
  let alternative: Alternative | null = null;
  const candidates = hands.map(hand => ({
    hand,
    ceiling: arrangeHand(finalPool, [], hand).matchingTileIds.length,
  })).filter(candidate => candidate.ceiling > actualFit).sort((a, b) => b.ceiling - a.ceiling);

  for (const { hand, ceiling } of candidates) {
    if (ceiling <= bestFit) break;
    const cardEdges = hand.groups.flatMap(group => {
      const eligible = occurrences.flatMap(({ tile, returnsAt }, i) => returnsAt === undefined &&
        (tile.type.kind === 'joker' ? group.jokerAllowed : cardTileKey(tile) === group.tileKey) ? [i] : []);
      return Array.from({ length: group.count }, () => eligible);
    });
    const edges = [...passEdges, ...cardEdges];
    const assigned = [...startingAssignment];
    let fit = 0;
    for (let slot = passEdges.length; slot < edges.length; slot += 1) {
      if (assignSlot(slot, edges, assigned, new Set())) fit += 1;
    }
    if (fit <= bestFit) continue;

    const outgoing: Tile[][] = exchanges.map(() => []);
    const rack: Tile[] = [];
    occurrences.forEach(({ tile }, i) => {
      const slot = assigned[i];
      if (slot >= 0 && slot < passEdges.length) outgoing[Math.floor(slot / 3)].push(tile);
      else rack.push(tile);
    });
    bestFit = fit;
    alternative = { hand, outgoing, rack };
  }
  return { bestFit, alternative };
}
