// @vitest-environment jsdom
import { createElement, useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { Menu } from '../src/ui/menu';
import { Tabs } from '../src/ui/tabs';
import { RadioGroup } from '../src/ui/radio-group';

afterEach(cleanup);

it('keeps native menu links, blocks disabled actions, and dismisses after an action', async () => {
  const user = userEvent.setup();
  const leave = vi.fn();
  const end = vi.fn();
  render(createElement(Menu, { label: 'Table', items: [{ label: 'Rules', href: '/rules', newTab: true }, { label: 'End game', disabled: true, onClick: end }, { label: 'Leave table', onClick: leave }] }));
  screen.getByRole('button', { name: 'Table' }).focus();
  await user.keyboard('{ArrowDown}');
  const rules = screen.getByRole('menuitem', { name: 'Rules' });
  expect(rules.tagName).toBe('A');
  expect(rules.getAttribute('href')).toBe('/rules');
  expect(rules.getAttribute('target')).toBe('_blank');
  await user.click(screen.getByRole('menuitem', { name: 'End game' }));
  expect(end).not.toHaveBeenCalled();
  await user.click(screen.getByRole('menuitem', { name: 'Leave table' }));
  expect(leave).toHaveBeenCalledOnce();
  expect(screen.queryByRole('menu')).toBeNull();
});

function AccountTabs() {
  const [value, setValue] = useState('login');
  return createElement(Tabs, { label: 'Account options', value, onValueChange: setValue, options: [{ value: 'login', label: 'Sign in' }, { value: 'register', label: 'Create account' } ] }, createElement('p', null, value === 'login' ? 'Login form' : 'Registration form'));
}

it('uses arrow keys to switch tabs and associates the active tab with its panel', async () => {
  const user = userEvent.setup();
  render(createElement(AccountTabs));
  const login = screen.getByRole('tab', { name: 'Sign in' });
  login.focus();
  await user.keyboard('{ArrowRight}');
  const register = screen.getByRole('tab', { name: 'Create account' });
  await waitFor(() => expect(register.getAttribute('aria-selected')).toBe('true'));
  const panel = screen.getByRole('tabpanel');
  expect(panel.textContent).toBe('Registration form');
  expect(panel.getAttribute('aria-labelledby')).toBe(register.id);
});

function RoomMode() {
  const [value, setValue] = useState('live');
  return createElement(RadioGroup, { label: 'Game mode', value, onValueChange: setValue, options: [{ value: 'live', label: 'Live' }, { value: 'async', label: 'Time-based' }] });
}

it('changes room mode with arrow keys while maintaining one checked choice', async () => {
  const user = userEvent.setup();
  render(createElement(RoomMode));
  const live = screen.getByRole('radio', { name: 'Live' });
  live.focus();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('radio', { name: 'Time-based' }).getAttribute('aria-checked')).toBe('true');
  expect(live.getAttribute('aria-checked')).toBe('false');
});
