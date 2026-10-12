// @vitest-environment jsdom
import { createElement, useMemo } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CoachPanel } from '../src/coach/coach-panel';
import { useCoach } from '../src/coach/use-coach';
import { getCoachVisibleContext } from '../src/coach/analyze';
import { createCoachPreview } from '../src/coach/design-fixtures';
import { CardCompanion } from '../src/table/card-companion';
import { assessCoachSelection, createCoachSession } from '../src/coach/recommend';

afterEach(() => { cleanup(); localStorage.clear(); });
function Integrated({ version = 'sets' }: { version?: 'sets' | 'pairs' | 'blocked' }) {
  const game = useMemo(() => createCoachPreview(version), [version]);
  const context = useMemo(() => getCoachVisibleContext(game, 'human')!, [game]);
  const coach = useCoach(context, 'integration:human', 'discard');
  return createElement('div', null,
    coach.session && createElement(CoachPanel, { session: coach.session, show: coach.show, onShowChange: coach.setShow, onFocusGroup: coach.focusGroup, focusGroupId: coach.focusGroupId, onFollow: coach.follow, onBrowse: vi.fn() }),
    createElement(CardCompanion, { rack: context.rack, exposures: [], storageKey: 'integration:human', open: false, onOpenChange: vi.fn(), onArrange: vi.fn(), highlightedGroupIds: coach.highlights.groupIds, blockedHandIds: coach.session?.plan.blockedHandIds }),
    createElement('output', { 'data-testid': 'roles' }, JSON.stringify(coach.highlights)),
  );
}
it('synchronizes card following with coach advice and highlights without selecting a game move', () => {
  render(createElement(Integrated));
  fireEvent.click(screen.getByRole('button', { name: /Evening Dots.*10\/14/ }));
  expect(screen.getByText('Coach · Your chosen direction')).toBeTruthy();
  fireEvent.click(screen.getByText('Your hand plan', { exact: false }));
  fireEvent.click(screen.getByRole('button', { name: 'Show 4 Dot pung on table, 0 missing' }));
  const roles = JSON.parse(screen.getByTestId('roles').textContent!);
  expect(roles.groupIds).toEqual(['d4']);
  expect(roles.publicTileIds).toHaveLength(1);
  expect(Object.values(roles.rack)).toContain('focus');
  expect(document.querySelector('.companion-pattern .coach-pattern-focus')).toBeTruthy();
  expect(screen.getByText(/Highlights guide you; select tiles yourself/)).toBeTruthy();
});
it('clears the displayed focus when the rack and hand plan change', () => {
  const view = render(createElement(Integrated));
  fireEvent.click(screen.getByText('Your hand plan', { exact: false }));
  fireEvent.click(screen.getByRole('button', { name: 'Show 4 Dot pung on table, 0 missing' }));
  view.rerender(createElement(Integrated, { version: 'pairs' }));
  expect(JSON.parse(screen.getByTestId('roles').textContent!).groupIds).toEqual([]);
});
it('assesses the player’s tentative removal against the chosen line', () => {
  const game = createCoachPreview('pairs');
  const context = { ...getCoachVisibleContext(game, 'human')!, followedHandId: 'garden-path' };
  const session = createCoachSession(context, 'discard');
  const joker = context.rack.find(tile => tile.type.kind === 'joker')!;
  expect(assessCoachSelection(context, session, [joker.id])).toContain('preserves all 13 matched slots');
  expect(assessCoachSelection(context, session, [context.rack[0].id])).toContain('gives up 1 matched slot');
});

it('filters publicly blocked lines out of the card’s closest-hand suggestions', () => {
  render(createElement(Integrated, { version: 'blocked' }));
  expect(screen.getByText('Closest available hands')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Garden Path.*11\/14/ })).toBeNull();
});
