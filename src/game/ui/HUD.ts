import { Container, Graphics, Rectangle, Sprite, Text, TextStyle } from 'pixi.js';
import type { Texture } from 'pixi.js';
import type { VolatilityMode } from '../models/Types';
import { CANVAS_W, HUD_H, VOL_BAR_H, VOL_SEG_W, BOTTOM_VOL_Y, BOTTOM_VOL_LABEL_Y, COLOR } from '../utils/layout';

const VOL_MODES: VolatilityMode[] = ['LOW', 'MED', 'HIGH'];

// ─── Pill segmented control metrics ──────────────────────────────────────────
const SEG_W   = VOL_SEG_W;       // 110 mobile / 88 desktop
const PILL_W  = SEG_W * 3;       // 330 mobile / 264 desktop
const PILL_H  = 30;
const PILL_R  = 15;               // full-pill border-radius (height / 2)
const PILL_X  = Math.floor((CANVAS_W - PILL_W) / 2);  // centred in canvas
const PILL_Y  = BOTTOM_VOL_Y + Math.floor((VOL_BAR_H - PILL_H) / 2);

// ─── HUD ─────────────────────────────────────────────────────────────────────

interface VolSeg {
  fill:  Graphics;  // active/inactive fill (inside masked pillCtr)
  label: Text;      // mode label
  segX:  number;    // x offset inside pillCtr coordinate space
}

/**
 * Top UI section: title, balance, bet, and volatility selector.
 * Sits at (0, 0) and covers HUD_H + VOL_BAR_H pixels vertically.
 */
export class HUD extends Container {
  private balanceText!: Text;
  private readonly volSegs: Map<VolatilityMode, VolSeg> = new Map();
  private _activeVol: VolatilityMode;
  private _volEnabled = true;

