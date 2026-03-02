import { Container, Graphics, Text, TextStyle, Rectangle } from 'pixi.js';
import type { Ticker } from 'pixi.js';
import type { RPSChoice, TileOutcome } from '../models/Types';
import { tween, easeOutQuad } from '../utils/tween';
import { TILE_W, TILE_H, COLOR } from '../utils/layout';

// ─── Constants ────────────────────────────────────────────────────────────────

const EMOJI_FONT = 'Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, Arial';
type Choices = Exclude<RPSChoice, null>;

const CHOICE_INFO: Record<Choices, { icon: string; color: number; label: string }> = {
  rock:     { icon: '✊', color: COLOR.rock,     label: 'ROCK'  },
  paper:    { icon: '✋', color: COLOR.paper,    label: 'PAPER' },
  scissors: { icon: '✌️', color: COLOR.scissors, label: 'SCIS'  },
};

const OUTCOME_INFO: Record<TileOutcome, { label: string; color: number }> = {
  win:  { label: 'WIN',  color: COLOR.win  },
  lose: { label: 'LOSE', color: COLOR.lose },
  tie:  { label: 'TIE',  color: COLOR.tie  },
};

const CHOICES: Choices[] = ['rock', 'paper', 'scissors'];

// ─── Pick-layer button geometry ───────────────────────────────────────────────
// Three buttons at triangle vertices inside the tile.
//   Rock     — top vertex, horizontally centred
//   Paper    — bottom-left vertex
//   Scissors — bottom-right vertex
const BTN_HALF   = 24;                           // half of 48×48 hit square
const BTN_SIZE   = BTN_HALF * 2;                 // 48
const TRI_TOP_CX = Math.round(TILE_W / 2);       // rock centre-x
const TRI_TOP_CY = 44;                           // rock centre-y (below CHOOSE hint)
const TRI_BOT_CY = TILE_H - 28;                 // paper & scissors centre-y

// ─── Tile ─────────────────────────────────────────────────────────────────────

/**
 * Interactive tile with four visual states:
 *
 *  pick     — 3 icon buttons in a horizontal row; one tap picks instantly.
 *  locked   — Chosen icon large-centred; tap again to return to pick.
 *             NO border/glow in pick or locked state.
 *  pending  — Split view: player top, house "?" bottom. All input locked.
 *  revealed — Split view: house shown. Coloured glow = Win / Lose / Tie.
 *             Glow is fully cleared on reset().
 *
 * Emits 'choiceChanged' on every user-driven selection change.
 */
export class Tile extends Container {
  private _choice: RPSChoice = null;
  private _gen    = 0;   // for reveal() animation cancellation
  private _locGen = 0;   // for entry animation cancellation
  private _locked = false;
  private readonly _ticker: Ticker;

  // ── Layer refs ───────────────────────────────────────────────────────────────
  private readonly pickLayer:    Container;
  private readonly pickHitAreas: Graphics[] = [];

  private readonly lockedLayer: Container;
  private readonly bigIcon:     Text;
  private readonly lockedHit:   Graphics;

  private readonly splitLayer:       Container;
  private readonly splitPlayerIcon:  Text;
  private readonly splitPlayerLabel: Text;
  private readonly splitHouseIcon:   Text;
  private readonly splitHouseLabel:  Text;

  private readonly glowBorder:   Graphics;
  private readonly outcomeLabel: Text;

  // ─── Constructor ─────────────────────────────────────────────────────────────

