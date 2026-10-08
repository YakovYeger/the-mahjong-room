'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
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
  const [online, setOnline] = useState(1);
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
    setSelected([]);
    setMessage('');
  }, [gameId]);

  useEffect(() => { queueMicrotask(() => void refresh().catch((error) => setMessage(error.message))); }, [refresh]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);

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

  if (!snapshot) return <main className="cloud-game-loading"><span className="brand">The Mahjong Room</span><p>{message}</p><a href="/games">Back to my games</a></main>;

  const me = snapshot.publicState.players.find((player) => player.id === snapshot.privateState.playerId);
  const pending = snapshot.privateState.pendingAction;
  const remaining = snapshot.deadlineAt ? Math.max(0, Math.ceil((new Date(snapshot.deadlineAt).getTime() - now) / 1000)) : null;
  const remainingLabel = remaining === null ? 'No clock running' : remaining >= 3600 ? `${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m` : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  const current = snapshot.publicState.players[snapshot.publicState.turnIndex];
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
      <header><a className="brand" href="/">The Mahjong Room</a><div><span className="live-dot" /> {online} online</div><strong>{snapshot.mode === 'live' ? 'Live table' : 'Time-based table'}</strong><a href="/games">Leave table</a></header>
      <section className="cloud-status"><div><p className="kicker">{snapshot.status}</p><h1>{pending === 'wait' ? `${current?.name ?? 'The table'} is playing` : 'Your move'}</h1><p>{pending.replaceAll('_', ' ')}</p></div><div className="turn-clock"><span>Time remaining</span><strong>{remainingLabel}</strong></div>{snapshot.mode === 'live' ? <button onClick={() => void vote()}>{snapshot.status === 'paused' ? 'Vote to resume' : 'Vote to pause'}</button> : null}</section>
      <section className="cloud-board">
        <div className="opponent-grid">{snapshot.publicState.players.filter((player) => player.id !== me?.id).map((player) => <article key={player.id}><div><strong>{player.name}</strong><small>{player.seat} · {player.rackCount} concealed</small></div>{player.revealedRack ? <div className="revealed-cloud-rack">{player.revealedRack.map((tile) => <span title={tileLabel(tile)} key={tile.id}>{compactTile(tile)}</span>)}</div> : <div className="rack-backs">{Array.from({ length: player.rackCount }, (_, index) => <i key={index} />)}</div>}{player.exposures.length ? <div className="cloud-exposures">{player.exposures.map((exposure) => <span key={exposure.id}>{exposure.kind}: {exposure.tiles.map(compactTile).join(' ')}</span>)}</div> : null}</article>)}</div>
        <div className={`cloud-discard-pool ${discardDropActive ? 'drop-target-active' : ''}`} onDragOver={(event) => { if (pending === 'discard' && draggingTileId) { event.preventDefault(); setDiscardDropActive(true); } }} onDragLeave={() => setDiscardDropActive(false)} onDrop={(event) => { event.preventDefault(); const tileId = event.dataTransfer.getData('text/plain') || draggingTileId; if (tileId) discardDraggedTile(tileId); }}><div className="wall-counter"><strong>{snapshot.publicState.wallCount}</strong><span>tiles in wall</span></div><div className="cloud-discards">{snapshot.publicState.discards.map((tile) => <span title={tileLabel(tile)} key={tile.id}>{compactTile(tile)}</span>)}</div>{snapshot.publicState.callWindow ? <div className="call-focus"><small>Latest discard</small><strong>{compactTile(snapshot.publicState.callWindow.discard)}</strong><span>{snapshot.publicState.callWindow.responseCount} responded</span></div> : null}{pending === 'discard' ? <small className="discard-drop-hint">Drop a tile here to discard</small> : null}</div>
      </section>
      <section className="cloud-rack-section"><div className="cloud-rack-heading"><div><p className="kicker">Your rack · {me?.seat}</p><strong>{me?.name}</strong></div><span>{selected.length ? `${selected.length} selected` : 'Select tiles to act'}</span></div><small className="cloud-rack-help" id="cloud-rack-help">Select tiles to act. Use Move left/right or Alt + arrow keys to arrange; drag a tile onto the discard area to discard.</small><div className={`cloud-rack ${draggingTileId ? 'is-reordering' : ''}`} role="group" aria-label="Your rack" onDragEnd={() => { setDraggingTileId(null); setDiscardDropActive(false); setDropIntent(null); }}>{orderedRack.map((tile) => {
          const intent = dropIntent?.targetId === tile.id ? dropIntent.placement : null;
          return <div className={`cloud-tile-slot ${intent ? `drop-${intent}` : ''}`} key={tile.id}>
            <button className={`cloud-tile ${selected.includes(tile.id) ? 'selected' : ''} ${draggingTileId === tile.id ? 'dragging' : ''}`} disabled={busy} aria-describedby="cloud-rack-help" aria-pressed={selected.includes(tile.id)} aria-label={tileLabel(tile)} title={tileLabel(tile)} draggable onDragStart={(event) => { setDraggingTileId(tile.id); setDropIntent(null); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', tile.id); }} onDragOver={(event) => { if (draggingTileId && draggingTileId !== tile.id) { event.preventDefault(); const bounds = event.currentTarget.getBoundingClientRect(); const placement = event.clientX < bounds.left + bounds.width / 2 ? 'before' : 'after'; setDropIntent((current) => current?.targetId === tile.id && current.placement === placement ? current : { targetId: tile.id, placement }); } }} onDrop={(event) => { event.preventDefault(); const movingId = event.dataTransfer.getData('text/plain') || draggingTileId; if (movingId) placeTile(movingId, tile.id, dropIntent?.targetId === tile.id ? dropIntent.placement : 'before'); }} onKeyDown={(event) => { if (event.altKey && event.key === 'ArrowLeft') { event.preventDefault(); moveTile(tile.id, -1); } if (event.altKey && event.key === 'ArrowRight') { event.preventDefault(); moveTile(tile.id, 1); } }} onClick={() => toggle(tile.id)}><b>{compactTile(tile)}</b><small>{tile.type.kind === 'number' ? tile.type.suit : tile.type.kind}</small></button>
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
