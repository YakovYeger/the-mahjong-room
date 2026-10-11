'use client';

/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors avoid a confirmed next/link runtime failure in the Sites vinext deployment. */

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

interface GameItem {
  id: string; ownerId: string; status: string; mode: 'live' | 'async'; stateVersion: number;
  deadlineAt: string | null; updatedAt: string; playerCount: number; humanCount: number; isMine: boolean;
}

import { useCloudGames } from '../../src/multiplayer/use-cloud-games';
import { useCloudTable } from '../../src/multiplayer/use-cloud-table';
import { CloudApiError } from '../../src/multiplayer/cloud-api';

export default function GamesPage() {
  const router = useRouter();
  const cloud = useCloudGames();
  const games = cloud.games;
  const notifications = cloud.notifications;
  const entitlement = cloud.entitlement;
  const [roomId, setRoomId] = useState('');
  const lobby = useCloudTable(roomId);
  const room = lobby.data?.room ?? null;
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'live' | 'async'>('live');
  const [turnSeconds, setTurnSeconds] = useState(300);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const signedOut = !cloud.loading && (!cloud.userId || (cloud.error instanceof CloudApiError && cloud.error.status === 401));

  const loadGames = cloud.refresh;
  useEffect(() => {
    const invited = new URLSearchParams(location.search).get('join');
    if (invited) queueMicrotask(() => setJoinCode(invited.toUpperCase().slice(0, 8)));
  }, []);
  useEffect(() => {
    if (roomId && room && room.status !== 'lobby') router.push(`/games/${roomId}`);
  }, [roomId, room, router]);

  const openNotification = async (notification: typeof notifications[number]) => {
    await cloud.mutate({ path: '/api/notifications', method: 'PATCH', body: { id: notification.id } }).catch(() => undefined);
    router.push(`/games/${notification.game_id}`);
  };

  const create = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const data = await cloud.mutate({ path: '/api/games', body: { mode, turnSeconds } }) as { game: { id: string }; inviteCode: string };
      const game = data.game as { id: string };
      setInviteCode(data.inviteCode as string);
      await cloud.loadRoom(game.id);
      setRoomId(game.id);
      await loadGames();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Room creation failed.'); }
    finally { setBusy(false); }
  };

  const join = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const code = joinCode.trim().toUpperCase();
      const data = await cloud.mutate({ path: `/api/games/${code}/join`, body: { inviteCode: code } }) as { game: { id: string } };
      const game = data.game as { id: string };
      await cloud.loadRoom(game.id);
      setRoomId(game.id);
      await loadGames();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'That room could not be joined.'); }
    finally { setBusy(false); }
  };

  const openRoom = async (gameId: string) => {
    setBusy(true); setMessage('');
    try {
      const data = await cloud.loadRoom(gameId);
      const opened = data?.room;
      if (!opened) throw new Error('The room could not be opened.');
      if (opened.status === 'lobby') setRoomId(gameId);
      else router.push(`/games/${gameId}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'That game could not be opened.'); }
    finally { setBusy(false); }
  };

  const start = async () => {
    if (!room) return;
    setBusy(true); setMessage('');
    try {
      await cloud.mutate({ path: `/api/games/${room.id}/start` });
      router.push(`/games/${room.id}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The game could not be started.'); setBusy(false); }
  };

  const deleteGame = async (game: GameItem) => {
    if (!game.isMine || !window.confirm('Delete this game and its saved history? This will free your active game slot.')) return;
    setBusy(true); setMessage('');
    try {
      await cloud.mutate({ path: `/api/games/${game.id}`, method: 'DELETE' });
      if (room?.id === game.id) setRoomId('');
      setMessage('Game deleted. Your active game slot is free.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The game could not be deleted.'); }
    finally { setBusy(false); }
  };

  if (signedOut) return <main className="games-page"><header><a className="brand" href="/">The Mahjong Room</a></header><section className="games-empty"><p className="kicker">Account required</p><h1>Sign in to open cloud tables.</h1><p>Solo guest play remains available from the home page.</p><a className="account-primary account-link" href="/account">Sign in or create an account</a></section></main>;

  return (
    <main className="games-page">
      <header><a className="brand" href="/">The Mahjong Room</a><nav><a href="/account">Account</a><a href="/">Guest table</a></nav></header>
      <section className="games-hero"><div><p className="kicker">Private tables</p><h1>Your games</h1><p>Every accepted move autosaves. Rejoin on any device and continue from the canonical server snapshot.</p></div><div className="tier-chip"><strong>{entitlement.name}</strong><span>{entitlement.activeGameLimit} active cloud game{entitlement.activeGameLimit === 1 ? '' : 's'}</span></div></section>
      <section className="games-layout">
        <div className="games-list-panel">{notifications.some((item) => !item.read_at) ? <div className="turn-inbox"><div className="section-heading"><h2>Your turn</h2><span>{notifications.filter((item) => !item.read_at).length}</span></div>{notifications.filter((item) => !item.read_at).slice(0, 3).map((item) => <button onClick={() => void openNotification(item)} key={item.id}><strong>A table is waiting</strong><small>{new Date(item.created_at).toLocaleString()}</small><span>Play now →</span></button>)}</div> : null}<div className="section-heading"><h2>Active and recent</h2><button onClick={() => void loadGames()}>Refresh</button></div>
          {games.length ? <div className="games-list">{games.map((game) => <article className="game-list-item" key={game.id}><button className="game-open" onClick={() => void openRoom(game.id)} disabled={busy}><span className={`game-status status-${game.status}`}>{game.status}</span><strong>{game.mode === 'live' ? 'Live table' : 'Time-based table'}</strong><small>{game.humanCount} human{game.humanCount === 1 ? '' : 's'}</small><time>{new Date(game.updatedAt).toLocaleString()}</time></button>{game.isMine ? <button className="game-delete" onClick={() => void deleteGame(game)} disabled={busy} aria-label={`Delete ${game.mode === 'live' ? 'live table' : 'time-based table'}`} title="Delete game">Delete</button> : null}</article>)}</div> : <div className="empty-list"><strong>No cloud games yet</strong><p>Create a private room or join with an invite code.</p></div>}
        </div>
        <aside className="room-tools">
          {room ? <div className="lobby-card"><p className="kicker">Lobby · {room.mode}</p><h2>Seats at the table</h2><div className="seat-list">{['east','south','west','north'].map((seat) => { const player = room.players.find((item) => item.seat === seat); return <div key={seat}><b>{seat[0].toUpperCase()}</b><span>{player?.displayName ?? 'Open seat'}</span><small>{player?.controllerType ?? 'Bot fills on start'}</small></div>; })}</div><p className="room-rules-summary">{room.mode === 'live' ? `${Math.floor(room.turnSeconds / 60)}-minute live turns · Charleston untimed · 2-minute reconnect grace, then bot takeover` : '24-hour turns · Charleston untimed'}</p>{(room.inviteCode || inviteCode) ? <div className="invite-code"><span>Invite code</span><strong>{room.inviteCode || inviteCode}</strong><button onClick={() => void navigator.clipboard?.writeText(`${location.origin}/games?join=${room.inviteCode || inviteCode}`)}>Copy invite link</button></div> : null}<button className="account-primary" onClick={start} disabled={busy}>Start game · bots fill open seats</button><button className="account-secondary" onClick={() => setRoomId('')}>Back</button></div> : <>
            <form className="room-card" onSubmit={create}><p className="kicker">Host a table</p><h2>Create a private room</h2><div className="mode-picker"><button type="button" className={mode === 'live' ? 'active' : ''} onClick={() => setMode('live')}><strong>Live</strong><small>{Math.floor(turnSeconds / 60)}-minute turns</small></button><button type="button" className={mode === 'async' ? 'active' : ''} onClick={() => setMode('async')}><strong>Time-based</strong><small>24-hour turns</small></button></div>{mode === 'live' ? <label className="turn-setting">Live turn length<select value={turnSeconds} onChange={(event) => setTurnSeconds(Number(event.target.value))}><option value={60}>1 minute</option><option value={300}>5 minutes · default</option><option value={600}>10 minutes</option></select><small>Charleston is untimed. A disconnected player has 2 minutes to return before a bot takes over.</small></label> : null}<button className="account-primary" disabled={busy}>Create room</button></form>
            <form className="room-card join-card" onSubmit={join}><p className="kicker">Have an invitation?</p><h2>Join by code</h2><input aria-label="Eight-character room code" maxLength={8} required value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="ABCD2345" /><button className="account-primary" disabled={busy}>Join table</button></form>
          </>}
          {message || cloud.error ? <p className="account-message" role="status">{cloud.error?.message ?? message}</p> : null}
        </aside>
      </section>
    </main>
  );
}
