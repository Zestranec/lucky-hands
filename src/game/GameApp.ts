import { Application, Assets, Container, Graphics, Rectangle, Text, TextStyle } from 'pixi.js';
import type { Texture } from 'pixi.js';
import { GameStateMachine } from './state/GameStateMachine';
import { OutcomeController, getTileOutcome } from './controllers/OutcomeController';
import { RNG } from './controllers/RNG';
import { HUD } from './ui/HUD';
import { Board } from './ui/Board';
import { ResultPanel } from './ui/ResultPanel';
import { Preloader } from './ui/Preloader';
import type { VolatilityMode, RoundResult, RPSChoice } from './models/Types';
import {
  CANVAS_W, CANVAS_H,
  BOARD_X, BOARD_Y,
  PLAY_BTN_X, PLAY_BTN_Y, PLAY_BTN_W, PLAY_BTN_H,
  BET_SEL_X, BET_SEL_Y, BET_SEL_W, BET_SEL_H,
  BET_BTN_W, BET_DISPLAY_W,
  INFO_LABEL_Y,
  COLOR,
} from './utils/layout';

const INITIAL_BALANCE = 1000;
const BET_OPTIONS     = [10, 20, 50] as const;
type  BetOption       = typeof BET_OPTIONS[number];

/**
 * Top-level coordinator for Lucky Hands.
 *
 * Owns the state machine, balance, seed counter, and all UI components.
 * Orchestrates the reveal animation sequence.
 */
export class GameApp {
  private app!: Application;
  private sm!: GameStateMachine;
  private hud!: HUD;
  private board!: Board;

  // Play button internals
  private playBtnBg!: Graphics;
  private playBtnLabel!: Text;
  private playBtnCtr!: Container;

  // Bet selector internals
  private betMinusCtr!: Container;
  private betMinusBg!: Graphics;
  private betPlusCtr!: Container;
  private betPlusBg!: Graphics;
  private betAmountText!: Text;

  // Info label below tiles
  private infoLabel!: Text;

  // Auto-select button internals
  private autoSelectCtr!: Container;
  private autoSelectBg!:  Graphics;

  // Seeded RNG for auto-select (separate from game outcome RNG)
  private readonly uiRng = new RNG((Date.now() + 777_777) >>> 0);

  // Active result panel (if any)
  private resultPanel: ResultPanel | null = null;

  // Game state
  private balance = INITIAL_BALANCE;
  // Seed counter: incremented each round.
  private seedCounter = Date.now();

  // Bet state
  private currentBet: BetOption = 10;
  private lockedBet:  BetOption = 10;

  // Locked per round when Play is pressed
  private lockedVol: VolatilityMode = 'MED';
  private nextVol:   VolatilityMode = 'MED';

  // ─── Initialisation ──────────────────────────────────────────────────────────

  async init(): Promise<void> {
    this.app = new Application({
      width:           CANVAS_W,
      height:          CANVAS_H,
      backgroundColor: COLOR.bgDark,
      antialias:       true,
      resolution:      window.devicePixelRatio || 1,
      autoDensity:     true,
    });

    const canvas = this.app.view as HTMLCanvasElement;
    canvas.style.maxWidth = '100%';
    canvas.style.height   = 'auto';
    document.body.appendChild(canvas);

    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea   = this.app.screen;

    // ── Preloader ─────────────────────────────────────────────────────────────
    const preloader = new Preloader(this.app);
    const { gameLogo } = await preloader.loadAndRun();
    preloader.destroy();

    this.sm = new GameStateMachine();

    // HUD (logo texture passed in; falls back to text title if null)
    this.hud = new HUD(this.balance, this.nextVol, (mode) => this.onVolChange(mode), gameLogo as Texture | null);
    this.app.stage.addChild(this.hud);

    // Board
    this.board = new Board(this.app.ticker, () => this.onBoardChanged());
    this.board.position.set(BOARD_X, BOARD_Y);
    this.app.stage.addChild(this.board);

    // Info label (between board and controls)
    this.infoLabel = new Text('', new TextStyle({
      fontFamily: 'Arial',
      fontSize:   13,
      fill:       COLOR.textMid,
      align:      'center',
      fontStyle:  'italic',
    }));
    this.infoLabel.anchor.set(0.5);
    this.infoLabel.position.set(CANVAS_W / 2, INFO_LABEL_Y);
    this.app.stage.addChild(this.infoLabel);

    // Controls: Play button (top) + Bet selector (below) + Auto-select (below bet)
    this.buildPlayButton();
    this.buildBetSelector();
    this.buildAutoSelectBtn();

    // Start in betting state
    this.sm.transition('betting');
    this.updatePlayButton();
    this.updateInfoLabel();
  }

