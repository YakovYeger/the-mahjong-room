import type { GameState, Tile } from '../game/types';
import type { GuestGameSession } from './types';

export const GUEST_GAME_SESSION_KEY = 'mahjong-room-game-session-v1';

function validTile(value: unknown): value is Tile {
  if (!value || typeof value !== 'object') return false;
  const tile = value as Record<string, unknown>;
  if (typeof tile.id !== 'string' || !tile.type || typeof tile.type !== 'object') return false;
  const kind = (tile.type as Record<string, unknown>).kind;
  return ['number', 'wind', 'dragon', 'flower', 'joker'].includes(String(kind));
}

function validGameState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const game = value as Record<string, unknown>;
  if (typeof game.id !== 'string' || !['charleston', 'playing', 'completed'].includes(String(game.phase))) return false;
  if (typeof game.stateVersion !== 'number' || typeof game.turnIndex !== 'number' || typeof game.turnCount !== 'number') return false;
  if (!Array.isArray(game.wall) || !game.wall.every(validTile) || !Array.isArray(game.discards) || !game.discards.every(validTile)) return false;
  if (!Array.isArray(game.events) || !Array.isArray(game.players) || game.players.length !== 4) return false;
  return game.players.every((value) => {
    if (!value || typeof value !== 'object') return false;
    const player = value as Record<string, unknown>;
    return typeof player.id === 'string' && typeof player.name === 'string' && Array.isArray(player.rack)
      && player.rack.every(validTile) && Array.isArray(player.exposures);
  });
}

export function parseGuestGameSession(value: unknown): GuestGameSession | null {
  if (!value || typeof value !== 'object') return null;
  const session = value as Record<string, unknown>;
  if (session.version !== 1 || typeof session.gameNumber !== 'number' || session.gameNumber < 1) return null;
  if (!validGameState(session.game) || !Array.isArray(session.rackOrder) || !session.rackOrder.every((id) => typeof id === 'string')) return null;
  if (typeof session.manualTurns !== 'number' || session.manualTurns < 0 || typeof session.hintsRequested !== 'number' || session.hintsRequested < 0) return null;
  if (typeof session.hintLevel !== 'number' || session.hintLevel < 0 || session.hintLevel > 2 || typeof session.review !== 'boolean') return null;
  if (typeof session.savedAt !== 'string' || Number.isNaN(Date.parse(session.savedAt))) return null;
  return session as unknown as GuestGameSession;
}

export function loadGuestGameSession(storage: Pick<Storage, 'getItem'>): GuestGameSession | null {
  try {
    const raw = storage.getItem(GUEST_GAME_SESSION_KEY);
    return raw ? parseGuestGameSession(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveGuestGameSession(storage: Pick<Storage, 'setItem'>, session: Omit<GuestGameSession, 'version' | 'savedAt'>): GuestGameSession {
  const record: GuestGameSession = { ...session, version: 1, savedAt: new Date().toISOString() };
  storage.setItem(GUEST_GAME_SESSION_KEY, JSON.stringify(record));
  return record;
}

export function clearGuestGameSession(storage: Pick<Storage, 'removeItem'>): void {
  storage.removeItem(GUEST_GAME_SESSION_KEY);
}
