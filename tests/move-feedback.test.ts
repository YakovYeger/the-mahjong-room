// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { captureJokerExchange, captureMove, moveCue, useMoveFeedback } from '../src/table/move-feedback';
import type { Tile } from '../src/game/types';

const preferences = vi.hoisted(() => ({ reducedMotion: false }));
vi.mock('../src/accessibility/provider', () => ({ useAccessibility: () => preferences }));
afterEach(() => { cleanup(); vi.useRealTimers(); preferences.reducedMotion = false; document.body.innerHTML = ''; });
const tile: Tile = { id: 'known-tile', type: { kind: 'number', suit: 'bamboo', rank: 3 } };

it('only flies known selected tiles and does not celebrate a pass-on-discard or a Mahjong claim', () => {
  expect(moveCue({ type: 'PASS_TILES', tileIds: ['known-tile', 'not-in-rack'] }, [tile])).toEqual({ kind: 'pass', tiles: [tile] });
  expect(moveCue({ type: 'COURTESY_PASS', tileIds: [] }, [tile])).toBeNull();
  expect(moveCue({ type: 'PASS_ON_DISCARD' }, [tile])).toBeNull();
  expect(moveCue({ type: 'DECLARE_MAHJONG' }, [tile])).toBeNull();
});

it('captures the actual selected tile position before a rack update removes it', () => {
  const slot = document.createElement('div'); slot.dataset.sortableId = tile.id;
  const button = document.createElement('button'); slot.appendChild(button); document.body.appendChild(slot);
  const destination = document.createElement('div'); destination.className = 'table-latest-tile'; document.body.appendChild(destination);
  button.getBoundingClientRect = () => new DOMRect(40, 500, 48, 72);
  destination.getBoundingClientRect = () => new DOMRect(200, 150, 48, 72);
  const receipt = captureMove('discard', [tile]);
  slot.remove();
  expect(receipt.flights).toEqual([{ tile, x: 40, y: 500, width: 48, dx: 160, dy: -350 }]);
});

it('replaces feedback without an older timer clearing the newer reward', () => {
  vi.useFakeTimers();
  const { result, unmount } = renderHook(useMoveFeedback);
  expect(result.current.feedback).toBeNull();
  act(() => result.current.celebrate('draw'));
  const firstId = result.current.feedback!.id;
  act(() => vi.advanceTimersByTime(800));
  act(() => result.current.celebrate('arrange'));
  expect(result.current.feedback!.id).toBeGreaterThan(firstId);
  act(() => vi.advanceTimersByTime(500));
  expect(result.current.feedback?.kind).toBe('arrange');
  act(() => vi.advanceTimersByTime(700));
  expect(result.current.feedback).toBeNull();
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('does not create flight animations or reward timers with reduced motion', () => {
  vi.useFakeTimers(); preferences.reducedMotion = true;
  const { result } = renderHook(useMoveFeedback);
  act(() => result.current.celebrate('discard', [tile]));
  act(() => result.current.play({ kind: 'arrange', flights: [] }));
  expect(result.current.feedback).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});

it('sends Charleston tiles toward the correct player, rather than the discard pile', () => {
  const slot = document.createElement('div'); slot.dataset.sortableId = tile.id;
  const button = document.createElement('button'); slot.appendChild(button); document.body.appendChild(slot);
  button.getBoundingClientRect = () => new DOMRect(40, 500, 48, 72);
  for (const [direction, position, x] of [['right','right',300], ['left','left',30], ['across','top',160]] as const) {
    const seat = document.createElement('div'); seat.className = `table-seat-${position}`; document.body.appendChild(seat);
    seat.getBoundingClientRect = () => new DOMRect(x, 70, 48, 48);
    expect(captureMove('pass', [tile], direction).flights[0]).toMatchObject({ dx: x - 40, dy: -442 });
    seat.remove();
  }
});

it('captures a two-way Joker trade using only a known rack tile and a public target', () => {
  const action = { type: 'EXCHANGE_JOKER' as const, rackTileId: tile.id, jokerTileId: 'public-joker', exposureId: 'set', exposureOwnerId: 'other' };
  expect(captureJokerExchange(action, [tile]).flights).toEqual([]);
  const slot = document.createElement('div'); slot.dataset.sortableId = tile.id;
  const button = document.createElement('button'); slot.appendChild(button); document.body.appendChild(slot);
  const target = document.createElement('span'); target.dataset.publicTileId = action.jokerTileId; document.body.appendChild(target);
  button.getBoundingClientRect = () => new DOMRect(40, 500, 48, 72);
  target.getBoundingClientRect = () => new DOMRect(200, 150, 32, 48);
  const receipt = captureJokerExchange(action, [tile]);
  expect(receipt.returningId).toBe('public-joker');
  expect(receipt.flights[0]).toMatchObject({ tile, dx: 152, dy: -362 });
  expect(receipt.flights[1]).toMatchObject({ tile: { id: 'public-joker', type: { kind: 'joker' } }, dx: -152, dy: 362, returning: true });
  expect(captureJokerExchange({ ...action, rackTileId: 'hidden' }, [tile]).flights).toEqual([]);
});
