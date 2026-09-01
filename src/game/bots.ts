import { applyGameAction, getLegalJokerExchangeOptions, totalPlayerTiles } from './engine';
import { getLegalCallOptions, TrainingCardProvider } from './training-card';
import type { GameState, Player } from './types';

function leastUsefulTileIds(player: Player, count: number, excludeJokers = false): string[] {
  const allTiles = [...player.rack, ...player.exposures.flatMap((exposure) => exposure.tiles)];
  const best = TrainingCardProvider.analyzeCandidates(allTiles, player.exposures)[0];
  const useful = new Set(best?.matchingTileIds ?? []);
  const eligible = player.rack.filter((tile) => !excludeJokers || tile.type.kind !== 'joker');
  const nonJokers = eligible.filter((tile) => tile.type.kind !== 'joker');
  const pool = nonJokers.length >= count ? nonJokers : eligible;
  return pool
    .sort((left, right) => Number(useful.has(left.id)) - Number(useful.has(right.id)) || left.id.localeCompare(right.id))
    .slice(0, count)
    .map((tile) => tile.id);
}

function botCourtesyCount(state: GameState, player: Player): number {
  const playerIndex = state.players.indexOf(player);
  const opposite = state.players[(playerIndex + 2) % 4];
  return state.charlestonPendingPasses[opposite.id]?.tiles.length ?? 0;
}

export function runBotAction(state: GameState, playerId: string): GameState {
  const player = state.players.find((item) => item.id === playerId);
  if (!player) return state;

  if (state.phase === 'charleston') {
    if (state.charlestonAwaitingDecision) return state;
    if (state.players[state.charlestonRound % 4].id !== playerId) return state;
    if (state.charlestonCourtesy) {
      const count = botCourtesyCount(state, player);
      const result = applyGameAction(state, playerId, { type: 'COURTESY_PASS', tileIds: leastUsefulTileIds(player, count, true) });
      return result.ok ? result.state : state;
    }
    const result = applyGameAction(state, playerId, { type: 'PASS_TILES', tileIds: leastUsefulTileIds(player, 3, true) });
    return result.ok ? result.state : state;
  }

  if (state.phase !== 'playing') return state;

  if (state.callWindow) {
    if (state.callWindow.discardedByPlayerId === playerId || state.callWindow.responses[playerId]) return state;
    const mahjongTiles = [...player.rack, ...player.exposures.flatMap((exposure) => exposure.tiles), state.callWindow.discard];
    if (TrainingCardProvider.validateMahjong(mahjongTiles, player.exposures).valid) {
      const result = applyGameAction(state, playerId, { type: 'DECLARE_MAHJONG', useDiscard: true });
      return result.ok ? result.state : state;
    }
    const option = getLegalCallOptions(player.rack, player.exposures, state.callWindow.discard)[0];
    const result = option
      ? applyGameAction(state, playerId, { type: 'CALL_TILE', rackTileIds: option.rackTileIds })
      : applyGameAction(state, playerId, { type: 'PASS_ON_DISCARD' });
    return result.ok ? result.state : state;
  }

  if (state.players[state.turnIndex].id !== playerId) return state;
  let current = state;
  let active = current.players.find((item) => item.id === playerId)!;
  if (totalPlayerTiles(active) === 13) {
    const draw = applyGameAction(current, playerId, { type: 'DRAW_TILE' });
    if (!draw.ok) return current;
    current = draw.state;
    if (current.phase === 'completed') return current;
    active = current.players.find((item) => item.id === playerId)!;
  }

  let exchangeGuard = 0;
  while (exchangeGuard < 8) {
    const exchange = getLegalJokerExchangeOptions(current, playerId)[0];
    if (!exchange) break;
    const result = applyGameAction(current, playerId, {
      type: 'EXCHANGE_JOKER',
      exposureOwnerId: exchange.owner.id,
      exposureId: exchange.exposure.id,
      rackTileId: exchange.rackTile.id,
      jokerTileId: exchange.joker.id,
    });
    if (!result.ok) break;
    current = result.state;
    active = current.players.find((item) => item.id === playerId)!;
    exchangeGuard += 1;
  }

  const tiles = [...active.rack, ...active.exposures.flatMap((exposure) => exposure.tiles)];
  if (TrainingCardProvider.validateMahjong(tiles, active.exposures).valid) {
    const mahjong = applyGameAction(current, playerId, { type: 'DECLARE_MAHJONG' });
    if (mahjong.ok) return mahjong.state;
  }

  const discardId = leastUsefulTileIds(active, 1)[0];
  const discard = applyGameAction(current, playerId, { type: 'DISCARD_TILE', tileId: discardId });
  return discard.ok ? discard.state : current;
}
