import { beforeEach, expect, it, vi } from 'vitest';
import { requireUser } from '../src/server/auth';
const mock = vi.hoisted(() => ({ getClaims: vi.fn(), rpc: vi.fn() }));
vi.mock('../src/lib/supabase/server', () => ({ createSupabaseServerClient: async () => ({ auth: { getClaims: mock.getClaims } }) }));
vi.mock('../src/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc: mock.rpc }) }));
beforeEach(() => { mock.getClaims.mockReset(); mock.rpc.mockReset().mockResolvedValue({ data: true, error: null }); });
it('uses SDK-verified claims for identity and keeps metadata limited to display', async () => {
  mock.getClaims.mockResolvedValue({ data: { claims: { sub: '0005543d-7f3c-418c-a5b1-4ec31e011037', role: 'authenticated', session_id: '0005543d-7f3c-418c-a5b1-4ec31e011038', email: 'test@example.test', user_metadata: { full_name: 'Test' } } }, error: null });
  expect(await requireUser()).toEqual({ id: '0005543d-7f3c-418c-a5b1-4ec31e011037', email: 'test@example.test', user_metadata: { full_name: 'Test' } });
});
it.each([
  { data: null, error: { message: 'Invalid signature' } },
  { data: null, error: { message: 'Token expired' } },
  { data: { claims: { sub: 'not-an-id', role: 'authenticated' } }, error: null },
  { data: { claims: { sub: '0005543d-7f3c-418c-a5b1-4ec31e011037', role: 'anon' } }, error: null },
])('rejects invalid or unauthenticated identity', async (result) => {
  mock.getClaims.mockResolvedValue(result);
  await expect(requireUser()).rejects.toMatchObject({ status: 401, code: 'AUTH_REQUIRED' });
});

it('rejects a revoked session even when its token still verifies', async () => {
  mock.getClaims.mockResolvedValue({ data: { claims: { sub: '0005543d-7f3c-418c-a5b1-4ec31e011037', role: 'authenticated', session_id: '0005543d-7f3c-418c-a5b1-4ec31e011038' } } });
  mock.rpc.mockResolvedValue({ data: false, error: null });
  await expect(requireUser()).rejects.toMatchObject({ status: 401 });
});
it('fails closed when the session service is unavailable', async () => {
  mock.getClaims.mockResolvedValue({ data: { claims: { sub: '0005543d-7f3c-418c-a5b1-4ec31e011037', role: 'authenticated', session_id: '0005543d-7f3c-418c-a5b1-4ec31e011038' } } });
  mock.rpc.mockResolvedValue({ data: null, error: { message: 'unavailable' } });
  await expect(requireUser()).rejects.toMatchObject({ status: 503 });
});
