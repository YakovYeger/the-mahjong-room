'use client';

import { Tabs as Primitive } from '@base-ui/react/tabs';
import type { ReactNode } from 'react';

export function Tabs<Value extends string>({ label, value, onValueChange, options, children }: { label: string; value: Value; onValueChange: (value: Value) => void; options: { value: Value; label: string }[]; children?: ReactNode }) {
  return <Primitive.Root value={value} onValueChange={next => { const option = options.find(option => option.value === next); if (option) onValueChange(option.value); }}>
    <Primitive.List activateOnFocus className="ui-tabs-list" aria-label={label}>
      {options.map(option => <Primitive.Tab className="ui-tab" value={option.value} key={option.value}>{option.label}</Primitive.Tab>)}
    </Primitive.List>
    {options.map(option => <Primitive.Panel value={option.value} key={option.value}>{option.value === value ? children : null}</Primitive.Panel>)}
  </Primitive.Root>;
}
