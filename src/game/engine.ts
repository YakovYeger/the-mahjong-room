import { createWall, deterministicShuffle } from './tiles';
import { cardTileKey, getLegalCallOptions, TrainingCardProvider } from './training-card';
import type { CallResponse, CreateGameOptions, Exposure, GameAction, GameActionResult, GameEvent, GameState, Player, Seat, Tile } from './types';

const seats: Seat[] = ['east', 'south', 'west', 'north'];
const names = ['You', 'Mara', 'June', 'Theo'];
const charlestonDirections = ['right', 'across', 'left', 'left', 'across', 'right'] as const;
type GameEventInput = { [Kind in GameEvent['type']]: Omit<Extract<GameEvent, { type: Kind }>, 'sequence'> }[GameEvent['type']];

function appendEvent(state: GameState, event: GameEventInput): GameEvent {
  const next = { ...event, sequence: state.eventSequence + 1 } as GameEvent;
  state.eventSequence += 1;
  state.events.push(next);
  return next;
}

export function totalPlayerTiles(player: Player): number {
  return player.rack.length + player.exposures.reduce((total, exposure) => total + exposure.tiles.length, 0);
}

export interface JokerExchangeOption {
  owner: Player;
  exposure: Exposure;
  joker: Tile;
  rackTile: Tile;
}

export function getLegalJokerExchangeOptions(state: GameState, playerId: string): JokerExchangeOption[] {
  if (state.phase !== 'playing' || state.callWindow || state.players[state.turnIndex]?.id !== playerId) return [];
  const player = state.players.find((item) => item.id === playerId);
  if (!player || totalPlayerTiles(player) !== 14) return [];
  return state.players.flatMap((owner) => owner.exposures.flatMap((exposure) => {
    const natural = exposure.tiles.find((tile) => tile.type.kind !== 'joker');
    if (!natural) return [];
    const matchingRackTiles = player.rack.filter((tile) => tile.type.kind !== 'joker' && cardTileKey(tile) === cardTileKey(natural));
    const jokers = exposure.tiles.filter((tile) => tile.type.kind === 'joker');
    return jokers.flatMap((joker) => matchingRackTiles.map((rackTile) => ({ owner, exposure, joker, rackTile })));
  }));
}

