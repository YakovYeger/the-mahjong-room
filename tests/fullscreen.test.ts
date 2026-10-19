// @vitest-environment jsdom
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TableFullscreenButton } from '../src/table/fullscreen-button';

afterEach(() => { cleanup(); vi.restoreAllMocks(); delete document.documentElement.dataset.tableExpanded; for (const key of ['fullscreenElement', 'fullscreenEnabled', 'exitFullscreen']) Reflect.deleteProperty(document, key); Reflect.deleteProperty(document.documentElement, 'requestFullscreen'); });
function nativeBrowser() {
  let element: Element | null = null;
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => element });
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, get: () => true });
  const request = vi.fn(async () => { element = document.documentElement; document.dispatchEvent(new Event('fullscreenchange')); });
  const exit = vi.fn(async () => { element = null; document.dispatchEvent(new Event('fullscreenchange')); });
  Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: request });
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit });
  return { request, exit };
}

it('uses the document for native fullscreen, tracks browser exit, and permits re-entry', async () => {
  const { request, exit } = nativeBrowser();
  render(createElement(TableFullscreenButton));
  fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Exit fullscreen' }).hasAttribute('disabled')).toBe(false));
  expect(request).toHaveBeenCalledOnce();
  expect(document.documentElement.dataset.tableExpanded).toBe('true');
  await act(() => exit());
  expect(screen.getByRole('button', { name: 'Fullscreen' }).getAttribute('aria-pressed')).toBe('false');
  expect(document.documentElement.dataset.tableExpanded).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Exit fullscreen' }).hasAttribute('disabled')).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Exit fullscreen' }));
  await screen.findByRole('button', { name: 'Fullscreen' });
  expect(exit).toHaveBeenCalledTimes(2);
});
it('falls back when fullscreen is denied, leaving overlays their Escape and an explicit exit', async () => {
  const { request } = nativeBrowser(); request.mockRejectedValue(new Error('denied'));
  render(createElement(TableFullscreenButton));
  fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
  const exit = await screen.findByRole('button', { name: 'Exit expanded table' });
  await waitFor(() => expect(exit.hasAttribute('disabled')).toBe(false));
  const dialog = document.createElement('div'); dialog.setAttribute('role', 'dialog'); document.body.appendChild(dialog);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(document.documentElement.dataset.tableExpanded).toBe('true');
  dialog.remove(); fireEvent.keyDown(document, { key: 'Escape' });
  expect(document.documentElement.dataset.tableExpanded).toBeUndefined();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fullscreen' }));
});
it('supports browsers without fullscreen and removes layout and native mode on navigation', async () => {
  const { exit } = nativeBrowser();
  vi.spyOn(document, 'fullscreenEnabled', 'get').mockReturnValue(false);
  const view = render(createElement(TableFullscreenButton));
  fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
  expect(screen.getByRole('button', { name: 'Exit expanded table' })).toBeTruthy();
  view.unmount(); expect(document.documentElement.dataset.tableExpanded).toBeUndefined();
  expect(exit).not.toHaveBeenCalled();
  vi.spyOn(document, 'fullscreenEnabled', 'get').mockReturnValue(true);
  const native = render(createElement(TableFullscreenButton));
  fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Exit fullscreen' }).hasAttribute('disabled')).toBe(false));
  native.unmount(); expect(exit).toHaveBeenCalledOnce();
});
