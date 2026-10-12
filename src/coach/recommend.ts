import { getCardProvider } from '../game/cards';
import { tileLabel } from '../game/tiles';
import { arrangeHand, getLegalCallOptions } from '../game/training-card';
import type { Tile } from '../game/types';
import { createCoachPlan } from './plan';
import type { CoachDecision, CoachPlan, CoachRecommendation, CoachSession, CoachVisibleContext } from './types';

function directions(plan: CoachPlan) {
  if (plan.followedId && (!plan.target?.candidate.viable || plan.target.blocked)) return [];
  return [plan.target, ...plan.alternatives].filter(item => item && item.candidate.viable && !item.blocked);
}

/** Reallocate after every removal: duplicate tiles and Jokers are interchangeable. */
function chooseRemovals(context: CoachVisibleContext, plan: CoachPlan, count: number, passing: boolean) {
  const lines = directions(plan);
  let rack = [...context.rack];
  const chosen: Array<{ tile: Tile; loss: number; alternativeLoss: number }> = [];
  const matches = (tiles: Tile[], index: number) => {
    const line = lines[index];
    return line ? arrangeHand([...tiles, ...context.ownExposures.flatMap(set => set.tiles)], context.ownExposures, line.hand).matchingTileIds.length : 0;
  };
  for (let step = 0; step < count; step++) {
    const before = lines.map((_, index) => matches(rack, index));
    const scored = rack.filter(tile => !passing || tile.type.kind !== 'joker').map(tile => {
      const after = rack.filter(item => item.id !== tile.id);
      const losses = lines.map((_, index) => before[index] - matches(after, index));
      const loss = losses[0] ?? 0;
      const alternativeLoss = losses.slice(1).reduce((sum, value) => sum + value, 0);
      return { tile, loss, alternativeLoss, score: loss * 100 + alternativeLoss * 10 + (tile.type.kind === 'joker' ? 1 : 0) };
    }).sort((a, b) => a.score - b.score || a.tile.id.localeCompare(b.tile.id));
    const pick = scored[0];
    if (!pick) break;
    chosen.push(pick);
    rack = rack.filter(tile => tile.id !== pick.tile.id);
  }
  return chosen;
}

function recommendRemoval(context: CoachVisibleContext, plan: CoachPlan, count: number, passing: boolean): CoachRecommendation {
  const chosen = chooseRemovals(context, plan, count, passing);
  const target = directions(plan)[0];
  const loss = chosen.reduce((sum, item) => sum + item.loss, 0);
  const alternativeLoss = chosen.reduce((sum, item) => sum + item.alternativeLoss, 0);
  const name = target?.hand.name ?? 'a new direction';
  const tileReasons = chosen.map(({ tile, loss, alternativeLoss }) => ({ tileId: tile.id,
    text: `${tileLabel(tile)}: ${loss ? 'removing this costs one matched slot in your working line' : 'removing this keeps every matched slot in your working line'}${alternativeLoss ? `; it also costs ${alternativeLoss} matched slot${alternativeLoss === 1 ? '' : 's'} across the compared alternatives` : '; the compared alternatives retain their fit'}.`,
  }));
  const explanation = target
    ? `${passing ? 'Pass' : 'Consider discarding'} ${chosen.map(item => tileLabel(item.tile)).join(', ')}. ${name} has ${target.candidate.matchingTileIds.length}/14 tiles matched. ${loss ? `This selection gives up ${loss} matched slot${loss === 1 ? '' : 's'}; every eligible choice costs useful tiles, so this is a compromise.` : 'This selection preserves all of its current matched slots.'}`
    : 'No unblocked, exposure-compatible line was found. Browse the card before committing; these tiles are a fallback, not a strong strategic recommendation.';
  return { kind: passing ? 'charleston-pass' : 'discard', tileIds: target ? chosen.map(item => item.tile.id) : [],
    reasonCodes: [...(loss === 0 && alternativeLoss === 0 ? ['NOT_USED_BY_TOP_HANDS' as const] : ['LOW_FLEXIBILITY' as const]), ...(passing ? ['JOKER_PROTECTED' as const] : [])],
    headline: target ? `${passing ? 'Pass' : 'Reconsider'} ${chosen.map(item => tileLabel(item.tile)).join(', ')}${loss ? ' with care' : ''}.` : 'Choose a hand direction first.',
    explanation, confidence: !target || loss || plan.warning ? 'low' : 'medium', tileReasons,
    reasons: [{ title: 'Why this direction', body: plan.followedId && target?.hand.id === plan.followedId ? `You chose ${name}; the coach evaluates moves against that exact suit and number arrangement.` : `${name} is the closest available line by current fit, after filtering visible natural shortages. Fit is a starting point, not a winning probability.` },
      { title: 'What to protect', body: target?.hand.teachingPoint ?? 'Compare exposure-compatible hands on your card.' }],
    tradeoff: `${alternativeLoss ? `The compared alternatives lose ${alternativeLoss} matched slot${alternativeLoss === 1 ? '' : 's'} in total.` : 'The compared alternatives keep their current fit.'} ${passing ? 'Jokers are excluded from passes. ' : ''}This evaluates hand fit; it does not predict opponents’ calls or discard safety.`,
  };
}

