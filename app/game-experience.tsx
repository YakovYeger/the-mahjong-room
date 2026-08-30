'use client';

import { useMemo, useState } from 'react';
import { runBotAction } from '../src/game/bots';
import { applyGameAction, createGame } from '../src/game/engine';
import { tileLabel } from '../src/game/tiles';
import { TrainingCardProvider } from '../src/game/training-card';
import type { GameState, Tile } from '../src/game/types';

function shortTile(tile: Tile) {
  if (tile.type.kind === 'number') return { top: String(tile.type.rank), bottom: tile.type.suit === 'bamboo' ? 'BAM' : tile.type.suit === 'characters' ? 'CRAK' : 'DOT' };
  if (tile.type.kind === 'wind') return { top: tile.type.wind[0].toUpperCase(), bottom: 'WIND' };
  if (tile.type.kind === 'dragon') return { top: tile.type.dragon[0].toUpperCase(), bottom: 'DRAGON' };
  if (tile.type.kind === 'flower') return { top: 'F', bottom: 'FLOWER' };
  return { top: '★', bottom: 'JOKER' };
}

function finishBotTurns(state: GameState): GameState {
  let next = state;
  let guard = 0;
  while (next.phase === 'playing' && next.players[next.turnIndex].type === 'bot' && guard < 4) {
    next = runBotAction(next, next.players[next.turnIndex].id);
    guard += 1;
  }
  return next;
}

