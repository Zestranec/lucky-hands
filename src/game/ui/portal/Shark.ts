import { Container, Graphics } from 'pixi.js';
import type { Ticker } from 'pixi.js';
import { tween, wait, easeOutQuad, easeInQuad } from '../../utils/tween';

// ─── Shark ────────────────────────────────────────────────────────────────────
// Cartoon shark drawn with Graphics polygons. Origin at body centre.
// Two sizes: 'small' (sz=28, per-portal bites) and 'large' (sz=60, finale).

export class Shark extends Container {
  private _gen = 0;
  private readonly _ticker: Ticker;
  private readonly _mouth:  Graphics;

  // Bob animation
  private _bobTick: ((_dt: number) => void) | null = null;
  private _bobElapsed = 0;
  private _bobOriginY = 0;

  /** Semi-major axis of the large shark body (used by PortalLane to target mouth). */
  static readonly LARGE_SZ = 100;

  constructor(ticker: Ticker, size: 'small' | 'large') {
    super();
    this._ticker = ticker;
    const sz = size === 'small' ? 42 : Shark.LARGE_SZ;

    // ── Body (triangle pointing left) ────────────────────────────────────────
    const body = new Graphics();
    body.beginFill(0x3366aa, 1);
    body.drawPolygon([
      -sz,       0,
       sz * 0.4, -sz * 0.45,
       sz * 0.4,  sz * 0.45,
    ]);
    body.endFill();
    // Belly highlight
    body.beginFill(0x88bbdd, 1);
    body.drawPolygon([
      -sz * 0.85,  0,
       sz * 0.3,  -sz * 0.28,
       sz * 0.3,   sz * 0.28,
    ]);
    body.endFill();
    this.addChild(body);

    // ── Dorsal fin ───────────────────────────────────────────────────────────
    const fin = new Graphics();
    fin.beginFill(0x2255aa, 1);
    fin.drawPolygon([
       0,        -sz * 0.3,
       sz * 0.1, -sz * 0.82,
       sz * 0.32, -sz * 0.3,
    ]);
    fin.endFill();
    this.addChild(fin);

    // ── Tail ─────────────────────────────────────────────────────────────────
    const tail = new Graphics();
    tail.beginFill(0x3366aa, 1);
    tail.drawPolygon([
      sz * 0.4,  0,
      sz * 0.82, -sz * 0.38,
      sz * 0.82,  sz * 0.38,
    ]);
    tail.endFill();
    this.addChild(tail);

    // ── Eye ──────────────────────────────────────────────────────────────────
    const eye = new Graphics();
    eye.beginFill(0xffffff, 1);
    eye.drawCircle(-sz * 0.5, -sz * 0.15, sz * 0.09);
    eye.endFill();
    eye.beginFill(0x000000, 1);
    eye.drawCircle(-sz * 0.5, -sz * 0.15, sz * 0.05);
    eye.endFill();
    this.addChild(eye);

    // ── Mouth (separate child, rotated for bite animation) ────────────────────
    this._mouth = new Graphics();
    this._drawMouth(sz, 0);
    this.addChild(this._mouth);

    this.visible = false;
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  cancel(): void {
    ++this._gen;
    this.stopBob();
  }

  /**
   * Per-portal bite: rise from below, snap mouth, retreat.
   * Total: ~520ms.
   */
  async biteFromBelow(runnerFootY: number): Promise<void> {
    const gen = ++this._gen;
    const startY = runnerFootY + 50;
    const biteY  = runnerFootY - 5;

    this.position.y = startY;
    this.rotation   = -Math.PI / 2;   // point upward
    this.visible    = true;

    // Rise
    await tween(this._ticker, 180, (t) => {
      if (this._gen !== gen) return;
      this.position.y = startY + (biteY - startY) * easeOutQuad(t);
    });
    if (this._gen !== gen) return;

    // Mouth snaps open
    await tween(this._ticker, 80, (t) => {
      if (this._gen !== gen) return;
      this._mouth.rotation = 0.5 * t;
    });
    if (this._gen !== gen) return;

    await wait(this._ticker, 60);
    if (this._gen !== gen) return;

    // Retreat
    const biteActual = this.position.y;
    await tween(this._ticker, 200, (t) => {
      if (this._gen !== gen) return;
      this.position.y = biteActual + (startY - biteActual) * easeInQuad(t);
    });
    if (this._gen !== gen) return;

    this.visible = false;
    this.rotation = 0;
    this._mouth.rotation = 0;
  }

  /**
   * Finale: swim in from right edge to targetX (facing left).
   * Total: ~600ms.
   */
  async swimIn(targetX: number, targetY: number): Promise<void> {
    const gen = ++this._gen;
    this.rotation = Math.PI;   // face left
    this.visible  = true;
    const startX  = this.position.x;
    const startY  = this.position.y;

    await tween(this._ticker, 600, (t) => {
      if (this._gen !== gen) return;
      this.position.x = startX + (targetX - startX) * easeOutQuad(t);
      this.position.y = startY + (targetY - startY) * easeOutQuad(t);
    });
    if (this._gen !== gen) return;
    this.position.x = targetX;
    this.position.y = targetY;
  }

  /** Start a gentle vertical bob (persists until stopBob / cancel). */
  startBob(): void {
    if (this._bobTick) return;
    this._bobElapsed = 0;
    this._bobOriginY = this.position.y;
    this._bobTick = () => {
      this._bobElapsed += this._ticker.deltaMS;
      this.position.y = this._bobOriginY + Math.sin(this._bobElapsed / 600 * Math.PI) * 6;
    };
    this._ticker.add(this._bobTick);
  }

  stopBob(): void {
    if (this._bobTick) {
      this._ticker.remove(this._bobTick);
      this._bobTick = null;
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private _drawMouth(sz: number, _openAngle: number): void {
    // Upper jaw line + 3 teeth
    this._mouth.clear();
    this._mouth.lineStyle(Math.max(1.5, sz * 0.06), 0xffffff, 0.9);
    this._mouth.moveTo(-sz, -sz * 0.12);
    this._mouth.lineTo(-sz * 0.55, -sz * 0.04);
    this._mouth.lineStyle(0);
    // Teeth (small white triangles)
    this._mouth.beginFill(0xffffff, 1);
    for (let i = 0; i < 3; i++) {
      const tx = -sz + i * sz * 0.15;
      this._mouth.drawPolygon([tx, 0, tx + sz * 0.07, 0, tx + sz * 0.035, sz * 0.1]);
    }
    this._mouth.endFill();
  }
}
