import { createWall, deterministicShuffle, tileKey } from './tiles';
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
    exposures: [],
    assistanceLevel: index === 0 ? 0 : 4,
  }));
  for (let tile = 0; tile < 13; tile += 1) for (const player of players) player.rack.push(wall.pop()!);
  players[0].rack.push(wall.pop()!);
  return {
    id: `training-${seed}`, seed, phase: 'charleston', stateVersion: 1, eventSequence: 2,
    turnIndex: 0, turnCount: 0, charlestonRound: 0, charlestonPassIndex: 0, charlestonPendingPasses: {},
    charlestonAwaitingDecision: false, charlestonCourtesy: false, players, wall, discards: [], callWindow: null, winnerId: null,
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
    if (next.charlestonCourtesy) return violation('COURTESY_PASS_REQUIRED', 'Use the courtesy pass action for the final across exchange.');
    if (next.charlestonAwaitingDecision) return violation('SECOND_CHARLESTON_DECISION_REQUIRED', 'Choose whether to continue with a second Charleston.');
    if (action.tileIds.length !== 3 || new Set(action.tileIds).size !== 3) return violation('PASS_EXACTLY_THREE', 'Choose exactly three different tiles to pass.');
    if (!action.tileIds.every((id) => player.rack.some((tile) => tile.id === id))) return violation('TILE_NOT_IN_RACK', 'One of those tiles is not in your rack.');
    const outgoing = player.rack.filter((tile) => action.tileIds.includes(tile.id));
    if (outgoing.some((tile) => tile.type.kind === 'joker')) return violation('CANNOT_PASS_JOKER', 'Jokers cannot be passed during the Charleston.');
    player.rack = player.rack.filter((tile) => !action.tileIds.includes(tile.id));
    next.charlestonPendingPasses[playerId] = outgoing;
    emitted.push(appendEvent(next, { type: 'TILES_PASSED', playerId, tileIds: action.tileIds }));
    next.charlestonRound += 1;
    if (Object.keys(next.charlestonPendingPasses).length === 4) {
      const directions = ['right', 'across', 'left', 'left', 'across', 'right'] as const;
      const direction = directions[next.charlestonPassIndex];
      const offset = direction === 'right' ? 1 : direction === 'across' ? 2 : 3;
      next.players.forEach((sender, senderIndex) => {
        next.players[(senderIndex + offset) % 4].rack.push(...next.charlestonPendingPasses[sender.id]);
      });
      next.charlestonPendingPasses = {};
      next.charlestonPassIndex += 1;
      emitted.push(appendEvent(next, { type: 'CHARLESTON_PASS_COMPLETED', direction }));
      if (next.charlestonPassIndex === 3) next.charlestonAwaitingDecision = true;
      if (next.charlestonPassIndex === 6) {
        next.charlestonCourtesy = true;
      }
    }
  } else if (action.type === 'CHOOSE_SECOND_CHARLESTON') {
    if (next.phase !== 'charleston' || !next.charlestonAwaitingDecision) return violation('SECOND_CHARLESTON_NOT_AVAILABLE', 'The second Charleston decision is not available now.');
    if (player.seat !== 'east') return violation('EAST_DECIDES_CHARLESTON', 'East records the table decision for the second Charleston.');
    next.charlestonAwaitingDecision = false;
    emitted.push(appendEvent(next, { type: 'SECOND_CHARLESTON_CHOSEN', continue: action.continue }));
    if (!action.continue) {
      next.charlestonCourtesy = true;
    }
  } else if (action.type === 'COURTESY_PASS') {
    if (next.phase !== 'charleston' || !next.charlestonCourtesy) return violation('COURTESY_PASS_NOT_AVAILABLE', 'The courtesy pass is not available now.');
    if (action.tileIds.length > 3 || new Set(action.tileIds).size !== action.tileIds.length) return violation('INVALID_COURTESY_PASS', 'The courtesy pass may contain zero to three different tiles.');
    if (!action.tileIds.every((id) => player.rack.some((tile) => tile.id === id))) return violation('TILE_NOT_IN_RACK', 'Every courtesy tile must come from your rack.');
    const outgoing = player.rack.filter((tile) => action.tileIds.includes(tile.id));
    if (outgoing.some((tile) => tile.type.kind === 'joker')) return violation('CANNOT_PASS_JOKER', 'Jokers cannot be passed during the courtesy pass.');
    player.rack = player.rack.filter((tile) => !action.tileIds.includes(tile.id));
    next.charlestonPendingPasses[playerId] = outgoing;
    next.charlestonRound += 1;
    if (Object.keys(next.charlestonPendingPasses).length === 4) {
      const counts = next.players.map((item) => next.charlestonPendingPasses[item.id].length);
      if (counts[0] !== counts[2] || counts[1] !== counts[3]) return violation('COURTESY_COUNT_MISMATCH', 'Opposite players must agree on the same courtesy-pass count.');
      next.players.forEach((sender, senderIndex) => next.players[(senderIndex + 2) % 4].rack.push(...next.charlestonPendingPasses[sender.id]));
      next.charlestonPendingPasses = {};
      next.charlestonCourtesy = false;
      next.phase = 'playing';
      emitted.push(appendEvent(next, { type: 'COURTESY_PASS_COMPLETED' }));
      emitted.push(appendEvent(next, { type: 'CHARLESTON_COMPLETED' }));
    }
  } else if (action.type === 'DRAW_TILE') {
    if (next.phase !== 'playing') return violation('NOT_PLAYING', 'Drawing begins after the Charleston.');
    if (next.players[next.turnIndex].id !== playerId) return violation('NOT_YOUR_TURN', 'Wait for your turn before drawing.');
    if (next.callWindow) return violation('CALL_RESPONSE_PENDING', 'Pass or call the latest discard before drawing.');
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
    next.callWindow = { discard: tile, discardedByPlayerId: playerId };
    emitted.push(appendEvent(next, { type: 'TILE_DISCARDED', playerId, tileId: tile.id }));
    if (next.turnCount >= 80) {
      next.phase = 'completed';
      next.winnerId = null;
      next.callWindow = null;
      emitted.push(appendEvent(next, { type: 'GAME_COMPLETED', winnerId: null }));
    }
  } else if (action.type === 'CALL_TILE') {
    if (next.phase !== 'playing' || !next.callWindow) return violation('NO_CALL_WINDOW', 'There is no discard available to call.');
    if (next.callWindow.discardedByPlayerId === playerId) return violation('CANNOT_CALL_OWN_DISCARD', 'You cannot call your own discard.');
    if (![2, 3].includes(action.rackTileIds.length) || new Set(action.rackTileIds).size !== action.rackTileIds.length) return violation('INVALID_EXPOSURE_SIZE', 'Use two tiles for a pung or three for a kong.');
    const rackTiles = action.rackTileIds.map((id) => player.rack.find((tile) => tile.id === id));
    if (rackTiles.some((tile) => !tile)) return violation('TILE_NOT_IN_RACK', 'Every tile used in a call must be in your rack.');
    const discard = next.callWindow.discard;
    if (discard.type.kind === 'joker' || discard.type.kind === 'flower') return violation('UNCALLABLE_DISCARD', 'Jokers and flowers cannot be called from the discard pile.');
    const discardKey = tileKey(discard);
    if (!rackTiles.every((tile) => tile!.type.kind === 'joker' || tileKey(tile!) === discardKey)) return violation('TILES_DO_NOT_MATCH', 'A pung or kong must use matching natural tiles or jokers.');
    const kind = action.rackTileIds.length === 2 ? 'pung' : 'kong';
    player.rack = player.rack.filter((tile) => !action.rackTileIds.includes(tile.id));
    const exposureId = `exposure-${next.eventSequence + 1}`;
    player.exposures.push({ id: exposureId, kind, tiles: [...rackTiles as Tile[], discard], calledFromPlayerId: next.callWindow.discardedByPlayerId });
    next.discards = next.discards.filter((tile) => tile.id !== discard.id);
    next.turnIndex = next.players.indexOf(player);
    next.callWindow = null;
    emitted.push(appendEvent(next, { type: 'DISCARD_CALLED', playerId, tileId: discard.id }));
    emitted.push(appendEvent(next, { type: 'EXPOSURE_CREATED', playerId, exposureId, kind }));
  } else if (action.type === 'PASS_ON_DISCARD') {
    if (next.phase !== 'playing' || !next.callWindow) return violation('NO_CALL_WINDOW', 'There is no discard response to pass on.');
    if (next.players[next.turnIndex].id !== playerId) return violation('NOT_NEXT_PLAYER', 'The next player closes the call window.');
    next.callWindow = null;
    emitted.push(appendEvent(next, { type: 'CALL_WINDOW_CLOSED', playerId }));
  } else if (action.type === 'EXCHANGE_JOKER') {
    if (next.phase !== 'playing') return violation('NOT_PLAYING', 'Joker exchanges happen during normal play.');
    if (next.players[next.turnIndex].id !== playerId) return violation('NOT_YOUR_TURN', 'Exchange a joker only during your turn.');
    if (next.callWindow) return violation('CALL_RESPONSE_PENDING', 'Resolve the latest discard before exchanging a joker.');
    if (player.rack.length % 3 !== 2) return violation('DRAW_FIRST', 'Draw your tile before exchanging a joker.');
    const rackTile = player.rack.find((tile) => tile.id === action.rackTileId);
    if (!rackTile) return violation('TILE_NOT_IN_RACK', 'The replacement tile must come from your rack.');
    if (rackTile.type.kind === 'joker' || rackTile.type.kind === 'flower') return violation('INVALID_JOKER_REPLACEMENT', 'Replace a joker with its matching natural tile.');
    const owner = next.players.find((item) => item.id === action.exposureOwnerId);
    const exposure = owner?.exposures.find((item) => item.id === action.exposureId);
    if (!owner || !exposure) return violation('EXPOSURE_NOT_FOUND', 'That exposure is not available.');
    const jokerIndex = exposure.tiles.findIndex((tile) => tile.id === action.jokerTileId && tile.type.kind === 'joker');
    if (jokerIndex === -1) return violation('JOKER_NOT_FOUND', 'Choose a joker in the exposure.');
    const natural = exposure.tiles.find((tile) => tile.type.kind !== 'joker');
    if (!natural || tileKey(natural) !== tileKey(rackTile)) return violation('TILES_DO_NOT_MATCH', 'The replacement must match the natural tiles in the exposure.');
    const joker = exposure.tiles[jokerIndex];
    exposure.tiles[jokerIndex] = rackTile;
    player.rack = player.rack.filter((tile) => tile.id !== rackTile.id);
    player.rack.push(joker);
    emitted.push(appendEvent(next, { type: 'JOKER_EXCHANGED', playerId, exposureOwnerId: owner.id, exposureId: exposure.id, jokerTileId: joker.id }));
  } else if (action.type === 'DECLARE_MAHJONG') {
    const validation = TrainingCardProvider.validateMahjong([...player.rack, ...player.exposures.flatMap((exposure) => exposure.tiles)]);
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
    callWindow: state.callWindow ? { discard: state.callWindow.discard, discardedByPlayerId: state.callWindow.discardedByPlayerId } : null,
    players: state.players.map(({ rack, ...player }) => ({ ...player, rackCount: rack.length })),
    winnerId: state.winnerId,
  };
}

export function getPlayerPrivateState(state: GameState, playerId: string): { rack: Tile[] } | null {
  const player = state.players.find((item) => item.id === playerId);
  return player ? { rack: player.rack } : null;
}