export function GameExperience() {
  const [started, setStarted] = useState(false);
  const [game, setGame] = useState(() => createGame(2026));
  const [selected, setSelected] = useState<string[]>([]);
  const [hintLevel, setHintLevel] = useState(0);
  const [notice, setNotice] = useState('');
  const [review, setReview] = useState(false);
  const human = game.players[0];
  const candidates = useMemo(() => TrainingCardProvider.analyzeCandidates(human.rack).slice(0, 3), [human.rack]);
  const best = candidates[0];
  const needsDraw = game.phase === 'playing' && human.rack.length % 3 === 1;
  const humanTurns = game.events.filter((event) => event.type === 'TILE_DISCARDED' && event.playerId === 'human').length;

  const toggleTile = (id: string) => {
    setNotice('');
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  };

  const passTiles = () => {
    const result = applyGameAction(game, 'human', { type: 'PASS_TILES', tileIds: selected });
    if (!result.ok) return setNotice(result.violation.message);
    let next = result.state;
    while (next.phase === 'charleston') {
      const bot = next.players[next.charlestonRound % 4];
      next = runBotAction(next, bot.id);
    }
    setGame(next);
    setSelected([]);
    setNotice('The Charleston is complete. East begins by discarding one tile.');
  };

  const drawTile = () => {
    const result = applyGameAction(game, 'human', { type: 'DRAW_TILE' });
    if (!result.ok) return setNotice(result.violation.message);
    setGame(result.state);
    setNotice(`You drew ${tileLabel(result.state.players[0].rack.at(-1)!)}. Notice whether it strengthens your leading hand.`);
  };

  const discardTile = () => {
    if (selected.length !== 1) return;
    const result = applyGameAction(game, 'human', { type: 'DISCARD_TILE', tileId: selected[0] });
    if (!result.ok) return setNotice(result.violation.message);
    const discarded = human.rack.find((tile) => tile.id === selected[0]);
    const next = finishBotTurns(result.state);
    setGame(next);
    setSelected([]);
    setNotice(`${discarded ? tileLabel(discarded) : 'Tile'} discarded. The table played around to you.`);
  };

  if (!started) {
    return (
      <main className="welcome">
        <nav><span className="brand">The Mahjong Room</span><span className="tiny-label">A calmer way to learn</span></nav>
        <section className="welcome-grid">
          <div className="welcome-copy"><p className="kicker">Your first game starts here</p><h1>Learn American Mahjong by <em>actually playing.</em></h1><p className="lede">A patient coach sits beside you through the tiles, the Charleston, and every decision—then quietly steps away as you get better.</p><button className="start-button" onClick={() => setStarted(true)}>Play your first hand <span>→</span></button><small>No account. No timer. We&apos;ll explain as we go.</small></div>
          <div className="welcome-rack" aria-hidden="true">{human.rack.slice(0, 8).map((tile) => { const label = shortTile(tile); return <span className="hero-tile" key={tile.id}><strong>{label.top}</strong><small>{label.bottom}</small></span>; })}<div className="teacher-note"><span>Coach</span><p>You already have a few tiles that work beautifully together.</p></div></div>
        </section>
        <footer><span>Original Training Card</span><span>One human · three patient bots</span><span>Built for complete beginners</span></footer>
      </main>
    );
  }

  if (review) {
    return (
      <main className="review-page">
        <header><span className="brand">The Mahjong Room</span><span>Game review</span></header>
        <section className="review-hero"><p className="kicker">First game complete</p><h1>You&apos;re reading the table already.</h1><p>You made {humanTurns} independent discard decisions and completed the Charleston without a rules mistake.</p></section>
        <section className="review-grid">
          <article><span className="review-icon">✓</span><p className="kicker">Strong decision</p><h2>You protected your most useful tile group.</h2><p>Your leading pattern stayed intact through the Charleston, giving you a flexible start.</p></article>
          <article><span className="review-icon coral">↗</span><p className="kicker">Next game</p><h2>Ask for one fewer hint.</h2><p>You can now move from Full Guidance to Guided mode. The coach will wait for your choice first.</p></article>
          <article className="skill-card"><p className="kicker">Skills practiced</p>{[['Tile recognition',82],['Charleston',68],['Finding hands',55],['Discard strategy',43]].map(([name,value]) => <div className="skill" key={name}><span>{name}</span><i><b style={{width: `${value}%`}} /></i></div>)}</article>
        </section>
        <div className="review-actions"><button onClick={() => { setGame(createGame(2027)); setReview(false); setSelected([]); }}>Play game two</button><button className="secondary" onClick={() => setStarted(false)}>Back home</button></div>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar"><button className="brand brand-button" onClick={() => setStarted(false)}>The Mahjong Room</button><span className="game-label">Your first game · Full guidance</span><button className="quiet-button" onClick={() => setStarted(false)}>Leave table</button></header>
      <section className="table" aria-label="Guided American Mahjong table">
        <div className="opponent opponent-top"><span>June</span><small>{game.players[2].rack.length} tiles</small></div><div className="opponent opponent-left"><span>Mara</span><small>{game.players[1].rack.length} tiles</small></div><div className="opponent opponent-right"><span>Theo</span><small>{game.players[3].rack.length} tiles</small></div>
        <div className="center-mark"><span className="round">East</span><p>{game.phase === 'charleston' ? 'Charleston · First right' : `Turn ${game.turnCount + 1} · ${game.wall.length} in wall`}</p><strong>{game.phase === 'charleston' ? 'Pass 3 tiles' : needsDraw ? 'Draw a tile' : 'Choose a discard'}</strong><div className="discard-row">{game.discards.slice(-6).map((tile) => <span key={tile.id}>{shortTile(tile).top}</span>)}</div></div>
        <aside className="coach-card"><div className="coach-eyebrow"><span>Coach</span><span>{hintLevel + 1} of 3</span></div><h1>{game.phase === 'charleston' ? 'Look for the tiles doing the least work.' : needsDraw ? 'Draw first, then reassess.' : `${best.name} is still your strongest direction.`}</h1><p>{notice || (game.phase === 'charleston' ? 'Your strongest pattern is marked in the candidate list. Select three tiles that contribute the least.' : needsDraw ? 'A complete rack has 13 tiles between turns. Draw one from the wall to begin.' : `You have ${best.matchingTileIds.length} useful tiles toward this original Training Card hand.`)}</p><div className="candidate-list">{candidates.map((candidate, index) => <div key={candidate.handId}><span>{index === 0 ? 'Best match' : 'Alternative'}</span><strong>{candidate.name}</strong><small>{candidate.matchingTileIds.length} / 14 useful tiles</small></div>)}</div><button onClick={() => setHintLevel((level) => Math.min(2, level + 1))}>{hintLevel < 2 ? 'Show me what to notice' : 'Why these tiles?'}</button></aside>
        <div className="player-area"><div className="rack" aria-label="Your rack">{human.rack.map((tile) => { const label = shortTile(tile); return <button className={`tile ${selected.includes(tile.id) ? 'selected' : ''} ${hintLevel >= 1 && !best.matchingTileIds.includes(tile.id) ? 'hinted' : ''}`} key={tile.id} aria-label={tileLabel(tile)} aria-pressed={selected.includes(tile.id)} onClick={() => toggleTile(tile.id)}><strong>{label.top}</strong><small>{label.bottom}</small></button>; })}</div><div className="player-controls"><p><strong>Your rack</strong><span>{game.phase === 'charleston' ? `${selected.length} of 3 selected` : needsDraw ? 'Ready to draw' : `${selected.length} tile selected`}</span></p><div className="action-group">{humanTurns >= 4 && <button className="finish-button" onClick={() => setReview(true)}>Finish guided game</button>}{game.phase === 'charleston' ? <button className="primary" disabled={selected.length !== 3} onClick={passTiles}>Pass selected tiles</button> : needsDraw ? <button className="primary" onClick={drawTile}>Draw tile</button> : <button className="primary" disabled={selected.length !== 1} onClick={discardTile}>Discard tile</button>}</div></div></div>
      </section>
    </main>
  );
}
