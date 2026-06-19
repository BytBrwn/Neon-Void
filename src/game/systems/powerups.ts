import type { PowerupKind, Powerup, Player, Enemy, EnemyKind } from "../types.js";
import { clamp, dist, rand, TAU } from "../math.js";
import { powerupIconHue } from "../assets/powerupIcons.js";

export function powerupHue(kind: PowerupKind): number {
  return powerupIconHue(kind);
}

export function rollPowerupKind(bonus = false): PowerupKind {
  const roll = Math.random();
  if (bonus || roll < 0.06) return "mega";
  if (roll < 0.28) return "rapid";
  if (roll < 0.48) return "spread";
  if (roll < 0.66) return "pierce";
  if (roll < 0.82) return "damage";
  return "heal";
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
  const w = player.weapon;
  switch (kind) {
    case "rapid":
      w.fireRate = clamp(w.fireRate + 1, 0, 4);
      break;
    case "spread":
      w.spread = clamp(w.spread + 1, 0, 3);
      break;
    case "pierce":
      w.pierce = clamp(w.pierce + 1, 0, 3);
      break;
    case "damage":
      w.damage = clamp(w.damage + 1, 0, 4);
      break;
    case "heal":
      player.health = clamp(player.health + 28, 0, player.maxHealth);
      break;
    case "mega":
      w.fireRate = clamp(w.fireRate + 1, 0, 4);
      w.spread = clamp(w.spread + 1, 0, 3);
      w.pierce = clamp(w.pierce + 1, 0, 3);
      w.damage = clamp(w.damage + 1, 0, 4);
      break;
  }
}

export function tickPowerups(
  powerups: Powerup[],
  player: Player,
  dt: number,
  height: number,
  onCollect: (powerup: Powerup) => void,
): Powerup[] {
  return powerups.filter((powerup) => {
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
    if (powerup.life <= 0 || powerup.y > height + 40) return false;
    if (dist(powerup, player) < powerup.radius + player.radius) {
      onCollect(powerup);
      return false;
    }
    return true;
  });
}
