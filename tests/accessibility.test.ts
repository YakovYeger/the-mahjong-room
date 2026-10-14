// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AccessibilityProvider, useAccessibility } from '../src/accessibility/provider';
import { AccessibilitySettings } from '../src/accessibility/settings';
import { ACCESSIBILITY_KEY, accessibilityBootstrap, defaultPreferences, parsePreferences } from '../src/accessibility/preferences';

let motionChanged: () => void;
const media = { matches: false, addEventListener: vi.fn((_event, listener) => { motionChanged = listener; }), removeEventListener: vi.fn() };
beforeEach(() => {
  localStorage.clear(); media.matches = false;
  vi.stubGlobal('matchMedia', vi.fn(() => media));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.removeAttribute('data-theme'); });
function Harness() {
  const { openSettings, reducedMotion } = useAccessibility();
  return createElement('div', null, createElement('button', { onClick: openSettings }, 'Table settings'), createElement('span', null, reducedMotion ? 'motion reduced' : 'motion standard'));
}
const show = () => render(createElement(AccessibilityProvider, null, createElement(AccessibilitySettings), createElement(Harness)));

it('validates each saved value, safely recovering partial, malformed, or hostile storage', () => {
  for (const raw of [null, '{', 'null', '[]', '17', '"large"']) expect(parsePreferences(raw)).toEqual(defaultPreferences);
  expect(parsePreferences('{"theme":"low-light","textSize":"injected","motion":"reduce","extra":"ignored"}'))
    .toEqual({ ...defaultPreferences, theme: 'low-light', motion: 'reduce' });
});
it('applies the same validated preference before paint as after hydration', async () => {
  localStorage.setItem(ACCESSIBILITY_KEY, '17');
  window.eval(accessibilityBootstrap);
  expect(document.documentElement.dataset.theme).toBe('classic');
  localStorage.setItem(ACCESSIBILITY_KEY, JSON.stringify({ ...defaultPreferences, theme: 'low-light', textSize: 'large', contrast: 'high' }));
  window.eval(accessibilityBootstrap);
  expect(document.documentElement.dataset).toMatchObject({ theme: 'low-light', textSize: 'large', contrast: 'high', motion: 'standard' });
  show();
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Low light' }).getAttribute('aria-checked')).toBe('true'));
  expect(document.documentElement.dataset.theme).toBe('low-light');
});
it('saves immediately, rehydrates on remount, and resets only accessibility preferences', async () => {
  const user = userEvent.setup(); localStorage.setItem('mahjong:guest-progress', 'keep');
  const mounted = show(); await screen.findByText(/Changes save automatically/);
  await user.click(screen.getByRole('radio', { name: 'Large text' }));
  await user.click(screen.getByRole('radio', { name: 'High contrast' }));
  await user.click(screen.getByRole('radio', { name: 'Full suit names' }));
  expect(parsePreferences(localStorage.getItem(ACCESSIBILITY_KEY))).toMatchObject({ textSize: 'large', contrast: 'high', suitLabels: 'full' });
  mounted.unmount(); show();
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Large text' }).getAttribute('aria-checked')).toBe('true'));
  await user.click(screen.getByRole('button', { name: 'Restore defaults' }));
  expect(parsePreferences(localStorage.getItem(ACCESSIBILITY_KEY))).toEqual(defaultPreferences);
  expect(localStorage.getItem('mahjong:guest-progress')).toBe('keep');
});
it('respects live system-motion changes and synchronizes another tab’s preferences', async () => {
  show(); await screen.findByText(/Changes save automatically/);
  media.matches = true; motionChanged();
  await screen.findByText('motion reduced');
  localStorage.setItem(ACCESSIBILITY_KEY, JSON.stringify({ ...defaultPreferences, theme: 'low-light', motion: 'reduce' }));
  fireEvent(window, new StorageEvent('storage', { key: ACCESSIBILITY_KEY }));
  await waitFor(() => expect(document.documentElement.dataset.theme).toBe('low-light'));
  media.matches = false; motionChanged();
  await waitFor(() => expect(document.documentElement.dataset.motion).toBe('reduce'));
});
it('keeps controls usable and explains when storage is unavailable', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage blocked'); });
  show(); await screen.findByText(/Changes save automatically/);
  fireEvent.click(screen.getByRole('radio', { name: 'Low light' }));
  await screen.findByText(/cannot save them/);
  expect(document.documentElement.dataset.theme).toBe('low-light');
});
it('opens a labeled settings dialog, supports arrow keys, and restores focus on Escape', async () => {
  const user = userEvent.setup();
  render(createElement(AccessibilityProvider, null, createElement(Harness)));
  const trigger = screen.getByRole('button', { name: 'Table settings' });
  await user.click(trigger);
  expect(screen.getByRole('dialog', { name: 'Make the table yours.' })).toBeTruthy();
  const radio = screen.getByRole('radio', { name: 'Standard text' });
  radio.focus(); await user.keyboard('{ArrowRight}');
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Large text' }).getAttribute('aria-checked')).toBe('true'));
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});
