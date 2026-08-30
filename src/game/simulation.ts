import { runBotAction } from './bots';
import { applyGameAction, createGame } from './engine';
import { TrainingCardProvider } from './training-card';
import type { GameState } from './types';

function chooseHumanDiscard(state: GameState): string {
  const player = state.players[0];
  const best = TrainingCardProvider.analyzeCandidates(player.rack)[0];
  return player.rack.find((tile) => !best.matchingTileIds.includes(tile.id))?.id ?? player.rack[0].id;
}

export function simulateGame(seed: number): { state: GameState; invalid: boolean; stalled: boolean } {
  let state = createGame(seed);
  let steps = 0;
  while (state.phase !== 'completed' && steps < 300) {
    steps += 1;
    if (state.phase === 'charleston') {
      if (state.charlestonCourtesy) {
        const player = state.players[state.charlestonRound % 4];
        const courtesy = applyGameAction(state, player.id, { type: 'COURTESY_PASS', tileIds: [] });
        if (!courtesy.ok) return { state, invalid: true, stalled: false };
        state = courtesy.state;
        continue;
      }
      if (state.charlestonAwaitingDecision) {
        const decision = applyGameAction(state, 'human', { type: 'CHOOSE_SECOND_CHARLESTON', continue: false });
        if (!decision.ok) return { state, invalid: true, stalled: false };
        state = decision.state;
        continue;
      }
      const player = state.players[state.charlestonRound % 4];
      const ids = player.rack.slice(-3).map((tile) => tile.id);
      const result = applyGameAction(state, player.id, { type: 'PASS_TILES', tileIds: ids });
      if (!result.ok) return { state, invalid: true, stalled: false };
      state = result.state;
      continue;
    }
    const player = state.players[state.turnIndex];
    if (player.type === 'bot') state = runBotAction(state, player.id);
    else {
      let turnState = state;
      if (turnState.callWindow) {
        const pass = applyGameAction(turnState, player.id, { type: 'PASS_ON_DISCARD' });
        if (!pass.ok) return { state, invalid: true, stalled: false };
        turnState = pass.state;
      }
      if (player.rack.length % 3 === 1) {
        const draw = applyGameAction(turnState, player.id, { type: 'DRAW_TILE' });
        if (!draw.ok) return { state, invalid: true, stalled: false };
        turnState = draw.state;
      }
      const discard = applyGameAction(turnState, player.id, { type: 'DISCARD_TILE', tileId: chooseHumanDiscard(turnState) });
      if (!discard.ok) return { state: turnState, invalid: true, stalled: false };
      state = discard.state;
    }
  }
  return { state, invalid: false, stalled: state.phase !== 'completed' };
}

export function simulateGames(count: number) {
  let completed = 0;
  let invalid = 0;
  let stalled = 0;
  let totalTurns = 0;
  for (let index = 0; index < count; index += 1) {
    const result = simulateGame(2026 + index);
    if (result.invalid) invalid += 1;
    if (result.stalled) stalled += 1;
    if (result.state.phase === 'completed') completed += 1;
    totalTurns += result.state.turnCount;
  }
  return { requested: count, completed, invalid, stalled, averageTurns: count ? totalTurns / count : 0 };
}
