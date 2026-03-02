import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { RoundResult } from '../models/Types';
import { CANVAS_W, CANVAS_H, COLOR } from '../utils/layout';

const PANEL_W = Math.min(520, CANVAS_W - 40);
const PANEL_H = 280;

/**
 * Full-canvas modal overlay that appears after all tiles are revealed.
 * Destroyed + removed from stage on "Next Round".
 */
export class ResultPanel extends Container {
  constructor(result: RoundResult, onNextRound: () => void) {
    super();

    // ── Dim overlay ──────────────────────────────────────────────────────────
    const overlay = new Graphics();
    overlay.beginFill(0x000000, 0.72);
    overlay.drawRect(0, 0, CANVAS_W, CANVAS_H);
    overlay.endFill();
    this.addChild(overlay);

    // ── Panel background ─────────────────────────────────────────────────────
    const px = Math.floor((CANVAS_W - PANEL_W) / 2);
    const py = Math.floor((CANVAS_H - PANEL_H) / 2);

    const panel = new Graphics();
    panel.beginFill(0x0d1526, 1);
    panel.lineStyle(2, COLOR.gold, 1);
    panel.drawRoundedRect(px, py, PANEL_W, PANEL_H, 16);
    panel.endFill();
    this.addChild(panel);

    // ── Content ──────────────────────────────────────────────────────────────
    const cx = CANVAS_W / 2;

    // Mode label
    const modeText = new Text(result.lockedVolatility, new TextStyle({
      fontFamily: 'Arial',
      fontSize: 11,
      fill: COLOR.textDim,
      letterSpacing: 4,
      fontWeight: 'bold',
    }));
    modeText.anchor.set(0.5);
    modeText.position.set(cx, py + 24);
    this.addChild(modeText);

    // Win count headline
    const winsLabel = new Text(`${result.winsCount} / 5 Wins`, new TextStyle({
      fontFamily: '"Arial Black", Arial',
      fontSize: 36,
      fill: COLOR.gold,
      fontWeight: '900',
      align: 'center',
    }));
    winsLabel.anchor.set(0.5);
    winsLabel.position.set(cx, py + 75);
    this.addChild(winsLabel);

    // Net change
    const net = result.payout - result.bet;
    const netColor = net > 0 ? COLOR.win : (net < 0 ? COLOR.lose : COLOR.tie);
    const sign = net >= 0 ? '+' : '';

    const payoutText = new Text(
      `${sign}${Math.round(net).toLocaleString()} FUN   (×${result.payoutMultiplier.toFixed(2)})`,
      new TextStyle({
        fontFamily: 'Arial',
        fontSize: 22,
        fill: netColor,
        fontWeight: 'bold',
        align: 'center',
      }),
    );
    payoutText.anchor.set(0.5);
    payoutText.position.set(cx, py + 130);
    this.addChild(payoutText);

    // Multiplier breakdown
    const detailText = new Text(
      `Bet: ${result.bet} FUN   →   Payout: ${Math.round(result.payout)} FUN`,
      new TextStyle({
        fontFamily: 'Arial',
        fontSize: 13,
        fill: COLOR.textMid,
        align: 'center',
      }),
    );
    detailText.anchor.set(0.5);
    detailText.position.set(cx, py + 162);
    this.addChild(detailText);

    // Message
    const message = getResultMessage(result.winsCount);
    const msgText = new Text(message, new TextStyle({
      fontFamily: 'Arial',
      fontSize: 15,
      fill: COLOR.textMid,
      align: 'center',
      fontStyle: 'italic',
    }));
    msgText.anchor.set(0.5);
    msgText.position.set(cx, py + 196);
    this.addChild(msgText);

    // Next Round button
    const btn = buildButton(
      'NEXT ROUND',
      cx - 100,
      py + PANEL_H - 64,
      200,
      44,
      COLOR.gold,
      0x0a1020,
      onNextRound,
    );
    this.addChild(btn);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getResultMessage(wins: number): string {
  if (wins === 5) return '🎉 PERFECT ROUND — Jackpot!';
  if (wins === 4) return '🔥 Four wins! Excellent round!';
  if (wins === 3) return '👍 Three wins. Nice work!';
  if (wins === 2) return '😐 Two wins. Just above break-even.';
  if (wins === 1) return '😕 One win this time. Keep going!';
  return '💀 No wins. Tough luck — try again!';
}

function buildButton(
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  bgColor: number,
  textColor: number,
  onClick: () => void,
): Container {
  const ctr = new Container();
  ctr.position.set(x, y);
  ctr.eventMode = 'static';
  ctr.cursor = 'pointer';

  const bg = new Graphics();
  bg.beginFill(bgColor, 1);
  bg.drawRoundedRect(0, 0, w, h, 8);
  bg.endFill();
  ctr.addChild(bg);

  const txt = new Text(label, new TextStyle({
    fontFamily: 'Arial',
    fontSize: 14,
    fill: textColor,
    fontWeight: 'bold',
    letterSpacing: 2,
    align: 'center',
  }));
  txt.anchor.set(0.5);
  txt.position.set(w / 2, h / 2);
  ctr.addChild(txt);

  ctr.on('pointerdown', onClick);

  // Hover effect
  ctr.on('pointerover', () => { bg.alpha = 0.85; });
  ctr.on('pointerout',  () => { bg.alpha = 1;    });

  return ctr;
}
