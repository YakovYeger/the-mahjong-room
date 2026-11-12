import { PhotoCardProvider } from './photo-card';
import { tableReadingChoices, tableReadingPuzzle, type TableLevel, type TableReadingScenario } from './table-reading-puzzles';
import { createWall, deterministicShuffle } from './tiles';
import { cardTileKey } from './training-card';

const exposable = PhotoCardProvider.getHands()
  .filter(hand => hand.exposure === 'exposed')
  .map(hand => ({ hand, sets: hand.groups.flatMap(({ tileKey, count }): [string, 3 | 4][] =>
    count === 3 || count === 4 ? [[tileKey, count]] : []) }))
  .filter(({ sets }) => sets.length);
const wall = createWall().map(cardTileKey).filter(key => key !== 'joker');

export function generateTableReading(date: string): { level: TableLevel; scenario: TableReadingScenario } {
  const day = Date.parse(date) / 86_400_000;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(day) || new Date(day * 86_400_000).toISOString().slice(0, 10) !== date) throw new Error('Expected a puzzle date in YYYY-MM-DD format.');
  const level = (['easy', 'medium', 'hard'] as const)[day % 3];
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const seed = (day * 1009 + attempt * 104729) >>> 0;
    const [first, second] = deterministicShuffle(exposable, seed);
    const sets = deterministicShuffle(first.sets, seed + 1).slice(0, level === 'medium' ? 2 : 1);
    if (level === 'medium' && sets.length !== 2) continue;

    const players: TableReadingScenario['players'] = [{ name: 'June', seat: 'south', sets }];
    if (level === 'hard') players.push({ name: 'Sam', seat: 'west', sets: [deterministicShuffle(second.sets, seed + 2)[0]] });
    const pool = deterministicShuffle(wall, seed + 3);
    const exposed = players.flatMap(player => player.sets.flatMap(([key, count]) => Array<string>(count).fill(key)));
    let valid = true;
    for (const key of exposed) {
      const index = pool.indexOf(key);
      if (index < 0) { valid = false; break; }
      pool.splice(index, 1);
    }
    if (!valid) continue;

    // For medium puzzles, put all copies of one face on the table to practice spotting dead tiles.
    const clueTileKey = level === 'medium'
      ? first.hand.groups.find(group => !group.jokerAllowed && group.tileKey !== 'flower-any' && !exposed.includes(group.tileKey))?.tileKey
      : undefined;
    if (level === 'medium' && !clueTileKey) continue;
    const discards = clueTileKey ? pool.filter(key => key === clueTileKey) : [];
    const remaining = pool.filter(key => key !== clueTileKey);
    discards.push(...remaining.splice(0, 6 - discards.length));
    const rack = remaining.slice(0, 14);
    const candidateKeys = [...new Set(rack.filter(key => key !== 'flower-any'))];
    const scenario: TableReadingScenario = {
      name: level === 'easy' ? 'Read the first set' : level === 'medium' ? 'Read the discards' : 'Read both players',
      clue: level === 'easy' ? 'Start with June’s exposed set and look for matching groups on the card.'
        : level === 'medium' ? 'All four copies of the highlighted tile are in the discard pool. A line that still needs a natural copy is unavailable.'
        : 'Compare the card lines for June and Sam. The same discard can help either player.',
      clueTileKey, players, rack, choices: candidateKeys, discards,
    };
    const scored = tableReadingChoices(tableReadingPuzzle(level, scenario)).sort((a, b) => a.score - b.score);
    const safest = scored[0];
    if (!safest) continue;
    const riskier = scored.filter(choice => choice.score > safest.score);
    const count = level === 'easy' ? 1 : 2;
    if (riskier.length < count) continue;
    const sharedThreat = riskier.find(choice => choice.byPlayer.every(entry => entry.lines.length));
    if (level === 'hard' && !sharedThreat) continue;
    const distractors = level === 'hard' && sharedThreat
      ? [sharedThreat, ...riskier.filter(choice => choice !== sharedThreat)]
      : riskier;
    scenario.choices = [safest, ...distractors.slice(0, count)].map(choice => cardTileKey(choice.tile));
    scenario.rack = deterministicShuffle(rack, seed + 4);
    return { level, scenario };
  }
  throw new Error(`Could not generate a table-reading puzzle for ${date}.`);
}
