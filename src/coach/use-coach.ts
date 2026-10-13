'use client';
import { useMemo, useState } from 'react';
import type { CardId } from '../game/cards';
import { useFollowedHand } from './use-followed-hand';
import { assessCoachSelection, createCoachSession } from './recommend';
import { getCoachHighlights } from './highlights';
import type { CoachDecision, CoachVisibleContext } from './types';

export function useCoach(context: CoachVisibleContext | null, storageKey: string, decision: CoachDecision, passCount = 3, selectedIds?: string[]) {
  const [followedId, follow] = useFollowedHand(storageKey, (context?.cardId ?? 'training-card') as CardId);
  const baseSession = useMemo(() => context ? createCoachSession({ ...context, followedHandId: followedId }, decision, passCount) : null, [context, followedId, decision, passCount]);
  const session = useMemo(() => baseSession && context ? { ...baseSession, selectionAssessment: assessCoachSelection(context, baseSession, selectedIds ?? []) } : null, [baseSession, context, selectedIds]);
  const [show, setShow] = useState(false);
  const [focus, setFocus] = useState<{ key: string; groupId: string } | null>(null);
  // A focus is valid for one decision and one exact followed variant. Derive this
  // rather than resetting state in an effect after a stale highlight has rendered.
  const key = `${storageKey}:${followedId}:${decision}:${passCount}:${session?.plan.target?.hand.id}:${context?.rack.map(tile => tile.id).join(',')}:${context?.discards.map(tile => tile.id).join(',')}:${context?.ownExposures.map(set => set.id).join(',')}`;
  const focusGroupId = focus?.key === key ? focus.groupId : null;
  const highlights = session ? getCoachHighlights(session, show, focusGroupId) : { rack: {}, groupIds: [], publicTileIds: [] };
  return { session, followedId, follow, show, setShow, highlights, focusGroupId,
    focusGroup: (groupId: string) => { setShow(true); setFocus(focusGroupId === groupId ? null : { key, groupId }); },
  };
}
