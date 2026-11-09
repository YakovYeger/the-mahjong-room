'use client';
import { Select } from '../ui/select';
import type { HandCandidate } from '../game/types';
import { useState } from 'react';
import { referenceHands, referenceSections } from '../game/reference-card';
import { ReferenceCardLine } from './reference-card-line';

export function ReferenceHands({ printable = false, candidates = [], onFollow }: { printable?: boolean; candidates?: HandCandidate[]; onFollow?: (handId: string) => void }) {
  const [section, setSection] = useState('All hands');
  const [search, setSearch] = useState('');
  const visible = referenceHands.filter(hand => (section === 'All hands' || section === hand.section) && `${hand.section} ${hand.note} ${hand.patterns.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="reference-card">
    <div className="card-browser-controls"><label><span>Find a hand</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Try dragons, pairs, 2025…" /></label><Select label="Section" value={section} onValueChange={setSection} options={['All hands', ...referenceSections].map(value => ({ value, label: value }))} />{printable ? <button type="button" onClick={() => window.print()}>Print card ↗</button> : <a className="card-print-link" href="/cards" target="_blank" rel="noreferrer">Full card / Print ↗</a>}</div>
    {onFollow ? <details className="card-legend"><summary>Symbols & suit colors</summary><div className="card-key"><span><b className="card-ink-jade">○ Green</b>, <b className="card-ink-red">△ red</b> & <b>□ black</b> = different suits</span><span><b>0</b> White Dragon · any suit</span><span><b>X</b> Exposed · <b>C</b> Concealed</span><span>F Flowers · D Dragons · N/E/W/S Winds</span></div></details> : <div className="card-key"><span><b className="card-ink-jade">○ Green</b>, <b className="card-ink-red">△ red</b> & <b>□ black</b> = different suits</span><span><b>0</b> White Dragon · any suit</span><span><b>X</b> Exposed · <b>C</b> Concealed</span><span>F Flowers · D Dragons · N/E/W/S Winds</span></div>}
    <p className="card-results" role="status">{visible.length} of {referenceHands.length} hands</p>
    <div className="reference-sections">{referenceSections.map(name => {
      const rows = visible.filter(hand => hand.section === name);
      return rows.length ? <section key={name}><h3>{name === '369' ? '3 · 6 · 9' : name}<span>{rows.length} {rows.length === 1 ? 'hand' : 'hands'}</span></h3>{rows.map(hand => {
        const candidate = candidates.find(c => c.handId.startsWith(`${hand.id}:`));
        const number = referenceHands.filter(h => h.section === name).indexOf(hand) + 1;
        return <ReferenceCardLine key={hand.id} hand={hand} number={number} leading={candidate === candidates[0] && Boolean(candidate)} fit={candidate?.matchingTileIds.length} actions={onFollow ? <button className="follow-hand-button" onClick={() => { if (candidate) onFollow(candidate.handId); }}>Follow this hand →</button> : null} />;
      })}</section> : null;
    })}</div>
    {!visible.length ? <p className="card-empty">No hands match. Try another search or section.</p> : null}
    <p className="card-source-note">Transcribed from your 2025 card · White Dragon represents zero. Printed colors indicate relative suits; they can be assigned to Bams, Craks or Dots.</p>
  </div>;
}
