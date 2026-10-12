'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { getCardProvider, type CardId } from '../game/cards';
import { arrangeHand, cardTileKey } from '../game/training-card';
import { createWall, tileLabel } from '../game/tiles';
import type { Exposure, HandCandidate, HandDefinition, Tile } from '../game/types';
import { ReferenceHands } from './reference-hands';
import { TrainingHands } from './training-hands';
import { TileFace } from './tile-face';

const samples = new Map(createWall().map(tile => [cardTileKey(tile), tile]));
const handMaps = {
  'training-card': new Map(getCardProvider('training-card').getHands().map(hand => [hand.id, hand])),
  'photo-2025': new Map(getCardProvider('photo-2025').getHands().map(hand => [hand.id, hand])),
};
const preferenceKey = (storageKey: string, cardId: CardId) => `mahjong:follow:v1:${cardId}:${storageKey}`;

const memoryPreferences = new Map<string, string | null>();
const subscribePreferences = (notify: () => void) => {
  window.addEventListener('storage', notify);
  window.addEventListener('mahjong-follow-changed', notify);
  return () => { window.removeEventListener('storage', notify); window.removeEventListener('mahjong-follow-changed', notify); };
};
function useFollowedHand(storageKey: string, cardId: CardId) {
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

function keyLabel(key: string) {
  const sample = samples.get(key);
  return sample ? tileLabel(sample) : key;
}

function HandComparison({ hand, rack, exposures, final = false }: { hand: HandDefinition; rack: Tile[]; exposures: Exposure[]; final?: boolean }) {
  const tiles = [...rack, ...exposures.flatMap(exposure => exposure.tiles)];
  const layout = arrangeHand(tiles, exposures, hand);
  const valid = layout.viable && layout.matchingTileIds.length === 14 && tiles.length === 14;
  const missing = layout.groups.flatMap(group => {
    const count = group.slots.filter(tile => !tile).length;
    return count ? [`${count} ${keyLabel(group.required.tileKey)}`] : [];
  });
  return <div className={`hand-comparison ${valid ? 'hand-valid' : ''}`}>
    <div className="hand-comparison-status" role="status"><strong>{valid ? `✓ Valid hand${hand.value ? ` · ${hand.value} points` : ''}` : !layout.viable ? 'Exposed sets conflict with this hand' : `${layout.matchingTileIds.length} of 14 tiles matched`}</strong><span>{hand.exposure === 'concealed' ? 'Concealed' : 'Exposed'} · Singles & pairs stay natural</span></div>
    <div className="hand-alignment" aria-label="Card pattern above, your tiles below">{layout.groups.map(group => <div className={`alignment-group ${group.exposed ? 'alignment-exposed' : ''}`} key={group.required.id}>
      <div className="alignment-pattern" aria-label={`${group.required.count} ${keyLabel(group.required.tileKey)}, ${group.required.kind}`}>
        {group.slots.map((_, index) => <span className="comparison-tile pattern-tile" key={index}><TileFace tile={samples.get(group.required.tileKey)!} compact /></span>)}
      </div>
      <div className="alignment-actual">{group.slots.map((tile, index) => <span className={`comparison-tile ${tile ? 'matched-tile' : 'missing-tile'}`} key={index} title={tile ? `${tileLabel(tile)}${group.exposed ? ' · Exposed' : ''}${tile.type.kind === 'joker' ? ` · stands for ${keyLabel(group.required.tileKey)}` : ''}` : `Missing ${keyLabel(group.required.tileKey)}`} aria-label={tile ? `${tileLabel(tile)}${tile.type.kind === 'joker' ? `, stands for ${keyLabel(group.required.tileKey)}` : ''}${group.exposed ? ', exposed' : ''}` : `Missing ${keyLabel(group.required.tileKey)}`}>
        {tile ? <TileFace tile={tile} compact /> : <span aria-hidden="true">·</span>}
      </span>)}</div>
      <small>{group.exposed ? 'Exposed' : group.required.kind}{group.required.jokerAllowed ? ' · ★' : ''}</small>
    </div>)}</div>
    {layout.extras.length ? <details className="alignment-extras" open={final}><summary>{layout.extras.length} {final ? 'unmatched tiles' : 'tiles outside this pattern'}</summary><small>{final ? 'Unmatched tiles' : 'Outside this pattern'}</small><div>{layout.extras.map(tile => <span className="comparison-tile" title={tileLabel(tile)} key={tile.id}><TileFace tile={tile} compact /></span>)}</div></details> : null}
    {!layout.viable ? <p className="alignment-explanation">{hand.exposure === 'concealed' && exposures.length ? 'This hand must stay concealed; it cannot include exposed sets.' : 'An exposed set has a different tile, size, or group type from this pattern. Choose another hand.'}</p> : missing.length ? <p className="alignment-explanation">Missing: {missing.join(' · ')}.{layout.extras.some(tile => tile.type.kind === 'joker') ? ' Unmatched Jokers cannot fill singles or pairs.' : ''}</p> : !valid ? <p className="alignment-explanation">A complete hand has exactly 14 tiles. Remove the unmatched tiles to fit this pattern.</p> : null}
    <p className="alignment-key">Top: card pattern · Bottom: your tiles · Outline: missing · ★: Jokers allowed</p>
  </div>;
}

export function CardCompanion({ cardId = 'training-card', rack, exposures, storageKey, onArrange, open, onOpenChange, candidates: supplied }: { cardId?: CardId; rack: Tile[]; exposures: Exposure[]; storageKey: string; onArrange: (ids: string[]) => void; open: boolean; onOpenChange: (open: boolean) => void; candidates?: HandCandidate[] }) {
  const candidates = useMemo(() => supplied ?? getCardProvider(cardId).analyzeCandidates([...rack, ...exposures.flatMap(exposure => exposure.tiles)], exposures), [supplied, cardId, rack, exposures]);
  const [followedId, follow] = useFollowedHand(storageKey, cardId);
  const hand = followedId ? handMaps[cardId].get(followedId) : undefined;
  const closest = candidates.filter(candidate => candidate.viable).slice(0, 3);
  const id = useId();
  const panelRef = useRef<HTMLElement>(null);
  const optionsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const escape = (event: KeyboardEvent) => {
      // Base UI portals its listbox outside the drawer. Let it handle keys first.
      if (event.defaultPrevented || document.querySelector('[data-slot="select-content"]')) return;
      if (event.key === 'Escape') onOpenChange(false);
      if (event.key !== 'Tab') return;
      const controls = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, summary') ?? []);
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panelRef.current)) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('keydown', escape); if (trigger?.isConnected) trigger.focus(); };
  }, [open, onOpenChange]);
  const pick = (handId: string) => { follow(handId); onOpenChange(false); if (optionsRef.current) optionsRef.current.open = false; };
  const arrange = () => {
    if (!hand) return;
    const layout = arrangeHand([...rack, ...exposures.flatMap(exposure => exposure.tiles)], exposures, hand);
    const rackIds = new Set(rack.map(tile => tile.id));
    onArrange([...layout.matchingTileIds, ...layout.extras.map(tile => tile.id)].filter(tileId => rackIds.has(tileId)));
  };
  const followedLayout = hand ? arrangeHand([...rack, ...exposures.flatMap(exposure => exposure.tiles)], exposures, hand) : undefined;
  const suggestions = closest.length ? <div className="companion-suggestions" aria-label="Closest hands"><span>Closest hands</span>{closest.map(candidate => <button aria-pressed={followedId === candidate.handId} key={candidate.handId} onClick={() => pick(candidate.handId)}>{candidate.name}<b>{candidate.matchingTileIds.length}/14</b></button>)}</div> : <p>No hand fits the current exposed sets.</p>;
  return <section className="card-companion" aria-label="Your card companion">
    <div className="companion-heading"><div><p className="kicker">{hand ? 'Following this hand' : 'Find your direction'}</p><h3>{hand?.name ?? 'Your rack, meet your card.'}</h3></div>{hand ? <div className="companion-actions"><button onClick={arrange} aria-label="Arrange rack by this hand">Arrange rack</button><details className="companion-options" ref={optionsRef}><summary>Options</summary><button onClick={() => { const fit = candidates.find(candidate => candidate.name === hand.name); if (fit) follow(fit.handId); }}>Update suit / number fit</button><button onClick={() => follow(null)}>Unpin</button><p className="alignment-key">Top: card pattern · Bottom: your tiles · Outline: missing · ★: Jokers allowed. Singles and pairs stay natural.</p></details></div> : null}<button className="companion-browse" aria-expanded={open} aria-controls={id} onClick={() => onOpenChange(!open)}>{open ? 'Close card' : hand ? 'Change hand' : 'Browse card'} ↗</button></div>
    {hand ? <><div className="companion-pattern" aria-label="Followed card pattern">{hand.groups.map(group => <div key={group.id} aria-label={`${group.count} ${keyLabel(group.tileKey)}, ${group.kind}`}>{Array.from({ length: group.count }, (_, index) => <span className="comparison-tile pattern-tile" key={index}><TileFace tile={samples.get(group.tileKey)!} compact /></span>)}</div>)}</div><details className="companion-fit"><summary>{followedLayout?.matchingTileIds.length}/14 tiles fit · Check fit</summary><HandComparison hand={hand} rack={rack} exposures={exposures} /></details></> : <p className="companion-intro">Pin a pattern to see what fits and what is missing. Your rack stays yours to arrange.</p>}
    {suggestions}
    {open ? <><div className="companion-backdrop" aria-hidden="true" onClick={() => onOpenChange(false)} /><aside role="dialog" aria-modal="true" className="companion-drawer" id={id} ref={panelRef} tabIndex={-1} aria-label="Choose a hand to follow"><header><div><p className="kicker">Choose your direction</p><h2>{cardId === 'photo-2025' ? 'Your 2025 Card' : 'Training Card'}</h2><p>Tap a hand to pin its closest suit and number arrangement.</p><div className="companion-card-legend"><span><b>C</b> Concealed</span><span><b>X</b> Exposed</span><span><b>★</b> Jokers allowed</span></div></div><button aria-label="Close card browser" onClick={() => onOpenChange(false)}>×</button></header>{cardId === 'photo-2025' ? <ReferenceHands candidates={candidates} onFollow={pick} /> : <TrainingHands candidates={candidates} onFollow={pick} />}</aside></> : null}
  </section>;
}

