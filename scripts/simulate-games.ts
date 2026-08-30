import { simulateGames } from '../src/game/simulation';

const flag = process.argv.indexOf('--count');
const requested = flag >= 0 ? Number(process.argv[flag + 1]) : 100;
const result = simulateGames(Number.isFinite(requested) && requested > 0 ? requested : 100);

console.log(`Games requested: ${result.requested}`);
console.log(`Games completed: ${result.completed}`);
console.log(`Invalid states: ${result.invalid}`);
console.log(`Stalled games: ${result.stalled}`);
console.log(`Average turns: ${result.averageTurns.toFixed(1)}`);
