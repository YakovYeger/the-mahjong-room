import { dailyTableReading } from './table-reading-catalog';
import { tableReadingChoices, tableReadingPuzzle } from './table-reading-puzzles';

export const tableAttemptKey = (date: string) => `mahjong-room-table-reading-attempt-v1:${date}`;

export function weeklyTableStars(date: string, today: string, read: (key: string) => string | null) {
  const start = new Date(`${date}T00:00:00Z`);
  const offset = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - offset);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + index);
    const date = day.toISOString().slice(0, 10);
    const entry = dailyTableReading(date, today);
    let earned = false;
    if (entry) {
      const first = read(tableAttemptKey(date));
      if (first) {
        const choices = tableReadingChoices(tableReadingPuzzle(entry.level, entry.scenario));
        const selected = choices.find(choice => choice.tile.id === first);
        earned = selected?.score === Math.min(...choices.map(choice => choice.score));
      }
    }
    return { date, available: Boolean(entry), earned };
  });
}
