'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { getCoachVisibleContext } from '../src/coach/analyze';
import { getProgressiveHint, recommendCall, recommendCharlestonPass, recommendDiscard, recommendDraw } from '../src/coach/recommend';
import { generateGameReview } from '../src/coach/review';
import { loadGuestProgress, saveGuestProgress } from '../src/persistence/guest-progress';
import { runBotAction } from '../src/game/bots';
import { applyGameAction, createGame } from '../src/game/engine';
import { tileKey, tileLabel } from '../src/game/tiles';
import { TrainingCardProvider } from '../src/game/training-card';
import type { GameState, Tile } from '../src/game/types';

const trainingHands = TrainingCardProvider.getHands();

function trainingTileLabel(key: string) {
  if (key === 'flower-any') return 'Flower';
  const [kind, value] = key.split('-');
  if (kind === 'bamboo') return `${value} Bam`;
  if (kind === 'characters') return `${value} Crak`;
  if (kind === 'dots') return `${value} Dot`;
  if (kind === 'wind') return `${value[0].toUpperCase()} Wind`;
  if (kind === 'dragon') return `${value[0].toUpperCase()} Dragon`;
  return key;
}

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

function completeWithCoach(state: GameState): GameState {
  let next = state;
  let guard = 0;
  while (next.phase === 'playing' && guard < 120) {
    guard += 1;
    const player = next.players[next.turnIndex];
    if (player.type === 'bot') {
      next = runBotAction(next, player.id);
      continue;
    }
    if (next.callWindow) {
      const pass = applyGameAction(next, player.id, { type: 'PASS_ON_DISCARD' });
      if (!pass.ok) break;
      next = pass.state;
    }
    if (player.rack.length % 3 === 1) {
      const draw = applyGameAction(next, player.id, { type: 'DRAW_TILE' });
      if (!draw.ok) break;
      next = draw.state;
    }
    const human = next.players[0];
    const best = TrainingCardProvider.analyzeCandidates(human.rack)[0];
    const discardId = human.rack.find((tile) => !best.matchingTileIds.includes(tile.id))?.id ?? human.rack[0].id;
    const discard = applyGameAction(next, player.id, { type: 'DISCARD_TILE', tileId: discardId });
    if (!discard.ok) break;
    next = discard.state;
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
  const [manualTurns, setManualTurns] = useState(0);
  const [hintsRequested, setHintsRequested] = useState(0);
  const [cardOpen, setCardOpen] = useState(true);
  const human = game.players[0];
  const coachContext = useMemo(() => getCoachVisibleContext(game, 'human')!, [game]);
  const candidates = coachContext.candidates.slice(0, 3);
  const best = candidates[0];
  const respondingToDiscard = game.phase === 'playing' && game.callWindow !== null;
  const needsDraw = game.phase === 'playing' && !respondingToDiscard && human.rack.length % 3 === 1;
  const callableTiles = respondingToDiscard && game.callWindow
    ? human.rack.filter((tile) => tile.type.kind === 'joker' || tileKey(tile) === tileKey(game.callWindow!.discard))
    : [];
  const exchangeOption = game.phase === 'playing' && !respondingToDiscard && !needsDraw && game.players[game.turnIndex].id === 'human'
    ? game.players.flatMap((owner) => owner.exposures.flatMap((exposure) => {
        const joker = exposure.tiles.find((tile) => tile.type.kind === 'joker');
        const natural = exposure.tiles.find((tile) => tile.type.kind !== 'joker');
        const rackTile = natural ? human.rack.find((tile) => tile.type.kind !== 'joker' && tileKey(tile) === tileKey(natural)) : undefined;
        return joker && rackTile ? [{ owner, exposure, joker, rackTile }] : [];
      }))[0]
    : undefined;
  const coachRecommendation = useMemo(() => {
    if (game.phase === 'charleston') return recommendCharlestonPass(coachContext);
    if (respondingToDiscard) return recommendCall(coachContext);
    if (needsDraw) return recommendDraw();
    return recommendDiscard(coachContext);
  }, [coachContext, game.phase, needsDraw, respondingToDiscard]);
  const coachHint = getProgressiveHint(coachRecommendation, hintLevel, human.rack);
  const gameReview = useMemo(() => generateGameReview(game, 'human', { hintsRequested, manualTurns }), [game, hintsRequested, manualTurns]);

  const toggleTile = (id: string) => {
    setNotice('');
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  };

  const passTiles = () => {
    const result = applyGameAction(game, 'human', { type: 'PASS_TILES', tileIds: selected });
    if (!result.ok) return setNotice(result.violation.message);
    let next = result.state;
    let safety = 0;
    while (next.phase === 'charleston' && safety < 24) {
      safety += 1;
      const previousVersion = next.stateVersion;
      if (next.charlestonCourtesy) {
        const courtesyPlayer = next.players[next.charlestonRound % 4];
        const courtesy = applyGameAction(next, courtesyPlayer.id, { type: 'COURTESY_PASS', tileIds: [] });
        if (!courtesy.ok) break;
        next = courtesy.state;
        if (next.stateVersion === previousVersion) break;
        continue;
      }
      if (next.charlestonAwaitingDecision) {
        const decision = applyGameAction(next, 'human', { type: 'CHOOSE_SECOND_CHARLESTON', continue: false });
        if (!decision.ok) break;
        next = decision.state;
        if (next.stateVersion === previousVersion) break;
        continue;
      }
      const bot = next.players[next.charlestonRound % 4];
      next = runBotAction(next, bot.id);
      if (next.stateVersion === previousVersion) break;
    }
    setGame(next);
    setSelected([]);
    setNotice(next.phase === 'playing' ? 'The Charleston is complete. East begins by discarding one tile.' : 'The table could not complete that pass. Please try again.');
  };

  const drawTile = () => {
    const result = applyGameAction(game, 'human', { type: 'DRAW_TILE' });
    if (!result.ok) return setNotice(result.violation.message);
    setGame(result.state);
    setNotice(`You drew ${tileLabel(result.state.players[0].rack.at(-1)!)}. Notice whether it strengthens your leading hand.`);
  };

  const passOnDiscard = () => {
    const result = applyGameAction(game, 'human', { type: 'PASS_ON_DISCARD' });
    if (!result.ok) return setNotice(result.violation.message);
    setGame(result.state);
    setSelected([]);
    setNotice('You passed. Draw from the wall to begin your turn.');
  };

  const callDiscard = () => {
    const result = applyGameAction(game, 'human', { type: 'CALL_TILE', rackTileIds: selected });
    if (!result.ok) return setNotice(result.violation.message);
    setGame(result.state);
    setSelected([]);
    setNotice(`You exposed a ${selected.length === 2 ? 'pung' : 'kong'}. ${selected.length === 2 ? 'Now discard without drawing.' : 'Draw a replacement tile before discarding.'}`);
  };

  const exchangeJoker = () => {
    if (!exchangeOption) return;
    const result = applyGameAction(game, 'human', {
      type: 'EXCHANGE_JOKER',
      exposureOwnerId: exchangeOption.owner.id,
      exposureId: exchangeOption.exposure.id,
      rackTileId: exchangeOption.rackTile.id,
      jokerTileId: exchangeOption.joker.id,
    });
    if (!result.ok) return setNotice(result.violation.message);
    setGame(result.state);
    setNotice(`You replaced ${tileLabel(exchangeOption.rackTile)} in ${exchangeOption.owner.name}'s exposure and brought the joker into your rack.`);
  };

  const discardTile = () => {
    if (selected.length !== 1) return;
    const result = applyGameAction(game, 'human', { type: 'DISCARD_TILE', tileId: selected[0] });
    if (!result.ok) return setNotice(result.violation.message);
    const discarded = human.rack.find((tile) => tile.id === selected[0]);
    const next = finishBotTurns(result.state);
    setGame(next);
    setSelected([]);
    setManualTurns((turns) => turns + 1);
    setNotice(`${discarded ? tileLabel(discarded) : 'Tile'} discarded. The table played around to you.`);
  };

  const finishGame = () => {
    const completed = completeWithCoach(game);
    setGame(completed);
    setReview(true);
    try {
      const previous = loadGuestProgress(localStorage);
      const skillScores = new Map(previous?.skills.map((skill) => [skill.name, skill.score]) ?? []);
      gameReview.skills.forEach((skill) => skillScores.set(skill.name, Math.max(skill.score, skillScores.get(skill.name) ?? 0)));
      saveGuestProgress(localStorage, {
        gamesCompleted: (previous?.gamesCompleted ?? 0) + 1,
        assistanceLevel: gameReview.suggestedAssistanceLevel,
        skills: [...skillScores].map(([name, score]) => ({ name, score })),
        experiencePoints: (previous?.experiencePoints ?? 0) + 100,
      });
    } catch {
      // Progress persistence is a convenience; gameplay still works when storage is unavailable.
    }
  };

  const requestHint = () => {
    setHintLevel((level) => Math.min(2, level + 1));
    setHintsRequested((count) => count + 1);
  };

  if (!started) {
    return (
      <main className="welcome">
        <nav><span className="brand">The Mahjong Room</span><span className="welcome-nav-actions"><span className="tiny-label">A calmer way to learn</span><Link href="/account">Save progress</Link></span></nav>
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
        <section className="review-hero"><p className="kicker">First game complete</p><h1>{gameReview.headline}</h1><p>{gameReview.summary}</p></section>
        <section className="review-grid">
          {gameReview.cards.map((card) => <article key={card.id}><span className={`review-icon ${card.tone === 'strong' ? '' : 'coral'}`}>{card.tone === 'strong' ? '✓' : '↗'}</span><p className="kicker">{card.eyebrow}</p><h2>{card.title}</h2><p>{card.body}</p></article>)}
          <article className="skill-card"><p className="kicker">Skills practiced</p>{gameReview.skills.map(({name,score}) => <div className="skill" key={name}><span>{name}</span><i><b style={{width: `${score}%`}} /></i></div>)}</article>
        </section>
        <div className="review-actions"><button onClick={() => { setGame(createGame(2027)); setReview(false); setSelected([]); setManualTurns(0); setHintsRequested(0); setHintLevel(0); }}>Play game two</button><button className="secondary" onClick={() => setStarted(false)}>Back home</button></div>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar"><button className="brand brand-button" onClick={() => setStarted(false)}>The Mahjong Room</button><span className="game-label">Your first game · Full guidance</span><span className="table-links"><button className="quiet-button" aria-expanded={cardOpen} aria-controls="training-card" onClick={() => setCardOpen((open) => !open)}>{cardOpen ? 'Hide card' : 'Show card'}</button><Link href="/account">Save progress</Link><button className="quiet-button" onClick={() => setStarted(false)}>Leave table</button></span></header>
      <section className="game-table" aria-label="Guided American Mahjong table">
        <div className="opponent opponent-top"><span>June</span><small>{game.players[2].rack.length} tiles</small></div><div className="opponent opponent-left"><span>Mara</span><small>{game.players[1].rack.length} tiles</small></div><div className="opponent opponent-right"><span>Theo</span><small>{game.players[3].rack.length} tiles</small></div>
        <div className="center-mark"><span className="round">East</span><p>{game.phase === 'charleston' ? 'Charleston · First right' : `Turn ${game.turnCount + 1} · ${game.wall.length} in wall`}</p><strong>{game.phase === 'charleston' ? 'Pass 3 tiles' : respondingToDiscard ? 'Call or pass?' : needsDraw ? 'Draw a tile' : 'Choose a discard'}</strong><div className="discard-row">{game.discards.slice(-6).map((tile) => <span key={tile.id}>{shortTile(tile).top}</span>)}</div></div>
        {cardOpen ? <aside className="training-card-panel" id="training-card" aria-label="Training Card"><div className="training-card-heading"><div><p className="kicker">Original Training Card</p><h2>Hands to build</h2></div><button aria-label="Hide Training Card" onClick={() => setCardOpen(false)}>×</button></div><div className="training-hand-list">{trainingHands.map((hand) => <article key={hand.id}><span>{hand.section}</span><h3>{hand.name}</h3><p>{hand.description}</p><div>{hand.tiles.map((tile, index) => <small key={`${tile}-${index}`}>{trainingTileLabel(tile)}</small>)}</div></article>)}</div></aside> : null}
        <aside className="coach-card"><div className="coach-eyebrow"><span>Coach</span><span>{hintLevel + 1} of 3</span></div><h1>{coachRecommendation.headline}</h1><p>{notice || coachHint}</p><div className="candidate-list">{candidates.map((candidate, index) => <div key={candidate.handId}><span>{index === 0 ? 'Best match' : 'Alternative'}</span><strong>{candidate.name}</strong><small>{candidate.matchingTileIds.length} / 14 useful tiles</small></div>)}</div><button onClick={requestHint}>{hintLevel < 2 ? 'Show me what to notice' : 'Why these tiles?'}</button></aside>
        <div className="player-area"><div className="exposure-row">{game.players.flatMap((player) => player.exposures.map((exposure) => <div key={exposure.id}><small>{player.id === 'human' ? `your ${exposure.kind}` : `${player.name} · ${exposure.kind}`}</small>{exposure.tiles.map((tile) => <span key={tile.id}>{shortTile(tile).top}</span>)}</div>))}</div><div className="rack" aria-label="Your rack">{human.rack.map((tile) => { const label = shortTile(tile); const cannotPassJoker = game.phase === 'charleston' && tile.type.kind === 'joker'; return <button className={`tile ${selected.includes(tile.id) ? 'selected' : ''} ${hintLevel >= 1 && coachRecommendation.tileIds.includes(tile.id) ? 'recommended' : ''} ${hintLevel >= 1 && !best.matchingTileIds.includes(tile.id) ? 'hinted' : ''}`} key={tile.id} aria-label={`${tileLabel(tile)}${cannotPassJoker ? ', cannot be passed' : ''}`} aria-pressed={selected.includes(tile.id)} disabled={cannotPassJoker} onClick={() => toggleTile(tile.id)}><strong>{label.top}</strong><small>{label.bottom}</small></button>; })}</div><div className="player-controls"><p><strong>Your rack</strong><span>{game.phase === 'charleston' ? `${selected.length} of 3 selected` : respondingToDiscard ? `${selected.length} matching tiles selected` : needsDraw ? 'Ready to draw' : `${selected.length} tile selected`}</span></p><div className="action-group">{exchangeOption ? <button className="finish-button" onClick={exchangeJoker}>Exchange for joker</button> : null}{manualTurns >= 4 ? <button className="finish-button" onClick={finishGame}>Complete game with coach</button> : null}{game.phase === 'charleston' ? <button className="primary" disabled={selected.length !== 3} onClick={passTiles}>Pass selected tiles</button> : respondingToDiscard ? <><button className="finish-button" onClick={passOnDiscard}>Pass</button><button className="primary" disabled={selected.length < 2 || selected.length > 3 || !selected.every((id) => callableTiles.some((tile) => tile.id === id))} onClick={callDiscard}>{selected.length === 3 ? 'Call kong' : 'Call pung'}</button></> : needsDraw ? <button className="primary" onClick={drawTile}>Draw tile</button> : <button className="primary" disabled={selected.length !== 1} onClick={discardTile}>Discard tile</button>}</div></div></div>
      </section>
    </main>
  );
}
