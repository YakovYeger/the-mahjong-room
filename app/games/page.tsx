'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';

interface GameItem {
  id: string; ownerId: string; status: string; mode: 'live' | 'async'; stateVersion: number;
  deadlineAt: string | null; updatedAt: string; playerCount: number; humanCount: number; isMine: boolean;
}

interface RoomPlayer { playerKey: string; displayName: string; seat: string; controllerType: string }
interface Room { id: string; ownerId: string; status: string; mode: string; players: RoomPlayer[] }
interface TurnNotification { id: string; game_id: string; kind: string; read_at: string | null; created_at: string }
interface Entitlement { planId: string; name: string; activeGameLimit: number }

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, init);
  const data = await response.json() as Record<string, unknown> & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? 'Please try again.');
  return data;
}

export default function GamesPage() {
  const router = useRouter();
  const [games, setGames] = useState<GameItem[]>([]);
  const [notifications, setNotifications] = useState<TurnNotification[]>([]);
  const [entitlement, setEntitlement] = useState<Entitlement>({ planId: 'free', name: 'Free', activeGameLimit: 1 });
  const [room, setRoom] = useState<Room | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'live' | 'async'>('live');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  const loadGames = useCallback(async () => {
    try {
      const [data, inbox] = await Promise.all([api('/api/games'), api('/api/notifications')]);
      setGames((data.games as GameItem[]) ?? []);
      if (data.entitlement) setEntitlement(data.entitlement as unknown as Entitlement);
      setNotifications((inbox.notifications as TurnNotification[]) ?? []);
      setSignedOut(false);
    } catch (error) {
      setSignedOut(error instanceof Error && /sign in/i.test(error.message));
      setMessage(error instanceof Error ? error.message : 'Games could not be loaded.');
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      const invited = new URLSearchParams(location.search).get('join');
      if (invited) setJoinCode(invited.toUpperCase().slice(0, 8));
      void loadGames();
    });
  }, [loadGames]);

  useEffect(() => {
    if (!room || room.status !== 'lobby') return;
    const timer = window.setInterval(() => {
      void api(`/api/games/${room.id}/snapshot`).then((data) => setRoom(data.room as Room)).catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [room]);

  const openNotification = async (notification: TurnNotification) => {
    await api('/api/notifications', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: notification.id }) }).catch(() => undefined);
    router.push(`/games/${notification.game_id}`);
  };

  const create = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const data = await api('/api/games', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode }) });
      const game = data.game as { id: string };
      setInviteCode(data.inviteCode as string);
      const snapshot = await api(`/api/games/${game.id}/snapshot`);
      setRoom(snapshot.room as Room);
      await loadGames();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Room creation failed.'); }
    finally { setBusy(false); }
  };

  const join = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const code = joinCode.trim().toUpperCase();
      const data = await api(`/api/games/${code}/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ inviteCode: code }) });
      const game = data.game as { id: string };
      const snapshot = await api(`/api/games/${game.id}/snapshot`);
      setRoom(snapshot.room as Room);
      await loadGames();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'That room could not be joined.'); }
    finally { setBusy(false); }
  };

  const openRoom = async (gameId: string) => {
    setBusy(true); setMessage('');
    try {
      const data = await api(`/api/games/${gameId}/snapshot`);
      const opened = data.room as Room;
      if (opened.status === 'lobby') setRoom(opened);
      else router.push(`/games/${gameId}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'That game could not be opened.'); }
    finally { setBusy(false); }
  };

  const start = async () => {
    if (!room) return;
    setBusy(true); setMessage('');
    try {
      await api(`/api/games/${room.id}/start`, { method: 'POST' });
      router.push(`/games/${room.id}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The game could not be started.'); setBusy(false); }
  };

  if (signedOut) return <main className="games-page"><header><Link className="brand" href="/">The Mahjong Room</Link></header><section className="games-empty"><p className="kicker">Account required</p><h1>Sign in to open cloud tables.</h1><p>Solo guest play remains available from the home page.</p><Link className="account-primary account-link" href="/account">Sign in or create an account</Link></section></main>;

  return (
    <main className="games-page">
      <header><Link className="brand" href="/">The Mahjong Room</Link><nav><Link href="/account">Account</Link><Link href="/">Guest table</Link></nav></header>
      <section className="games-hero"><div><p className="kicker">Private tables</p><h1>Your games</h1><p>Every accepted move autosaves. Rejoin on any device and continue from the canonical server snapshot.</p></div><div className="tier-chip"><strong>{entitlement.name}</strong><span>{entitlement.activeGameLimit} active cloud game{entitlement.activeGameLimit === 1 ? '' : 's'}</span></div></section>
      <section className="games-layout">
        <div className="games-list-panel">{notifications.some((item) => !item.read_at) ? <div className="turn-inbox"><div className="section-heading"><h2>Your turn</h2><span>{notifications.filter((item) => !item.read_at).length}</span></div>{notifications.filter((item) => !item.read_at).slice(0, 3).map((item) => <button onClick={() => void openNotification(item)} key={item.id}><strong>A table is waiting</strong><small>{new Date(item.created_at).toLocaleString()}</small><span>Play now →</span></button>)}</div> : null}<div className="section-heading"><h2>Active and recent</h2><button onClick={() => void loadGames()}>Refresh</button></div>
          {games.length ? <div className="games-list">{games.map((game) => <button onClick={() => void openRoom(game.id)} key={game.id}><span className={`game-status status-${game.status}`}>{game.status}</span><strong>{game.mode === 'live' ? 'Live table' : 'Time-based table'}</strong><small>{game.humanCount} human{game.humanCount === 1 ? '' : 's'} · version {game.stateVersion}</small><time>{new Date(game.updatedAt).toLocaleString()}</time></button>)}</div> : <div className="empty-list"><strong>No cloud games yet</strong><p>Create a private room or join with an invite code.</p></div>}
        </div>
        <aside className="room-tools">
          {room ? <div className="lobby-card"><p className="kicker">Lobby · {room.mode}</p><h2>Seats at the table</h2><div className="seat-list">{['east','south','west','north'].map((seat) => { const player = room.players.find((item) => item.seat === seat); return <div key={seat}><b>{seat[0].toUpperCase()}</b><span>{player?.displayName ?? 'Open seat'}</span><small>{player?.controllerType ?? 'Bot fills on start'}</small></div>; })}</div>{inviteCode ? <div className="invite-code"><span>Invite code</span><strong>{inviteCode}</strong><button onClick={() => void navigator.clipboard?.writeText(`${location.origin}/games?join=${inviteCode}`)}>Copy invite link</button></div> : null}<button className="account-primary" onClick={start} disabled={busy}>Start game · bots fill open seats</button><button className="account-secondary" onClick={() => setRoom(null)}>Back</button></div> : <>
            <form className="room-card" onSubmit={create}><p className="kicker">Host a table</p><h2>Create a private room</h2><div className="mode-picker"><button type="button" className={mode === 'live' ? 'active' : ''} onClick={() => setMode('live')}><strong>Live</strong><small>60-second turns</small></button><button type="button" className={mode === 'async' ? 'active' : ''} onClick={() => setMode('async')}><strong>Time-based</strong><small>24-hour turns</small></button></div><button className="account-primary" disabled={busy}>Create room</button></form>
            <form className="room-card join-card" onSubmit={join}><p className="kicker">Have an invitation?</p><h2>Join by code</h2><input aria-label="Eight-character room code" maxLength={8} required value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="ABCD2345" /><button className="account-primary" disabled={busy}>Join table</button></form>
          </>}
          {message ? <p className="account-message" role="status">{message}</p> : null}
        </aside>
      </section>
    </main>
  );
}