  constructor(ticker: Ticker) {
    super();
    this._ticker = ticker;

    // ── Card background ───────────────────────────────────────────────────────
    const bg = new Graphics();
    bg.beginFill(COLOR.tileBg, 1);
    bg.drawRoundedRect(0, 0, TILE_W, TILE_H, 12);
    bg.endFill();
    this.addChild(bg);

    // Subtle top-edge glass shimmer
    const shimmer = new Graphics();
    shimmer.beginFill(0xffffff, 0.055);
    shimmer.drawRoundedRect(4, 1, TILE_W - 8, 9, 6);
    shimmer.endFill();
    this.addChild(shimmer);

    // ── Outcome glow border ───────────────────────────────────────────────────
    this.glowBorder = new Graphics();
    this.glowBorder.visible = false;
    this.addChild(this.glowBorder);

    // ── Pick layer ────────────────────────────────────────────────────────────
    this.pickLayer = new Container();
    this.addChild(this.pickLayer);
    this.buildPickLayer();   // populates this.pickHitAreas

    // ── Locked layer ──────────────────────────────────────────────────────────
    this.lockedLayer = new Container();
    this.lockedLayer.visible = false;
    this.addChild(this.lockedLayer);

    const ll = this.buildLockedLayer();
    this.bigIcon   = ll.bigIcon;
    this.lockedHit = ll.hit;

    // ── Split layer ───────────────────────────────────────────────────────────
    this.splitLayer = new Container();
    this.splitLayer.visible = false;
    this.addChild(this.splitLayer);

    // Player section (top half)
    this.splitPlayerIcon = mkText('', EMOJI_FONT, 28, COLOR.white);
    this.splitPlayerIcon.anchor.set(0.5);
    this.splitPlayerIcon.position.set(TILE_W / 2, Math.round(TILE_H * 0.235));
    this.splitLayer.addChild(this.splitPlayerIcon);

    this.splitPlayerLabel = mkText('', 'Arial', 10, COLOR.textDim, { letterSpacing: 2 });
    this.splitPlayerLabel.anchor.set(0.5);
    this.splitPlayerLabel.position.set(TILE_W / 2, Math.round(TILE_H * 0.395));
    this.splitLayer.addChild(this.splitPlayerLabel);

    // Centre separator
    const sep = new Graphics();
    sep.beginFill(0x2a3a55, 1);
    sep.drawRect(10, Math.round(TILE_H * 0.50) - 1, TILE_W - 20, 1);
    sep.endFill();
    this.splitLayer.addChild(sep);

    // House section (bottom half)
    this.splitHouseIcon = mkText('', EMOJI_FONT, 28, COLOR.textDim);
    this.splitHouseIcon.anchor.set(0.5);
    this.splitHouseIcon.position.set(TILE_W / 2, Math.round(TILE_H * 0.655));
    this.splitLayer.addChild(this.splitHouseIcon);

    this.splitHouseLabel = mkText('', 'Arial', 10, COLOR.textDim, { letterSpacing: 2 });
    this.splitHouseLabel.anchor.set(0.5);
    this.splitHouseLabel.position.set(TILE_W / 2, Math.round(TILE_H * 0.825));
    this.splitLayer.addChild(this.splitHouseLabel);

    // ── Outcome label (WIN / LOSE / TIE) ─────────────────────────────────────
    this.outcomeLabel = mkText('', 'Arial', 11, COLOR.white, { fontWeight: 'bold', letterSpacing: 3 });
    this.outcomeLabel.anchor.set(0.5);
    this.outcomeLabel.position.set(TILE_W / 2, TILE_H - 12);
    this.outcomeLabel.visible = false;
    this.addChild(this.outcomeLabel);
  }

  // ─── Layer builders ───────────────────────────────────────────────────────────

