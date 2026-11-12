import { describe, expect, it } from 'vitest';
import entries from '../src/game/data/table-reading-v1.json';
import { dailyTableReading } from '../src/game/table-reading-catalog';
import { generateTableReading } from '../src/game/table-reading-generator';
import { tableReadingChoices, tableReadingPuzzle } from '../src/game/table-reading-puzzles';

describe('daily table-reading catalog', () => {
  it('only serves dates that have been published and regenerates the same recipes', () => {
    const date = '2026-11-12';
    expect(dailyTableReading(date, '2026-11-11')).toBeUndefined();
    expect(dailyTableReading('2026-02-30', date)).toBeUndefined();
    for (const day of ['2026-11-12', '2026-11-13', '2026-11-14']) {
      expect(JSON.parse(JSON.stringify(generateTableReading(day)))).toEqual(dailyTableReading(day, day));
    }
  });

  it('deals physical tiles and gives every dated puzzle one best discard', () => {
    const keys = new Set<string>();
    for (const date of Object.keys(entries)) {
      const entry = dailyTableReading(date, date)!;
      const puzzle = tableReadingPuzzle(entry.level, entry.scenario);
      const tiles = [...puzzle.rack, ...puzzle.discards, ...puzzle.players.flatMap(player => player.exposures.flatMap(set => set.tiles))];
      expect(new Set(tiles.map(tile => tile.id)).size).toBe(tiles.length);
      expect(puzzle.rack).toHaveLength(14);
      expect(puzzle.discards).toHaveLength(6);
      const choices = tableReadingChoices(puzzle);
      expect(choices).toHaveLength(entry.level === 'easy' ? 2 : 3);
      const minimum = Math.min(...choices.map(choice => choice.score));
      expect(choices.filter(choice => choice.score === minimum)).toHaveLength(1);
      if (entry.level === 'hard') {
        expect(choices.some(choice => choice.score > minimum && choice.byPlayer.every(player => player.lines.length > 0))).toBe(true);
      }
      keys.add(JSON.stringify(entry.scenario));
    }
    expect(keys.size).toBe(Object.keys(entries).length);
  });
});
