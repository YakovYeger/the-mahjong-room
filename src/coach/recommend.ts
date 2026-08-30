import { tileLabel } from '../game/tiles';
import { getLegalCallOptions } from '../game/training-card';
import type { Tile } from '../game/types';
import { countRackPairs } from './analyze';
import type { CoachRecommendation, CoachVisibleContext } from './types';

function removalScore(tile: Tile, context: CoachVisibleContext): number {
  if (tile.type.kind === 'joker') return Number.POSITIVE_INFINITY;
  const top = context.candidates.slice(0, 3);
  const bestUses = top[0]?.matchingTileIds.includes(tile.id) ? 4 : 0;
  const alternativeUses = top.slice(1).filter((candidate) => candidate.matchingTileIds.includes(tile.id)).length;
  const pairBonus = countRackPairs(context.rack).has(JSON.stringify(tile.type)) ? 2 : 0;
  return bestUses + alternativeUses + pairBonus;
}

function lowestUtilityTiles(context: CoachVisibleContext, count: number): Tile[] {
  return [...context.rack]
    .filter((tile) => tile.type.kind !== 'joker')
    .sort((left, right) => removalScore(left, context) - removalScore(right, context) || left.id.localeCompare(right.id))
    .slice(0, count);
}

export function recommendCharlestonPass(context: CoachVisibleContext): CoachRecommendation {
  const tiles = lowestUtilityTiles(context, 3);
  return {
    kind: 'charleston-pass',
    tileIds: tiles.map((tile) => tile.id),
    reasonCodes: ['NOT_USED_BY_TOP_HANDS', 'LOW_FLEXIBILITY', 'JOKER_PROTECTED'],
    headline: 'Look for the tiles doing the least work.',
    explanation: `${tiles.map(tileLabel).join(', ')} contribute least to your three strongest Training Card directions. Your jokers stay protected because they cannot be passed.`,
    confidence: context.candidates[0]?.matchingTileIds.length >= 6 ? 'high' : 'medium',
  };
}

export function recommendDiscard(context: CoachVisibleContext): CoachRecommendation {
  const tile = lowestUtilityTiles(context, 1)[0];
  if (!tile) return { kind: 'draw', tileIds: [], reasonCodes: ['WAIT_FOR_DRAW'], headline: 'Draw first, then reassess.', explanation: 'Your rack needs one more tile before you choose a discard.', confidence: 'high' };
  return {
    kind: 'discard',
    tileIds: [tile.id],
    reasonCodes: ['NOT_USED_BY_TOP_HANDS', 'LOW_FLEXIBILITY'],
    headline: `${context.candidates[0]?.name ?? 'Your leading hand'} is your strongest direction.`,
    explanation: `${tileLabel(tile)} contributes least to your leading candidates, while the marked groups preserve more ways forward.`,
    confidence: context.candidates[0]?.matchingTileIds.length >= 7 ? 'high' : 'medium',
  };
}

export function recommendDraw(): CoachRecommendation {
  return { kind: 'draw', tileIds: [], reasonCodes: ['WAIT_FOR_DRAW'], headline: 'Draw first, then reassess.', explanation: 'Your rack has 13 concealed tiles. Draw from the wall before choosing what no longer helps.', confidence: 'high' };
}

export function recommendCall(context: CoachVisibleContext): CoachRecommendation {
  const discard = context.callWindow?.discard;
  if (!discard || discard.type.kind === 'joker') {
    return { kind: 'call', tileIds: [], reasonCodes: ['CALL_REDUCES_FLEXIBILITY'], headline: 'Let this one go.', explanation: 'There is no legal set to expose from this discard.', confidence: 'high' };
  }
  const option = getLegalCallOptions(context.rack, context.ownExposures, discard)[0];
  const matches = option ? context.rack.filter((tile) => option.rackTileIds.includes(tile.id)) : [];
  const supportsTop = option?.handId === context.candidates[0]?.handId;
  const canCall = Boolean(option);
  return {
    kind: 'call',
    tileIds: canCall && supportsTop ? matches.map((tile) => tile.id) : [],
    reasonCodes: [canCall && supportsTop ? 'CALL_SUPPORTS_TOP_HAND' : 'CALL_REDUCES_FLEXIBILITY'],
    headline: canCall && supportsTop ? 'This call supports your leading hand.' : 'Passing keeps your options open.',
    explanation: canCall && supportsTop ? `Calling ${tileLabel(discard)} creates a legal ${option!.kind} for your leading hand, but it also commits part of your rack.` : 'An exposure would not strengthen your best current direction enough to justify losing flexibility.',
    confidence: supportsTop ? 'medium' : 'high',
  };
}

export function getProgressiveHint(recommendation: CoachRecommendation, level: number, rack: Tile[]): string {
  if (level <= 0) return recommendation.headline;
  const recommended = rack.filter((tile) => recommendation.tileIds.includes(tile.id));
  if (level === 1) return recommended.length ? `Focus on ${recommended.length === 1 ? 'the tile' : 'the tiles'} outside your strongest groups.` : recommendation.explanation;
  return recommendation.explanation;
}
