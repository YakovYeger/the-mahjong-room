'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { getCoachVisibleContext } from '../src/coach/analyze';
import { getProgressiveHint, recommendCall, recommendCharlestonPass, recommendDiscard, recommendDraw } from '../src/coach/recommend';
import { generateGameReview } from '../src/coach/review';
import { loadGuestProgress, saveGuestProgress } from '../src/persistence/guest-progress';
import { runBotAction } from '../src/game/bots';
import { applyGameAction, createGame, totalPlayerTiles } from '../src/game/engine';
import { tileLabel } from '../src/game/tiles';
import { cardTileKey, getLegalCallOptions, TrainingCardProvider } from '../src/game/training-card';
import type { GameState, HandGroup, Player, Tile } from '../src/game/types';

const trainingHands = TrainingCardProvider.getHands();
const charlestonDirections = ['Right', 'Across', 'Left', 'Left', 'Across', 'Right'];

function trainingTileLabel(key: string) {
  if (key === 'flower-any') return 'F';
  const [kind, value] = key.split('-');
  if (kind === 'bamboo') return `${value}B`;
  if (kind === 'characters') return `${value}C`;
  if (kind === 'dots') return `${value}D`;
  if (kind === 'wind') return value[0].toUpperCase();
  if (kind === 'dragon') return value === 'red' ? 'RD' : value === 'green' ? 'GD' : 'WD';
  return key;
}

function trainingTileClass(key: string) {
  if (key.startsWith('bamboo')) return 'bam';
  if (key.startsWith('characters')) return 'crak';
  if (key.startsWith('dots')) return 'dot';
  if (key.startsWith('dragon')) return 'dragon';
  return 'honor';
}

function groupLabel(group: HandGroup) {
  return group.kind === 'single' ? 'single' : group.kind;
}

function shortTile(tile: Tile) {
  if (tile.type.kind === 'number') return { top: String(tile.type.rank), bottom: tile.type.suit === 'bamboo' ? 'BAM' : tile.type.suit === 'characters' ? 'CRAK' : 'DOT' };
  if (tile.type.kind === 'wind') return { top: tile.type.wind[0].toUpperCase(), bottom: 'WIND' };
  if (tile.type.kind === 'dragon') return { top: tile.type.dragon[0].toUpperCase(), bottom: 'DRAGON' };
  if (tile.type.kind === 'flower') return { top: 'F', bottom: 'FLOWER' };
  return { top: '★', bottom: 'JOKER' };
}

function allTiles(player: Player) {
  return [...player.rack, ...player.exposures.flatMap((exposure) => exposure.tiles)];
}

function advanceCharlestonBots(state: GameState): GameState {
  let next = state;
  let guard = 0;
  while (next.phase === 'charleston' && !next.charlestonAwaitingDecision && next.players[next.charlestonRound % 4].type === 'bot' && guard < 16) {
    const before = next.stateVersion;
    next = runBotAction(next, next.players[next.charlestonRound % 4].id);
    if (next.stateVersion === before) break;
    guard += 1;
  }
  return next;
}

function advancePlayingBots(state: GameState): GameState {
  let next = state;
  let guard = 0;
  while (next.phase === 'playing' && guard < 80) {
    guard += 1;
    if (next.callWindow) {
      const humanPending = next.callWindow.discardedByPlayerId !== 'human' && !next.callWindow.responses.human;
      if (humanPending) return next;
      const responder = next.players.find((player) => player.type === 'bot'
        && player.id !== next.callWindow!.discardedByPlayerId
        && !next.callWindow!.responses[player.id]);
      if (!responder) return next;
      const before = next.stateVersion;
      next = runBotAction(next, responder.id);
      if (next.stateVersion === before) return next;
      continue;
    }
    const active = next.players[next.turnIndex];
    if (active.type === 'human') return next;
    const before = next.stateVersion;
    next = runBotAction(next, active.id);
    if (next.stateVersion === before) return next;
  }
  return next;
}

