'use client';

import { useEffect, useEffectEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export function useGameChannel({ supabase, gameId, playerId, stateVersion, refresh, onPresence, onError }: {
  supabase: SupabaseClient | null;
  gameId: string;
  playerId: string | undefined;
  stateVersion: number;
  refresh: (minimumVersion?: number) => Promise<void>;
  onPresence: (count: number) => void;
  onError: (message: string) => void;
}) {
  const update = useEffectEvent((version = 0) => {
    // Pause/resume can change the deadline without advancing stateVersion.
    if (version === 0 || version >= stateVersion) void refresh(version === stateVersion ? 0 : version).catch((error: unknown) => onError(error instanceof Error ? error.message : 'Could not refresh the table.'));
  });
  const presence = useEffectEvent((count: number) => onPresence(count));
  useEffect(() => {
    if (!supabase || !gameId || !playerId) return;
    const channel = supabase.channel(`game:${gameId}`, { config: { private: true, presence: { key: playerId } } });
    channel
      .on('broadcast', { event: 'game.updated' }, (event) => {
        const version = Number(event.payload?.stateVersion);
        if (Number.isSafeInteger(version) && version > 0) update(version);
      })
      .on('presence', { event: 'sync' }, () => presence(Object.keys(channel.presenceState()).length))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track({ onlineAt: new Date().toISOString() });
          update(); // Includes reconnects after missed broadcasts.
        }
      });
    const onVisible = () => { if (document.visibilityState === 'visible') update(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); void supabase.removeChannel(channel); };
  }, [gameId, playerId, supabase]);
}
