'use client';
import { AccountSettings } from '../../src/account/settings';
import { Button, buttonVariants } from '../../src/ui/button';
import { Input } from '../../src/ui/input';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '../../src/ui/field';
import { Tabs } from '../../src/ui/tabs';

/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors avoid a confirmed next/link runtime failure in the Sites vinext deployment. */

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
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [guestGames, setGuestGames] = useState(0);
  const [busy, setBusy] = useState(false);
  const authError = searchParams.get('auth_error');
  const recoverySession = searchParams.get('recovery') === '1';

  useEffect(() => {
    const hydrateAccount = async () => {
      await Promise.resolve();
      if (authError === 'invalid_link') setFormError('This sign-in or recovery link has expired or already been used. Request a new one.');
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
    void hydrateAccount().catch(() => setFormError('Your account could not be loaded. Please refresh and try again.'));
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { setUserEmail(session?.user.email ?? null); if (!session) setProfileUsername(null); });
    return () => data.subscription.unsubscribe();
  }, [supabase, authError]);

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setFormError('');
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
        if (data.user && supabase) {
          const { data: profile } = await supabase.from('profiles').select('username').eq('user_id', data.user.id).maybeSingle();
          setProfileUsername(profile?.username ?? null);
        }
        setUserEmail(data.user?.email ?? identifier);
        setMessage('Welcome back.');
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Please try again.');
    } finally { setBusy(false); }
  };

  const signInWithGoogle = async () => {
    if (!supabase) return;
    setBusy(true);
    setFormError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/confirm?next=/account` },
    });
    if (error) { setFormError(error.message); setBusy(false); }
  };

  const claimUsername = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await postJson('/api/auth/username', { username });
      setProfileUsername(username.trim().toLowerCase());
      setMessage('Username saved.');
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) { setFormError('You could not be signed out. Please try again.'); return; }
    setUserEmail(null);
    setProfileUsername(null);
    setMessage('Signed out. Your account progress remains saved.');
  };

  return (
    <main className={`account-page${userEmail ? ' account-page-signed-in' : ''}`}>
      <header><a className="brand" href="/">The Mahjong Room</a><nav><a href="/settings">Accessibility</a><a href="/games">My games</a><a href="/">Back to the table</a></nav></header>
      <section className="account-shell">
        <div className="account-copy"><p className="kicker">Your seat, on any device</p><h1>{userEmail ? 'Your place at the table.' : 'Save games and invite the table.'}</h1><p>{userEmail ? 'Manage your profile, secure your account, and get ready for your next game.' : 'Guest play stays available. An account adds cloud autosave, private rooms, live or time-based turns, and secure reconnects.'}</p>{!userEmail || guestGames > 0 ? <div className="guest-badge"><strong>{guestGames}</strong><span>guest game{guestGames === 1 ? '' : 's'} ready to save</span></div> : null}</div>
        <div className="account-card">
          {!supabase ? <><p className="kicker">Guest mode</p><h2>Account services are being connected.</h2><p>Your local game remains playable and saved on this device.</p></> : userEmail ? <>
            <p className="kicker">Signed in{profileUsername ? ` as @${profileUsername}` : ''}</p>
            {!profileUsername ? <form onSubmit={claimUsername}>
              <FieldGroup><Field>
                <FieldLabel htmlFor="claim-username">Username</FieldLabel>
                <Input id="claim-username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" value={username} onChange={event => setUsername(event.target.value)} aria-describedby="claim-username-hint" />
                <FieldDescription id="claim-username-hint">Choose 3–24 letters, numbers, or underscores before joining a room.</FieldDescription>
              </Field><Button type="submit" disabled={busy}>Choose username</Button></FieldGroup>
            </form> : null}
            <AccountSettings key={userEmail} email={userEmail} username={profileUsername} recovery={recoverySession} onSignedOut={text => { setUserEmail(null); setProfileUsername(null); setMessage(text); setFormError(''); history.replaceState(null, '', '/account'); }} />
            <div className="account-actions"><a className={buttonVariants()} href="/games">Open my games</a><Button variant="outline" onClick={signOut}>Sign out</Button></div>
            {message ? <p className="account-message" role="status">{message}</p> : null}
          </> : <>
            <Tabs<AuthMode> label="Account options" value={mode} onValueChange={next => { setMode(next); setMessage(''); setFormError(''); }} options={[{ value: 'login', label: 'Sign in' }, { value: 'register', label: 'Create account' }, { value: 'recover', label: 'Reset' }]}>
            <form onSubmit={submitAuth} aria-busy={busy}>
              <p className="kicker">{mode === 'register' ? 'Create your player profile' : mode === 'recover' ? 'Recover access' : 'Return to your table'}</p>
              <h2>{mode === 'register' ? 'Create an account' : mode === 'recover' ? 'Reset your password' : 'Sign in'}</h2>
              <FieldGroup className="account-auth-fields">
                {mode === 'login' ? <Field>
                  <FieldLabel htmlFor="identifier">Username or email</FieldLabel>
                  <Input id="identifier" required autoComplete="username" value={identifier} onChange={event => setIdentifier(event.target.value)} />
                </Field> : <Field>
                  <FieldLabel htmlFor="account-email">Email address</FieldLabel>
                  <Input id="account-email" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} />
                </Field>}
                {mode === 'register' ? <Field>
                  <FieldLabel htmlFor="register-username">Username</FieldLabel>
                  <Input id="register-username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} aria-describedby="register-username-hint" />
                  <FieldDescription id="register-username-hint">3–24 letters, numbers, or underscores.</FieldDescription>
                </Field> : null}
                {mode !== 'recover' ? <Field>
                  <FieldLabel htmlFor="account-password">Password</FieldLabel>
                  <Input id="account-password" type="password" minLength={8} required autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} aria-describedby={mode === 'register' ? 'register-password-hint' : undefined} />
                  {mode === 'register' ? <FieldDescription id="register-password-hint">Use at least 8 characters.</FieldDescription> : null}
                </Field> : null}
                <Button type="submit" disabled={busy}>{busy ? 'Working…' : mode === 'register' ? 'Create account' : mode === 'recover' ? 'Send recovery email' : 'Sign in'}</Button>
              </FieldGroup>
              {mode !== 'recover' ? <><div className="auth-divider"><span>or</span></div><Button variant="outline" className="account-google" onClick={signInWithGoogle} disabled={busy}><b aria-hidden="true">G</b> Continue with Google</Button></> : null}
              <FieldDescription className="account-security-note">Login errors are intentionally generic to protect account privacy.</FieldDescription>
              {message ? <p className="account-message" role="status">{message}</p> : null}
            </form>
            </Tabs>
          </>}
          <FieldError className="account-form-error">{formError}</FieldError>
        </div>
      </section>
    </main>
  );
}
