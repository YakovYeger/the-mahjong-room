import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as password } from '../app/api/account/password/route';
import { POST as deletion } from '../app/api/account/delete/route';
import { hasRecentAuthentication } from '../src/server/account';
const mock = vi.hoisted(() => ({ user: vi.fn(), getUser: vi.fn(), getClaims: vi.fn(), signIn: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), deleteUser: vi.fn(), lookup: vi.fn(), rate: vi.fn() }));
vi.mock('../src/server/auth', () => ({ requireUser: mock.user }));
vi.mock('../src/server/rate-limit', () => ({ enforceRateLimit: mock.rate }));
vi.mock('../src/lib/supabase/server', () => ({ createSupabaseServerClient: async () => ({ auth: {
  getUser: mock.getUser, getClaims: mock.getClaims, signInWithPassword: mock.signIn, updateUser: mock.updateUser, signOut: mock.signOut,
} }) }));
vi.mock('../src/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ auth: { admin: { deleteUser: mock.deleteUser } },
  from: () => ({ select: () => ({ eq: () => ({ in: () => ({ limit: mock.lookup }) }) }) }),
}) }));
const request = (body: unknown, origin = 'http://localhost') => new NextRequest('http://localhost/api/account', { method: 'POST', headers: { 'Content-Type': 'application/json', origin }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks();
  mock.user.mockResolvedValue({ id: 'alice', email: 'alice@example.test' });
  mock.getUser.mockResolvedValue({ data: { user: { id: 'alice', email: 'alice@example.test' } }, error: null });
  mock.getClaims.mockResolvedValue({ data: { claims: { sub: 'alice', amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }] } } });
  mock.signIn.mockResolvedValue({ data: { user: { id: 'alice' } }, error: null });
  mock.updateUser.mockResolvedValue({ error: null }); mock.signOut.mockResolvedValue({ error: null }); mock.deleteUser.mockResolvedValue({ error: null });
});
it('uses authentication time rather than token refresh time', () => {
  const now = 1_800_000_000_000;
  expect(hasRecentAuthentication([{ method: 'token_refresh', timestamp: now / 1000 }], false, now)).toBe(false);
  expect(hasRecentAuthentication([{ method: 'password', timestamp: now / 1000 - 301 }], false, now)).toBe(false);
  expect(hasRecentAuthentication([{ method: 'oauth', timestamp: now / 1000 }], false, now)).toBe(true);
  expect(hasRecentAuthentication([{ method: 'recovery', timestamp: now / 1000 }], false, now)).toBe(false);
  expect(hasRecentAuthentication([{ method: 'recovery', timestamp: now / 1000 }], true, now)).toBe(true);
  expect(hasRecentAuthentication([{ method: 'otp', timestamp: now / 1000 }], true, now)).toBe(true);
  expect(hasRecentAuthentication([{ method: 'otp', timestamp: now / 1000 }], false, now)).toBe(false);
  expect(hasRecentAuthentication([{ method: 'password', timestamp: now / 1000 + 5 }], false, now)).toBe(false);
});
it('rejects cross-site changes before any auth or mutation', async () => {
  expect((await deletion(request({ confirmation: 'DELETE' }, 'https://other.test'))).status).toBe(403);
  expect(mock.user).not.toHaveBeenCalled(); expect(mock.deleteUser).not.toHaveBeenCalled();
});
it('requires exact confirmation and rejects a supplied target user', async () => {
  expect((await deletion(request({ confirmation: 'delete' }))).status).toBe(400);
  expect((await deletion(request({ confirmation: 'DELETE', userId: 'bob' }))).status).toBe(400);
  expect(mock.deleteUser).not.toHaveBeenCalled();
});
it('rejects expired verification and never treats recovery URL parameters as proof', async () => {
  mock.getClaims.mockResolvedValue({ data: { claims: { sub: 'alice', amr: [{ method: 'token_refresh', timestamp: Math.floor(Date.now() / 1000) }] } } });
  expect((await password(request({ newPassword: 'new-password' }))).status).toBe(403);
  expect(mock.updateUser).not.toHaveBeenCalled();
});
it('does not mutate on wrong current password or a mismatched identity', async () => {
  mock.signIn.mockResolvedValue({ error: { message: 'wrong' }, data: { user: null } });
  expect((await password(request({ newPassword: 'new-password', currentPassword: 'wrong' }))).status).toBe(403);
  expect(mock.updateUser).not.toHaveBeenCalled();
  mock.getUser.mockResolvedValue({ data: { user: { id: 'bob' } }, error: null });
  expect((await deletion(request({ confirmation: 'DELETE' }))).status).toBe(401);
  expect(mock.deleteUser).not.toHaveBeenCalled();
});
it('changes password and revokes every session', async () => {
  const response = await password(request({ newPassword: 'new-password', currentPassword: 'old-password' }));
  expect(response.status).toBe(200); expect(mock.signIn).toHaveBeenCalledWith({ email: 'alice@example.test', password: 'old-password' });
  expect(mock.updateUser).toHaveBeenCalledWith({ password: 'new-password' }); expect(mock.signOut).toHaveBeenCalledWith({ scope: 'global' });
});
it('does not report success if password update or session revocation fails', async () => {
  mock.updateUser.mockResolvedValue({ error: { message: 'rejected' } });
  expect((await password(request({ newPassword: 'new-password' }))).status).toBe(400); expect(mock.signOut).not.toHaveBeenCalled();
  mock.updateUser.mockResolvedValue({ error: null }); mock.signOut.mockResolvedValue({ error: { message: 'network' } });
  expect((await password(request({ newPassword: 'new-password' }))).status).toBe(503);
});
it('deletes only the verified caller and clears local cookies', async () => {
  expect((await deletion(request({ confirmation: 'DELETE' }))).status).toBe(200);
  expect(mock.deleteUser).toHaveBeenCalledWith('alice'); expect(mock.signOut).toHaveBeenCalledWith({ scope: 'local' });
});
it('explains an open table rejection without reporting successful deletion', async () => {
  mock.deleteUser.mockResolvedValue({ error: { message: 'Database error deleting user' } });
  mock.lookup.mockResolvedValue({ data: [{ games: { status: 'active' } }], error: null });
  const response = await deletion(request({ confirmation: 'DELETE' }));
  expect(response.status).toBe(409); expect((await response.json() as { error: { code: string } }).error.code).toBe('ACCOUNT_HAS_OPEN_GAMES'); expect(mock.signOut).not.toHaveBeenCalled();
});
