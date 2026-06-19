/**
 * ML interface for Neon Void.
 *
 * Usage pattern (training loop pseudocode):
 *
 *   import { seed } from "../core/Prng.js";
 *   import { GameSim } from "../core/GameSim.js";
 *   import { MemoryPersistence } from "../persistence/LocalStoragePersistence.js";
 *   import { observe, agentActionToInput, ML_OBS_SIZE, ML_ACTIONS } from "../core/ml.js";
 *
 *   seed(runSeed);
 *   const sim = new GameSim({ store: new MemoryPersistence(), headless: true });
 *   sim.resize(800, 600);
 *   sim.start();
 *
 *   while (sim.phase === "playing") {
 *     const obs = observe(sim);           // Float32Array(ML_OBS_SIZE)
 *     const action = agent.act(obs);      // 0..ML_ACTIONS-1
 *     const input = agentActionToInput(action, sim.width, sim.height);
 *     sim.update(1 / 60, input);
 *     const reward = sim.score - prevScore;
 *   }
 */

import type { EnemyKind, PowerupKind } from "../types.js";
import type { GameSim } from "./GameSim.js";

// ---------------------------------------------------------------------------
// Action space
// ---------------------------------------------------------------------------

/**
 * 18 discrete actions: 9 movement directions × 2 (fire / no-fire).
 * Actions 0–8: move only. Actions 9–17: same move + fire.
 */
export const ML_MOVE_DIRS = 9;
export const ML_ACTIONS = ML_MOVE_DIRS * 2;

/** (ix, iy) for each move direction. */
export const MOVE_VECTORS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],   // 0  stop
  [0, -1],  // 1  up
  [0, 1],   // 2  down
  [-1, 0],  // 3  left
  [1, 0],   // 4  right
  [-1, -1], // 5  up-left
  [1, -1],  // 6  up-right
  [-1, 1],  // 7  down-left
  [1, 1],   // 8  down-right
] as const;

const KEY_SETS: ReadonlyArray<readonly string[]> = [
  [],
  ["ArrowUp"],
  ["ArrowDown"],
  ["ArrowLeft"],
  ["ArrowRight"],
  ["ArrowLeft", "ArrowUp"],
  ["ArrowRight", "ArrowUp"],
  ["ArrowLeft", "ArrowDown"],
  ["ArrowRight", "ArrowDown"],
];

/**
 * Convert a discrete agent action to an InputState compatible with
 * GameSim.update(). The agent aims at the nearest enemy; if none, fires
 * straight ahead. Pass to sim.update() as the `input` argument.
 */
export function agentActionToInput(
  action: number,
  sim: GameSim,
): { keys: Set<string>; mouseX: number; mouseY: number; mouseDown: boolean } {
  const move = action % ML_MOVE_DIRS;
  const fire = action >= ML_MOVE_DIRS;
  const keys = new Set<string>(KEY_SETS[move]);

  // Aim toward nearest enemy or straight ahead
  let aimX = sim.player.x + Math.cos(sim.player.aimAngle) * 200;
  let aimY = sim.player.y + Math.sin(sim.player.aimAngle) * 200;
  let nearestDist = Infinity;
  for (let i = 0; i < sim.enemies.count; i++) {
    const e = sim.enemies.buf[i];
    const dx = e.x - sim.player.x;
    const dy = e.y - sim.player.y;
    const d = dx * dx + dy * dy;
    if (d < nearestDist) {
      nearestDist = d;
      aimX = e.x;
      aimY = e.y;
    }
  }

  return { keys, mouseX: aimX, mouseY: aimY, mouseDown: fire };
}

// ---------------------------------------------------------------------------
// Observation space
// ---------------------------------------------------------------------------

const MAX_OBS_ENEMIES = 8;
const MAX_OBS_BULLETS = 8;
const MAX_OBS_POWERUPS = 4;
const PLAYER_FEATURES = 10;
const ENEMY_STRIDE = 5;
const BULLET_STRIDE = 4;
const POWERUP_STRIDE = 3;

/** Total length of the observation vector returned by observe(). */
export const ML_OBS_SIZE =
  PLAYER_FEATURES +
  MAX_OBS_ENEMIES * ENEMY_STRIDE +
  MAX_OBS_BULLETS * BULLET_STRIDE +
  MAX_OBS_POWERUPS * POWERUP_STRIDE;

const ENEMY_KINDS: EnemyKind[] = [
  "drifter", "hunter", "skitter", "orbiter", "splitter",
  "tank", "phantom", "stalker", "bomber", "sentinel", "boss",
];
const POWERUP_KINDS: PowerupKind[] = ["rapid", "spread", "pierce", "damage", "heal", "mega"];

// Reusable buffer — avoids allocation per step in tight training loops.
const _obsBuf = new Float32Array(ML_OBS_SIZE);
// Scratch arrays for sorting (reused to avoid per-call allocs)
const _enemyScratch: Array<{ dx: number; dy: number; d2: number; i: number }> = [];
const _bulletScratch: Array<{ dx: number; dy: number; i: number; d2: number }> = [];

