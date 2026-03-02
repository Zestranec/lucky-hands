import type { Ticker } from 'pixi.js';

export type EasingFn = (t: number) => number;

// ─── Built-in easings ─────────────────────────────────────────────────────────

export const linear: EasingFn = (t) => t;

export const easeOutQuad: EasingFn = (t) => 1 - (1 - t) * (1 - t);

export const easeInQuad: EasingFn = (t) => t * t;

export const easeOutBack: EasingFn = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// ─── Core tween ───────────────────────────────────────────────────────────────

/**
 * Ticker-based tween — uses PixiJS Ticker.deltaMS for frame-rate independence.
 *
 * @param ticker    The PixiJS Ticker to attach to (e.g. app.ticker)
 * @param duration  Duration in milliseconds
 * @param onUpdate  Callback receiving `progress` in [0, 1]
 * @param easing    Easing function (default: linear)
 * @returns         Promise that resolves when the tween completes
 */
export function tween(
  ticker: Ticker,
  duration: number,
  onUpdate: (progress: number) => void,
  easing: EasingFn = linear,
): Promise<void> {
  return new Promise<void>((resolve) => {
    let elapsed = 0;

    // PixiJS v7 ticker callback receives deltaTime (scale factor), but
    // we use ticker.deltaMS for wall-clock milliseconds.
    const tick = (_dt: number) => {
      elapsed += ticker.deltaMS;
      const raw = Math.min(elapsed / duration, 1);
      onUpdate(easing(raw));
      if (raw >= 1) {
        ticker.remove(tick);
        resolve();
      }
    };

    ticker.add(tick);
  });
}

/** Convenience: resolve after `ms` milliseconds using the game ticker. */
export function wait(ticker: Ticker, ms: number): Promise<void> {
  return tween(ticker, ms, () => undefined);
}
