import { Container, Graphics } from 'pixi.js';
import type { Ticker } from 'pixi.js';

// ─── BloodBurst ───────────────────────────────────────────────────────────────
// Deterministic splatter of red droplets emitted when a shark bite lands.
// No Math.random() — velocities come from a fixed table so replays are identical.

// Fixed velocity table: [vx px/ms, vy px/ms]. 9 entries.
const VEL_TABLE: ReadonlyArray<readonly [number, number]> = [
  [-0.9, -2.4],
  [-0.3, -2.9],
  [ 0.5, -2.7],
  [ 1.2, -2.1],
  [ 1.7, -1.4],
  [-1.5, -0.9],
  [ 0.7, -1.9],
  [-0.6, -2.5],
  [ 1.4, -1.7],
] as const;

const GRAVITY   = 0.005;   // px/ms² downward acceleration
const LIFETIME  = 620;     // ms until fully faded
const RADIUS    = 3;       // droplet radius (px)
const COLOR_RED = 0xcc2222;

/**
 * Spawn a blood burst at (x, y) inside `parent` (local coords).
 * Self-managing: the container removes and destroys itself when finished.
 */
export function spawnBloodBurst(parent: Container, x: number, y: number, ticker: Ticker): void {
  const ctr = new Container();
  parent.addChild(ctr);

  // Create one Graphics per droplet so each can be freed independently
  const dots = VEL_TABLE.map(([vx, vy]) => {
    const g = new Graphics();
    g.beginFill(COLOR_RED, 1);
    g.drawCircle(0, 0, RADIUS);
    g.endFill();
    g.position.set(x, y);
    ctr.addChild(g);
    return { g, vx, vy };
  });

  let elapsed = 0;

  const tick = () => {
    elapsed += ticker.deltaMS;
    const life = Math.min(elapsed / LIFETIME, 1);

    for (const d of dots) {
      // Euler integration: advance position
      d.vy += GRAVITY * ticker.deltaMS;
      d.g.position.x += d.vx * ticker.deltaMS;
      d.g.position.y += d.vy * ticker.deltaMS;
      d.g.alpha = 1 - life;
    }

    if (elapsed >= LIFETIME) {
      ticker.remove(tick);
      parent.removeChild(ctr);
      ctr.destroy({ children: true });
    }
  };

  ticker.add(tick);
}
