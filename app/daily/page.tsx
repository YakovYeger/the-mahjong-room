import { puzzleDate } from '../../src/game/daily-puzzle';
import { DailyPuzzle } from './daily-puzzle';
import './daily.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Daily Puzzle · The Mahjong Room', description: 'One Mahjong rack, one discard, and a fresh puzzle every day.' };

export default function DailyPage() {
  return <DailyPuzzle date={puzzleDate()} />;
}
