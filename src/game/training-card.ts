import { tileKey } from './tiles';
import type { Exposure, ExposureKind, HandCandidate, HandDefinition, HandDefinitionProvider, HandGroup, Tile } from './types';

const group = (id: string, tile: string, kind: HandGroup['kind'], count: number, jokerAllowed = count >= 3): HandGroup => ({
  id,
  tileKey: tile,
  kind,
  count,
  jokerAllowed,
});

const hands: HandDefinition[] = [
  {
    id: 'garden-path', section: 'Consecutive Runs', name: 'Garden Path',
    description: 'Pairs of 1–6 Bams with a pair of Flowers.', exposure: 'concealed',
    teachingPoint: 'Singles and pairs must be natural, so this hand cannot use Jokers or ordinary calls.',
    groups: [
      group('b1', 'bamboo-1', 'pair', 2, false), group('b2', 'bamboo-2', 'pair', 2, false),
      group('b3', 'bamboo-3', 'pair', 2, false), group('b4', 'bamboo-4', 'pair', 2, false),
      group('b5', 'bamboo-5', 'pair', 2, false), group('b6', 'bamboo-6', 'pair', 2, false),
      group('flowers', 'flower-any', 'pair', 2, false),
    ],
  },
  {
    id: 'evening-dots', section: 'Like Numbers', name: 'Evening Dots',
    description: 'Pungs of 2, 4, 6 and 8 Dots with a pair of East Winds.', exposure: 'exposed',
    teachingPoint: 'Pungs may be called and may contain Jokers; the final pair must be natural.',
    groups: [
      group('d2', 'dots-2', 'pung', 3), group('d4', 'dots-4', 'pung', 3),
      group('d6', 'dots-6', 'pung', 3), group('d8', 'dots-8', 'pung', 3),
      group('east', 'wind-east', 'pair', 2, false),
    ],
  },
  {
    id: 'three-suit-sixes', section: 'Like Numbers', name: 'Sixes Across',
    description: 'Kongs of 6 in all three suits with a pair of Red Dragons.', exposure: 'exposed',
    teachingPoint: 'A called Kong is already your 14th tile; expose it, then discard without drawing.',
    groups: [
      group('b6', 'bamboo-6', 'kong', 4), group('c6', 'characters-6', 'kong', 4),
      group('d6', 'dots-6', 'kong', 4), group('red', 'dragon-red', 'pair', 2, false),
    ],
  },
  {
    id: 'compass-rose', section: 'Winds & Dragons', name: 'Compass Rose',
    description: 'Pungs of every Wind with a pair of Green Dragons.', exposure: 'exposed',
    teachingPoint: 'Winds are suitless. Each Pung is callable; the Dragon pair stays concealed until Mahjong.',
    groups: [
      group('north', 'wind-north', 'pung', 3), group('east', 'wind-east', 'pung', 3),
      group('south', 'wind-south', 'pung', 3), group('west', 'wind-west', 'pung', 3),
      group('green', 'dragon-green', 'pair', 2, false),
    ],
  },
  {
    id: 'lucky-fives', section: 'Jokers & Quints', name: 'Lucky Fives',
    description: 'Quints of 5 Bams and 5 Craks with a Kong of Flowers.', exposure: 'exposed',
    teachingPoint: 'A Quint needs at least one Joker because only four matching natural tiles exist.',
    groups: [
      group('b5', 'bamboo-5', 'quint', 5), group('c5', 'characters-5', 'quint', 5),
      group('flowers', 'flower-any', 'kong', 4),
    ],
  },
];

export interface LegalCallOption {
  handId: string;
  groupId: string;
  kind: ExposureKind;
  rackTileIds: string[];
}

export function cardTileKey(tile: Tile): string {
  return tile.type.kind === 'flower' ? 'flower-any' : tileKey(tile);
}

function exposureMatchesGroup(exposure: Exposure, candidate: HandGroup): boolean {
  if (candidate.kind !== exposure.kind || candidate.count !== exposure.tiles.length) return false;
  return exposure.tiles.every((tile) => tile.type.kind === 'joker'
    ? candidate.jokerAllowed
    : cardTileKey(tile) === candidate.tileKey);
}

