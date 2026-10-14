'use client';

import { RadioGroup as Group } from '@base-ui/react/radio-group';
import { Radio } from '@base-ui/react/radio';

export function RadioGroup<Value extends string>({ label, value, onValueChange, options, descriptionId, disabled = false }: { label: string; value: Value; onValueChange: (value: Value) => void; options: { value: Value; label: string; description?: string }[]; descriptionId?: string; disabled?: boolean }) {
  return <Group disabled={disabled} className="ui-radio-group" aria-label={label} aria-describedby={descriptionId} value={value} onValueChange={next => { const option = options.find(option => option.value === next); if (option) onValueChange(option.value); }}>
    {options.map(option => <Radio.Root key={option.value} value={option.value} className="ui-radio-choice" aria-label={option.label}><strong>{option.label}</strong>{option.description ? <small>{option.description}</small> : null}</Radio.Root>)}
  </Group>;
}
