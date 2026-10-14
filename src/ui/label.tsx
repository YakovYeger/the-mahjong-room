// Adapted from shadcn/ui's native Base UI Label (MIT); see LICENSE.shadcn.
import type { ComponentProps } from 'react';
export function Label({ className = '', ...props }: ComponentProps<'label'>) {
  return <label data-slot="label" className={`ui-label ${className}`} {...props} />;
}
