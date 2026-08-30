export type Suit = 'bamboo' | 'characters' | 'dots';
export type Wind = 'north' | 'east' | 'south' | 'west';
export type Dragon = 'red' | 'green' | 'white';

export type TileKind =
  | { kind: 'number'; suit: Suit; rank: number }
  | { kind: 'wind'; wind: Wind }
  | { kind: 'dragon'; dragon: Dragon }
  | { kind: 'flower'; index: number }
  | { kind: 'joker' };

export interface Tile { id: string; type: TileKind }
export type Seat = 'east' | 'south' | 'west' | 'north';
export type AssistanceLevel = 0 | 1 | 2 | 3 | 4;
export type GamePhase = 'charleston' | 'playing' | 'completed';

export interface Player {
  id: string;
  name: string;
  seat: Seat;
  type: 'human' | 'bot';
  rack: Tile[];
  assistanceLevel: AssistanceLevel;
}

export type GameAction =
  | { type: 'PASS_TILES'; tileIds: string[] }
  | { type: 'DRAW_TILE' }
  | { type: 'DISCARD_TILE'; tileId: string }
  | { type: 'DECLARE_MAHJONG' };

export type GameEvent =
  | { type: 'GAME_CREATED'; sequence: number }
  | { type: 'TILES_DEALT'; sequence: number }
  | { type: 'TILES_PASSED'; sequence: number; playerId: string; tileIds: string[] }
  | { type: 'CHARLESTON_COMPLETED'; sequence: number }
  | { type: 'TILE_DRAWN'; sequence: number; playerId: string; tileId: string }
  | { type: 'TILE_DISCARDED'; sequence: number; playerId: string; tileId: string }
  | { type: 'MAHJONG_DECLARED'; sequence: number; playerId: string }
  | { type: 'GAME_COMPLETED'; sequence: number; winnerId: string | null };

export interface GameState {
  id: string;
  seed: number;
  phase: GamePhase;
  stateVersion: number;
  eventSequence: number;
  turnIndex: number;
  turnCount: number;
  charlestonRound: number;
  players: Player[];
  wall: Tile[];
  discards: Tile[];
  events: GameEvent[];
  winnerId: string | null;
}

export interface HandDefinition {
  id: string;
  section: string;
  name: string;
  description: string;
  tiles: string[];
}

export interface HandCandidate {
  handId: string;
  name: string;
  completionDistance: number;
  matchingTileIds: string[];
  recommendationScore: number;
  reasonCodes: string[];
}

export interface ValidationResult { valid: boolean; handId?: string; message: string }

export interface HandDefinitionProvider {
  id: string;
  name: string;
  version: string;
  getSections(): string[];
  getHands(): HandDefinition[];
  validateMahjong(tiles: Tile[]): ValidationResult;
  analyzeCandidates(tiles: Tile[]): HandCandidate[];
}

export interface GameRuleViolation { code: string; message: string }
export type GameActionResult = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; violation: GameRuleViolation };
