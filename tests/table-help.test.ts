// @vitest-environment jsdom
import { createElement, useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { TableHelp } from '../src/table/table-help';
import { CardCompanion } from '../src/table/card-companion';
import { createGame } from '../src/game/engine';
import { getCoachVisibleContext } from '../src/coach/analyze';
import { createCoachSession } from '../src/coach/recommend';

afterEach(() => { cleanup(); localStorage.clear(); });

it('keeps advice off the table until requested, then returns focus when showing highlights', async () => {
  const user = userEvent.setup();
  const show = vi.fn();
  const context = getCoachVisibleContext(createGame(417), 'human')!;
  const session = createCoachSession(context, 'charleston-pass', 3);
  render(createElement(TableHelp, { coach: { session, show: false, onShowChange: show, focusGroupId: null, onFocusGroup: vi.fn(), onFollow: vi.fn(), onBrowse: vi.fn() } }, null));
  expect(screen.queryByText(session.recommendation.headline)).toBeNull();
  const trigger = screen.getByRole('button', { name: /Need a hint/ });
  await user.click(trigger);
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.getByText(session.recommendation.headline, { selector: 'h2' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Show on table' }));
  expect(show).toHaveBeenCalledWith(true);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

function CompactCard() {
  const [open, setOpen] = useState(false);
  const game = createGame(417);
  return createElement('div', null,
    createElement('button', { onClick: () => setOpen(true) }, 'Open card from header'),
    createElement(CardCompanion, { compact: true, cardId: 'training-card', rack: game.players[0].rack, exposures: [], storageKey: 'compact-card-test', open, onOpenChange: setOpen, onArrange: vi.fn() }));
}

it('keeps card browsing available from the header while the compact hand plan is closed', async () => {
  const user = userEvent.setup();
  render(createElement(CompactCard));
  expect(screen.queryByText('Closest hands')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Open card from header' }));
  expect(screen.getByRole('dialog', { name: 'Training Card' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Close card browser' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await user.click(screen.getByRole('button', { name: /Your hand Find a pattern/ }));
  expect(screen.getByRole('dialog', { name: 'Your hand plan' })).toBeTruthy();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