  // ─── Event handlers ──────────────────────────────────────────────────────────

  private onVolChange(mode: VolatilityMode): void {
    this.nextVol = mode;
    if (this.sm.isPlayerInputAllowed) this.lockedVol = mode;
    this.hud.setActiveVol(mode);
  }

  private onBoardChanged(): void {
    this.updatePlayButton();
    this.updateInfoLabel();
  }

  private onPlay(): void {
    if (!this.sm.isPlayAllowed) return;
    if (!this.board.allChosen()) return;

    this.lockedBet = this.currentBet;
    this.lockedVol = this.nextVol;

    const seed        = ++this.seedCounter;
    const playerMoves = this.board.getChoices();
    const result      = OutcomeController.resolveRound(seed, playerMoves, this.lockedVol, this.lockedBet);

    this.sm.transition('running');
    this.setPlayBtnEnabled(false);
    this.board.setInteractive(false);
    this.hud.setVolEnabled(false);
    this.setBetSelectorEnabled(false);
    this.setAutoSelectEnabled(false);

    void this.runRevealAnimation(result);
  }

  private onNextRound(): void {
    if (this.resultPanel) {
      this.app.stage.removeChild(this.resultPanel);
      this.resultPanel.destroy({ children: true });
      this.resultPanel = null;
    }

    // Auto-correct bet down if balance is now lower
    if (this.currentBet > this.balance) {
      const affordable = [...BET_OPTIONS].reverse().find((b) => b <= this.balance);
      this.currentBet  = (affordable ?? BET_OPTIONS[0]) as BetOption;
    }

    this.sm.transition('reset');
    this.board.reset();
    this.hud.setVolEnabled(true);
    this.hud.setActiveVol(this.nextVol);
    this.setBetSelectorEnabled(true);
    this.setAutoSelectEnabled(true);

    this.sm.transition('betting');
    this.updatePlayButton();
    this.updateInfoLabel();
    this.refreshBetSelector();
  }

  // ─── Reveal animation ────────────────────────────────────────────────────────

  private async runRevealAnimation(result: RoundResult): Promise<void> {
    this.board.showAllPending();
    this.setInfoText('House is choosing...');

    for (let i = 0; i < 5; i++) {
      await this.delay(i === 0 ? 450 : 320);
      const outcome = getTileOutcome(result.playerMoves[i], result.houseMoves[i]);
      await this.board.revealTile(i, result.houseMoves[i], outcome);
    }

    this.sm.transition('resolve');
    this.setInfoText('');
    await this.delay(280);

    this.balance = this.balance - result.bet + result.payout;
    this.hud.setBalance(this.balance);

    this.sm.transition('result');
    this.showResultPanel(result);
  }

  private showResultPanel(result: RoundResult): void {
    this.resultPanel = new ResultPanel(result, () => this.onNextRound());
    this.app.stage.addChild(this.resultPanel);
  }

  // ─── Play button ─────────────────────────────────────────────────────────────

