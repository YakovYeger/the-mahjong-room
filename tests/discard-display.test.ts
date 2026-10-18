// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi, afterEach, describe, expect, it } from 'vitest';
import { createGame } from '../src/game/engine';
import { createWall } from '../src/game/tiles';
import type { Tile } from '../src/game/types';
import { DiscardPool } from '../src/table/discard-pool';
import { groupDiscards } from '../src/table/discard-groups';
import { OPENING_WALL_COUNT, WallMeter, wallSegments } from '../src/table/wall-meter';

import { AccessibilityProvider } from '../src/accessibility/provider';
import { AccessibilitySettings } from '../src/accessibility/settings';

beforeEach(() => { localStorage.clear(); vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} })); });
afterEach(() => vi.unstubAllGlobals());
const pool = (props: Parameters<typeof DiscardPool>[0]) => createElement(AccessibilityProvider, null, createElement(AccessibilitySettings), createElement(DiscardPool, props));
const dot = (id: string): Tile => ({ id, type: { kind: 'number', suit: 'dots', rank: 8 } });
const tiles: Tile[] = [dot('a'), { id: 'red', type: { kind: 'dragon', dragon: 'red' } }, dot('b'), { id: 'bam', type: { kind: 'number', suit: 'bamboo', rank: 8 } }, dot('claim')];
afterEach(cleanup);

describe('public discard identities', () => {
  it('groups exact natural identities without mutating order, merging suits, or assigning Jokers to natural groups', () => {
    const pool = Object.freeze([...tiles, { id: 'joker-a', type: { kind: 'joker' } } as Tile, { id: 'joker-b', type: { kind: 'joker' } } as Tile]);
    const groups = groupDiscards(pool);
    expect(groups.map(group => [group.key, group.copies.map(copy => copy.tile.id)])).toEqual([
      ['dots-8', ['a', 'b', 'claim']], ['dragon-red', ['red']], ['bamboo-8', ['bam']], ['joker', ['joker-a', 'joker-b']],
    ]);
    expect(groups[0].copies.map(copy => copy.position)).toEqual([1, 3, 5]);
    expect(pool.map(tile => tile.id)).toEqual(['a', 'red', 'b', 'bam', 'claim', 'joker-a', 'joker-b']);
  });
  it('keeps Winds and Dragons distinct while retaining all eight interchangeable Flower copies', () => {
    const honors = createWall().filter(tile => ['wind', 'dragon', 'flower'].includes(tile.type.kind));
    const groups = groupDiscards(honors);
    expect(groups.map(group => [group.key, group.copies.length])).toEqual([
      ['wind-north', 4], ['wind-east', 4], ['wind-south', 4], ['wind-west', 4],
      ['dragon-red', 4], ['dragon-green', 4], ['dragon-white', 4], ['flower-any', 8],
    ]);
    expect(groups.at(-1)!.copies.map(copy => copy.tile.type.kind === 'flower' ? copy.tile.type.index : null)).toEqual([1,2,3,4,5,6,7,8]);
  });
});

it('excludes only the live claim copy from counts and keeps its exact ID in individual order', async () => {
  const user = userEvent.setup();
  render(pool({ tiles, latestTileId: 'claim' }));
  expect(screen.queryByRole('tablist')).toBeNull();
  expect(document.querySelector('.table-discard-position')).toBeNull();
  expect(screen.getByText('Claim tile')).toBeTruthy();
  expect(screen.getByRole('listitem', { name: '8 Dot, 2 discarded copies' })).toBeTruthy();
  expect(screen.queryByRole('listitem', { name: '8 Dot, 3 discarded copies' })).toBeNull();
  await user.click(screen.getByRole('radio', { name: 'In order' }));
  const ordered = screen.getByRole('list', { name: /Individual discards/ });
  expect(within(ordered).getAllByRole('listitem').map(item => item.getAttribute('data-discard-id'))).toEqual(['a', 'red', 'b', 'bam', 'claim']);
  expect(within(ordered).getByRole('listitem', { name: '5. 8 Dot, current claim tile' })).toBeTruthy();
});
it('updates after claim removal or response resolution without confusing an older matching discard for the claim', async () => {
  const user = userEvent.setup();
  const { rerender } = render(pool({ tiles, latestTileId: 'claim' }));
  rerender(pool({ tiles: tiles.slice(0, -1) }));
  expect(screen.queryByText('Claim tile')).toBeNull();
  expect(screen.getByRole('listitem', { name: '8 Dot, 2 discarded copies' })).toBeTruthy();
  rerender(pool({ tiles }));
  expect(screen.getByRole('listitem', { name: '8 Dot, 3 discarded copies' })).toBeTruthy();
  await user.click(screen.getByRole('radio', { name: 'In order' }));
  rerender(pool({ tiles: [...tiles, dot('new')], latestTileId: 'new' }));
  expect(screen.getByRole('radio', { name: 'In order' }).getAttribute('aria-checked')).toBe('true');
  expect(screen.getByRole('listitem', { name: '6. 8 Dot, current claim tile' })).toBeTruthy();
});
it('supports preference selection, per-copy coach cues, an empty pool, and a single claim', async () => {
  const user = userEvent.setup();
  const { rerender } = render(pool({ tiles, highlightedTileIds: ['b'] }));
  expect(screen.getByRole('listitem', { name: '8 Dot, 3 discarded copies, coach focus on 1 copy' })).toBeTruthy();
  await user.click(screen.getByRole('radio', { name: 'In order' }));
  expect(screen.getByRole('listitem', { name: '3. 8 Dot, coach focus' })).toBeTruthy();
  rerender(pool({ tiles: [] }));
  expect(screen.getByText('No discards yet')).toBeTruthy();expect(screen.queryByRole('tablist')).toBeNull();
  rerender(pool({ tiles: [dot('only')], latestTileId: 'only' }));
  await user.click(screen.getByRole('radio', { name: 'Grouped' }));
  expect(screen.getByText('No earlier discards.')).toBeTruthy();
  expect(screen.getByText('Only this copy is current.')).toBeTruthy();
});

describe('compressed remaining wall', () => {
  it('accounts for every authoritative tile through the whole wall, with no filled backs when empty', () => {
    expect(createGame(417).wall.length).toBe(OPENING_WALL_COUNT);
    for (let count = 0; count <= 152; count++) {
      const segments = wallSegments(count);
      expect(segments).toHaveLength(10);
      expect(segments.reduce((sum, segment) => sum + segment.remaining, 0)).toBe(count);
      expect(segments.every(segment => segment.remaining >= 0 && segment.remaining <= segment.capacity)).toBe(true);
    }
    expect(wallSegments(0).every(segment => segment.remaining === 0)).toBe(true);
    expect(wallSegments(1).filter(segment => segment.remaining > 0)).toHaveLength(1);
  });
  it('exposes an exact readable count at opening, after draws, and at wall-game completion', () => {
    const { rerender } = render(createElement(WallMeter, { count: 99 }));
    expect(screen.getByRole('img', { name: '99 tiles remaining in the wall' })).toBeTruthy();
    rerender(createElement(WallMeter, { count: 1 }));expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByRole('img', { name: '1 tile remaining in the wall' })).toBeTruthy();
    rerender(createElement(WallMeter, { count: 0 }));expect(screen.getByText('wall empty')).toBeTruthy();
    expect(screen.getByRole('img', { name: '0 tiles remaining in the wall' })).toBeTruthy();
  });
});
