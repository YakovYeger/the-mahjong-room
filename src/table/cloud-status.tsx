'use client';

import { useEffect, useState } from 'react';
import type { RoomDetails } from '../multiplayer/types';

function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export function TurnClock({ deadlineAt, charleston }: { deadlineAt: string | null; charleston: boolean }) {
  const now = useClock();
  const remaining = deadlineAt ? Math.max(0, Math.ceil((Date.parse(deadlineAt) - now) / 1000)) : null;
  const label = remaining === null ? 'No clock running' : remaining >= 3600
    ? `${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m`
    : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  return <div className="turn-clock"><span>{charleston ? 'Charleston' : 'Time remaining'}</span><strong>{charleston ? 'Untimed' : label}</strong></div>;
}

export function ConnectionAlert({ room }: { room: RoomDetails | null }) {
  const now = useClock();
  const disconnected = (room?.players ?? []).filter((player) => player.controllerType === 'human'
    && player.joinStatus !== 'replaced'
    && (player.joinStatus === 'disconnected' || now - Date.parse(player.lastActivityAt) >= 35_000));
  if (!disconnected.length) return null;
  return <div className="connection-alert" role="status">{disconnected.map((player) => {
    const secondsLeft = Math.max(0, Math.ceil((Date.parse(player.lastActivityAt) + 120_000 - now) / 1000));
    return <p key={player.playerKey}><strong>{player.displayName}</strong> is disconnected. A bot takes over in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')} if they do not return.</p>;
  })}</div>;
}
