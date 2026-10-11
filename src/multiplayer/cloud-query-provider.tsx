'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '../lib/supabase/client';

const CloudSession = createContext<{ userId: string | null; loading: boolean; supabase: ReturnType<typeof createSupabaseBrowserClient> }>({ userId: null, loading: true, supabase: null });
export const useCloudSession = () => useContext(CloudSession);

function QueryScope({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: {
    queries: { gcTime: 0, retry: false }, mutations: { retry: false, networkMode: 'always', gcTime: 0 },
  } }));
  useEffect(() => () => { void client.cancelQueries(); client.clear(); }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function CloudQueryProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<{ userId: string | null; loading: boolean }>({ userId: null, loading: true });
  useEffect(() => {
    if (!supabase) { queueMicrotask(() => setSession({ userId: null, loading: false })); return; }
    let stopped = false;
    let authEventReceived = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      authEventReceived = true;
      if (!stopped) setSession({ userId: next?.user.id ?? null, loading: false });
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!stopped && !authEventReceived) setSession({ userId: data.session?.user.id ?? null, loading: false });
    }).catch(() => { if (!stopped && !authEventReceived) setSession({ userId: null, loading: false }); });
    return () => { stopped = true; subscription.unsubscribe(); };
  }, [supabase]);
  return <CloudSession.Provider value={{ ...session, supabase }}><QueryScope key={session.userId ?? 'signed-out'}>{children}</QueryScope></CloudSession.Provider>;
}
