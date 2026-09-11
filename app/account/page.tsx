'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createSupabaseBrowserClient } from '../../src/lib/supabase/client';
import { loadGuestProgress } from '../../src/persistence/guest-progress';
import { syncGuestProgress } from '../../src/persistence/progress-sync';

type AuthMode = 'login' | 'register' | 'recover';

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json() as { error?: { message?: string }; message?: string; confirmationRequired?: boolean };
  if (!response.ok) throw new Error(data.error?.message ?? 'Please try again.');
  return data;
}

export default function AccountPage() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<AuthMode>('login');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [guestGames, setGuestGames] = useState(0);
  const [busy, setBusy] = useState(false);
  const recoverySession = searchParams.get('recovery') === '1';

  useEffect(() => {
    const hydrateAccount = async () => {
      await Promise.resolve();
      setGuestGames(loadGuestProgress(localStorage)?.gamesCompleted ?? 0);
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email ?? null);
      if (!data.user) return;
      const [profileResult, result] = await Promise.all([
        supabase.from('profiles').select('username').eq('user_id', data.user.id).maybeSingle(),
        syncGuestProgress(localStorage),
      ]);
      const profile = profileResult.data;
      setProfileUsername(profile?.username ?? null);
      setMessage(result.message);
      if (result.ok) setGuestGames(0);
    };
    void hydrateAccount();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUserEmail(session?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'register') {
        const result = await postJson('/api/auth/register', { email, username, password });
        setMessage(result.confirmationRequired ? 'Check your email to verify the account, then sign in.' : 'Account created. Your guest progress is syncing now.');
      } else if (mode === 'recover') {
        const result = await postJson('/api/auth/recover', { email });
        setMessage(result.message ?? 'If that account exists, a recovery email is on its way.');
      } else {
        await postJson('/api/auth/login', { identifier, password });
        const { data } = await supabase?.auth.getUser() ?? { data: { user: null } };
        setUserEmail(data.user?.email ?? identifier);
        setMessage('Welcome back.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Please try again.');
    } finally { setBusy(false); }
  };

  const signInWithGoogle = async () => {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/confirm?next=/account` },
    });
    if (error) { setMessage(error.message); setBusy(false); }
  };

  const claimUsername = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await postJson('/api/auth/username', { username });
      setProfileUsername(username.trim().toLowerCase());
      setMessage('Username saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  };

  const updatePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || newPassword.length < 8) return setMessage('Use at least 8 characters.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setMessage(error ? error.message : 'Password updated.');
    setBusy(false);
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUserEmail(null);
    setProfileUsername(null);
    setMessage('Signed out. Your account progress remains saved.');
  };

  return (
    <main className="account-page">
      <header><Link className="brand" href="/">The Mahjong Room</Link><nav><Link href="/games">My games</Link><Link href="/">Back to the table</Link></nav></header>
      <section className="account-shell">
        <div className="account-copy"><p className="kicker">Your seat, on any device</p><h1>Save games and invite the table.</h1><p>Guest play stays available. An account adds cloud autosave, private rooms, live or time-based turns, and secure reconnects.</p><div className="guest-badge"><strong>{guestGames}</strong><span>guest game{guestGames === 1 ? '' : 's'} ready to save</span></div></div>
        <div className="account-card">
          {!supabase ? <><p className="kicker">Guest mode</p><h2>Account services are being connected.</h2><p>Your local game remains playable and saved on this device.</p></> : userEmail ? <>
            <p className="kicker">Signed in</p><h2>{profileUsername ? `@${profileUsername}` : userEmail}</h2>
            {!profileUsername ? <form onSubmit={claimUsername}><p>Choose a username before joining a multiplayer room.</p><label htmlFor="claim-username">Username</label><input id="claim-username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" value={username} onChange={(event) => setUsername(event.target.value)} /><button className="account-primary" disabled={busy}>Choose username</button></form> : <p>{userEmail}<br />Your games autosave after every accepted action.</p>}
            {recoverySession ? <form onSubmit={updatePassword}><label htmlFor="new-password">New password</label><input id="new-password" type="password" minLength={8} required autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><button className="account-primary" disabled={busy}>Update password</button></form> : null}
            <div className="account-actions"><Link className="account-primary account-link" href="/games">Open my games</Link><button className="account-secondary" onClick={signOut}>Sign out</button></div>
            {message ? <p className="account-message" role="status">{message}</p> : null}
          </> : <>
            <div className="auth-tabs" role="tablist" aria-label="Account options">
              {(['login', 'register', 'recover'] as AuthMode[]).map((item) => <button type="button" role="tab" aria-selected={mode === item} className={mode === item ? 'active' : ''} onClick={() => { setMode(item); setMessage(''); }} key={item}>{item === 'login' ? 'Sign in' : item === 'register' ? 'Create account' : 'Reset'}</button>)}
            </div>
            <form onSubmit={submitAuth}>
              <p className="kicker">{mode === 'register' ? 'Create your player profile' : mode === 'recover' ? 'Recover access' : 'Return to your table'}</p>
              <h2>{mode === 'register' ? 'Create an account' : mode === 'recover' ? 'Reset your password' : 'Sign in'}</h2>
              {mode === 'login' ? <><label htmlFor="identifier">Username or email</label><input id="identifier" required autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} /></> : <><label htmlFor="account-email">Email address</label><input id="account-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></>}
              {mode === 'register' ? <><label htmlFor="register-username">Username</label><input id="register-username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></> : null}
              {mode !== 'recover' ? <><label htmlFor="account-password">Password</label><input id="account-password" type="password" minLength={8} required autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} /></> : null}
              <button className="account-primary" disabled={busy}>{busy ? 'Working…' : mode === 'register' ? 'Create account' : mode === 'recover' ? 'Send recovery email' : 'Sign in'}</button>
              {mode !== 'recover' ? <><div className="auth-divider"><span>or</span></div><button className="google-button" type="button" onClick={signInWithGoogle} disabled={busy}><b>G</b> Continue with Google</button></> : null}
              <p className="form-note">Login errors are intentionally generic to protect account privacy.</p>
              {message ? <p className="account-message" role="status">{message}</p> : null}
            </form>
          </>}
        </div>
      </section>
    </main>
  );
}
