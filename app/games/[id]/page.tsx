'use client';
import { useAccessibility } from '../../../src/accessibility/provider';
import { Menu } from '../../../src/ui/menu';

/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors avoid a confirmed next/link runtime failure in the Sites vinext deployment. */

import { use, useEffect, useMemo, useRef, useState } from 'react';
import { DragDropProvider, PointerSensor, useDroppable } from '@dnd-kit/react';
import { PointerActivationConstraints } from '@dnd-kit/dom';
import { isSortable } from '@dnd-kit/react/sortable';
import { moveTileId, normalizeTileOrder, tileLabel } from '../../../src/game/tiles';
import { SortableRackItem } from '../../../src/game/sortable-rack-item';
import { cardTileKey } from '../../../src/game/training-card';
import type { GameAction, GameEvent } from '../../../src/game/types';
import type { GameSnapshot } from '../../../src/multiplayer/types';

import { reconcileSelection } from '../../../src/multiplayer/snapshot-sync';
import { useCloudTable } from '../../../src/multiplayer/use-cloud-table';
import { ConnectionAlert, TurnClock } from '../../../src/table/cloud-status';
import { EndGameDialog } from '../../../src/table/end-game-dialog';

import { compactTile } from '../../../src/table/tile-presentation';
import { TileFace } from '../../../src/table/tile-face';
import { getCardProvider } from '../../../src/game/cards';
import { CardCompanion, HandCheck } from '../../../src/table/card-companion';
import { TableSurface, DiscardPool, TablePrompt, RackPanel, TableHeader } from '../../../src/table/table-surface';
import { getSnapshotCoachContext } from '../../../src/coach/analyze';
import { useCoach } from '../../../src/coach/use-coach';
import { CoachPanel } from '../../../src/coach/coach-panel';
import { coachHighlightLabel, coachHighlightMark } from '../../../src/coach/highlights';



function CloudDiscardPool({ tiles, dropActive, latestTileId, canDiscard, highlightedTileIds }: { highlightedTileIds?: string[]; tiles: GameSnapshot['publicState']['discards']; dropActive: boolean; latestTileId?: string; canDiscard: boolean }) {
  const { ref, isDropTarget } = useDroppable({ id: 'discard-pool' });
  return <DiscardPool highlightedTileIds={highlightedTileIds} tiles={tiles} latestTileId={latestTileId} dropRef={ref} dropActive={dropActive || isDropTarget}>{canDiscard && tiles.length === 0 ? <small className="table-drop-hint">Drop a tile here to discard</small> : null}</DiscardPool>;
}

export default function CloudGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: gameId } = use(params);
  return <CloudGameTable key={gameId} gameId={gameId} />;
}