export function recommendCharlestonPass(context: CoachVisibleContext, count = 3, plan = createCoachPlan(context)): CoachRecommendation {
  return recommendRemoval(context, plan, count, true);
}
export function recommendDiscard(context: CoachVisibleContext, plan = createCoachPlan(context)): CoachRecommendation {
  return recommendRemoval(context, plan, 1, false);
}
export function recommendDraw(): CoachRecommendation {
  return { kind: 'draw', tileIds: [], reasonCodes: ['WAIT_FOR_DRAW'], headline: 'Draw, then reassess your plan.', explanation: 'You have 13 tiles including exposures. Draw before choosing a discard; the new tile may fill a gap or improve an alternative.', confidence: 'high' };
}
export function recommendCall(context: CoachVisibleContext, plan = createCoachPlan(context)): CoachRecommendation {
  const discard = context.callWindow?.discard;
  const target = directions(plan)[0];
  // Search within the target's definition. Global call options deduplicate identical
  // physical sets and can assign them to another hand with the same group.
  const options = discard && target ? getLegalCallOptions(context.rack, context.ownExposures, discard, [target.hand]) : [];
  const option = options.find(option => {
    const tiles = context.rack.filter(tile => option.rackTileIds.includes(tile.id));
    const exposures = [...context.ownExposures, { id: 'coach-proposed', kind: option.kind, tiles: [...tiles, discard!], calledFromPlayerId: context.callWindow!.discardedByPlayerId }];
    const remaining = context.rack.filter(tile => !option.rackTileIds.includes(tile.id));
    const after = arrangeHand([...remaining, ...exposures.flatMap(set => set.tiles)], exposures, target!.hand);
    return after.viable && after.matchingTileIds.length > target!.candidate.matchingTileIds.length;
  });
  const canCall = Boolean(option);
  const explanation = !discard ? 'There is no opponent discard to claim.'
    : target?.hand.exposure === 'concealed' ? `${target.hand.name} must stay concealed. Ordinary calls would invalidate it; only a discard that completes Mahjong can be claimed.`
    : canCall ? `Calling ${tileLabel(discard)} completes a legal ${option!.kind} for ${target!.hand.name} and increases its matched tile count. Select the marked rack tiles if you decide to call.`
    : `This discard does not improve a legal exposed group in ${target?.hand.name ?? 'your available directions'}. Passing preserves your ability to change hands.`;
  return { kind: 'call', tileIds: option?.rackTileIds ?? [], reasonCodes: [canCall ? 'CALL_SUPPORTS_TOP_HAND' : 'CALL_REDUCES_FLEXIBILITY'],
    headline: canCall ? `Consider calling ${tileLabel(discard!)} for ${target!.hand.name}.` : 'Pass on this ordinary call.',
    explanation, confidence: canCall ? 'medium' : 'high', tradeoff: canCall ? 'The exposed set becomes locked. Other lines survive only if they accept this exact group. The game rules check your final selection.' : 'A legal call for another line can still be a poor fit for your plan.',
  };
}

