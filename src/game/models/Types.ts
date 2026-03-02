export type RPSChoice = 'rock' | 'paper' | 'scissors' | null;
export type VolatilityMode = 'LOW' | 'MED' | 'HIGH';
export type GameState = 'idle' | 'betting' | 'running' | 'resolve' | 'result' | 'reset';
export type TileOutcome = 'win' | 'lose' | 'tie';

export interface RoundResult {
  roundSeed: number;
  lockedVolatility: VolatilityMode;
  playerMoves: RPSChoice[];   // length 5
  houseMoves: RPSChoice[];    // length 5
  outcomes: TileOutcome[];    // per-tile outcome
  winsCount: number;
  payoutMultiplier: number;
  payout: number;
  bet: number;
}
