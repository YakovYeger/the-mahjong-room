import { describe, expect, it } from 'vitest';
import { applyGameAction, createGame, getPlayerPrivateState, getPublicGameState } from '../src/game/engine';
import { simulateGames } from '../src/game/simulation';
import { createWall, deterministicShuffle } from '../src/game/tiles';
import { TrainingCardProvider } from '../src/game/training-card';

describe('tile model', () => {
  it('creates the complete 152-tile American Mahjong wall', () => {
    expect(createWall()).toHaveLength(152);
    expect(new Set(createWall().map((tile) => tile.id)).size).toBe(152);
  });

  it('shuffles deterministically', () => {
    const wall = createWall();
    expect(deterministicShuffle(wall, 42).map((tile) => tile.id)).toEqual(deterministicShuffle(wall, 42).map((tile) => tile.id));
    expect(deterministicShuffle(wall, 42).map((tile) => tile.id)).not.toEqual(deterministicShuffle(wall, 43).map((tile) => tile.id));
  });
});

describe('game engine', () => {
  it('deals 14 tiles to East and 13 to the other seats', () => {
    const state = createGame();
    expect(state.players.map((player) => player.rack.length)).toEqual([14, 13, 13, 13]);
    expect(state.phase).toBe('charleston');
  });

  it('rejects a Charleston pass that is not exactly three tiles', () => {
    const state = createGame();
    const result = applyGameAction(state, 'human', { type: 'PASS_TILES', tileIds: [state.players[0].rack[0].id] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violation.code).toBe('PASS_EXACTLY_THREE');
  });

  it('keeps concealed racks out of the public projection', () => {
    const state = createGame();
    expect(getPublicGameState(state).players[0]).not.toHaveProperty('rack');
    expect(getPlayerPrivateState(state, 'human')?.rack).toHaveLength(14);
  });

  it('rejects drawing before East discards', () => {
    let state = createGame();
    for (let index = 0; index < 4; index += 1) {
      const player = state.players[index];
      const result = applyGameAction(state, player.id, { type: 'PASS_TILES', tileIds: player.rack.slice(0, 3).map((tile) => tile.id) });
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
    const draw = applyGameAction(state, 'human', { type: 'DRAW_TILE' });
    expect(draw.ok).toBe(false);
    if (!draw.ok) expect(draw.violation.code).toBe('DISCARD_FIRST');
  });
});

describe('training card and simulation', () => {
  it('keeps proprietary annual card content behind the provider interface', () => {
    expect(TrainingCardProvider.id).toBe('training-card');
    expect(TrainingCardProvider.getHands()).toHaveLength(4);
    expect(TrainingCardProvider.analyzeCandidates(createGame().players[0].rack)).toHaveLength(4);
  });

  it('completes 100 deterministic games without invalid or stalled states', () => {
    expect(simulateGames(100)).toMatchObject({ requested: 100, completed: 100, invalid: 0, stalled: 0 });
  }, 20_000);
});
