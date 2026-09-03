import { describe, expect, it } from 'vitest';
import { applyGameAction, createGame, getLegalJokerExchangeOptions, getPlayerPrivateState, getPublicGameState, totalPlayerTiles } from '../src/game/engine';
import { runBotAction } from '../src/game/bots';
import { simulateGames } from '../src/game/simulation';
import { createWall, deterministicShuffle, moveTileId, normalizeTileOrder, placeTileId, reorderTileIds } from '../src/game/tiles';
import { analyzeDiscardDeadHand, cardTileKey, getLegalCallOptions, TrainingCardProvider } from '../src/game/training-card';
import type { GameState } from '../src/game/types';

const wall = createWall();
const tiles = (key: string, count: number, offset = 0) => wall.filter((tile) => cardTileKey(tile) === key).slice(offset, offset + count);
const fillers = (excluded: string[], count: number) => wall.filter((tile) => tile.type.kind !== 'joker' && !excluded.includes(cardTileKey(tile))).slice(0, count);

function completePass(state: GameState, blindCount = 0): GameState {
  let next = state;
  for (let index = 0; index < 4; index += 1) {
    const player = next.players[next.charlestonRound % 4];
    const selected = player.rack.filter((tile) => tile.type.kind !== 'joker').slice(0, 3 - blindCount).map((tile) => tile.id);
    const result = applyGameAction(next, player.id, { type: 'PASS_TILES', tileIds: selected, blindCount });
    expect(result.ok).toBe(true);
    if (result.ok) next = result.state;
  }
  return next;
}

function playingState(): GameState {
  const state = createGame(91);
  state.phase = 'playing';
  state.charlestonAwaitingDecision = false;
  state.charlestonCourtesy = false;
  state.callWindow = null;
  state.turnIndex = 0;
  return state;
}

function resolveOtherResponses(state: GameState, excluded: string[]): GameState {
  let next = state;
  while (next.callWindow) {
    const responder = next.players.find((player) => !excluded.includes(player.id)
      && player.id !== next.callWindow!.discardedByPlayerId
      && !next.callWindow!.responses[player.id]);
    if (!responder) break;
    const result = applyGameAction(next, responder.id, { type: 'PASS_ON_DISCARD' });
    expect(result.ok).toBe(true);
    if (result.ok) next = result.state;
  }
  return next;
}

describe('tile model and deal', () => {
  it('creates the standard 152-tile wall and deterministic shuffles', () => {
    expect(createWall()).toHaveLength(152);
    expect(new Set(createWall().map((tile) => tile.id)).size).toBe(152);
    expect(deterministicShuffle(wall, 42).map((tile) => tile.id)).toEqual(deterministicShuffle(wall, 42).map((tile) => tile.id));
    expect(deterministicShuffle(wall, 42).map((tile) => tile.id)).not.toEqual(deterministicShuffle(wall, 43).map((tile) => tile.id));
  });

  it('preserves, drags, and keyboard-reorders the human rack without changing tiles', () => {
    const rack = createGame().players[0].rack.slice(0, 4);
    const initial = rack.map((tile) => tile.id);
    expect(reorderTileIds(initial, initial[0], initial[2])).toEqual([initial[1], initial[2], initial[0], initial[3]]);
    expect(placeTileId(initial, initial[0], initial[2], 'before')).toEqual([initial[1], initial[0], initial[2], initial[3]]);
    expect(placeTileId(initial, initial[0], initial[2], 'after')).toEqual([initial[1], initial[2], initial[0], initial[3]]);
    expect(moveTileId(initial, initial[2], -1)).toEqual([initial[0], initial[2], initial[1], initial[3]]);
    expect(normalizeTileOrder(initial.slice(0, 2), rack)).toEqual(initial);
  });

  it('deals 14 tiles to East and 13 to the other seats without exposing concealed racks', () => {
    const state = createGame();
    expect(state.players.map(totalPlayerTiles)).toEqual([14, 13, 13, 13]);
    expect(getPublicGameState(state).players[0]).not.toHaveProperty('rack');
    expect(getPlayerPrivateState(state, 'human')?.rack).toHaveLength(14);
  });
});

