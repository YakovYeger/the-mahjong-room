'use client';

import Link from 'next/link';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { getCoachVisibleContext } from '../src/coach/analyze';
import { getProgressiveHint, recommendCall, recommendCharlestonPass, recommendDiscard, recommendDraw } from '../src/coach/recommend';
import { generateGameReview } from '../src/coach/review';
import { loadGuestProgress, saveGuestProgress } from '../src/persistence/guest-progress';
import { loadGuestGameSession, saveGuestGameSession } from '../src/persistence/guest-session';
import { runBotAction } from '../src/game/bots';
import { applyGameAction, createGame, getLegalJokerExchangeOptions, totalPlayerTiles } from '../src/game/engine';
import { moveTileId, normalizeTileOrder, placeTileId, tileLabel } from '../src/game/tiles';
import { analyzeDiscardDeadHand, cardTileKey, getLegalCallOptions, TrainingCardProvider } from '../src/game/training-card';
import type { GameState, HandCandidate, HandGroup, Player, Suit, Tile } from '../src/game/types';

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

function SuitIcon({ suit }: { suit: Suit }) {
  if (suit === 'bamboo') return <span className="suit-icon suit-bamboo" aria-hidden="true"><i /><i /><i /></span>;
  if (suit === 'characters') return <span className="suit-icon suit-characters" aria-hidden="true">萬</span>;
  return <span className="suit-icon suit-dots" aria-hidden="true"><i /></span>;
}

function TileFace({ tile, compact = false }: { tile: Tile; compact?: boolean }) {
  const label = shortTile(tile);
  return <span className={`tile-face ${compact ? 'compact' : ''}`}>
    <strong>{label.top}</strong>
    {tile.type.kind === 'number' ? <SuitIcon suit={tile.type.suit} /> : <span className={`honor-icon honor-${tile.type.kind}`} aria-hidden="true">{tile.type.kind === 'wind' ? '風' : tile.type.kind === 'dragon' ? '龍' : tile.type.kind === 'flower' ? '✿' : '★'}</span>}
    <small>{label.bottom}</small>
  </span>;
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

const dealTargets = [
  { x: -104, y: 112, rotate: 0, dx: 28, dy: 0 },
  { x: -170, y: -80, rotate: 90, dx: 0, dy: 28 },
  { x: -104, y: -145, rotate: 180, dx: 28, dy: 0 },
  { x: 170, y: -80, rotate: -90, dx: 0, dy: 28 },
];

function DealingScreen({ gameNumber, resuming }: { gameNumber: number; resuming: boolean }) {
  return (
    <MotionConfig reducedMotion="user">
      <main className="dealing-screen" role="status" aria-live="polite" aria-label={`${resuming ? 'Restoring' : 'Dealing'} game ${gameNumber}`}>
        <header><span className="brand">The Mahjong Room</span><span>Game {gameNumber}</span></header>
        <section className="deal-stage" aria-hidden="true">
          <motion.div className="wall-stack" animate={{ scale: [1, 1.035, 1] }} transition={{ duration: .8, repeat: 2 }}>
            {Array.from({ length: 8 }, (_, index) => <i key={index} style={{ transform: `translate(${index * 3}px, ${index * -2}px)` }} />)}
          </motion.div>
          <div className="deal-orbit">
            {Array.from({ length: 20 }, (_, index) => {
              const target = dealTargets[index % dealTargets.length];
              const slot = Math.floor(index / dealTargets.length);
              return <motion.span className="deal-tile" key={index} initial={{ x: 0, y: 0, rotate: 0, scale: .72, opacity: 0 }} animate={{ x: target.x + target.dx * slot, y: target.y + target.dy * slot, rotate: target.rotate, scale: 1, opacity: 1 }} transition={{ delay: .12 + index * .065, duration: .52, ease: [0.22, 1, 0.36, 1] }}><i /></motion.span>;
            })}
          </div>
        </section>
        <div className="deal-copy">
          <p className="kicker">{resuming ? 'Returning to your seat' : 'The table is almost ready'}</p>
          <h1>{resuming ? 'Restoring your game…' : 'Dealing the opening racks…'}</h1>
          <p>Setting the wall, seats, and opening hands.</p>
          <span className="deal-progress"><motion.i initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 2.15, ease: 'easeInOut' }} /></span>
        </div>
      </main>
    </MotionConfig>
  );
}

