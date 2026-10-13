import { describe, expect, it } from 'vitest';
import { getCoachVisibleContext, getSnapshotCoachContext } from '../src/coach/analyze';
import { createCoachPlan, knownTiles } from '../src/coach/plan';
import { createCoachSession, recommendCharlestonPass, recommendDiscard, recommendCall } from '../src/coach/recommend';
import { getCoachHighlights } from '../src/coach/highlights';
import { createGame, getPublicGameState } from '../src/game/engine';
import { getCardProvider } from '../src/game/cards';
import { createWall } from '../src/game/tiles';
import { cardTileKey } from '../src/game/training-card';
import type { CoachVisibleContext } from '../src/coach/types';

function fixture(keys: string[], followedHandId?: string): CoachVisibleContext {
  const pool = createWall();
  const rack = keys.map(key => {
    const index = pool.findIndex(tile => cardTileKey(tile) === key);
    if (index < 0) throw new Error(`Not enough copies of ${key}`);
    return pool.splice(index, 1)[0];
  });
  return { playerId: 'human', rack, ownExposures: [], visibleExposures: [], discards: [], callWindow: null, wallCount: 60,
    candidates: getCardProvider().analyzeCandidates(rack), followedHandId };
}
const garden = ['bamboo-1','bamboo-1','bamboo-2','bamboo-2','bamboo-3','bamboo-3','bamboo-4','bamboo-4','bamboo-5','bamboo-5','bamboo-6','bamboo-6','flower-any'];

describe('coach hand planning and advice', () => {
  it('honors a pinned hand even when the closest line differs', () => {
    const context = fixture([...garden, 'dots-2'], 'evening-dots');
    expect(context.candidates[0].handId).toBe('garden-path');
    expect(createCoachPlan(context).target!.hand.id).toBe('evening-dots');
    const recommendation = recommendDiscard(context);
    expect(recommendation.tileIds).not.toContain(context.rack.find(tile => cardTileKey(tile) === 'dots-2')!.id);
    expect(recommendation.reasons![0].body).toContain('You chose Evening Dots');
  });
  it('can discard a Joker that cannot fill the pinned natural-pair hand', () => {
    const context = fixture([...garden, 'joker'], 'garden-path');
    expect(recommendDiscard(context).tileIds).toEqual([context.rack.at(-1)!.id]);
    expect(recommendCharlestonPass(context).tileIds).not.toContain(context.rack.at(-1)!.id);
  });
  it('scores removals jointly and admits a forced loss', () => {
    const context = fixture(garden, 'garden-path');
    const recommendation = recommendCharlestonPass(context);
    expect(recommendation.tileIds).toHaveLength(3);
    expect(new Set(recommendation.tileIds).size).toBe(3);
    expect(recommendation.explanation).toContain('gives up 3 matched slots');
    expect(recommendation.confidence).toBe('low');
    expect(recommendation.reasonCodes).not.toContain('NOT_USED_BY_TOP_HANDS');
  });
  it('supports blind-pass counts and optional courtesy passing', () => {
    const context = fixture(garden, 'garden-path');
    expect(createCoachSession(context, 'charleston-pass', 1).recommendation.tileIds).toHaveLength(1);
    const courtesy = createCoachSession(context, 'courtesy-pass').recommendation;
    expect(courtesy.tileIds).toHaveLength(0);
    expect(courtesy.headline).toContain('pass none');
  });
  it('warns when public natural copies rule out a pinned hand', () => {
    const context = fixture(garden.filter(key => key !== 'bamboo-1'), 'garden-path');
    context.discards = createWall().filter(tile => cardTileKey(tile) === 'bamboo-1');
    const plan = createCoachPlan(context);
    expect(plan.target!.blocked).toBe(true);
    expect(plan.warning).toContain('Public tiles rule out');
    expect(plan.followedId).toBe('garden-path');
    expect(plan.alternatives.every(line => !line.blocked)).toBe(true);
  });
  it('does not claim unseen copies are wall tiles', () => {
    const plan = createCoachPlan(fixture(['bamboo-1'], 'garden-path'));
    expect(plan.target!.groups[0].unseenNaturals).toBe(3);
    expect(plan.target!.groups[0].note).toContain('wall or hidden racks');
  });
  it('finds a call for the target even when another hand shares that set', () => {
    const context = fixture(['dots-2','dots-2','dots-4','dots-4','dots-6','dots-8','wind-east','wind-east'], 'evening-dots');
    const discard = createWall().filter(tile => cardTileKey(tile) === 'dots-2')[2];
    context.callWindow = { discard, discardedByPlayerId: 'other', responses: {} };
    context.discards = [discard];
    expect(recommendCall(context).tileIds).toEqual(context.rack.slice(0, 2).map(tile => tile.id));
    expect(recommendCall(context).explanation).toContain('Evening Dots');
    expect(knownTiles(context).filter(tile => tile.id === discard.id)).toHaveLength(1);
  });
  it('keeps concealed lines from making ordinary calls but prioritizes final Mahjong', () => {
    const context = fixture(garden, 'garden-path');
    const flower = createWall().filter(tile => tile.type.kind === 'flower')[1];
    context.callWindow = { discard: flower, discardedByPlayerId: 'other', responses: {} };
    expect(recommendCall(context).tileIds).toHaveLength(0);
    expect(recommendCall(context).explanation).toContain('must stay concealed');
    expect(createCoachSession(context, 'call').recommendation.kind).toBe('mahjong');
    context.rack.push(flower);
    expect(createCoachSession(context, 'discard').recommendation.kind).toBe('mahjong');
  });
  it('suggests no tile action while waiting or deciding on another Charleston', () => {
    const context = fixture(garden);
    expect(createCoachSession(context, 'wait').recommendation.tileIds).toEqual([]);
    expect(createCoachSession(context, 'charleston-decision').recommendation.tileIds).toEqual([]);
  });
  it('uses equivalent visible projections for solo and multiplayer, never hidden data', () => {
    const game = createGame(2026);
    const solo = getCoachVisibleContext(game, 'human')!;
    const snapshot = { publicState: getPublicGameState(game), privateState: { playerId: 'human', rack: game.players[0].rack, pendingAction: 'charleston_pass' as const }, stateVersion: game.stateVersion, eventSequence: game.eventSequence, status: 'active' as const, mode: 'live' as const, deadlineAt: null, recentEvents: [] };
    expect(createCoachSession(getSnapshotCoachContext(snapshot), 'charleston-pass')).toEqual(createCoachSession(solo, 'charleston-pass'));
    game.players[1].rack.reverse(); game.wall.reverse();
    expect(createCoachSession(getCoachVisibleContext(game, 'human')!, 'charleston-pass')).toEqual(createCoachSession(solo, 'charleston-pass'));
  });
  it('produces mutually exclusive rack roles and matching public focus', () => {
    const context = fixture(['bamboo-1','dots-2'], 'garden-path');
    context.discards = [createWall().find(tile => cardTileKey(tile) === 'bamboo-2')!];
    const session = createCoachSession(context, 'discard');
    expect(getCoachHighlights(session, false, null).rack).toEqual({});
    const highlights = getCoachHighlights(session, true, 'b2');
    expect(highlights.groupIds).toEqual(['b2']);
    expect(highlights.publicTileIds).toEqual(context.discards.map(tile => tile.id));
    expect(highlights.rack[context.rack[0].id]).toBe('keep');
    expect(highlights.rack[context.rack[1].id]).toBe('suggest');
  });
});

