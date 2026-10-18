'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { Dialog, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { AccessibilitySettings } from './settings';
import { ACCESSIBILITY_KEY, applyPreferences, defaultPreferences, parsePreferences, type AccessibilityPreferences } from './preferences';

interface AccessibilityContextValue {
  preferences: AccessibilityPreferences;
  reducedMotion: boolean;
  ready: boolean;
  storageAvailable: boolean;
  update: (patch: Partial<AccessibilityPreferences>) => void;
  openSettings: () => void;
}
const AccessibilityContext = createContext<AccessibilityContextValue>({
  preferences: defaultPreferences as AccessibilityPreferences,
  reducedMotion: false,
  ready: false,
  storageAvailable: true,
  update: () => {},
  openSettings: () => {},
});

export const useAccessibility = () => useContext(AccessibilityContext);

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>({ ...defaultPreferences });
  const [systemMotion, setSystemMotion] = useState(false);
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [open, setOpen] = useState(false);
  const reducedMotion = preferences.motion === 'reduce' || systemMotion;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hydrate = () => {
      try { setPreferences(parsePreferences(localStorage.getItem(ACCESSIBILITY_KEY))); }
      catch { setStorageAvailable(false); }
      setSystemMotion(media.matches);
      setReady(true);
    };
    hydrate();
    const motionChanged = () => setSystemMotion(media.matches);
    const storageChanged = (event: StorageEvent) => {
      if (event.key === ACCESSIBILITY_KEY || event.key === null) hydrate();
    };
    media.addEventListener('change', motionChanged);
    window.addEventListener('storage', storageChanged);
    return () => { media.removeEventListener('change', motionChanged); window.removeEventListener('storage', storageChanged); };
  }, []);

  useEffect(() => { if (ready) applyPreferences(preferences, reducedMotion, document.documentElement); }, [preferences, reducedMotion, ready]);

  const update = (patch: Partial<AccessibilityPreferences>) => {
    const next = parsePreferences(JSON.stringify({ ...preferences, ...patch }));
    setPreferences(next);
    applyPreferences(next, next.motion === 'reduce' || systemMotion, document.documentElement);
    try { localStorage.setItem(ACCESSIBILITY_KEY, JSON.stringify(next)); setStorageAvailable(true); }
    catch { setStorageAvailable(false); }
  };

  return <AccessibilityContext.Provider value={{ preferences, reducedMotion, ready, storageAvailable, update, openSettings: () => setOpen(true) }}>
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'} transition={reducedMotion ? { duration: 0 } : undefined}>
      {children}
      <Dialog open={open} onOpenChange={setOpen} className="accessibility-dialog" finalFocus={() => document.querySelector<HTMLElement>('.table-tools .ui-menu-trigger') ?? true}>
        <div className="accessibility-dialog-heading"><DialogTitle>Make the table yours.</DialogTitle><Button variant="outline" onClick={() => setOpen(false)} aria-label="Close accessibility settings">Close</Button></div>
        <DialogDescription>Choose your discard display, readability, and motion without leaving your game.</DialogDescription>
        <AccessibilitySettings />
      </Dialog>
    </MotionConfig>
  </AccessibilityContext.Provider>;
}