describe('Charleston state machine', () => {
  it('requires the human to act again after every completed compulsory pass', () => {
    const state = completePass(createGame());
    expect(state.charlestonPassIndex).toBe(1);
    expect(state.players[state.charlestonRound % 4].id).toBe('human');
    expect(state.events.filter((event) => event.type === 'CHARLESTON_PASS_COMPLETED').map((event) => event.direction)).toEqual(['right']);
  });

  it('runs first right/across/left and optional second left/across/right in order', () => {
    let state = createGame();
    state = completePass(state);
    state = completePass(state);
    state = completePass(state, 1);
    expect(state.charlestonAwaitingDecision).toBe(true);
    const decision = applyGameAction(state, 'human', { type: 'CHOOSE_SECOND_CHARLESTON', continue: true });
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    state = completePass(decision.state);
    state = completePass(state);
    state = completePass(state, 1);
    expect(state.charlestonCourtesy).toBe(true);
    expect(state.events.filter((event) => event.type === 'CHARLESTON_PASS_COMPLETED').map((event) => event.direction)).toEqual(['right', 'across', 'left', 'left', 'across', 'right']);
    expect(state.players.map(totalPlayerTiles)).toEqual([14, 13, 13, 13]);
  });

  it('allows one or two blind spaces only on the final pass', () => {
    let state = completePass(createGame());
    const early = applyGameAction(state, 'human', { type: 'PASS_TILES', tileIds: state.players[0].rack.slice(0, 2).map((tile) => tile.id), blindCount: 1 });
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.violation.code).toBe('INVALID_BLIND_PASS');
    state = completePass(state);
    state = completePass(state, 2);
    expect(state.charlestonPassIndex).toBe(3);
    expect(state.players.map(totalPlayerTiles)).toEqual([14, 13, 13, 13]);
  });

  it('rejects jokers and requires exactly three total pass spaces', () => {
    const state = createGame();
    const joker = wall.find((tile) => tile.type.kind === 'joker')!;
    state.players[0].rack = [joker, ...state.players[0].rack.slice(1)];
    const jokerPass = applyGameAction(state, 'human', { type: 'PASS_TILES', tileIds: state.players[0].rack.slice(0, 3).map((tile) => tile.id) });
    expect(jokerPass.ok).toBe(false);
    const shortPass = applyGameAction(state, 'human', { type: 'PASS_TILES', tileIds: [state.players[0].rack[1].id] });
    expect(shortPass.ok).toBe(false);
  });

  it('negotiates matching courtesy counts with the opposite player', () => {
    const state = createGame();
    state.charlestonCourtesy = true;
    const east = applyGameAction(state, 'human', { type: 'COURTESY_PASS', tileIds: [state.players[0].rack[0].id] });
    expect(east.ok).toBe(true);
    if (!east.ok) return;
    const south = applyGameAction(east.state, 'bot-1', { type: 'COURTESY_PASS', tileIds: [] });
    expect(south.ok).toBe(true);
    if (!south.ok) return;
    const west = applyGameAction(south.state, 'bot-2', { type: 'COURTESY_PASS', tileIds: south.state.players[2].rack.slice(0, 2).map((tile) => tile.id) });
    expect(west.ok).toBe(false);
    if (!west.ok) expect(west.violation.code).toBe('COURTESY_COUNT_MISMATCH');
  });
});

