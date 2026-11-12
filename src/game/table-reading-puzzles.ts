import { PhotoCardProvider } from './photo-card';
import { referenceHands } from './reference-card';
import { createWall } from './tiles';
import { analyzeDiscardDeadHand, arrangeHand, cardTileKey } from './training-card';
import type { Exposure, Seat, Tile } from './types';

export const TABLE_LEVELS = ['easy', 'medium', 'hard'] as const;
export type TableLevel = typeof TABLE_LEVELS[number];

const scenarios = {
  easy: {
    name: 'Read the first set',
    clue: 'June’s exposed 2 Dots narrow the card. Look for lines that use that exact three-tile group.',
    players: [{ name: 'June', seat: 'south', sets: [['dots-2', 3]] }],
    rack: ['bamboo-2', 'wind-north', 'bamboo-3', 'bamboo-3', 'bamboo-4', 'bamboo-4', 'characters-7', 'characters-7', 'characters-8', 'characters-8', 'dots-1', 'dots-9', 'dragon-red', 'flower-any'],
    choices: ['bamboo-2', 'wind-north'],
    discards: ['dots-7', 'characters-9', 'wind-west', 'characters-1', 'bamboo-9', 'dragon-green'],
  },
  medium: {
    name: 'Narrow the card',
    clue: 'June has exposed both 2 Dots and 4 Dots. All four Green Dragons are already discarded, ruling out the compatible line that needs a natural Green Dragon pair.',
    players: [{ name: 'June', seat: 'south', sets: [['dots-2', 3], ['dots-4', 4]] }],
    rack: ['dots-6', 'dots-8', 'bamboo-8', 'bamboo-1', 'bamboo-1', 'characters-5', 'characters-5', 'characters-7', 'characters-7', 'wind-north', 'wind-north', 'wind-east', 'flower-any', 'wind-south'],
    choices: ['dots-6', 'dots-8', 'bamboo-8'],
    discards: ['dragon-green', 'dragon-green', 'dragon-green', 'dragon-green', 'characters-1', 'characters-9'],
  },
  hard: {
    name: 'Two players, two threats',
    clue: 'June’s four 5 Bams and Sam’s four East Winds suggest different lines. Compare both players before you pick.',
    players: [{ name: 'June', seat: 'south', sets: [['bamboo-5', 4]] }, { name: 'Sam', seat: 'west', sets: [['wind-east', 4]] }],
    rack: ['bamboo-3', 'wind-west', 'characters-2', 'dots-7', 'dots-7', 'dots-8', 'dots-8', 'characters-8', 'characters-8', 'bamboo-1', 'bamboo-1', 'wind-north', 'flower-any', 'dragon-white'],
    choices: ['bamboo-3', 'wind-west', 'characters-2'],
    discards: ['wind-south', 'dots-1', 'characters-9', 'characters-7', 'dots-9', 'dragon-red'],
  },
} satisfies Record<TableLevel, { name: string; clue: string; players: { name: string; seat: Seat; sets: [string, 3 | 4][] }[]; rack: string[]; choices: string[]; discards: string[] }>;

export function tableReadingPuzzle(level: TableLevel) {
  const scenario = scenarios[level];
  const pool = createWall();
  const take = (key: string) => {
    const index = pool.findIndex(tile => cardTileKey(tile) === key);
    if (index < 0) throw new Error(`Too many copies of ${key} in table puzzle ${level}.`);
    return pool.splice(index, 1)[0];
  };
  const players = scenario.players.map((player, index) => ({
    id: `player-${index}`, name: player.name, seat: player.seat,
    exposures: player.sets.map(([key, count], set): Exposure => ({
      id: `set-${index}-${set}`, kind: count === 3 ? 'pung' : 'kong',
      tiles: Array.from({ length: count }, () => take(key)), calledFromPlayerId: 'player-east',
    })),
  }));
  const rack = scenario.rack.map(take);
  return {
    level, name: scenario.name, clue: scenario.clue, players, rack,
    choices: scenario.choices.map(key => rack.find(tile => cardTileKey(tile) === key)!),
    discards: scenario.discards.map(take),
  };
}

const hands = PhotoCardProvider.getHands();
export function tableReadingChoices(puzzle: ReturnType<typeof tableReadingPuzzle>) {
  return puzzle.choices.map(tile => {
    const byPlayer = puzzle.players.map(player => {
      const unavailable: Tile[] = [...puzzle.discards, ...puzzle.rack.filter(item => item.id !== tile.id),
        ...puzzle.players.filter(other => other.id !== player.id).flatMap(other => other.exposures.flatMap(set => set.tiles))];
      const possible = new Set(analyzeDiscardDeadHand(player.exposures, unavailable, hands).possibleHandIds);
      const lineIds = new Set<string>();
      for (const hand of hands) {
        if (!possible.has(hand.id)) continue;
        const remaining = arrangeHand([], player.exposures, hand).groups;
        if (remaining.some(group => !group.exposed && group.required.tileKey === cardTileKey(tile))) lineIds.add(hand.id.split(':')[0]);
      }
      return { player, lines: referenceHands.filter(row => lineIds.has(row.id)) };
    });
    return { tile, byPlayer, score: byPlayer.reduce((sum, entry) => sum + entry.lines.length, 0) };
  });
}
