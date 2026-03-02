import { RNG } from './RNG';
import { OutcomeController } from './OutcomeController';
import type { VolatilityMode, RPSChoice } from '../models/Types';

const ALL_CHOICES: RPSChoice[] = ['rock', 'paper', 'scissors'];

/**
 * Simulate `rounds` rounds of Lucky Hands for a given volatility mode.
 * Uses the same OutcomeController logic as the real game.
 *
 * @param mode        Volatility mode to simulate
 * @param rounds      Number of rounds (default 1_000_000)
 * @param masterSeed  Seed for the meta-RNG that generates per-round seeds + player moves
 * @returns           Simulated RTP in range [0, ∞) — expect ~0.95
 */
export function simulateRTP(
  mode: VolatilityMode,
  rounds = 1_000_000,
  masterSeed = 42,
): number {
  const rng = new RNG(masterSeed);
  const bet = 10;
  let totalBet = 0;
  let totalReturn = 0;

  for (let i = 0; i < rounds; i++) {
    // Fresh seed per round (non-zero)
    const seed = (rng.nextInt(0x7fffff00) + 1) >>> 0;
    // Random player moves (uniform, same as a perfectly-random player)
    const playerMoves = Array.from(
      { length: 5 },
      () => ALL_CHOICES[rng.nextInt(3)],
    );

    const result = OutcomeController.resolveRound(seed, playerMoves, mode, bet);
    totalBet += bet;
    totalReturn += result.payout;
  }

  return totalBet === 0 ? 0 : totalReturn / totalBet;
}

/** Run all three modes and return a summary string. */
export function runAllSimulations(rounds = 1_000_000): string {
  const lines: string[] = [
    `Lucky Hands RTP Simulation — ${rounds.toLocaleString()} rounds per mode`,
    '─'.repeat(52),
  ];
  const modes: VolatilityMode[] = ['LOW', 'MED', 'HIGH'];

  for (const mode of modes) {
    const rtp = simulateRTP(mode, rounds);
    const pct = (rtp * 100).toFixed(4);
    const diff = ((rtp - 0.95) * 100).toFixed(4);
    const sign = Number(diff) >= 0 ? '+' : '';
    lines.push(`  ${mode.padEnd(5)}  RTP = ${pct}%   (delta vs 95%: ${sign}${diff}%)`);
  }

  lines.push('─'.repeat(52));
  return lines.join('\n');
}
