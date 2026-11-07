'use client';

import { useEffect, useState } from 'react';
import type { GameEvent, Tile } from '../game/types';

export type PassDirection = 'right' | 'across' | 'left';
export function passDirection(index: number, courtesy = false): PassDirection {
  return courtesy ? 'across' : (['right', 'across', 'left', 'left', 'across', 'right'] as const)[index] ?? 'across';
}
interface Source { id: string; sequence: number; events: GameEvent[]; rack: Tile[] }
export interface RackArrival { id: number; tileIds: string[]; direction: PassDirection }

export function charlestonArrival(source: Source, after: number, previousIds: string[]): RackArrival | null {
  const event = [...source.events].reverse().find(event => event.sequence > after
    && (event.type === 'CHARLESTON_PASS_COMPLETED' || event.type === 'COURTESY_PASS_COMPLETED'));
  if (!event || (event.type !== 'CHARLESTON_PASS_COMPLETED' && event.type !== 'COURTESY_PASS_COMPLETED')) return null;
  const tileIds = source.rack.filter(tile => !previousIds.includes(tile.id)).map(tile => tile.id);
  return tileIds.length ? { id: event.sequence, tileIds, direction: event.type === 'CHARLESTON_PASS_COMPLETED' ? event.direction : 'across' } : null;
}

/** Compare only the viewer's rack, after an authoritative pass-resolution event. */
export function useCharlestonArrival(source: Source | null) {
  const [tracked, setTracked] = useState<{ id: string; sequence: number; rackIds: string[]; arrival: RackArrival | null } | null>(null);
  if (!source && tracked) setTracked(null);
  else if (source && (!tracked || source.id !== tracked.id)) {
    setTracked({ id: source.id, sequence: source.sequence, rackIds: source.rack.map(tile => tile.id), arrival: null });
  } else if (source && tracked && source.sequence > tracked.sequence) {
    setTracked({ id: source.id, sequence: source.sequence, rackIds: source.rack.map(tile => tile.id), arrival: charlestonArrival(source, tracked.sequence, tracked.rackIds) ?? tracked.arrival });
  }
  const arrival = tracked?.arrival ?? null;
  useEffect(() => {
    if (!arrival) return;
    const timer = window.setTimeout(() => setTracked(current => current?.arrival === arrival ? { ...current, arrival: null } : current), 1800);
    return () => window.clearTimeout(timer);
  }, [arrival]);
  return arrival;
}
