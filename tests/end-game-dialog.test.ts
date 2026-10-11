// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { EndGameDialog } from '../src/table/end-game-dialog';
afterEach(cleanup);
it('requires confirmation, supports cancellation, and blocks duplicate confirms while saving', () => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.open = true; });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) { this.open = false; });
  const onCancel = vi.fn(); const onConfirm = vi.fn();
  const view = render(createElement(EndGameDialog, { busy: false, onCancel, onConfirm }));
  expect(onConfirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Keep playing' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'End game for everyone' }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  view.rerender(createElement(EndGameDialog, { busy: true, onCancel, onConfirm }));
  fireEvent.click(screen.getByRole('button', { name: 'Ending game…' }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
});
