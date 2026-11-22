import { expect, it } from 'vitest';
import { weeklyTableStars, tableAttemptKey } from '../src/game/weekly-table-stars';
import { dailyTableReading } from '../src/game/table-reading-catalog';
import { tableReadingChoices, tableReadingPuzzle } from '../src/game/table-reading-puzzles';

it('uses Monday through Sunday and locks future or missing puzzles', () => {
  const days = weeklyTableStars('2026-11-22', '2026-11-19', () => null);
  expect(days.map(day => day.date)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
  expect(days.filter(day => day.available)).toHaveLength(4);
  expect(weeklyTableStars('2026-11-12', '2026-11-22', () => null)[0].available).toBe(false);
});

it('recovers seven earned stars from existing first-attempt records', () => {
  const saved = new Map<string, string>();
  for (const day of weeklyTableStars('2026-11-22', '2026-11-22', () => null)) {
    const entry = dailyTableReading(day.date, day.date)!;
    const choices = tableReadingChoices(tableReadingPuzzle(entry.level, entry.scenario));
    const best = choices.reduce((a,b) => a.score < b.score ? a : b);
    saved.set(tableAttemptKey(day.date), best.tile.id);
  }
  const read = (key: string) => saved.get(key) ?? null;
  expect(weeklyTableStars('2026-11-22', '2026-11-22', read).every(day => day.earned)).toBe(true);
  saved.set(tableAttemptKey('2026-11-18'), 'invalid-tile');
  expect(weeklyTableStars('2026-11-22', '2026-11-22', read).filter(day => day.earned)).toHaveLength(6);
});
