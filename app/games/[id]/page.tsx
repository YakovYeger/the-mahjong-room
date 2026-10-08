'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { moveTileId, normalizeTileOrder, placeTileId, tileLabel } from '../../../src/game/tiles';
import { cardTileKey, TrainingCardProvider } from '../../../src/game/training-card';
import type { GameAction, Tile } from '../../../src/game/types';
import { createSupabaseBrowserClient } from '../../../src/lib/supabase/client';
import type { GameSnapshot, RoomDetails } from '../../../src/multiplayer/types';

const cloudTrainingHands = TrainingCardProvider.getHands();

function compactTile(tile: Tile) {
  if (tile.type.kind === 'number') return `${tile.type.rank}${tile.type.suit === 'bamboo' ? 'B' : tile.type.suit === 'characters' ? 'C' : 'D'}`;
  if (tile.type.kind === 'wind') return tile.type.wind[0].toUpperCase();
  if (tile.type.kind === 'dragon') return `${tile.type.dragon[0].toUpperCase()}D`;
  if (tile.type.kind === 'flower') return 'F';
  return '★';
}

function errorMessage(data: unknown) {
  const value = data as { error?: { message?: string } };
  return value?.error?.message ?? 'Please try again.';
}

export default function CloudGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: gameId } = use(params);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [rackOrder, setRackOrder] = useState<string[]>([]);
  const [draggingTileId, setDraggingTileId] = useState<string | null>(null);
  const [dropIntent, setDropIntent] = useState<{ targetId: string; placement: 'before' | 'after' } | null>(null);
  const [discardDropActive, setDiscardDropActive] = useState(false);
  const [message, setMessage] = useState('Connecting to the table…');
  const [busy, setBusy] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const leaveDialogRef = useRef<HTMLDialogElement>(null);
  const [online, setOnline] = useState(1);
  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    const response = await fetch(`/api/games/${gameId}/snapshot`, { cache: 'no-store' });
    const data = await response.json() as { snapshot?: GameSnapshot; room?: RoomDetails };
    if (!response.ok) throw new Error(errorMessage(data));
    if (!data.snapshot) throw new Error('The host has not started this room yet.');
    let savedOrder: string[] = [];
    try {
      const saved = localStorage.getItem(`mahjong:cloud-rack:${gameId}`);
      if (saved) savedOrder = JSON.parse(saved) as string[];
    } catch { /* A local rack preference never blocks reconnecting. */ }
    setRackOrder((current) => normalizeTileOrder(current.length ? current : savedOrder, data.snapshot!.privateState.rack));
    setSnapshot(data.snapshot);
    if (data.room) setRoom(data.room);
    setSelected([]);
    setMessage('');
  }, [gameId]);

  useEffect(() => { queueMicrotask(() => void refresh().catch((error) => setMessage(error.message))); }, [refresh]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);

  useEffect(() => {
    const dialog = leaveDialogRef.current;
    if (leaveDialogOpen && dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [leaveDialogOpen]);

  useEffect(() => {
    if (!gameId || !snapshot || snapshot.status !== 'active') return;
    let stopped = false;
    const heartbeat = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const response = await fetch(`/api/games/${gameId}/heartbeat`, { method: 'POST', cache: 'no-store' });
        const data = await response.json() as { room?: RoomDetails };
        if (!stopped && data.room) setRoom(data.room);
        if (response.status === 409) await refresh().catch(() => undefined);
      } catch { /* The last saved heartbeat remains authoritative until the grace window ends. */ }
    };
    void heartbeat();
    const timer = window.setInterval(() => void heartbeat(), 20_000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [gameId, refresh, snapshot?.status]);

  useEffect(() => {
    if (!supabase || !gameId || !snapshot) return;
    const channel = supabase.channel(`game:${gameId}`, { config: { private: true, presence: { key: snapshot.privateState.playerId } } });
    channel
      .on('broadcast', { event: 'game.updated' }, (event) => {
        const version = Number((event.payload as { stateVersion?: number })?.stateVersion ?? 0);
        if (version > snapshot.stateVersion) void refresh().catch((error) => setMessage(error.message));
      })
      .on('presence', { event: 'sync' }, () => setOnline(Object.keys(channel.presenceState()).length))
      .subscribe((status) => { if (status === 'SUBSCRIBED') void channel.track({ onlineAt: new Date().toISOString() }); });
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh().catch(() => undefined); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); void supabase.removeChannel(channel); };
  }, [gameId, refresh, snapshot, supabase]);

  const act = async (action: GameAction) => {
    if (!snapshot || !gameId || busy) return;
    setBusy(true); setMessage('Saving move…');
    try {
      const response = await fetch(`/api/games/${gameId}/actions`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ actionId: crypto.randomUUID(), expectedStateVersion: snapshot.stateVersion, action }),
      });
      const data = await response.json() as { snapshot?: GameSnapshot };
      if (!response.ok) {
        const explanation = errorMessage(data);
        if (response.status === 409) await refresh().catch(() => undefined);
        setMessage(explanation);
      } else if (data.snapshot) {
        setRackOrder((current) => normalizeTileOrder(current, data.snapshot!.privateState.rack));
        setSnapshot(data.snapshot); setSelected([]); setMessage('Move saved.');
      } else {
        setMessage('The table did not confirm that move. Refresh and try again.');
      }
    } catch {
      try {
        await refresh();
        setMessage('Move could not be confirmed. The table has been refreshed; choose your next move.');
      } catch {
        setMessage('Connection lost. Your selection is still here; reconnect before sending the move again.');
      }
    } finally { setBusy(false); }
  };

  const vote = async () => {
    if (!snapshot || !gameId) return;
    const response = await fetch(`/api/games/${gameId}/pause-votes`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ vote: snapshot.status === 'paused' ? 'resume' : 'pause' }) });
    const data = await response.json();
    setMessage(response.ok ? (snapshot.status === 'paused' ? 'Resume vote recorded.' : 'Pause vote recorded.') : errorMessage(data));
    if (response.ok) await refresh().catch(() => undefined);
  };

  const endGameForEveryone = async () => {
    if (!snapshot || !gameId || busy || !window.confirm('End this game for everyone? Players will see that the table has ended, and no one can continue it.')) return;
    setBusy(true); setMessage('Ending game…');
    try {
      const response = await fetch(`/api/games/${gameId}/end`, { method: 'POST' });
      const data = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? 'The game could not be ended.');
      await refresh();
      setMessage('The table has ended for everyone.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The game could not be ended.'); }
    finally { setBusy(false); }
  };

  const copyInviteLink = async () => {
    if (!room?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(`${location.origin}/games?join=${room.inviteCode}`);
      setMessage('Invite link copied.');
    } catch { setMessage('Copy failed. Invite code: ' + room.inviteCode); }
  };

  const requestLeaveTable = () => {
    if (snapshot.status === 'active' || snapshot.status === 'paused') {
      setLeaveDialogOpen(true);
      return;
    }
    window.location.assign('/games');
  };

  const confirmLeaveTable = () => {
    setLeaveDialogOpen(false);
    window.location.assign('/games');
  };

  if (!snapshot) return <main className="cloud-game-loading"><span className="brand">The Mahjong Room</span><p>{message}</p><a href="/games">Back to my games</a></main>;

  const me = snapshot.publicState.players.find((player) => player.id === snapshot.privateState.playerId);
  const pending = snapshot.status === 'abandoned' || snapshot.status === 'completed' ? 'completed' : snapshot.status === 'paused' ? 'wait' : snapshot.privateState.pendingAction;
  const remaining = snapshot.deadlineAt ? Math.max(0, Math.ceil((new Date(snapshot.deadlineAt).getTime() - now) / 1000)) : null;
  const remainingLabel = remaining === null ? 'No clock running' : remaining >= 3600 ? `${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m` : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  const current = snapshot.publicState.players[snapshot.publicState.turnIndex];
  const latestResolution = [...snapshot.recentEvents].reverse().find((event) => event.type === 'TURN_AUTO_RESOLVED' || event.type === 'PLAYER_CONTROL_CHANGED' || event.type === 'GAME_ABANDONED');
  const isTerminal = snapshot.status === 'completed' || snapshot.status === 'abandoned';
  const winner = snapshot.publicState.players.find((player) => player.id === snapshot.publicState.winnerId) ?? null;
  const winnerRack = winner?.revealedRack ?? (winner?.id === snapshot.privateState.playerId ? snapshot.privateState.rack : null);
  const winningValidation = winner && winnerRack
    ? TrainingCardProvider.validateMahjong([...winnerRack, ...winner.exposures.flatMap((exposure) => exposure.tiles)], winner.exposures)
    : null;
  const winningLine = winningValidation?.handId
    ? cloudTrainingHands.find((hand) => hand.id === winningValidation.handId) ?? null
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
  const disconnectedPlayers = (room?.players ?? []).filter((player) => {
    if (player.controllerType !== 'human' || player.joinStatus === 'replaced') return false;
    return player.joinStatus === 'disconnected' || now - Date.parse(player.lastActivityAt) >= 35_000;
  });
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
    try { localStorage.setItem(`mahjong:cloud-rack:${gameId}`, JSON.stringify(next)); } catch { /* In-memory ordering still works. */ }
    setMessage('Rack order updated. This only changes your view.');
  };
  const placeTile = (movingId: string, targetId: string, placement: 'before' | 'after') => {
    const next = placeTileId(normalizeTileOrder(rackOrder, snapshot.privateState.rack), movingId, targetId, placement);
    setRackOrder(next);
    try { localStorage.setItem(`mahjong:cloud-rack:${gameId}`, JSON.stringify(next)); } catch { /* In-memory ordering still works. */ }
    setMessage('Rack order updated. This only changes your view.');
  };
  const discardDraggedTile = (tileId: string) => {
    if (pending !== 'discard' || busy) return;
    void act({ type: 'DISCARD_TILE', tileId });
    setDraggingTileId(null); setDiscardDropActive(false); setDropIntent(null);
  };

  return (
    <main className="cloud-game-page">
      <header><a className="brand" href="/">The Mahjong Room</a><div><span className="live-dot" /> {online} online</div><strong>{snapshot.mode === 'live' ? 'Live table' : 'Time-based table'}</strong>{room?.inviteCode && snapshot.status !== 'completed' && snapshot.status !== 'abandoned' ? <button className="table-invite-action" onClick={() => void copyInviteLink()}>Invite · {room.inviteCode}</button> : null}{isHost && (snapshot.status === 'active' || snapshot.status === 'paused') ? <button className="host-end-action" onClick={() => void endGameForEveryone()} disabled={busy}>End game</button> : null}<button type="button" className="leave-table-action" onClick={requestLeaveTable}>Leave table</button></header>
      {leaveDialogOpen ? <dialog ref={leaveDialogRef} className="leave-dialog" aria-labelledby="leave-dialog-title" aria-describedby="leave-dialog-description" onCancel={(event) => { event.preventDefault(); setLeaveDialogOpen(false); }} onClick={(event) => { if (event.target === event.currentTarget) setLeaveDialogOpen(false); }}>
          <h2 id="leave-dialog-title">Leave this table?</h2>
          <p id="leave-dialog-description">The game will continue without you. Your seat stays available for two minutes while you can reconnect; after that, a bot takes over and the other players see that you disconnected.</p>
          <div><button type="button" className="secondary" autoFocus onClick={() => setLeaveDialogOpen(false)}>Stay</button><button type="button" className="leave-confirm-action" onClick={confirmLeaveTable}>Leave table</button></div>
      </dialog> : null}
      <section className="cloud-status"><div><p className="kicker">{snapshot.status}</p><h1>{snapshot.status === 'abandoned' ? 'Table ended' : snapshot.status === 'completed' ? 'Game complete' : snapshot.status === 'paused' ? 'Table paused' : pending === 'wait' ? `${current?.name ?? 'The table'} is playing` : 'Your move'}</h1><p>{snapshot.status === 'abandoned' ? 'No active decisions' : pending.replaceAll('_', ' ')}</p></div><div className="turn-clock"><span>{snapshot.publicState.phase === 'charleston' ? 'Charleston' : 'Time remaining'}</span><strong>{snapshot.publicState.phase === 'charleston' ? 'Untimed' : remainingLabel}</strong></div>{snapshot.mode === 'live' && (snapshot.status === 'active' || snapshot.status === 'paused') ? <button onClick={() => void vote()}>{snapshot.status === 'paused' ? 'Vote to resume' : 'Vote to pause'}</button> : null}</section>
      {latestResolution?.type === 'TURN_AUTO_RESOLVED' ? <div className="game-resolution" role="status">Time expired. {snapshot.publicState.players.find((player) => player.id === latestResolution.playerId)?.name ?? 'A player'}'s legal move was selected automatically.</div> : null}
      {latestResolution?.type === 'PLAYER_CONTROL_CHANGED' ? <div className="game-resolution" role="status">{snapshot.publicState.players.find((player) => player.id === latestResolution.playerId)?.name ?? 'A player'} did not return during the two-minute grace period. A bot now controls that seat.</div> : null}
      {isTerminal ? <section className={`game-over-banner ${winner ? 'has-winner' : ''}`} aria-labelledby="game-over-title">
        {winner ? <div className="mahjong-celebration" aria-hidden="true"><i /><i /><i /></div> : null}
        <div><p className="kicker">Game over</p><h2 id="game-over-title">{terminalOutcome}</h2><p>{snapshot.status === 'completed' ? winner ? 'The final table state is ready to review.' : 'All tiles were drawn; no winner was declared.' : 'No further moves can be made at this table.'}</p></div>
        <nav aria-label="Game over actions"><a className="game-review-link" href="#game-review">Review game</a><a className="game-list-link" href="/games">My games · Start another</a></nav>
      </section> : null}
      {isTerminal ? <section className="cloud-game-review" id="game-review" aria-labelledby="cloud-review-title">
        <div className="cloud-review-heading"><div><p className="kicker">Final table</p><h2 id="cloud-review-title">Game review</h2></div><p>{terminalOutcome}</p></div>
        {winningLine ? <article className="winning-line-card"><p className="kicker">Winning line · Original Training Card</p><h3>{winningLine.name}</h3><p>{winningLine.section} · {winningLine.exposure === 'concealed' ? 'Concealed' : 'Exposed'}</p><small>{winningLine.description}</small></article> : winner ? <p className="review-note">The winner was confirmed by the game rules. A matching Training Card line was not included in this saved result.</p> : null}
        <div className="review-racks">{finalRacks.map(({ player, tiles }) => <article key={player.id} className={player.id === winner?.id ? 'review-winner' : ''}><div><strong>{player.name}{player.id === winner?.id ? ' · Winner' : ''}</strong><small>{tiles ? `${tiles.length} tiles in final rack` : 'Concealed rack'}</small></div>{tiles ? <div className="review-tile-row">{tiles.map((tile) => <span key={tile.id} title={tileLabel(tile)}>{compactTile(tile)}</span>)}</div> : <p className="review-note">This rack remains concealed because the table ended before the hand was completed.</p>}{player.exposures.length ? <div className="review-exposures"><strong>Exposures</strong>{player.exposures.map((exposure) => <p key={exposure.id}>{exposure.kind}: {exposure.tiles.map(compactTile).join(' ')}</p>)}</div> : null}</article>)}</div>
        <article className="review-discard-record"><div><strong>Discarded tiles</strong><small>{snapshot.publicState.discards.length} total</small></div>{snapshot.publicState.discards.length ? <div className="review-tile-row">{snapshot.publicState.discards.map((tile) => <span key={tile.id} title={tileLabel(tile)}>{compactTile(tile)}</span>)}</div> : <p className="review-note">No tiles were discarded.</p>}</article>
        <div className="review-next-actions"><a href="/games">Return to My Games</a><a className="primary" href="/games">Start another game</a></div>
      </section> : null}
      {disconnectedPlayers.length ? <div className="connection-alert" role="status">{disconnectedPlayers.map((player) => {
        const secondsLeft = Math.max(0, Math.ceil((Date.parse(player.lastActivityAt) + 120_000 - now) / 1000));
        return <p key={player.playerKey}><strong>{player.displayName}</strong> is disconnected. A bot takes over in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')} if they do not return.</p>;
      })}</div> : null}
      <section className="cloud-board">
        <div className="opponent-grid">{snapshot.publicState.players.filter((player) => player.id !== me?.id).map((player) => <article key={player.id}><div><strong>{player.name}</strong><small>{player.seat} · {player.rackCount} concealed</small></div>{player.revealedRack ? <div className="revealed-cloud-rack">{player.revealedRack.map((tile) => <span title={tileLabel(tile)} key={tile.id}>{compactTile(tile)}</span>)}</div> : <div className="rack-backs">{Array.from({ length: player.rackCount }, (_, index) => <i key={index} />)}</div>}{player.exposures.length ? <div className="cloud-exposures">{player.exposures.map((exposure) => <span key={exposure.id}>{exposure.kind}: {exposure.tiles.map(compactTile).join(' ')}</span>)}</div> : null}</article>)}</div>
        <div className={`cloud-discard-pool ${discardDropActive ? 'drop-target-active' : ''}`} onDragOver={(event) => { if (pending === 'discard' && draggingTileId) { event.preventDefault(); setDiscardDropActive(true); } }} onDragLeave={() => setDiscardDropActive(false)} onDrop={(event) => { event.preventDefault(); const tileId = event.dataTransfer.getData('text/plain') || draggingTileId; if (tileId) discardDraggedTile(tileId); }}><div className="wall-counter"><strong>{snapshot.publicState.wallCount}</strong><span>tiles in wall</span></div><div className="cloud-discards">{snapshot.publicState.discards.map((tile) => <span title={tileLabel(tile)} key={tile.id}>{compactTile(tile)}</span>)}</div>{snapshot.publicState.callWindow ? <div className="call-focus"><small>Latest discard</small><strong>{compactTile(snapshot.publicState.callWindow.discard)}</strong><span>{snapshot.publicState.callWindow.responseCount} responded</span></div> : null}{pending === 'discard' ? <small className="discard-drop-hint">Drop a tile here to discard</small> : null}</div>
      </section>
      <section className="cloud-rack-section"><div className="cloud-rack-heading"><div><p className="kicker">Your rack · {me?.seat}</p><strong>{me?.name}</strong></div><span>{selected.length ? `${selected.length} selected` : 'Select tiles to act'}</span></div><small className="cloud-rack-help" id="cloud-rack-help">Select tiles to act. Use Move left/right or Alt + arrow keys to arrange; drag a tile onto the discard area to discard.</small><div className={`cloud-rack ${draggingTileId ? 'is-reordering' : ''}`} role="group" aria-label="Your rack" onDragEnd={() => { setDraggingTileId(null); setDiscardDropActive(false); setDropIntent(null); }}>{orderedRack.map((tile) => {
          const intent = dropIntent?.targetId === tile.id ? dropIntent.placement : null;
          return <div className={`cloud-tile-slot ${intent ? `drop-${intent}` : ''}`} key={tile.id}>
            <button className={`cloud-tile ${selected.includes(tile.id) ? 'selected' : ''} ${draggingTileId === tile.id ? 'dragging' : ''}`} disabled={busy || isTerminal} aria-describedby="cloud-rack-help" aria-pressed={selected.includes(tile.id)} aria-label={tileLabel(tile)} title={tileLabel(tile)} draggable={!isTerminal} onDragStart={(event) => { setDraggingTileId(tile.id); setDropIntent(null); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', tile.id); }} onDragOver={(event) => { if (draggingTileId && draggingTileId !== tile.id) { event.preventDefault(); const bounds = event.currentTarget.getBoundingClientRect(); const placement = event.clientX < bounds.left + bounds.width / 2 ? 'before' : 'after'; setDropIntent((current) => current?.targetId === tile.id && current.placement === placement ? current : { targetId: tile.id, placement }); } }} onDrop={(event) => { event.preventDefault(); const movingId = event.dataTransfer.getData('text/plain') || draggingTileId; if (movingId) placeTile(movingId, tile.id, dropIntent?.targetId === tile.id ? dropIntent.placement : 'before'); }} onKeyDown={(event) => { if (event.altKey && event.key === 'ArrowLeft') { event.preventDefault(); moveTile(tile.id, -1); } if (event.altKey && event.key === 'ArrowRight') { event.preventDefault(); moveTile(tile.id, 1); } }} onClick={() => toggle(tile.id)}><b>{compactTile(tile)}</b><small>{tile.type.kind === 'number' ? tile.type.suit : tile.type.kind}</small></button>
          </div>;
        })}</div>
        {jokerExchanges.length ? <div className="cloud-exchange-row"><span>Joker available:</span>{jokerExchanges.map((option) => <button disabled={busy} onClick={() => void act({ type: 'EXCHANGE_JOKER', exposureOwnerId: option.owner.id, exposureId: option.exposure.id, rackTileId: option.rackTile.id, jokerTileId: option.joker.id })} key={`${option.exposure.id}-${option.rackTile.id}`}>Swap {compactTile(option.rackTile)} for {option.owner.name}&apos;s Joker</button>)}</div> : null}
        <div className="cloud-actions">
          {selected.length === 1 ? <div className="cloud-rack-order-actions" aria-label="Move selected tile"><button className="secondary" disabled={busy || orderedRack.findIndex((tile) => tile.id === selected[0]) <= 0} onClick={() => moveTile(selected[0], -1)}>Move left</button><button className="secondary" disabled={busy || orderedRack.findIndex((tile) => tile.id === selected[0]) === orderedRack.length - 1} onClick={() => moveTile(selected[0], 1)}>Move right</button></div> : null}
          {pending === 'charleston_pass' ? <button disabled={busy || selected.length !== 3} onClick={() => void act({ type: 'PASS_TILES', tileIds: selected })}>Pass three tiles</button> : null}
          {pending === 'courtesy_pass' ? <button disabled={busy || selected.length > 3} onClick={() => void act({ type: 'COURTESY_PASS', tileIds: selected })}>Pass {selected.length || 'no'} tiles</button> : null}
          {pending === 'charleston_decision' ? <><button disabled={busy} onClick={() => void act({ type: 'CHOOSE_SECOND_CHARLESTON', continue: true })}>Continue Charleston</button><button className="secondary" disabled={busy} onClick={() => void act({ type: 'CHOOSE_SECOND_CHARLESTON', continue: false })}>Move to courtesy pass</button></> : null}
          {pending === 'draw' ? <button disabled={busy} onClick={() => void act({ type: 'DRAW_TILE' })}>Draw tile</button> : null}
          {pending === 'discard' ? <><button disabled={busy || selected.length !== 1} onClick={() => void act({ type: 'DISCARD_TILE', tileId: selected[0] })}>Discard selected tile</button><button className="mahjong" disabled={busy} onClick={() => void act({ type: 'DECLARE_MAHJONG' })}>Declare Mahjong</button></> : null}
          {pending === 'discard_response' ? <><button disabled={busy || selected.length < 2} onClick={() => void act({ type: 'CALL_TILE', rackTileIds: selected })}>Call with selected tiles</button><button className="secondary" disabled={busy} onClick={() => void act({ type: 'PASS_ON_DISCARD' })}>Pass</button><button className="mahjong" disabled={busy} onClick={() => void act({ type: 'DECLARE_MAHJONG', useDiscard: true })}>Mahjong</button></> : null}
          {pending === 'wait' ? <span>Autosaved at version {snapshot.stateVersion}. Waiting for the next decision.</span> : null}
        </div>
        {message ? <p className="cloud-message" role="status" aria-live="polite">{message}</p> : null}
        <details className="cloud-training-card"><summary>Show Training Card · 10 original hands</summary><div>{cloudTrainingHands.map((hand) => <article key={hand.id}><span>{hand.section} · {hand.exposure === 'concealed' ? 'C' : 'X'}</span><strong>{hand.name}</strong><p>{hand.description}</p></article>)}</div></details>
      </section>
    </main>
  );
}
