'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Exposure, Tile } from '../game/types';
import { getCardProvider, type CardId } from '../game/cards';
import { arrangeHand } from '../game/training-card';
import { tileLabel } from '../game/tiles';
import { useAccessibility } from '../accessibility/provider';
import { Button } from '../ui/button';
import { TileFace } from './tile-face';

export function winningGroupLayout(rack: Tile[], exposures: Exposure[], cardId?: CardId) {
  const provider = getCardProvider(cardId);
  const tiles = [...rack, ...exposures.flatMap(set => set.tiles)];
  const validation = provider.validateMahjong(tiles, exposures);
  const hand = validation.valid ? provider.getHands().find(hand => hand.id === validation.handId) : null;
  if (!hand) return null;
  const layout = arrangeHand(tiles, exposures, hand);
  return layout.viable && layout.extras.length === 0 && layout.groups.every(group => group.slots.every(Boolean)) ? { hand, groups: layout.groups } : null;
}

export function WinningHandReveal({ rack, exposures, cardId, waiting = false }: { rack: Tile[]; exposures: Exposure[]; cardId?: CardId; waiting?: boolean }) {
  const layout = useMemo(() => winningGroupLayout(rack, exposures, cardId), [rack, exposures, cardId]);
  const { reducedMotion } = useAccessibility();
  const root = useRef<HTMLElement>(null);
  const played = useRef(false);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (!layout || waiting || reducedMotion || played.current || !root.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { played.current = true; setRun(value => value + 1); observer.disconnect(); }
    }, { threshold: 0.25 });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [layout, waiting, reducedMotion]);
  if (!layout) return null;
  return <section ref={root} className={`winning-reveal${reducedMotion ? ' winning-reveal-still' : ''}`} aria-label="Winning hand, arranged in card order">
    <div className="winning-reveal-heading"><div><p className="kicker">Every tile in its place</p><h3>{layout.hand.name}</h3></div>
      {!reducedMotion ? <Button variant="ghost" className="winning-reveal-replay" disabled={waiting} aria-label="Replay winning hand reveal" onClick={() => setRun(value => value + 1)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" /></svg></Button> : null}
    </div>
    <div key={run} className={`winning-reveal-groups${run && !reducedMotion ? ' winning-reveal-playing' : ''}`}>
      {layout.groups.map((group, index) => <div className="winning-reveal-group" key={group.required.id} style={{ '--group-delay': `${index * 240}ms` } as CSSProperties}>
        <div className="winning-reveal-tiles">{group.slots.map((tile, tileIndex) => tile ? <span className="winning-reveal-tile" key={tile.id} title={tileLabel(tile)} style={{ '--reveal-tile-delay': `${index * 240 + tileIndex * 40}ms` } as CSSProperties}><TileFace tile={tile} compact /></span> : null)}</div>
        <span className="winning-reveal-label">{group.required.kind}{group.exposed ? ' · exposed' : ''}</span>
      </div>)}
    </div>
    <p className="winning-reveal-caption">{layout.hand.section} · A complete hand <span aria-hidden="true">✦</span></p>
  </section>;
}
