'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { GameEvent, Tile } from '../game/types';
import { useAccessibility } from '../accessibility/provider';
import { TileFace } from './tile-face';

export interface CelebrationSource {
  id: string;
  sequence: number;
  events: GameEvent[];
  viewerId: string;
  rack: Tile[];
  players: { id: string; name: string }[];
}
export interface Celebration {
  id: number;
  kind: 'mahjong' | 'call' | 'joker';
  title: string;
  detail: string;
}

/** Only public awards and the viewer's own newly drawn tile can trigger a reward. */
export function celebrationFor(source: CelebrationSource, after: number): Celebration | null {
  const fresh = source.events.filter(event => event.sequence > after);
  const win = fresh.find(event => event.type === 'MAHJONG_DECLARED');
  const call = [...fresh].reverse().find(event => event.type === 'EXPOSURE_CREATED');
  const joker = fresh.find(event => event.type === 'TILE_DRAWN' && event.playerId === source.viewerId
    && source.rack.some(tile => tile.id === event.tileId && tile.type.kind === 'joker'));
  const event = win ?? call ?? joker;
  if (!event || !('playerId' in event)) return null;
  const own = event.playerId === source.viewerId;
  const name = source.players.find(player => player.id === event.playerId)?.name ?? 'A player';
  if (event.type === 'MAHJONG_DECLARED') return { id: event.sequence, kind: 'mahjong', title: 'Mahjong!', detail: own ? 'Beautifully played. This one is yours.' : `${name} takes the hand. What a finish!` };
  if (event.type === 'EXPOSURE_CREATED') return { id: event.sequence, kind: 'call', title: `${event.kind}!`, detail: own ? 'Your set is on the table.' : `${name} makes a call.` };
  return { id: event.sequence, kind: 'joker', title: 'Hello, Joker!', detail: 'A little wild luck. Make it count.' };
}

export function useCelebration(source: CelebrationSource | null) {
  const [tracked, setTracked] = useState<{ id: string; sequence: number; celebration: Celebration | null } | null>(null);
  // Adjust only when the confirmed event cursor changes, before rendering children.
  if (!source && tracked) setTracked(null);
  else if (source && (!tracked || tracked.id !== source.id)) {
    setTracked({ id: source.id, sequence: source.sequence, celebration: null });
  } else if (source && tracked && source.sequence > tracked.sequence) {
    const next = celebrationFor(source, tracked.sequence);
    setTracked({ id: source.id, sequence: source.sequence, celebration: tracked.celebration?.kind === 'mahjong' && next?.kind !== 'mahjong' ? tracked.celebration : next ?? tracked.celebration });
  }
  const celebration = tracked?.celebration ?? null;
  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(() => setTracked(current => current?.celebration === celebration ? { ...current, celebration: null } : current), celebration.kind === 'mahjong' ? 5600 : 2800);
    return () => window.clearTimeout(timer);
  }, [celebration]);
  return celebration;
}

export function CelebrationLayer({ celebration }: { celebration: Celebration | null }) {
  const { reducedMotion } = useAccessibility();
  if (!celebration) return null;
  const big = celebration.kind === 'mahjong';
  return createPortal(<div key={`${celebration.kind}:${celebration.id}`} className={`celebration celebration-${celebration.kind}${reducedMotion ? ' celebration-still' : ''}`}>
    {!reducedMotion ? <div className="celebration-effects" aria-hidden="true">
      {Array.from({ length: big ? 7 : 2 }, (_, burst) => <div className="firework" key={burst} style={{ left: `${[16,82,48,8,92,32,70][burst]}%`, top: `${[24,19,12,55,52,72,70][burst]}%`, '--burst-delay': `${burst * 350}ms` } as CSSProperties}>
        {Array.from({ length: 16 }, (_, ray) => <i key={ray} style={{ '--ray-x': `${Math.cos(ray * Math.PI / 8) * (big ? 130 : 65)}px`, '--ray-y': `${Math.sin(ray * Math.PI / 8) * (big ? 130 : 65)}px`, '--ray-color': ['#f5d580','#f49a83','#a7d7b8','#fff5d7'][ray % 4] } as CSSProperties} />)}
      </div>)}
      {big ? Array.from({ length: 32 }, (_, i) => <b className="celebration-confetti" key={i} style={{ left: `${i * 3.2}%`, '--fall-delay': `${(i % 8) * 160}ms`, '--confetti-color': ['#f5d580','#f49a83','#a7d7b8'][i % 3], '--drift': `${(i % 2 ? 1 : -1) * 65}px` } as CSSProperties} />) : null}
    </div> : null}
    <div className="celebration-card" role="status" aria-live="polite" aria-atomic="true">
      <div className="celebration-emblem" aria-hidden="true">{celebration.kind === 'joker' ? <TileFace tile={{ id: 'celebration-joker', type: { kind: 'joker' } }} /> : big ? '發' : '✦'}</div>
      <p className="celebration-eyebrow">{big ? 'A hand to remember' : celebration.kind === 'joker' ? 'Lucky draw' : 'Nicely called'}</p>
      <h2>{celebration.title}</h2><p>{celebration.detail}</p>
      <span className="celebration-stars" aria-hidden="true">✦ ✧ ✦</span>
    </div>
  </div>, document.body);
}
