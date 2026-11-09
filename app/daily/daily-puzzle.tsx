/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation avoids the Sites runtime issue. */
'use client';

import { DragDropProvider, PointerSensor } from '@dnd-kit/react';
import { PointerActivationConstraints } from '@dnd-kit/dom';
import { isSortable } from '@dnd-kit/react/sortable';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createDailyPuzzle, playDailyDiscard, scoreDailyDiscard } from '../../src/game/daily-puzzle';
import { formatPuzzleDate } from '../../src/game/puzzle-catalog';
import { readPuzzleRackOrder, readPuzzleResult, savePuzzleRackOrder, savePuzzleResult } from '../../src/game/puzzle-results';
import { ReferenceCardLine } from '../../src/table/reference-card-line';
import { TrainingCardLine } from '../../src/table/training-card-line';
import { SortableRackItem } from '../../src/game/sortable-rack-item';
import { moveTileId, reorderTileIds, tileLabel } from '../../src/game/tiles';
import type { GameState } from '../../src/game/types';
import { TileFace } from '../../src/table/tile-face';
import { Button } from '../../src/ui/button';
import { GameExperience } from '../game-experience';

export function DailyPuzzle({ date, archived = false }: { date: string; archived?: boolean }) {
  const puzzle = useMemo(() => createDailyPuzzle(date), [date]);
  const [rackOrder, setRackOrder] = useState(() => puzzle.rack.map(tile => tile.id));
  const suppressTileClick = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const ids = puzzle.rack.map(tile => tile.id);
        setSubmitted(readPuzzleResult(localStorage, date, ids, puzzle.version));
        setRackOrder(readPuzzleRackOrder(localStorage, date, ids, puzzle.version));
      } catch { /* The puzzle is playable without browser storage. */ }
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [date, puzzle]);

  const updateRackOrder = (order: string[]) => {
    setRackOrder(order);
    try { savePuzzleRackOrder(localStorage, date, order, puzzle.version); } catch { /* Optional. */ }
  };

  const chosen = puzzle.rack.find(tile => tile.id === submitted);
  const result = chosen ? scoreDailyDiscard(puzzle, chosen.id) : null;
  const submit = () => {
    if (!ready || !selected || submitted || dragging) return;
    setSubmitted(selected);
    try { savePuzzleResult(localStorage, date, selected, puzzle.version); } catch { /* Optional. */ }
  };

  if (game) return <GameExperience puzzleGame={game} puzzleRackOrder={rackOrder} puzzleReturnHref={archived ? `/daily/${date}` : '/daily'} />;

  return <main className="daily-page">
    <header className="daily-top"><a className="brand" href="/">The Mahjong Room</a><nav aria-label="Puzzle navigation"><a href="/daily/archive">Puzzle archive</a><a href="/">Back home</a></nav></header>
    <div className="daily-layout">
      <header className="daily-intro">
        <p className="kicker">{archived ? 'Puzzle archive' : 'Daily Puzzle'} · <time dateTime={date}>{formatPuzzleDate(date)}</time></p>
        <h1>What would you discard?</h1>
        <p>One good discard puts you a tile away from Mahjong.</p>
      </header>
      <section className="daily-table" aria-label="Daily discard challenge">
        <div className="daily-target"><span>{puzzle.row ? '2025 Card' : 'Training Card'} · Target hand</span><h2>{puzzle.hand.section === '369' ? '3 · 6 · 9' : puzzle.hand.section}</h2>
          {puzzle.row ? <div className="daily-reference"><ReferenceCardLine hand={puzzle.row} number={puzzle.number} showSuitCues={false} /></div> : <TrainingCardLine hand={puzzle.hand} />}
        </div>
        <DragDropProvider
          sensors={defaults => [
            ...defaults.filter(sensor => sensor !== PointerSensor),
            PointerSensor.configure({
              activationConstraints: event => event.pointerType === 'touch'
                ? [new PointerActivationConstraints.Delay({ value: 200, tolerance: { x: 8, y: 8 } })]
                : [new PointerActivationConstraints.Distance({ value: 5 })],
            }),
          ]}
          onDragStart={() => { suppressTileClick.current = true; setDragging(true); }}
          onDragEnd={event => {
            const source = event.operation.source;
            if (!event.canceled && source && isSortable(source) && source.index !== source.initialIndex) {
              updateRackOrder(reorderTileIds(rackOrder, String(source.id), rackOrder[source.index]));
            }
            setDragging(false);
            window.setTimeout(() => { suppressTileClick.current = false; }, 0);
          }}
        >
          <div className="daily-rack" role="group" aria-label="Choose a tile to discard" aria-describedby={result ? undefined : 'daily-rack-help'}>
            {rackOrder.map((id, index) => {
              const tile = puzzle.rack.find(tile => tile.id === id)!;
              const picked = (submitted ?? selected) === tile.id;
              const disabled = Boolean(result) || !ready;
              return <SortableRackItem key={tile.id} id={tile.id} index={index} className="daily-tile-slot" disabled={disabled}>
                {({ handleRef }) => <button type="button" ref={handleRef} data-drag-handle className={`daily-tile${picked ? ' daily-tile-picked' : ''}${result && tile.id === puzzle.answer.id ? ' daily-tile-answer' : ''}`} aria-label={tileLabel(tile)} aria-pressed={picked} disabled={disabled} onKeyDown={event => {
                  if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
                  event.preventDefault();
                  updateRackOrder(moveTileId(rackOrder, tile.id, event.key === 'ArrowLeft' ? -1 : 1));
                }} onClick={() => { if (!suppressTileClick.current) setSelected(tile.id); }}><TileFace tile={tile} /></button>}
              </SortableRackItem>;
            })}
          </div>
        </DragDropProvider>
        {!result ? <p id="daily-rack-help" className="daily-rack-help">Hold and drag to rearrange · Alt + arrow keys</p> : null}
        {!result ? <div className="daily-commit"><p>{selected ? `${tileLabel(puzzle.rack.find(tile => tile.id === selected)!)} selected` : 'Tap a tile, then lock in your discard.'}</p><Button disabled={!selected || !ready || dragging} onClick={submit}>Lock in discard</Button></div> : null}
      </section>
      {result && chosen ? <section className="daily-result">
        <div role="status">
          <p className="kicker">{result.correct ? 'Puzzle solved' : 'Puzzle reviewed'}</p>
          <h2>{result.correct ? 'One tile away.' : 'The stronger discard'}</h2>
          <p>{result.correct ? `Exactly. ${tileLabel(puzzle.answer)} doesn’t fit ${puzzle.hand.name}.` : `You chose ${tileLabel(chosen)}, leaving ${result.matching} tiles that fit. Discarding ${tileLabel(puzzle.answer)} keeps all 13 useful tiles.`} You’d be looking for {tileLabel(puzzle.needed)}{result.jokerCanHelp ? ' or a Joker for that set' : ''}.</p>
        </div>
        <Button onClick={() => setGame(playDailyDiscard(puzzle, chosen))}>Play this hand from here <span aria-hidden="true">→</span></Button>
        <small>Continue with your discard against bots. Your saved practice game stays separate.</small>
      </section> : <p className="daily-footnote">A new puzzle every day. No timer, no account needed.</p>}
    </div>
  </main>;
}
