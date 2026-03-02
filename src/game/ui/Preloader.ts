/// <reference types="vite/client" />
import { Application, Assets, Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import type { Texture } from 'pixi.js';

const MIN_MS    = 1500;
const BAR_MAX_W = 280;
const BAR_H     = 6;

// Resolves to an absolute URL that works on both dev server and GitHub Pages subpaths.
export const GAME_LOGO_URL = new URL(
  `${import.meta.env.BASE_URL}assets/game_logo.png`,
  window.location.href,
).toString();

const Z_LOGO_URL = new URL(
  `${import.meta.env.BASE_URL}assets/z_logo.png`,
  window.location.href,
).toString();

/**
 * Full-screen preloader shown before the game UI is built.
 * Loads game_logo and z_logo via PIXI.Assets (global cache).
 *
 * Usage:
 *   const pre = new Preloader(app);
 *   const { gameLogo } = await pre.loadAndRun();
 *   pre.destroy();
 */
export class Preloader {
  private readonly container: Container;
  private readonly barTrack:  Graphics;
  private readonly barFill:   Graphics;

  constructor(private readonly app: Application) {
    this.container = new Container();
    this.barTrack  = new Graphics();
    this.barFill   = new Graphics();

    const { width: W, height: H } = app.screen;

    // Black background
    const bg = new Graphics();
    bg.beginFill(0x000000);
    bg.drawRect(0, 0, W, H);
    bg.endFill();
    this.container.addChild(bg);

    // "Loading…" label (subtle, above the bar)
    const hint = new Text('Loading…', new TextStyle({
      fontFamily: 'Arial',
      fontSize:   13,
      fill:       0x445566,
    }));
    hint.anchor.set(0.5);
    hint.position.set(W / 2, H * 0.60);
    this.container.addChild(hint);

    // Progress bar track + fill (drawn on top of everything except logo)
    this.container.addChild(this.barTrack);
    this.container.addChild(this.barFill);
    this._drawBar(W, H, 0);

    app.stage.addChild(this.container);
  }

  /**
   * Loads both assets in parallel, animates the progress bar over MIN_MS,
   * shows z_logo centred once loaded, then dismisses when both done + min time elapsed.
   * Returns the game_logo Texture (or null on failure) for the HUD logo.
   */
  async loadAndRun(): Promise<{ gameLogo: Texture | null }> {
    const started = Date.now();
    const { width: W, height: H } = this.app.screen;

    // Animate bar smoothly from 0→1 over MIN_MS (timestamp-driven, ~25 fps)
    const interval = setInterval(() => {
      const p = Math.min((Date.now() - started) / MIN_MS, 1);
      this._drawBar(W, H, p);
    }, 40);

    // Load both assets in parallel
    const [gameLogoResult, zLogoResult] = await Promise.allSettled([
      Assets.load<Texture>(GAME_LOGO_URL),
      Assets.load<Texture>(Z_LOGO_URL),
    ]);

    // Show z_logo centred once loaded (insert above bg, below bar/hint)
    if (zLogoResult.status === 'fulfilled') {
      const sprite = new Sprite(zLogoResult.value);
      sprite.anchor.set(0.5);
      const maxW  = Math.min(W * 0.6, 320);
      sprite.scale.set(maxW / sprite.texture.width);
      sprite.position.set(W / 2, H * 0.42);
      this.container.addChildAt(sprite, 1);
    }

    // Enforce minimum display time
    const elapsed = Date.now() - started;
    if (elapsed < MIN_MS) {
      await new Promise<void>((r) => setTimeout(r, MIN_MS - elapsed));
    }

    clearInterval(interval);
    this._drawBar(W, H, 1); // ensure full at end

    return {
      gameLogo: gameLogoResult.status === 'fulfilled' ? gameLogoResult.value : null,
    };
  }

  /** Remove from stage and free all display objects. */
  destroy(): void {
    this.app.stage.removeChild(this.container);
    this.container.destroy({ children: true });
  }

  private _drawBar(W: number, H: number, progress: number): void {
    const barW = Math.min(W * 0.55, BAR_MAX_W);
    const x    = Math.round((W - barW) / 2);
    const y    = Math.round(H * 0.64);

    // Track
    this.barTrack.clear();
    this.barTrack.beginFill(0x1a2a3a);
    this.barTrack.drawRoundedRect(x, y, barW, BAR_H, BAR_H / 2);
    this.barTrack.endFill();

    // Fill (gold accent colour)
    this.barFill.clear();
    if (progress > 0) {
      const fillW = Math.max(BAR_H, barW * progress);
      this.barFill.beginFill(0xffd700, 0.9);
      this.barFill.drawRoundedRect(x, y, fillW, BAR_H, BAR_H / 2);
      this.barFill.endFill();
    }
  }
}
