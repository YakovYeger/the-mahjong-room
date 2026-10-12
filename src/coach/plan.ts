import { getCardProvider } from '../game/cards';
import { arrangeHand, cardTileKey } from '../game/training-card';
import { createWall, tileLabel } from '../game/tiles';
import type { HandCandidate, HandDefinition, Tile } from '../game/types';
import type { CoachHandPlan, CoachPlan, CoachVisibleContext } from './types';

const samples = new Map(createWall().map(tile => [cardTileKey(tile), tile]));
export const coachTileLabel = (key: string) => samples.has(key) ? tileLabel(samples.get(key)!) : key;
const copies = (key: string) => key === 'flower-any' || key === 'joker' ? 8 : 4;

/** Count physical IDs once; a claim tile may also be in the discard pool. */
export function knownTiles(context: CoachVisibleContext): Tile[] {
  return [...new Map([...context.rack, ...context.discards,
    ...context.visibleExposures.flatMap(item => item.exposure.tiles),
    ...context.ownExposures.flatMap(item => item.tiles),
    ...(context.callWindow ? [context.callWindow.discard] : []),
  ].map(tile => [tile.id, tile])).values()];
}

export function createCoachPlan(context: CoachVisibleContext): CoachPlan {
  const hands = getCardProvider(context.cardId).getHands();
  const byId = new Map(hands.map(hand => [hand.id, hand]));
  const known = knownTiles(context);
  const knownCounts = new Map<string, number>();
  for (const tile of known) {
    const key = cardTileKey(tile);
    knownCounts.set(key, (knownCounts.get(key) ?? 0) + 1);
  }
  const ownTiles = [...context.rack, ...context.ownExposures.flatMap(set => set.tiles)];
  const publicTiles = [...new Map([...context.discards, ...context.visibleExposures
    .filter(item => item.playerId !== context.playerId).flatMap(item => item.exposure.tiles)]
    .map(tile => [tile.id, tile])).values()];
  const ownCounts = new Map<string, number>();
  for (const tile of context.rack) {
    const key = cardTileKey(tile);
    ownCounts.set(key, (ownCounts.get(key) ?? 0) + 1);
  }
  // Only natural-only requirements can prove a line blocked here. Flexible groups
  // can use Jokers, including exchangeable public Jokers; don't overclaim certainty.
  function shortage(hand: HandDefinition) {
    const fixed = new Map<string, number>();
    for (const group of hand.groups.filter(group => !group.jokerAllowed)) fixed.set(group.tileKey, (fixed.get(group.tileKey) ?? 0) + group.count);
    return [...fixed].reduce((total, [key, required]) => total + Math.max(0,
      required - (ownCounts.get(key) ?? 0) - Math.max(0, copies(key) - (knownCounts.get(key) ?? 0))), 0);
  }
  function describe(candidate: HandCandidate): CoachHandPlan {
    const hand = byId.get(candidate.handId)!;
    const layout = arrangeHand(ownTiles, context.ownExposures, hand);
    const groups = layout.groups.map(group => {
      const missing = group.slots.filter(tile => !tile).length;
      const label = coachTileLabel(group.required.tileKey);
      const unseenNaturals = Math.max(0, copies(group.required.tileKey) - (knownCounts.get(group.required.tileKey) ?? 0));
      return {
        id: group.required.id, label, kind: group.required.kind, count: group.required.count,
        matched: group.slots.filter(Boolean).length, missing, jokerAllowed: group.required.jokerAllowed,
        exposed: group.exposed,
        rackTileIds: group.slots.flatMap(tile => tile && context.rack.some(item => item.id === tile.id) ? [tile.id] : []),
        publicTileIds: publicTiles.filter(tile => cardTileKey(tile) === group.required.tileKey).map(tile => tile.id),
        unseenNaturals,
        note: group.exposed ? 'This set is already exposed and locks part of your direction.'
          : !missing ? `Complete ${group.required.kind}. ${group.required.jokerAllowed ? 'Jokers are allowed here.' : 'Keep these natural tiles; Jokers cannot replace them.'}`
          : `Need ${missing} more ${label}${missing > 1 ? ' tiles' : ''}. ${group.required.jokerAllowed ? 'A Joker can fill a slot in this group.' : 'Natural tiles only; a Joker cannot fill this group.'} ${unseenNaturals} natural ${unseenNaturals === 1 ? 'copy is' : 'copies are'} unseen; these may be in the wall or hidden racks.`,
      };
    });
    const naturalShortage = shortage(hand);
    return { hand, candidate, groups, naturalShortage, blocked: naturalShortage > 0,
      summary: !candidate.viable ? 'Your exposed sets conflict with this pattern.'
        : naturalShortage ? `Public tiles rule out this line: ${naturalShortage} required natural ${naturalShortage === 1 ? 'tile is' : 'tiles are'} unavailable.`
        : `${candidate.matchingTileIds.length}/14 tiles fit · ${candidate.completionDistance} still needed · ${hand.exposure === 'concealed' ? 'Keep concealed' : 'Calls allowed for sets of 3+'}.`,
    };
  }
  const sorted = context.candidates.filter(candidate => candidate.viable && byId.has(candidate.handId))
    .map(candidate => ({ candidate, shortage: shortage(byId.get(candidate.handId)!) }))
    .sort((a, b) => Number(a.shortage > 0) - Number(b.shortage > 0) || b.candidate.recommendationScore - a.candidate.recommendationScore);
  let followed = context.candidates.find(candidate => candidate.handId === context.followedHandId && byId.has(candidate.handId));
  // The photo provider returns only the best variant of each printed line. A
  // previously pinned variant can fall out of that shortlist as the rack changes.
  const pinnedHand = context.followedHandId ? byId.get(context.followedHandId) : undefined;
  if (!followed && pinnedHand) {
    const layout = arrangeHand(ownTiles, context.ownExposures, pinnedHand);
    const fit = layout.matchingTileIds.length;
    followed = { handId: pinnedHand.id, name: pinnedHand.name, viable: layout.viable,
      matchingTileIds: layout.matchingTileIds, completionDistance: 14 - fit,
      recommendationScore: layout.viable ? fit * 10 - (14 - fit) + Number(pinnedHand.exposure === 'concealed') : -1000,
      reasonCodes: layout.viable ? [fit >= 6 ? 'STRONG_EXISTING_SHAPE' : 'FLEXIBLE_START'] : ['EXPOSURE_CONFLICT'],
    };
  }
  const target = followed ? describe(followed) : sorted[0] ? describe(sorted[0].candidate) : null;
  // Different suit assignments of one printed line are not separate strategic alternatives.
  const seenNames = new Set(target ? [target.hand.name] : []);
  const alternatives: CoachHandPlan[] = [];
  for (const { candidate, shortage: deficit } of sorted) {
    if (deficit || seenNames.has(candidate.name)) continue;
    seenNames.add(candidate.name);
    alternatives.push(describe(candidate));
    if (alternatives.length === 2) break;
  }
  const blockedHandIds = sorted.filter(item => item.shortage > 0).map(item => item.candidate.handId);
  if (target?.blocked && !blockedHandIds.includes(target.hand.id)) blockedHandIds.push(target.hand.id);
  return { followedId: context.followedHandId ?? null, target, alternatives, blockedHandIds,
    warning: context.followedHandId && !followed ? 'Your saved line is not on this card. Choose a new hand.'
      : target && (!target.candidate.viable || target.blocked) ? `${target.hand.name}: ${target.summary} Compare another hand before committing.` : null,
  };
}
