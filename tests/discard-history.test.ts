// @vitest-environment jsdom

import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createTablePreview } from '../src/table/design-fixtures';
import { DiscardPool } from '../src/table/table-surface';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('follows new discards but preserves manual history inspection during unrelated updates', () => {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(700);
  const tiles = createTablePreview('late').discards;
  const { rerender } = render(createElement(DiscardPool, { tiles: tiles.slice(0, 93) }));
  const history = screen.getByLabelText('Discard history, scroll to inspect older tiles');
  expect(history.scrollTop).toBe(700);
  history.scrollTop = 120;
  rerender(createElement(DiscardPool, { tiles: tiles.slice(0, 93), dropActive: true }));
  expect(history.scrollTop).toBe(120);
  rerender(createElement(DiscardPool, { tiles }));
  expect(history.scrollTop).toBe(700);
  expect(history.querySelector('.table-discard-latest')?.getAttribute('title')).toContain('discard 94');
});

it('keeps the latest discard in view when the available table height changes', () => {
  let onResize: (() => void) | undefined;
  const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { onResize = callback; }
    observe() {}
    disconnect = disconnect;
  });
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(700);
  const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100);
  const { unmount } = render(createElement(DiscardPool, { tiles: createTablePreview('late').discards }));
  const history = screen.getByLabelText('Discard history, scroll to inspect older tiles');
  history.scrollTop = 600;
  height.mockReturnValue(80);
  onResize?.();
  expect(history.scrollTop).toBe(700);
  history.scrollTop = 120;
  height.mockReturnValue(60);
  onResize?.();
  expect(history.scrollTop).toBe(120);
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});
