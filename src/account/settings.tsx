'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '../ui/field';
import { Dialog, DialogTitle, DialogDescription } from '../ui/dialog';
import { createSupabaseBrowserClient } from '../lib/supabase/client';

type Details = { profile: { display_name: string | null; username: string | null; created_at: string }; email: string; providers: string[] };
async function accountRequest(path: string, body?: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
  const data = await response.json() as Record<string, unknown> & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? 'Please try again.');
  return data;
}
export function AccountSettings({ email, username, recovery, onSignedOut }: { email: string; username: string | null; recovery: boolean; onSignedOut: (message: string) => void }) {
  const [details, setDetails] = useState<Details | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    accountRequest('/api/account').then(data => {
      if (cancelled) return;
      const loaded = data as unknown as Details;
      if (!loaded.profile || !Array.isArray(loaded.providers)) throw new Error('Your account details could not be loaded.');
      setDetails(loaded); setDisplayName(loaded.profile.display_name ?? loaded.profile.username ?? ''); setLoadError('');
    }).catch(error => { if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Your account details could not be loaded.'); });
    return () => { cancelled = true; };
  }, [reload]);
  const run = async (action: string, work: () => Promise<void>) => {
    if (busy) return;
    setBusy(action); setMessage(''); setError('');
    try { await work(); } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(null); }
  };
  const finish = async (text: string) => {
    // Clear browser auth and account-scoped query caches through the existing
    // SIGNED_OUT listener, even though the server already revoked the sessions.
    const client = createSupabaseBrowserClient();
    await client?.auth.signOut({ scope: 'local' });
    onSignedOut(text);
  };
  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    void run('profile', async () => {
      const data = await accountRequest('/api/account', { displayName });
      setDisplayName(String(data.displayName)); setMessage(String(data.message));
    });
  };
  const changePassword = (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== repeatPassword) { setPasswordError('The new passwords do not match.'); return; }
    setPasswordError('');
    void run('password', async () => {
      const data = await accountRequest('/api/account/password', { newPassword, currentPassword: currentPassword || undefined });
      setCurrentPassword(''); setNewPassword(''); setRepeatPassword('');
      await finish(String(data.message));
    });
  };
  const verifyGoogle = () => void run('google', async () => {
    const client = createSupabaseBrowserClient();
    if (!client) throw new Error('Account services are unavailable.');
    const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: {
      redirectTo: `${location.origin}/auth/confirm?next=/account`, queryParams: { prompt: 'select_account' },
    } });
    if (error) throw error;
  });
  const deleteAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || confirmation !== 'DELETE') return;
    setBusy('delete'); setDeleteError('');
    try {
      const data = await accountRequest('/api/account/delete', { confirmation, currentPassword: deletePassword || undefined });
      setDeleting(false); await finish(String(data.message));
    } catch (error) { setDeleteError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(null); }
  };
  const google = details?.providers.includes('google');
  return <div className="account-settings">
    <p className="kicker">Your account</p><h2>Make yourself at home.</h2>
    <dl className="account-details">
      <div><dt>Username</dt><dd>{username ? `@${username}` : 'Choose a username above'}</dd></div>
      <div><dt>Email</dt><dd>{email}</dd></div>
      {details ? <>
        <div><dt>Member since</dt><dd>{new Date(details.profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</dd></div>
        <div><dt>Sign-in methods</dt><dd>{details.providers.map(provider => provider === 'google' ? 'Google' : provider === 'email' ? 'Email and password' : provider).join(', ')}</dd></div>
      </> : null}
    </dl>
    {loadError ? <div className="account-load-error"><FieldError>{loadError}</FieldError><Button variant="outline" disabled={!!busy} onClick={() => setReload(value => value + 1)}>Retry</Button></div> : !details ? <p role="status">Loading account details…</p> : null}
    {details ? <form className="account-section" onSubmit={saveProfile} aria-busy={busy === 'profile'}>
      <FieldSet><FieldLegend>Profile</FieldLegend><FieldDescription>Your display name appears at new tables. Your username stays the same.</FieldDescription>
        <FieldGroup><Field>
          <FieldLabel htmlFor="display-name">Display name</FieldLabel>
          <Input id="display-name" autoComplete="nickname" required maxLength={48} value={displayName} onChange={event => setDisplayName(event.target.value)} aria-describedby="display-name-hint" />
          <FieldDescription id="display-name-hint">Use up to 48 characters.</FieldDescription>
        </Field><Button type="submit" disabled={!!busy}>{busy === 'profile' ? 'Saving…' : 'Save profile'}</Button></FieldGroup>
      </FieldSet>
    </form> : null}
    <form className="account-section" onSubmit={changePassword} aria-busy={busy === 'password'}>
      <FieldSet><FieldLegend>{recovery ? 'Reset your password' : 'Password & security'}</FieldLegend>
        <FieldDescription>{recovery ? 'Choose a new password to recover access.' : 'Enter your current password, or sign in again before changing it.'} Changing your password signs you out on every device.</FieldDescription>
        <FieldGroup>
          {!recovery ? <Field><FieldLabel htmlFor="current-password">Current password</FieldLabel>
            <Input id="current-password" type="password" autoComplete="current-password" maxLength={128} value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} />
          </Field> : null}
          <Field><FieldLabel htmlFor="settings-new-password">New password</FieldLabel>
            <Input id="settings-new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={newPassword} onChange={event => { setNewPassword(event.target.value); setPasswordError(''); }} aria-describedby="new-password-hint" />
            <FieldDescription id="new-password-hint">Use 8–128 characters.</FieldDescription>
          </Field>
          <Field data-invalid={!!passwordError}>
            <FieldLabel htmlFor="repeat-password">Confirm new password</FieldLabel>
            <Input id="repeat-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={repeatPassword} onChange={event => { setRepeatPassword(event.target.value); setPasswordError(''); }} aria-invalid={!!passwordError} aria-describedby={passwordError ? 'repeat-password-error' : undefined} />
            <FieldError id="repeat-password-error">{passwordError}</FieldError>
          </Field>
          <Button type="submit" disabled={!!busy}>{busy === 'password' ? 'Updating…' : 'Update password'}</Button>
        </FieldGroup>
      </FieldSet>
    </form>
    {google ? <Button variant="outline" className="account-reauth" disabled={!!busy} onClick={verifyGoogle}>Verify with Google</Button> : null}
    <FieldDescription className="account-security-note">Verification lasts five minutes. If you have forgotten your password, sign out and choose Reset to request a recovery email.</FieldDescription>
    {message ? <p className="account-message" role="status">{message}</p> : null}
    <FieldError className="account-form-error">{error}</FieldError>
    <section className="account-section account-danger"><h3>Delete account</h3><FieldDescription>Permanently remove your account and saved progress. Guest play will still be available.</FieldDescription>
      <Button variant="destructive" className="account-delete-trigger" disabled={!!busy} onClick={() => { setConfirmation(''); setDeletePassword(''); setDeleteError(''); setDeleting(true); }}>Delete my account</Button>
    </section>
    <Dialog open={deleting} onOpenChange={open => { if (!busy) { setDeleting(open); setDeletePassword(''); } }} className="account-delete-dialog" initialFocus={false}>
      <DialogTitle>Delete your account?</DialogTitle>
      <DialogDescription>This cannot be undone. Your profile, progress, notifications, and all tables you hosted will be deleted. Completed tables hosted by others retain a “Deleted player” seat and game history.</DialogDescription>
      <p>Finish open tables or have their host end them first. Guest saves on this device stay available. There are currently no purchases or friends to transfer.</p>
      <form onSubmit={deleteAccount} aria-busy={busy === 'delete'}>
        <FieldGroup><Field>
          <FieldLabel htmlFor="delete-password">{google ? 'Current password (or verify with Google first)' : 'Current password (or sign in again first)'}</FieldLabel>
          <Input id="delete-password" type="password" autoComplete="current-password" maxLength={128} value={deletePassword} onChange={event => setDeletePassword(event.target.value)} />
        </Field><Field>
          <FieldLabel htmlFor="delete-confirmation">Type DELETE to confirm</FieldLabel>
          <Input id="delete-confirmation" autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} />
        </Field><FieldError>{deleteError}</FieldError></FieldGroup>
        <div className="account-delete-actions">
          <Button variant="outline" disabled={!!busy} onClick={() => setDeleting(false)}>Keep my account</Button>
          <Button type="submit" variant="destructive" disabled={!!busy || confirmation !== 'DELETE'}>{busy === 'delete' ? 'Deleting…' : 'Permanently delete account'}</Button>
        </div>
      </form>
    </Dialog>
  </div>;
}