export function createCoachSession(context: CoachVisibleContext, decision: CoachDecision, passCount = 3): CoachSession {
  const plan = createCoachPlan(context);
  const tiles = [...context.rack, ...context.ownExposures.flatMap(set => set.tiles)];
  const winning = decision === 'call' && context.callWindow
    ? getCardProvider(context.cardId).validateMahjong([...tiles, context.callWindow.discard], context.ownExposures)
    : decision === 'discard' ? getCardProvider(context.cardId).validateMahjong(tiles, context.ownExposures) : null;
  let recommendation: CoachRecommendation;
  if (winning?.valid) recommendation = { kind: 'mahjong', tileIds: [], reasonCodes: [], headline: 'You can declare Mahjong.', explanation: 'All 14 tiles exactly match a legal line on this card, including your exposed sets. Use the Mahjong action to declare it.', confidence: 'high' };
  else if (plan.warning) recommendation = { kind: 'wait', tileIds: [], reasonCodes: [], headline: 'Revisit your followed hand.', explanation: 'Your chosen line needs attention. Inspect the hand-plan groups and compare an available alternative before asking for a tile recommendation.', confidence: 'low' };
  else if (decision === 'discard') recommendation = recommendDiscard(context, plan);
  else if (decision === 'call') recommendation = recommendCall(context, plan);
  else if (decision === 'draw') recommendation = recommendDraw();
  else if (decision === 'charleston-pass' || decision === 'courtesy-pass') {
    const count = decision === 'courtesy-pass' ? chooseRemovals(context, plan, 3, true).filter(item => item.loss === 0).length : passCount;
    recommendation = { ...recommendCharlestonPass(context, count, plan), kind: decision };
    if (count === 0) recommendation = { ...recommendation, headline: 'Keep your tiles; pass none.', explanation: decision === 'courtesy-pass' ? 'Courtesy passing is optional. Every eligible tile costs a matched slot in your working line, so keeping your rack is reasonable.' : 'Use your blind pass; no rack tiles need to be selected.' };
  } else recommendation = { kind: decision, tileIds: [], reasonCodes: [], headline: decision === 'charleston-decision' ? 'Compare your direction before another Charleston.' : decision === 'completed' ? 'Review how your final rack fits.' : 'Study your hand while the table plays.', explanation: decision === 'charleston-decision' ? 'Another Charleston is optional. Compare the number of tiles outside your plan with the natural singles and pairs you need to protect; there is no guaranteed benefit from continuing.' : 'You can compare hands and arrange your rack now. No tile action is suggested until it is your decision.', confidence: 'medium' };
  return { plan, recommendation };
}

export function getProgressiveHint(recommendation: CoachRecommendation, level: number, rack: Tile[]): string {
  if (level <= 0) return recommendation.headline;
  if (level === 1 && recommendation.tileIds.length) return `Notice ${rack.filter(tile => recommendation.tileIds.includes(tile.id)).map(tileLabel).join(', ')}. Compare their role in your working line before choosing.`;
  return recommendation.explanation;
}

/** Explain the player's tentative choice without changing it or claiming legality. */
export function assessCoachSelection(context: CoachVisibleContext, session: CoachSession, selectedIds: string[]): string | undefined {
  if (!selectedIds.length || !['discard', 'charleston-pass', 'courtesy-pass'].includes(session.recommendation.kind)) return undefined;
  const selected = context.rack.filter(tile => selectedIds.includes(tile.id));
  if (['charleston-pass', 'courtesy-pass'].includes(session.recommendation.kind) && selected.some(tile => tile.type.kind === 'joker')) return 'Your selection contains a Joker. Jokers cannot be passed.';
  const target = directions(session.plan)[0];
  if (!target) return 'No available working line to compare this selection against. Choose a hand direction first.';
  const remaining = context.rack.filter(tile => !selectedIds.includes(tile.id));
  const fit = arrangeHand([...remaining, ...context.ownExposures.flatMap(set => set.tiles)], context.ownExposures, target.hand).matchingTileIds.length;
  const loss = target.candidate.matchingTileIds.length - fit;
  return `Your selection: ${selected.map(tileLabel).join(', ')}. ${loss ? `It gives up ${loss} matched slot${loss === 1 ? '' : 's'} in ${target.hand.name}, leaving ${fit}/14 fit.` : `It preserves all ${fit} matched slots in ${target.hand.name}.`} This is a hand-fit preview; the action button checks your move.`;
}