describe('Training Card legality', () => {
  it('stores explicit groups, exposure status and joker eligibility', () => {
    const hands = TrainingCardProvider.getHands();
    expect(hands).toHaveLength(10);
    expect(hands.find((hand) => hand.id === 'garden-path')).toMatchObject({ exposure: 'concealed' });
    expect(hands.flatMap((hand) => hand.groups).some((group) => group.kind === 'quint')).toBe(true);
    expect(hands.flatMap((hand) => hand.groups).some((group) => group.kind === 'sextet')).toBe(true);
    expect(hands.flatMap((hand) => hand.groups).filter((group) => ['single', 'pair'].includes(group.kind)).every((group) => !group.jokerAllowed)).toBe(true);
    expect(hands.every((hand) => hand.groups.reduce((total, group) => total + group.count, 0) === 14)).toBe(true);
  });

  it('uses jokers only in eligible groups and requires exactly 14 tiles', () => {
    const joker = wall.filter((tile) => tile.type.kind === 'joker')[0];
    const valid = [
      ...tiles('dots-2', 2), joker, ...tiles('dots-4', 3), ...tiles('dots-6', 3),
      ...tiles('dots-8', 3), ...tiles('wind-east', 2),
    ];
    expect(valid).toHaveLength(14);
    expect(TrainingCardProvider.validateMahjong(valid).valid).toBe(true);
    const invalidPairJoker = [
      ...tiles('dots-2', 3), ...tiles('dots-4', 3), ...tiles('dots-6', 3),
      ...tiles('dots-8', 3), ...tiles('wind-east', 1), joker,
    ];
    expect(TrainingCardProvider.validateMahjong(invalidPairJoker).valid).toBe(false);
    expect(TrainingCardProvider.validateMahjong([...valid, tiles('wind-north', 1)[0]]).valid).toBe(false);
  });

  it('recognizes every new Training Card line as an exact Mahjong', () => {
    const jokers = wall.filter((tile) => tile.type.kind === 'joker').slice(0, 4);
    const flowers = wall.filter((tile) => tile.type.kind === 'flower').slice(0, 5);
    const examples = [
      { id: 'crak-ladder', hand: [...tiles('characters-1', 3), ...tiles('characters-2', 3), ...tiles('characters-3', 3), ...tiles('characters-4', 3), ...tiles('dragon-white', 2)] },
      { id: 'twin-runs', hand: [...tiles('dots-3', 2), ...tiles('dots-4', 2), ...tiles('dots-5', 2), ...tiles('dots-6', 2), ...tiles('dots-7', 2), ...tiles('wind-north', 1), ...tiles('wind-east', 1), ...tiles('wind-south', 1), ...tiles('wind-west', 1)] },
      { id: 'dragon-garden', hand: [...tiles('dragon-red', 3), ...tiles('dragon-green', 3), ...tiles('dragon-white', 3), ...flowers] },
      { id: 'seven-stars', hand: [...tiles('bamboo-7', 4), jokers[0], jokers[1], ...tiles('dots-7', 4), jokers[2], jokers[3], ...tiles('wind-west', 2)] },
      { id: 'season-line', hand: [...wall.filter((tile) => tile.type.kind === 'flower').slice(0, 4), ...tiles('characters-3', 3), ...tiles('characters-6', 3), ...tiles('characters-9', 3), ...tiles('dragon-red', 1)] },
    ];
    for (const example of examples) {
      expect(example.hand).toHaveLength(14);
      expect(TrainingCardProvider.validateMahjong(example.hand)).toMatchObject({ valid: true, handId: example.id });
    }
  });

  it('marks concealed hands and incompatible exposures as unavailable', () => {
    const exposureTiles = tiles('dots-2', 3);
    const exposure = { id: 'exposure', kind: 'pung' as const, tiles: exposureTiles, calledFromPlayerId: 'bot-1' };
    const candidates = TrainingCardProvider.analyzeCandidates([...fillers([], 11), ...exposureTiles], [exposure]);
    expect(candidates.find((candidate) => candidate.handId === 'garden-path')?.viable).toBe(false);
  });

  it('marks a hand dead only when the discard pool blocks every compatible line', () => {
    const stillPossible = analyzeDiscardDeadHand([], [
      ...tiles('bamboo-1', 3),
    ]);
    expect(stillPossible.dead).toBe(false);
    expect(stillPossible.possibleHandIds.length).toBeGreaterThan(0);

    const discarded = [
      ...tiles('bamboo-1', 3),
      ...tiles('wind-east', 3),
      ...tiles('dragon-red', 4),
      ...tiles('dragon-green', 3),
      ...tiles('dragon-white', 3),
      ...tiles('bamboo-5', 4),
      ...tiles('characters-5', 4),
      ...tiles('dots-3', 3),
      ...tiles('wind-west', 3),
      ...wall.filter((tile) => tile.type.kind === 'flower'),
    ];
    const dead = analyzeDiscardDeadHand([], discarded);
    expect(dead.dead).toBe(true);
    expect(dead.possibleHandIds).toEqual([]);
    expect(dead.compatibleHandIds).toHaveLength(10);
  });
});

