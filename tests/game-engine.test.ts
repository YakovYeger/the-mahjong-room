import { describe, expect, it } from 'vitest';
import { applyGameAction, createGame, getPlayerPrivateState, getPublicGameState } from '../src/game/engine';
import { simulateGames } from '../src/game/simulation';
import { createWall, deterministicShuffle, tileKey } from '../src/game/tiles';
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
    for (let index = 0; index < 12; index += 1) {
      const player = state.players[index % 4];
      const result = applyGameAction(state, player.id, { type: 'PASS_TILES', tileIds: player.rack.slice(0, 3).map((tile) => tile.id) });
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
    const decision = applyGameAction(state, 'human', { type: 'CHOOSE_SECOND_CHARLESTON', continue: false });
    expect(decision.ok).toBe(true);
    if (decision.ok) state = decision.state;
    for (let index = 0; index < 4; index += 1) {
      const courtesy = applyGameAction(state, state.players[index].id, { type: 'COURTESY_PASS', tileIds: [] });
      expect(courtesy.ok).toBe(true);
      if (courtesy.ok) state = courtesy.state;
    }
    const draw = applyGameAction(state, 'human', { type: 'DRAW_TILE' });
    expect(draw.ok).toBe(false);
    if (!draw.ok) expect(draw.violation.code).toBe('DISCARD_FIRST');
  });

  it('supports the optional second Charleston in the correct pass order', () => {
    let state = createGame();
    for (let index = 0; index < 12; index += 1) {
      const player = state.players[index % 4];
      const result = applyGameAction(state, player.id, { type: 'PASS_TILES', tileIds: player.rack.slice(0, 3).map((tile) => tile.id) });
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
    expect(state.charlestonAwaitingDecision).toBe(true);
    const decision = applyGameAction(state, 'human', { type: 'CHOOSE_SECOND_CHARLESTON', continue: true });
    expect(decision.ok).toBe(true);
    if (decision.ok) state = decision.state;
    for (let index = 0; index < 12; index += 1) {
      const player = state.players[index % 4];
      const result = applyGameAction(state, player.id, { type: 'PASS_TILES', tileIds: player.rack.slice(0, 3).map((tile) => tile.id) });
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
    expect(state.charlestonCourtesy).toBe(true);
    for (let index = 0; index < 4; index += 1) {
      const courtesy = applyGameAction(state, state.players[index].id, { type: 'COURTESY_PASS', tileIds: [] });
      expect(courtesy.ok).toBe(true);
      if (courtesy.ok) state = courtesy.state;
    }
    expect(state.phase).toBe('playing');
    expect(state.events.filter((event) => event.type === 'CHARLESTON_PASS_COMPLETED').map((event) => event.direction)).toEqual(['right', 'across', 'left', 'left', 'across', 'right']);
    expect(state.players.map((player) => player.rack.length)).toEqual([14, 13, 13, 13]);
  });

  it('requires opposite players to agree on courtesy-pass counts', () => {
    let state = createGame();
    state.charlestonCourtesy = true;
    state.charlestonAwaitingDecision = false;
    const passes = [1, 0, 2, 0];
    let finalResult: ReturnType<typeof applyGameAction> | undefined;
    for (let index = 0; index < 4; index += 1) {
      const player = state.players[index];
      finalResult = applyGameAction(state, player.id, { type: 'COURTESY_PASS', tileIds: player.rack.slice(0, passes[index]).map((tile) => tile.id) });
      if (finalResult.ok) state = finalResult.state;
    }
    expect(finalResult?.ok).toBe(false);
    if (finalResult && !finalResult.ok) expect(finalResult.violation.code).toBe('COURTESY_COUNT_MISMATCH');
  });

  it('creates a pung by calling the latest discard', () => {
    const state = createGame();
    state.phase = 'playing';
    state.turnIndex = 0;
    const fives = createWall().filter((tile) => tileKey(tile) === 'dots-5');
    state.players[0].rack = [fives[0], ...state.players[0].rack.slice(1, 14)];
    state.players[1].rack = [fives[1], fives[2], ...state.players[1].rack.slice(2, 13)];
    const discard = applyGameAction(state, 'human', { type: 'DISCARD_TILE', tileId: fives[0].id });
    expect(discard.ok).toBe(true);
    if (!discard.ok) return;
    const call = applyGameAction(discard.state, 'bot-1', { type: 'CALL_TILE', rackTileIds: [fives[1].id, fives[2].id] });
    expect(call.ok).toBe(true);
    if (!call.ok) return;
    expect(call.state.players[1].exposures[0]).toMatchObject({ kind: 'pung', calledFromPlayerId: 'human' });
    expect(call.state.players[1].exposures[0].tiles).toHaveLength(3);
    expect(call.state.callWindow).toBeNull();
    expect(call.state.turnIndex).toBe(1);
  });

  it('rejects a call that does not match the discard', () => {
    const state = createGame();
    state.phase = 'playing';
    state.turnIndex = 0;
    const wall = createWall();
    const five = wall.find((tile) => tileKey(tile) === 'dots-5')!;
    const sixes = wall.filter((tile) => tileKey(tile) === 'dots-6').slice(0, 2);
    state.players[0].rack = [five, ...state.players[0].rack.slice(1, 14)];
    state.players[1].rack = [...sixes, ...state.players[1].rack.slice(2, 13)];
    const discard = applyGameAction(state, 'human', { type: 'DISCARD_TILE', tileId: five.id });
    expect(discard.ok).toBe(true);
    if (!discard.ok) return;
    const call = applyGameAction(discard.state, 'bot-1', { type: 'CALL_TILE', rackTileIds: sixes.map((tile) => tile.id) });
    expect(call.ok).toBe(false);
    if (!call.ok) expect(call.violation.code).toBe('TILES_DO_NOT_MATCH');
  });

  it('exchanges a matching natural tile for a joker in an exposure', () => {
    const state = createGame();
    state.phase = 'playing';
    state.turnIndex = 0;
    const wall = createWall();
    const threes = wall.filter((tile) => tileKey(tile) === 'characters-3');
    const joker = wall.find((tile) => tile.type.kind === 'joker')!;
    state.players[0].rack = [threes[0], ...state.players[0].rack.slice(1)];
    state.players[1].exposures = [{ id: 'exposure-test', kind: 'pung', tiles: [threes[1], threes[2], joker], calledFromPlayerId: 'bot-2' }];
    const result = applyGameAction(state, 'human', { type: 'EXCHANGE_JOKER', exposureOwnerId: 'bot-1', exposureId: 'exposure-test', rackTileId: threes[0].id, jokerTileId: joker.id });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].rack.some((tile) => tile.id === joker.id)).toBe(true);
    expect(result.state.players[1].exposures[0].tiles.some((tile) => tile.id === threes[0].id)).toBe(true);
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
