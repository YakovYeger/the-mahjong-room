'use client';

import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';

type SortableRackItemProps = {
  id: string;
  index: number;
  className: string;
  disabled?: boolean;
  children: (state: { isDragging: boolean; handleRef: (element: Element | null) => void }) => ReactNode;
};

export function SortableRackItem({ id, index, className, disabled = false, children }: SortableRackItemProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id,
    index,
    disabled,
    transition: { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' },
  });

  return <div ref={ref} data-sortable-id={id} className={`${className}${isDragging ? ' is-dragging' : ''}`}>
    {children({ isDragging, handleRef })}
  </div>;
}
