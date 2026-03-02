/**
 * Standalone CLI script — run with:
 *   npm run simulate
 * which executes: tsx src/game/controllers/simulateRTP.ts
 */
import { runAllSimulations } from './Simulation';

const ROUNDS = 1_000_000;

console.log('\nRunning simulation...\n');
console.time('elapsed');
const report = runAllSimulations(ROUNDS);
console.log(report);
console.timeEnd('elapsed');
console.log('');