describe('turns, calls and exposures', () => {
  it('lets every non-discarder respond and gives the closest legal exposure priority', () => {
    const state = playingState();
    const twos = tiles('dots-2', 4);
    state.players[0].rack = [twos[0], ...fillers(['dots-2'], 13)];
    state.players[1].rack = [twos[1], twos[2], ...fillers(['dots-2'], 11)];
    state.players[2].rack = [twos[1], twos[3], ...fillers(['dots-2'], 11)];
    const discard = applyGameAction(state, 'human', { type: 'DISCARD_TILE', tileId: twos[0].id });
    expect(discard.ok).toBe(true);
    if (!discard.ok) return;
    const farther = applyGameAction(discard.state, 'bot-2', { type: 'CALL_TILE', rackTileIds: [twos[1].id, twos[3].id] });
    expect(farther.ok).toBe(true);
    if (!farther.ok) return;
    expect(farther.state.callWindow).not.toBeNull();
    const nearer = applyGameAction(farther.state, 'bot-1', { type: 'CALL_TILE', rackTileIds: [twos[1].id, twos[2].id] });
    expect(nearer.ok).toBe(true);
    if (!nearer.ok) return;
    const resolved = applyGameAction(nearer.state, 'bot-3', { type: 'PASS_ON_DISCARD' });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.players[1].exposures[0]).toMatchObject({ kind: 'pung', calledFromPlayerId: 'human' });
    expect(resolved.state.turnIndex).toBe(1);
  });

  it('allows a legal Flower Kong but rejects a grouping absent from the card', () => {
    const state = playingState();
    const flowers = wall.filter((tile) => tile.type.kind === 'flower').slice(0, 4);
    state.players[0].rack = [flowers[0], ...fillers(['flower-any'], 13)];
    state.players[1].rack = [flowers[1], flowers[2], flowers[3], ...fillers(['flower-any'], 10)];
    const discard = applyGameAction(state, 'human', { type: 'DISCARD_TILE', tileId: flowers[0].id });
    expect(discard.ok).toBe(true);
    if (!discard.ok) return;
    expect(getLegalCallOptions(discard.state.players[1].rack, [], flowers[0])[0]?.kind).toBe('kong');
    const call = applyGameAction(discard.state, 'bot-1', { type: 'CALL_TILE', rackTileIds: flowers.slice(1).map((tile) => tile.id) });
    expect(call.ok).toBe(true);

    const illegalState = playingState();
    const nines = tiles('dots-9', 4);
    illegalState.players[0].rack = [nines[0], ...fillers(['dots-9'], 13)];
    illegalState.players[1].rack = [nines[1], nines[2], ...fillers(['dots-9'], 11)];
    const illegalDiscard = applyGameAction(illegalState, 'human', { type: 'DISCARD_TILE', tileId: nines[0].id });
    expect(illegalDiscard.ok).toBe(true);
    if (!illegalDiscard.ok) return;
    const illegalCall = applyGameAction(illegalDiscard.state, 'bot-1', { type: 'CALL_TILE', rackTileIds: [nines[1].id, nines[2].id] });
    expect(illegalCall.ok).toBe(false);
    if (!illegalCall.ok) expect(illegalCall.violation.code).toBe('ILLEGAL_EXPOSURE');
  });

  it('discards immediately after a called Kong without a replacement draw', () => {
    let state = playingState();
    const sixes = tiles('dots-6', 4);
    state.players[0].rack = [sixes[0], ...fillers(['dots-6'], 13)];
    state.players[1].rack = [sixes[1], sixes[2], sixes[3], ...fillers(['dots-6'], 10)];
    const discard = applyGameAction(state, 'human', { type: 'DISCARD_TILE', tileId: sixes[0].id });
    expect(discard.ok).toBe(true);
    if (!discard.ok) return;
    const call = applyGameAction(discard.state, 'bot-1', { type: 'CALL_TILE', rackTileIds: sixes.slice(1).map((tile) => tile.id) });
    expect(call.ok).toBe(true);
    if (!call.ok) return;
    state = resolveOtherResponses(call.state, ['bot-1']);
    expect(totalPlayerTiles(state.players[1])).toBe(14);
    const draw = applyGameAction(state, 'bot-1', { type: 'DRAW_TILE' });
    expect(draw.ok).toBe(false);
    const discardAfterCall = applyGameAction(state, 'bot-1', { type: 'DISCARD_TILE', tileId: state.players[1].rack[0].id });
    expect(discardAfterCall.ok).toBe(true);
  });

  it('exchanges matching natural Flowers for exposed Jokers during the active turn', () => {
    const state = playingState();
    const flowers = wall.filter((tile) => tile.type.kind === 'flower').slice(0, 4);
    const joker = wall.find((tile) => tile.type.kind === 'joker')!;
    state.players[0].rack = [flowers[0], ...fillers(['flower-any'], 13)];
    state.players[1].exposures = [{ id: 'flowers', kind: 'kong', tiles: [flowers[1], flowers[2], flowers[3], joker], calledFromPlayerId: 'bot-2' }];
    const result = applyGameAction(state, 'human', { type: 'EXCHANGE_JOKER', exposureOwnerId: 'bot-1', exposureId: 'flowers', rackTileId: flowers[0].id, jokerTileId: joker.id });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.players[0].rack.some((tile) => tile.id === joker.id)).toBe(true);
  });

  it('finds shared Joker exchanges and bots redeem them before discarding', () => {
    const state = playingState();
    state.turnIndex = 1;
    const sixes = tiles('dots-6', 4);
    const joker = wall.find((tile) => tile.type.kind === 'joker')!;
    state.players[1].rack = [sixes[3], ...fillers(['dots-6'], 13)];
    state.players[2].exposures = [{ id: 'open-sixes', kind: 'kong', tiles: [sixes[0], sixes[1], sixes[2], joker], calledFromPlayerId: 'human' }];
    expect(getLegalJokerExchangeOptions(state, 'bot-1')).toHaveLength(1);

    const result = runBotAction(state, 'bot-1');
    expect(result.events.some((event) => event.type === 'JOKER_EXCHANGED' && event.playerId === 'bot-1')).toBe(true);
    expect(result.players[1].rack.some((tile) => tile.id === joker.id)).toBe(true);
    expect(result.players[2].exposures[0].tiles.some((tile) => tile.id === sixes[3].id)).toBe(true);
  });
});

