import { runBotAction } from './bots';
import { applyGameAction, createGame, totalPlayerTiles } from './engine';
import { getLegalCallOptions, TrainingCardProvider } from './training-card';
import type { GameState } from './types';

function chooseHumanDiscard(state: GameState): string {
  const player = state.players[0];
  const tiles = [...player.rack, ...player.exposures.flatMap((exposure) => exposure.tiles)];
  const best = TrainingCardProvider.analyzeCandidates(tiles, player.exposures)[0];
  const nonJokers = player.rack.filter((tile) => tile.type.kind !== 'joker');
  return nonJokers.find((tile) => !best.matchingTileIds.includes(tile.id))?.id
    ?? nonJokers[0]?.id
    ?? player.rack[0].id;
}

export function simulateGame(seed: number): { state: GameState; invalid: boolean; stalled: boolean } {
  let state = createGame(seed);
  let steps = 0;
  while (state.phase !== 'completed' && steps < 1200) {
    steps += 1;
    if (state.phase === 'charleston') {
      if (state.charlestonAwaitingDecision) {
        const decision = applyGameAction(state, 'human', { type: 'CHOOSE_SECOND_CHARLESTON', continue: false });
        if (!decision.ok) return { state, invalid: true, stalled: false };
        state = decision.state;
        continue;
      }
      const player = state.players[state.charlestonRound % 4];
      if (player.type === 'bot') state = runBotAction(state, player.id);
      else {
        const ids = player.rack.filter((tile) => tile.type.kind !== 'joker').slice(-3).map((tile) => tile.id);
        const result = state.charlestonCourtesy
          ? applyGameAction(state, player.id, { type: 'COURTESY_PASS', tileIds: [] })
          : applyGameAction(state, player.id, { type: 'PASS_TILES', tileIds: ids });
        if (!result.ok) return { state, invalid: true, stalled: false };
        state = result.state;
      }
      continue;
    }

    if (state.callWindow) {
      const responder = state.players.find((player) => player.id !== state.callWindow!.discardedByPlayerId && !state.callWindow!.responses[player.id]);
      if (!responder) return { state, invalid: true, stalled: true };
      if (responder.type === 'bot') state = runBotAction(state, responder.id);
      else {
        const tiles = [...responder.rack, ...responder.exposures.flatMap((exposure) => exposure.tiles), state.callWindow.discard];
        const action = TrainingCardProvider.validateMahjong(tiles, responder.exposures).valid
          ? { type: 'DECLARE_MAHJONG' as const, useDiscard: true }
          : getLegalCallOptions(responder.rack, responder.exposures, state.callWindow.discard)[0]
            ? { type: 'CALL_TILE' as const, rackTileIds: getLegalCallOptions(responder.rack, responder.exposures, state.callWindow.discard)[0].rackTileIds }
            : { type: 'PASS_ON_DISCARD' as const };
        const result = applyGameAction(state, responder.id, action);
        if (!result.ok) return { state, invalid: true, stalled: false };
        state = result.state;
      }
      continue;
    }

    const player = state.players[state.turnIndex];
    if (player.type === 'bot') state = runBotAction(state, player.id);
    else {
      let turnState = state;
      if (totalPlayerTiles(player) === 13) {
        const draw = applyGameAction(turnState, player.id, { type: 'DRAW_TILE' });
        if (!draw.ok) return { state, invalid: true, stalled: false };
        turnState = draw.state;
        if (turnState.phase === 'completed') {
          state = turnState;
          continue;
        }
      }
      const updated = turnState.players[0];
      const tiles = [...updated.rack, ...updated.exposures.flatMap((exposure) => exposure.tiles)];
      if (TrainingCardProvider.validateMahjong(tiles, updated.exposures).valid) {
        const mahjong = applyGameAction(turnState, player.id, { type: 'DECLARE_MAHJONG' });
        if (!mahjong.ok) return { state, invalid: true, stalled: false };
        state = mahjong.state;
        continue;
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
  let wins = 0;
  for (let index = 0; index < count; index += 1) {
    const result = simulateGame(2026 + index);
    if (result.invalid) invalid += 1;
    if (result.stalled) stalled += 1;
    if (result.state.phase === 'completed') completed += 1;
    if (result.state.winnerId) wins += 1;
    totalTurns += result.state.turnCount;
  }
  return { requested: count, completed, invalid, stalled, wins, averageTurns: count ? totalTurns / count : 0 };
}
