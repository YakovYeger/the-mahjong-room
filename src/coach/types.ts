import type { CallWindow, Exposure, HandCandidate, Tile } from '../game/types';

export type CoachReasonCode =
  | 'NOT_USED_BY_TOP_HANDS'
  | 'LOW_FLEXIBILITY'
  | 'SUPPORTS_TOP_HAND'
  | 'PRESERVES_PAIR'
  | 'CALL_SUPPORTS_TOP_HAND'
  | 'CALL_REDUCES_FLEXIBILITY'
  | 'JOKER_PROTECTED'
  | 'WAIT_FOR_DRAW';

export interface CoachVisibleContext {
  playerId: string;
  rack: Tile[];
  ownExposures: Exposure[];
  visibleExposures: Array<{ playerId: string; exposure: Exposure }>;
  discards: Tile[];
  callWindow: CallWindow | null;
  wallCount: number;
  candidates: HandCandidate[];
}

export interface CoachRecommendation {
  kind: 'charleston-pass' | 'discard' | 'call' | 'draw';
  tileIds: string[];
  reasonCodes: CoachReasonCode[];
  headline: string;
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
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
