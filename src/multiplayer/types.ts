import type { GameAction, GameEvent, GameState, Player, Tile } from '../game/types';

export type GameMode = 'live' | 'async';
export type GameStatus = 'lobby' | 'active' | 'paused' | 'completed' | 'abandoned';
export type ControllerType = 'human' | 'bot';

export interface ActionEnvelope {
  actionId: string;
  expectedStateVersion: number;
  action: GameAction;
}

export interface PublicPlayerState extends Omit<Player, 'rack'> {
  rackCount: number;
  revealedRack?: Tile[];
}

export interface PublicGameState {
  id: string;
  phase: GameState['phase'];
  stateVersion: number;
  turnIndex: number;
  turnCount: number;
  wallCount: number;
  discards: Tile[];
  callWindow: {
    discard: Tile;
    discardedByPlayerId: string;
    responseCount: number;
  } | null;
  players: PublicPlayerState[];
  winnerId: string | null;
  charlestonPassIndex: number;
  charlestonAwaitingDecision: boolean;
  charlestonCourtesy: boolean;
  charlestonActorId: string | null;
}

export interface PlayerPrivateState {
  playerId: string;
  rack: Tile[];
  pendingAction: 'charleston_pass' | 'charleston_decision' | 'courtesy_pass' | 'draw' | 'discard' | 'discard_response' | 'wait' | 'completed';
}

export interface GameSnapshot {
  stateVersion: number;
  eventSequence: number;
  publicState: PublicGameState;
  privateState: PlayerPrivateState;
  deadlineAt: string | null;
  status: GameStatus;
  mode: GameMode;
  recentEvents: GameEvent[];
}

export interface GameListItem {
  id: string;
  status: GameStatus;
  mode: GameMode;
  stateVersion: number;
  deadlineAt: string | null;
  updatedAt: string;
  ownerId: string;
  playerCount: number;
  humanCount: number;
}

export interface RoomPlayer {
  userId: string | null;
  playerKey: string;
  seat: Player['seat'];
  controllerType: ControllerType;
  assistanceLevel: Player['assistanceLevel'];
  displayName: string;
  joinStatus: 'joined' | 'disconnected' | 'replaced';
  timeoutCount: number;
}

export interface RoomDetails {
  id: string;
  ownerId: string;
  status: GameStatus;
  mode: GameMode;
  turnSeconds: number;
  responseSeconds: number;
  inviteExpiresAt: string | null;
  players: RoomPlayer[];
}
