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
  const sortable = useSortable({
    id,
    index,
    disabled,
    transition: { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' },
  });

  return <div ref={sortable.ref} data-sortable-id={id} className={`${className}${sortable.isDragging ? ' is-dragging' : ''}`}>
    {children({ isDragging: sortable.isDragging, handleRef: sortable.handleRef })}
  </div>;
}
