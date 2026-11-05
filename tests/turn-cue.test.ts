// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useTurnCue } from '../src/table/turn-cue';
import { wallMilestone } from '../src/table/wall-meter';
afterEach(() => vi.useRealTimers());
it('only cues a newly actionable turn, never hydration, polling or rack changes', () => {
 vi.useFakeTimers();
 const { result, rerender, unmount } = renderHook(({ turn, id }) => useTurnCue({ id, turn }), { initialProps: { id: 'g', turn: 4 as number | null } });
 expect(result.current).toBeNull();
 rerender({ id: 'g', turn: null });
 rerender({ id: 'g', turn: 8 });
 expect(result.current).toBe(8);
 act(() => vi.advanceTimersByTime(1300));
 expect(result.current).toBeNull();
 rerender({ id: 'g', turn: 8 }); expect(result.current).toBeNull();
 rerender({ id: 'g', turn: 12 }); expect(result.current).toBe(12);
 rerender({ id: 'next-game', turn: 0 }); expect(result.current).toBeNull();
 unmount(); expect(vi.getTimerCount()).toBe(0);
});
it('marks the final ten and final three without replaying every draw or after reset', () => {
 expect(wallMilestone(11,10)).toBe(10);
 expect(wallMilestone(15,8)).toBe(10);
 expect(wallMilestone(10,9)).toBeNull();
 expect(wallMilestone(4,3)).toBe(3);
 expect(wallMilestone(20,2)).toBe(3);
 expect(wallMilestone(3,2)).toBeNull();
 expect(wallMilestone(1,0)).toBeNull();
 expect(wallMilestone(3,99)).toBeNull();
});
