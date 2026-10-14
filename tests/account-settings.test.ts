// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AccountSettings } from '../src/account/settings';
const mock = vi.hoisted(() => ({ signOut: vi.fn(), fetch: vi.fn() }));
vi.mock('../src/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ auth: { signOut: mock.signOut } }) }));
const details = { profile: { username: 'alice', display_name: 'Alice', created_at: '2026-10-01T00:00:00Z' }, providers: ['email'], email: 'alice@example.test' };
beforeEach(() => { mock.fetch.mockReset().mockResolvedValue(Response.json(details)); mock.signOut.mockReset().mockResolvedValue({ error: null }); vi.stubGlobal('fetch', mock.fetch); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const show = (onSignedOut = vi.fn()) => render(createElement(AccountSettings, { email: details.email, username: 'alice', recovery: false, onSignedOut }));
it('loads profile details and saves only the display name', async () => {
  show(); await screen.findByLabelText('Display name');
  fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Alice Mahjong' } });
  mock.fetch.mockResolvedValueOnce(Response.json({ displayName: 'Alice Mahjong', message: 'Display name saved.' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
  await screen.findByText('Display name saved.');
  expect(JSON.parse(mock.fetch.mock.calls[1][1].body)).toEqual({ displayName: 'Alice Mahjong' });
});
it('does not send mismatched passwords and signs out after a successful change', async () => {
  const signedOut = vi.fn(); show(signedOut); await screen.findByLabelText('Display name');
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password' } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'different-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
  await screen.findByText('The new passwords do not match.'); expect(mock.fetch).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'new-password' } });
  mock.fetch.mockResolvedValueOnce(Response.json({ message: 'Password updated.' }));
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
  await waitFor(() => expect(signedOut).toHaveBeenCalledWith('Password updated.'));
  expect(mock.signOut).toHaveBeenCalledWith({ scope: 'local' });
});
it('requires typed confirmation and cancels without a deletion request', async () => {
  const user = userEvent.setup(); show(); await screen.findByLabelText('Display name');
  fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Permanently delete account' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'DELETE' } });
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(mock.fetch).toHaveBeenCalledTimes(1);
});
it('keeps the dialog and account available when deletion fails', async () => {
  const signedOut = vi.fn(); show(signedOut); await screen.findByLabelText('Display name');
  fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
  fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'DELETE' } });
  mock.fetch.mockResolvedValueOnce(Response.json({ error: { message: 'Finish your open tables first.' } }, { status: 409 }));
  fireEvent.click(screen.getByRole('button', { name: 'Permanently delete account' }));
  await screen.findByRole('alert'); expect(screen.getByRole('dialog')).toBeTruthy(); expect(signedOut).not.toHaveBeenCalled();
});
