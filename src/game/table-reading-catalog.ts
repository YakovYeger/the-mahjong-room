import entries from './data/table-reading-v1.json';
import type { TableLevel, TableReadingScenario } from './table-reading-puzzles';

const catalog = new Map(Object.entries(entries) as [string, { level: TableLevel; scenario: TableReadingScenario }][]);

export function dailyTableReading(date: string, today: string) {
  return date <= today ? catalog.get(date) : undefined;
}