  private buildPlayButton(): void {
    this.playBtnCtr = new Container();
    this.playBtnCtr.position.set(PLAY_BTN_X, PLAY_BTN_Y);
    this.playBtnCtr.eventMode = 'static';
    this.playBtnCtr.cursor    = 'pointer';
    this.playBtnCtr.on('pointerdown', () => this.onPlay());
    this.playBtnCtr.on('pointerover', () => {
      if (this.playBtnCtr.eventMode === 'static') this.playBtnBg.alpha = 0.85;
    });
    this.playBtnCtr.on('pointerout', () => { this.playBtnBg.alpha = 1; });

    this.playBtnBg = new Graphics();
    this.playBtnCtr.addChild(this.playBtnBg);

    this.playBtnLabel = new Text('', new TextStyle({
      fontFamily:    '"Arial Black", Arial',
      fontSize:      17,
      fill:          0x0a1020,
      fontWeight:    '900',
      letterSpacing: 2,
      align:         'center',
    }));
    this.playBtnLabel.anchor.set(0.5);
    this.playBtnLabel.position.set(PLAY_BTN_W / 2, PLAY_BTN_H / 2);
    this.playBtnCtr.addChild(this.playBtnLabel);

    this.app.stage.addChild(this.playBtnCtr);
    this.setPlayBtnEnabled(false);
  }

  private setPlayBtnEnabled(on: boolean): void {
    this.playBtnCtr.eventMode = on ? 'static' : 'none';
    this.playBtnCtr.cursor    = on ? 'pointer' : 'default';

    this.playBtnBg.clear();
    this.playBtnBg.beginFill(on ? COLOR.gold : 0x1a2a3a, 1);
    if (!on) this.playBtnBg.lineStyle(1, 0x334455, 1);
    this.playBtnBg.drawRoundedRect(0, 0, PLAY_BTN_W, PLAY_BTN_H, 10);
    this.playBtnBg.endFill();

    (this.playBtnLabel.style as TextStyle).fill = on ? 0x0a1020 : COLOR.textDim;
    this.playBtnLabel.text = `PLAY  (${this.currentBet} FUN)`;
  }

  private updatePlayButton(): void {
    const canPlay = this.sm.isPlayAllowed && this.board.allChosen() && this.currentBet <= this.balance;
    this.setPlayBtnEnabled(canPlay);
  }

  // ─── Bet selector (centred BELOW play button) ─────────────────────────────

