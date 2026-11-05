// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { charlestonArrival, passDirection, useCharlestonArrival } from '../src/table/charleston-motion';
import type { GameEvent, Tile } from '../src/game/types';
const tile = (id: string): Tile => ({ id, type: { kind: 'wind', wind: 'east' } });
const source = { id: 'g', sequence: 5, rack: [tile('kept'), tile('new')], events: [{ type: 'CHARLESTON_PASS_COMPLETED', sequence: 5, direction: 'right' }] as GameEvent[] };
afterEach(() => vi.useRealTimers());
it('uses only newly received tiles after a completed pass, including courtesy', () => {
  expect(charlestonArrival(source, 4, ['kept', 'sent'])).toEqual({ id: 5, tileIds: ['new'], direction: 'right' });
  expect(charlestonArrival(source, 5, ['kept'])).toBeNull();
  expect(charlestonArrival(source, 4, ['kept', 'new'])).toBeNull();
  expect(charlestonArrival({ ...source, events: [{ type: 'TILES_PASSED', sequence: 5, playerId: 'other', tileIds: ['new'] }] }, 4, ['kept'])).toBeNull();
  expect(charlestonArrival({ ...source, events: [{ type: 'COURTESY_PASS_COMPLETED', sequence: 5 }] }, 4, ['kept'])?.direction).toBe('across');
});
it('maps the two Charleston rounds and courtesy to table directions', () => {
  expect([0,1,2,3,4,5].map(i => passDirection(i))).toEqual(['right','across','left','left','across','right']);
  expect(passDirection(0, true)).toBe('across');
});
it('baselines saved racks, handles pending racks, ignores duplicates and cleans up', () => {
  vi.useFakeTimers();
  const { result, rerender, unmount } = renderHook(({ value }) => useCharlestonArrival(value), { initialProps: { value: source } });
  expect(result.current).toBeNull();
  rerender({ value: { ...source, sequence: 6, rack: [tile('kept')], events: [] } });
  expect(result.current).toBeNull();
  rerender({ value: { ...source, sequence: 7, events: [{ type: 'CHARLESTON_PASS_COMPLETED', sequence: 7, direction: 'left' }] } });
  expect(result.current?.tileIds).toEqual(['new']);
  act(() => vi.advanceTimersByTime(1800));
  expect(result.current).toBeNull();
  rerender({ value: { ...source, sequence: 7 } });
  expect(result.current).toBeNull();
  unmount(); expect(vi.getTimerCount()).toBe(0);
});
