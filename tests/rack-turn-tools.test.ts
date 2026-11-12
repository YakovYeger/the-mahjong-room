// @vitest-environment jsdom
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { GameExperience } from '../app/game-experience';
import CloudGamePage from '../app/games/[id]/page';
import { applyGameAction, createGame } from '../src/game/engine';
import { saveGuestGameSession } from '../src/persistence/guest-session';
import { createWall } from '../src/game/tiles';
import type { GameAction, GameState } from '../src/game/types';
import { snapshotForPlayer } from '../src/multiplayer/projections';
import { cloudFixture } from './helpers/cloud-table';

const cloud = vi.hoisted(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  return { data: null as unknown, submit: vi.fn() };
});
vi.mock('../src/multiplayer/use-cloud-table', () => ({ useCloudTable: () => ({ ...cloud, online: 1, busy: false }) }));

afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });

function withJokerSwap(state: GameState) {
  const wall = createWall();
  const dots = wall.filter(tile => tile.type.kind === 'number' && tile.type.suit === 'dots' && tile.type.rank === 5);
  const joker = wall.find(tile => tile.type.kind === 'joker')!;
  state.phase = 'playing';
  state.turnIndex = 0;
  state.cardId = 'photo-2025';
  state.players[0].rack = [dots[0], ...wall.filter(tile => !dots.includes(tile) && tile.type.kind !== 'joker').slice(0, 13)];
  state.players[1].exposures = [{ id: 'dots', kind: 'kong', tiles: [...dots.slice(1), joker], calledFromPlayerId: state.players[2].id }];
  return { state, joker, natural: dots[0] };
}

async function openCardAndReturn() {
  fireEvent.click(await screen.findByRole('button', { name: 'View card' }, { timeout: 3500 }));
  await screen.findByRole('heading', { name: 'Your 2025 Card' });
  fireEvent.change(screen.getByRole('searchbox', { name: 'Find a hand' }), { target: { value: 'dragons' } });
  fireEvent.click(screen.getByRole('button', { name: 'Close card browser' }));
  fireEvent.click(await screen.findByRole('button', { name: 'View card' }));
  expect((screen.getByRole('searchbox', { name: 'Find a hand' }) as HTMLInputElement).value).toBe('dragons');
  fireEvent.click(screen.getByRole('button', { name: 'Close card browser' }));
}

it('opens the card from the solo rack and removes the swap prompt after redeeming a Joker', async () => {
  const { state } = withJokerSwap(createGame(73));
  saveGuestGameSession(localStorage, { game: state, gameNumber: 1, rackOrder: state.players[0].rack.map(tile => tile.id), hintsRequested: 0, hintLevel: 0, manualTurns: 0, review: false });
  render(createElement(GameExperience));
  fireEvent.click(await screen.findByRole('button', { name: /Resume game 1/ }));
  await openCardAndReturn();
  expect(screen.getByText('Joker available')).toBeTruthy();
  fireEvent.click(await screen.findByRole('button', { name: /swap .* for .* joker/i }));
  await screen.findByText(/brought the Joker into your rack/);
  expect(screen.queryByText('Joker available')).toBeNull();
});

it('opens the card from the multiplayer rack and submits the selected exchange to the table', async () => {
  const fixture = cloudFixture();
  const { state, natural, joker } = withJokerSwap(fixture.state);
  const snapshot = () => snapshotForPlayer(state, 'alice', 'active', 'live', null, state.events);
  cloud.data = { ...fixture.data, snapshot: snapshot() };
  cloud.submit.mockImplementation(async (action: GameAction) => {
    const result = applyGameAction(state, 'alice', action);
    if (!result.ok) throw new Error(result.violation.message);
    cloud.data = { ...fixture.data, snapshot: snapshotForPlayer(result.state, 'alice', 'active', 'live', null, result.events) };
  });
  await act(async () => { render(createElement(CloudGamePage, { params: Promise.resolve({ id: 'room' }) })); });
  await openCardAndReturn();
  fireEvent.click(await screen.findByRole('button', { name: /swap .* for bea’s joker/i }));
  expect(cloud.submit).toHaveBeenCalledWith({ type: 'EXCHANGE_JOKER', exposureOwnerId: 'bea', exposureId: 'dots', rackTileId: natural.id, jokerTileId: joker.id });
  await waitFor(() => expect(screen.queryByText('Joker available')).toBeNull());
});
