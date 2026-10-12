'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { CardId } from '../game/cards';

const preferenceKey = (storageKey: string, cardId: CardId) => `mahjong:follow:v1:${cardId}:${storageKey}`;

const memoryPreferences = new Map<string, string | null>();
const subscribePreferences = (notify: () => void) => {
  window.addEventListener('storage', notify);
  window.addEventListener('mahjong-follow-changed', notify);
  return () => { window.removeEventListener('storage', notify); window.removeEventListener('mahjong-follow-changed', notify); };
};
export function useFollowedHand(storageKey: string, cardId: CardId) {
  const key = preferenceKey(storageKey, cardId);
  const read = useCallback(() => {
    if (memoryPreferences.has(key)) return memoryPreferences.get(key) ?? null;
    try { return localStorage.getItem(key); }
    catch { return memoryPreferences.get(key) ?? null; }
  }, [key]);
  const id = useSyncExternalStore(subscribePreferences, read, () => null);
  const follow = (next: string | null) => {
    try {
      if (next) localStorage.setItem(key, next);
      else localStorage.removeItem(key);
      memoryPreferences.delete(key);
    } catch { memoryPreferences.set(key, next); }
    window.dispatchEvent(new Event('mahjong-follow-changed'));
  };
  return [id, follow] as const;
}

