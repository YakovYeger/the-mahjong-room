'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';

// Fullscreen the document so menus and dialogs portaled to body stay usable.
// The same expanded layout also works when the browser denies fullscreen.
export function TableFullscreenButton() {
  const [mode, setMode] = useState<'normal' | 'expanded' | 'fullscreen'>('normal');
  const [pending, setPending] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const ownsFullscreen = useRef(false);
  const mounted = useRef(false);
  const expanded = mode !== 'normal';

  useEffect(() => {
    mounted.current = true;
    const root = document.documentElement;
    const changed = () => {
      if (!ownsFullscreen.current) return;
      if (document.fullscreenElement === root) setMode('fullscreen');
      else { ownsFullscreen.current = false; setMode('normal'); }
    };
    document.addEventListener('fullscreenchange', changed);
    return () => {
      mounted.current = false;
      document.removeEventListener('fullscreenchange', changed);
      delete root.dataset.tableExpanded;
      if (ownsFullscreen.current && document.fullscreenElement === root) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (expanded) root.dataset.tableExpanded = 'true';
    else delete root.dataset.tableExpanded;
    const escape = (event: KeyboardEvent) => {
      // Give an open settings dialog or Table menu its own Escape first.
      if (mode !== 'expanded' || event.key !== 'Escape' || event.defaultPrevented || document.querySelector('[role="dialog"], [role="menu"]')) return;
      setMode('normal');
      button.current?.focus();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [expanded, mode]);

  const toggle = async () => {
    if (pending) return;
    const root = document.documentElement;
    if (expanded) {
      if (ownsFullscreen.current && document.fullscreenElement === root) {
        setPending(true);
        try { await document.exitFullscreen(); }
        catch { /* Keep the exit control available if the browser refuses. */ }
        finally { if (mounted.current) setPending(false); }
      } else setMode('normal');
      return;
    }
    setMode('expanded');
    if (!root.requestFullscreen || !document.fullscreenEnabled || document.fullscreenElement) return;
    ownsFullscreen.current = true;
    setPending(true);
    try {
      await root.requestFullscreen();
      if (!mounted.current && document.fullscreenElement === root) await document.exitFullscreen();
      else if (mounted.current && document.fullscreenElement === root) setMode('fullscreen');
    } catch { ownsFullscreen.current = false; }
    finally { if (mounted.current) setPending(false); }
  };

  return <><Button ref={button} variant="outline" size="sm" className="table-fullscreen-button" aria-pressed={expanded} disabled={pending} onClick={() => void toggle()}>{expanded ? mode === 'fullscreen' ? 'Exit fullscreen' : 'Exit expanded table' : 'Fullscreen'}</Button><span className="table-fullscreen-status" role="status">{mode === 'fullscreen' ? 'Fullscreen table. Use Exit fullscreen or Escape to return.' : mode === 'expanded' ? 'Expanded table. Use Exit expanded table or Escape to return.' : ''}</span></>;
}
