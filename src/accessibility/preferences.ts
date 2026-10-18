export const ACCESSIBILITY_KEY = 'mahjong-room:accessibility:v1';
export const defaultPreferences = { textSize: 'standard', theme: 'classic', contrast: 'standard', suitLabels: 'compact', motion: 'system', discardView: 'grouped' } as const;
export interface AccessibilityPreferences {
  discardView: 'grouped' | 'order';
  textSize: 'standard' | 'large';
  theme: 'classic' | 'low-light';
  contrast: 'standard' | 'high';
  suitLabels: 'compact' | 'full';
  motion: 'system' | 'reduce';
}
const choices: { [K in keyof AccessibilityPreferences]: readonly AccessibilityPreferences[K][] } = {
  discardView: ['grouped', 'order'], textSize: ['standard', 'large'], theme: ['classic', 'low-light'], contrast: ['standard', 'high'],
  suitLabels: ['compact', 'full'], motion: ['system', 'reduce'],
};

export function parsePreferences(raw: string | null): AccessibilityPreferences {
  const result: AccessibilityPreferences = { ...defaultPreferences };
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
    for (const key of Object.keys(choices) as (keyof AccessibilityPreferences)[]) {
      const candidate = (value as Record<string, unknown>)[key];
      if (typeof candidate === 'string' && (choices[key] as readonly string[]).includes(candidate)) {
        Object.assign(result, { [key]: candidate });
      }
    }
  } catch { /* Invalid or obsolete preferences never block access to the app. */ }
  return result;
}

export function applyPreferences(preferences: AccessibilityPreferences, reducedMotion: boolean, root: HTMLElement) {
  root.dataset.textSize = preferences.textSize;
  root.dataset.theme = preferences.theme;
  root.dataset.contrast = preferences.contrast;
  root.dataset.suitLabels = preferences.suitLabels;
  root.dataset.motion = reducedMotion ? 'reduce' : 'standard';
}

// Runs before first paint, including on native-anchor navigations. Storage is
// untrusted: only the enumerated values above can reach document attributes.
export const accessibilityBootstrap = `(()=>{try{let p=JSON.parse(localStorage.getItem(${JSON.stringify(ACCESSIBILITY_KEY)})||'{}');if(!p||typeof p!=='object'||Array.isArray(p))p={};const c=${JSON.stringify(choices)};const d=${JSON.stringify(defaultPreferences)};for(const k of Object.keys(c)){if(!c[k].includes(p[k]))p[k]=d[k]}const r=document.documentElement;r.dataset.textSize=p.textSize;r.dataset.theme=p.theme;r.dataset.contrast=p.contrast;r.dataset.suitLabels=p.suitLabels;r.dataset.motion=p.motion==='reduce'||matchMedia('(prefers-reduced-motion: reduce)').matches?'reduce':'standard'}catch{document.documentElement.dataset.motion=matchMedia('(prefers-reduced-motion: reduce)').matches?'reduce':'standard'}})();`;