/**
 * Returns a Float32Array view of the current observation.
 *
 * NOTE: The returned buffer is reused on each call — copy it if you need to
 * store it (e.g. experience replay). This avoids allocation in the hot path.
 *
 * Layout:
 *   [0]  playerX / width          (normalized position)
 *   [1]  playerY / height
 *   [2]  playerVx / 560           (normalized velocity)
 *   [3]  playerVy / 560
 *   [4]  health / maxHealth        (health fraction)
 *   [5]  cos(aimAngle)
 *   [6]  sin(aimAngle)
 *   [7]  overdrive / 14
 *   [8]  wave / 50
 *   [9]  combo / 20 (clamped to 1)
 *   [10..10+MAX_OBS_ENEMIES*5-1]  nearest enemies: dx/w, dy/h, dist/diag, hp, kindIdx/11
 *   [...+MAX_OBS_BULLETS*4]       nearest hostile bullets: dx/w, dy/h, vx/400, vy/400
 *   [...+MAX_OBS_POWERUPS*3]      nearest powerups: dx/w, dy/h, kindIdx/6
 */
export function observe(sim: GameSim): Float32Array {
  _obsBuf.fill(0);
  const p = sim.player;
  const w = sim.width || 1;
  const h = sim.height || 1;
  const diag = Math.hypot(w, h);
  const maxSpeed = 560;

  // Player features
  _obsBuf[0] = p.x / w;
  _obsBuf[1] = p.y / h;
  _obsBuf[2] = p.vx / maxSpeed;
  _obsBuf[3] = p.vy / maxSpeed;
  _obsBuf[4] = p.maxHealth > 0 ? p.health / p.maxHealth : 0;
  _obsBuf[5] = Math.cos(p.aimAngle);
  _obsBuf[6] = Math.sin(p.aimAngle);
  _obsBuf[7] = p.overdrive / 14;
  _obsBuf[8] = Math.min(sim.wave / 50, 1);
  _obsBuf[9] = Math.min(sim.combo / 20, 1);

  // Nearest enemies
  _enemyScratch.length = 0;
  for (let i = 0; i < sim.enemies.count; i++) {
    const e = sim.enemies.buf[i];
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    _enemyScratch.push({ dx, dy, d2: dx * dx + dy * dy, i });
  }
  _enemyScratch.sort((a, b) => a.d2 - b.d2);
  let base = PLAYER_FEATURES;
  const eCount = Math.min(_enemyScratch.length, MAX_OBS_ENEMIES);
  for (let k = 0; k < eCount; k++) {
    const { dx, dy, d2, i } = _enemyScratch[k];
    const e = sim.enemies.buf[i];
    const o = base + k * ENEMY_STRIDE;
    _obsBuf[o + 0] = dx / w;
    _obsBuf[o + 1] = dy / h;
    _obsBuf[o + 2] = Math.sqrt(d2) / diag;
    _obsBuf[o + 3] = e.maxHealth > 0 ? e.health / e.maxHealth : 0;
    _obsBuf[o + 4] = ENEMY_KINDS.indexOf(e.kind) / ENEMY_KINDS.length;
  }

  // Nearest hostile bullets
  base = PLAYER_FEATURES + MAX_OBS_ENEMIES * ENEMY_STRIDE;
  _bulletScratch.length = 0;
  for (let i = 0; i < sim.bullets.count; i++) {
    const b = sim.bullets.buf[i];
    if (b.friendly) continue;
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    _bulletScratch.push({ dx, dy, d2: dx * dx + dy * dy, i });
  }
  _bulletScratch.sort((a, b) => a.d2 - b.d2);
  const bCount = Math.min(_bulletScratch.length, MAX_OBS_BULLETS);
  const maxBulletSpeed = 400;
  for (let k = 0; k < bCount; k++) {
    const { dx, dy, i } = _bulletScratch[k];
    const b = sim.bullets.buf[i];
    const o = base + k * BULLET_STRIDE;
    _obsBuf[o + 0] = dx / w;
    _obsBuf[o + 1] = dy / h;
    _obsBuf[o + 2] = b.vx / maxBulletSpeed;
    _obsBuf[o + 3] = b.vy / maxBulletSpeed;
  }

  // Nearest powerups
  base = PLAYER_FEATURES + MAX_OBS_ENEMIES * ENEMY_STRIDE + MAX_OBS_BULLETS * BULLET_STRIDE;
  const puCount = Math.min(sim.powerups.length, MAX_OBS_POWERUPS);
  for (let k = 0; k < puCount; k++) {
    const pu = sim.powerups[k];
    const o = base + k * POWERUP_STRIDE;
    _obsBuf[o + 0] = (pu.x - p.x) / w;
    _obsBuf[o + 1] = (pu.y - p.y) / h;
    _obsBuf[o + 2] = POWERUP_KINDS.indexOf(pu.kind) / POWERUP_KINDS.length;
  }

  return _obsBuf;
}