function completeWithCoach(state: GameState): GameState {
  let next = state;
  let guard = 0;
  while (next.phase === 'playing' && guard < 1200) {
    guard += 1;
    if (next.callWindow) {
      const responder = next.players.find((player) => player.id !== next.callWindow!.discardedByPlayerId && !next.callWindow!.responses[player.id]);
      if (!responder) break;
      if (responder.type === 'bot') next = runBotAction(next, responder.id);
      else {
        const winning = TrainingCardProvider.validateMahjong([...allTiles(responder), next.callWindow.discard], responder.exposures).valid;
        const option = getLegalCallOptions(responder.rack, responder.exposures, next.callWindow.discard)[0];
        const result = winning
          ? applyGameAction(next, responder.id, { type: 'DECLARE_MAHJONG', useDiscard: true })
          : option
            ? applyGameAction(next, responder.id, { type: 'CALL_TILE', rackTileIds: option.rackTileIds })
            : applyGameAction(next, responder.id, { type: 'PASS_ON_DISCARD' });
        if (!result.ok) break;
        next = result.state;
      }
      continue;
    }
    const active = next.players[next.turnIndex];
    if (active.type === 'bot') {
      next = runBotAction(next, active.id);
      continue;
    }
    if (totalPlayerTiles(active) === 13) {
      const draw = applyGameAction(next, active.id, { type: 'DRAW_TILE' });
      if (!draw.ok) break;
      next = draw.state;
      if (next.phase === 'completed') break;
    }
    const updated = next.players[next.turnIndex];
    if (TrainingCardProvider.validateMahjong(allTiles(updated), updated.exposures).valid) {
      const mahjong = applyGameAction(next, updated.id, { type: 'DECLARE_MAHJONG' });
      if (mahjong.ok) next = mahjong.state;
      continue;
    }
    const best = TrainingCardProvider.analyzeCandidates(allTiles(updated), updated.exposures)[0];
    const nonJokers = updated.rack.filter((tile) => tile.type.kind !== 'joker');
    const discardId = nonJokers.find((tile) => !best.matchingTileIds.includes(tile.id))?.id ?? nonJokers[0]?.id ?? updated.rack[0].id;
    const discard = applyGameAction(next, updated.id, { type: 'DISCARD_TILE', tileId: discardId });
    if (!discard.ok) break;
    next = discard.state;
  }
  return next;
}

function charlestonLabel(game: GameState) {
  if (game.charlestonAwaitingDecision) return 'First Charleston complete';
  if (game.charlestonCourtesy) return 'Courtesy pass · Across';
  const set = game.charlestonPassIndex < 3 ? 'First Charleston' : 'Second Charleston';
  return `${set} · ${charlestonDirections[game.charlestonPassIndex]} · ${(game.charlestonPassIndex % 3) + 1} of 3`;
}

