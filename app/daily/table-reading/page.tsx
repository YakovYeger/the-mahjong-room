import { notFound } from 'next/navigation';
import { puzzleDate } from '../../../src/game/puzzle-catalog';
import { dailyTableReading } from '../../../src/game/table-reading-catalog';
import { TABLE_LEVELS } from '../../../src/game/table-reading-puzzles';
import { TableReading } from './table-reading';
import '../daily.css';
import './table-reading.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Would you throw it? · The Mahjong Room', description: 'Read the exposed sets and pick a discard in a daily table-reading challenge.' };

export default async function TableReadingPage({ searchParams }: { searchParams: Promise<{ level?: string; date?: string }> }) {
  const { level, date } = await searchParams;
  const today = puzzleDate();
  if (date !== undefined || level === undefined) {
    const puzzleDay = date ?? today;
    const entry = dailyTableReading(puzzleDay, today);
    if (entry) return <TableReading key={puzzleDay} date={puzzleDay} level={entry.level} scenario={entry.scenario} />;
    if (date !== undefined) notFound();
  }
  const chosen = TABLE_LEVELS.find(item => item === level) ?? 'easy';
  return <TableReading key={chosen} level={chosen} />;
}
