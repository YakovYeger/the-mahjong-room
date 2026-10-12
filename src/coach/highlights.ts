import type { CoachHighlights, CoachSession } from './types';

export function getCoachHighlights(session: CoachSession, show: boolean, groupId: string | null): CoachHighlights {
  const result: CoachHighlights = { rack: {}, groupIds: [], publicTileIds: [] };
  if (!show || session.recommendation.kind === 'completed') return result;
  const target = session.plan.target;
  if (target?.candidate.viable && !target.blocked) {
    for (const group of target.groups) for (const id of group.rackTileIds) result.rack[id] = 'keep';
  }
  for (const id of session.recommendation.tileIds) result.rack[id] = 'suggest';
  const focus = target?.groups.find(group => group.id === groupId);
  if (focus) {
    result.groupIds = [focus.id];
    result.publicTileIds = focus.publicTileIds;
    for (const id of focus.rackTileIds) result.rack[id] = 'focus';
  }
  return result;
}

export const coachHighlightLabel = (role?: 'keep' | 'suggest' | 'focus') => role === 'keep' ? 'Fits your working hand' : role === 'suggest' ? 'Coach suggests reconsidering this tile' : role === 'focus' ? 'Coach focus group' : '';
export const coachHighlightMark = (role?: 'keep' | 'suggest' | 'focus') => role === 'keep' ? '✓' : role === 'suggest' ? '?' : role === 'focus' ? '•' : '';