function TrainingCardPanel({ candidates, onClose }: { candidates: HandCandidate[]; onClose: () => void }) {
  return (
    <motion.aside className="training-card-panel player-card-position" id="training-card" aria-label="Training Card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
      <div className="training-card-heading"><div><p className="kicker">Original · Player reference</p><h2>Training Card</h2><small>Swipe or scroll through ten rules-aware teaching hands.</small></div><button aria-label="Hide Training Card" onClick={onClose}>×</button></div>
      <div className="training-hand-list">{trainingHands.map((hand) => {
        const candidate = candidates.find((item) => item.handId === hand.id);
        const rank = candidates.filter((item) => item.viable).findIndex((item) => item.handId === hand.id);
        return <article className={rank === 0 ? 'leading' : candidate?.viable === false ? 'unavailable' : ''} key={hand.id}>
          <div className="hand-meta"><span>{hand.section}</span><b>{hand.exposure === 'concealed' ? 'C' : 'X'}</b></div>
          <div className="hand-title"><h3>{hand.name}</h3><small>{candidate?.viable ? `${candidate.matchingTileIds.length}/14` : 'Blocked'}</small></div>
          <p>{hand.description}</p>
          <div className="card-groups">{hand.groups.map((required) => <div className="card-group" aria-label={`${required.count} ${required.tileKey}, ${groupLabel(required)}`} key={required.id}>{Array.from({ length: required.count }, (_, index) => <span className={`mini-tile ${trainingTileClass(required.tileKey)}`} key={index}>{trainingTileLabel(required.tileKey)}</span>)}{required.jokerAllowed ? <i title="Jokers allowed">★</i> : null}</div>)}</div>
          <small className="teaching-point">{hand.teachingPoint}</small>
        </article>;
      })}</div>
      <footer><span><b>C</b> Concealed</span><span><b>X</b> Exposed</span><span><b>★</b> Jokers allowed</span></footer>
    </motion.aside>
  );
}

function ExposureTray({ players }: { players: Player[] }) {
  const exposedPlayers = players.filter((player) => player.exposures.length > 0);
  return (
    <div className={`exposure-row ${exposedPlayers.length === 0 ? 'empty' : ''}`} aria-label="Called tile groups">
      {exposedPlayers.map((player) => <section className="exposure-player" key={player.id}>
        <header><strong>{player.id === 'human' ? 'Your calls' : `${player.name}’s calls`}</strong><span>{player.exposures.length} set{player.exposures.length === 1 ? '' : 's'}</span></header>
        <div className="exposure-groups">{player.exposures.map((exposure) => <div className="called-set" key={exposure.id}><small>{exposure.kind}</small>{exposure.tiles.map((tile) => <span className="exposure-tile" title={tileLabel(tile)} key={tile.id}><TileFace tile={tile} compact /></span>)}</div>)}</div>
      </section>)}
    </div>
  );
}

