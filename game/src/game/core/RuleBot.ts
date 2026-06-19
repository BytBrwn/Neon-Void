import type { GameSim } from "./GameSim.js";
import { MOVE_VECTORS, ML_MOVE_DIRS } from "./ml.js";

function bestMoveDir(ix: number, iy: number): number {
  const mag = Math.hypot(ix, iy);
  if (mag === 0) return 0;
  const nx = ix / mag;
  const ny = iy / mag;
  let best = 0;
  let bestDot = -Infinity;
  for (let i = 0; i < MOVE_VECTORS.length; i++) {
    const [vx, vy] = MOVE_VECTORS[i];
    const dot = nx * vx + ny * vy;
    if (dot > bestDot) { bestDot = dot; best = i; }
  }
  return best;
}

export function ruleBotAction(sim: GameSim): number {
  const p = sim.player;
  const hasEnemies = sim.enemies.count > 0;
  const fire = hasEnemies;

  // --- Threat dodge: hostile bullet within 120px and closing ---
  let threatDx = 0;
  let threatDy = 0;
  let hasThreat = false;
  for (let i = 0; i < sim.bullets.count; i++) {
    const b = sim.bullets.buf[i];
    if (b.friendly) continue;
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 120 * 120) continue;
    // dot product of relative position and bullet velocity — negative means closing
    if (dx * b.vx + dy * b.vy < 0) {
      threatDx -= dx;
      threatDy -= dy;
      hasThreat = true;
    }
  }
  if (hasThreat) {
    const move = bestMoveDir(threatDx, threatDy);
    return move + (fire ? ML_MOVE_DIRS : 0);
  }

  // --- Strafe: enemy within 200px ---
  let nearestDist2 = Infinity;
  let nearestDx = 0;
  let nearestDy = 0;
  for (let i = 0; i < sim.enemies.count; i++) {
    const e = sim.enemies.buf[i];
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < nearestDist2) { nearestDist2 = d2; nearestDx = dx; nearestDy = dy; }
  }
  if (nearestDist2 < 200 * 200 && nearestDist2 > 0) {
    // Strafe perpendicular (clockwise), biased away if very close
    const dist = Math.sqrt(nearestDist2);
    const nx = nearestDx / dist;
    const ny = nearestDy / dist;
    // perpendicular + slight retreat at close range
    const closenessBias = Math.max(0, 1 - dist / 200);
    const ix = ny - nx * closenessBias;
    const iy = -nx - ny * closenessBias;
    const move = bestMoveDir(ix, iy);
    return move + (fire ? ML_MOVE_DIRS : 0);
  }

  // --- Recenter: player in outer 25% ---
  const cx = sim.width * 0.5;
  const cy = sim.height * 0.5;
  const marginX = sim.width * 0.25;
  const marginY = sim.height * 0.25;
  if (p.x < marginX || p.x > sim.width - marginX || p.y < marginY || p.y > sim.height - marginY) {
    const move = bestMoveDir(cx - p.x, cy - p.y);
    return move + (fire ? ML_MOVE_DIRS : 0);
  }

  // --- Default: stop, fire if enemies exist ---
  return 0 + (fire ? ML_MOVE_DIRS : 0);
}
