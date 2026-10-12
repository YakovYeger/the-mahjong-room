import type { CallWindow, Exposure, HandCandidate, HandDefinition, Tile } from '../game/types';

export type CoachReasonCode =
  | 'NOT_USED_BY_TOP_HANDS'
  | 'LOW_FLEXIBILITY'
  | 'SUPPORTS_TOP_HAND'
  | 'PRESERVES_PAIR'
  | 'CALL_SUPPORTS_TOP_HAND'
  | 'CALL_REDUCES_FLEXIBILITY'
  | 'JOKER_PROTECTED'
  | 'WAIT_FOR_DRAW';

export type CoachDecision = 'charleston-pass' | 'courtesy-pass' | 'charleston-decision' | 'discard' | 'call' | 'draw' | 'wait' | 'completed';

export interface CoachGroup {
  id: string;
  label: string;
  kind: string;
  count: number;
  matched: number;
  missing: number;
  jokerAllowed: boolean;
  exposed: boolean;
  rackTileIds: string[];
  publicTileIds: string[];
  unseenNaturals: number;
  note: string;
}

export interface CoachHandPlan {
  hand: HandDefinition;
  candidate: HandCandidate;
  groups: CoachGroup[];
  blocked: boolean;
  naturalShortage: number;
  summary: string;
}

export interface CoachPlan {
  followedId: string | null;
  target: CoachHandPlan | null;
  alternatives: CoachHandPlan[];
  warning: string | null;
  blockedHandIds: string[];
}

export interface CoachVisibleContext {
  cardId?: string;
  playerId: string;
  rack: Tile[];
  ownExposures: Exposure[];
  visibleExposures: Array<{ playerId: string; exposure: Exposure }>;
  discards: Tile[];
  callWindow: CallWindow | null;
  wallCount: number;
  candidates: HandCandidate[];
  followedHandId?: string | null;
}

export interface CoachRecommendation {
  kind: CoachDecision | 'mahjong';
  tileIds: string[];
  reasonCodes: CoachReasonCode[];
  headline: string;
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
  reasons?: Array<{ title: string; body: string }>;
  tradeoff?: string;
  tileReasons?: Array<{ tileId: string; text: string }>;
}

export interface CoachSession {
  plan: CoachPlan;
  recommendation: CoachRecommendation;
  selectionAssessment?: string;
}

export interface CoachHighlights {
  rack: Record<string, 'keep' | 'suggest' | 'focus'>;
  groupIds: string[];
  publicTileIds: string[];
}

export interface ReviewCard {
  id: string;
  tone: 'strong' | 'interesting' | 'next';
  eyebrow: string;
  title: string;
  body: string;
}

export interface GameReview {
  headline: string;
  summary: string;
  cards: ReviewCard[];
  skills: Array<{ name: string; score: number }>;
  suggestedAssistanceLevel: number;
}
