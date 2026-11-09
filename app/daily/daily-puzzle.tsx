/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation avoids the Sites runtime issue. */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createDailyPuzzle, playDailyDiscard, scoreDailyDiscard } from '../../src/game/daily-puzzle';
import { formatPuzzleDate } from '../../src/game/puzzle-catalog';
import { readPuzzleResult, savePuzzleResult } from '../../src/game/puzzle-results';
import { TrainingCardLine } from '../../src/table/training-card-line';
import { tileLabel } from '../../src/game/tiles';
import type { GameState } from '../../src/game/types';
import { TileFace } from '../../src/table/tile-face';
import { Button } from '../../src/ui/button';
import { GameExperience } from '../game-experience';

export function DailyPuzzle({ date, archived = false }: { date: string; archived?: boolean }) {
  const puzzle = useMemo(() => createDailyPuzzle(date), [date]);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        setSubmitted(readPuzzleResult(localStorage, date, puzzle.rack.map(tile => tile.id)));
      } catch { /* The puzzle is playable without browser storage. */ }
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [date, puzzle]);

  const chosen = puzzle.rack.find(tile => tile.id === submitted);
  const result = chosen ? scoreDailyDiscard(puzzle, chosen.id) : null;
  const submit = () => {
    if (!ready || !selected || submitted) return;
    setSubmitted(selected);
    try { savePuzzleResult(localStorage, date, selected); } catch { /* Optional. */ }
  };

  if (game) return <GameExperience puzzleGame={game} puzzleReturnHref={archived ? `/daily/${date}` : '/daily'} />;

  return <main className="daily-page">
    <header className="daily-top"><a className="brand" href="/">The Mahjong Room</a><nav aria-label="Puzzle navigation"><a href="/daily/archive">Puzzle archive</a><a href="/">Back home</a></nav></header>
    <div className="daily-layout">
      <header className="daily-intro">
        <span className="daily-seal" aria-hidden="true">✦</span>
        <p className="kicker">{archived ? 'Puzzle archive' : 'Daily Puzzle'} · <time dateTime={date}>{formatPuzzleDate(date)}</time></p>
        <h1>What would you discard?</h1>
        <p>One good discard puts you a tile away from Mahjong.</p>
      </header>
      <section className="daily-table" aria-label="Daily discard challenge">
        <div className="daily-target"><span>Training Card · Target hand</span><h2>{puzzle.hand.section}</h2><TrainingCardLine hand={puzzle.hand} /></div>
        <div className="daily-rack" role="group" aria-label="Choose a tile to discard">
          {puzzle.rack.map(tile => {
            const picked = (submitted ?? selected) === tile.id;
            return <button type="button" className={`daily-tile${picked ? ' daily-tile-picked' : ''}${result && tile.id === puzzle.answer.id ? ' daily-tile-answer' : ''}`} key={tile.id} aria-label={tileLabel(tile)} aria-pressed={picked} disabled={Boolean(result) || !ready} onClick={() => setSelected(tile.id)}><TileFace tile={tile} /></button>;
          })}
        </div>
        {!result ? <div className="daily-commit"><p>{selected ? `${tileLabel(puzzle.rack.find(tile => tile.id === selected)!)} selected` : 'Tap a tile, then lock in your discard.'}</p><Button disabled={!selected || !ready} onClick={submit}>Lock in discard</Button></div> : null}
      </section>
      {result && chosen ? <section className="daily-result">
        <div role="status">
          <p className="kicker">{result.correct ? '✦ Puzzle solved' : '✦ Puzzle reviewed'}</p>
          <h2>{result.correct ? 'One tile away.' : 'The stronger discard'}</h2>
          <p>{result.correct ? `Exactly. ${tileLabel(puzzle.answer)} doesn’t fit ${puzzle.hand.name}.` : `You chose ${tileLabel(chosen)}, leaving ${result.matching} tiles that fit. Discarding ${tileLabel(puzzle.answer)} keeps all 13 useful tiles.`} You’d be looking for {tileLabel(puzzle.needed)}{result.jokerCanHelp ? ' or a Joker for that set' : ''}.</p>
        </div>
        <Button onClick={() => setGame(playDailyDiscard(puzzle, chosen))}>Play this hand from here <span aria-hidden="true">→</span></Button>
        <small>Continue with your discard against bots. Your saved practice game stays separate.</small>
      </section> : <p className="daily-footnote">A new puzzle every day. No timer, no account needed.</p>}
    </div>
  </main>;
}