  constructor(
    balance: number,
    initialVol: VolatilityMode,
    onVolChange: (mode: VolatilityMode) => void,
    gameLogoTexture: Texture | null = null,
  ) {
    super();
    this._activeVol = initialVol;
    this.buildTopBar(balance, gameLogoTexture);
    this.buildVolBar(initialVol, onVolChange);
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  setBalance(balance: number): void {
    this.balanceText.text = `💰 ${Math.round(balance).toLocaleString()} FUN`;
  }

  setActiveVol(mode: VolatilityMode): void {
    this._activeVol = mode;
    this.refreshPill();
  }

  setVolEnabled(on: boolean): void {
    this._volEnabled = on;
    this.refreshPill();
    this.volSegs.forEach((seg) => {
      // The hit areas are children of the pillCtr — disable via eventMode below
    });
    // Managed via refreshPill which sets per-segment hit eventMode
    this._setSegmentsInteractive(on);
  }

  // ─── Private builders ────────────────────────────────────────────────────────

  private buildTopBar(balance: number, gameLogoTexture: Texture | null): void {
    // Background
    const bg = new Graphics();
    bg.beginFill(COLOR.hudBg, 1);
    bg.drawRect(0, 0, CANVAS_W, HUD_H);
    bg.endFill();
    this.addChild(bg);

    // Very subtle top shimmer (glass feel)
    const shimmer = new Graphics();
    shimmer.beginFill(0xffffff, 0.04);
    shimmer.drawRect(0, 0, CANVAS_W, 2);
    shimmer.endFill();
    this.addChild(shimmer);

    // Gold accent at bottom of HUD
    const accent = new Graphics();
    accent.beginFill(COLOR.gold, 1);
    accent.drawRect(0, HUD_H - 2, CANVAS_W, 2);
    accent.endFill();
    this.addChild(accent);

    // Game logo (top-left) — or fallback text if texture not yet loaded
    if (gameLogoTexture) {
      const logo = new Sprite(gameLogoTexture);
      logo.anchor.set(0, 0.5);
      const maxH = HUD_H - 16;
      logo.scale.set(maxH / logo.texture.height);
      logo.position.set(22, HUD_H / 2);
      this.addChild(logo);
    } else {
      const title = new Text('LUCKY HANDS', new TextStyle({
        fontFamily: '"Arial Black", "Impact", Arial',
        fontSize: 26,
        fill: COLOR.gold,
        fontWeight: '900',
        letterSpacing: 3,
      }));
      title.anchor.set(0, 0.5);
      title.position.set(22, HUD_H / 2);
      this.addChild(title);
    }

    // Balance (updated via setBalance)
    this.balanceText = new Text(`💰 ${balance.toLocaleString()} FUN`, new TextStyle({
      fontFamily: 'Arial',
      fontSize: 16,
      fill: COLOR.white,
      fontWeight: 'bold',
    }));
    this.balanceText.anchor.set(1, 0.5);
    this.balanceText.position.set(CANVAS_W - 22, HUD_H / 2);
    this.addChild(this.balanceText);
  }

  private buildVolBar(
    initialVol: VolatilityMode,
    onVolChange: (mode: VolatilityMode) => void,
  ): void {
    // "Choose Game Volatility" label above the pill
    const volLabel = new Text('Choose Game Volatility', new TextStyle({
      fontFamily:    'Arial',
      fontSize:      11,
      fill:          COLOR.textDim,
      letterSpacing: 2,
      align:         'center',
    }));
    volLabel.anchor.set(0.5);
    volLabel.position.set(CANVAS_W / 2, BOTTOM_VOL_LABEL_Y);
    this.addChild(volLabel);

    // Background strip for the pill
    const bg = new Graphics();
    bg.beginFill(COLOR.volBarBg, 1);
    bg.drawRect(0, BOTTOM_VOL_Y, CANVAS_W, VOL_BAR_H);
    bg.endFill();
    this.addChild(bg);

    // ── Pill border (outer ring, NOT inside the mask) ─────────────────────────
    // Drawn first so segment fills render on top of the dark bg.
    const pillBorder = new Graphics();
    pillBorder.lineStyle(1, 0x2a3a4e, 1);
    pillBorder.beginFill(0x0a1020, 1);
    pillBorder.drawRoundedRect(PILL_X, PILL_Y, PILL_W, PILL_H, PILL_R);
    pillBorder.endFill();
    this.addChild(pillBorder);

    // ── Masked container for segment fills ────────────────────────────────────
    // The mask clips segment fills to the pill shape so edges are perfectly round.
    const pillCtr = new Container();
    pillCtr.position.set(PILL_X + 1, PILL_Y + 1);   // inset 1px from border
    this.addChild(pillCtr);

    const pillMask = new Graphics();
    pillMask.beginFill(0xffffff, 1);
    pillMask.drawRoundedRect(0, 0, PILL_W - 2, PILL_H - 2, PILL_R - 1);
    pillMask.endFill();
    pillCtr.addChild(pillMask);
    pillCtr.mask = pillMask;

    // Three segment fills + labels + hit areas
    VOL_MODES.forEach((mode, i) => {
      const segX = i * SEG_W;

      // Fill rect (updated by refreshPill)
      const fill = new Graphics();
      pillCtr.addChild(fill);

      // Divider line between segments (except after last)
      if (i < VOL_MODES.length - 1) {
        const divider = new Graphics();
        divider.beginFill(0x2a3a4e, 1);
        divider.drawRect(segX + SEG_W - 1, 4, 1, PILL_H - 10);
        divider.endFill();
        pillCtr.addChild(divider);
      }

      // Label
      const label = new Text(mode, new TextStyle({
        fontFamily: 'Arial',
        fontSize: 13,
        fill: COLOR.textMid,
        fontWeight: 'bold',
        align: 'center',
        letterSpacing: 2,
      }));
      label.anchor.set(0.5);
      label.position.set(segX + SEG_W / 2, (PILL_H - 2) / 2);
      pillCtr.addChild(label);

      // Transparent hit area (also inside pillCtr, so clipped to pill shape)
      const hit = new Graphics();
      hit.beginFill(0x000000, 0.001);
      hit.drawRect(segX, 0, SEG_W, PILL_H - 2);
      hit.endFill();
      hit.hitArea = new Rectangle(segX, 0, SEG_W, PILL_H - 2);
      hit.eventMode = 'static';
      hit.cursor = 'pointer';
      hit.on('pointerdown', () => { if (this._volEnabled) onVolChange(mode); });
      pillCtr.addChild(hit);

      this.volSegs.set(mode, { fill, label, segX });
    });

    this.refreshPill();
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private refreshPill(): void {
    this.volSegs.forEach((seg, mode) => {
      const isActive = mode === this._activeVol;

      seg.fill.clear();
      if (isActive) {
        seg.fill.beginFill(COLOR.gold, 1);
        seg.fill.drawRect(seg.segX, 0, SEG_W, PILL_H - 2);
        seg.fill.endFill();
      }
      // Inactive segments show through the dark pill background — no fill drawn.

      (seg.label.style as TextStyle).fill = isActive
        ? 0x0a1020
        : (this._volEnabled ? COLOR.textMid : COLOR.textDim);
      (seg.label.style as TextStyle).fontWeight = isActive ? 'bold' : 'normal';
    });
  }

  private _setSegmentsInteractive(on: boolean): void {
    // Hit areas are the last child of each column inside pillCtr's children.
    // We stored them implicitly — iterate via volSegs order to find them.
    // Simpler: walk pillCtr's direct children that are Graphics with eventMode.
    // Instead, we track hit areas explicitly here via a second pass.
    // (They were added as the last child per segment group in buildVolBar.)
    // Re-use the fact that each 3-child group is [fill, divider?, label, hit].
    // Easier: just guard inside the hit.on('pointerdown') with this._volEnabled. ✓
    // We already do that, so no extra eventMode toggling is needed here.
    void on; // suppress lint — guarded by _volEnabled in the hit handler
  }
}
