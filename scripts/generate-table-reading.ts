import { readFileSync, writeFileSync } from 'node:fs';
import { generateTableReading } from '../src/game/table-reading-generator';
import { puzzleDate } from '../src/game/puzzle-catalog';

const [start, rawCount] = process.argv.slice(2);
const count = Number(rawCount);
const startTime = Date.parse(start);
if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isFinite(startTime) ||
    puzzleDate(new Date(startTime)) !== start || !Number.isSafeInteger(count) || count < 1 || count > 366) {
  throw new Error('Usage: npm run generate:table-reading -- YYYY-MM-DD COUNT (1–366)');
}

const file = new URL('../src/game/data/table-reading-v1.json', import.meta.url);
const catalog: Record<string, ReturnType<typeof generateTableReading>> = JSON.parse(readFileSync(file, 'utf8'));
let added = 0;
for (let offset = 0; offset < count; offset += 1) {
  const date = puzzleDate(new Date(startTime + offset * 86_400_000));
  if (catalog[date]) continue;
  catalog[date] = generateTableReading(date);
  added += 1;
}
writeFileSync(file, `{\n${Object.keys(catalog).sort().map(date => `  ${JSON.stringify(date)}: ${JSON.stringify(catalog[date])}`).join(',\n')}\n}\n`);
console.log(`Added ${added} table-reading puzzles. The catalog now contains ${Object.keys(catalog).length}.`);
