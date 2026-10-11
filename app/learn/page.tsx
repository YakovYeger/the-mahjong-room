import type { Metadata } from 'next';
import { Tutorial } from '../../src/learn/tutorial';
import { GuideShell } from '../../src/learn/guide-shell';

export const metadata: Metadata = { title: 'How to play — The Mahjong Room', description: 'Meet the tiles, read the table, and practice the stages of American Mahjong before your first game.' };

export default function LearnPage() {
  return <GuideShell current="learn"><Tutorial /></GuideShell>;
}