  private buildPickLayer(): void {
    // Small hint at top
    const hint = mkText('CHOOSE', 'Arial', 9, COLOR.textDim, { letterSpacing: 3, fontWeight: 'bold' });
    hint.anchor.set(0.5);
    hint.position.set(TILE_W / 2, 12);
    this.pickLayer.addChild(hint);

    // Triangle vertex positions (top-left corner of each 48×48 container):
    //   rock     — top vertex, centred
    //   paper    — bottom-left vertex
    //   scissors — bottom-right vertex
    const positions: [number, number][] = [
      [TRI_TOP_CX - BTN_HALF, TRI_TOP_CY - BTN_HALF],  // rock
      [0,                      TRI_BOT_CY - BTN_HALF],  // paper
      [TILE_W - BTN_SIZE,      TRI_BOT_CY - BTN_HALF],  // scissors
    ];

    CHOICES.forEach((choice, i) => {
      const info = CHOICE_INFO[choice];
      const [bx, by] = positions[i];

      const col = new Container();
      col.position.set(bx, by);
      this.pickLayer.addChild(col);

      // Hover / press background (initially hidden)
      const hover = new Graphics();
      hover.beginFill(0xffffff, 0.09);
      hover.drawRoundedRect(0, 0, BTN_SIZE, BTN_SIZE, 10);
      hover.endFill();
      hover.visible = false;
      col.addChild(hover);

      // Emoji icon — centred in 48×48 area
      const icon = mkText(info.icon, EMOJI_FONT, 28, COLOR.white);
      icon.anchor.set(0.5);
      icon.position.set(BTN_HALF, BTN_HALF);
      col.addChild(icon);

      // Hit area — must have alpha > 0 for Pixi v7 hit-testing
      const hit = new Graphics();
      hit.beginFill(0x000000, 0.001);
      hit.drawRect(0, 0, BTN_SIZE, BTN_SIZE);
      hit.endFill();
      hit.hitArea = new Rectangle(0, 0, BTN_SIZE, BTN_SIZE);
      hit.eventMode = 'static';
      hit.cursor = 'pointer';

      hit.on('pointertap',      () => { if (!this._locked) this.selectChoice(choice); });
      hit.on('pointerover',     () => { if (!this._locked) hover.visible = true; });
      hit.on('pointerout',      () => { hover.visible = false; col.scale.set(1); });
      hit.on('pointerdown',     () => { if (!this._locked) col.scale.set(0.93); });
      hit.on('pointerup',       () => { col.scale.set(1); });
      hit.on('pointerupoutside',() => { col.scale.set(1); });

      col.addChild(hit);
      this.pickHitAreas.push(hit);
    });
  }

