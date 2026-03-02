import { Container, Graphics } from 'pixi.js';
import type { Ticker } from 'pixi.js';
import { tween, easeOutQuad, easeInQuad } from '../../utils/tween';

// ─── Runner ───────────────────────────────────────────────────────────────────
// Simple stick-figure character. Origin is at foot level (local y = 0).
// Total height ~48px. All body parts are plain Graphics primitives.

export class Runner extends Container {
  private _gen = 0;
  private readonly _ticker: Ticker;

  // Limb containers (rotated for walk cycle / reactions)
  private readonly _leftLeg:  Container;
  private readonly _rightLeg: Container;
  private readonly _leftArm:  Container;
  private readonly _rightArm: Container;

  // Walk-cycle ticker handle (null when not walking)
  private _walkTick: ((_dt: number) => void) | null = null;
  private _walkElapsed = 0;

  constructor(ticker: Ticker) {
    super();
    this._ticker = ticker;

    // ── Head ────────────────────────────────────────────────────────────────
    const head = new Graphics();
    head.beginFill(0xffe0b0, 1);
    head.drawCircle(0, -39, 9);
    head.endFill();
    // Eyes
    head.beginFill(0x000000, 1);
    head.drawCircle(-3, -41, 1.5);
    head.drawCircle(3, -41, 1.5);
    head.endFill();
    this.addChild(head);

    // ── Body ────────────────────────────────────────────────────────────────
    const body = new Graphics();
    body.beginFill(0x4488cc, 1);
    body.drawRect(-5, -30, 10, 18);
    body.endFill();
    this.addChild(body);

    // ── Arms ────────────────────────────────────────────────────────────────
    this._leftArm = new Container();
    this._leftArm.position.set(-5, -25);
    const lArmGfx = new Graphics();
    lArmGfx.beginFill(0x4488cc, 1);
    lArmGfx.drawRect(-10, -2, 10, 4);
    lArmGfx.endFill();
    this._leftArm.addChild(lArmGfx);
    this.addChild(this._leftArm);

    this._rightArm = new Container();
    this._rightArm.position.set(5, -25);
    const rArmGfx = new Graphics();
    rArmGfx.beginFill(0x4488cc, 1);
    rArmGfx.drawRect(0, -2, 10, 4);
    rArmGfx.endFill();
    this._rightArm.addChild(rArmGfx);
    this.addChild(this._rightArm);

    // ── Legs ────────────────────────────────────────────────────────────────
    this._leftLeg = new Container();
    this._leftLeg.pivot.set(0, -12);
    this._leftLeg.position.set(-3, -12);
    const lLegGfx = new Graphics();
    lLegGfx.beginFill(0x334455, 1);
    lLegGfx.drawRect(-3, -12, 6, 12);
    lLegGfx.endFill();
    this._leftLeg.addChild(lLegGfx);
    this.addChild(this._leftLeg);

    this._rightLeg = new Container();
    this._rightLeg.pivot.set(0, -12);
    this._rightLeg.position.set(3, -12);
    const rLegGfx = new Graphics();
    rLegGfx.beginFill(0x334455, 1);
    rLegGfx.drawRect(-3, -12, 6, 12);
    rLegGfx.endFill();
    this._rightLeg.addChild(rLegGfx);
    this.addChild(this._rightLeg);
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /** Cancel all in-progress tweens and stop walking. */
  cancel(): void {
    ++this._gen;
    this.stopWalking();
  }

  /** Start continuous walk-cycle (ticker-driven, no promise). */
  startWalking(): void {
    if (this._walkTick) return;
    this._walkElapsed = 0;
    this._walkTick = () => {
      this._walkElapsed += this._ticker.deltaMS;
      const phase = this._walkElapsed / 200;  // 200ms per half-cycle
      const legAngle = Math.sin(phase * Math.PI) * 0.32;  // ±18°
      const armAngle = Math.sin(phase * Math.PI) * 0.25;  // ±14°
      this._leftLeg.rotation  =  legAngle;
      this._rightLeg.rotation = -legAngle;
      this._leftArm.rotation  = -armAngle;
      this._rightArm.rotation =  armAngle;
    };
    this._ticker.add(this._walkTick);
  }

  /** Stop walk-cycle and reset limbs to neutral. */
  stopWalking(): void {
    if (this._walkTick) {
      this._ticker.remove(this._walkTick);
      this._walkTick = null;
    }
    this._leftLeg.rotation  = 0;
    this._rightLeg.rotation = 0;
    this._leftArm.rotation  = 0;
    this._rightArm.rotation = 0;
  }

  /** Set arms-up victory pose (static, no animation). */
  victoryPose(): void {
    this.stopWalking();
    this._leftArm.rotation  = -1.3;   // ~75° up-left
    this._rightArm.rotation =  1.3;   // ~75° up-right
  }

  /** Jump over an obstacle. Total: 350ms. */
  async jumpOver(jumpH: number): Promise<void> {
    const gen = ++this._gen;
    const startY = this.position.y;

    await tween(this._ticker, 150, (t) => {
      if (this._gen !== gen) return;
      this.position.y = startY - jumpH * easeOutQuad(t);
    });
    if (this._gen !== gen) return;

    const topY = startY - jumpH;
    await tween(this._ticker, 200, (t) => {
      if (this._gen !== gen) return;
      this.position.y = topY + jumpH * easeInQuad(t);
    });
    if (this._gen !== gen) return;
    this.position.y = startY;
  }

  /** Stumble (lean forward and stagger). Total: 400ms. */
  async stumble(): Promise<void> {
    const gen = ++this._gen;
    const startX = this.position.x;

    // Phase 1: lean forward + stagger back
    await tween(this._ticker, 160, (t) => {
      if (this._gen !== gen) return;
      this.rotation    =  0.35 * easeOutQuad(t);
      this.position.x  = startX - 8 * easeOutQuad(t);
    });
    if (this._gen !== gen) return;

    // Phase 2: recover
    const leanPeak = 0.35;
    const xPeak    = startX - 8;
    await tween(this._ticker, 240, (t) => {
      if (this._gen !== gen) return;
      this.rotation   = leanPeak * (1 - easeOutQuad(t));
      this.position.x = xPeak + 8 * easeOutQuad(t);
    });
    if (this._gen !== gen) return;
    this.rotation   = 0;
    this.position.x = startX;
  }

  /** Shark-bite reaction: bob up and recoil. Total: 200ms. */
  async biteReact(): Promise<void> {
    const gen = ++this._gen;
    const startY = this.position.y;
    const startX = this.position.x;

    await tween(this._ticker, 200, (t) => {
      if (this._gen !== gen) return;
      // Parabolic bob: up at t=0.5, back at t=1
      const arc = Math.sin(t * Math.PI);
      this.position.y = startY - 10 * arc;
      this.position.x = startX - 12 * arc;  // reel back
    });
    if (this._gen !== gen) return;
    this.position.y = startY;
    this.position.x = startX;
  }

  /**
   * Frozen "caught" pose: arms flung wide, slight forward lean.
   * Static — no promise. Used when the finale shark picks up the runner.
   */
  caughtPose(): void {
    this.stopWalking();
    this._leftArm.rotation  = -1.5;   // flung up-left
    this._rightArm.rotation =  1.5;   // flung up-right
    this._leftLeg.rotation  =  0.4;   // legs splayed
    this._rightLeg.rotation = -0.4;
    this.rotation = 0.25;             // slight forward lean
  }

  /** Finale: scale to 0 (eaten). Total: 300ms. */
  async eaten(): Promise<void> {
    const gen = ++this._gen;
    await tween(this._ticker, 300, (t) => {
      if (this._gen !== gen) return;
      const s = 1 - easeOutQuad(t);
      this.scale.set(s);
    });
    if (this._gen !== gen) return;
    this.scale.set(0);
    this.visible = false;
  }
}
