import { getPlayerPrivateState, getPublicGameState } from '../game/engine';
import type { GameEvent, GameState } from '../game/types';
import type { GameMode, GameSnapshot, GameStatus, PlayerPrivateState, PublicGameState } from './types';

export function sanitizePublicEvent(event: GameEvent): GameEvent {
  if (event.type === 'TILE_DRAWN') return { type: event.type, sequence: event.sequence, playerId: event.playerId, tileId: 'private' };
  if (event.type === 'TILES_PASSED') return { type: event.type, sequence: event.sequence, playerId: event.playerId, tileIds: [] };
  return structuredClone(event);
}

export function publicProjection(state: GameState): PublicGameState {
  if (state.phase !== 'completed') return getPublicGameState(state);
  return {
    ...getPublicGameState(state),
    players: state.players.map(({ rack, ...player }) => ({ ...player, rackCount: rack.length, revealedRack: rack })),
  };
}

function pendingActionFor(state: GameState, playerId: string): PlayerPrivateState['pendingAction'] {
  if (state.phase === 'completed') return 'completed';
  if (state.phase === 'charleston') {
    if (state.charlestonAwaitingDecision) return state.players.find((player) => player.seat === 'east')?.id === playerId ? 'charleston_decision' : 'wait';
    if (state.players[state.charlestonRound % state.players.length]?.id !== playerId) return 'wait';
    return state.charlestonCourtesy ? 'courtesy_pass' : 'charleston_pass';
  }
  if (state.callWindow) {
    if (state.callWindow.discardedByPlayerId === playerId || state.callWindow.responses[playerId]) return 'wait';
    return 'discard_response';
  }
  if (state.players[state.turnIndex]?.id !== playerId) return 'wait';
  const player = state.players.find((item) => item.id === playerId)!;
  const total = player.rack.length + player.exposures.reduce((sum, exposure) => sum + exposure.tiles.length, 0);
  return total === 13 ? 'draw' : 'discard';
}

export function snapshotForPlayer(
  state: GameState,
  playerId: string,
  status: GameStatus,
  mode: GameMode,
  deadlineAt: string | null,
  recentEvents: GameEvent[] = [],
): GameSnapshot | null {
  const privateRack = getPlayerPrivateState(state, playerId);
  if (!privateRack) return null;
  return {
    stateVersion: state.stateVersion,
    eventSequence: state.eventSequence,
    publicState: publicProjection(state),
    privateState: { playerId, rack: privateRack.rack, pendingAction: pendingActionFor(state, playerId) },
    deadlineAt,
    status,
    mode,
    recentEvents: recentEvents.map(sanitizePublicEvent),
  };
}
