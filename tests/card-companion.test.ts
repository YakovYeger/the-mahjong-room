// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { CardCompanion, HandCheck } from '../src/table/card-companion';
import { TrainingCardProvider, cardTileKey } from '../src/game/training-card';
import { createWall } from '../src/game/tiles';

const hand = TrainingCardProvider.getHands().find(hand => hand.id === 'evening-dots')!;
const wall = createWall();
const rack = hand.groups.flatMap(group => wall.filter(tile => cardTileKey(tile) === group.tileKey).slice(0, group.count)).reverse();
// jsdom has no layout; Base UI's focus guards need visible client rects.
beforeEach(() => { vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([new DOMRect(0, 0, 100, 40)] as unknown as DOMRectList); });
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

it('pins a hand, arranges only rack tiles, and restores the preference on remount', () => {
  const arrange = vi.fn();
  const change = vi.fn();
  const props = { rack, exposures: [], storageKey: 'companion-test', onArrange: arrange, open: true, onOpenChange: change };
  const view = render(createElement(CardCompanion, props));
  fireEvent.click(screen.getAllByRole('button', { name: 'Follow this hand →' })[1]);
  expect(change).toHaveBeenCalledWith(false);
  view.rerender(createElement(CardCompanion, { ...props, open: false }));
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
it('closes the card browser with Escape and returns focus to its trigger', async () => {
  const close = vi.fn();
  const trigger = document.createElement('button'); document.body.appendChild(trigger); trigger.focus();
  const props = { rack, exposures: [], storageKey: 'focus-test', onArrange: vi.fn(), open: true, onOpenChange: close };
  const view = render(createElement(CardCompanion, props));
  await waitFor(() => expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true));
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(close).toHaveBeenCalledWith(false);
  view.rerender(createElement(CardCompanion, { ...props, open: false }));
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  trigger.remove();
});

it('contains keyboard focus in the card picker and retains candidates after pinning', async () => {
  const user = userEvent.setup();
  const props = { rack, exposures: [], storageKey: 'choices-test', onArrange: vi.fn(), open: true, onOpenChange: vi.fn() };
  const view = render(createElement(CardCompanion, props));
  const close = screen.getByRole('button', { name: 'Close card browser' });
  const followButtons = screen.getAllByRole('button', { name: 'Follow this hand →' });
  await waitFor(() => expect(document.activeElement).toBe(close));
  followButtons.at(-1)!.focus();
  await user.tab();
  await waitFor(() => expect(document.activeElement).toBe(close));
  await user.tab({ shift: true });
  await waitFor(() => expect(document.activeElement).toBe(followButtons.at(-1)));
  fireEvent.click(followButtons[1]);
  view.rerender(createElement(CardCompanion, { ...props, open: false }));
  expect(view.container.querySelectorAll('.companion-suggestions button')).toHaveLength(3);
  expect(view.container.querySelector('.companion-pattern')).toBeTruthy();
  const fit = view.container.querySelector<HTMLDetailsElement>('.companion-fit')!;
  expect(fit.open).toBe(false);
  expect(fit.querySelector('.hand-comparison')).toBeTruthy();
});
