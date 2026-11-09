import { describe, expect, it } from 'vitest';
import { createDailyPuzzle } from '../src/game/daily-puzzle';
import { dailyPuzzleRecipe, FIRST_PUZZLE_DATE, isPublishedPuzzleDate, puzzleArchive } from '../src/game/puzzle-catalog';
import { readPuzzleResult, savePuzzleResult } from '../src/game/puzzle-results';
import { tileLabel } from '../src/game/tiles';

describe('Daily puzzle catalog', () => {
  it('preserves the original launch puzzle and its solution', () => {
    const original = createDailyPuzzle(FIRST_PUZZLE_DATE);
    expect(dailyPuzzleRecipe(FIRST_PUZZLE_DATE)).toMatchObject({ version: 1, kind: 'discard', hand: { id: 'crak-ladder' } });
    expect(original.rack.map(tileLabel)).toEqual(['1 Crak', '4 Crak', '4 Crak', '2 Crak', '1 Crak', 'West Wind', '3 Crak', '4 Crak', '1 Crak', '3 Crak', '2 Crak', '3 Crak', 'White Dragon', '2 Crak']);
    expect(tileLabel(original.answer)).toBe('West Wind');
  });

  it('lists all published dates once and rejects unavailable or invalid dates', () => {
    const today = '2026-12-02';
    const newer = puzzleArchive(today, 1);
    const older = puzzleArchive(today, 2);
    const dates = [...newer.entries, ...older.entries].map(entry => entry.date);
    expect(newer.pages).toBe(2);
    expect(dates).toHaveLength(25);
    expect(new Set(dates).size).toBe(25);
    expect(dates[0]).toBe(today);
    expect(dates.at(-1)).toBe(FIRST_PUZZLE_DATE);
    expect(dates.every(date => isPublishedPuzzleDate(date, today))).toBe(true);
    expect(isPublishedPuzzleDate('2026-11-07', today)).toBe(false);
    expect(isPublishedPuzzleDate('2026-11-31', today)).toBe(false);
    expect(isPublishedPuzzleDate('2026-12-03', today)).toBe(false);
  });

  it('keeps answers by date and preserves the old saved answer', () => {
    const data = new Map([['mahjong-room-daily-result-v1', JSON.stringify({ date: '2026-11-08', tileId: 'west' })]]);
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    savePuzzleResult(storage, '2026-11-09', 'red');
    savePuzzleResult(storage, '2026-11-10', 'east');
    expect(readPuzzleResult(storage, '2026-11-08', ['west'])).toBe('west');
    expect(readPuzzleResult(storage, '2026-11-09', ['red'])).toBe('red');
    expect(readPuzzleResult(storage, '2026-11-10', ['east'])).toBe('east');
    expect(readPuzzleResult(storage, '2026-11-10', ['west'])).toBeNull();
  });
});