export function TableReveal({ game }: { game: GameState }) {
  return (
    <section className="table-reveal" aria-labelledby="table-reveal-title">
      <header><div><p className="kicker">Everyone turns their rack</p><h2 id="table-reveal-title">The table at Mahjong</h2></div><p>Compare each direction and see how close every player was.</p></header>
      <div className="reveal-grid">{game.players.map((player) => {
        const tiles = allTiles(player);
        const winner = player.id === game.winnerId;
        const best = TrainingCardProvider.analyzeCandidates(tiles, player.exposures).find((candidate) => candidate.viable);
        const winningHandId = winner ? TrainingCardProvider.validateMahjong(tiles, player.exposures).handId : undefined;
        const winningHand = trainingHands.find((hand) => hand.id === winningHandId);
        return <article className={winner ? 'winner' : ''} key={player.id}>
          <div className="reveal-player"><div><strong>{player.name}</strong><small>{player.seat} seat · {tiles.length} tiles</small></div>{winner ? <b>Mahjong</b> : null}</div>
          <div className="revealed-rack" aria-label={`${player.name}'s concealed tiles`}>{player.rack.map((tile) => <span className="revealed-tile" title={tileLabel(tile)} key={tile.id}><TileFace tile={tile} compact /></span>)}</div>
          {player.exposures.length ? <div className="revealed-exposures">{player.exposures.map((exposure) => <div key={exposure.id}><small>{exposure.kind}</small>{exposure.tiles.map((tile) => <span className="revealed-tile exposed" title={tileLabel(tile)} key={tile.id}><TileFace tile={tile} compact /></span>)}</div>)}</div> : null}
          <p>{winner ? `Completed ${winningHand?.name ?? 'a Training Card hand'}.` : best ? `${best.matchingTileIds.length} of 14 tiles supported ${best.name}.` : 'No exposure-compatible line remained.'}</p>
        </article>;
      })}</div>
    </section>
  );
}

