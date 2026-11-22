'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { tableAttemptKey } from '../../../src/game/weekly-table-stars';
import { validTableAttempts, type TableAttempts } from '../../../src/persistence/table-attempts';

const endpoint = '/api/puzzles/table-reading';
const pendingKey = (id: string) => `mahjong-room-pending-table-attempts-v1:${id}`;

function guestAttempts(today: string) {
  const attempts: TableAttempts = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(tableAttemptKey(''))) continue;
    const date = key.slice(tableAttemptKey('').length);
    const answer = localStorage.getItem(key);
    if (validTableAttempts({ [date]: answer }, today)) attempts[date] = answer!;
  }
  return attempts;
}

export function useTableAttempts(today?: string) {
  const [attempts, setAttempts] = useState<TableAttempts>({});
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');
  const account = useRef<string | null>(null);
  const pending = useRef<TableAttempts>({});
  const queue = useRef(Promise.resolve());
  const active = useRef(true);

  const sync = useCallback(async () => {
    if (!today) return;
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!active.current) return;
      if (response.status === 401) {
        account.current = null;
        pending.current = {};
        let guest: TableAttempts = {};
        try { guest = guestAttempts(today); } catch { /* Guest play can continue in memory. */ }
        setAttempts(guest);
        setStatus('Saved on this device');
        setReady(true);
        return;
      }
      if (!response.ok) throw new Error('Read failed');
      const data = await response.json() as { userId: string; attempts: TableAttempts };
      if (!active.current) return;
      if (account.current !== data.userId) pending.current = {};
      account.current = data.userId;
      let guest: TableAttempts = {};
      try {
        guest = guestAttempts(today);
        const stored = JSON.parse(localStorage.getItem(pendingKey(data.userId)) ?? '{}');
        if (validTableAttempts(stored, today)) pending.current = { ...stored, ...pending.current };
      } catch { /* Use the current visit's pending answers. */ }
      const upload = { ...guest, ...pending.current };
      // Account records win when the same day was already played on another device.
      const unsaved = Object.fromEntries(Object.entries(upload).filter(([date]) => !data.attempts[date]));
      if (Object.keys(unsaved).length) {
        const saved = await fetch(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: data.userId, attempts: unsaved }),
        });
        if (!saved.ok) throw new Error('Save failed');
        const result = await saved.json() as { attempts: TableAttempts };
        data.attempts = result.attempts;
      }
      if (!active.current) return;
      setAttempts(data.attempts);
      pending.current = Object.fromEntries(Object.entries(pending.current).filter(([date]) => !data.attempts[date]));
      try {
        const cached = JSON.parse(localStorage.getItem(pendingKey(data.userId)) ?? '{}');
        if (validTableAttempts(cached, today)) {
          pending.current = { ...cached, ...pending.current };
          pending.current = Object.fromEntries(Object.entries(pending.current).filter(([date]) => !data.attempts[date]));
        }
        if (Object.keys(pending.current).length) {
          localStorage.setItem(pendingKey(data.userId), JSON.stringify(pending.current));
        } else {
          localStorage.removeItem(pendingKey(data.userId));
        }
        for (const date of Object.keys(guest)) localStorage.removeItem(tableAttemptKey(date));
      } catch { /* The account save succeeded. */ }
      setStatus('Saved to your account');
      setReady(true);
    } catch {
      if (active.current) setStatus('Couldn’t sync. Your answers will retry when you reconnect.');
    }
  }, [today]);

  const retry = useCallback(() => {
    queue.current = queue.current.then(sync);
  }, [sync]);

  useEffect(() => {
    active.current = true;
    queueMicrotask(retry);
    window.addEventListener('online', retry);
    window.addEventListener('focus', retry);
    return () => { active.current = false; window.removeEventListener('online', retry); window.removeEventListener('focus', retry); };
  }, [retry]);

  const save = (date: string, tileId: string) => {
    if (attempts[date]) return;
    setAttempts(current => ({ ...current, [date]: tileId }));
    if (!account.current) {
      try { localStorage.setItem(tableAttemptKey(date), tileId); } catch { /* Keep this visit playable. */ }
      return;
    }
    pending.current[date] ??= tileId;
    try {
      const cached = JSON.parse(localStorage.getItem(pendingKey(account.current)) ?? '{}');
      if (today && validTableAttempts(cached, today)) pending.current = { ...cached, ...pending.current };
      localStorage.setItem(pendingKey(account.current), JSON.stringify(pending.current));
    } catch { /* Retry in memory. */ }
    setStatus('Saving to your account…');
    retry();
  };
  const read = useCallback((key: string) => attempts[key.slice(tableAttemptKey('').length)] ?? null, [attempts]);
  return { attempts, ready, status, save, read, retry };
}
