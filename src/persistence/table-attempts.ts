import { dailyTableReading } from '../game/table-reading-catalog';
import { tableReadingPuzzle } from '../game/table-reading-puzzles';

export type TableAttempts = Record<string, string>;

export function validTableAttempts(value: unknown, today: string): value is TableAttempts {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  if (entries.length > 366) return false;
  return entries.every(([date, tileId]) => {
    if (typeof tileId !== 'string') return false;
    const entry = dailyTableReading(date, today);
    return entry && tableReadingPuzzle(entry.level, entry.scenario).choices.some(tile => tile.id === tileId);
  });
}
