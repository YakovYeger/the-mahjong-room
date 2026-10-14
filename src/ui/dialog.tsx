'use client';

import { Dialog as Primitive } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';

export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;
export const DialogClose = Primitive.Close;

export function Dialog({ open, onOpenChange, children, className = '', label, initialFocus, finalFocus }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode; className?: string; label?: string; initialFocus?: Primitive.Popup.Props['initialFocus']; finalFocus?: Primitive.Popup.Props['finalFocus'] }) {
  return <Primitive.Root open={open} onOpenChange={next => onOpenChange(next)}>
    <Primitive.Portal>
      <Primitive.Backdrop className="ui-dialog-backdrop" />
      <Primitive.Popup className={`ui-dialog ${className}`} aria-label={label} initialFocus={initialFocus} finalFocus={finalFocus}>
        {children}
      </Primitive.Popup>
    </Primitive.Portal>
  </Primitive.Root>;
}
