import { Container, Graphics } from 'pixi.js';
import type { Ticker } from 'pixi.js';
import type { TileOutcome } from '../../models/Types';
import { Runner } from './Runner';
import { Shark } from './Shark';
import { PortalSlot } from './PortalSlot';
import { spawnBloodBurst } from './BloodBurst';
import {
  CANVAS_W, MOBILE, NUM_TILES,
  PORTAL_LANE_H,
  BOARD_X, TILE_W, TILE_GAP,
  COLOR,
} from '../../utils/layout';
import { tween, wait, easeOutQuad, easeOutBack } from '../../utils/tween';

// ─── Portal ellipse dimensions ────────────────────────────────────────────────
// pw = semi-major (horizontal) radius, ph = semi-minor (vertical) radius.
const PORTAL_PW = MOBILE ? 36 : 44;   // wide half-axis
const PORTAL_PH = MOBILE ? 16 : 20;   // thin half-axis (flat ellipse)

// ─── PortalLane ───────────────────────────────────────────────────────────────
// Coordinator Container. Positioned at (0, PORTAL_LANE_Y) in stage coords.
// All children use local (lane-relative) coordinates.

export class PortalLane extends Container {
  // Only reset() increments _gen.
  // async methods read this._gen at start and check after each await.
  private _gen = 0;
  private readonly _ticker: Ticker;

  private readonly _slots:       PortalSlot[];
  private readonly _runner:      Runner;
  private readonly _finaleShark: Shark;

  private readonly _portalCY: number;
  private readonly _footY:    number;   // runner foot Y in lane-local coords
  private readonly _portalXs: number[];

