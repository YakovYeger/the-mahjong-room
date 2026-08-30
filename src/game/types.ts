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
export type ExposureKind = 'pung' | 'kong' | 'quint' | 'sextet';
export type HandGroupKind = 'single' | 'pair' | ExposureKind;
export type CharlestonDirection = 'right' | 'across' | 'left';

export interface Exposure {
  id: string;
  kind: ExposureKind;
  tiles: Tile[];
  calledFromPlayerId: string;
}

export interface CallWindow {
  discard: Tile;
  discardedByPlayerId: string;
  responses: Record<string, CallResponse>;
}

export type CallResponse =
  | { type: 'pass' }
  | { type: 'exposure'; rackTileIds: string[]; kind: ExposureKind }
  | { type: 'mahjong'; handId: string };

export interface CharlestonPassSelection {
  tiles: Tile[];
  blindCount: number;
}

export interface Player {
  id: string;
  name: string;
  seat: Seat;
  type: 'human' | 'bot';
  rack: Tile[];
  exposures: Exposure[];
  assistanceLevel: AssistanceLevel;
}

export type GameAction =
  | { type: 'PASS_TILES'; tileIds: string[]; blindCount?: number }
  | { type: 'CHOOSE_SECOND_CHARLESTON'; continue: boolean }
  | { type: 'COURTESY_PASS'; tileIds: string[] }
  | { type: 'DRAW_TILE' }
  | { type: 'DISCARD_TILE'; tileId: string }
  | { type: 'CALL_TILE'; rackTileIds: string[] }
  | { type: 'PASS_ON_DISCARD' }
  | { type: 'EXCHANGE_JOKER'; exposureOwnerId: string; exposureId: string; rackTileId: string; jokerTileId: string }
  | { type: 'DECLARE_MAHJONG'; useDiscard?: boolean };

export type GameEvent =
  | { type: 'GAME_CREATED'; sequence: number }
  | { type: 'TILES_DEALT'; sequence: number }
  | { type: 'TILES_PASSED'; sequence: number; playerId: string; tileIds: string[] }
  | { type: 'CHARLESTON_PASS_COMPLETED'; sequence: number; direction: CharlestonDirection }
  | { type: 'SECOND_CHARLESTON_CHOSEN'; sequence: number; continue: boolean }
  | { type: 'COURTESY_PASS_COMPLETED'; sequence: number }
  | { type: 'CHARLESTON_COMPLETED'; sequence: number }
  | { type: 'TILE_DRAWN'; sequence: number; playerId: string; tileId: string }
  | { type: 'TILE_DISCARDED'; sequence: number; playerId: string; tileId: string }
  | { type: 'DISCARD_CALLED'; sequence: number; playerId: string; tileId: string }
  | { type: 'CALL_RESPONSE_RECORDED'; sequence: number; playerId: string; response: CallResponse['type'] }
  | { type: 'EXPOSURE_CREATED'; sequence: number; playerId: string; exposureId: string; kind: ExposureKind }
  | { type: 'CALL_WINDOW_CLOSED'; sequence: number; playerId: string }
  | { type: 'JOKER_EXCHANGED'; sequence: number; playerId: string; exposureOwnerId: string; exposureId: string; jokerTileId: string }
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
  charlestonPassIndex: number;
  charlestonPendingPasses: Record<string, CharlestonPassSelection>;
  charlestonAwaitingDecision: boolean;
  charlestonCourtesy: boolean;
  players: Player[];
  wall: Tile[];
  discards: Tile[];
  callWindow: CallWindow | null;
  events: GameEvent[];
  winnerId: string | null;
}

export interface HandDefinition {
  id: string;
  section: string;
  name: string;
  description: string;
  exposure: 'exposed' | 'concealed';
  groups: HandGroup[];
  teachingPoint: string;
}

export interface HandGroup {
  id: string;
  tileKey: string;
  kind: HandGroupKind;
  count: number;
  jokerAllowed: boolean;
}

export interface HandCandidate {
  handId: string;
  name: string;
  completionDistance: number;
  matchingTileIds: string[];
  recommendationScore: number;
  reasonCodes: string[];
  viable: boolean;
}

export interface ValidationResult { valid: boolean; handId?: string; message: string }

export interface HandDefinitionProvider {
  id: string;
  name: string;
  version: string;
  getSections(): string[];
  getHands(): HandDefinition[];
  validateMahjong(tiles: Tile[], exposures?: Exposure[]): ValidationResult;
  analyzeCandidates(tiles: Tile[], exposures?: Exposure[]): HandCandidate[];
}

export interface GameRuleViolation { code: string; message: string }
export type GameActionResult = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; violation: GameRuleViolation };
