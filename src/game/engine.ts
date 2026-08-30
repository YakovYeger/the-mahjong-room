import { createWall, deterministicShuffle } from './tiles';
import { TrainingCardProvider } from './training-card';
import type { GameAction, GameActionResult, GameEvent, GameState, Player, Seat, Tile } from './types';

const seats: Seat[] = ['east', 'south', 'west', 'north'];
const names = ['You', 'Mara', 'June', 'Theo'];
type GameEventInput = { [Kind in GameEvent['type']]: Omit<Extract<GameEvent, { type: Kind }>, 'sequence'> }[GameEvent['type']];

function appendEvent(state: GameState, event: GameEventInput): GameEvent {
  const next = { ...event, sequence: state.eventSequence + 1 } as GameEvent;
  state.eventSequence += 1;
  state.events.push(next);
  return next;
}

export function createGame(seed = 2026): GameState {
  const wall = deterministicShuffle(createWall(), seed);
  const players: Player[] = seats.map((seat, index) => ({
    id: index === 0 ? 'human' : `bot-${index}`,
    name: names[index],
    seat,
    type: index === 0 ? 'human' : 'bot',
    rack: [],
    assistanceLevel: index === 0 ? 0 : 4,
  }));
  for (let tile = 0; tile < 13; tile += 1) for (const player of players) player.rack.push(wall.pop()!);
  players[0].rack.push(wall.pop()!);
  return {
    id: `training-${seed}`, seed, phase: 'charleston', stateVersion: 1, eventSequence: 2,
    turnIndex: 0, turnCount: 0, charlestonRound: 0, players, wall, discards: [], winnerId: null,
    events: [{ type: 'GAME_CREATED', sequence: 1 }, { type: 'TILES_DEALT', sequence: 2 }],
  };
}

function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

function violation(code: string, message: string): GameActionResult {
  return { ok: false, violation: { code, message } };
}

export function applyGameAction(state: GameState, playerId: string, action: GameAction): GameActionResult {
  const next = cloneState(state);
  const player = next.players.find((item) => item.id === playerId);
  if (!player) return violation('PLAYER_NOT_FOUND', 'That player is not part of this game.');
  if (next.phase === 'completed') return violation('GAME_COMPLETE', 'This game is already complete.');
  const emitted: GameEvent[] = [];

  if (action.type === 'PASS_TILES') {
    if (next.phase !== 'charleston') return violation('NOT_CHARLESTON', 'Tile passing is only available during the Charleston.');
    if (action.tileIds.length !== 3 || new Set(action.tileIds).size !== 3) return violation('PASS_EXACTLY_THREE', 'Choose exactly three different tiles to pass.');
    if (!action.tileIds.every((id) => player.rack.some((tile) => tile.id === id))) return violation('TILE_NOT_IN_RACK', 'One of those tiles is not in your rack.');
    const outgoing = player.rack.filter((tile) => action.tileIds.includes(tile.id));
    player.rack = player.rack.filter((tile) => !action.tileIds.includes(tile.id));
    const playerIndex = next.players.indexOf(player);
    const receiver = next.players[(playerIndex + 1) % next.players.length];
    receiver.rack.push(...outgoing);
    emitted.push(appendEvent(next, { type: 'TILES_PASSED', playerId, tileIds: action.tileIds }));
    next.charlestonRound += 1;
    if (next.charlestonRound >= 4) {
      next.phase = 'playing';
      emitted.push(appendEvent(next, { type: 'CHARLESTON_COMPLETED' }));
    }
  } else if (action.type === 'DRAW_TILE') {
    if (next.phase !== 'playing') return violation('NOT_PLAYING', 'Drawing begins after the Charleston.');
    if (next.players[next.turnIndex].id !== playerId) return violation('NOT_YOUR_TURN', 'Wait for your turn before drawing.');
    if (player.rack.length % 3 !== 1) return violation('DISCARD_FIRST', 'Discard before drawing another tile.');
    const tile = next.wall.pop();
    if (!tile) {
      next.phase = 'completed';
      emitted.push(appendEvent(next, { type: 'GAME_COMPLETED', winnerId: null }));
    } else {
      player.rack.push(tile);
      emitted.push(appendEvent(next, { type: 'TILE_DRAWN', playerId, tileId: tile.id }));
    }
  } else if (action.type === 'DISCARD_TILE') {
    if (next.phase !== 'playing') return violation('NOT_PLAYING', 'Discarding begins after the Charleston.');
    if (next.players[next.turnIndex].id !== playerId) return violation('NOT_YOUR_TURN', 'Wait for your turn before discarding.');
    const tileIndex = player.rack.findIndex((tile) => tile.id === action.tileId);
    if (tileIndex === -1) return violation('TILE_NOT_IN_RACK', 'Choose a tile from your rack.');
    if (player.rack.length % 3 !== 2) return violation('DRAW_FIRST', 'Draw a tile before discarding.');
    const [tile] = player.rack.splice(tileIndex, 1);
    next.discards.push(tile);
    next.turnCount += 1;
    next.turnIndex = (next.turnIndex + 1) % next.players.length;
    emitted.push(appendEvent(next, { type: 'TILE_DISCARDED', playerId, tileId: tile.id }));
    if (next.turnCount >= 80) {
      next.phase = 'completed';
      next.winnerId = null;
      emitted.push(appendEvent(next, { type: 'GAME_COMPLETED', winnerId: null }));
    }
  } else if (action.type === 'DECLARE_MAHJONG') {
    const validation = TrainingCardProvider.validateMahjong(player.rack);
    if (!validation.valid) return violation('INVALID_MAHJONG', validation.message);
    next.phase = 'completed';
    next.winnerId = playerId;
    emitted.push(appendEvent(next, { type: 'MAHJONG_DECLARED', playerId }));
    emitted.push(appendEvent(next, { type: 'GAME_COMPLETED', winnerId: playerId }));
  }

  next.stateVersion += 1;
  return { ok: true, state: next, events: emitted };
}

export function getPublicGameState(state: GameState) {
  return {
    id: state.id, phase: state.phase, stateVersion: state.stateVersion, turnIndex: state.turnIndex,
    turnCount: state.turnCount, wallCount: state.wall.length, discards: state.discards,
    players: state.players.map(({ rack, ...player }) => ({ ...player, rackCount: rack.length })),
    winnerId: state.winnerId,
  };
}

export function getPlayerPrivateState(state: GameState, playerId: string): { rack: Tile[] } | null {
  const player = state.players.find((item) => item.id === playerId);
  return player ? { rack: player.rack } : null;
}
