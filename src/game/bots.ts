import { applyGameAction } from './engine';
import { tileKey } from './tiles';
import { TrainingCardProvider } from './training-card';
import type { GameState, Player } from './types';

function leastUsefulTileIds(player: Player, count: number): string[] {
  const best = TrainingCardProvider.analyzeCandidates([...player.rack, ...player.exposures.flatMap((exposure) => exposure.tiles)])[0];
  const useful = new Set(best?.matchingTileIds ?? []);
  return [...player.rack].sort((a, b) => Number(useful.has(a.id)) - Number(useful.has(b.id))).slice(0, count).map((tile) => tile.id);
}

export function runBotAction(state: GameState, playerId: string): GameState {
  const player = state.players.find((item) => item.id === playerId);
  if (!player) return state;
  if (state.phase === 'charleston') {
    if (state.charlestonCourtesy) {
      const result = applyGameAction(state, playerId, { type: 'COURTESY_PASS', tileIds: [] });
      return result.ok ? result.state : state;
    }
    const result = applyGameAction(state, playerId, { type: 'PASS_TILES', tileIds: leastUsefulTileIds(player, 3) });
    return result.ok ? result.state : state;
  }
  let current = state;
  if (current.callWindow) {
    const naturalMatches = player.rack.filter((tile) => tile.type.kind !== 'joker' && tileKey(tile) === tileKey(current.callWindow!.discard));
    const jokers = player.rack.filter((tile) => tile.type.kind === 'joker');
    const callTiles = [...naturalMatches, ...jokers].slice(0, 2);
    if (callTiles.length === 2 && current.callWindow.discardedByPlayerId !== playerId) {
      const call = applyGameAction(current, playerId, { type: 'CALL_TILE', rackTileIds: callTiles.map((tile) => tile.id) });
      if (call.ok) current = call.state;
      else if (current.players[current.turnIndex].id === playerId) {
        const pass = applyGameAction(current, playerId, { type: 'PASS_ON_DISCARD' });
        if (pass.ok) current = pass.state;
      }
    } else if (current.players[current.turnIndex].id === playerId) {
      const pass = applyGameAction(current, playerId, { type: 'PASS_ON_DISCARD' });
      if (pass.ok) current = pass.state;
    } else {
      return current;
    }
  }
  const activePlayer = current.players.find((item) => item.id === playerId)!;
  if (activePlayer.rack.length % 3 === 1) {
    const draw = applyGameAction(current, playerId, { type: 'DRAW_TILE' });
    if (!draw.ok) return current;
    current = draw.state;
  }
  const updated = current.players.find((item) => item.id === playerId)!;
  const discard = applyGameAction(current, playerId, { type: 'DISCARD_TILE', tileId: leastUsefulTileIds(updated, 1)[0] });
  return discard.ok ? discard.state : current;
}
