import { TABLE_LEVELS } from '../../../src/game/table-reading-puzzles';
import { TableReading } from './table-reading';
import '../daily.css';
import './table-reading.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Would you throw it? · The Mahjong Room', description: 'Read the exposed sets and pick a discard in three table-reading challenges.' };

export default async function TableReadingPage({ searchParams }: { searchParams: Promise<{ level?: string }> }) {
  const { level } = await searchParams;
  const chosen = TABLE_LEVELS.find(item => item === level) ?? 'easy';
  return <TableReading key={chosen} level={chosen} />;
}
