'use client';

import { Button } from '../ui/button';

export function OrganizeRackButton({ onClick, disabled = false, label = 'Organize rack by suit and number' }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return <Button variant="ghost" className="organize-rack-button" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="3" y="9" width="5" height="11" rx="1" /><rect x="10" y="9" width="5" height="11" rx="1" /><rect x="17" y="9" width="4" height="11" rx="1" />
      <path d="M4 5H20M17 2L20 5L17 8" />
    </svg>
  </Button>;
}
