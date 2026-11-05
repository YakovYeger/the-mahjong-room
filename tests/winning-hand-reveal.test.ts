// @vitest-environment jsdom
import { createElement } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WinningHandReveal, winningGroupLayout } from '../src/table/winning-hand-reveal';
import { getCardProvider } from '../src/game/cards';
import { cardTileKey } from '../src/game/training-card';
import { createWall } from '../src/game/tiles';
import type { Exposure } from '../src/game/types';
const preferences = vi.hoisted(() => ({ reducedMotion: false }));
vi.mock('../src/accessibility/provider', () => ({ useAccessibility: () => preferences }));
const hand = getCardProvider('photo-2025').getHands().find(hand => hand.section === 'Quints')!;
const wall = createWall();
const rack = [...hand.groups].sort((a,b) => Number(a.jokerAllowed)-Number(b.jokerAllowed)).flatMap(group => Array.from({ length: group.count }, () => {
 let i = wall.findIndex(tile => cardTileKey(tile) === group.tileKey);
 if (i < 0 && group.jokerAllowed) i = wall.findIndex(tile => tile.type.kind === 'joker');
 return wall.splice(i,1)[0];
}));
afterEach(() => { cleanup(); preferences.reducedMotion = false; vi.unstubAllGlobals(); });
it('reveals every confirmed winning tile once in legal groups, including Jokers', () => {
 const layout = winningGroupLayout(rack, [], 'photo-2025')!;
 expect(layout).not.toBeNull();
 const ids = layout.groups.flatMap(g => g.slots.map(t => t!.id));
 expect(ids).toHaveLength(14); expect(new Set(ids).size).toBe(14);
 expect(new Set(ids)).toEqual(new Set(rack.map(t => t.id)));
 expect(winningGroupLayout(rack.slice(1), [], 'photo-2025')).toBeNull();
 const group = layout.groups.find(g => g.required.kind === 'quint')!;
 const exposure: Exposure = { id: 'set', kind: 'quint', tiles: group.slots.map(t => t!), calledFromPlayerId: 'other' };
 const remaining = rack.filter(t => !exposure.tiles.some(e => e.id === t.id));
 expect(winningGroupLayout(remaining, [exposure], 'photo-2025')?.groups.some(g => g.exposed)).toBe(true);
});
it('waits for the finale and visibility, plays once, and offers a replay', () => {
 let visible: IntersectionObserverCallback = () => {};
 const disconnect = vi.fn();
 vi.stubGlobal('IntersectionObserver', class { constructor(callback: IntersectionObserverCallback) { visible = callback; } observe() {} disconnect = disconnect; });
 const props = { rack, exposures: [], cardId: 'photo-2025' as const, waiting: true };
 const view = render(createElement(WinningHandReveal, props));
 expect(document.querySelector('.winning-reveal-playing')).toBeNull();
 view.rerender(createElement(WinningHandReveal, { ...props, waiting: false }));
 act(() => visible([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver));
 expect(document.querySelector('.winning-reveal-playing')).not.toBeNull();
 expect(disconnect).toHaveBeenCalled();
 expect((view.getByRole('button', { name: 'Replay winning hand reveal' }) as HTMLButtonElement).disabled).toBe(false);
});
it('keeps all tiles readable with reduced motion and no replay animation', () => {
 preferences.reducedMotion = true;
 render(createElement(WinningHandReveal, { rack, exposures: [], cardId: 'photo-2025' }));
 expect(document.querySelectorAll('.winning-reveal-tile')).toHaveLength(14);
 expect(document.querySelector('.winning-reveal-playing')).toBeNull();
 expect(document.querySelector('button')).toBeNull();
});