export function createGame(seedOrOptions: number | CreateGameOptions = 2026): GameState {
  const options = typeof seedOrOptions === 'number' ? { seed: seedOrOptions } : seedOrOptions;
  const seed = options.seed ?? 2026;
  const wall = deterministicShuffle(createWall(), seed);
  if (options.players && (options.players.length !== 4 || new Set(options.players.map((player) => player.seat)).size !== 4)) {
    throw new Error('A Mahjong game requires exactly one player in each of four seats.');
  }
  const configured = options.players
    ? seats.map((seat) => options.players!.find((player) => player.seat === seat)!)
    : seats.map((seat, index) => ({
      id: index === 0 ? 'human' : `bot-${index}`,
      name: names[index],
      seat,
      type: index === 0 ? 'human' as const : 'bot' as const,
      assistanceLevel: index === 0 ? 0 as const : 4 as const,
    }));
  const players: Player[] = configured.map((player) => ({
    id: player.id,
    name: player.name,
    seat: player.seat,
    type: player.type,
    rack: [],
    exposures: [],
    assistanceLevel: player.assistanceLevel ?? (player.type === 'human' ? 0 : 4),
  }));
  for (let tile = 0; tile < 13; tile += 1) for (const player of players) player.rack.push(wall.pop()!);
  players[0].rack.push(wall.pop()!);
  return {
    id: options.id ?? `training-${seed}`, seed, phase: 'charleston', stateVersion: 1, eventSequence: 2,
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

function resolveCharlestonPass(state: GameState, emitted: GameEvent[]): void {
  const direction = charlestonDirections[state.charlestonPassIndex];
  const offset = direction === 'right' ? 1 : direction === 'across' ? 2 : 3;
  const forwardSlots = state.players.map((player) => state.charlestonPendingPasses[player.id].blindCount);

  state.players.forEach((sender, senderIndex) => {
    for (const tile of state.charlestonPendingPasses[sender.id].tiles) {
      let receiverIndex = (senderIndex + offset) % state.players.length;
      while (forwardSlots[receiverIndex] > 0) {
        forwardSlots[receiverIndex] -= 1;
        receiverIndex = (receiverIndex + offset) % state.players.length;
      }
      state.players[receiverIndex].rack.push(tile);
    }
  });

  state.charlestonPendingPasses = {};
  state.charlestonPassIndex += 1;
  emitted.push(appendEvent(state, { type: 'CHARLESTON_PASS_COMPLETED', direction }));
  if (state.charlestonPassIndex === 3) state.charlestonAwaitingDecision = true;
  if (state.charlestonPassIndex === 6) state.charlestonCourtesy = true;
}

function responseOrder(state: GameState, playerId: string): number {
  const discarder = state.players.findIndex((player) => player.id === state.callWindow?.discardedByPlayerId);
  const caller = state.players.findIndex((player) => player.id === playerId);
  return (caller - discarder + state.players.length) % state.players.length;
}

function completeWithWinner(state: GameState, player: Player, discard: Tile | null, emitted: GameEvent[]): void {
  if (discard) {
    player.rack.push(discard);
    state.discards = state.discards.filter((tile) => tile.id !== discard.id);
  }
  state.phase = 'completed';
  state.winnerId = player.id;
  state.callWindow = null;
  emitted.push(appendEvent(state, { type: 'MAHJONG_DECLARED', playerId: player.id }));
  emitted.push(appendEvent(state, { type: 'GAME_COMPLETED', winnerId: player.id }));
}

function resolveCallResponses(state: GameState, emitted: GameEvent[]): void {
  const window = state.callWindow;
  if (!window || Object.keys(window.responses).length < state.players.length - 1) return;
  const responses = Object.entries(window.responses).sort(([left], [right]) => responseOrder(state, left) - responseOrder(state, right));
  const mahjong = responses.find(([, response]) => response.type === 'mahjong');
  if (mahjong) {
    const winner = state.players.find((player) => player.id === mahjong[0])!;
    completeWithWinner(state, winner, window.discard, emitted);
    return;
  }

  const called = responses.find(([, response]) => response.type === 'exposure') as [string, Extract<CallResponse, { type: 'exposure' }>] | undefined;
  if (called) {
    const caller = state.players.find((player) => player.id === called[0])!;
    const rackTiles = called[1].rackTileIds.map((id) => caller.rack.find((tile) => tile.id === id)!);
    caller.rack = caller.rack.filter((tile) => !called[1].rackTileIds.includes(tile.id));
    const exposureId = `exposure-${state.eventSequence + 1}`;
    caller.exposures.push({ id: exposureId, kind: called[1].kind, tiles: [...rackTiles, window.discard], calledFromPlayerId: window.discardedByPlayerId });
    state.discards = state.discards.filter((tile) => tile.id !== window.discard.id);
    state.turnIndex = state.players.indexOf(caller);
    state.callWindow = null;
    emitted.push(appendEvent(state, { type: 'DISCARD_CALLED', playerId: caller.id, tileId: window.discard.id }));
    emitted.push(appendEvent(state, { type: 'EXPOSURE_CREATED', playerId: caller.id, exposureId, kind: called[1].kind }));
    return;
  }

  state.callWindow = null;
  emitted.push(appendEvent(state, { type: 'CALL_WINDOW_CLOSED', playerId: state.players[state.turnIndex].id }));
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
    if (next.players[next.charlestonRound % 4].id !== playerId) return violation('NOT_YOUR_PASS', 'Wait for the other players to finish this pass.');
    const blindCount = action.blindCount ?? 0;
    const blindAllowed = [2, 5].includes(next.charlestonPassIndex);
    if (blindCount < 0 || blindCount > 2 || (!blindAllowed && blindCount > 0)) return violation('INVALID_BLIND_PASS', 'One or two blind tiles are available only on the final pass of a Charleston.');
    if (action.tileIds.length + blindCount !== 3 || new Set(action.tileIds).size !== action.tileIds.length) return violation('PASS_EXACTLY_THREE', 'Choose a total of three tiles, including any blind-pass spaces.');
    if (!action.tileIds.every((id) => player.rack.some((tile) => tile.id === id))) return violation('TILE_NOT_IN_RACK', 'One of those tiles is not in your rack.');
    const outgoing = player.rack.filter((tile) => action.tileIds.includes(tile.id));
    if (outgoing.some((tile) => tile.type.kind === 'joker')) return violation('CANNOT_PASS_JOKER', 'Jokers cannot be passed during the Charleston.');
    player.rack = player.rack.filter((tile) => !action.tileIds.includes(tile.id));
    next.charlestonPendingPasses[playerId] = { tiles: outgoing, blindCount };
    emitted.push(appendEvent(next, { type: 'TILES_PASSED', playerId, tileIds: action.tileIds }));
    next.charlestonRound += 1;
    if (Object.keys(next.charlestonPendingPasses).length === 4) resolveCharlestonPass(next, emitted);
  } else if (action.type === 'CHOOSE_SECOND_CHARLESTON') {
    if (next.phase !== 'charleston' || !next.charlestonAwaitingDecision) return violation('SECOND_CHARLESTON_NOT_AVAILABLE', 'The second Charleston decision is not available now.');
    if (player.seat !== 'east') return violation('EAST_RECORDS_CHARLESTON', 'East records whether the table unanimously continues.');
    next.charlestonAwaitingDecision = false;
    emitted.push(appendEvent(next, { type: 'SECOND_CHARLESTON_CHOSEN', continue: action.continue }));
    if (!action.continue) next.charlestonCourtesy = true;
  } else if (action.type === 'COURTESY_PASS') {
    if (next.phase !== 'charleston' || !next.charlestonCourtesy) return violation('COURTESY_PASS_NOT_AVAILABLE', 'The courtesy pass is not available now.');
    if (next.players[next.charlestonRound % 4].id !== playerId) return violation('NOT_YOUR_PASS', 'Wait for the other players to choose their courtesy pass.');
    if (action.tileIds.length > 3 || new Set(action.tileIds).size !== action.tileIds.length) return violation('INVALID_COURTESY_PASS', 'The courtesy pass may contain zero to three different tiles.');
    if (!action.tileIds.every((id) => player.rack.some((tile) => tile.id === id))) return violation('TILE_NOT_IN_RACK', 'Every courtesy tile must come from your rack.');
    const outgoing = player.rack.filter((tile) => action.tileIds.includes(tile.id));
    if (outgoing.some((tile) => tile.type.kind === 'joker')) return violation('CANNOT_PASS_JOKER', 'Jokers cannot be passed during the courtesy pass.');
    const playerIndex = next.players.indexOf(player);
    const opposite = next.players[(playerIndex + 2) % 4];
    const oppositeSelection = next.charlestonPendingPasses[opposite.id];
    if (oppositeSelection && oppositeSelection.tiles.length !== outgoing.length) return violation('COURTESY_COUNT_MISMATCH', `Choose ${oppositeSelection.tiles.length} tile${oppositeSelection.tiles.length === 1 ? '' : 's'} to match your opposite player.`);
    player.rack = player.rack.filter((tile) => !action.tileIds.includes(tile.id));
    next.charlestonPendingPasses[playerId] = { tiles: outgoing, blindCount: 0 };
    next.charlestonRound += 1;
    if (Object.keys(next.charlestonPendingPasses).length === 4) {
      next.players.forEach((sender, senderIndex) => next.players[(senderIndex + 2) % 4].rack.push(...next.charlestonPendingPasses[sender.id].tiles));
      next.charlestonPendingPasses = {};
      next.charlestonCourtesy = false;
      next.phase = 'playing';
      emitted.push(appendEvent(next, { type: 'COURTESY_PASS_COMPLETED' }));
      emitted.push(appendEvent(next, { type: 'CHARLESTON_COMPLETED' }));
    }
  } else if (action.type === 'DRAW_TILE') {
    if (next.phase !== 'playing') return violation('NOT_PLAYING', 'Drawing begins after the Charleston.');
    if (next.players[next.turnIndex].id !== playerId) return violation('NOT_YOUR_TURN', 'Wait for your turn before drawing.');
    if (next.callWindow) return violation('CALL_RESPONSE_PENDING', 'Resolve the latest discard before drawing.');
    if (totalPlayerTiles(player) !== 13) return violation('DISCARD_FIRST', 'Your hand must contain 13 tiles before drawing.');
    const tile = next.wall.pop();
    if (!tile) {
      next.phase = 'completed';
      next.winnerId = null;
      emitted.push(appendEvent(next, { type: 'GAME_COMPLETED', winnerId: null }));
    } else {
      player.rack.push(tile);
      emitted.push(appendEvent(next, { type: 'TILE_DRAWN', playerId, tileId: tile.id }));
    }
  } else if (action.type === 'DISCARD_TILE') {
    if (next.phase !== 'playing') return violation('NOT_PLAYING', 'Discarding begins after the Charleston.');
    if (next.players[next.turnIndex].id !== playerId) return violation('NOT_YOUR_TURN', 'Wait for your turn before discarding.');
    if (next.callWindow) return violation('CALL_RESPONSE_PENDING', 'Resolve the latest discard before discarding.');
    if (totalPlayerTiles(player) !== 14) return violation('DRAW_FIRST', 'Your hand must contain 14 tiles before discarding.');
    const tileIndex = player.rack.findIndex((tile) => tile.id === action.tileId);
    if (tileIndex === -1) return violation('TILE_NOT_IN_RACK', 'Choose a tile from your concealed rack.');
    const [tile] = player.rack.splice(tileIndex, 1);
    next.discards.push(tile);
    next.turnCount += 1;
    next.turnIndex = (next.turnIndex + 1) % next.players.length;
    next.callWindow = { discard: tile, discardedByPlayerId: playerId, responses: {} };
    emitted.push(appendEvent(next, { type: 'TILE_DISCARDED', playerId, tileId: tile.id }));
  } else if (action.type === 'CALL_TILE') {
    if (next.phase !== 'playing' || !next.callWindow) return violation('NO_CALL_WINDOW', 'There is no discard available to call.');
    if (next.callWindow.discardedByPlayerId === playerId) return violation('CANNOT_CALL_OWN_DISCARD', 'You cannot call your own discard.');
    if (next.callWindow.responses[playerId]) return violation('ALREADY_RESPONDED', 'You already responded to this discard.');
    if (new Set(action.rackTileIds).size !== action.rackTileIds.length) return violation('ILLEGAL_EXPOSURE', 'Each physical tile may be used only once in an exposure.');
    const selectedTiles = action.rackTileIds.map((id) => player.rack.find((tile) => tile.id === id));
    const option = getLegalCallOptions(player.rack, player.exposures, next.callWindow.discard)
      .find((candidate) => candidate.rackTileIds.length === action.rackTileIds.length
        && selectedTiles.every((tile) => tile && (tile.type.kind === 'joker' || cardTileKey(tile) === cardTileKey(next.callWindow!.discard))));
    if (!option) return violation('ILLEGAL_EXPOSURE', 'Those tiles do not make a legal Training Card exposure with this discard.');
    next.callWindow.responses[playerId] = { type: 'exposure', rackTileIds: action.rackTileIds, kind: option.kind };
    emitted.push(appendEvent(next, { type: 'CALL_RESPONSE_RECORDED', playerId, response: 'exposure' }));
    resolveCallResponses(next, emitted);
  } else if (action.type === 'PASS_ON_DISCARD') {
    if (next.phase !== 'playing' || !next.callWindow) return violation('NO_CALL_WINDOW', 'There is no discard response to pass on.');
    if (next.callWindow.discardedByPlayerId === playerId) return violation('CANNOT_RESPOND_TO_OWN_DISCARD', 'You do not respond to your own discard.');
    if (next.callWindow.responses[playerId]) return violation('ALREADY_RESPONDED', 'You already responded to this discard.');
    next.callWindow.responses[playerId] = { type: 'pass' };
    emitted.push(appendEvent(next, { type: 'CALL_RESPONSE_RECORDED', playerId, response: 'pass' }));
    resolveCallResponses(next, emitted);
  } else if (action.type === 'EXCHANGE_JOKER') {
    if (next.phase !== 'playing') return violation('NOT_PLAYING', 'Joker exchanges happen during normal play.');
    if (next.players[next.turnIndex].id !== playerId) return violation('NOT_YOUR_TURN', 'Exchange a joker only during your turn.');
    if (next.callWindow) return violation('CALL_RESPONSE_PENDING', 'Resolve the latest discard before exchanging a joker.');
    if (totalPlayerTiles(player) !== 14) return violation('DRAW_FIRST', 'Begin your turn by drawing or calling before exchanging a joker.');
    const rackTile = player.rack.find((tile) => tile.id === action.rackTileId);
    if (!rackTile || rackTile.type.kind === 'joker') return violation('INVALID_JOKER_REPLACEMENT', 'Replace a joker with its matching natural tile.');
    const owner = next.players.find((item) => item.id === action.exposureOwnerId);
    const exposure = owner?.exposures.find((item) => item.id === action.exposureId);
    if (!owner || !exposure) return violation('EXPOSURE_NOT_FOUND', 'That exposure is not available.');
    const jokerIndex = exposure.tiles.findIndex((tile) => tile.id === action.jokerTileId && tile.type.kind === 'joker');
    if (jokerIndex === -1) return violation('JOKER_NOT_FOUND', 'Choose a joker in the exposure.');
    const natural = exposure.tiles.find((tile) => tile.type.kind !== 'joker');
    if (!natural || cardTileKey(natural) !== cardTileKey(rackTile)) return violation('TILES_DO_NOT_MATCH', 'The replacement must match the natural tiles in the exposure.');
    const joker = exposure.tiles[jokerIndex];
    exposure.tiles[jokerIndex] = rackTile;
    player.rack = player.rack.filter((tile) => tile.id !== rackTile.id);
    player.rack.push(joker);
    emitted.push(appendEvent(next, { type: 'JOKER_EXCHANGED', playerId, exposureOwnerId: owner.id, exposureId: exposure.id, jokerTileId: joker.id }));
  } else if (action.type === 'DECLARE_MAHJONG') {
    if (action.useDiscard) {
      if (next.phase !== 'playing' || !next.callWindow || next.callWindow.discardedByPlayerId === playerId) return violation('NO_MAHJONG_DISCARD', 'There is no opponent discard available for Mahjong.');
      if (next.callWindow.responses[playerId]) return violation('ALREADY_RESPONDED', 'You already responded to this discard.');
      const tiles = [...player.rack, ...player.exposures.flatMap((exposure) => exposure.tiles), next.callWindow.discard];
      const validation = TrainingCardProvider.validateMahjong(tiles, player.exposures);
      if (!validation.valid || !validation.handId) return violation('INVALID_MAHJONG', validation.message);
      next.callWindow.responses[playerId] = { type: 'mahjong', handId: validation.handId };
      emitted.push(appendEvent(next, { type: 'CALL_RESPONSE_RECORDED', playerId, response: 'mahjong' }));
      resolveCallResponses(next, emitted);
    } else {
      const heavenly = next.phase === 'charleston' && player.seat === 'east' && next.charlestonPassIndex === 0 && next.charlestonRound === 0;
      if (!heavenly && (next.phase !== 'playing' || next.players[next.turnIndex].id !== playerId || next.callWindow)) return violation('NOT_YOUR_TURN', 'Declare Mahjong after drawing or by claiming the latest discard.');
      const tiles = [...player.rack, ...player.exposures.flatMap((exposure) => exposure.tiles)];
      const validation = TrainingCardProvider.validateMahjong(tiles, player.exposures);
      if (!validation.valid) return violation('INVALID_MAHJONG', validation.message);
      completeWithWinner(next, player, null, emitted);
    }
  }

  next.stateVersion += 1;
  return { ok: true, state: next, events: emitted };
}

export function getPublicGameState(state: GameState) {
  return {
    id: state.id, phase: state.phase, stateVersion: state.stateVersion, turnIndex: state.turnIndex,
    turnCount: state.turnCount, wallCount: state.wall.length, discards: state.discards,
    callWindow: state.callWindow ? {
      discard: state.callWindow.discard,
      discardedByPlayerId: state.callWindow.discardedByPlayerId,
      responseCount: Object.keys(state.callWindow.responses).length,
    } : null,
    players: state.players.map(({ rack, ...publicPlayer }) => ({ ...publicPlayer, rackCount: rack.length })),
    winnerId: state.winnerId,
    charlestonPassIndex: state.charlestonPassIndex,
    charlestonAwaitingDecision: state.charlestonAwaitingDecision,
    charlestonCourtesy: state.charlestonCourtesy,
    charlestonActorId: state.phase === 'charleston' && !state.charlestonAwaitingDecision
      ? state.players[state.charlestonRound % state.players.length]?.id ?? null
      : null,
  };
}

export function getPlayerPrivateState(state: GameState, playerId: string): { rack: Tile[] } | null {
  const player = state.players.find((item) => item.id === playerId);
  return player ? { rack: player.rack } : null;
}
