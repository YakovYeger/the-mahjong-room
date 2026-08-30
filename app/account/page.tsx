'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '../../src/lib/supabase/client';
import { loadGuestProgress } from '../../src/persistence/guest-progress';
import { syncGuestProgress } from '../../src/persistence/progress-sync';

export default function AccountPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [guestGames, setGuestGames] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hydrateAccount = async () => {
      await Promise.resolve();
      setGuestGames(loadGuestProgress(localStorage)?.gamesCompleted ?? 0);
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email ?? null);
      if (!data.user) return;
      const result = await syncGuestProgress(localStorage);
      setMessage(result.message);
      if (result.ok) setGuestGames(0);
    };
    void hydrateAccount();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUserEmail(session?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const sendLink = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !email) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/account` } });
    setMessage(error ? error.message : 'Check your email for a secure sign-in link.');
    setBusy(false);
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUserEmail(null);
    setMessage('Signed out. Your account progress remains saved.');
  };

  return (
    <main className="account-page">
      <header><Link className="brand" href="/">The Mahjong Room</Link><Link href="/">Back to the table</Link></header>
      <section className="account-shell">
        <div className="account-copy"><p className="kicker">Keep what you learned</p><h1>Save your progress when you&apos;re ready.</h1><p>Your first game never requires an account. Sign in afterward to carry your assistance level, skill history, and reviews to another device.</p><div className="guest-badge"><strong>{guestGames}</strong><span>guest game{guestGames === 1 ? '' : 's'} ready to save</span></div></div>
        <div className="account-card">
          {!supabase ? <><p className="kicker">Connection pending</p><h2>Account saving is ready for a Supabase project.</h2><p>Add the project URL and publishable key to enable secure email sign-in. Guest progress remains safely stored on this device.</p></> : userEmail ? <><p className="kicker">Signed in</p><h2>{userEmail}</h2><p>{message || 'Your progress is connected to this account.'}</p><button className="account-primary" onClick={signOut}>Sign out</button></> : <form onSubmit={sendLink}><p className="kicker">Passwordless sign-in</p><h2>Email me a secure link</h2><label htmlFor="account-email">Email address</label><input id="account-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /><button className="account-primary" disabled={busy}>{busy ? 'Sending…' : 'Send sign-in link'}</button><p className="form-note">We use your account only to save Mahjong progress.</p>{message ? <p className="account-message" role="status">{message}</p> : null}</form>}
        </div>
      </section>
    </main>
  );
}