  private buildBetSelector(): void {
    // ── Minus button ─────────────────────────────────────────────────────────
    this.betMinusCtr = new Container();
    this.betMinusCtr.position.set(BET_SEL_X, BET_SEL_Y);
    this.betMinusCtr.eventMode = 'static';
    this.betMinusCtr.cursor    = 'pointer';
    this.betMinusCtr.on('pointerdown', () => this.decBet());
    this.betMinusCtr.on('pointerover', () => { this.betMinusBg.alpha = 0.85; });
    this.betMinusCtr.on('pointerout',  () => { this.betMinusBg.alpha = 1; });

    this.betMinusBg = new Graphics();
    this.betMinusCtr.addChild(this.betMinusBg);

    const minusLabel = new Text('−', new TextStyle({
      fontFamily: '"Arial Black", Arial',
      fontSize:   20,
      fill:       COLOR.textMid,
      fontWeight: '900',
      align:      'center',
    }));
    minusLabel.anchor.set(0.5);
    minusLabel.position.set(BET_BTN_W / 2, BET_SEL_H / 2);
    this.betMinusCtr.addChild(minusLabel);

    const minusHit = new Graphics();
    minusHit.beginFill(0x000000, 0.001);
    minusHit.drawRect(0, 0, BET_BTN_W, BET_SEL_H);
    minusHit.endFill();
    minusHit.hitArea = new Rectangle(0, 0, BET_BTN_W, BET_SEL_H);
    this.betMinusCtr.addChild(minusHit);

    this.app.stage.addChild(this.betMinusCtr);

    // ── Bet display ───────────────────────────────────────────────────────────
    const displayX = BET_SEL_X + BET_BTN_W + 8;

    const displayBg = new Graphics();
    displayBg.beginFill(0x0d1526, 1);
    displayBg.lineStyle(1, 0x2a3a4e, 1);
    displayBg.drawRoundedRect(displayX, BET_SEL_Y, BET_DISPLAY_W, BET_SEL_H, 8);
    displayBg.endFill();
    this.app.stage.addChild(displayBg);

    const betCaption = new Text('BET', new TextStyle({
      fontFamily:    'Arial',
      fontSize:      9,
      fill:          COLOR.textDim,
      letterSpacing: 2,
      align:         'center',
    }));
    betCaption.anchor.set(0.5);
    betCaption.position.set(displayX + BET_DISPLAY_W / 2, BET_SEL_Y + BET_SEL_H / 2 - 9);
    this.app.stage.addChild(betCaption);

    this.betAmountText = new Text('', new TextStyle({
      fontFamily: 'Arial',
      fontSize:   16,
      fill:       COLOR.gold,
      fontWeight: 'bold',
      align:      'center',
    }));
    this.betAmountText.anchor.set(0.5);
    this.betAmountText.position.set(displayX + BET_DISPLAY_W / 2, BET_SEL_Y + BET_SEL_H / 2 + 7);
    this.app.stage.addChild(this.betAmountText);

    // ── Plus button ───────────────────────────────────────────────────────────
    const plusX = BET_SEL_X + BET_SEL_W - BET_BTN_W;

    this.betPlusCtr = new Container();
    this.betPlusCtr.position.set(plusX, BET_SEL_Y);
    this.betPlusCtr.eventMode = 'static';
    this.betPlusCtr.cursor    = 'pointer';
    this.betPlusCtr.on('pointerdown', () => this.incBet());
    this.betPlusCtr.on('pointerover', () => { this.betPlusBg.alpha = 0.85; });
    this.betPlusCtr.on('pointerout',  () => { this.betPlusBg.alpha = 1; });

    this.betPlusBg = new Graphics();
    this.betPlusCtr.addChild(this.betPlusBg);

    const plusLabel = new Text('+', new TextStyle({
      fontFamily: '"Arial Black", Arial',
      fontSize:   20,
      fill:       COLOR.textMid,
      fontWeight: '900',
      align:      'center',
    }));
    plusLabel.anchor.set(0.5);
    plusLabel.position.set(BET_BTN_W / 2, BET_SEL_H / 2);
    this.betPlusCtr.addChild(plusLabel);

    const plusHit = new Graphics();
    plusHit.beginFill(0x000000, 0.001);
    plusHit.drawRect(0, 0, BET_BTN_W, BET_SEL_H);
    plusHit.endFill();
    plusHit.hitArea = new Rectangle(0, 0, BET_BTN_W, BET_SEL_H);
    this.betPlusCtr.addChild(plusHit);

    this.app.stage.addChild(this.betPlusCtr);

    this.refreshBetSelector();
  }

  private incBet(): void {
    const idx = BET_OPTIONS.indexOf(this.currentBet);
    if (idx < BET_OPTIONS.length - 1) {
      const next = BET_OPTIONS[idx + 1] as BetOption;
      if (next <= this.balance) {
        this.currentBet = next;
        this.refreshBetSelector();
        this.updatePlayButton();
      }
    }
  }

  private decBet(): void {
    const idx = BET_OPTIONS.indexOf(this.currentBet);
    if (idx > 0) {
      this.currentBet = BET_OPTIONS[idx - 1] as BetOption;
      this.refreshBetSelector();
      this.updatePlayButton();
    }
  }

  private refreshBetSelector(): void {
    const idx     = BET_OPTIONS.indexOf(this.currentBet);
    const atMin   = idx === 0;
    const atMax   = idx === BET_OPTIONS.length - 1 || BET_OPTIONS[idx + 1] > this.balance;
    const enabled = this.betMinusCtr.eventMode === 'static';

    this.betMinusBg.clear();
    this.betMinusBg.beginFill(atMin || !enabled ? 0x0a1020 : 0x0f1e38, 1);
    this.betMinusBg.lineStyle(1, atMin || !enabled ? 0x1a2a3a : 0x2a3a55, 1);
    this.betMinusBg.drawRoundedRect(0, 0, BET_BTN_W, BET_SEL_H, 8);
    this.betMinusBg.endFill();
    this.betMinusCtr.cursor = atMin || !enabled ? 'default' : 'pointer';

    this.betPlusBg.clear();
    this.betPlusBg.beginFill(atMax || !enabled ? 0x0a1020 : 0x0f1e38, 1);
    this.betPlusBg.lineStyle(1, atMax || !enabled ? 0x1a2a3a : 0x2a3a55, 1);
    this.betPlusBg.drawRoundedRect(0, 0, BET_BTN_W, BET_SEL_H, 8);
    this.betPlusBg.endFill();
    this.betPlusCtr.cursor = atMax || !enabled ? 'default' : 'pointer';

    this.betAmountText.text = `${this.currentBet} FUN`;
  }

