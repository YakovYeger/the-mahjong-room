import type { ReactNode } from 'react';
import { patternTokens, type ReferenceHand } from '../game/reference-card';

const inkCues = { jade: { mark: '○', name: 'green' }, red: { mark: '△', name: 'red' }, ink: { mark: '□', name: 'black' } } as const;

export function ReferenceCardLine({ hand, number, leading = false, fit, showSuitCues = true, actions }: {
  hand: ReferenceHand; number: number; leading?: boolean; fit?: number; showSuitCues?: boolean; actions?: ReactNode;
}) {
  return <article className={`reference-hand${leading ? ' leading' : ''}`} aria-label={`${hand.section}, hand ${number}`}>
    <div className="reference-patterns">
      <span className="reference-line-number">Hand {number}{fit !== undefined ? ` · ${fit}/14 tiles` : ''}</span>
      {hand.patterns.map((pattern, i) => <div key={pattern}>{i ? <small>or</small> : null}{patternTokens(pattern).map((token, j) => <strong key={j} className={`card-ink-${token.ink}`} aria-label={`${token.text}, ${inkCues[token.ink].name} card ink`}>{showSuitCues ? <span className="card-suit-cue" aria-hidden="true">{inkCues[token.ink].mark}</span> : null}{token.text}</strong>)}</div>)}
      <p>{hand.note || 'Follow the printed groups.'}</p>
    </div>
    <div className={`reference-value ${hand.exposure === 'C' ? 'concealed' : ''}`}><b>{hand.value}</b><span>{hand.exposure === 'C' ? 'Concealed' : 'Exposed'}</span></div>
    {actions}
  </article>;
}
