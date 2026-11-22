import { runBotAction } from './bots';
import { applyGameAction, createGame } from './engine';
import type { GameState } from './types';

export const charlestonShuffleCardId = 'photo-2025';
export const charlestonShuffleDirections = ['Right', 'Across', 'Left'] as const;

export function dealCharlestonShuffle(seed: number) {
  return createGame({ seed, cardId: charlestonShuffleCardId });
}

export function exchangeCharlestonTiles(game: GameState, tileIds: string[]) {
  const player = game.players[0];
  const pass = applyGameAction(game, player.id, { type: 'PASS_TILES', tileIds });
  if (!pass.ok) return null;

  const next = game.players.slice(1).reduce((state, bot) => runBotAction(state, bot.id), pass.state);
  if (next.charlestonPassIndex !== game.charlestonPassIndex + 1) return null;

  const previousIds = new Set(player.rack.map(tile => tile.id));
  return { game: next, received: next.players[0].rack.filter(tile => !previousIds.has(tile.id)) };
}