function CloudGameTable({ gameId }: { gameId: string }) {
  const { openSettings } = useAccessibility();
  const cloud = useCloudTable(gameId);
  const snapshot = cloud.data?.snapshot ?? null;
  const room = cloud.data?.room ?? null;
  const busy = cloud.busy;
  const online = cloud.online;
  const previousSnapshot = useRef<GameSnapshot | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [rackOrder, setRackOrder] = useState<string[]>([]);
  const [discardDropActive, setDiscardDropActive] = useState(false);
  const suppressTileClickRef = useRef(false);
  const [message, setMessage] = useState('Connecting to the table…');
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const leaveDialogRef = useRef<HTMLDialogElement>(null);
  const [resolutionNotice, setResolutionNotice] = useState<{ type: 'TURN_AUTO_RESOLVED' | 'PLAYER_CONTROL_CHANGED'; playerId: string } | null>(null);
  const lastEventSequence = useRef<number | null>(null);
  const lastConfirmedAction = useRef<string | null>(null);
  useEffect(() => {
    if (!snapshot) return;
    let savedOrder: string[] = [];
    try {
      const saved = JSON.parse(localStorage.getItem(`mahjong:cloud-rack:${gameId}:${snapshot.privateState.playerId}`) ?? '[]');
      if (Array.isArray(saved) && saved.every((id) => typeof id === 'string')) savedOrder = saved;
    } catch { /* Local preferences never block the table. */ }
    const previousSequence = lastEventSequence.current;
    if (previousSequence !== null && snapshot.eventSequence > previousSequence) {
      const resolution = [...snapshot.recentEvents].reverse().find((event): event is Extract<GameEvent, { type: 'TURN_AUTO_RESOLVED' | 'PLAYER_CONTROL_CHANGED' }> => event.sequence > previousSequence && (event.type === 'TURN_AUTO_RESOLVED' || event.type === 'PLAYER_CONTROL_CHANGED'));
      if (resolution) setResolutionNotice({ type: resolution.type, playerId: resolution.playerId });
    }
    lastEventSequence.current = snapshot.eventSequence;
    const previous = previousSnapshot.current;
    if (!previous) setMessage('');
    previousSnapshot.current = snapshot;
    setSelected((current) => reconcileSelection(current, previous, snapshot));
    setRackOrder((current) => normalizeTileOrder(current.length ? current : savedOrder, snapshot.privateState.rack));
    if (cloud.confirmedActionId && cloud.confirmedActionId !== lastConfirmedAction.current) {
      lastConfirmedAction.current = cloud.confirmedActionId;
      setSelected([]); setResolutionNotice(null); setMessage('Move saved.');
    }
  }, [snapshot, gameId, cloud.confirmedActionId]);
  useEffect(() => {
    if (!resolutionNotice) return;
    const timer = window.setTimeout(() => setResolutionNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [resolutionNotice]);

  useEffect(() => {
    const dialog = leaveDialogRef.current;
    if (leaveDialogOpen && dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [leaveDialogOpen]);

  const act = async (action: GameAction) => {
    if (!snapshot || busy) return;
    setMessage('Saving move…');
    try {
      await cloud.submit(action);
      setSelected([]); setResolutionNotice(null); setMessage('Move saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The move could not be saved.'); }
  };

  const vote = async () => {
    if (!snapshot || busy) return;
    try {
      await cloud.command(snapshot.status === 'paused' ? 'resume' : 'pause');
      setMessage(snapshot.status === 'paused' ? 'Resume vote recorded.' : 'Pause vote recorded.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The vote could not be saved.'); }
  };

  const endGameForEveryone = async () => {
    if (!snapshot || busy) return;
    try { await cloud.command('end'); setMessage('The table has ended for everyone.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'The game could not be ended.'); }
    finally { setEndDialogOpen(false); }
  };

  const requestLeaveTable = () => {
    if (snapshot?.status === 'active' || snapshot?.status === 'paused') {
      setLeaveDialogOpen(true);
      return;
    }
    window.location.assign('/games');
  };

  const confirmLeaveTable = () => {
    setLeaveDialogOpen(false);
    window.location.assign('/games');
  };

  const coachContext = useMemo(() => snapshot ? getSnapshotCoachContext(snapshot) : null, [snapshot]);
  const coachPending = snapshot?.status === 'completed' || snapshot?.status === 'abandoned' ? 'completed'
    : snapshot?.status === 'active' ? snapshot.privateState.pendingAction : 'wait';
  const coachDecision = coachPending === 'charleston_pass' ? 'charleston-pass'
    : coachPending === 'courtesy_pass' ? 'courtesy-pass' : coachPending === 'charleston_decision' ? 'charleston-decision'
    : coachPending === 'discard_response' ? 'call' : coachPending === 'completed' ? 'completed' : coachPending;
  const coach = useCoach(coachContext, `${gameId}:${snapshot?.privateState.playerId ?? 'loading'}`, coachDecision, 3, selected);

  if (!snapshot) return <main className="cloud-game-loading"><span className="brand">The Mahjong Room</span><p>{cloud.signedOut ? 'Sign in to return to this table.' : cloud.error?.message ?? (room?.status === 'lobby' ? 'The host has not started this room yet.' : message)}</p><a href="/games">Back to my games</a></main>;

  const pending = snapshot.status === 'abandoned' || snapshot.status === 'completed' ? 'completed' : snapshot.status === 'paused' ? 'wait' : snapshot.privateState.pendingAction;
  const current = snapshot.publicState.players[snapshot.publicState.turnIndex];
  const latestResolution = [...snapshot.recentEvents].reverse().find((event) => event.type === 'TURN_AUTO_RESOLVED' || event.type === 'PLAYER_CONTROL_CHANGED' || event.type === 'GAME_ABANDONED');
  const isTerminal = snapshot.status === 'completed' || snapshot.status === 'abandoned';
  const winner = snapshot.publicState.players.find((player) => player.id === snapshot.publicState.winnerId) ?? null;
  const winnerRack = winner?.revealedRack ?? (winner?.id === snapshot.privateState.playerId ? snapshot.privateState.rack : null);
  const winningValidation = winner && winnerRack
    ? getCardProvider(snapshot.publicState.cardId).validateMahjong([...winnerRack, ...winner.exposures.flatMap((exposure) => exposure.tiles)], winner.exposures)
    : null;
  const winningLine = winningValidation?.handId
    ? getCardProvider(snapshot.publicState.cardId).getHands().find((hand) => hand.id === winningValidation.handId) ?? null
    : null;
  const terminalOutcome = snapshot.status === 'completed'
    ? winner ? `${winner.name} called Mahjong.` : 'The wall ran out. The game ended without a winner.'
    : latestResolution?.type === 'GAME_ABANDONED' && latestResolution.reason === 'host_ended'
      ? 'The host ended this table.'
      : 'This table stopped because no human seats remained.';
  const finalRacks = snapshot.publicState.players.map((player) => ({
    player,
    tiles: player.revealedRack ?? (player.id === snapshot.privateState.playerId ? snapshot.privateState.rack : null),
  }));
  const isHost = Boolean(room && room.ownerId === room.players.find((player) => player.playerKey === snapshot.privateState.playerId)?.userId);
  const orderedRack = (() => {
    const order = normalizeTileOrder(rackOrder, snapshot.privateState.rack);
    const byId = new Map(snapshot.privateState.rack.map((tile) => [tile.id, tile]));
    return order.flatMap((tileId) => byId.get(tileId) ?? []);
  })();
  const jokerExchanges = pending === 'discard' ? snapshot.publicState.players.flatMap((owner) => owner.exposures.flatMap((exposure) => {
    const joker = exposure.tiles.find((tile) => tile.type.kind === 'joker');
    const natural = exposure.tiles.find((tile) => tile.type.kind !== 'joker');
    if (!joker || !natural) return [];
    const rackTile = snapshot.privateState.rack.find((tile) => tile.type.kind !== 'joker' && cardTileKey(tile) === cardTileKey(natural));
    return rackTile ? [{ owner, exposure, joker, rackTile }] : [];
  })) : [];
  const toggle = (tileId: string) => { setMessage(''); setSelected((values) => values.includes(tileId) ? values.filter((id) => id !== tileId) : [...values, tileId].slice(-5)); };
  const moveTile = (tileId: string, offset: -1 | 1) => {
    const next = moveTileId(normalizeTileOrder(rackOrder, snapshot.privateState.rack), tileId, offset);
    setRackOrder(next);
    try { localStorage.setItem(`mahjong:cloud-rack:${gameId}:${snapshot.privateState.playerId}`, JSON.stringify(next)); } catch { /* In-memory ordering still works. */ }
    setMessage('Rack order updated. This only changes your view.');
  };
  const discardDraggedTile = (tileId: string) => {
    if (pending !== 'discard' || busy) return;
    void act({ type: 'DISCARD_TILE', tileId });
    setDiscardDropActive(false);
  };

  return (
    <main className={`cloud-game-page shared-table-page unified-game ${cardOpen && !isTerminal ? 'card-is-open' : ''}`}>
      <TableHeader brand={<a className="brand" href="/">The Mahjong Room</a>} context={snapshot.mode === 'live' ? 'Live table' : 'Time-based table'}>
        {!isTerminal ? <button className="table-tool-button" aria-expanded={cardOpen} onClick={() => setCardOpen(open => !open)}>{snapshot.publicState.cardId === 'photo-2025' ? '2025 Card' : 'Training Card'}</button> : null}
        <Menu label="Table" note={`${online} online`} items={[{ label: 'Accessibility', onClick: openSettings }, { label: 'Tutorial ↗', href: '/learn', newTab: true }, { label: 'Rules ↗', href: '/rules', newTab: true }, ...(isHost && (snapshot.status === 'active' || snapshot.status === 'paused') ? [{ label: 'End game', onClick: () => setEndDialogOpen(true), disabled: busy }] : []), { label: 'Leave table', onClick: requestLeaveTable }]} />
      </TableHeader>
      {endDialogOpen ? <EndGameDialog busy={busy} onCancel={() => setEndDialogOpen(false)} onConfirm={() => void endGameForEveryone()} /> : null}
      {leaveDialogOpen ? <dialog ref={leaveDialogRef} className="leave-dialog" aria-labelledby="leave-dialog-title" aria-describedby="leave-dialog-description" onCancel={(event) => { event.preventDefault(); setLeaveDialogOpen(false); }} onClick={(event) => { if (event.target === event.currentTarget) setLeaveDialogOpen(false); }}>
          <h2 id="leave-dialog-title">Leave this table?</h2>
          <p id="leave-dialog-description">The game will continue without you. Your seat stays available for two minutes while you can reconnect; after that, a bot takes over and the other players see that you disconnected.</p>
          <div><button type="button" className="secondary" autoFocus onClick={() => setLeaveDialogOpen(false)}>Stay</button><button type="button" className="leave-confirm-action" onClick={confirmLeaveTable}>Leave table</button></div>
      </dialog> : null}

      {resolutionNotice?.type === 'TURN_AUTO_RESOLVED' ? <div className="game-resolution" role="status">{snapshot.publicState.players.find((player) => player.id === resolutionNotice.playerId)?.name ?? 'A player'}&apos;s move timed out and was selected automatically.</div> : null}
      {resolutionNotice?.type === 'PLAYER_CONTROL_CHANGED' ? <div className="game-resolution" role="status">{snapshot.publicState.players.find((player) => player.id === resolutionNotice.playerId)?.name ?? 'A player'} did not return during the two-minute grace period. A bot now controls that seat.</div> : null}
      {isTerminal ? <section className={`game-over-banner ${winner ? 'has-winner' : ''}`} aria-labelledby="game-over-title">
        {winner ? <div className="mahjong-celebration" aria-hidden="true"><i /><i /><i /></div> : null}
        <div><p className="kicker">Game over</p><h2 id="game-over-title">{terminalOutcome}</h2><p>{snapshot.status === 'completed' ? winner ? 'The final table state is ready to review.' : 'All tiles were drawn; no winner was declared.' : 'No further moves can be made at this table.'}</p></div>
        <nav aria-label="Game over actions"><a className="game-review-link" href="#game-review">Review game</a><a className="game-list-link" href="/games">My games · Start another</a></nav>
      </section> : null}
      {isTerminal ? <section className="cloud-game-review" id="game-review" aria-labelledby="cloud-review-title">
        <div className="cloud-review-heading"><div><p className="kicker">Final table</p><h2 id="cloud-review-title">Game review</h2></div><p>{terminalOutcome}</p></div>
        {winningLine ? <article className="winning-line-card"><p className="kicker">Winning line · Selected game card</p><h3>{winningLine.name}</h3><p>{winningLine.section} · {winningLine.exposure === 'concealed' ? 'Concealed' : 'Exposed'}</p><small>{winningLine.description}</small></article> : winner ? <p className="review-note">The winner was confirmed by the game rules. A matching Training Card line was not included in this saved result.</p> : null}
        <div className="review-racks">{finalRacks.map(({ player, tiles }) => <article key={player.id} className={player.id === winner?.id ? 'review-winner' : ''}><div><strong>{player.name}{player.id === winner?.id ? ' · Winner' : ''}</strong><small>{tiles ? `${tiles.length + player.exposures.reduce((count, exposure) => count + exposure.tiles.length, 0)} final tiles` : 'Concealed rack'}</small></div>{tiles ? <HandCheck cardId={snapshot.publicState.cardId} rack={tiles} exposures={player.exposures} storageKey={`${gameId}:${player.id}`} /> : <p className="review-note">This rack remains concealed because the table ended before the hand was completed.</p>}</article>)}</div>
        <article className="review-discard-record"><div><strong>Discarded tiles</strong><small>{snapshot.publicState.discards.length} total</small></div>{snapshot.publicState.discards.length ? <div className="review-tile-row">{snapshot.publicState.discards.map((tile) => <span key={tile.id} title={tileLabel(tile)}>{compactTile(tile)}</span>)}</div> : <p className="review-note">No tiles were discarded.</p>}</article>
        <div className="review-next-actions"><a href="/games">Return to My Games</a><a className="primary" href="/games">Start another game</a></div>
      </section> : null}
      {snapshot.status === 'active' ? <ConnectionAlert room={room} /> : null}
      <section className="game-table" aria-label="Multiplayer Mahjong table">
      <DragDropProvider
        sensors={(defaults) => [
          ...defaults.filter((sensor) => sensor !== PointerSensor),
          PointerSensor.configure({
            activationConstraints(event) {
              return event.pointerType === 'touch'
                ? [new PointerActivationConstraints.Delay({ value: 200, tolerance: { x: 8, y: 8 } })]
                : [new PointerActivationConstraints.Distance({ value: 5 })];
            },
            preventActivation(event) {
              return event.pointerType === 'touch'
                && !(event.target instanceof Element && event.target.closest('[data-drag-handle]'));
            },
          }),
        ]}
        onDragStart={() => {
          suppressTileClickRef.current = true;
        }}
        onDragMove={(event) => {
          setDiscardDropActive(event.operation.target?.id === 'discard-pool' && pending === 'discard' && !busy);
        }}
        onDragEnd={(event) => {
          const { source, target } = event.operation;
          if (!event.canceled && source && isSortable(source)) {
            if (target?.id === 'discard-pool') {
              discardDraggedTile(String(source.id));
            } else if (source.index !== source.initialIndex) {
              const next = normalizeTileOrder(rackOrder, snapshot.privateState.rack);
              const [movingId] = next.splice(source.initialIndex, 1);
              if (movingId) {
                next.splice(Math.max(0, Math.min(source.index, next.length)), 0, movingId);
                setRackOrder(next);
                try { localStorage.setItem(`mahjong:cloud-rack:${gameId}:${snapshot.privateState.playerId}`, JSON.stringify(next)); } catch { /* In-memory ordering still works. */ }
                setMessage('Rack order updated. This only changes your view.');
              }
            }
          }
          setDiscardDropActive(false);
          window.setTimeout(() => { suppressTileClickRef.current = false; }, 0);
        }}
      >
      <TableSurface highlightedTileIds={coach.highlights.publicTileIds} players={snapshot.publicState.players} viewerId={snapshot.privateState.playerId} activePlayerIds={isTerminal || snapshot.status === 'paused' ? [] : snapshot.publicState.phase === 'charleston' ? snapshot.publicState.charlestonActorId ? [snapshot.publicState.charlestonActorId] : pending !== 'wait' ? [snapshot.privateState.playerId] : [] : snapshot.publicState.callWindow ? pending === 'discard_response' ? [snapshot.privateState.playerId] : [] : current ? [current.id] : []} wallCount={snapshot.publicState.wallCount} discardCount={snapshot.publicState.discards.length}>
        <CloudDiscardPool highlightedTileIds={coach.highlights.publicTileIds} tiles={snapshot.publicState.discards} latestTileId={snapshot.publicState.callWindow?.discard.id} dropActive={discardDropActive} canDiscard={pending === 'discard'} />
      </TableSurface>
      <RackPanel className="cloud-rack-section play-workspace">
      <TablePrompt title={snapshot.status === 'abandoned' ? 'Table ended' : snapshot.status === 'completed' ? 'Game complete' : snapshot.status === 'paused' ? 'Table paused' : pending === 'wait' ? `${current?.name ?? 'The table'} is playing` : 'Your move'} detail={snapshot.status === 'abandoned' ? 'No active decisions' : pending === 'charleston_pass' ? 'Choose three tiles to pass' : pending === 'courtesy_pass' ? 'Choose zero to three tiles for courtesy passing' : pending === 'charleston_decision' ? 'Continue the second Charleston or move to courtesy passing' : pending === 'discard_response' ? 'Call the latest discard, declare Mahjong, or pass' : pending === 'draw' ? 'Draw a tile from the wall' : pending === 'discard' ? 'Choose one tile to discard' : pending === 'wait' ? 'You can arrange your rack while you wait' : 'Review the final table'} active={!isTerminal && snapshot.status === 'active' && pending !== 'wait'}>
        {!isTerminal ? <TurnClock deadlineAt={snapshot.deadlineAt} charleston={snapshot.publicState.phase === 'charleston'} /> : null}
        {snapshot.mode === 'live' && (snapshot.status === 'active' || snapshot.status === 'paused') ? <button disabled={busy} onClick={() => void vote()}>{snapshot.status === 'paused' ? 'Vote to resume' : 'Vote to pause'}</button> : null}
      </TablePrompt>
        <div className="cloud-actions">
        <div className="cloud-rack-heading"><strong>Your rack</strong><span>{isTerminal ? 'Final rack' : selected.length ? `${selected.length} selected` : 'Select tiles to act'}</span></div>
          {pending === 'charleston_pass' ? <button disabled={busy || selected.length !== 3} onClick={() => void act({ type: 'PASS_TILES', tileIds: selected })}>Pass three tiles</button> : null}
          {pending === 'courtesy_pass' ? <button disabled={busy || selected.length > 3} onClick={() => void act({ type: 'COURTESY_PASS', tileIds: selected })}>Pass {selected.length || 'no'} tiles</button> : null}
          {pending === 'charleston_decision' ? <><button disabled={busy} onClick={() => void act({ type: 'CHOOSE_SECOND_CHARLESTON', continue: true })}>Continue Charleston</button><button className="secondary" disabled={busy} onClick={() => void act({ type: 'CHOOSE_SECOND_CHARLESTON', continue: false })}>Move to courtesy pass</button></> : null}
          {pending === 'draw' ? <button disabled={busy} onClick={() => void act({ type: 'DRAW_TILE' })}>Draw tile</button> : null}
          {pending === 'discard' ? <><button className="discard-action" disabled={busy || selected.length !== 1} onClick={() => void act({ type: 'DISCARD_TILE', tileId: selected[0] })}>Discard selected tile</button><button className="mahjong" disabled={busy} onClick={() => void act({ type: 'DECLARE_MAHJONG' })}>Declare Mahjong</button></> : null}
          {pending === 'discard_response' ? <><button disabled={busy || selected.length < 2} onClick={() => void act({ type: 'CALL_TILE', rackTileIds: selected })}>Call with selected tiles</button><button className="secondary" disabled={busy} onClick={() => void act({ type: 'PASS_ON_DISCARD' })}>Pass</button><button className="mahjong" disabled={busy} onClick={() => void act({ type: 'DECLARE_MAHJONG', useDiscard: true })}>Mahjong</button></> : null}
          {pending === 'wait' ? <span>Waiting for the next move.</span> : null}
        </div>

<div className="cloud-rack" role="group" aria-label="Your rack">{orderedRack.map((tile, index) => {
          return <SortableRackItem id={tile.id} index={index} disabled={busy || isTerminal} className="cloud-tile-slot" key={tile.id}>
            {({ isDragging, handleRef }) => <>
              <button ref={handleRef} data-drag-handle className={`cloud-tile ${selected.includes(tile.id) ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${coach.highlights.rack[tile.id] ? `coach-tile-${coach.highlights.rack[tile.id]}` : ''}`} disabled={busy || isTerminal} aria-describedby="cloud-rack-help" aria-pressed={selected.includes(tile.id)} aria-label={`${tileLabel(tile)}${coach.highlights.rack[tile.id] ? `, ${coachHighlightLabel(coach.highlights.rack[tile.id])}` : ''}. Hold and drag to reorder.`} title={tileLabel(tile)} onKeyDown={(event) => { if (event.altKey && event.key === 'ArrowLeft') { event.preventDefault(); moveTile(tile.id, -1); } if (event.altKey && event.key === 'ArrowRight') { event.preventDefault(); moveTile(tile.id, 1); } }} onClick={() => { if (suppressTileClickRef.current) return; toggle(tile.id); }}><TileFace tile={tile} />{coach.highlights.rack[tile.id] ? <span className="coach-tile-mark" aria-hidden="true">{coachHighlightMark(coach.highlights.rack[tile.id])}</span> : null}</button>
            </>}
          </SortableRackItem>;
        })}</div>
        <small className="cloud-rack-help" id="cloud-rack-help">Drag to arrange · Alt + arrow keys. Hold a tile to drag on touch.</small>
{!isTerminal && coach.session ? <CoachPanel session={coach.session} show={coach.show} onShowChange={coach.setShow} focusGroupId={coach.focusGroupId} onFocusGroup={coach.focusGroup} onFollow={coach.follow} onBrowse={() => setCardOpen(true)} /> : null}
        {jokerExchanges.length ? <div className="cloud-exchange-row"><span>Joker available:</span>{jokerExchanges.map((option) => <button disabled={busy} onClick={() => void act({ type: 'EXCHANGE_JOKER', exposureOwnerId: option.owner.id, exposureId: option.exposure.id, rackTileId: option.rackTile.id, jokerTileId: option.joker.id })} key={`${option.exposure.id}-${option.rackTile.id}`}>Swap {compactTile(option.rackTile)} for {option.owner.name}&apos;s Joker</button>)}</div> : null}
        {selected.length === 1 ? <div className="cloud-rack-order-actions" role="group" aria-label="Reorder selected tile"><button className="secondary" aria-label="Move selected tile left" disabled={busy || orderedRack.findIndex((tile) => tile.id === selected[0]) <= 0} onClick={() => moveTile(selected[0], -1)}><span aria-hidden="true">←</span> Move left</button><button className="secondary" aria-label="Move selected tile right" disabled={busy || orderedRack.findIndex((tile) => tile.id === selected[0]) === orderedRack.length - 1} onClick={() => moveTile(selected[0], 1)}>Move right <span aria-hidden="true">→</span></button></div> : null}

        {message ? <p className="cloud-message" role="status" aria-live="polite">{cloud.uncertain ? 'Reconnecting to confirm your saved move…' : cloud.error?.message ?? message}</p> : null}
        {!isTerminal ? <CardCompanion blockedHandIds={coach.session?.plan.blockedHandIds} highlightedGroupIds={coach.highlights.groupIds} candidates={coachContext!.candidates} cardId={snapshot.publicState.cardId} rack={snapshot.privateState.rack} exposures={snapshot.publicState.players.find(player => player.id === snapshot.privateState.playerId)?.exposures ?? []} storageKey={`${gameId}:${snapshot.privateState.playerId}`} open={cardOpen} onOpenChange={setCardOpen} onArrange={(ids) => { setRackOrder(ids); try { localStorage.setItem(`mahjong:cloud-rack:${gameId}:${snapshot.privateState.playerId}`, JSON.stringify(ids)); } catch { /* In-memory order still works. */ } setMessage('Rack arranged by your followed hand. Unmatched tiles are at the end.'); }} /> : null}
      </RackPanel>
      </DragDropProvider>
      </section>
    </main>
  );
}
