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
  {
    id: 'crak-ladder', section: 'Consecutive Runs', name: 'Crak Ladder',
    description: 'Pungs of 1–4 Craks with a pair of White Dragons.', exposure: 'exposed',
    teachingPoint: 'Build a clean consecutive run with callable Pungs while protecting the natural Dragon pair.',
    groups: [
      group('c1', 'characters-1', 'pung', 3), group('c2', 'characters-2', 'pung', 3),
      group('c3', 'characters-3', 'pung', 3), group('c4', 'characters-4', 'pung', 3),
      group('white', 'dragon-white', 'pair', 2, false),
    ],
  },
  {
    id: 'twin-runs', section: 'Consecutive Runs', name: 'Twin Runs',
    description: 'Pairs of 3–7 Dots with one of each Wind.', exposure: 'concealed',
    teachingPoint: 'Every group is a single or pair, so the hand must stay concealed and use no Jokers.',
    groups: [
      group('d3', 'dots-3', 'pair', 2, false), group('d4', 'dots-4', 'pair', 2, false),
      group('d5', 'dots-5', 'pair', 2, false), group('d6', 'dots-6', 'pair', 2, false),
      group('d7', 'dots-7', 'pair', 2, false), group('north', 'wind-north', 'single', 1, false),
      group('east', 'wind-east', 'single', 1, false), group('south', 'wind-south', 'single', 1, false),
      group('west', 'wind-west', 'single', 1, false),
    ],
  },
  {
    id: 'dragon-garden', section: 'Winds & Dragons', name: 'Dragon Garden',
    description: 'Pungs of all three Dragons with five Flowers.', exposure: 'exposed',
    teachingPoint: 'All eight Flowers match as a family, so this five-tile group may be built naturally or with Jokers.',
    groups: [
      group('red', 'dragon-red', 'pung', 3), group('green', 'dragon-green', 'pung', 3),
      group('white', 'dragon-white', 'pung', 3), group('flowers', 'flower-any', 'quint', 5),
    ],
  },
  {
    id: 'seven-stars', section: 'Jokers & Quints', name: 'Seven Stars',
    description: 'Six 7 Bams, six 7 Dots and a pair of West Winds.', exposure: 'exposed',
    teachingPoint: 'Each six-tile group needs at least two Jokers; the Wind pair must remain natural.',
    groups: [
      group('b7', 'bamboo-7', 'sextet', 6), group('d7', 'dots-7', 'sextet', 6),
      group('west', 'wind-west', 'pair', 2, false),
    ],
  },
  {
    id: 'season-line', section: '3 · 6 · 9', name: 'Season Line',
    description: 'A Kong of Flowers, Pungs of 3, 6 and 9 Craks, and one Red Dragon.', exposure: 'exposed',
    teachingPoint: 'Calls can complete the Pungs and Flower Kong, but the final single must be natural.',
    groups: [
      group('flowers', 'flower-any', 'kong', 4), group('c3', 'characters-3', 'pung', 3),
      group('c6', 'characters-6', 'pung', 3), group('c9', 'characters-9', 'pung', 3),
      group('red', 'dragon-red', 'single', 1, false),
    ],
  },
];

export interface LegalCallOption {
  handId: string;
  groupId: string;
  kind: ExposureKind;
  rackTileIds: string[];
}

export interface DiscardDeadHandAnalysis {
  dead: boolean;
  compatibleHandIds: string[];
  possibleHandIds: string[];
  message: string;
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

function physicalCopies(tileKey: string): number {
  if (tileKey === 'flower-any' || tileKey === 'joker') return 8;
  return 4;
}

function handPossibleFromDiscards(hand: HandDefinition, usedGroups: number[], exposures: Exposure[], discards: Tile[]): boolean {
  const discarded = new Map<string, number>();
  for (const tile of discards) {
    const key = cardTileKey(tile);
    discarded.set(key, (discarded.get(key) ?? 0) + 1);
  }

  const lockedNaturals = new Map<string, number>();
  let lockedJokers = 0;
  for (const exposure of exposures) {
    for (const tile of exposure.tiles) {
      if (tile.type.kind === 'joker') lockedJokers += 1;
      else {
        const key = cardTileKey(tile);
        lockedNaturals.set(key, (lockedNaturals.get(key) ?? 0) + 1);
      }
    }
  }

  const fixedNaturals = new Map<string, number>();
  const flexibleNaturals = new Map<string, number>();
  for (const [index, required] of hand.groups.entries()) {
    if (usedGroups.includes(index)) continue;
    const bucket = required.jokerAllowed ? flexibleNaturals : fixedNaturals;
    bucket.set(required.tileKey, (bucket.get(required.tileKey) ?? 0) + required.count);
  }

  let requiredJokers = 0;
  const requiredKeys = new Set([...fixedNaturals.keys(), ...flexibleNaturals.keys()]);
  for (const key of requiredKeys) {
    const naturalCapacity = Math.max(0, physicalCopies(key) - (discarded.get(key) ?? 0) - (lockedNaturals.get(key) ?? 0));
    const fixed = fixedNaturals.get(key) ?? 0;
    if (naturalCapacity < fixed) return false;
    requiredJokers += Math.max(0, (flexibleNaturals.get(key) ?? 0) - (naturalCapacity - fixed));
  }

  const jokerCapacity = Math.max(0, physicalCopies('joker') - (discarded.get('joker') ?? 0) - lockedJokers);
  return requiredJokers <= jokerCapacity;
}

export function analyzeDiscardDeadHand(exposures: Exposure[], discards: Tile[]): DiscardDeadHandAnalysis {
  const compatible = hands.flatMap((hand) => {
    const usedGroups = matchExposureGroups(exposures, hand);
    return usedGroups ? [{ hand, usedGroups }] : [];
  });
  const possible = compatible.filter(({ hand, usedGroups }) => handPossibleFromDiscards(hand, usedGroups, exposures, discards));
  const dead = compatible.length > 0 && possible.length === 0;
  return {
    dead,
    compatibleHandIds: compatible.map(({ hand }) => hand.id),
    possibleHandIds: possible.map(({ hand }) => hand.id),
    message: dead
      ? 'The visible discard pool proves that every compatible Training Card line is now unavailable.'
      : 'At least one compatible Training Card line remains possible from the visible discard pool.',
  };
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
  id: 'training-card', name: 'The Mahjong Room Training Card', version: '3.0.0',
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