export function GameExperience() {
  const [started, setStarted] = useState(false);
  const [dealing, setDealing] = useState(false);
  const [game, setGame] = useState(() => createGame(2026));
  const [selected, setSelected] = useState<string[]>([]);
  const [blindCount, setBlindCount] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [notice, setNotice] = useState('');
  const [review, setReview] = useState(false);
  const [manualTurns, setManualTurns] = useState(0);
  const [hintsRequested, setHintsRequested] = useState(0);
  const [cardOpen, setCardOpen] = useState(true);
  const [rackOrder, setRackOrder] = useState(() => game.players[0].rack.map((tile) => tile.id));
  const [draggingTileId, setDraggingTileId] = useState<string | null>(null);
  const [dropIntent, setDropIntent] = useState<{ targetId: string; placement: 'before' | 'after' } | null>(null);
  const [discardQueue, setDiscardQueue] = useState<Tile[]>([]);
  const [gameNumber, setGameNumber] = useState(1);
  const [sessionReady, setSessionReady] = useState(false);
  const [hasSavedSession, setHasSavedSession] = useState(false);
  const human = game.players[0];
  const orderedRack = useMemo(() => {
    const order = normalizeTileOrder(rackOrder, human.rack);
    const byId = new Map(human.rack.map((tile) => [tile.id, tile]));
    return order.flatMap((id) => byId.get(id) ?? []);
  }, [human.rack, rackOrder]);
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
  const deadHand = useMemo(() => analyzeDiscardDeadHand(human.exposures, game.discards), [game.discards, human.exposures]);
  const blindAvailable = game.phase === 'charleston' && !game.charlestonCourtesy && [2, 5].includes(game.charlestonPassIndex);
  const expectedPassTiles = game.charlestonCourtesy ? undefined : 3 - blindCount;
  const exchangeOption = getLegalJokerExchangeOptions(game, 'human')[0];
  const coachRecommendation = useMemo(() => {
    if (game.phase === 'charleston') return recommendCharlestonPass(coachContext);
    if (respondingToDiscard) return recommendCall(coachContext);
    if (needsDraw) return recommendDraw();
    return recommendDiscard(coachContext);
  }, [coachContext, game.phase, needsDraw, respondingToDiscard]);
  const coachHint = getProgressiveHint(coachRecommendation, hintLevel, human.rack);
  const gameReview = useMemo(() => generateGameReview(game, 'human', { hintsRequested, manualTurns }), [game, hintsRequested, manualTurns]);
  const queuedDiscardIds = useMemo(() => new Set(discardQueue.map((tile) => tile.id)), [discardQueue]);
  const visibleDiscards = game.discards.filter((tile) => !queuedDiscardIds.has(tile.id));

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const saved = loadGuestGameSession(localStorage);
      if (saved) {
        setGame(saved.game);
        setRackOrder(normalizeTileOrder(saved.rackOrder, saved.game.players[0].rack));
        setManualTurns(saved.manualTurns);
        setHintsRequested(saved.hintsRequested);
        setHintLevel(saved.hintLevel);
        setReview(saved.review);
        setGameNumber(saved.gameNumber);
        setHasSavedSession(true);
      } else {
        const progress = loadGuestProgress(localStorage);
        if (progress?.gamesCompleted) {
          const nextNumber = progress.gamesCompleted + 1;
          const next = createGame(2025 + nextNumber);
          setGame(next);
          setRackOrder(next.players[0].rack.map((tile) => tile.id));
          setGameNumber(nextNumber);
        }
      }
      setSessionReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!sessionReady || (!started && !hasSavedSession)) return;
    try {
      saveGuestGameSession(localStorage, {
        gameNumber,
        game,
        rackOrder: normalizeTileOrder(rackOrder, game.players[0].rack),
        manualTurns,
        hintsRequested,
        hintLevel,
        review,
      });
    } catch {
      // A device-local checkpoint is helpful but never required for play.
    }
  }, [game, gameNumber, hasSavedSession, hintLevel, hintsRequested, manualTurns, rackOrder, review, sessionReady, started]);

  useEffect(() => {
    if (!dealing) return;
    const timer = window.setTimeout(() => setDealing(false), 2300);
    return () => window.clearTimeout(timer);
  }, [dealing]);

  useEffect(() => {
    if (discardQueue.length === 0) return;
    const timer = window.setTimeout(() => setDiscardQueue((current) => current.slice(1)), 1200);
    return () => window.clearTimeout(timer);
  }, [discardQueue]);

  const resetSelection = () => {
    setSelected([]);
    setBlindCount(0);
  };

  const setGameWithDiscardSequence = (next: GameState) => {
    const existingDiscardIds = new Set(game.discards.map((tile) => tile.id));
    const added = next.discards.filter((tile) => !existingDiscardIds.has(tile.id));
    if (added.length > 0) setDiscardQueue((current) => [...current, ...added]);
    setGame(next);
  };

  const toggleTile = (id: string) => {
    setNotice('');
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 5 ? [...current, id] : current);
  };

  const dropTile = (movingId: string, targetId: string, placement: 'before' | 'after') => {
    setRackOrder((current) => placeTileId(normalizeTileOrder(current, human.rack), movingId, targetId, placement));
    setDraggingTileId(null);
    setDropIntent(null);
    setNotice('Rack order updated. Tile order does not affect the rules.');
  };

  const nudgeTile = (tileId: string, offset: -1 | 1) => {
    setRackOrder((current) => moveTileId(normalizeTileOrder(current, human.rack), tileId, offset));
    setNotice('Rack order updated.');
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
    setGameWithDiscardSequence(next);
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
    resetSelection();
    setNotice(`You replaced ${tileLabel(exchangeOption.rackTile)} in ${exchangeOption.owner.name}'s exposure and brought the Joker into your rack.`);
  };

  const discardTile = () => {
    if (selected.length !== 1) return;
    const discarded = human.rack.find((tile) => tile.id === selected[0]);
    const result = applyGameAction(game, 'human', { type: 'DISCARD_TILE', tileId: selected[0] });
    if (!result.ok) return setNotice(result.violation.message);
    const next = advancePlayingBots(result.state);
    setGameWithDiscardSequence(next);
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

  const startNextGame = () => {
    const nextNumber = gameNumber + 1;
    const next = createGame(2025 + nextNumber);
    setGame(next);
    setGameNumber(nextNumber);
    setRackOrder(next.players[0].rack.map((tile) => tile.id));
    setReview(false);
    resetSelection();
    setManualTurns(0);
    setHintsRequested(0);
    setHintLevel(0);
    setNotice('');
    setDealing(true);
  };

  const enterGame = () => {
    setHasSavedSession(true);
    setStarted(true);
    if (!(review && game.phase === 'completed')) setDealing(true);
  };

  if (!started) {
    const returning = gameNumber > 1 || hasSavedSession;
    const startLabel = review && game.phase === 'completed'
      ? `View game ${gameNumber} review`
      : hasSavedSession ? `Resume game ${gameNumber}` : gameNumber === 1 ? 'Play your first hand' : `Play game ${gameNumber}`;
    return (
      <main className="welcome">
        <nav><span className="brand">The Mahjong Room</span><span className="welcome-nav-actions"><span className="tiny-label">A calmer way to learn</span><Link href="/account">Save progress</Link></span></nav>
        <section className="welcome-grid">
          <div className="welcome-copy"><p className="kicker">{returning ? `Game ${gameNumber} is ready` : 'Your first game starts here'}</p><h1>{returning ? <>Build your Mahjong instincts <em>one hand at a time.</em></> : <>Learn American Mahjong by <em>actually playing.</em></>}</h1><p className="lede">{returning ? 'Pick up exactly where you left off. Your rack order, table state, coaching level, and game number are saved on this device.' : 'A patient coach sits beside you through the tiles, the Charleston, and every decision—then quietly steps away as you get better.'}</p><button className="start-button" onClick={enterGame}>{startLabel} <span>→</span></button><small>{hasSavedSession ? 'Saved automatically on this device.' : 'No account. No timer. We’ll explain as we go.'}</small></div>
          <div className="welcome-rack" aria-hidden="true">{human.rack.slice(0, 8).map((tile) => { const label = shortTile(tile); return <span className="hero-tile" key={tile.id}><strong>{label.top}</strong><small>{label.bottom}</small></span>; })}<div className="teacher-note"><span>Coach</span><p>You already have a few tiles that work beautifully together.</p></div></div>
        </section>
        <footer><span>Original Training Card</span><span>Game {gameNumber} · device checkpoint ready</span><span>One human · three sharper bots</span></footer>
      </main>
    );
  }

  if (dealing) return <DealingScreen gameNumber={gameNumber} resuming={hasSavedSession && (game.turnCount > 0 || game.charlestonRound > 0)} />;

  if (review) {
    return (
      <main className="review-page">
        <header><span className="brand">The Mahjong Room</span><span>Game review</span></header>
        <section className="review-hero"><p className="kicker">Game {gameNumber} complete</p><h1>{game.winnerId === 'human' ? 'Mahjong—beautifully played.' : game.winnerId ? `${game.players.find((player) => player.id === game.winnerId)?.name} called Mahjong.` : 'The wall is complete.'}</h1><p>{gameReview.summary}</p></section>
        {game.winnerId ? <TableReveal game={game} /> : null}
        <section className="review-grid">
          {gameReview.cards.map((card) => <article key={card.id}><span className={`review-icon ${card.tone === 'strong' ? '' : 'coral'}`}>{card.tone === 'strong' ? '✓' : '↗'}</span><p className="kicker">{card.eyebrow}</p><h2>{card.title}</h2><p>{card.body}</p></article>)}
          <article className="skill-card"><p className="kicker">Skills practiced</p>{gameReview.skills.map(({ name, score }) => <div className="skill" key={name}><span>{name}</span><i><b style={{ width: `${score}%` }} /></i></div>)}</article>
        </section>
        <div className="review-actions"><button onClick={startNextGame}>Play game {gameNumber + 1}</button><button className="secondary" onClick={() => setStarted(false)}>Back home</button></div>
      </main>
    );
  }

  const stageTitle = game.phase === 'charleston' ? charlestonLabel(game) : `Turn ${game.turnCount + 1} · ${game.wall.length} in wall`;
  const actionTitle = game.phase === 'charleston'
    ? game.charlestonAwaitingDecision ? 'Continue passing?' : game.charlestonCourtesy ? 'Choose 0–3 tiles' : `Pass ${3 - blindCount} from your rack`
    : respondingToDiscard ? 'Call, Mahjong, or pass?' : needsDraw ? 'Draw a tile' : 'Choose a discard';

  return (
    <main className="shell">
      <header className="topbar"><button className="brand brand-button" onClick={() => setStarted(false)}>The Mahjong Room</button><span className="game-label">Game {gameNumber} · Full guidance · Saved locally</span><span className="table-links"><button className="toolbar-action" aria-label={cardOpen ? 'Hide Training Card' : 'Show Training Card'} aria-expanded={cardOpen} aria-controls="training-card" onClick={() => setCardOpen((open) => !open)}><span aria-hidden="true">▤</span><b>{cardOpen ? 'Hide card' : 'Show card'}</b></button><Link className="toolbar-action" aria-label="Save progress" href="/account"><span aria-hidden="true">↗</span><b>Save progress</b></Link><button className="toolbar-action leave-action" aria-label="Leave table" onClick={() => setStarted(false)}><span aria-hidden="true">×</span><b>Leave table</b></button></span></header>
      <section className="game-table" aria-label="Guided American Mahjong table">
        <MotionConfig reducedMotion="user">
          <AnimatePresence mode="wait">
            {discardQueue[0] ? <motion.div className="discard-cinematic" key={discardQueue[0].id} role="status" aria-live="polite" aria-label={`${tileLabel(discardQueue[0])} discarded`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className="discard-spotlight" initial={{ y: 260, scale: .52, rotate: -8 }} animate={{ y: 0, scale: 1, rotate: 0 }} exit={{ y: -90, scale: .58, rotate: 4, opacity: 0 }} transition={{ duration: .36, ease: [0.22, 1, 0.36, 1] }}>
                <span className="discard-spotlight-tile"><TileFace tile={discardQueue[0]} /></span>
                <small>{tileLabel(discardQueue[0])}</small>
              </motion.div>
            </motion.div> : null}
          </AnimatePresence>
        </MotionConfig>
        <div className="opponent opponent-top"><span>June</span><small>{totalPlayerTiles(game.players[2])} tiles</small></div><div className="opponent opponent-left"><span>Mara</span><small>{totalPlayerTiles(game.players[1])} tiles</small></div><div className="opponent opponent-right"><span>Theo</span><small>{totalPlayerTiles(game.players[3])} tiles</small></div>
        <div className="table-center">
          <div className="round-status"><span className="round">East</span><div><p>{stageTitle}</p><strong>{actionTitle}</strong></div>{game.phase === 'playing' && deadHand.dead ? <div className="dead-hand-badge" role="status" title={deadHand.message}><span aria-hidden="true">×</span><div><strong>Dead hand</strong><small>Proven by discards</small></div></div> : null}</div>
          <section className="discard-board" aria-label={`Discard pool, ${visibleDiscards.length} visible tiles`}>
            <header><div><strong>Discard pool</strong><small>{game.discards.length ? `${visibleDiscards.length} placed · oldest to newest` : 'All discards will remain visible here'}</small></div><div className="suit-legend" aria-label="Number tile suits"><span><SuitIcon suit="bamboo" />Bams</span><span><SuitIcon suit="characters" />Craks</span><span><SuitIcon suit="dots" />Dots</span></div></header>
            <div className={`discard-grid ${visibleDiscards.length > 70 ? 'dense' : ''}`}>{visibleDiscards.length ? visibleDiscards.map((tile, index) => <motion.span layout className={`board-tile ${index === visibleDiscards.length - 1 ? 'latest' : ''}`} initial={{ opacity: 0, scale: .7, y: -12 }} animate={{ opacity: 1, scale: 1, y: 0 }} title={tileLabel(tile)} key={tile.id}><TileFace tile={tile} compact /></motion.span>) : <p>{game.discards.length ? 'Discard incoming…' : 'No tiles discarded yet'}</p>}</div>
          </section>
        </div>
        <aside className="coach-card"><div className="coach-eyebrow"><span>Coach</span><span>{hintLevel + 1} of 3</span></div><h1>{coachRecommendation.headline}</h1><p>{notice || coachHint}</p><div className="candidate-list">{candidates.map((candidate, index) => <div key={candidate.handId}><span>{index === 0 ? 'Best match' : 'Alternative'}</span><strong>{candidate.name}</strong><small>{candidate.matchingTileIds.length} / 14 useful</small></div>)}</div><button onClick={requestHint}>{hintLevel < 2 ? 'Show me what to notice' : 'Why these tiles?'}</button></aside>
        <div className="player-area">
          <ExposureTray players={game.players} />
          <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.7 }}>
            <div className={`rack ${draggingTileId ? 'is-reordering' : ''}`} aria-label="Your rack">
              <AnimatePresence>{draggingTileId ? <motion.div className="rack-drop-message" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}>Release beside the coral marker</motion.div> : null}</AnimatePresence>
              {orderedRack.map((tile) => {
                const cannotPassJoker = game.phase === 'charleston' && tile.type.kind === 'joker';
                const intent = dropIntent?.targetId === tile.id ? dropIntent.placement : null;
                return <motion.div className={`tile-slot ${intent ? `drop-${intent}` : ''}`} layout key={tile.id}>
                  <button className={`tile ${selected.includes(tile.id) ? 'selected' : ''} ${draggingTileId === tile.id ? 'dragging' : ''} ${cannotPassJoker ? 'cannot-pass' : ''} ${hintLevel >= 1 && coachRecommendation.tileIds.includes(tile.id) ? 'recommended' : ''} ${hintLevel >= 1 && best && !best.matchingTileIds.includes(tile.id) ? 'hinted' : ''}`} aria-label={`${tileLabel(tile)}${cannotPassJoker ? ', cannot be passed' : ''}. Drag to reorder or use Alt and arrow keys.`} aria-pressed={selected.includes(tile.id)} aria-disabled={cannotPassJoker} draggable onDragStart={(event) => { setDraggingTileId(tile.id); setDropIntent(null); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', tile.id); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; if (draggingTileId && draggingTileId !== tile.id) { const bounds = event.currentTarget.getBoundingClientRect(); const placement = event.clientX < bounds.left + bounds.width / 2 ? 'before' : 'after'; setDropIntent((current) => current?.targetId === tile.id && current.placement === placement ? current : { targetId: tile.id, placement }); } }} onDrop={(event) => { event.preventDefault(); const movingId = event.dataTransfer.getData('text/plain') || draggingTileId || ''; const placement = dropIntent?.targetId === tile.id ? dropIntent.placement : 'before'; dropTile(movingId, tile.id, placement); }} onDragEnd={() => { setDraggingTileId(null); setDropIntent(null); }} onKeyDown={(event) => { if (event.altKey && event.key === 'ArrowLeft') { event.preventDefault(); nudgeTile(tile.id, -1); } if (event.altKey && event.key === 'ArrowRight') { event.preventDefault(); nudgeTile(tile.id, 1); } }} onClick={() => cannotPassJoker ? setNotice('Jokers may be rearranged, but they cannot be passed during the Charleston.') : toggleTile(tile.id)}><span className="drag-grip" aria-hidden="true">••</span><TileFace tile={tile} /></button>
                </motion.div>;
              })}
            </div>
          </MotionConfig>
          <div className="player-controls"><p><strong>Your rack</strong><span>{game.phase === 'charleston' ? game.charlestonCourtesy ? `${selected.length} selected · optional` : `${selected.length} of ${expectedPassTiles} selected${blindCount ? ` · ${blindCount} blind` : ''}` : respondingToDiscard ? `${selected.length} selected for a call` : needsDraw ? '13 tiles · ready to draw' : `${totalPlayerTiles(human)} tiles · ${selected.length} selected`}</span></p>
            <small className="reorder-hint" id="rack-reorder-hint"><span aria-hidden="true">↔</span> Drag tiles to arrange · Alt + arrow keys</small>
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
      {cardOpen ? <TrainingCardPanel candidates={coachContext.candidates} onClose={() => setCardOpen(false)} /> : null}
    </main>
  );
}
