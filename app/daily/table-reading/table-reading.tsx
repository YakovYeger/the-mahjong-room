/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation avoids the Sites runtime issue. */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { TABLE_LEVELS, tableReadingChoices, tableReadingPuzzle, type TableLevel } from '../../../src/game/table-reading-puzzles';
import { cardTileKey } from '../../../src/game/training-card';
import { referenceHands } from '../../../src/game/reference-card';
import { tileLabel } from '../../../src/game/tiles';
import type { Tile } from '../../../src/game/types';
import { ReferenceCardLine } from '../../../src/table/reference-card-line';
import { PlayerPortrait } from '../../../src/table/table-art';
import { TileFace } from '../../../src/table/tile-face';
import { Button, buttonVariants } from '../../../src/ui/button';
import { PuzzleSolveBurst } from '../solve-burst';

const storageKey = 'mahjong-room-table-reading-stars-v1';
const levelName = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;
const levelHref = (level: TableLevel) => `/daily/table-reading?level=${level}`;

function PublicTile({ tile, highlighted = false }: { tile: Tile; highlighted?: boolean }) {
  return <span className={`table-reading-public-tile${highlighted ? ' table-reading-clue-tile' : ''}`} title={tileLabel(tile)}><TileFace tile={tile} compact /></span>;
}

