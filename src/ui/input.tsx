'use client';

// Adapted from shadcn/ui's Base UI Input (MIT); see LICENSE.shadcn.
// https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/base/ui/input.tsx
import { Input as InputPrimitive } from '@base-ui/react/input';
import type { ComponentProps } from 'react';

export function Input({ className = '', type, ...props }: ComponentProps<'input'>) {
  return <InputPrimitive type={type} data-slot="input" className={`ui-input ${className}`} {...props} />;
}
