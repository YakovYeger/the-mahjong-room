'use client';

import type { Ref } from 'react';
import { tileLabel } from '../game/tiles';
import type { Exposure, Tile } from '../game/types';
import { Button } from '../ui/button';

export function ViewCardButton({ buttonRef, open, onClick }: { buttonRef: Ref<HTMLButtonElement>; open: boolean; onClick: () => void }) {
  return <Button ref={buttonRef} variant="ghost" className="view-card-button" aria-label="View card" title="View card" aria-haspopup="dialog" aria-expanded={open} onClick={onClick}>
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v15M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1ZM5 8h4m-4 4h4m6-4h4m-4 4h4" />
    </svg>
  </Button>;
}

export type JokerSwapOption = { owner: { id: string; name: string }; exposure: Exposure; joker: Tile; rackTile: Tile };

export function JokerSwapPrompt({ options, viewerId, disabled, onSwap }: { options: JokerSwapOption[]; viewerId: string; disabled?: boolean; onSwap: (option: JokerSwapOption) => void }) {
  // Swapping a different copy of the same tile in a set has the same outcome.
  const choices = new Map<string, JokerSwapOption>();
  for (const option of options) {
    if (!choices.has(option.exposure.id)) choices.set(option.exposure.id, option);
  }
  return <div className="joker-swap-prompt">
    <strong role="status">{choices.size ? 'Joker available' : ''}</strong>
    {Array.from(choices.values(), option => <Button key={option.exposure.id} variant="secondary" disabled={disabled} onClick={() => onSwap(option)}>
      Swap {tileLabel(option.rackTile)} for {option.owner.id === viewerId ? 'your' : `${option.owner.name}’s`} Joker
    </Button>)}
  </div>;
}