  private buildLockedLayer(): { bigIcon: Text; hit: Graphics } {
    const bigIcon = mkText('', EMOJI_FONT, 48, COLOR.white);
    bigIcon.anchor.set(0.5);
    bigIcon.position.set(TILE_W / 2, Math.round(TILE_H * 0.42));
    this.lockedLayer.addChild(bigIcon);

    const tapHint = mkText('tap to change', 'Arial', 9, COLOR.textDim, { fontStyle: 'italic' });
    tapHint.anchor.set(0.5);
    tapHint.position.set(TILE_W / 2, Math.round(TILE_H * 0.82));
    this.lockedLayer.addChild(tapHint);

    const hit = new Graphics();
    hit.beginFill(0x000000, 0.001);
    hit.drawRect(0, 0, TILE_W, TILE_H);
    hit.endFill();
    hit.hitArea = new Rectangle(0, 0, TILE_W, TILE_H);
    hit.eventMode = 'static';
    hit.cursor = 'pointer';
    hit.on('pointertap', () => { if (!this._locked) this.enterPickMode(); });
    this.lockedLayer.addChild(hit);

    return { bigIcon, hit };
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  getChoice(): RPSChoice { return this._choice; }

  /** Spec alias for getChoice(). */
  getPlayerMove(): RPSChoice { return this._choice; }

  setPlayerMove(move: RPSChoice): void {
    this._choice = move;
    if (move !== null) this.enterLockedMode(move, false);
    else               this.showPickLayer();
  }

  setInteractable(on: boolean): void {
    this._locked = !on;
    this.enablePickButtons(on);
    this.lockedHit.eventMode = on ? 'static' : 'none';
    this.lockedHit.cursor    = on ? 'pointer' : 'default';
  }

  setPickMode(allowed: boolean): void { this.setInteractable(allowed); }
  lockInteraction(locked: boolean): void { this.setInteractable(!locked); }

  showPending(): void {
    this._locked = true;
    this.enablePickButtons(false);
    this.lockedHit.eventMode = 'none';

    const info = CHOICE_INFO[this._choice!];
    this.splitPlayerIcon.text = info.icon;
    (this.splitPlayerIcon.style  as TextStyle).fill = COLOR.white;
    this.splitPlayerLabel.text = info.label;
    (this.splitPlayerLabel.style as TextStyle).fill = COLOR.textDim;

    this.splitHouseIcon.text = '?';
    (this.splitHouseIcon.style  as TextStyle).fill = COLOR.textDim;
    this.splitHouseLabel.text = 'HOUSE';
    (this.splitHouseLabel.style as TextStyle).fill = COLOR.textDim;

    this.pickLayer.visible   = false;
    this.lockedLayer.visible = false;
    this.splitLayer.visible  = true;
  }

  async reveal(house: RPSChoice, outcome: TileOutcome): Promise<void> {
    const gen = ++this._gen;

    // Phase 1 — flip out
    await tween(this._ticker, 140, (t) => {
      if (this._gen !== gen) return;
      this.scale.x = 1 - t;
    });
    if (this._gen !== gen) return;
    this.scale.x = 0;

    // Update house visuals mid-flip
    const info = CHOICE_INFO[house!];
    this.splitHouseIcon.text = info.icon;
    (this.splitHouseIcon.style  as TextStyle).fill = info.color;
    this.splitHouseLabel.text = info.label;
    (this.splitHouseLabel.style as TextStyle).fill = info.color;

    // Outcome glow border + label
    const os = OUTCOME_INFO[outcome];
    this.drawGlowBorder(os.color);
    this.glowBorder.visible = true;
    this.outcomeLabel.text = os.label;
    (this.outcomeLabel.style as TextStyle).fill = os.color;
    this.outcomeLabel.visible = true;

    // Phase 2 — flip in
    await tween(this._ticker, 140, (t) => {
      if (this._gen !== gen) return;
      this.scale.x = easeOutQuad(t);
    });
    if (this._gen !== gen) return;
    this.scale.x = 1;
  }

  showReveal(house: RPSChoice, outcome: TileOutcome): Promise<void> {
    return this.reveal(house, outcome);
  }

  reset(): void {
    this._gen++;
    this._locGen++;
    this._choice = null;
    this._locked = false;
    this.scale.set(1);
    this.alpha = 1;

    this.glowBorder.visible = false;
    this.glowBorder.clear();
    this.outcomeLabel.visible = false;
    this.outcomeLabel.text = '';

    this.splitLayer.visible  = false;
    this.lockedLayer.visible = false;
    this.pickLayer.visible   = true;
    this.enablePickButtons(true);
    this.lockedHit.eventMode = 'static';
    this.lockedHit.cursor    = 'pointer';
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private selectChoice(choice: Choices): void {
    if (this._locked) return;
    this._choice = choice;
    this.enterLockedMode(choice, true);
    this.emit('choiceChanged');
  }

  private enterPickMode(): void {
    if (this._locked) return;
    this._choice = null;
    this.showPickLayer();
    this.emit('choiceChanged');
  }

  private showPickLayer(): void {
    this.lockedLayer.visible = false;
    this.splitLayer.visible  = false;
    this.pickLayer.visible   = true;
    this.enablePickButtons(true);
  }

  private enterLockedMode(choice: Choices, animate: boolean): void {
    const info = CHOICE_INFO[choice];
    this.bigIcon.text = info.icon;

    this.pickLayer.visible   = false;
    this.splitLayer.visible  = false;
    this.lockedLayer.visible = true;

    if (animate) {
      const locGen = ++this._locGen;
      this.bigIcon.scale.set(0.45);
      void tween(this._ticker, 200, (t) => {
        if (this._locGen !== locGen) return;
        this.bigIcon.scale.set(0.45 + 0.55 * easeOutQuad(t));
      });
    } else {
      this.bigIcon.scale.set(1);
    }
  }

  private enablePickButtons(on: boolean): void {
    for (const hit of this.pickHitAreas) {
      hit.eventMode = on ? 'static' : 'none';
    }
  }

  private drawGlowBorder(color: number): void {
    this.glowBorder.clear();
    this.glowBorder.lineStyle(2.5, color, 0.85);
    this.glowBorder.beginFill(color, 0.06);
    this.glowBorder.drawRoundedRect(0, 0, TILE_W, TILE_H, 12);
    this.glowBorder.endFill();
  }
}

// ─── Module-level Text factory ────────────────────────────────────────────────

function mkText(
  str: string,
  font: string,
  size: number,
  fill: number,
  extra: { letterSpacing?: number; fontWeight?: string; fontStyle?: string } = {},
): Text {
  return new Text(str, new TextStyle({
    fontFamily: font,
    fontSize:   size,
    fill,
    align: 'center',
    ...(extra as Record<string, unknown>),
  }));
}
