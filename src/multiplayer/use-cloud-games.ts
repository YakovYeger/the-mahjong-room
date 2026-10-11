'use client';

import { useMutation, useQuery, useQueryClient, onlineManager } from '@tanstack/react-query';
import { z } from 'zod';
import { useCloudSession } from './cloud-query-provider';
import { CloudApiError, cloudJson, ContractError, isTransientError } from './cloud-api';
import { TableQuery } from './table-query';

const gamesSchema = z.object({ games: z.array(z.object({
  id: z.string(), ownerId: z.string(), status: z.enum(['lobby', 'active', 'paused', 'completed', 'abandoned']),
  mode: z.enum(['live', 'async']), stateVersion: z.number().int().nonnegative(), deadlineAt: z.string().nullable(),
  updatedAt: z.string(), playerCount: z.number().int(), humanCount: z.number().int(), isMine: z.boolean(),
})), entitlement: z.object({ planId: z.string(), name: z.string(), activeGameLimit: z.number().int().positive() }) });
const inboxSchema = z.object({ notifications: z.array(z.object({ id: z.string(), game_id: z.string(), kind: z.string(), read_at: z.string().nullable(), created_at: z.string() })) });

export function useCloudGames() {
  const session = useCloudSession();
  const client = useQueryClient();
  const key = ['cloud', session.userId ?? '', 'games'];
  const inboxKey = ['cloud', session.userId ?? '', 'notifications'];
  const defaults = { enabled: Boolean(session.userId), gcTime: 0, staleTime: 1000,
    retry: (count: number, error: Error) => count < 2 && isTransientError(error),
    refetchOnWindowFocus: 'always' as const, refetchOnReconnect: 'always' as const, refetchInterval: 30000 };
  const games = useQuery({ ...defaults, queryKey: key, queryFn: async ({ signal }) => {
    const result = gamesSchema.safeParse(await cloudJson('/api/games', { signal }));
    if (!result.success) throw new ContractError('The game list returned an invalid response.');
    return result.data;
  } });
  const inbox = useQuery({ ...defaults, queryKey: inboxKey, queryFn: async ({ signal }) => {
    const result = inboxSchema.safeParse(await cloudJson('/api/notifications', { signal }));
    if (!result.success) throw new ContractError('The turn inbox returned an invalid response.');
    return result.data;
  } });
  const mutation = useMutation({ retry: false, networkMode: 'always', gcTime: 0,
    mutationFn: ({ path, method = 'POST', body }: { path: string; method?: string; body?: unknown }) => {
      if (!onlineManager.isOnline()) throw new CloudApiError(0, 'OFFLINE', 'Reconnect before changing a room.');
      return cloudJson(path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    }, onSettled: () => { void client.invalidateQueries({ queryKey: key }); void client.invalidateQueries({ queryKey: inboxKey }); },
  });
  return { ...session, games: games.data?.games ?? [], notifications: inbox.data?.notifications ?? [],
    entitlement: games.data?.entitlement ?? { planId: 'free', name: 'Free', activeGameLimit: 1 },
    error: games.error ?? inbox.error, busy: mutation.isPending, mutate: mutation.mutateAsync,
    refresh: async () => { await Promise.all([games.refetch(), inbox.refetch()]); },
    loadRoom: async (gameId: string) => {
      if (!session.userId) throw new CloudApiError(401, 'SIGN_IN_REQUIRED', 'Sign in to open this table.');
      return client.fetchQuery(new TableQuery(client, session.userId, gameId).options());
    },
  };
}