it('does not silently switch away from a blocked followed line', () => {
  const context = fixture(['dots-2','dots-2','wind-east'], 'garden-path');
  context.discards = createWall().filter(tile => cardTileKey(tile) === 'bamboo-1');
  const session = createCoachSession(context, 'discard');
  expect(session.recommendation.tileIds).toEqual([]);
  expect(session.recommendation.headline).toBe('Revisit your followed hand.');
  expect(session.plan.target!.hand.id).toBe('garden-path');
});

it('retains an exact 2025 variant after it drops out of the provider shortlist', () => {
  const context = fixture(['dots-2','dots-2','dots-4','wind-east']);
  context.cardId = 'photo-2025';
  context.candidates = getCardProvider(context.cardId).analyzeCandidates(context.rack);
  const shortlisted = new Set(context.candidates.map(candidate => candidate.handId));
  const pin = getCardProvider(context.cardId).getHands().find(hand => !shortlisted.has(hand.id))!;
  context.followedHandId = pin.id;
  const plan = createCoachPlan(context);
  expect(plan.target!.hand.id).toBe(pin.id);
  expect(plan.warning ?? '').not.toContain('not on this card');
  expect(plan.target!.candidate.completionDistance).toBe(14 - plan.target!.candidate.matchingTileIds.length);
});

it('clears coach annotations for completed games', () => {
  const session = createCoachSession(fixture(garden, 'garden-path'), 'completed');
  expect(getCoachHighlights(session, true, 'b1')).toEqual({ rack: {}, groupIds: [], publicTileIds: [] });
});
