import { beforeEach, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({
  auth: { getUser: vi.fn() }, from: vi.fn(),
}));
vi.mock('../src/lib/supabase/server', () => ({ createSupabaseServerClient: async () => client }));
import { GET, POST } from '../app/api/puzzles/table-reading/route';
import { dailyTableReading } from '../src/game/table-reading-catalog';
import { tableReadingPuzzle } from '../src/game/table-reading-puzzles';

const request = (body: unknown) => new Request('http://localhost/api/puzzles/table-reading', {
  method: 'POST', body: JSON.stringify(body),
});
beforeEach(() => { vi.clearAllMocks(); client.auth.getUser.mockResolvedValue({ data: { user: { id: 'one' } }, error: null }); });

it('requires authentication for reads and writes', async () => {
  client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await GET()).status).toBe(401);
  expect((await POST(request({}))).status).toBe(401);
  expect(client.from).not.toHaveBeenCalled();
});

it('rejects account changes and invalid puzzle answers before writing', async () => {
  expect((await POST(request({ userId: 'two', attempts: {} }))).status).toBe(409);
  expect((await POST(request({ userId: 'one', attempts: { '2026-02-30': 'tile-0' } }))).status).toBe(400);
  expect(client.from).not.toHaveBeenCalled();
});

it('uses the authenticated owner, ignores repeated answers and returns the canonical first answer', async () => {
  const date = '2026-11-22';
  const entry = dailyTableReading(date, date)!;
  const choices = tableReadingPuzzle(entry.level, entry.scenario).choices;
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const eq = vi.fn().mockResolvedValue({ data: [{ puzzle_date: date, tile_id: choices[0].id }], error: null });
  client.from.mockReturnValue({ upsert, select: () => ({ eq }) });
  const response = await POST(request({ userId: 'one', attempts: { [date]: choices[1].id } }));
  expect(upsert).toHaveBeenCalledWith([{ user_id: 'one', puzzle_date: date, tile_id: choices[1].id }], { onConflict: 'user_id,puzzle_date', ignoreDuplicates: true });
  expect(eq).toHaveBeenCalledWith('user_id', 'one');
  const saved = await response.json() as { attempts: Record<string, string> };
  expect(saved.attempts[date]).toBe(choices[0].id);
});
