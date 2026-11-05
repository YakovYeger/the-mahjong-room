'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { GameAction, Tile } from '../game/types';
import { useAccessibility } from '../accessibility/provider';
import type { PassDirection } from './charleston-motion';
import { TileFace } from './tile-face';

export type MoveKind = 'pass' | 'draw' | 'discard' | 'call' | 'exchange' | 'arrange';
const labels: Record<MoveKind, string> = {
  pass: 'Tiles passed', draw: 'Fresh tile', discard: 'Tile placed',
  call: 'Call sent', exchange: 'Joker exchanged', arrange: 'All in place',
};
export function moveCue(action: GameAction, rack: Tile[]): { kind: MoveKind; tiles: Tile[] } | null {
  switch (action.type) {
    case 'PASS_TILES': case 'COURTESY_PASS':
      return action.tileIds.length ? { kind: 'pass', tiles: rack.filter(tile => action.tileIds.includes(tile.id)) } : null;
    case 'DISCARD_TILE': return { kind: 'discard', tiles: rack.filter(tile => tile.id === action.tileId) };
    case 'DRAW_TILE': return { kind: 'draw', tiles: [] };
    case 'CALL_TILE': return { kind: 'call', tiles: [] };
    case 'EXCHANGE_JOKER': return { kind: 'exchange', tiles: [] };
    default: return null;
  }
}

interface Flight { tile: Tile; x: number; y: number; dx: number; dy: number; width: number }
interface MoveReceipt { kind: MoveKind; flights: Flight[] }
interface Feedback extends MoveReceipt { id: number }

/** Capture geometry before a confirmed move replaces the rack. No rules or timers are delayed. */
export function captureMove(kind: MoveKind, tiles: Tile[] = [], direction: PassDirection = 'across'): MoveReceipt {
  const destination = kind === 'pass'
    ? document.querySelector(`.table-seat-${direction === 'across' ? 'top' : direction}`) ?? document.querySelector('.table-surface')
    : document.querySelector('.table-latest-tile') ?? document.querySelector('.table-discards');
  const target = destination?.getBoundingClientRect();
  const slots = Array.from(document.querySelectorAll<HTMLElement>('[data-sortable-id]'));
  const flights = target ? tiles.slice(0, 3).flatMap((tile, index) => {
    const slot = slots.find(element => element.dataset.sortableId === tile.id);
    const rect = slot?.querySelector('button')?.getBoundingClientRect();
    if (!rect) return [];
    return [{ tile, x: rect.x, y: rect.y, width: rect.width,
      dx: target.x + target.width / 2 - rect.x - rect.width / 2 + (index - (tiles.length - 1) / 2) * 20,
      dy: target.y + target.height / 2 - rect.y - rect.height / 2 }];
  }) : [];
  return { kind, flights };
}

export function useMoveFeedback() {
  const { reducedMotion } = useAccessibility();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const serial = useRef(0);
  const play = useCallback((receipt: MoveReceipt | null) => {
    if (!receipt || reducedMotion) return;
    setFeedback({ ...receipt, id: ++serial.current });
  }, [reducedMotion]);
  const celebrate = useCallback((kind: MoveKind, tiles: Tile[] = [], direction?: PassDirection) => {
    if (!reducedMotion) play(captureMove(kind, tiles, direction));
  }, [play, reducedMotion]);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 1200);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  return { feedback, play, celebrate };
}

export function MoveFeedback({ feedback }: { feedback: Feedback | null }) {
  const { reducedMotion } = useAccessibility();
  if (!feedback || reducedMotion) return null;
  return <>
    <div key={feedback.id} className={`move-feedback move-feedback-${feedback.kind}`} aria-hidden="true">
      <div className="move-feedback-wash" />
      <span className="move-reward"><span>✦</span>{labels[feedback.kind]}</span>
      <span className="move-sparkles">{Array.from({ length: 6 }, (_, i) => <i key={i} style={{ '--spark-x': `${(i - 2.5) * 25}px`, '--spark-y': `${-20 - (i % 3) * 13}px`, '--spark-delay': `${i * 25}ms` } as CSSProperties} />)}</span>
    </div>
    {feedback.flights.length ? createPortal(<div className="move-flight-layer" aria-hidden="true" key={feedback.id}>{feedback.flights.map((flight, i) => <span className={`move-flight move-flight-${feedback.kind}`} key={flight.tile.id} style={{ left: flight.x, top: flight.y, width: flight.width, '--flight-x': `${flight.dx}px`, '--flight-y': `${flight.dy}px`, '--flight-turn': `${(i - 1) * 7}deg`, animationDelay: `${i * 35}ms` } as CSSProperties}><TileFace tile={flight.tile} /></span>)}</div>, document.body) : null}
  </>;
}

export function WinCelebration() {
  const { reducedMotion } = useAccessibility();
  if (reducedMotion) return null;
  return <div className="win-flourish" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ '--petal-x': `${Math.cos(i * Math.PI / 8) * (95 + i % 3 * 20)}px`, '--petal-y': `${Math.sin(i * Math.PI / 8) * 90 - 45}px`, '--petal-turn': `${i * 47}deg`, animationDelay: `${i % 4 * 45}ms` } as CSSProperties} />)}</div>;
}
