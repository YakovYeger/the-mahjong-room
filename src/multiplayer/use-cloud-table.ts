'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GameAction } from '../game/types';
import { useCloudSession } from './cloud-query-provider';
import { TableQuery } from './table-query';
import { useGameChannel } from './use-game-channel';

export function useCloudTable(gameId: string, request: typeof fetch = fetch) {
  const { userId, loading, supabase } = useCloudSession();
  const client = useQueryClient();
  const table = useMemo(() => new TableQuery(client, userId ?? '', gameId, request), [client, userId, gameId, request]);
  useSyncExternalStore(table.subscribe, table.getRevision, table.getRevision);
  const query = useQuery({ ...table.options(), enabled: Boolean(userId && gameId) && !table.revoked });
  const move = useMutation({ mutationFn: (action: GameAction) => table.submit(action), retry: false, networkMode: 'always', gcTime: 0 });
  const command = useMutation({ mutationFn: (value: 'pause' | 'resume' | 'end') => table.command(value), retry: false, networkMode: 'always', gcTime: 0 });
  const [online, setOnline] = useState(1);
  const [channelError, setChannelError] = useState('');
  const snapshot = table.revoked ? null : query.data?.snapshot;
  const refresh = useMemo(() => (version = 0) => table.refresh(version), [table]);
  useGameChannel({ supabase, gameId, playerId: snapshot?.privateState.playerId ?? query.data?.room.players.find((player) => player.userId === userId)?.playerKey, stateVersion: snapshot?.stateVersion ?? 0, refresh, onPresence: setOnline, onError: setChannelError });

  useEffect(() => { table.activate(); return () => table.dispose(); }, [table]);
  const active = snapshot?.status === 'active';
  useEffect(() => {
    if (!active) return;
    const beat = () => { if (document.visibilityState === 'visible') void table.heartbeat(); };
    beat();
    const timer = window.setInterval(beat, 20000);
    document.addEventListener('visibilitychange', beat);
    window.addEventListener('online', beat);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', beat); window.removeEventListener('online', beat); };
  }, [table, active]);
  useEffect(() => {
    if (query.isSuccess && table.uncertain) void table.recover(false).catch(() => undefined);
  }, [table, query.isSuccess, query.dataUpdatedAt]);

  return {
    data: table.revoked ? null : query.data, loading: loading || query.isPending,
    signedOut: !loading && !userId, error: query.error ?? (table.uncertain ? move.error : null) ?? command.error,
    channelError, online, refresh, uncertain: table.uncertain,
    confirmedActionId: table.confirmedActionId,
    busy: move.isPending || command.isPending || Boolean(table.pending),
    submit: move.mutateAsync, command: command.mutateAsync,
  };
}
