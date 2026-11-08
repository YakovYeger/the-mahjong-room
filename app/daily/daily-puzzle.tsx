/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation avoids the Sites runtime issue. */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createDailyPuzzle, playDailyDiscard, scoreDailyDiscard } from '../../src/game/daily-puzzle';
import { tileLabel } from '../../src/game/tiles';
import type { GameState } from '../../src/game/types';
import { TileFace } from '../../src/table/tile-face';
import { Button } from '../../src/ui/button';
import { GameExperience } from '../game-experience';

const resultKey = 'mahjong-room-daily-result-v1';
export function DailyPuzzle({ date }: { date: string }) {
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
        const saved = JSON.parse(localStorage.getItem(resultKey) ?? 'null');
        if (saved?.date === date && puzzle.rack.some(tile => tile.id === saved.tileId)) setSubmitted(saved.tileId);
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
    try { localStorage.setItem(resultKey, JSON.stringify({ date, tileId: selected })); } catch { /* Optional. */ }
  };

  if (game) return <GameExperience puzzleGame={game} />;

  return <main className="daily-page">
    <header className="daily-top"><a className="brand" href="/">The Mahjong Room</a><a href="/">Back home</a></header>
    <div className="daily-layout">
      <header className="daily-intro">
        <span className="daily-seal" aria-hidden="true">✦</span>
        <p className="kicker">Daily Puzzle · <time dateTime={date}>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(date))}</time></p>
        <h1>What would you discard?</h1>
        <p>One good discard puts you a tile away from Mahjong.</p>
      </header>
      <section className="daily-table" aria-label="Daily discard challenge">
        <div className="daily-target"><span>Training Card · Target hand</span><h2>{puzzle.hand.name}</h2><p>{puzzle.hand.description}</p></div>
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
