'use client';

import { useId } from 'react';
import { Button } from '../ui/button';
import { FieldDescription, FieldGroup, FieldLegend, FieldSet } from '../ui/field';
import { RadioGroup } from '../ui/radio-group';
import { TileFace } from '../table/tile-face';
import { defaultPreferences } from './preferences';
import { useAccessibility } from './provider';

export function AccessibilitySettings() {
  const id = useId();
  const { preferences, update, ready, storageAvailable } = useAccessibility();
  return <div className="accessibility-settings">
    <div className="accessibility-sample" aria-label="Tile preview">
      <div aria-hidden="true">{(['bamboo', 'characters', 'dots'] as const).map(suit => <div className="accessibility-sample-tile" key={suit}><TileFace tile={{ id: `preview-${suit}`, type: { kind: 'number', suit, rank: 3 } }} /></div>)}</div>
      <p>Distinct symbols and written suit labels keep every tile identifiable.</p>
    </div>
    <form onSubmit={event => event.preventDefault()} aria-label="Accessibility preferences">
      <FieldGroup>
        <FieldSet disabled={!ready}><FieldLegend>Text size</FieldLegend><FieldDescription id={`${id}-text`}>Large text increases type by 25% and gives your rack more room.</FieldDescription>
          <RadioGroup disabled={!ready} descriptionId={`${id}-text`} label="Text size" value={preferences.textSize} onValueChange={textSize => update({ textSize })} options={[{ value: 'standard', label: 'Standard text' }, { value: 'large', label: 'Large text' }]} />
        </FieldSet>
        <FieldSet disabled={!ready}><FieldLegend>Light</FieldLegend><FieldDescription id={`${id}-light`}>Keep warm ivory, or soften the screen for an evening game.</FieldDescription>
          <RadioGroup disabled={!ready} descriptionId={`${id}-light`} label="Light" value={preferences.theme} onValueChange={theme => update({ theme })} options={[{ value: 'classic', label: 'Classic ivory' }, { value: 'low-light', label: 'Low light' }]} />
        </FieldSet>
        <FieldSet disabled={!ready}><FieldLegend>Contrast</FieldLegend><FieldDescription id={`${id}-contrast`}>Stronger text, borders, and focus cues. Works with either light setting.</FieldDescription>
          <RadioGroup disabled={!ready} descriptionId={`${id}-contrast`} label="Contrast" value={preferences.contrast} onValueChange={contrast => update({ contrast })} options={[{ value: 'standard', label: 'Standard contrast' }, { value: 'high', label: 'High contrast' }]} />
        </FieldSet>
        <FieldSet disabled={!ready}><FieldLegend>Suit labels</FieldLegend><FieldDescription id={`${id}-suits`}>Show full names on your rack. Small card and discard tiles keep written abbreviations and distinct symbols.</FieldDescription>
          <RadioGroup disabled={!ready} descriptionId={`${id}-suits`} label="Suit labels" value={preferences.suitLabels} onValueChange={suitLabels => update({ suitLabels })} options={[{ value: 'compact', label: 'Compact labels' }, { value: 'full', label: 'Full suit names' }]} />
        </FieldSet>
        <FieldSet disabled={!ready}><FieldLegend>Motion</FieldLegend><FieldDescription id={`${id}-motion`}>Device preference respects your system’s reduced-motion setting. Reduce motion also skips the animated deal.</FieldDescription>
          <RadioGroup disabled={!ready} descriptionId={`${id}-motion`} label="Motion" value={preferences.motion} onValueChange={motion => update({ motion })} options={[{ value: 'system', label: 'Device preference' }, { value: 'reduce', label: 'Reduce motion' }]} />
        </FieldSet>
      </FieldGroup>
      <p className="accessibility-save-note" role="status">{!ready ? 'Loading preferences…' : storageAvailable ? 'Changes save automatically on this browser. They apply to guest and account play.' : 'Changes apply now, but this browser cannot save them. Keep this page open to retain your preferences.'}</p>
      <Button variant="outline" disabled={!ready} onClick={() => update({ ...defaultPreferences })}>Restore defaults</Button>
      <FieldDescription className="accessibility-help">These preferences stay on this device. Set them again on another browser. Browser zoom remains available; the table and settings can scroll when space is limited. Game rules and available information stay the same.</FieldDescription>
    </form>
  </div>;
}
