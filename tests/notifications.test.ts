import { expect, it, vi } from 'vitest';
import { GET } from '../app/api/notifications/route';
const query = vi.hoisted(() => ({ select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn() }));
vi.mock('../src/server/auth', () => ({ requireUser: async () => ({ id: 'test' }) }));
vi.mock('../src/lib/supabase/server', () => ({ createSupabaseServerClient: async () => ({ from: () => query }) }));
it('limits the turn inbox to active related games without exposing the join object', async () => {
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockReturnValue(query);
  query.limit.mockResolvedValue({ data: [{ id: 'notice', game_id: 'game', kind: 'turn_started', payload: {}, read_at: null, created_at: '2026-10-11T00:00:00Z', games: { status: 'active' } }], error: null });
  const response = await GET();
  expect(response.status).toBe(200);
  expect(query.select).toHaveBeenCalledWith(expect.stringContaining('games!inner(status)'));
  expect(query.eq).toHaveBeenCalledWith('games.status', 'active');
  expect(await response.json()).toEqual({ notifications: [{ id: 'notice', game_id: 'game', kind: 'turn_started', payload: {}, read_at: null, created_at: '2026-10-11T00:00:00Z' }] });
});
