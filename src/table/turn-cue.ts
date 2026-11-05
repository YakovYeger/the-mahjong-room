'use client';
import { useEffect, useState } from 'react';

/** One cue per actionable turn; drawing, sorting and polling cannot retrigger it. */
export function useTurnCue(source: { id: string; turn: number | null } | null) {
  const [tracked, setTracked] = useState<{ id: string; turn: number | null; cue: number | null } | null>(null);
  if (!source && tracked) setTracked(null);
  else if (source && (!tracked || source.id !== tracked.id)) setTracked({ ...source, cue: null });
  else if (source && tracked && source.turn !== tracked.turn) setTracked({ ...source, cue: source.turn });
  const cue = tracked?.cue ?? null;
  useEffect(() => {
    if (cue === null) return;
    const timer = window.setTimeout(() => setTracked(current => current?.cue === cue ? { ...current, cue: null } : current), 1300);
    return () => window.clearTimeout(timer);
  }, [cue]);
  return cue;
}
