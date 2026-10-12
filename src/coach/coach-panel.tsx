'use client';
import type { CoachSession } from './types';

export interface CoachPanelProps {
  session: CoachSession;
  show: boolean;
  onShowChange: (show: boolean) => void;
  focusGroupId: string | null;
  onFocusGroup: (id: string) => void;
  onFollow: (id: string | null) => void;
  onBrowse: () => void;
  onHint?: () => void;
}

/** UI consumes an advisory session; it has no game actions or backend access. */
export function CoachPanel({ session, show, onShowChange, focusGroupId, onFocusGroup, onFollow, onBrowse, onHint }: CoachPanelProps) {
  const { plan, recommendation } = session;
  const target = plan.target;
  const working = target?.candidate.viable && !target.blocked;
  return <section className="coach-unit" aria-label="Coach and hand plan">
    <header className="coach-unit-heading"><div><span className="coach-eyebrow">Coach · {plan.followedId ? 'Your chosen direction' : 'Exploring directions'}</span><h2>{recommendation.headline}</h2></div><button aria-pressed={show} onClick={() => { onShowChange(!show); if (!show) onHint?.(); }}>{show ? 'Hide highlights' : 'Show on table'}</button></header>
    <p className="coach-next-step" aria-live="polite">{recommendation.explanation}</p>
    {session.selectionAssessment ? <p className="coach-selection-preview" role="status">{session.selectionAssessment}</p> : null}
    {plan.warning ? <p className="coach-warning" role="status">{plan.warning} Your pinned hand stays selected until you change it.</p> : null}
    {show ? <div className="coach-highlight-key" aria-label="Coach highlight key"><span>✓ Fits hand</span><span>? Reconsider</span><span>• Focus group</span><small>Highlights guide you; select tiles yourself.</small></div> : null}
    <details className="coach-plan-details"><summary>Your hand plan{target ? ` · ${target.candidate.matchingTileIds.length}/14 fit` : ''}</summary>
      {target ? <><div className="coach-plan-title"><div><h3>{target.hand.name}</h3><p>{target.summary}</p></div>{!plan.followedId ? <button onClick={() => onFollow(target.hand.id)}>Follow this hand</button> : <button onClick={() => onFollow(null)}>Explore freely</button>}</div>
        <div className="coach-group-list" aria-label="Groups in your working hand">{target.groups.map(group => <button key={group.id} aria-pressed={focusGroupId === group.id} onClick={() => { onFocusGroup(group.id); onHint?.(); }} aria-label={`Show ${group.label} ${group.kind} on table, ${group.missing} missing`}><span>{group.count} × {group.label}<small>{group.exposed ? 'Exposed' : group.jokerAllowed ? `${group.kind} · Jokers allowed` : `${group.kind} · Natural only`}</small></span><b>{group.matched}/{group.count}</b><span className="coach-group-need">{group.missing ? `${group.missing} missing` : 'Complete'}</span></button>)}</div>
        {focusGroupId ? <p className="coach-focus-note" role="status">{target.groups.find(group => group.id === focusGroupId)?.note} Matching public tiles are outlined on the table; discards and other players’ natural tiles in exposed sets are unavailable to draw.</p> : <p className="coach-focus-note">Tap a group to connect its needs to your rack, card pattern, and public tiles.</p>}
        {!working ? <p>Choose an available alternative to get a new working plan.</p> : null}
      </> : <p>No compatible direction found. Browse the card to inspect your exposed sets.</p>}
      <div className="coach-alternatives" aria-label="Compare hand directions">{plan.alternatives.map(line => <div key={line.hand.id}><div><strong>{line.hand.name}</strong><span>{line.candidate.matchingTileIds.length}/14 fit · {line.candidate.completionDistance} needed</span><small>{line.hand.exposure === 'concealed' ? 'Concealed · Natural singles & pairs' : 'Exposed · Calls allowed for sets of 3+'}</small></div><button onClick={() => onFollow(line.hand.id)}>Follow</button></div>)}</div>
      <button className="coach-browse" onClick={onBrowse}>Compare the full card</button>
    </details>
    <details className="coach-reasons"><summary>Why this advice?</summary>
      {recommendation.reasons?.map(reason => <div key={reason.title}><h3>{reason.title}</h3><p>{reason.body}</p></div>)}
      {recommendation.tileReasons?.length ? <ul>{recommendation.tileReasons.map(reason => <li key={reason.tileId}>{reason.text}</li>)}</ul> : null}
      {recommendation.tradeoff ? <div><h3>The tradeoff</h3><p>{recommendation.tradeoff}</p></div> : <p>{recommendation.explanation}</p>}
      <p className="coach-limits">{recommendation.confidence === 'low' ? 'Tentative guidance. ' : recommendation.confidence === 'medium' ? 'A hand-fit suggestion. ' : 'Based on the current rules and visible state. '}The coach uses your rack and public tiles. It cannot see opponents’ hidden racks or future draws.</p>
    </details>
  </section>;
}
