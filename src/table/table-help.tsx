'use client';

import { useRef, useState, type ReactNode } from 'react';
import { CoachPanel, type CoachPanelProps } from '../coach/coach-panel';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '../ui/dialog';

export function TableHelp({ coach, children }: { coach: CoachPanelProps | null; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <aside className="table-help-dock" aria-label="Help and hand plan">
    {coach ? <button ref={trigger} className="table-help-button" onClick={() => setOpen(true)} aria-haspopup="dialog"><span aria-hidden="true">✧</span><span><strong>Need a hint?</strong>{' '}<small>A little help from your coach</small></span><span aria-hidden="true">↗</span></button> : null}
    {children}
    {coach ? <Dialog open={open} onOpenChange={setOpen} className="table-help-sheet" finalFocus={trigger}>
      <header><div><p className="kicker">A friend at the table</p><DialogTitle>Your coach</DialogTitle><DialogDescription>Take a hint, explore your options, or highlight tiles on the table.</DialogDescription></div><DialogClose aria-label="Close coach">×</DialogClose></header>
      <CoachPanel {...coach} onBrowse={() => { setOpen(false); coach.onBrowse(); }} onShowChange={show => { coach.onShowChange(show); if (show) setOpen(false); }} onFocusGroup={id => { coach.onFocusGroup(id); setOpen(false); }} />
    </Dialog> : null}
  </aside>;
}
