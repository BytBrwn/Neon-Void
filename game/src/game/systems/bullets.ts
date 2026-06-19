import type { Bullet, Enemy, Vec2 } from "../types.js";
import { Pool } from "../core/Pool.js";
import { GRAVITY_WELL_BASE_STRENGTH, GRAVITY_WELL_MAX_ACCEL, MAX_BULLETS } from "../constants.js";

export type BulletPool = Pool<Bullet>;

export function createBulletPool(): BulletPool {
  return new Pool<Bullet>(MAX_BULLETS, (): Bullet => ({
    x: 0, y: 0, vx: 0, vy: 0, life: 0, hue: 0, radius: 4.5, friendly: true, pierce: 0, damage: 14,
  }));
}

export function shoot(
  pool: BulletPool,
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
  const offset = tipOffset ?? (friendly ? 24 : 16);
  const b = pool.next();
  b.x = from.x + Math.cos(angle) * offset;
  b.y = from.y + Math.sin(angle) * offset;
  b.vx = Math.cos(angle) * speed;
  b.vy = Math.sin(angle) * speed;
  b.life = friendly ? 1.6 : 2.2;
  b.hue = hue;
  b.radius = radius ?? (friendly ? 4.5 : 6);
  b.friendly = friendly;
  b.pierce = pierce;
  b.damage = damage;
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

export function applyBulletGravityWells(
  bullet: Bullet,
  enemies: Pool<Enemy>,
  dt: number,
): void {
  if (!bullet.friendly || enemies.count === 0) return;

  for (let i = 0; i < enemies.count; i++) {
    const enemy = enemies.buf[i];
    const dx = enemy.x - bullet.x;
    const dy = enemy.y - bullet.y;
    const radius = enemyGravityRadius(enemy);
    const distSq = dx * dx + dy * dy;
    if (distSq >= radius * radius || distSq < 1) continue;

    const d = Math.sqrt(distSq);
    const proximity = 1 - d / radius;
    const falloff = 0.35 + proximity * 0.65;
    const softening = enemy.radius * 0.12;
    const accel = Math.min(
      GRAVITY_WELL_MAX_ACCEL,
      (enemyGravityStrength(enemy) * falloff) / (distSq + softening * softening),
    );

    bullet.vx += (dx / d) * accel * dt;
    bullet.vy += (dy / d) * accel * dt;
  }
}

export function tickBullets(
  pool: BulletPool,
  enemies: Pool<Enemy>,
  dt: number,
  width: number,
  height: number,
  onFriendlyTrail?: (bullet: Bullet) => void,
): void {
  for (let i = 0; i < pool.count; i++) {
    const bullet = pool.buf[i];
    applyBulletGravityWells(bullet, enemies, dt);
    bullet.life -= dt;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (bullet.friendly && onFriendlyTrail) onFriendlyTrail(bullet);
  }
  pool.compact(
    (b) =>
      b.life <= 0 ||
      b.x < -40 ||
      b.x > width + 40 ||
      b.y < -40 ||
      b.y > height + 40,
  );
}
