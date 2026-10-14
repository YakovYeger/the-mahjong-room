'use client';

// Adapted from shadcn/ui's Field composition (MIT); see LICENSE.shadcn.
// https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/base/ui/field.tsx
// Product CSS replaces the upstream utility/variant helpers.
import { useMemo, type ComponentProps } from 'react';
import { Label } from './label';

export function FieldSet({ className = '', ...props }: ComponentProps<'fieldset'>) {
  return <fieldset data-slot="field-set" className={`ui-field-set ${className}`} {...props} />;
}
export function FieldLegend({ className = '', ...props }: ComponentProps<'legend'>) {
  return <legend data-slot="field-legend" className={`ui-field-legend ${className}`} {...props} />;
}
export function FieldGroup({ className = '', ...props }: ComponentProps<'div'>) {
  return <div data-slot="field-group" className={`ui-field-group ${className}`} {...props} />;
}
export function Field({ className = '', orientation = 'vertical', ...props }: ComponentProps<'div'> & { orientation?: 'vertical' | 'horizontal' | 'responsive' }) {
  return <div role="group" data-slot="field" data-orientation={orientation} className={`ui-field ${className}`} {...props} />;
}
export function FieldLabel({ className = '', ...props }: ComponentProps<typeof Label>) {
  return <Label data-slot="field-label" className={`ui-field-label ${className}`} {...props} />;
}
export function FieldDescription({ className = '', ...props }: ComponentProps<'p'>) {
  return <p data-slot="field-description" className={`ui-field-description ${className}`} {...props} />;
}
export function FieldError({ className = '', children, errors, ...props }: ComponentProps<'div'> & { errors?: Array<{ message?: string } | undefined> }) {
  const content = useMemo(() => {
    if (children) return children;
    const messages = [...new Set(errors?.map(error => error?.message).filter((message): message is string => !!message))];
    if (!messages.length) return null;
    return messages.length === 1 ? messages[0] : <ul>{messages.map(message => <li key={message}>{message}</li>)}</ul>;
  }, [children, errors]);
  return content ? <div role="alert" data-slot="field-error" className={`ui-field-error ${className}`} {...props}>{content}</div> : null;
}
