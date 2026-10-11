'use client';
import type { HandCandidate } from '../game/types';
import { useState } from 'react';
import { patternTokens, referenceHands, referenceSections } from '../game/reference-card';

export function ReferenceHands({ printable = false, candidates = [] }: { printable?: boolean; candidates?: HandCandidate[] }) {
  const [section, setSection] = useState('All hands');
  const [search, setSearch] = useState('');
  const visible = referenceHands.filter(hand => (section === 'All hands' || section === hand.section) && `${hand.section} ${hand.note} ${hand.patterns.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="reference-card">
    <div className="card-browser-controls"><label><span>Find a hand</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Try dragons, pairs, 2025…" /></label><label><span>Section</span><select value={section} onChange={e => setSection(e.target.value)}>{['All hands', ...referenceSections].map(s => <option key={s}>{s}</option>)}</select></label>{printable ? <button type="button" onClick={() => window.print()}>Print card ↗</button> : <a className="card-print-link" href="/cards" target="_blank" rel="noreferrer">Full card / Print ↗</a>}</div>
    <div className="card-key"><span><b className="card-ink-jade">Green</b>, <b className="card-ink-red">red</b> & <b>black</b> = different suits</span><span><b>0</b> White Dragon · any suit</span><span><b>X</b> Exposed · <b>C</b> Concealed</span><span>F Flowers · D Dragons · N/E/W/S Winds</span></div>
    <p className="card-results" role="status">{visible.length} of {referenceHands.length} hands</p>
    <div className="reference-sections">{referenceSections.map(name => {
      const rows = visible.filter(hand => hand.section === name);
      return rows.length ? <section key={name}><h3>{name === '369' ? '3 · 6 · 9' : name}<span>{rows.length} {rows.length === 1 ? 'hand' : 'hands'}</span></h3>{rows.map(hand => <article className={`reference-hand ${candidates[0]?.handId.startsWith(`${hand.id}:`) ? 'leading' : ''}`} aria-label={`${name}, hand ${referenceHands.filter(h => h.section === name).indexOf(hand) + 1}`} key={hand.id}>
        <div className="reference-patterns"><span className="reference-line-number">Hand {referenceHands.filter(h => h.section === name).indexOf(hand) + 1}{candidates.find(c => c.handId.startsWith(`${hand.id}:`)) ? ` · ${candidates.find(c => c.handId.startsWith(`${hand.id}:`))!.matchingTileIds.length}/14 tiles` : ''}</span>{hand.patterns.map((pattern,i) => <div key={pattern}>{i ? <small>or</small> : null}{patternTokens(pattern).map((token,j) => <strong key={j} className={`card-ink-${token.ink}`}>{token.text}</strong>)}</div>)}<p>{hand.note || 'Follow the printed groups.'}</p></div>
        <div className={`reference-value ${hand.exposure === 'C' ? 'concealed' : ''}`}><b>{hand.value}</b><span>{hand.exposure === 'C' ? 'Concealed' : 'Exposed'}</span></div>
      </article>)}</section> : null;
    })}</div>
    {!visible.length ? <p className="card-empty">No hands match. Try another search or section.</p> : null}
    <p className="card-source-note">Transcribed from your 2025 card · White Dragon represents zero. Printed colors indicate relative suits; they can be assigned to Bams, Craks or Dots.</p>
  </div>;
}
