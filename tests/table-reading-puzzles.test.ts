import { describe, expect, it } from 'vitest';
import { tableReadingChoices, tableReadingPuzzle, TABLE_LEVELS } from '../src/game/table-reading-puzzles';
import { tileLabel } from '../src/game/tiles';

describe('Table-reading challenges', () => {
  it('uses physical tiles once and gives each authored table a unique lower-risk discard', () => {
    const answers = ['North Wind', '8 Dot', 'West Wind'];
    TABLE_LEVELS.forEach((level, index) => {
      const puzzle = tableReadingPuzzle(level);
      const tiles = [...puzzle.rack, ...puzzle.discards, ...puzzle.players.flatMap(player => player.exposures.flatMap(set => set.tiles))];
      expect(puzzle.rack).toHaveLength(14);
      expect(new Set(tiles.map(tile => tile.id)).size).toBe(tiles.length);
      expect(puzzle.choices.every(choice => puzzle.rack.includes(choice))).toBe(true);
      const choices = tableReadingChoices(puzzle);
      const minimum = Math.min(...choices.map(choice => choice.score));
      expect(choices.filter(choice => choice.score === minimum).map(choice => tileLabel(choice.tile))).toEqual([answers[index]]);
    });
  });

  it('rules out the incompatible dragon line using the public discards', () => {
    const puzzle = tableReadingPuzzle('medium');
    const tile = puzzle.rack.find(item => tileLabel(item) === '6 Dot')!;
    // For this clue check, put an actual 3 Dot in the rack in place of 6 Dot.
    const three = { ...tile, type: { kind: 'number', suit: 'dots', rank: 3 } } as const;
    const withClue = { ...puzzle, rack: puzzle.rack.map(item => item.id === tile.id ? three : item), choices: [three] };
    expect(tableReadingChoices(withClue)[0].score).toBe(0);
    expect(tableReadingChoices({ ...withClue, discards: [] })[0].byPlayer[0].lines.map(row => row.id)).toContain('photo-2025-24');
  });

  it('counts lines per opponent and keeps a real threat on the best hard discard', () => {
    const puzzle = tableReadingPuzzle('hard');
    const choices = tableReadingChoices(puzzle);
    const best = choices.find(item => tileLabel(item.tile) === 'West Wind')!;
    expect(best.byPlayer.map(item => item.lines.length)).toEqual([0, 2]);
    expect(choices.find(item => tileLabel(item.tile) === '3 Bam')!.byPlayer[0].lines.length).toBeGreaterThan(2);
  });
});
