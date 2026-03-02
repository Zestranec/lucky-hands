import { Container, Graphics } from 'pixi.js';
import type { Ticker } from 'pixi.js';
import type { TileOutcome } from '../../models/Types';
import { Shark } from './Shark';
import { tween, wait, easeOutQuad } from '../../utils/tween';
import { COLOR } from '../../utils/layout';

// Default portal ring colour
const RING_COLOR   = 0x4466cc;
const SWIRL_COLOR  = 0x8888ff;
const INNER_COLOR  = 0x080d18;

// ─── PortalSlot ───────────────────────────────────────────────────────────────
// A flat elliptical portal lying on the ground. Origin at portal centre.
// pw = semi-major (horizontal) axis, ph = semi-minor (vertical) axis.

export class PortalSlot extends Container {
  private _gen = 0;
  private readonly _ticker: Ticker;
  private readonly _pw: number;  // semi-major axis
  private readonly _ph: number;  // semi-minor axis

  private readonly _outerRing: Graphics;
  private readonly _innerFill: Graphics;
  private readonly _swirlCtr:  Container;
  private readonly _shark:     Shark;

  private _swirlTick: ((_dt: number) => void) | null = null;

  constructor(ticker: Ticker, pw: number, ph: number) {
    super();
    this._ticker = ticker;
    this._pw     = pw;
    this._ph     = ph;

    // ── Inner fill (drawn first, behind ring) ─────────────────────────────
    this._innerFill = new Graphics();
    this._innerFill.beginFill(INNER_COLOR, 0.85);
    this._innerFill.drawEllipse(0, 0, pw - 5, ph - 3);
    this._innerFill.endFill();
    this.addChild(this._innerFill);

    // ── Swirl container — circular arcs squished to ellipse via y-scale ───
    this._swirlCtr = new Container();
    const swirlR = pw - 5;
    for (let i = 0; i < 3; i++) {
      const arc = new Graphics();
      arc.lineStyle(2.5, SWIRL_COLOR, 0.55);
      const startA = (i / 3) * Math.PI * 2;
      const endA   = startA + (Math.PI * 2) / 3 * 0.55;  // 66° arc
      arc.arc(0, 0, swirlR, startA, endA);
      this._swirlCtr.addChild(arc);
    }
    // Squish the circular arcs to match the ellipse aspect ratio
    this._swirlCtr.scale.set(1, ph / pw);
    this.addChild(this._swirlCtr);

    // ── Outer ring (drawn on top so glow shows) ────────────────────────────
    this._outerRing = new Graphics();
    this._drawDefaultRing();
    this.addChild(this._outerRing);

    // ── Shark (hidden, pops out for 'lose' outcomes) ───────────────────────
    this._shark = new Shark(ticker, 'small');
    this._shark.visible = false;
    this.addChild(this._shark);
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  startSwirl(): void {
    if (this._swirlTick) return;
    this._swirlTick = () => {
      this._swirlCtr.rotation += this._ticker.deltaMS * 0.0026;  // ~150°/s
    };
    this._ticker.add(this._swirlTick);
  }

  stopSwirl(): void {
    if (this._swirlTick) {
      this._ticker.remove(this._swirlTick);
      this._swirlTick = null;
    }
  }

  cancel(): void {
    ++this._gen;
    this.stopSwirl();
    this._shark.cancel();
  }

  reset(): void {
    this._outerRing.alpha = 1;
    this._drawDefaultRing();
    this._shark.visible = false;
    this._shark.stopBob();
    this.startSwirl();
  }

  // ─── Animations ──────────────────────────────────────────────────────────────

  /**
   * Flash ring to outcome colour, trigger shark bite on 'lose', then restore.
   * slotLocalFootY: runner foot Y in slot-local coordinates (= laneFoot - slotCY).
   * Total: win/lose ~700ms, tie ~550ms.
   */
  async flashOutcome(outcome: TileOutcome, slotLocalFootY: number): Promise<void> {
    const gen = ++this._gen;
    const outColor = COLOR[outcome];

    // Recolour ring instantly
    this._outerRing.clear();
    this._outerRing.lineStyle(5, outColor, 1);
    this._outerRing.beginFill(outColor, 0.15);
    this._outerRing.drawEllipse(0, 0, this._pw, this._ph);
    this._outerRing.endFill();
    this._outerRing.alpha = 1;

    // Shark bite is fire-and-forget (concurrent with hold)
    if (outcome === 'lose') {
      void this._shark.biteFromBelow(slotLocalFootY);
    }

    // Hold
    const holdMs = outcome === 'tie' ? 300 : 400;
    await wait(this._ticker, holdMs);
    if (this._gen !== gen) return;

    // Fade ring alpha back
    const fadeMs = outcome === 'tie' ? 250 : 300;
    await tween(this._ticker, fadeMs, (t) => {
      if (this._gen !== gen) return;
      this._outerRing.alpha = 1 - t * 0.55;
    });
    if (this._gen !== gen) return;

    this._drawDefaultRing();
    this._outerRing.alpha = 1;
  }

  /**
   * Finale portal-merge helper: shrink this slot to invisible.
   * Total: 400ms.
   */
  async shrinkAway(): Promise<void> {
    const gen = ++this._gen;
    await tween(this._ticker, 400, (t) => {
      if (this._gen !== gen) return;
      this.scale.set(1 - easeOutQuad(t));
    });
    if (this._gen !== gen) return;
    this.visible = false;
    this.scale.set(0);
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private _drawDefaultRing(): void {
    this._outerRing.clear();
    this._outerRing.lineStyle(4, RING_COLOR, 0.9);
    this._outerRing.beginFill(0x000000, 0);
    this._outerRing.drawEllipse(0, 0, this._pw, this._ph);
    this._outerRing.endFill();
  }
}