function matchExposureGroups(exposures: Exposure[], hand: HandDefinition): number[] | null {
  if (exposures.length > 0 && hand.exposure === 'concealed') return null;
  const available = hand.groups.map((_, index) => index);
  const used: number[] = [];
  for (const exposure of exposures) {
    const availableIndex = available.findIndex((groupIndex) => exposureMatchesGroup(exposure, hand.groups[groupIndex]));
    if (availableIndex === -1) return null;
    used.push(available[availableIndex]);
    available.splice(availableIndex, 1);
  }
  return used;
}

function scoreHand(tiles: Tile[], exposures: Exposure[], hand: HandDefinition): HandCandidate {
  if (!matchExposureGroups(exposures, hand)) {
    return { handId: hand.id, name: hand.name, completionDistance: 14, matchingTileIds: [], recommendationScore: -1000, reasonCodes: ['EXPOSURE_CONFLICT'], viable: false };
  }

  const naturals = new Map<string, Tile[]>();
  const jokers: Tile[] = [];
  for (const tile of tiles) {
    if (tile.type.kind === 'joker') jokers.push(tile);
    else {
      const key = cardTileKey(tile);
      naturals.set(key, [...(naturals.get(key) ?? []), tile]);
    }
  }

  const matchingTileIds: string[] = [];
  let jokerIndex = 0;
  for (const required of hand.groups) {
    const available = naturals.get(required.tileKey) ?? [];
    const matches = available.splice(0, required.count);
    matchingTileIds.push(...matches.map((tile) => tile.id));
    let remaining = required.count - matches.length;
    while (remaining > 0 && required.jokerAllowed && jokerIndex < jokers.length) {
      matchingTileIds.push(jokers[jokerIndex].id);
      jokerIndex += 1;
      remaining -= 1;
    }
  }

  const completionDistance = Math.max(0, 14 - matchingTileIds.length);
  return {
    handId: hand.id, name: hand.name, completionDistance, matchingTileIds,
    recommendationScore: matchingTileIds.length * 10 - completionDistance + (hand.exposure === 'concealed' ? 1 : 0),
    reasonCodes: matchingTileIds.length >= 6 ? ['STRONG_EXISTING_SHAPE'] : ['FLEXIBLE_START'], viable: true,
  };
}

export function getLegalCallOptions(rack: Tile[], exposures: Exposure[], discard: Tile): LegalCallOption[] {
  if (discard.type.kind === 'joker') return [];
  const discardKey = cardTileKey(discard);
  const options: LegalCallOption[] = [];
  const seen = new Set<string>();

  for (const hand of hands) {
    if (hand.exposure !== 'exposed') continue;
    const usedGroups = matchExposureGroups(exposures, hand);
    if (!usedGroups) continue;
    for (const [groupIndex, target] of hand.groups.entries()) {
      if (usedGroups.includes(groupIndex) || target.tileKey !== discardKey || !['pung', 'kong', 'quint', 'sextet'].includes(target.kind)) continue;
      const naturalMatches = rack.filter((tile) => tile.type.kind !== 'joker' && cardTileKey(tile) === discardKey);
      const jokerMatches = target.jokerAllowed ? rack.filter((tile) => tile.type.kind === 'joker') : [];
      const selected = [...naturalMatches, ...jokerMatches].slice(0, target.count - 1);
      if (selected.length !== target.count - 1) continue;
      const signature = `${target.kind}:${selected.map((tile) => tile.id).sort().join(',')}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      options.push({ handId: hand.id, groupId: target.id, kind: target.kind as ExposureKind, rackTileIds: selected.map((tile) => tile.id) });
    }
  }

  return options.sort((left, right) => left.rackTileIds.length - right.rackTileIds.length);
}

export const TrainingCardProvider: HandDefinitionProvider = {
  id: 'training-card', name: 'The Mahjong Room Training Card', version: '2.0.0',
  getSections: () => [...new Set(hands.map((hand) => hand.section))],
  getHands: () => hands,
  validateMahjong(tiles, exposures = []) {
    if (tiles.length !== 14) return { valid: false, message: `A Mahjong hand must contain exactly 14 tiles; this hand has ${tiles.length}.` };
    const match = hands.map((hand) => scoreHand(tiles, exposures, hand)).find((candidate) => candidate.viable && candidate.completionDistance === 0);
    return match ? { valid: true, handId: match.handId, message: 'Mahjong!' } : { valid: false, message: 'This hand does not exactly match a legal Training Card line.' };
  },
  analyzeCandidates(tiles, exposures = []) {
    return hands.map((hand) => scoreHand(tiles, exposures, hand)).sort((a, b) => b.recommendationScore - a.recommendationScore);
  },
};
