'use client';

import { PointerActivationConstraints } from '@dnd-kit/dom';
import { DragDropProvider, PointerSensor } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useAccessibility } from '../../../src/accessibility/provider';
import { useFollowedHand } from '../../../src/coach/use-followed-hand';
import { getCardProvider } from '../../../src/game/cards';
import { charlestonShuffleCardId, charlestonShuffleDirections, dealCharlestonShuffle, exchangeCharlestonTiles } from '../../../src/game/charleston-shuffle';
import { organizeRack } from '../../../src/game/rack-order';
import { SortableRackItem } from '../../../src/game/sortable-rack-item';
import { moveTileId, normalizeTileOrder, reorderTileIds, tileLabel } from '../../../src/game/tiles';
import { arrangeHand } from '../../../src/game/training-card';
import type { Exposure, HandDefinition, Tile } from '../../../src/game/types';
import { passDirection } from '../../../src/table/charleston-motion';
import { CardCompanion } from '../../../src/table/card-companion';
import { OrganizeRackButton } from '../../../src/table/organize-rack-button';
import { ViewCardButton } from '../../../src/table/rack-turn-tools';
import { TileFace } from '../../../src/table/tile-face';
import { CardTargetPattern } from '../../../src/table/training-card-line';
import { Button } from '../../../src/ui/button';

const openingSeed = 2026;
const totalPasses = charlestonShuffleDirections.length;
const card = getCardProvider(charlestonShuffleCardId);
const hands = new Map(card.getHands().map(hand => [hand.id, hand]));
const noExposures: Exposure[] = [];
const noTiles: Tile[] = [];
const passArrows = { right: '→', across: '↑', left: '←' } as const;

function targetFit(rack: Tile[], hand: HandDefinition) {
  return arrangeHand(rack, noExposures, hand).matchingTileIds.length;
}

