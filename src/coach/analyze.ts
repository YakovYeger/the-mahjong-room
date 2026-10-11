import { getCardProvider } from '../game/cards';
import type { GameState, Tile } from '../game/types';
import type { CoachVisibleContext } from './types';

export function getCoachVisibleContext(state: GameState, playerId: string): CoachVisibleContext | null {
  const player = state.players.find((item) => item.id === playerId);
  if (!player) return null;
  const tiles = [...player.rack, ...player.exposures.flatMap((exposure) => exposure.tiles)];
  return {
    playerId,
    cardId: state.cardId,
    rack: player.rack,
    ownExposures: player.exposures,
    visibleExposures: state.players.flatMap((item) => item.exposures.map((exposure) => ({ playerId: item.id, exposure }))),
    discards: state.discards,
    callWindow: state.callWindow,
    wallCount: state.wall.length,
    candidates: getCardProvider(state.cardId).analyzeCandidates(tiles, player.exposures),
  };
}

export function countRackPairs(rack: Tile[]): Set<string> {
  const counts = new Map<string, number>();
  for (const tile of rack) {
    const key = JSON.stringify(tile.type);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count >= 2).map(([key]) => key));
}
