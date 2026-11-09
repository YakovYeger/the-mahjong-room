import { PhotoCardProvider } from './photo-card';
import { referenceHands } from './reference-card';
import type { HandDefinition } from './types';
import { TrainingCardProvider } from './training-card';

export const FIRST_PUZZLE_DATE = '2026-11-08';
export const FIRST_2025_PUZZLE_DATE = '2026-11-09';
const photoVariants = new Map<string, HandDefinition[]>();
for (const hand of PhotoCardProvider.getHands()) {
  const id = hand.id.split(':')[0];
  const list = photoVariants.get(id);
  if (list) list.push(hand);
  else photoVariants.set(id, [hand]);
}
const DAY_MS = 86_400_000;
const PAGE_SIZE = 24;
// This order is part of the v1 recipe. Adding a card line must not reshuffle past days.
const V1_HAND_IDS = [
  'garden-path', 'evening-dots', 'three-suit-sixes', 'compass-rose', 'lucky-fives',
  'crak-ladder', 'twin-runs', 'dragon-garden', 'seven-stars', 'season-line',
] as const;

export function puzzleDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function isPublishedPuzzleDate(date: string, today = puzzleDate()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < FIRST_PUZZLE_DATE || date > today) return false;
  const parsed = Date.parse(date);
  return Number.isFinite(parsed) && puzzleDate(new Date(parsed)) === date;
}

export function dailyPuzzleRecipe(date: string) {
  const day = Math.floor(Date.parse(date) / DAY_MS);
  const seed = day + 37_429_991;
  if (date >= FIRST_2025_PUZZLE_DATE) {
    const first = Date.parse(FIRST_2025_PUZZLE_DATE) / DAY_MS;
    const row = referenceHands[(day - first) % referenceHands.length];
    const variants = photoVariants.get(row.id);
    if (!variants?.length) throw new Error('The 2025 daily puzzle line is missing.');
    const number = referenceHands.filter(item => item.section === row.section).indexOf(row) + 1;
    return { version: 2 as const, kind: 'discard' as const, cardId: 'photo-2025' as const, date, seed, hand: variants[0], variants, row, number };
  }
  const handId = V1_HAND_IDS[((day % V1_HAND_IDS.length) + V1_HAND_IDS.length) % V1_HAND_IDS.length];
  const hand = TrainingCardProvider.getHands().find(item => item.id === handId);
  if (!hand) throw new Error('The v1 daily puzzle pattern is missing.');
  return { version: 1 as const, kind: 'discard' as const, cardId: 'training-card' as const, date, seed, hand, variants: [hand], row: null, number: 0 };
}

export function puzzleArchive(today: string, requestedPage: number) {
  const first = Date.parse(FIRST_PUZZLE_DATE);
  const latest = Date.parse(today);
  const total = Math.max(0, Math.floor((latest - first) / DAY_MS) + 1);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Number.isSafeInteger(requestedPage) ? Math.max(1, Math.min(requestedPage, pages)) : 1;
  const offset = (page - 1) * PAGE_SIZE;
  const entries = Array.from({ length: Math.min(PAGE_SIZE, total - offset) }, (_, i) =>
    dailyPuzzleRecipe(puzzleDate(new Date(latest - (offset + i) * DAY_MS))));
  return { entries, page, pages };
}

export function formatPuzzleDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(date));
}
