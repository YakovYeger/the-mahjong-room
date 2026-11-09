import { advancePlayingBots } from './bots';
import { applyGameAction, createGame } from './engine';
import { arrangeHand, cardTileKey } from './training-card';
import { createWall, deterministicShuffle } from './tiles';
import type { Tile } from './types';

import { dailyPuzzleRecipe } from './puzzle-catalog';
export { puzzleDate } from './puzzle-catalog';

export function createDailyPuzzle(date: string) {
  const recipe = dailyPuzzleRecipe(date);
  const { seed, hand, variants, cardId } = recipe;
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
  const required = new Set(variants.flatMap(variant => variant.groups.map(group => group.tileKey)));
  const discardIndex = pool.findIndex(tile => tile.type.kind !== 'joker' && !required.has(cardTileKey(tile)));
  if (discardIndex < 0) throw new Error('The daily line needs a discard outside all its variants.');
  const answer = take(discardIndex);
  const rack = deterministicShuffle([...complete.filter(tile => tile.id !== needed.id), answer], seed + 2);
  const game = createGame({ seed, id: recipe.version === 1 ? `daily-${date}` : `daily-v2-${date}`, cardId });
  game.phase = 'playing';
  game.players[0].rack = rack;
  for (const player of game.players.slice(1)) player.rack = pool.splice(0, 13);
  game.wall = deterministicShuffle([...pool, needed], seed + 3);
  return { ...recipe, rack, needed, answer, game };
}

type DailyPuzzle = ReturnType<typeof createDailyPuzzle>;
export function scoreDailyDiscard(puzzle: DailyPuzzle, tileId: string) {
  if (!puzzle.rack.some(tile => tile.id === tileId)) return null;
  const kept = puzzle.rack.filter(tile => tile.id !== tileId);
  const matching = Math.max(...puzzle.variants.map(hand => arrangeHand(kept, [], hand).matchingTileIds.length));
  const solution = arrangeHand(puzzle.rack.filter(tile => tile.id !== puzzle.answer.id), [], puzzle.hand);
  const neededGroup = solution.groups.find(group => group.slots.includes(null));
  return { correct: tileId === puzzle.answer.id, matching, jokerCanHelp: Boolean(neededGroup?.required.jokerAllowed) };
}

export function playDailyDiscard(puzzle: DailyPuzzle, tile: Tile) {
  const move = applyGameAction(puzzle.game, 'human', { type: 'DISCARD_TILE', tileId: tile.id });
  return move.ok ? advancePlayingBots(move.state) : null;
}
