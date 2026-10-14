// Adapted from shadcn/ui's Base UI Button (MIT); see LICENSE.shadcn.
// https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/base/ui/button.tsx
import { Button as ButtonPrimitive } from '@base-ui/react/button';

export type ButtonVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive';
export function buttonVariants({ variant = 'default', size = 'default', className = '' }: {
  variant?: ButtonVariant; size?: 'default' | 'sm'; className?: string;
} = {}) {
  return `ui-button ui-button-${variant} ui-button-${size}-size ${className}`;
}
export function Button({ className = '', variant = 'default', size = 'default', type = 'button', ...props }: Omit<ButtonPrimitive.Props, 'className'> & {
  className?: string; variant?: ButtonVariant; size?: 'default' | 'sm';
}) {
  return <ButtonPrimitive type={type} data-slot="button" className={buttonVariants({ variant, size, className })} {...props} />;
}
