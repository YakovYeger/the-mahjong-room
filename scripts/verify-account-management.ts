// Opt-in isolated-backend verification. Refuses production URLs and creates only
// disposable fixture accounts. Put local credentials in an ignored .env* file.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const env = parseEnv(readFileSync(process.argv[2] ?? '.env.account-test.local', 'utf8'));
const origin = env.ACCOUNT_TEST_ORIGIN ?? 'http://localhost:5183';
const backend = env.NEXT_PUBLIC_SUPABASE_URL;
assert.ok(backend && env.SUPABASE_SECRET_KEY, 'Local Supabase settings are required');
for (const url of [origin, backend]) assert.ok(['localhost', '127.0.0.1'].includes(new URL(url).hostname), 'Account verification only runs against localhost');
const admin = createClient(backend, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const email = `account-check-${randomUUID()}@example.test`;
const initialPassword = randomUUID(); const changedPassword = randomUUID();
let cookie = ''; let userId = '';
async function request(path: string, body?: unknown, selectedCookie = cookie) {
  const response = await fetch(origin + path, { method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(20_000),
    headers: { cookie: selectedCookie, origin, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const nextCookies = response.headers.getSetCookie();
  if (nextCookies.length) cookie = nextCookies.map(value => value.split(';')[0]).join('; ');
  return { response, data: await response.json() as { error?: { code: string }; profile?: { display_name: string }; game?: { id: string } } };
}
try {
  const created = await admin.auth.admin.createUser({ email, password: initialPassword, email_confirm: true, user_metadata: { username: `ac_${randomUUID().slice(0,8)}` } });
  assert.ifError(created.error); assert.ok(created.data.user); userId = created.data.user.id;
  const login = await request('/api/auth/login', { identifier: email, password: initialPassword }, '');
  assert.equal(login.response.status, 200, `Login failed: ${login.data.error?.code ?? 'unknown'}`);
  const oldCookie = cookie;
  assert.equal((await request('/api/account')).response.status, 200);
  assert.equal((await request('/api/account', { displayName: 'Account check player' })).response.status, 200);
  assert.equal((await request('/api/account')).data.profile?.display_name, 'Account check player');
  assert.equal((await request('/api/account/password', { currentPassword: 'wrong', newPassword: changedPassword })).response.status, 403);
  assert.equal((await request('/api/account/password', { currentPassword: initialPassword, newPassword: changedPassword })).response.status, 200);
  assert.equal((await request('/api/account', undefined, oldCookie)).response.status, 401, 'Revoked token must be rejected immediately');
  assert.equal((await request('/api/auth/login', { identifier: email, password: initialPassword }, '')).response.status, 400);
  assert.equal((await request('/api/auth/login', { identifier: email, password: changedPassword }, '')).response.status, 200);
  const recovery = await admin.auth.admin.generateLink({ type: 'recovery', email });
  assert.ifError(recovery.error); assert.ok(recovery.data.properties);
  const link = `/auth/confirm?token_hash=${encodeURIComponent(recovery.data.properties.hashed_token)}&type=recovery&recovery=1`;
  const recovered = await fetch(origin + link, { redirect: 'manual', signal: AbortSignal.timeout(20_000) });
  assert.ok(recovered.headers.get('location')?.includes('recovery=1'));
  cookie = recovered.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const reused = await fetch(origin + link, { redirect: 'manual', signal: AbortSignal.timeout(20_000) });
  assert.ok(reused.headers.get('location')?.includes('auth_error=invalid_link'), 'Recovery links must be single-use');
  assert.equal((await request('/api/account/password', { newPassword: initialPassword })).response.status, 200, 'Recovery proof must allow resetting without old password');
  assert.equal((await request('/api/auth/login', { identifier: email, password: initialPassword }, '')).response.status, 200);
  const room = await request('/api/games', { mode: 'live' }); assert.equal(room.response.status, 201); assert.ok(room.data.game);
  assert.equal((await request(`/api/games/${room.data.game.id}/start`, {})).response.status, 200);
  assert.equal((await request('/api/account/delete', { confirmation: 'DELETE', currentPassword: initialPassword })).response.status, 409);
  assert.equal((await request(`/api/games/${room.data.game.id}/end`, {})).response.status, 200);
  const beforeDelete = cookie;
  assert.equal((await request('/api/account/delete', { confirmation: 'DELETE', currentPassword: initialPassword })).response.status, 200);
  assert.equal((await request('/api/account', undefined, beforeDelete)).response.status, 401);
  const deleted = await admin.auth.admin.getUserById(userId); assert.ok(deleted.error, 'Auth account must be removed');
  const owned = await admin.from('games').select('id').eq('owner_id', userId); assert.ifError(owned.error); assert.equal(owned.data?.length, 0);
  const profile = await admin.from('profiles').select('user_id').eq('user_id', userId); assert.ifError(profile.error); assert.equal(profile.data?.length, 0);
  console.log('Account API verification passed: profile, password, revoked sessions, single-use recovery, open-table guard, account deletion.');
} finally {
  if (userId) {
    // This runner owns the fixture user and tables. Clean up on failure as well.
    await admin.from('games').delete().eq('owner_id', userId);
    await admin.auth.admin.deleteUser(userId);
  }
}