export function GameExperience() {
  const [started, setStarted] = useState(false);
  const [game, setGame] = useState(() => createGame(2026));
  const [selected, setSelected] = useState<string[]>([]);
  const [blindCount, setBlindCount] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [notice, setNotice] = useState('');
  const [review, setReview] = useState(false);
  const [manualTurns, setManualTurns] = useState(0);
  const [hintsRequested, setHintsRequested] = useState(0);
  const [cardOpen, setCardOpen] = useState(true);
  const human = game.players[0];
  const coachContext = useMemo(() => getCoachVisibleContext(game, 'human')!, [game]);
  const candidates = coachContext.candidates.filter((candidate) => candidate.viable).slice(0, 3);
  const best = candidates[0];
  const respondingToDiscard = game.phase === 'playing' && game.callWindow !== null
    && game.callWindow.discardedByPlayerId !== 'human' && !game.callWindow.responses.human;
  const needsDraw = game.phase === 'playing' && !game.callWindow && game.players[game.turnIndex].id === 'human' && totalPlayerTiles(human) === 13;
  const canDiscard = game.phase === 'playing' && !game.callWindow && game.players[game.turnIndex].id === 'human' && totalPlayerTiles(human) === 14;
  const legalCalls = respondingToDiscard && game.callWindow ? getLegalCallOptions(human.rack, human.exposures, game.callWindow.discard) : [];
  const chosenCall = legalCalls.find((option) => option.rackTileIds.length === selected.length
    && selected.every((id) => {
      const tile = human.rack.find((item) => item.id === id);
      return tile && game.callWindow && (tile.type.kind === 'joker' || cardTileKey(tile) === cardTileKey(game.callWindow.discard));
    }));
  const discardMahjong = respondingToDiscard && game.callWindow
    ? TrainingCardProvider.validateMahjong([...allTiles(human), game.callWindow.discard], human.exposures).valid
    : false;
  const selfMahjong = canDiscard ? TrainingCardProvider.validateMahjong(allTiles(human), human.exposures).valid : false;
  const blindAvailable = game.phase === 'charleston' && !game.charlestonCourtesy && [2, 5].includes(game.charlestonPassIndex);
  const expectedPassTiles = game.charlestonCourtesy ? undefined : 3 - blindCount;
  const exchangeOption = game.phase === 'playing' && !game.callWindow && canDiscard
    ? game.players.flatMap((owner) => owner.exposures.flatMap((exposure) => {
        const joker = exposure.tiles.find((tile) => tile.type.kind === 'joker');
        const natural = exposure.tiles.find((tile) => tile.type.kind !== 'joker');
        const rackTile = natural ? human.rack.find((tile) => tile.type.kind !== 'joker' && cardTileKey(tile) === cardTileKey(natural)) : undefined;
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

  const resetSelection = () => {
    setSelected([]);
    setBlindCount(0);
  };

  const toggleTile = (id: string) => {
    setNotice('');
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 5 ? [...current, id] : current);
  };

  const passTiles = () => {
    const action = game.charlestonCourtesy
      ? { type: 'COURTESY_PASS' as const, tileIds: selected }
      : { type: 'PASS_TILES' as const, tileIds: selected, blindCount };
    const result = applyGameAction(game, 'human', action);
    if (!result.ok) return setNotice(result.violation.message);
    const next = advanceCharlestonBots(result.state);
    setGame(next);
    resetSelection();
    setNotice(next.phase === 'playing' ? 'The Charleston is complete. East begins by discarding one tile.' : next.charlestonAwaitingDecision ? 'The three compulsory passes are complete. The second Charleston requires everyone to agree.' : 'Pass complete. Review your new tiles before choosing again.');
  };

  const chooseSecondCharleston = (continueCharleston: boolean) => {
    const result = applyGameAction(game, 'human', { type: 'CHOOSE_SECOND_CHARLESTON', continue: continueCharleston });
    if (!result.ok) return setNotice(result.violation.message);
    setGame(advanceCharlestonBots(result.state));
    resetSelection();
    setNotice(continueCharleston ? 'Everyone agreed. The second Charleston begins left.' : 'The table stopped. Choose an optional courtesy pass across.');
  };

  const drawTile = () => {
    const result = applyGameAction(game, 'human', { type: 'DRAW_TILE' });
    if (!result.ok) return setNotice(result.violation.message);
    setGame(result.state);
    resetSelection();
    if (result.state.phase === 'completed') {
      setReview(true);
      return;
    }
    const drawn = result.state.players[0].rack.at(-1)!;
    setNotice(`You drew ${tileLabel(drawn)}. ${TrainingCardProvider.validateMahjong(allTiles(result.state.players[0]), result.state.players[0].exposures).valid ? 'Your hand is complete—declare Mahjong.' : 'Notice whether it strengthens your leading hand.'}`);
  };

  const passOnDiscard = () => {
    const result = applyGameAction(game, 'human', { type: 'PASS_ON_DISCARD' });
    if (!result.ok) return setNotice(result.violation.message);
    const next = advancePlayingBots(result.state);
    setGame(next);
    resetSelection();
    if (next.phase === 'completed') setReview(true);
    else setNotice('You passed. Play continues around the table.');
  };

  const callDiscard = () => {
    if (!chosenCall) return;
    const result = applyGameAction(game, 'human', { type: 'CALL_TILE', rackTileIds: selected });
    if (!result.ok) return setNotice(result.violation.message);
    const next = advancePlayingBots(result.state);
    setGame(next);
    resetSelection();
    setNotice(next.players[next.turnIndex].id === 'human' && !next.callWindow ? `You exposed a ${chosenCall.kind}. Discard without drawing.` : 'Your claim was recorded while the table resolved the discard.');
  };

  const declareMahjong = (useDiscard = false) => {
    const result = applyGameAction(game, 'human', { type: 'DECLARE_MAHJONG', useDiscard });
    if (!result.ok) return setNotice(result.violation.message);
    const next = useDiscard ? advancePlayingBots(result.state) : result.state;
    setGame(next);
    resetSelection();
    if (next.phase === 'completed') setReview(true);
    else setNotice('Your Mahjong claim has priority while the table finishes responding.');
  };

  const exchangeJoker = () => {
    if (!exchangeOption) return;
    const result = applyGameAction(game, 'human', {
      type: 'EXCHANGE_JOKER', exposureOwnerId: exchangeOption.owner.id, exposureId: exchangeOption.exposure.id,
      rackTileId: exchangeOption.rackTile.id, jokerTileId: exchangeOption.joker.id,
    });
    if (!result.ok) return setNotice(result.violation.message);
    setGame(result.state);
    setNotice(`You replaced ${tileLabel(exchangeOption.rackTile)} in ${exchangeOption.owner.name}'s exposure and brought the Joker into your rack.`);
  };

  const discardTile = () => {
    if (selected.length !== 1) return;
    const discarded = human.rack.find((tile) => tile.id === selected[0]);
    const result = applyGameAction(game, 'human', { type: 'DISCARD_TILE', tileId: selected[0] });
    if (!result.ok) return setNotice(result.violation.message);
    const next = advancePlayingBots(result.state);
    setGame(next);
    resetSelection();
    setManualTurns((turns) => turns + 1);
    if (next.phase === 'completed') setReview(true);
    else setNotice(`${discarded ? tileLabel(discarded) : 'Tile'} discarded. Every player gets a chance to respond.`);
  };

  const finishGame = () => {
    const completed = completeWithCoach(game);
    setGame(completed);
    if (completed.phase !== 'completed') return setNotice('The coach could not safely complete this game. Continue one turn and try again.');
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
      // Progress persistence is optional; gameplay remains available without browser storage.
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
        <section className="review-hero"><p className="kicker">First game complete</p><h1>{game.winnerId === 'human' ? 'Mahjong—beautifully played.' : game.winnerId ? `${game.players.find((player) => player.id === game.winnerId)?.name} called Mahjong.` : 'The wall is complete.'}</h1><p>{gameReview.summary}</p></section>
        <section className="review-grid">
          {gameReview.cards.map((card) => <article key={card.id}><span className={`review-icon ${card.tone === 'strong' ? '' : 'coral'}`}>{card.tone === 'strong' ? '✓' : '↗'}</span><p className="kicker">{card.eyebrow}</p><h2>{card.title}</h2><p>{card.body}</p></article>)}
          <article className="skill-card"><p className="kicker">Skills practiced</p>{gameReview.skills.map(({ name, score }) => <div className="skill" key={name}><span>{name}</span><i><b style={{ width: `${score}%` }} /></i></div>)}</article>
        </section>
        <div className="review-actions"><button onClick={() => { setGame(createGame(2027)); setReview(false); resetSelection(); setManualTurns(0); setHintsRequested(0); setHintLevel(0); }}>Play game two</button><button className="secondary" onClick={() => setStarted(false)}>Back home</button></div>
      </main>
    );
  }

  const stageTitle = game.phase === 'charleston' ? charlestonLabel(game) : `Turn ${game.turnCount + 1} · ${game.wall.length} in wall`;
  const actionTitle = game.phase === 'charleston'
    ? game.charlestonAwaitingDecision ? 'Continue passing?' : game.charlestonCourtesy ? 'Choose 0–3 tiles' : `Pass ${3 - blindCount} from your rack`
    : respondingToDiscard ? 'Call, Mahjong, or pass?' : needsDraw ? 'Draw a tile' : 'Choose a discard';

  return (
    <main className="shell">
      <header className="topbar"><button className="brand brand-button" onClick={() => setStarted(false)}>The Mahjong Room</button><span className="game-label">Your first game · Full guidance</span><span className="table-links"><button className="quiet-button" aria-expanded={cardOpen} aria-controls="training-card" onClick={() => setCardOpen((open) => !open)}>{cardOpen ? 'Hide card' : 'Show card'}</button><Link href="/account">Save progress</Link><button className="quiet-button" onClick={() => setStarted(false)}>Leave table</button></span></header>
      <section className="game-table" aria-label="Guided American Mahjong table">
        <div className="opponent opponent-top"><span>June</span><small>{totalPlayerTiles(game.players[2])} tiles</small></div><div className="opponent opponent-left"><span>Mara</span><small>{totalPlayerTiles(game.players[1])} tiles</small></div><div className="opponent opponent-right"><span>Theo</span><small>{totalPlayerTiles(game.players[3])} tiles</small></div>
        <div className="center-mark"><span className="round">East</span><p>{stageTitle}</p><strong>{actionTitle}</strong><div className="discard-row">{game.discards.slice(-6).map((tile) => <span key={tile.id}>{shortTile(tile).top}</span>)}</div></div>
        {cardOpen ? <aside className="training-card-panel" id="training-card" aria-label="Training Card">
          <div className="training-card-heading"><div><p className="kicker">Original · Rules-aware</p><h2>Training Card</h2><small>Five hands designed to teach the building blocks.</small></div><button aria-label="Hide Training Card" onClick={() => setCardOpen(false)}>×</button></div>
          <div className="training-hand-list">{trainingHands.map((hand) => {
            const candidate = coachContext.candidates.find((item) => item.handId === hand.id);
            const rank = coachContext.candidates.filter((item) => item.viable).findIndex((item) => item.handId === hand.id);
            return <article className={rank === 0 ? 'leading' : candidate?.viable === false ? 'unavailable' : ''} key={hand.id}>
              <div className="hand-meta"><span>{hand.section}</span><b>{hand.exposure === 'concealed' ? 'C' : 'X'}</b></div>
              <div className="hand-title"><h3>{hand.name}</h3><small>{candidate?.viable ? `${candidate.matchingTileIds.length}/14` : 'Blocked'}</small></div>
              <p>{hand.description}</p>
              <div className="card-groups">{hand.groups.map((required) => <div className="card-group" aria-label={`${required.count} ${required.tileKey}, ${groupLabel(required)}`} key={required.id}>{Array.from({ length: required.count }, (_, index) => <span className={`mini-tile ${trainingTileClass(required.tileKey)}`} key={index}>{trainingTileLabel(required.tileKey)}</span>)}{required.jokerAllowed ? <i title="Jokers allowed">★</i> : null}</div>)}</div>
              <small className="teaching-point">{hand.teachingPoint}</small>
            </article>;
          })}</div>
          <footer><span><b>C</b> Concealed</span><span><b>X</b> Exposed</span><span><b>★</b> Jokers allowed</span></footer>
        </aside> : null}
        <aside className="coach-card"><div className="coach-eyebrow"><span>Coach</span><span>{hintLevel + 1} of 3</span></div><h1>{coachRecommendation.headline}</h1><p>{notice || coachHint}</p><div className="candidate-list">{candidates.map((candidate, index) => <div key={candidate.handId}><span>{index === 0 ? 'Best match' : 'Alternative'}</span><strong>{candidate.name}</strong><small>{candidate.matchingTileIds.length} / 14 useful</small></div>)}</div><button onClick={requestHint}>{hintLevel < 2 ? 'Show me what to notice' : 'Why these tiles?'}</button></aside>
        <div className="player-area">
          <div className="exposure-row">{game.players.flatMap((player) => player.exposures.map((exposure) => <div key={exposure.id}><small>{player.id === 'human' ? `your ${exposure.kind}` : `${player.name} · ${exposure.kind}`}</small>{exposure.tiles.map((tile) => <span key={tile.id}>{shortTile(tile).top}</span>)}</div>))}</div>
          <div className="rack" aria-label="Your rack">{human.rack.map((tile) => { const label = shortTile(tile); const cannotPassJoker = game.phase === 'charleston' && tile.type.kind === 'joker'; return <button className={`tile ${selected.includes(tile.id) ? 'selected' : ''} ${hintLevel >= 1 && coachRecommendation.tileIds.includes(tile.id) ? 'recommended' : ''} ${hintLevel >= 1 && best && !best.matchingTileIds.includes(tile.id) ? 'hinted' : ''}`} key={tile.id} aria-label={`${tileLabel(tile)}${cannotPassJoker ? ', cannot be passed' : ''}`} aria-pressed={selected.includes(tile.id)} disabled={cannotPassJoker} onClick={() => toggleTile(tile.id)}><strong>{label.top}</strong><small>{label.bottom}</small></button>; })}</div>
          <div className="player-controls"><p><strong>Your rack</strong><span>{game.phase === 'charleston' ? game.charlestonCourtesy ? `${selected.length} selected · optional` : `${selected.length} of ${expectedPassTiles} selected${blindCount ? ` · ${blindCount} blind` : ''}` : respondingToDiscard ? `${selected.length} selected for a call` : needsDraw ? '13 tiles · ready to draw' : `${totalPlayerTiles(human)} tiles · ${selected.length} selected`}</span></p>
            <div className="action-group">
              {game.phase === 'charleston' && game.charlestonAwaitingDecision ? <><button className="finish-button" onClick={() => chooseSecondCharleston(false)}>Stop and courtesy pass</button><button className="primary" onClick={() => chooseSecondCharleston(true)}>Play second Charleston</button></>
                : game.phase === 'charleston' ? <>{blindAvailable ? <div className="blind-controls"><button className={blindCount === 0 ? 'active' : ''} onClick={() => { setBlindCount(0); setSelected([]); }}>No blind</button><button className={blindCount === 1 ? 'active' : ''} onClick={() => { setBlindCount(1); setSelected([]); }}>1 blind</button><button className={blindCount === 2 ? 'active' : ''} onClick={() => { setBlindCount(2); setSelected([]); }}>2 blind</button></div> : null}<button className="primary" disabled={!game.charlestonCourtesy && selected.length !== expectedPassTiles} onClick={passTiles}>{game.charlestonCourtesy ? `Courtesy pass ${selected.length || 'none'}` : `Pass ${selected.length + blindCount} tiles`}</button></>
                  : respondingToDiscard ? <><button className="finish-button" onClick={passOnDiscard}>Pass</button>{discardMahjong ? <button className="mahjong-button" onClick={() => declareMahjong(true)}>Mahjong</button> : null}<button className="primary" disabled={!chosenCall} onClick={callDiscard}>{chosenCall ? `Call ${chosenCall.kind}` : 'Select a legal set'}</button></>
                    : needsDraw ? <button className="primary" onClick={drawTile}>Draw tile</button>
                      : <>{exchangeOption ? <button className="finish-button" onClick={exchangeJoker}>Exchange for Joker</button> : null}{manualTurns >= 4 ? <button className="finish-button" onClick={finishGame}>Complete with coach</button> : null}{selfMahjong ? <button className="mahjong-button" onClick={() => declareMahjong(false)}>Declare Mahjong</button> : null}<button className="primary" disabled={!canDiscard || selected.length !== 1} onClick={discardTile}>Discard tile</button></>}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