export function TableReading({ level }: { level: TableLevel }) {
  const puzzle = useMemo(() => tableReadingPuzzle(level), [level]);
  const choices = useMemo(() => tableReadingChoices(puzzle), [puzzle]);
  const minimum = Math.min(...choices.map(choice => choice.score));
  const best = choices.find(choice => choice.score === minimum)!;
  const [stars, setStars] = useState<TableLevel[]>([]);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);
  const [newStar, setNewStar] = useState(false);
  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const earned = TABLE_LEVELS.filter(item => localStorage.getItem(`${storageKey}:${item}`) === '1');
        setStars(earned);
        if (earned.includes(level)) setSubmitted(best.tile.id);
      } catch { /* Play remains available without browser storage. */ }
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [level, best.tile.id]);
  useEffect(() => {
    if (fresh && resultRef.current) {
      resultRef.current.focus({ preventScroll: true });
      resultRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [fresh]);

  const result = choices.find(choice => choice.tile.id === submitted);
  const won = result?.score === minimum;
  const next = [...TABLE_LEVELS.slice(TABLE_LEVELS.indexOf(level) + 1), ...TABLE_LEVELS].find(item => item !== level && !stars.includes(item));
  const submit = () => {
    if (!ready || submitted || !selected) return;
    const choice = choices.find(item => item.tile.id === selected);
    if (!choice) return;
    setSubmitted(choice.tile.id);
    setFresh(true);
    if (choice.score !== minimum || stars.includes(level)) return;
    const earned = [...stars, level];
    setNewStar(true);
    setStars(earned);
    try { localStorage.setItem(`${storageKey}:${level}`, '1'); } catch { /* Optional. */ }
  };
  const retry = () => {
    setSelected(null); setSubmitted(null); setFresh(false); setNewStar(false);
  };

  return <main className="daily-page">
    <header className="daily-top"><a className="brand" href="/">The Mahjong Room</a><nav aria-label="Puzzle navigation"><a href="/daily">Daily Puzzle</a><a href="/daily/archive">Puzzle archive</a></nav></header>
    <div className="daily-layout table-reading-layout">
      <header className="daily-intro">
        <p className="kicker">Table reading · 2025 Card</p>
        <h1>Would you throw it?</h1>
        <p>Read the exposed sets. Pick the discard that helps the fewest possible hands.</p>
      </header>
      <nav className="table-reading-levels" aria-label={`Challenge levels, ${stars.length} of 3 stars earned`}>
        {TABLE_LEVELS.map((item, index) => <a key={item} href={levelHref(item)} aria-current={level === item ? 'page' : undefined}><span>Level {index + 1}</span><strong>{levelName[item]}</strong><span aria-label={stars.includes(item) ? 'Star earned' : 'Star available'}>{stars.includes(item) ? '★' : '☆'}</span></a>)}
      </nav>
      <p className="table-reading-progress" role="status">{stars.length} / 3 stars earned</p>

      <section className="daily-table table-reading-felt" aria-label="Table reading challenge">
        <div className="table-reading-heading"><h2>{puzzle.name}</h2><a href="/cards" target="_blank" rel="noreferrer">2025 Card ↗</a></div>
        <h3>Exposed sets</h3>
        <div className="table-reading-players">{puzzle.players.map(player => <article className={`table-reading-player${result ? ' table-reading-clue' : ''}`} key={player.id}>
          <strong><span className="table-reading-portrait" aria-hidden="true"><PlayerPortrait seat={player.seat} /></span>{player.name}</strong>
          <div className="table-reading-sets">{player.exposures.map(set => <div className="table-reading-tiles" key={set.id} aria-label={`${set.tiles.length} ${tileLabel(set.tiles[0])} exposed`}>{set.tiles.map(tile => <PublicTile key={tile.id} tile={tile} />)}</div>)}</div>
        </article>)}</div>
        <h3>Discards</h3>
        <div className="table-reading-tiles" aria-label="Visible discards">{puzzle.discards.map(tile => <PublicTile key={tile.id} tile={tile} highlighted={Boolean(result && level === 'medium' && cardTileKey(tile) === 'dragon-green')} />)}</div>
        <h3>Your rack</h3>
        <p className="table-reading-instruction">Choose one of the outlined tiles.</p>
        <div className="daily-rack" role="group" aria-label="Your rack">
          {puzzle.rack.map(tile => {
            const choice = puzzle.choices.some(item => item.id === tile.id);
            return choice ? <button type="button" key={tile.id} className={`daily-tile table-reading-choice${(submitted ?? selected) === tile.id ? ' daily-tile-picked' : ''}${result && choices.some(item => item.tile.id === tile.id && item.score === minimum) ? ' daily-tile-answer' : ''}`} aria-label={tileLabel(tile)} aria-pressed={(submitted ?? selected) === tile.id} disabled={!ready || Boolean(result)} onClick={() => setSelected(tile.id)}><TileFace tile={tile} /></button>
              : <span className="daily-tile table-reading-held" key={tile.id} title={tileLabel(tile)}><TileFace tile={tile} /></span>;
          })}
        </div>
        {!result ? <div className="daily-commit"><p>{selected ? `${tileLabel(choices.find(choice => choice.tile.id === selected)!.tile)} selected` : 'Which tile would you throw?'}</p><Button onClick={submit} disabled={!ready || !selected}>Lock in discard</Button></div> : null}
      </section>

      {result ? <section ref={resultRef} tabIndex={-1} aria-labelledby="table-reading-result-title" className={`daily-result table-reading-result${won ? ' daily-result-solved' : ''}${fresh ? ' daily-result-fresh' : ''}`}>
        {newStar ? <PuzzleSolveBurst /> : null}
        <div className="daily-result-header"><div><p className="kicker">{newStar ? 'Star earned' : won ? 'Puzzle solved' : 'Read the clues'}</p><h2 id="table-reading-result-title">{won ? 'Sharp read.' : 'There’s a better discard.'}</h2></div>{won ? <span className="daily-fit-badge" aria-label="Star earned">★</span> : null}</div>
        <p>{won ? `${tileLabel(result.tile)} helps the fewest possible lines here.` : `${tileLabel(result.tile)} helps more possible lines than ${tileLabel(best.tile)}.`} {puzzle.clue}</p>
        <div className="table-reading-comparison" aria-label="Compare discard risks">
          {choices.map(choice => <details key={choice.tile.id}>
            <summary><strong>{tileLabel(choice.tile)}</strong><span>{choice.score} {choice.score === 1 ? 'line' : 'lines'}{choice.score === minimum ? ' · Fewest' : ''}</span></summary>
            {choice.byPlayer.map(({ player, lines }) => <div className="table-reading-evidence" key={player.id}><p><strong>{player.name}:</strong> {lines.length ? `${lines.length} possible ${lines.length === 1 ? 'line needs' : 'lines need'} this tile.` : 'No matching line needs this tile.'}</p>
              {lines.map(row => <div className="daily-reference" key={row.id}><small>{row.section === '369' ? '3 · 6 · 9' : row.section}</small><ReferenceCardLine hand={row} number={referenceHands.filter(item => item.section === row.section).indexOf(row) + 1} showSuitCues={false} /></div>)}
            </div>)}
          </details>)}
        </div>
        <p className="table-reading-caveat">These are possible card lines based on visible tiles. Concealed hands are unknown, so the lower-risk choice isn’t guaranteed safe.</p>
        {stars.length === 3 && won ? <p className="table-reading-complete"><strong>Three stars. Challenge complete.</strong></p> : null}
        <div className="table-reading-result-actions">
          {won && next ? <a className={buttonVariants()} href={levelHref(next)}>Next: {levelName[next]} →</a> : null}
          <Button variant={won && next ? 'outline' : 'default'} onClick={retry}>{won ? 'Play again' : 'Try again'}</Button>
        </div>
      </section> : null}
    </div>
  </main>;
}
