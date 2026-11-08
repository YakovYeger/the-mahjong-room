import { describe, expect, it } from 'vitest';
import { createDailyPuzzle, playDailyDiscard, puzzleDate, scoreDailyDiscard } from '../src/game/daily-puzzle';
import { TrainingCardProvider } from '../src/game/training-card';

describe('Daily discard puzzle', () => {
  it('uses one deterministic deal per UTC day', () => {
    const date = puzzleDate(new Date('2026-11-08T23:59:59Z'));
    expect(date).toBe('2026-11-08');
    expect(createDailyPuzzle(date)).toEqual(createDailyPuzzle(date));
    expect(createDailyPuzzle('2026-11-09').hand.id).not.toBe(createDailyPuzzle(date).hand.id);
  });

  it('builds a physical deck and one best discard for each training pattern', () => {
    const hands = new Set<string>();
    for (let day = 1; day <= 20; day += 1) {
      const puzzle = createDailyPuzzle(`2026-11-${String(day).padStart(2, '0')}`);
      hands.add(puzzle.hand.id);
      const tiles = [...puzzle.game.players.flatMap(player => player.rack), ...puzzle.game.wall];
      expect(tiles).toHaveLength(152);
      expect(new Set(tiles.map(tile => tile.id)).size).toBe(152);
      expect(puzzle.rack).toHaveLength(14);
      expect(puzzle.game.wall.some(tile => tile.id === puzzle.needed.id)).toBe(true);
      const best = puzzle.rack.filter(tile => scoreDailyDiscard(puzzle, tile.id)?.matching === 13);
      expect(best.map(tile => tile.id)).toEqual([puzzle.answer.id]);
      expect(TrainingCardProvider.validateMahjong([...puzzle.rack.filter(tile => tile.id !== puzzle.answer.id), puzzle.needed], []).valid).toBe(true);
    }
    expect(hands.size).toBe(TrainingCardProvider.getHands().length);
  });

  it('continues with the selected discard, even when it was not the solution', () => {
    const puzzle = createDailyPuzzle('2026-11-08');
    const chosen = puzzle.rack.find(tile => tile.id !== puzzle.answer.id)!;
    expect(scoreDailyDiscard(puzzle, chosen.id)).toMatchObject({ correct: false, matching: 12 });
    const next = playDailyDiscard(puzzle, chosen)!;
    expect(next.events).toContainEqual(expect.objectContaining({ type: 'TILE_DISCARDED', playerId: 'human', tileId: chosen.id }));
    expect(next.players[0].rack.some(tile => tile.id === chosen.id)).toBe(false);
    expect(next.players[0].rack.some(tile => tile.id === puzzle.answer.id)).toBe(true);
    expect(puzzle.game.players[0].rack).toHaveLength(14);
  });
});
