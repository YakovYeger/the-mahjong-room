// @vitest-environment jsdom
import { createElement, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Select } from '../src/ui/select';
import { CardCompanion } from '../src/table/card-companion';

const options = [{ value: 60, label: '1 minute' }, { value: 300, label: '5 minutes · default' }];
afterEach(cleanup);

function TurnLength() {
  const [value, setValue] = useState(300);
  return createElement('form', { onSubmit: (event) => event.preventDefault() }, createElement(Select<number>, { label: 'Turn length', value, options, onValueChange: setValue }));
}

it('uses readable labels for numeric values and updates a selection without submitting the form', async () => {
  render(createElement(TurnLength));
  const trigger = screen.getByRole('combobox', { name: 'Turn length' });
  expect(trigger.textContent).toContain('5 minutes · default');
  expect(trigger.getAttribute('type')).toBe('button');
  fireEvent.click(trigger);
  const option = await screen.findByRole('option', { name: '1 minute' });
  fireEvent.keyDown(option, { key: 'Enter' });
  await waitFor(() => expect(trigger.textContent).toContain('1 minute'));
});

it('preserves disabled saved-game controls and links help text', () => {
  render(createElement(Select<number>, { label: 'Turn length', value: 300, options, onValueChange: vi.fn(), disabled: true, description: 'Charleston is untimed.' }));
  const trigger = screen.getByRole('combobox', { name: 'Turn length' }) as HTMLButtonElement;
  expect(trigger.disabled).toBe(true);
  expect(document.getElementById(trigger.getAttribute('aria-describedby')!)?.textContent).toBe('Charleston is untimed.');
});

it('closes a portaled dropdown with Escape before closing the card drawer', async () => {
  const close = vi.fn();
  render(createElement(CardCompanion, { cardId: 'photo-2025', rack: [], exposures: [], storageKey: 'select-test', onArrange: vi.fn(), open: true, onOpenChange: close }));
  const trigger = screen.getByRole('combobox', { name: 'Section' });
  fireEvent.click(trigger);
  const option = await screen.findByRole('option', { name: 'All hands' });
  fireEvent.keyDown(option, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  expect(close).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(close).toHaveBeenCalledWith(false);
});
