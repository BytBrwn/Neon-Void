import type { PowerupKind, Powerup, Player, Enemy, EnemyKind } from "../types.js";
import { clamp, dist, rand, TAU } from "../math.js";
import { powerupIconHue } from "../assets/powerupIcons.js";

export function powerupHue(kind: PowerupKind): number {
  return powerupIconHue(kind);
}

export function rollPowerupKind(bonus = false): PowerupKind {
  const roll = Math.random();
  if (bonus || roll < 0.08) return "mega";
  if (roll < 0.45) return "heal";
  return "rapid";
}

export function powerupDropChance(kind: EnemyKind): number {
  if (kind === "boss") return 0.85;
  if (kind === "tank") return 0.42;
  if (kind === "sentinel") return 0.38;
  return 0.2;
}

export function createPowerupDrop(x: number, y: number, enemy: Enemy): Powerup | null {
  if (Math.random() > powerupDropChance(enemy.kind)) return null;
  return {
    x,
    y,
    vy: rand(18, 36),
    radius: 16,
    kind: rollPowerupKind(enemy.kind === "boss"),
    pulse: rand(0, TAU),
    life: 14,
  };
}

export function applyPowerup(player: Player, kind: PowerupKind): void {
  switch (kind) {
    case "heal":
      player.health = clamp(player.health + 28, 0, player.maxHealth);
      break;
    case "rapid":
    case "spread":
    case "pierce":
    case "damage":
      player.overdrive = clamp(player.overdrive + 5, 0, 12);
      break;
    case "mega":
      player.overdrive = clamp(player.overdrive + 9, 0, 14);
      player.health = clamp(player.health + 14, 0, player.maxHealth);
      break;
  }
}

export function tickPowerups(
  powerups: Powerup[],
  player: Player,
  dt: number,
  height: number,
  onCollect: (powerup: Powerup) => void,
): void {
  let write = 0;
  for (let read = 0; read < powerups.length; read += 1) {
    const powerup = powerups[read];
    powerup.pulse += dt * 4;
    powerup.life -= dt;
    powerup.y += powerup.vy * dt;
    const dx = player.x - powerup.x;
    const dy = player.y - powerup.y;
    const d = Math.hypot(dx, dy);
    if (d < 120 && d > 0) {
      powerup.x += (dx / d) * 220 * dt;
      powerup.y += (dy / d) * 220 * dt;
    }
    if (powerup.life <= 0 || powerup.y > height + 40) continue;
    if (dist(powerup, player) < powerup.radius + player.radius) {
      onCollect(powerup);
      continue;
    }
    if (write !== read) powerups[write] = powerup;
    write += 1;
  }
  powerups.length = write;
}
