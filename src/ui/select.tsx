'use client';

// Adapted from shadcn/ui's Base UI Select (MIT), with Mahjong Room styling.
// https://ui.shadcn.com/docs/components/base/select
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { useId } from 'react';

export interface SelectOption<Value extends string | number> {
  value: Value;
  label: string;
}

interface SelectProps<Value extends string | number> {
  label: string;
  value: Value;
  options: SelectOption<Value>[];
  onValueChange: (value: Value) => void;
  disabled?: boolean;
  description?: string;
  className?: string;
}

export function Select<Value extends string | number>({ label, value, options, onValueChange, disabled = false, description, className = '' }: SelectProps<Value>) {
  const id = useId();
  return <div className={`select-field ${className}`}>
    <SelectPrimitive.Root<Value> items={options} value={value} disabled={disabled} onValueChange={next => { if (next !== null) onValueChange(next); }}>
      <SelectPrimitive.Label className="select-label">{label}</SelectPrimitive.Label>
      <SelectPrimitive.Trigger className="select-trigger" data-slot="select-trigger" aria-describedby={description ? id : undefined}>
        <SelectPrimitive.Value className="select-value" />
        <SelectPrimitive.Icon className="select-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner className="select-positioner" sideOffset={6} align="start" alignItemWithTrigger={false}>
          <SelectPrimitive.Popup className="select-popup" data-slot="select-content">
            <SelectPrimitive.ScrollUpArrow className="select-scroll-arrow" aria-hidden="true">⌃</SelectPrimitive.ScrollUpArrow>
            <SelectPrimitive.List className="select-list">
              {options.map(option => <SelectPrimitive.Item key={option.value} value={option.value} className="select-item">
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="select-check"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg></SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>)}
            </SelectPrimitive.List>
            <SelectPrimitive.ScrollDownArrow className="select-scroll-arrow" aria-hidden="true">⌄</SelectPrimitive.ScrollDownArrow>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
    {description ? <small id={id}>{description}</small> : null}
  </div>;
}