  private setBetSelectorEnabled(on: boolean): void {
    this.betMinusCtr.eventMode = on ? 'static' : 'none';
    this.betPlusCtr.eventMode  = on ? 'static' : 'none';
    this.refreshBetSelector();
  }

  // ─── Auto-select button ───────────────────────────────────────────────────────

  private buildAutoSelectBtn(): void {
    const AUTO_W = BET_SEL_W;
    const AUTO_H = 34;
    const AUTO_X = BET_SEL_X;
    const AUTO_Y = BET_SEL_Y + BET_SEL_H + 8;

    this.autoSelectCtr = new Container();
    this.autoSelectCtr.position.set(AUTO_X, AUTO_Y);
    this.autoSelectCtr.eventMode = 'static';
    this.autoSelectCtr.cursor    = 'pointer';
    this.autoSelectCtr.on('pointerdown', () => this.autoSelect());
    this.autoSelectCtr.on('pointerover', () => {
      if (this.autoSelectCtr.eventMode === 'static') this.autoSelectBg.alpha = 0.85;
    });
    this.autoSelectCtr.on('pointerout', () => { this.autoSelectBg.alpha = 1; });

    this.autoSelectBg = new Graphics();
    this.autoSelectCtr.addChild(this.autoSelectBg);

    const label = new Text('AUTO SELECT', new TextStyle({
      fontFamily:    'Arial',
      fontSize:      12,
      fill:          COLOR.textMid,
      fontWeight:    'bold',
      letterSpacing: 2,
      align:         'center',
    }));
    label.anchor.set(0.5);
    label.position.set(AUTO_W / 2, AUTO_H / 2);
    this.autoSelectCtr.addChild(label);

    this.app.stage.addChild(this.autoSelectCtr);
    this.setAutoSelectEnabled(true);
  }

  private autoSelect(): void {
    if (!this.sm.isPlayerInputAllowed) return;
    const MOVES: RPSChoice[] = ['rock', 'paper', 'scissors'];
    const picks = Array.from({ length: 5 }, () => MOVES[this.uiRng.nextInt(3)]) as RPSChoice[];
    this.board.setAllPlayerMoves(picks);
  }

  private setAutoSelectEnabled(on: boolean): void {
    this.autoSelectCtr.eventMode = on ? 'static' : 'none';
    this.autoSelectCtr.cursor    = on ? 'pointer' : 'default';

    this.autoSelectBg.clear();
    this.autoSelectBg.beginFill(on ? 0x0f1e38 : 0x0a1020, 1);
    this.autoSelectBg.lineStyle(1, on ? 0x2a3a55 : 0x1a2a3a, 1);
    const AUTO_W = BET_SEL_W;
    const AUTO_H = 34;
    this.autoSelectBg.drawRoundedRect(0, 0, AUTO_W, AUTO_H, 8);
    this.autoSelectBg.endFill();
  }

  // ─── Info label ───────────────────────────────────────────────────────────────

  private updateInfoLabel(): void {
    if (!this.sm.isPlayerInputAllowed) return;
    if (!this.board.allChosen()) {
      const chosen = this.board.getChoices().filter((c) => c !== null).length;
      this.setInfoText(
        chosen === 0
          ? 'Tap each tile to choose Rock, Paper or Scissors'
          : `${chosen} / 5 chosen — select all 5 to play`,
      );
    } else {
      this.setInfoText('All picks set! Press PLAY when ready.');
    }
  }

  private setInfoText(text: string): void {
    this.infoLabel.text = text;
  }

  // ─── Utilities ────────────────────────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
