import { RNG } from './RNG';
import { PAYTABLES } from './Paytables';
import type { RPSChoice, VolatilityMode, RoundResult, TileOutcome } from '../models/Types';

const CHOICES: RPSChoice[] = ['rock', 'paper', 'scissors'];

/** Returns true if `a` beats `b` in Rock-Paper-Scissors. */
function beats(a: RPSChoice, b: RPSChoice): boolean {
  return (
    (a === 'rock'     && b === 'scissors') ||
    (a === 'paper'    && b === 'rock')     ||
    (a === 'scissors' && b === 'paper')
  );
}

/** Compute single-tile outcome from player vs house choice. */
export function getTileOutcome(player: RPSChoice, house: RPSChoice): TileOutcome {
  if (player === house) return 'tie';
  return beats(player, house) ? 'win' : 'lose';
}

export class OutcomeController {
  /**
   * Generate the house's 5 moves from a seed.
   * Deterministic: same seed → same moves always.
   */
  static generateHouseMoves(seed: number): RPSChoice[] {
    const rng = new RNG(seed);
    return Array.from({ length: 5 }, () => CHOICES[rng.nextInt(3)]);
  }

  /** Count how many player moves beat the corresponding house move. */
  static countWins(playerMoves: RPSChoice[], houseMoves: RPSChoice[]): number {
    return playerMoves.reduce<number>(
      (acc, p, i) => acc + (beats(p, houseMoves[i]) ? 1 : 0),
      0,
    );
  }

  /** Get the gross payout for bet * payoutMultiplier. */
  static computePayout(
    bet: number,
    winsCount: number,
    mode: VolatilityMode,
  ): { multiplier: number; payout: number } {
    const multiplier = PAYTABLES[mode](winsCount);
    return { multiplier, payout: bet * multiplier };
  }

  /**
   * Resolve an entire round deterministically.
   * This is the single source of truth for game outcomes.
   */
  static resolveRound(
    seed: number,
    playerMoves: RPSChoice[],
    volatility: VolatilityMode,
    bet: number,
  ): RoundResult {
    const houseMoves = this.generateHouseMoves(seed);
    const outcomes = playerMoves.map((p, i) => getTileOutcome(p, houseMoves[i]));
    const winsCount = outcomes.filter((o) => o === 'win').length;
    const { multiplier, payout } = this.computePayout(bet, winsCount, volatility);

    return {
      roundSeed: seed,
      lockedVolatility: volatility,
      playerMoves,
      houseMoves,
      outcomes,
      winsCount,
      payoutMultiplier: multiplier,
      payout,
      bet,
    };
  }
}
