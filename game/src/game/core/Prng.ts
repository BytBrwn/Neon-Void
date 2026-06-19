/**
 * Mulberry32 — fast, seedable, statistically good PRNG for games.
 *
 * Module-level singleton: each ES module scope (including WebWorkers) gets its
 * own independent instance, so parallel ML environments running in separate
 * workers are automatically isolated without any extra wiring.
 *
 * Call seed() at the start of a run to make it reproducible (roguelike seeds,
 * ML rollout replay, automated testing).
 */

let state = (Date.now() ^ (Math.PI * 0x9e3779b9)) >>> 0;

function step(): number {
  let z = (state += 0x6d2b79f5 | 0);
  z = Math.imul(z ^ (z >>> 15), z | 1);
  z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
  return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
}

/** Seed the PRNG. Use before engine.start() for reproducible runs. */
export function seed(n: number): void {
  state = n >>> 0;
}

/** Current internal state — capture before a run to replay it later. */
export function activeSeed(): number {
  return state;
}

/** Drop-in for Math.random() — returns [0, 1). */
export function random(): number {
  return step();
}

/** Uniform float in [min, max). */
export function rand(min: number, max: number): number {
  return min + step() * (max - min);
}
