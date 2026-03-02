/**
 * Mulberry32 — a fast, high-quality 32-bit seeded PRNG.
 * Given the same seed, every sequence of calls is deterministic.
 *
 * Reference: https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 */
export class RNG {
  private state: number;

  constructor(seed: number) {
    // Ensure unsigned 32-bit integer
    this.state = seed >>> 0;
  }

  /** Returns a float uniformly distributed in [0, 1). */
  next(): number {
    let z = (this.state += 0x6d2b79f5) >>> 0;
    z = Math.imul(z ^ (z >>> 15), z | 1) >>> 0;
    z ^= z + (Math.imul(z ^ (z >>> 7), z | 61) >>> 0);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer uniformly distributed in [0, max). */
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}