export function HandCheck({ cardId = 'training-card', rack, exposures, storageKey }: { cardId?: CardId; rack: Tile[]; exposures: Exposure[]; storageKey: string }) {
  const [preferred] = useFollowedHand(storageKey, cardId);
  const analysis = useMemo(() => {
    const provider = getCardProvider(cardId);
    const tiles = [...rack, ...exposures.flatMap(exposure => exposure.tiles)];
    return { validation: provider.validateMahjong(tiles, exposures), candidates: provider.analyzeCandidates(tiles, exposures) };
  }, [cardId, rack, exposures]);
  const [inspected, setInspected] = useState<string | null>(null);
  const handId = inspected ?? analysis.validation.handId ?? (preferred && handMaps[cardId].has(preferred) ? preferred : analysis.candidates.find(candidate => candidate.viable)?.handId);
  const hand = handId ? handMaps[cardId].get(handId) : undefined;
  return <section className="final-hand-check" aria-label="Final hand check"><div className="final-check-heading"><p className="kicker">Automatically arranged · Hand check</p><h3>{hand?.name ?? 'No compatible hand'}</h3><p>{analysis.validation.valid ? 'This rack matches a legal hand on the selected card.' : preferred === handId ? 'Your followed pattern, compared with the final tiles.' : 'Closest pattern, compared with the final tiles.'}</p></div>{hand ? <HandComparison hand={hand} rack={rack} exposures={exposures} final /> : <><p>The exposed sets do not fit any hand on this card.</p><div className="hand-alignment">{[{ id: 'rack', label: 'Concealed tiles', tiles: rack }, ...exposures.map(exposure => ({ id: exposure.id, label: `Exposed ${exposure.kind}`, tiles: exposure.tiles }))].map(group => <div className="alignment-group" key={group.id}><small>{group.label}</small><div className="alignment-actual">{group.tiles.map(tile => <span className="comparison-tile" title={tileLabel(tile)} key={tile.id}><TileFace tile={tile} compact /></span>)}</div></div>)}</div></>}
    {!analysis.validation.valid ? <div className="companion-suggestions"><span>Compare another hand</span>{analysis.candidates.filter(candidate => candidate.viable).slice(0, 3).map(candidate => <button key={candidate.handId} aria-pressed={handId === candidate.handId} onClick={() => setInspected(candidate.handId)}>{candidate.name}<b>{candidate.matchingTileIds.length}/14</b></button>)}</div> : null}
  </section>;
}
