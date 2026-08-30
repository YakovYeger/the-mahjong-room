import { applyGameAction } from './engine';
import { TrainingCardProvider } from './training-card';
import type { GameState, Player } from './types';

function leastUsefulTileIds(player: Player, count: number): string[] {
  const best = TrainingCardProvider.analyzeCandidates(player.rack)[0];
  const useful = new Set(best?.matchingTileIds ?? []);
  return [...player.rack].sort((a, b) => Number(useful.has(a.id)) - Number(useful.has(b.id))).slice(0, count).map((tile) => tile.id);
}

export function runBotAction(state: GameState, playerId: string): GameState {
  const player = state.players.find((item) => item.id === playerId);
  if (!player) return state;
  if (state.phase === 'charleston') {
    const result = applyGameAction(state, playerId, { type: 'PASS_TILES', tileIds: leastUsefulTileIds(player, 3) });
    return result.ok ? result.state : state;
  }
  let current = state;
  if (player.rack.length % 3 === 1) {
    const draw = applyGameAction(current, playerId, { type: 'DRAW_TILE' });
    if (!draw.ok) return current;
    current = draw.state;
  }
  const updated = current.players.find((item) => item.id === playerId)!;
  const discard = applyGameAction(current, playerId, { type: 'DISCARD_TILE', tileId: leastUsefulTileIds(updated, 1)[0] });
  return discard.ok ? discard.state : current;
}
