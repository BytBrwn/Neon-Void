import type { Bullet, Enemy, Vec2 } from "../types.js";
import { GRAVITY_WELL_BASE_STRENGTH, GRAVITY_WELL_MAX_ACCEL, MAX_BULLETS } from "../constants.js";

export function shoot(
  bullets: Bullet[],
  from: Vec2,
  angle: number,
  friendly: boolean,
  speed: number,
  hue: number,
  pierce = 0,
  damage = 14,
  tipOffset?: number,
  radius?: number,
): void {
  if (bullets.length >= MAX_BULLETS) {
    bullets.shift();
  }
  const offset = tipOffset ?? (friendly ? 24 : 16);
  bullets.push({
    x: from.x + Math.cos(angle) * offset,
    y: from.y + Math.sin(angle) * offset,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: friendly ? 1.6 : 2.2,
    hue,
    radius: radius ?? (friendly ? 4.5 : 6),
    friendly,
    pierce,
    damage,
  });
}

export function enemyGravityRadius(enemy: Enemy): number {
  const scale =
    enemy.kind === "boss" ? 8.5 :
    enemy.kind === "tank" ? 7.5 :
    enemy.kind === "sentinel" ? 7 :
    enemy.kind === "skitter" ? 5.5 :
    enemy.kind === "phantom" ? 6.5 :
    6.5;
  return enemy.radius * scale + 24;
}

export function enemyGravityStrength(enemy: Enemy): number {
  const massScale = (enemy.radius / 18) ** 2;
  const kindScale =
    enemy.kind === "boss" ? 3.2 :
    enemy.kind === "tank" ? 1.85 :
    enemy.kind === "sentinel" ? 1.45 :
    enemy.kind === "skitter" ? 0.5 :
    enemy.kind === "phantom" ? 0.85 :
    1;
  return GRAVITY_WELL_BASE_STRENGTH * massScale * kindScale;
}

export function applyBulletGravityWells(bullet: Bullet, enemies: Enemy[], dt: number): void {
  if (!bullet.friendly || enemies.length === 0) return;

  for (const enemy of enemies) {
    const dx = enemy.x - bullet.x;
    const dy = enemy.y - bullet.y;
    const radius = enemyGravityRadius(enemy);
    const distSq = dx * dx + dy * dy;
    if (distSq >= radius * radius || distSq < 1) continue;

    const dist = Math.sqrt(distSq);
    const proximity = 1 - dist / radius;
    const falloff = 0.35 + proximity * 0.65;
    const softening = enemy.radius * 0.12;
    const accel = Math.min(
      GRAVITY_WELL_MAX_ACCEL,
      (enemyGravityStrength(enemy) * falloff) / (distSq + softening * softening),
    );

    bullet.vx += (dx / dist) * accel * dt;
    bullet.vy += (dy / dist) * accel * dt;
  }
}

export function tickBullets(
  bullets: Bullet[],
  enemies: Enemy[],
  dt: number,
  width: number,
  height: number,
  onFriendlyTrail?: (bullet: Bullet) => void,
): void {
  let write = 0;
  for (let read = 0; read < bullets.length; read += 1) {
    const bullet = bullets[read];
    applyBulletGravityWells(bullet, enemies, dt);
    bullet.life -= dt;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (bullet.friendly && onFriendlyTrail) onFriendlyTrail(bullet);
    if (
      bullet.life > 0
      && bullet.x > -40
      && bullet.x < width + 40
      && bullet.y > -40
      && bullet.y < height + 40
    ) {
      if (write !== read) bullets[write] = bullet;
      write += 1;
    }
  }
  bullets.length = write;
}
