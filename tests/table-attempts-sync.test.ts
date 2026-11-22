// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useTableAttempts } from '../app/daily/table-reading/use-table-attempts';
import { dailyTableReading } from '../src/game/table-reading-catalog';
import { tableReadingPuzzle } from '../src/game/table-reading-puzzles';
import { tableAttemptKey } from '../src/game/weekly-table-stars';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });
const date = '2026-11-22';
const entry = dailyTableReading(date, date)!;
const choice = tableReadingPuzzle(entry.level, entry.scenario).choices[0].id;
const reply = (data: unknown, status = 200) => Promise.resolve({ ok: status === 200, status, json: async () => data });

it('imports guest attempts and clears them only after the account save succeeds', async () => {
  localStorage.setItem(tableAttemptKey(date), choice);
  const request = vi.fn().mockImplementationOnce(() => reply({ userId: 'one', attempts: {} }))
    .mockImplementationOnce(() => reply({ userId: 'one', attempts: { [date]: choice } }));
  vi.stubGlobal('fetch', request);
  const { result } = renderHook(() => useTableAttempts(date));
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.attempts[date]).toBe(choice);
  expect(localStorage.getItem(tableAttemptKey(date))).toBeNull();
  expect(JSON.parse(request.mock.calls[1][1].body).userId).toBe('one');
});

it('keeps failed saves pending for the correct account and retries them', async () => {
  const request = vi.fn().mockImplementation(() => reply({ userId: 'one', attempts: {} }));
  vi.stubGlobal('fetch', request);
  const { result } = renderHook(() => useTableAttempts(date));
  await waitFor(() => expect(result.current.ready).toBe(true));
  request.mockImplementation((_url, options) => options ? reply({}, 500) : reply({ userId: 'one', attempts: {} }));
  act(() => result.current.save(date, choice));
  await waitFor(() => expect(result.current.status).toContain('Couldn’t'));
  expect(localStorage.getItem('mahjong-room-pending-table-attempts-v1:one')).toContain(choice);
  request.mockImplementation(() => reply({ userId: 'one', attempts: { [date]: choice } }));
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.status).toBe('Saved to your account'));
  expect(localStorage.getItem('mahjong-room-pending-table-attempts-v1:one')).toBeNull();
});

it('does not load another account’s pending answers', async () => {
  localStorage.setItem('mahjong-room-pending-table-attempts-v1:one', JSON.stringify({ [date]: choice }));
  vi.stubGlobal('fetch', vi.fn(() => reply({ userId: 'two', attempts: {} })));
  const { result } = renderHook(() => useTableAttempts(date));
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.attempts).toEqual({});
  expect(localStorage.getItem('mahjong-room-pending-table-attempts-v1:one')).toContain(choice);
});

it('preserves guest answers when migration fails', async () => {
  localStorage.setItem(tableAttemptKey(date), choice);
  vi.stubGlobal('fetch', vi.fn((_url, options) => options
    ? reply({}, 500) : reply({ userId: 'one', attempts: {} })));
  const { result } = renderHook(() => useTableAttempts(date));
  await waitFor(() => expect(result.current.status).toContain('Couldn’t'));
  expect(localStorage.getItem(tableAttemptKey(date))).toBe(choice);
  expect(result.current.ready).toBe(false);
});
