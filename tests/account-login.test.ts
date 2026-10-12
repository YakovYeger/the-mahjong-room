// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import AccountPage from '../app/account/page';

const mock = vi.hoisted(() => ({ getUser: vi.fn(), profile: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('../src/persistence/progress-sync', () => ({ syncGuestProgress: async () => ({ ok: true, message: '' }) }));
vi.mock('../src/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({
  auth: { getUser: mock.getUser, onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mock.profile }) }) }),
}) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('loads the existing username immediately after password login', async () => {
  mock.getUser.mockResolvedValueOnce({ data: { user: null } }).mockResolvedValue({ data: { user: { id: 'test', email: 'test@example.test' } } });
  mock.profile.mockResolvedValue({ data: { username: 'testplayer' } });
  vi.stubGlobal('fetch', async () => Response.json({ user: { id: 'test' } }));
  render(createElement(AccountPage));
  await waitFor(() => expect(mock.getUser).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText('Username or email'), { target: { value: 'testplayer' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-only-value' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('link', { name: 'Open my games' });
  expect(screen.queryByRole('button', { name: 'Choose username' })).toBeNull();
  expect(mock.profile).toHaveBeenCalledTimes(1);
});

it('switches account forms with keyboard tabs and preserves entered values', async () => {
  mock.getUser.mockResolvedValue({ data: { user: null } });
  const user = userEvent.setup();
  render(createElement(AccountPage));
  fireEvent.change(screen.getByLabelText('Username or email'), { target: { value: 'returning-player' } });
  screen.getByRole('tab', { name: 'Sign in' }).focus();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(screen.getByRole('tab', { name: 'Create account' }).id);
  expect(screen.getByLabelText('Username')).toBeTruthy();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeTruthy();
  expect(screen.queryByLabelText('Password')).toBeNull();
  await user.keyboard('{Home}');
  expect((screen.getByLabelText('Username or email') as HTMLInputElement).value).toBe('returning-player');
});
