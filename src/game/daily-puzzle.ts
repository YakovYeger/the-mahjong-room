import { advancePlayingBots } from './bots';
import { applyGameAction, createGame } from './engine';
import { arrangeHand, cardTileKey, TrainingCardProvider } from './training-card';
import { createWall, deterministicShuffle } from './tiles';
import type { Tile } from './types';

export function puzzleDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function createDailyPuzzle(date: string) {
  const day = Math.floor(Date.parse(date) / 86_400_000);
  const seed = day + 37_429_991;
  const hands = TrainingCardProvider.getHands();
  const hand = hands[((day % hands.length) + hands.length) % hands.length];
  const pool = deterministicShuffle(createWall(), seed);
  const take = (index: number) => pool.splice(index, 1)[0];
  const complete = [...hand.groups].sort((a, b) => Number(a.jokerAllowed) - Number(b.jokerAllowed))
    .flatMap(group => Array.from({ length: group.count }, () => {
      const natural = pool.findIndex(tile => cardTileKey(tile) === group.tileKey);
      const index = natural >= 0 ? natural : group.jokerAllowed ? pool.findIndex(tile => tile.type.kind === 'joker') : -1;
      if (index < 0) throw new Error('The daily pattern cannot be built from a physical deck.');
      return take(index);
    }));
  const needed = deterministicShuffle(complete.filter(tile => tile.type.kind !== 'joker'), seed + 1)[0];
  const required = new Set(hand.groups.map(group => group.tileKey));
  const answer = take(pool.findIndex(tile => tile.type.kind !== 'joker' && !required.has(cardTileKey(tile))));
  const rack = deterministicShuffle([...complete.filter(tile => tile.id !== needed.id), answer], seed + 2);
  const game = createGame({ seed, id: `daily-${date}`, cardId: 'training-card' });
  game.phase = 'playing';
  game.players[0].rack = rack;
  for (const player of game.players.slice(1)) player.rack = pool.splice(0, 13);
  game.wall = deterministicShuffle([...pool, needed], seed + 3);
  return { date, hand, rack, needed, answer, game };
}

type DailyPuzzle = ReturnType<typeof createDailyPuzzle>;
export function scoreDailyDiscard(puzzle: DailyPuzzle, tileId: string) {
  if (!puzzle.rack.some(tile => tile.id === tileId)) return null;
  const layout = arrangeHand(puzzle.rack.filter(tile => tile.id !== tileId), [], puzzle.hand);
  const neededGroup = puzzle.hand.groups.find(group => group.tileKey === cardTileKey(puzzle.needed));
  return { correct: tileId === puzzle.answer.id, matching: layout.matchingTileIds.length, jokerCanHelp: Boolean(neededGroup?.jokerAllowed) };
}

export function playDailyDiscard(puzzle: DailyPuzzle, tile: Tile) {
  const move = applyGameAction(puzzle.game, 'human', { type: 'DISCARD_TILE', tileId: tile.id });
  return move.ok ? advancePlayingBots(move.state) : null;
}
