// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CardCompanion, HandCheck } from '../src/table/card-companion';
import { TrainingCardProvider, cardTileKey } from '../src/game/training-card';
import { createWall } from '../src/game/tiles';

const hand = TrainingCardProvider.getHands().find(hand => hand.id === 'evening-dots')!;
const wall = createWall();
const rack = hand.groups.flatMap(group => wall.filter(tile => cardTileKey(tile) === group.tileKey).slice(0, group.count)).reverse();
afterEach(() => { cleanup(); localStorage.clear(); });

it('pins a hand, arranges only rack tiles, and restores the preference on remount', () => {
  const arrange = vi.fn();
  const change = vi.fn();
  const props = { rack, exposures: [], storageKey: 'companion-test', onArrange: arrange, open: true, onOpenChange: change };
  const view = render(createElement(CardCompanion, props));
  fireEvent.click(screen.getAllByRole('button', { name: 'Follow this hand →' })[1]);
  expect(change).toHaveBeenCalledWith(false);
  expect(screen.getByText('✓ Valid hand')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Arrange rack by this hand' }));
  const ordered: string[] = arrange.mock.calls[0][0];
  expect(ordered).toHaveLength(14);
  expect(new Set(ordered)).toEqual(new Set(rack.map(tile => tile.id)));
  expect(rack.find(tile => tile.id === ordered[0])?.type).toEqual({ kind: 'number', suit: 'dots', rank: 2 });
  view.unmount();
  render(createElement(CardCompanion, { ...props, open: false }));
  expect(screen.getByText('Following this hand')).toBeTruthy();
  expect(screen.getByText('✓ Valid hand')).toBeTruthy();
});
it('automatically finds a valid final hand and explains an incomplete hand', () => {
  const view = render(createElement(HandCheck, { rack, exposures: [], storageKey: 'review-test' }));
  expect(screen.getByText('✓ Valid hand')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Evening Dots' })).toBeTruthy();
  view.rerender(createElement(HandCheck, { rack: rack.slice(1), exposures: [], storageKey: 'review-test' }));
  expect(screen.getByText(/Missing:/)).toBeTruthy();
  expect(screen.queryByText('✓ Valid hand')).toBeNull();
});
it('closes the card browser with Escape and returns focus to its trigger', () => {
  const close = vi.fn();
  const trigger = document.createElement('button'); document.body.appendChild(trigger); trigger.focus();
  const view = render(createElement(CardCompanion, { rack, exposures: [], storageKey: 'focus-test', onArrange: vi.fn(), open: true, onOpenChange: close }));
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Choose a hand to follow');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(close).toHaveBeenCalledWith(false);
  view.unmount();
  expect(document.activeElement).toBe(trigger);
  trigger.remove();
});
