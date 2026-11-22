'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccessibility } from '../../../src/accessibility/provider';
import { charlestonHandOptions, charlestonShuffleDirections, dealCharlestonShuffle, exchangeCharlestonTiles } from '../../../src/game/charleston-shuffle';
import { organizeTileIds, tileLabel } from '../../../src/game/tiles';
import { arrangeHand, TrainingCardProvider } from '../../../src/game/training-card';
import type { HandDefinition, Tile } from '../../../src/game/types';
import { TileFace } from '../../../src/table/tile-face';
import { TrainingCardPattern } from '../../../src/table/training-card-line';
import { Button } from '../../../src/ui/button';
import { Select } from '../../../src/ui/select';

const openingSeed = 2026;
const totalPasses = charlestonShuffleDirections.length;
const trainingHands = TrainingCardProvider.getHands();
const targetChoices = trainingHands.map(hand => ({ value: hand.id, label: hand.name }));

function targetFit(rack: Tile[], hand: HandDefinition) {
  return arrangeHand(rack, [], hand).matchingTileIds.length;
}

export function CharlestonShuffle() {
  const { ready } = useAccessibility();
  const [game, setGame] = useState(() => dealCharlestonShuffle(openingSeed));
  const [targetId, setTargetId] = useState(() => charlestonHandOptions(game.players[0].rack)[0].hand.id);
  const [selected, setSelected] = useState<string[]>([]);
  const [received, setReceived] = useState<Tile[]>([]);
  const [review, setReview] = useState(false);
  const [error, setError] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moveFocus = useRef(false);
  const revealing = received.length > 0;
  const pass = game.charlestonPassIndex;
  const activeStep = revealing ? pass - 1 : pass;
  const rack = game.players[0].rack;
  const target = trainingHands.find(hand => hand.id === targetId) ?? trainingHands[0];
  const fit = targetFit(rack, target);
  const keptFit = selected.length ? targetFit(rack.filter(tile => !selected.includes(tile.id)), target) : null;
  const tilesById = new Map(rack.map(tile => [tile.id, tile]));
  const sortedRack = organizeTileIds(rack).map(id => tilesById.get(id)!);
  const receivedIds = new Set(received.map(tile => tile.id));
  const heading = review ? 'Your strongest hands' : revealing ? 'Three tiles received' : `Pass ${charlestonShuffleDirections[pass].toLowerCase()}`;

  useEffect(() => {
    if (moveFocus.current) {
      headingRef.current?.focus();
      moveFocus.current = false;
    }
  }, [heading, game.seed]);

  function selectTile(id: string) {
    setSelected(current => current.includes(id) ? current.filter(tileId => tileId !== id) : current.length < 3 ? [...current, id] : current);
  }

  function passTiles() {
    const exchange = exchangeCharlestonTiles(game, selected);
    if (!exchange) {
      setError(true);
      return;
    }
    moveFocus.current = true;
    setGame(exchange.game);
    setReceived(exchange.received);
    setSelected([]);
    setError(false);
  }

  function continueAfterPass() {
    moveFocus.current = true;
    if (pass === totalPasses) setReview(true);
    setReceived([]);
  }

  function reset(seed: number) {
    moveFocus.current = true;
    const next = dealCharlestonShuffle(seed);
    setGame(next);
    setTargetId(charlestonHandOptions(next.players[0].rack)[0].hand.id);
    setSelected([]);
    setReceived([]);
    setReview(false);
    setError(false);
  }

  const options = review ? charlestonHandOptions(rack) : [];
  const openingRack = review ? dealCharlestonShuffle(game.seed).players[0].rack : [];
  const openingFit = review ? charlestonHandOptions(openingRack)[0].fit : 0;

  return <div className="shuffle-game">
    <ol className="shuffle-steps" aria-label="Charleston pass progress">
      {charlestonShuffleDirections.map((direction, index) => <li key={direction} aria-current={index === activeStep ? 'step' : undefined}
        data-complete={index < pass ? true : undefined}>
        <span aria-hidden="true">{index < pass ? '✓' : index + 1}</span>{direction}
        {index < pass && <span className="shuffle-sr-only"> completed</span>}
      </li>)}
    </ol>
    <section className="shuffle-board" aria-labelledby="shuffle-stage">
      <div className="shuffle-board-heading">
        <p className="mini-games-eyebrow">{review ? 'Training Card' : `Pass ${activeStep + 1} of ${totalPasses}`}</p>
        <h2 id="shuffle-stage" ref={headingRef} tabIndex={-1} aria-describedby="shuffle-instruction">{heading}</h2>
        <p id="shuffle-instruction">{review ? `Best fit · Start ${openingFit}/14 · Finish ${options[0].fit}/14` : revealing
          ? `You received ${received.map(tileLabel).join(', ')}.`
          : 'Pick three to pass. Jokers stay in your rack.'}</p>
      </div>
      <div className="shuffle-target">
        {review ? <div className="shuffle-target-name"><span>Training Card target</span><h3>{target.name}</h3></div>
          : <Select label="Training Card target" value={target.id} options={targetChoices} onValueChange={setTargetId} disabled={!ready} />}
        <TrainingCardPattern hand={target} />
        <p className="shuffle-target-description">{target.description}</p>
        <p className="shuffle-target-fit" role="status">{review
          ? `Target fit · Start ${targetFit(openingRack, target)}/14 · Finish ${fit}/14`
          : `${fit}/14 tiles fit${keptFit === null ? '' : ` · ${keptFit}/14 kept if passed`}`}</p>
      </div>
      {review ? <ol className="shuffle-hand-list" aria-label="Best-fitting Training Card hands">
        {options.map(({ hand, fit }) => <li key={hand.id}>
          <div><h3>{hand.name}</h3><p>{hand.description}</p></div>
          <strong aria-label={`${fit} of 14 tiles fit`}>{fit}<span> / 14</span></strong>
        </li>)}
      </ol> : <>
        <div className="shuffle-tray" role="group" aria-label={revealing ? 'Received tiles' : 'Tiles selected to pass'}>
          {Array.from({ length: 3 }, (_, index) => {
            const tile = revealing ? received[index] : tilesById.get(selected[index]);
            if (!tile) return <span key={index} className="shuffle-tray-slot" aria-hidden="true" />;
            if (revealing) return <span key={tile.id} className="shuffle-tile shuffle-received" aria-label={tileLabel(tile)} role="img"><TileFace tile={tile} /></span>;
            return <button key={tile.id} type="button" className="shuffle-tile" aria-label={`Remove ${tileLabel(tile)} from pass`} onClick={() => selectTile(tile.id)}><TileFace tile={tile} /></button>;
          })}
        </div>
        <div className="shuffle-rack-heading"><h3>Your rack</h3>
          {!revealing && <span role="status">{ready ? `${selected.length} of 3 selected` : 'Dealing your rack…'}</span>}
        </div>
        <div className="shuffle-rack" role="group" aria-label={revealing ? 'Updated rack' : 'Choose tiles from your rack'}>
          {sortedRack.map(tile => {
            const picked = selected.includes(tile.id);
            if (revealing) return <span key={tile.id} role="img" className="shuffle-tile" data-new={receivedIds.has(tile.id) || undefined} aria-label={tileLabel(tile)}><TileFace tile={tile} /></span>;
            return <button key={tile.id} type="button" className="shuffle-tile" aria-pressed={picked}
              aria-label={tileLabel(tile)} disabled={!ready || tile.type.kind === 'joker'}
              aria-disabled={!picked && selected.length === 3 ? true : undefined}
              onClick={() => selectTile(tile.id)}><TileFace tile={tile} /></button>;
          })}
        </div>
      </>}
      {error && <p className="shuffle-error" role="alert">The pass didn’t go through. Try again.</p>}
      <div className="shuffle-actions">
        {review ? <>
          <Button variant="secondary" onClick={() => reset((game.seed + 1 + Math.floor(Math.random() * 0xffffff)) >>> 0)}>New deal</Button>
          <Button variant="ghost" onClick={() => reset(game.seed)}>Replay this deal</Button>
        </> : revealing
          ? <Button variant="secondary" onClick={continueAfterPass}>{pass === totalPasses ? 'See my hands' : 'Continue'}</Button>
          : <Button variant="secondary" onClick={passTiles} disabled={selected.length !== 3}>Pass {charlestonShuffleDirections[pass].toLowerCase()} · 3 tiles</Button>}
      </div>
    </section>
  </div>;
}
