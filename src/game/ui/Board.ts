import { Container } from 'pixi.js';
import type { Ticker } from 'pixi.js';
import type { RPSChoice, TileOutcome } from '../models/Types';
import { Tile } from './Tile';
import { NUM_TILES, TILE_W, TILE_GAP, BOARD_LAYOUT, TILE_ROW1_X, TILE_ROW2_X, TILE_ROW2_Y } from '../utils/layout';

/**
 * Manages the row of 5 Tiles.
 * Position is set externally (by GameApp via board.position.set()).
 */
export class Board extends Container {
  private readonly tiles: Tile[] = [];
  private readonly onChange: () => void;

  constructor(ticker: Ticker, onChange: () => void) {
    super();
    this.onChange = onChange;

    for (let i = 0; i < NUM_TILES; i++) {
      const tile = new Tile(ticker);

      if (BOARD_LAYOUT === '3x2') {
        if (i < 3) {
          tile.position.set(TILE_ROW1_X + i * (TILE_W + TILE_GAP), 0);
        } else {
          tile.position.set(TILE_ROW2_X + (i - 3) * (TILE_W + TILE_GAP), TILE_ROW2_Y);
        }
      } else {
        tile.position.set(i * (TILE_W + TILE_GAP), 0);
      }

      tile.on('choiceChanged', () => this.onChange());
      this.tiles.push(tile);
      this.addChild(tile);
    }
  }

  // ─── State queries ────────────────────────────────────────────────────────────

  allChosen(): boolean {
    return this.tiles.every((t) => t.getChoice() !== null);
  }

  /** Spec alias for allChosen(). */
  areAllSelected(): boolean { return this.allChosen(); }

  getChoices(): RPSChoice[] {
    return this.tiles.map((t) => t.getChoice());
  }

  /** Spec alias for getChoices(). */
  getPlayerMoves(): RPSChoice[] { return this.getChoices(); }

  // ─── Interaction control ─────────────────────────────────────────────────────

  setInteractive(on: boolean): void {
    this.tiles.forEach((t) => t.setInteractable(on));
  }

  /** Spec alias for setInteractive(). */
  lockAll(locked: boolean): void { this.setInteractive(!locked); }

  // ─── Reveal sequence ──────────────────────────────────────────────────────────

  /** Switches all tiles to the pending split-view (player shown, house "?"). */
  showAllPending(): void {
    this.tiles.forEach((t) => t.showPending());
  }

  /** Animate reveal of a single tile. Resolves when animation finishes. */
  async revealTile(index: number, house: RPSChoice, outcome: TileOutcome): Promise<void> {
    await this.tiles[index].reveal(house, outcome);
  }

  /** Programmatically set all tile choices (e.g. auto-select). Triggers onChange once. */
  setAllPlayerMoves(moves: RPSChoice[]): void {
    moves.forEach((move, i) => this.tiles[i].setPlayerMove(move));
    this.onChange();
  }

  // ─── Reset ────────────────────────────────────────────────────────────────────

  /** Reset all tiles to unselected pick-mode state. Clears all glows. */
  reset(): void {
    this.tiles.forEach((t) => t.reset());
  }
}
