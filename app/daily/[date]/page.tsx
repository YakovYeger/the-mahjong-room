import { notFound } from 'next/navigation';
import { isPublishedPuzzleDate } from '../../../src/game/puzzle-catalog';
import { DailyPuzzle } from '../daily-puzzle';
import '../daily.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Puzzle Archive · The Mahjong Room' };

export default async function ArchivedPuzzlePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isPublishedPuzzleDate(date)) notFound();
  return <DailyPuzzle date={date} archived />;
}
