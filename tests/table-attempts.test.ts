import { expect, it } from 'vitest';
import { validTableAttempts } from '../src/persistence/table-attempts';
import { dailyTableReading } from '../src/game/table-reading-catalog';
import { tableReadingPuzzle } from '../src/game/table-reading-puzzles';

it('accepts published choices and rejects future dates, bad payloads and non-choice tiles', () => {
  const date = '2026-11-22';
  const entry = dailyTableReading(date, date)!;
  const puzzle = tableReadingPuzzle(entry.level, entry.scenario);
  expect(validTableAttempts({ [date]: puzzle.choices[0].id }, date)).toBe(true);
  expect(validTableAttempts({ [date]: puzzle.choices[0].id }, '2026-11-21')).toBe(false);
  expect(validTableAttempts({ [date]: 'fake' }, date)).toBe(false);
  expect(validTableAttempts([], date)).toBe(false);
  expect(validTableAttempts(null, date)).toBe(false);
  expect(validTableAttempts({ '2026-02-30': 'tile-0' }, date)).toBe(false);
});
