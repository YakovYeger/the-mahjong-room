// @vitest-environment jsdom
import { createElement } from 'react';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CelebrationLayer, celebrationFor, useCelebration, type CelebrationSource } from '../src/table/celebration';
const base: CelebrationSource = { id: 'game', sequence: 1, events: [], viewerId: 'me', rack: [{ id: 'j', type: { kind: 'joker' } }], players: [{ id: 'me', name: 'You' }, { id: 'other', name: 'Rose' }] };
const preferences = vi.hoisted(() => ({ reducedMotion: false }));
vi.mock('../src/accessibility/provider', () => ({ useAccessibility: () => preferences }));
afterEach(() => { cleanup(); preferences.reducedMotion = false; vi.useRealTimers(); });
it('rewards an awarded call, not a pending claim, including another player', () => {
  expect(celebrationFor({ ...base, events: [{ type: 'CALL_RESPONSE_RECORDED', sequence: 2, playerId: 'me', response: 'exposure' }] }, 1)).toBeNull();
  expect(celebrationFor({ ...base, events: [{ type: 'EXPOSURE_CREATED', sequence: 3, playerId: 'other', exposureId: 'e', kind: 'kong' }] }, 1)).toMatchObject({ kind: 'call', title: 'kong!', detail: 'Rose makes a call.' });
});
it('only rewards a newly drawn Joker belonging to the viewer', () => {
  for (const [playerId, tileId] of [['other', 'j'], ['me', 'natural']]) {
    expect(celebrationFor({ ...base, events: [{ type: 'TILE_DRAWN', sequence: 2, playerId, tileId }] }, 1)).toBeNull();
  }
  const source: CelebrationSource = { ...base, events: [{ type: 'TILE_DRAWN', sequence: 2, playerId: 'me', tileId: 'j' }] };
  expect(celebrationFor(source, 1)?.kind).toBe('joker');
  expect(celebrationFor(source, 2)).toBeNull();
});
it('gives confirmed Mahjong priority and never celebrates a drawn game', () => {
  expect(celebrationFor({ ...base, events: [{ type: 'GAME_COMPLETED', sequence: 2, winnerId: null }] }, 1)).toBeNull();
  expect(celebrationFor({ ...base, events: [{ type: 'TILE_DRAWN', sequence: 2, playerId: 'me', tileId: 'j' }, { type: 'MAHJONG_DECLARED', sequence: 3, playerId: 'other' }] }, 1)).toMatchObject({ kind: 'mahjong', detail: 'Rose takes the hand. What a finish!' });
});
it('baselines hydration, ignores stale/repeated snapshots, expires and cleans up', () => {
  vi.useFakeTimers();
  const won: CelebrationSource = { ...base, sequence: 4, events: [{ type: 'MAHJONG_DECLARED', sequence: 4, playerId: 'me' }] };
  const { result, rerender, unmount } = renderHook(({ source }) => useCelebration(source), { initialProps: { source: won } });
  expect(result.current).toBeNull();
  rerender({ source: { ...base, sequence: 5, events: [{ type: 'TILE_DRAWN', sequence: 5, playerId: 'me', tileId: 'j' }] } });
  expect(result.current?.kind).toBe('joker');
  act(() => vi.advanceTimersByTime(2800));
  expect(result.current).toBeNull();
  rerender({ source: won });
  expect(result.current).toBeNull();
  rerender({ source: { ...won, sequence: 6, events: [{ type: 'MAHJONG_DECLARED', sequence: 6, playerId: 'me' }] } });
  expect(result.current?.kind).toBe('mahjong');
  rerender({ source: { ...won, id: 'new-game' } });
  expect(result.current).toBeNull();
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('keeps a readable reward but removes fireworks with reduced motion', () => {
  preferences.reducedMotion = true;
  render(createElement(CelebrationLayer, { celebration: { id: 1, kind: 'mahjong', title: 'Mahjong!', detail: 'Beautifully played.' } }));
  expect(document.querySelector('[role="status"]')?.textContent).toContain('Mahjong!');
  expect(document.querySelector('.celebration-still')).not.toBeNull();
  expect(document.querySelector('.celebration-effects')).toBeNull();
});
