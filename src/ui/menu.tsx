'use client';

import { Menu as Primitive } from '@base-ui/react/menu';

export interface MenuEntry {
  label: string;
  href?: string;
  newTab?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export function Menu({ label, items, note, className = '' }: { label: string; items: MenuEntry[]; note?: string; className?: string }) {
  return <Primitive.Root>
    <Primitive.Trigger className={`ui-menu-trigger ${className}`}>{label} <span aria-hidden="true">⌄</span></Primitive.Trigger>
    <Primitive.Portal>
      <Primitive.Positioner className="ui-menu-positioner" sideOffset={6} align="end">
        <Primitive.Popup className="ui-menu-popup" aria-label={label}>
          {note ? <p className="ui-menu-note">{note}</p> : null}
          {items.map(item => <Primitive.Item key={item.label} className="ui-menu-item" disabled={item.disabled} onClick={item.onClick} render={item.href ? <a href={item.href} target={item.newTab ? '_blank' : undefined} rel={item.newTab ? 'noreferrer' : undefined} /> : <button type="button" />} nativeButton={!item.href}>{item.label}</Primitive.Item>)}
        </Primitive.Popup>
      </Primitive.Positioner>
    </Primitive.Portal>
  </Primitive.Root>;
}