  constructor(ticker: Ticker) {
    super();
    this._ticker = ticker;

    this._portalCY = PORTAL_LANE_H / 2;
    // Runner stands just above the top of the ellipse
    this._footY    = this._portalCY - Math.round(PORTAL_PH * 0.9);
    this._portalXs = PortalLane._computePortalXs();

    // ── Subtle background strip ───────────────────────────────────────────
    const bg = new Graphics();
    bg.beginFill(COLOR.bgDark, 0.55);
    bg.drawRect(0, 0, CANVAS_W, PORTAL_LANE_H);
    bg.endFill();
    this.addChild(bg);

    // ── Ground line (runner walks on this) ────────────────────────────────
    const ground = new Graphics();
    ground.lineStyle(1, 0x1a2a3a, 0.8);
    ground.moveTo(0, this._footY + 1);
    ground.lineTo(CANVAS_W, this._footY + 1);
    this.addChild(ground);

    // ── Portal slots ──────────────────────────────────────────────────────
    this._slots = this._portalXs.map((x) => {
      const slot = new PortalSlot(ticker, PORTAL_PW, PORTAL_PH);
      slot.position.set(x, this._portalCY);
      this.addChild(slot);
      slot.startSwirl();
      return slot;
    });

    // ── Runner (hidden between rounds) ────────────────────────────────────
    this._runner = new Runner(ticker);
    this._runner.position.set(-40, this._footY);
    this._runner.visible = false;
    this.addChild(this._runner);

    // ── Finale shark (large, hidden) ──────────────────────────────────────
    this._finaleShark = new Shark(ticker, 'large');
    this._finaleShark.visible = false;
    this._finaleShark.position.set(CANVAS_W + 80, this._portalCY);
    this.addChild(this._finaleShark);
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Fire-and-forget: runner walks in from left (350ms).
   * GameApp calls with `void` — runner always arrives before first tile reveal (450ms delay).
   */
  async beginEntry(): Promise<void> {
    const gen = this._gen;
    this._runner.visible = true;
    this._runner.startWalking();
    const toX = this._portalXs[0];
    await tween(this._ticker, 350, (t) => {
      if (this._gen !== gen) return;
      this._runner.position.x = -40 + (toX + 40) * easeOutQuad(t);
    });
    if (this._gen !== gen) return;
    this._runner.position.x = toX;
    this._runner.stopWalking();
  }

  /**
   * Called by GameApp inside Promise.all with revealTile for each tile.
   * Moves runner to portal[index], then plays flash + runner reaction concurrently.
   * On 'lose', also spawns a blood burst at the bite position.
   */
  async playTileOutcome(index: number, outcome: TileOutcome): Promise<void> {
    const gen = this._gen;

    // Walk to portal (skip for index 0 — runner already there from beginEntry)
    if (index > 0) {
      this._runner.startWalking();
      const fromX = this._runner.position.x;
      const toX   = this._portalXs[index];
      await tween(this._ticker, 160, (t) => {
        if (this._gen !== gen) return;
        this._runner.position.x = fromX + (toX - fromX) * easeOutQuad(t);
      });
      if (this._gen !== gen) return;
      this._runner.position.x = this._portalXs[index];
      this._runner.stopWalking();
    }

    // Blood burst fires immediately on bite (deterministic — no Math.random)
    if (outcome === 'lose') {
      spawnBloodBurst(this, this._portalXs[index], this._footY - 4, this._ticker);
    }

    // Flash and runner reaction concurrently.
    // slotLocalFootY = runner foot Y in slot-local coords
    const slotLocalFootY = this._footY - this._portalCY;
    await Promise.all([
      this._slots[index].flashOutcome(outcome, slotLocalFootY),
      this._runnerReact(outcome, gen),
    ]);
  }

  /**
   * Called after all 5 tiles have been revealed. isWin = payout > 0.
   */
  async playFinale(isWin: boolean): Promise<void> {
    const gen = this._gen;
    await wait(this._ticker, 150);
    if (this._gen !== gen) return;

    if (isWin) {
      await this._victoryFinale(gen);
    } else {
      await this._sharkFinale(gen);
    }
  }

  /** Full cleanup — called by GameApp in onNextRound before board.reset(). */
  reset(): void {
    ++this._gen;

    this._runner.cancel();
    this._runner.visible = false;
    this._runner.alpha = 1;
    this._runner.scale.set(1);
    this._runner.rotation = 0;
    this._runner.position.set(-40, this._footY);

    this._finaleShark.cancel();
    this._finaleShark.stopBob();
    this._finaleShark.visible = false;
    this._finaleShark.rotation = 0;
    this._finaleShark.position.set(CANVAS_W + 80, this._portalCY);

    this._slots.forEach((s) => {
      s.cancel();
      s.scale.set(1);
      s.alpha = 1;
      s.visible = true;
      s.reset();   // restores default ring colour + starts swirl
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async _runnerReact(outcome: TileOutcome, gen: number): Promise<void> {
    if (this._gen !== gen) return;
    if (outcome === 'win')      await this._runner.jumpOver(MOBILE ? 20 : 26);
    else if (outcome === 'tie') await this._runner.stumble();
    else                        await this._runner.biteReact();
  }

  private async _victoryFinale(gen: number): Promise<void> {
    this._runner.victoryPose();

    // Scale bounce: grow → settle
    await tween(this._ticker, 220, (t) => {
      if (this._gen !== gen) return;
      this._runner.scale.set(1 + 0.35 * easeOutBack(t));
    });
    if (this._gen !== gen) return;

    await tween(this._ticker, 220, (t) => {
      if (this._gen !== gen) return;
      this._runner.scale.set(1.35 - 0.35 * easeOutQuad(t));
    });
    if (this._gen !== gen) return;
    this._runner.scale.set(1);

    // Flash all portals gold (reuse 'tie' = gold colour)
    const slotLocalFootY = this._footY - this._portalCY;
    await Promise.all(
      this._slots.map((s) => s.flashOutcome('tie', slotLocalFootY))
    );
    if (this._gen !== gen) return;

    await wait(this._ticker, 300);
  }

  private async _sharkFinale(gen: number): Promise<void> {
    // 1. Portals 0, 1, 3, 4 shrink away; portal 2 (centre) stays
    await Promise.all([
      this._slots[0].shrinkAway(),
      this._slots[1].shrinkAway(),
      this._slots[3].shrinkAway(),
      this._slots[4].shrinkAway(),
    ]);
    if (this._gen !== gen) return;

    // 2. Centre portal grows
    await tween(this._ticker, 200, (t) => {
      if (this._gen !== gen) return;
      this._slots[2].scale.set(1 + 0.3 * easeOutBack(t));
    });
    if (this._gen !== gen) return;

    // 3. Big shark swims in + runner gets eaten — concurrently.
    //    Shark stops so its mouth (at +LARGE_SZ from centre, facing left/PI) lands on runner.
    const targetX = this._portalXs[2] - Shark.LARGE_SZ;
    const targetY = this._footY;

    this._finaleShark.visible = true;
    this._finaleShark.position.set(CANVAS_W + 80, this._portalCY);

    await Promise.all([
      this._finaleShark.swimIn(targetX, targetY),
      this._runner.eaten(),
    ]);
    if (this._gen !== gen) return;

    // 4. Runner appears "caught in teeth" at shark mouth position
    const mouthX = targetX + Shark.LARGE_SZ * 0.85;   // near the nose/mouth tip
    const mouthY = targetY - 12;                        // slightly above shark centre

    this._runner.caughtPose();
    this._runner.scale.set(0.45);
    this._runner.alpha = 1;
    this._runner.position.set(mouthX, mouthY);
    this._runner.visible = true;

    // 5. Both shark and caught runner wiggle for 1.5s
    const wiggleOriginY = targetY;
    const wiggleTick = () => {
      const dy = Math.sin(Date.now() / 120) * 4;
      this._finaleShark.position.y = wiggleOriginY + dy;
      this._runner.position.y      = mouthY + dy;
    };
    this._ticker.add(wiggleTick);
    await wait(this._ticker, 1500);
    if (this._gen !== gen) {
      this._ticker.remove(wiggleTick);
      return;
    }
    this._ticker.remove(wiggleTick);

    // 6. Fade runner out
    await tween(this._ticker, 400, (t) => {
      if (this._gen !== gen) return;
      this._runner.alpha = 1 - t;
    });
    if (this._gen !== gen) return;
    this._runner.visible = false;
    this._runner.alpha   = 1;

    // 7. Shark settles and bobs until reset()
    this._finaleShark.position.y = wiggleOriginY;
    this._finaleShark.startBob();
  }

  // ─── Static helpers ───────────────────────────────────────────────────────────

  private static _computePortalXs(): number[] {
    if (MOBILE) {
      // Even spacing — mobile 3x2 tile index order is NOT left-to-right
      return Array.from({ length: NUM_TILES }, (_, i) =>
        Math.round(CANVAS_W / (NUM_TILES + 1) * (i + 1))
      ); // → [77, 153, 230, 307, 383]
    }
    // Desktop: align to tile world-space centres
    return Array.from({ length: NUM_TILES }, (_, i) =>
      BOARD_X + i * (TILE_W + TILE_GAP) + Math.floor(TILE_W / 2)
    ); // → [160, 280, 400, 520, 640]
  }
}
