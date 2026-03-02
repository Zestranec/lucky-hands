import type { GameState } from '../models/Types';

/** Legal state transitions for Lucky Hands. */
const TRANSITIONS: Record<GameState, GameState[]> = {
  idle:    ['betting'],
  betting: ['running'],
  running: ['resolve'],
  resolve: ['result'],
  result:  ['reset'],
  reset:   ['betting'],
};

export class GameStateMachine {
  private _state: GameState = 'idle';

  get state(): GameState {
    return this._state;
  }

  canTransition(to: GameState): boolean {
    return TRANSITIONS[this._state]?.includes(to) ?? false;
  }

  /** Perform the transition, throwing if it is not allowed. */
  transition(to: GameState): void {
    if (!this.canTransition(to)) {
      throw new Error(`[StateMachine] Invalid transition: ${this._state} → ${to}`);
    }
    this._state = to;
  }

  is(...states: GameState[]): boolean {
    return states.includes(this._state);
  }

  /** Returns true if the player may interact with tiles / select choices. */
  get isPlayerInputAllowed(): boolean {
    return this.is('idle', 'betting');
  }

  /** Returns true if the Play button should be enabled (given all tiles have choices). */
  get isPlayAllowed(): boolean {
    return this.is('idle', 'betting');
  }

  /** Returns true if animations are running — block most interactions. */
  get isLocked(): boolean {
    return this.is('running', 'resolve');
  }
}
