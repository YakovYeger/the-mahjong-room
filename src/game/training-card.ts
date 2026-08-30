import { tileKey } from './tiles';
import type { HandCandidate, HandDefinition, HandDefinitionProvider, Tile } from './types';

const repeat = (key: string, count: number) => Array.from({ length: count }, () => key);

const hands: HandDefinition[] = [
  {
    id: 'garden-path', section: 'Runs', name: 'Garden Path',
    description: 'A 1–2–3–4–5–6 Bam run, paired, plus two flowers.',
    tiles: [...repeat('bamboo-1', 2), ...repeat('bamboo-2', 2), ...repeat('bamboo-3', 2), ...repeat('bamboo-4', 2), ...repeat('bamboo-5', 2), ...repeat('bamboo-6', 2), 'flower-any', 'flower-any'],
  },
  {
    id: 'evening-dots', section: 'Like Numbers', name: 'Evening Dots',
    description: 'Pairs of even Dots with a pair of East winds.',
    tiles: [...repeat('dots-2', 3), ...repeat('dots-4', 3), ...repeat('dots-6', 3), ...repeat('dots-8', 3), ...repeat('wind-east', 2)],
  },
  {
    id: 'three-suit-sixes', section: 'Like Numbers', name: 'Sixes Across',
    description: 'Four sixes in each suit plus two red dragons.',
    tiles: [...repeat('bamboo-6', 4), ...repeat('characters-6', 4), ...repeat('dots-6', 4), ...repeat('dragon-red', 2)],
  },
  {
    id: 'compass-rose', section: 'Winds', name: 'Compass Rose',
    description: 'Three of each wind plus a pair of green dragons.',
    tiles: [...repeat('wind-north', 3), ...repeat('wind-east', 3), ...repeat('wind-south', 3), ...repeat('wind-west', 3), ...repeat('dragon-green', 2)],
  },
];

function scoreHand(tiles: Tile[], hand: HandDefinition): HandCandidate {
  const available = new Map<string, Tile[]>();
  for (const tile of tiles) {
    const key = tile.type.kind === 'flower' ? 'flower-any' : tileKey(tile);
    available.set(key, [...(available.get(key) ?? []), tile]);
  }
  const matchingTileIds: string[] = [];
  const needed = new Map<string, number>();
  for (const key of hand.tiles) needed.set(key, (needed.get(key) ?? 0) + 1);
  for (const [key, count] of needed) matchingTileIds.push(...(available.get(key) ?? []).slice(0, count).map((tile) => tile.id));
  const completionDistance = Math.max(0, 14 - matchingTileIds.length);
  return {
    handId: hand.id,
    name: hand.name,
    completionDistance,
    matchingTileIds,
    recommendationScore: matchingTileIds.length * 10 - completionDistance,
    reasonCodes: matchingTileIds.length >= 6 ? ['STRONG_EXISTING_SHAPE'] : ['FLEXIBLE_START'],
  };
}

export const TrainingCardProvider: HandDefinitionProvider = {
  id: 'training-card',
  name: 'The Mahjong Room Training Card',
  version: '1.0.0',
  getSections: () => [...new Set(hands.map((hand) => hand.section))],
  getHands: () => hands,
  validateMahjong(tiles) {
    const match = hands.map((hand) => scoreHand(tiles, hand)).find((candidate) => candidate.completionDistance === 0);
    return match ? { valid: true, handId: match.handId, message: 'Mahjong!' } : { valid: false, message: 'This rack does not yet match a Training Card hand.' };
  },
  analyzeCandidates(tiles) {
    return hands.map((hand) => scoreHand(tiles, hand)).sort((a, b) => b.recommendationScore - a.recommendationScore);
  },
};