export function CharlestonShuffle() {
  const { ready } = useAccessibility();
  const [game, setGame] = useState(() => dealCharlestonShuffle(openingSeed));
  const [openingRack, setOpeningRack] = useState(() => game.players[0].rack);
  const [rackOrder, setRackOrder] = useState(() => organizeRack(openingRack, noExposures));
  const [selected, setSelected] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<{ sent: Tile[]; received: Tile[] } | null>(null);
  const [review, setReview] = useState(false);
  const [error, setError] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cardButtonRef = useRef<HTMLButtonElement>(null);
  const moveFocus = useRef(false);
  const suppressTileClick = useRef(false);
  const storageKey = `charleston-shuffle:${game.seed}`;
  const [followedId, follow] = useFollowedHand(storageKey, charlestonShuffleCardId);
  const received = receipt?.received ?? noTiles;
  const revealing = receipt !== null;
  const pass = game.charlestonPassIndex;
  const activeStep = revealing ? pass - 1 : pass;
  const direction = passDirection(activeStep);
  const rack = game.players[0].rack;
  const openingCandidates = useMemo(() => card.analyzeCandidates(openingRack), [openingRack]);
  const openingBest = openingCandidates[0];
  const ranked = useMemo(() => rack === openingRack ? openingCandidates : card.analyzeCandidates(rack), [rack, openingRack, openingCandidates]);
  const followed = followedId ? hands.get(followedId) : undefined;
  const target = followed ?? hands.get(openingBest.handId)!;
  const fit = targetFit(rack, target);
  const keptFit = selected.length ? targetFit(rack.filter(tile => !selected.includes(tile.id)), target) : null;
  const tilesById = new Map(rack.map(tile => [tile.id, tile]));
  const orderedRack = normalizeTileOrder(rackOrder, rack).map(id => tilesById.get(id)!);
  const receivedOrder = new Map(received.map((tile, index) => [tile.id, index]));
  const openingFit = openingBest.matchingTileIds.length;
  const finalFit = ranked[0].matchingTileIds.length;
  const improvement = finalFit - openingFit;
  const heading = review ? 'Your strongest hands' : revealing ? 'Three tiles received' : `Pass ${charlestonShuffleDirections[pass].toLowerCase()}`;

  useEffect(() => {
    if (moveFocus.current) {
      headingRef.current?.focus();
      moveFocus.current = false;
    }
  }, [heading, game.seed]);

  function selectTile(id: string) {
    if (suppressTileClick.current) return;
    if (tilesById.get(id)?.type.kind === 'joker') {
      setNotice('You can move Jokers around your rack. They stay with you during the Charleston.');
      return;
    }
    setSelected(current => current.includes(id) ? current.filter(tileId => tileId !== id) : current.length < 3 ? [...current, id] : current);
  }

  function arrangeRack(hand?: HandDefinition) {
    setRackOrder(organizeRack(orderedRack, noExposures, hand));
    setNotice(hand ? `Rack arranged by ${hand.name}. Unmatched tiles are at the end.` : 'Rack organized by suit and number.');
  }

  function autoSetHand() {
    const best = hands.get(ranked[0].handId)!;
    follow(best.id);
    arrangeRack(best);
  }

  function passTiles() {
    const exchange = exchangeCharlestonTiles(game, selected);
    if (!exchange) {
      setError(true);
      return;
    }
    moveFocus.current = true;
    setGame(exchange.game);
    setRackOrder(current => normalizeTileOrder(current, exchange.game.players[0].rack));
    setReceipt({ sent: selected.map(id => tilesById.get(id)!), received: exchange.received });
    setSelected([]);
    setNotice('');
    setError(false);
  }

  function continueAfterPass() {
    moveFocus.current = true;
    if (pass === totalPasses) setReview(true);
    setReceipt(null);
  }

  function reset(seed: number) {
    moveFocus.current = true;
    follow(null);
    const next = dealCharlestonShuffle(seed);
    setGame(next);
    setOpeningRack(next.players[0].rack);
    setRackOrder(organizeRack(next.players[0].rack, noExposures));
    setSelected([]);
    setReceipt(null);
    setReview(false);
    setNotice('');
    setError(false);
  }

  return <div className="shuffle-game">
    <ol className="shuffle-steps" aria-label="Charleston pass progress">
      {charlestonShuffleDirections.map((direction, index) => <li key={direction} aria-current={index === activeStep ? 'step' : undefined}
        data-complete={index < pass ? true : undefined}>
        <span aria-hidden="true">{index < pass ? '✓' : index + 1}</span>{direction}
        {index < pass && <span className="shuffle-sr-only"> completed</span>}
      </li>)}
    </ol>
    <section className="shuffle-board" aria-labelledby="shuffle-stage"
      data-direction={direction} data-revealing={revealing || undefined}>
      <div className="shuffle-board-heading">
        <p className="mini-games-eyebrow">{review ? 'Charleston complete' : `Pass ${activeStep + 1} of ${totalPasses}`}</p>
        <h2 id="shuffle-stage" ref={headingRef} tabIndex={-1} aria-describedby="shuffle-instruction">{heading}</h2>
        <p id="shuffle-instruction">{review ? `Best 2025 Card fit went from ${openingFit} to ${finalFit} of 14 tiles.` : revealing
          ? `You received ${received.map(tileLabel).join(', ')}.`
          : 'Pick three to pass. Jokers stay in your rack.'}</p>
      </div>
      {review && <div className="shuffle-score" data-improved={improvement > 0 || undefined}>
        <div className="shuffle-score-heading"><strong>{improvement > 0 ? 'Stronger rack' : 'Best fit'}</strong>
          <span>{improvement > 0 ? `+${improvement} ${improvement === 1 ? 'tile' : 'tiles'}` : `${finalFit}/14`}</span>
        </div>
        <div className="shuffle-score-track" aria-hidden="true" style={{ '--fit': finalFit / 14 } as CSSProperties}><i /></div>
        {improvement > 0 && <div className="shuffle-score-sparks" aria-hidden="true"><span>✦</span><span>✧</span><span>✦</span></div>}
      </div>}
      <div className="shuffle-target">
        <div className="shuffle-target-top">
          <div className="shuffle-target-name"><span>2025 Card · {followed ? 'Following' : 'Suggested hand'}</span><h3>{target.name}</h3></div>
          {!review && <Button variant="outline" onClick={autoSetHand} disabled={!ready || dragging}>Auto set hand</Button>}
        </div>
        <CardTargetPattern hand={target} showSuits />
        <p className="shuffle-target-fit" role="status">{review
          ? `Target fit · Start ${targetFit(openingRack, target)}/14 · Finish ${fit}/14`
          : `${fit}/14 tiles fit${keptFit === null ? '' : ` · ${keptFit}/14 kept if passed`}`}</p>
      </div>
      {review ? <ol className="shuffle-hand-list" aria-label="Best-fitting 2025 Card hands">
        {ranked.slice(0, 3).map(candidate => {
          const hand = hands.get(candidate.handId)!;
          const count = candidate.matchingTileIds.length;
          return <li key={hand.id}>
            <div><h3>{hand.name}</h3><p>{hand.description}</p></div>
            <strong aria-label={`${count} of 14 tiles fit`}>{count}<span> / 14</span></strong>
          </li>;
        })}
      </ol> : <>
        <div className="shuffle-exchange">
          <p className="shuffle-tray-label"><span aria-hidden="true">{revealing && direction === 'across' ? '↓' : passArrows[direction]}</span>
            {revealing ? 'Incoming tiles' : 'Pass tray'}
          </p>
          <div className="shuffle-tray" data-full={selected.length === 3 || undefined} role="group" aria-label={revealing ? 'Received tiles' : 'Tiles selected to pass'}>
            {Array.from({ length: 3 }, (_, index) => {
              const tile = revealing ? received[index] : tilesById.get(selected[index]);
              if (!tile) return <span key={index} className="shuffle-tray-slot" aria-hidden="true" />;
              if (revealing) return <span key={tile.id} className="shuffle-tile shuffle-received" aria-label={tileLabel(tile)} role="img"><TileFace tile={tile} /></span>;
              return <button key={tile.id} type="button" className="shuffle-tile shuffle-loaded" aria-label={`Remove ${tileLabel(tile)} from pass`} onClick={() => selectTile(tile.id)}><TileFace tile={tile} /></button>;
            })}
            {receipt && <div className="shuffle-outgoing" aria-hidden="true">
              {receipt.sent.map(tile => <span className="shuffle-tile" key={tile.id}><TileFace tile={tile} /></span>)}
            </div>}
          </div>
        </div>
        <div className="shuffle-rack-heading">
          <div><h3>Your rack</h3>{!revealing && <span role="status">{ready ? `${selected.length} of 3 selected` : 'Dealing your rack…'}</span>}</div>
          <div className="rack-icon-actions shuffle-rack-tools">
            <ViewCardButton buttonRef={cardButtonRef} open={cardOpen} onClick={() => setCardOpen(true)} />
            <OrganizeRackButton disabled={!ready || dragging} label={followed ? `Organize rack by ${followed.name}` : undefined} onClick={() => arrangeRack(followed)} />
            <CardCompanion compact key={storageKey} cardId={charlestonShuffleCardId} rack={orderedRack} exposures={noExposures}
              storageKey={storageKey} candidates={ranked} open={cardOpen} cardButtonRef={cardButtonRef} onOpenChange={setCardOpen}
              onArrange={ids => { setRackOrder(ids); setNotice('Rack arranged by your followed hand. Unmatched tiles are at the end.'); }} />
          </div>
        </div>
        <DragDropProvider
          sensors={defaults => [
            ...defaults.filter(sensor => sensor !== PointerSensor),
            PointerSensor.configure({
              activationConstraints(event) {
                return event.pointerType === 'touch'
                  ? [new PointerActivationConstraints.Delay({ value: 200, tolerance: { x: 8, y: 8 } })]
                  : [new PointerActivationConstraints.Distance({ value: 5 })];
              },
            }),
          ]}
          onDragStart={() => { suppressTileClick.current = true; setDragging(true); }}
          onDragEnd={event => {
            const source = event.operation.source;
            if (!event.canceled && source && isSortable(source) && source.index !== source.initialIndex) {
              setRackOrder(current => {
                const order = normalizeTileOrder(current, rack);
                return reorderTileIds(order, String(source.id), order[source.index]);
              });
              setNotice('Rack order updated.');
            }
            setDragging(false);
            window.setTimeout(() => { suppressTileClick.current = false; }, 0);
          }}
        >
          <div className="shuffle-rack" role="group" aria-label={revealing ? 'Updated rack' : 'Choose tiles from your rack'} aria-describedby={revealing ? undefined : 'shuffle-reorder-hint'}>
            {orderedRack.map((tile, index) => {
              if (revealing) {
                const arrival = receivedOrder.get(tile.id);
                return <span key={tile.id} role="img" className="shuffle-tile" data-new={arrival !== undefined || undefined}
                  style={arrival === undefined ? undefined : { '--tile-delay': `${arrival * 50}ms` } as CSSProperties}
                  aria-label={tileLabel(tile)}><TileFace tile={tile} /></span>;
              }
              return <SortableRackItem key={tile.id} id={tile.id} index={index} className="shuffle-tile-slot" disabled={!ready}>
                {({ handleRef }) => <button ref={handleRef} data-drag-handle type="button" className="shuffle-tile" aria-pressed={selected.includes(tile.id)}
                  aria-label={tileLabel(tile)} disabled={!ready} aria-disabled={tile.type.kind === 'joker' || undefined}
                  onClick={() => selectTile(tile.id)}
                  onKeyDown={event => {
                    if (!event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
                    event.preventDefault();
                    setRackOrder(current => moveTileId(normalizeTileOrder(current, rack), tile.id, event.key === 'ArrowLeft' ? -1 : 1));
                    setNotice('Rack order updated.');
                  }}><TileFace tile={tile} /></button>}
              </SortableRackItem>;
            })}
          </div>
        </DragDropProvider>
        {!revealing && <p className="shuffle-reorder-hint" id="shuffle-reorder-hint">Hold and drag to rearrange · Alt + arrow keys</p>}
        <span className="shuffle-sr-only" role="status">{notice}</span>
      </>}
      {error && <p className="shuffle-error" role="alert">The pass didn’t go through. Try again.</p>}
      <div className="shuffle-actions">
        {review ? <>
          <Button variant="secondary" onClick={() => reset((game.seed + 1 + Math.floor(Math.random() * 0xffffff)) >>> 0)}>New deal</Button>
          <Button variant="ghost" onClick={() => reset(game.seed)}>Replay this deal</Button>
        </> : revealing
          ? <Button variant="secondary" onClick={continueAfterPass}>{pass === totalPasses ? 'See my hands' : 'Continue'}</Button>
          : <Button variant="secondary" onClick={passTiles} disabled={selected.length !== 3 || dragging}>Pass {charlestonShuffleDirections[pass].toLowerCase()} · 3 tiles</Button>}
      </div>
    </section>
  </div>;
}
