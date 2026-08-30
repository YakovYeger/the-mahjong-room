import { describe, expect, it } from 'vitest';
import { getCoachVisibleContext } from '../src/coach/analyze';
import { getProgressiveHint, recommendCharlestonPass, recommendDiscard } from '../src/coach/recommend';
import { generateGameReview } from '../src/coach/review';
import { createGame } from '../src/game/engine';

describe('coach visible context', () => {
  it('contains only player-visible information', () => {
    const state = createGame(2026);
    const context = getCoachVisibleContext(state, 'human')!;
    expect(context.rack).toEqual(state.players[0].rack);
    expect(context).not.toHaveProperty('players');
    expect(context).not.toHaveProperty('wall');
    expect(context.wallCount).toBe(state.wall.length);
  });
});

describe('structured recommendations', () => {
  it('recommends exactly three non-jokers for the Charleston', () => {
    const context = getCoachVisibleContext(createGame(2026), 'human')!;
    const recommendation = recommendCharlestonPass(context);
    expect(recommendation.tileIds).toHaveLength(3);
    expect(context.rack.filter((tile) => recommendation.tileIds.includes(tile.id)).every((tile) => tile.type.kind !== 'joker')).toBe(true);
    expect(recommendation.reasonCodes).toContain('JOKER_PROTECTED');
  });

  it('returns deterministic discard advice with concrete reasons', () => {
    const context = getCoachVisibleContext(createGame(2026), 'human')!;
    expect(recommendDiscard(context)).toEqual(recommendDiscard(context));
    expect(recommendDiscard(context).reasonCodes).toContain('NOT_USED_BY_TOP_HANDS');
  });

  it('reveals help progressively', () => {
    const context = getCoachVisibleContext(createGame(2026), 'human')!;
    const recommendation = recommendCharlestonPass(context);
    const hints = [0, 1, 2].map((level) => getProgressiveHint(recommendation, level, context.rack));
    expect(new Set(hints).size).toBe(3);
  });
});

describe('event-derived review', () => {
  it('adjusts next-game assistance from actual hint use', () => {
    const state = createGame(2026);
    state.phase = 'completed';
    const independent = generateGameReview(state, 'human', { hintsRequested: 1, manualTurns: 5 });
    const guided = generateGameReview(state, 'human', { hintsRequested: 6, manualTurns: 5 });
    expect(independent.suggestedAssistanceLevel).toBe(1);
    expect(guided.suggestedAssistanceLevel).toBe(0);
    expect(independent.skills.find((skill) => skill.name === 'Discard strategy')!.score).toBeGreaterThan(guided.skills.find((skill) => skill.name === 'Discard strategy')!.score);
  });
});