describe('Mahjong and game completion', () => {
  it('allows the latest natural discard to complete a pair for Mahjong and gives it priority', () => {
    let state = playingState();
    const east = tiles('wind-east', 2);
    state.players[0].rack = [
      ...tiles('dots-2', 3), ...tiles('dots-4', 3), ...tiles('dots-6', 3), ...tiles('dots-8', 3), east[0],
    ];
    state.players[1].rack = [east[1], ...fillers(['wind-east'], 13)];
    state.turnIndex = 1;
    const discard = applyGameAction(state, 'bot-1', { type: 'DISCARD_TILE', tileId: east[1].id });
    expect(discard.ok).toBe(true);
    if (!discard.ok) return;
    const mahjong = applyGameAction(discard.state, 'human', { type: 'DECLARE_MAHJONG', useDiscard: true });
    expect(mahjong.ok).toBe(true);
    if (!mahjong.ok) return;
    state = resolveOtherResponses(mahjong.state, ['human']);
    expect(state.phase).toBe('completed');
    expect(state.winnerId).toBe('human');
    expect(totalPlayerTiles(state.players[0])).toBe(14);
  });

  it('ends as a wall game only when no tiles remain', () => {
    const state = playingState();
    state.players[0].rack = state.players[0].rack.slice(0, 13);
    state.wall = [];
    const result = applyGameAction(state, 'human', { type: 'DRAW_TILE' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state).toMatchObject({ phase: 'completed', winnerId: null });
  });

  it('completes deterministic games through Mahjong or wall exhaustion without invalid states', () => {
    expect(simulateGames(20)).toMatchObject({ requested: 20, completed: 20, invalid: 0, stalled: 0 });
  }, 40_000);
});
