import type { Particle } from "../types.js";
import { Pool } from "../core/Pool.js";
import { MAX_PARTICLES } from "../constants.js";
import { rand, random } from "../math.js";
import { TAU } from "../constants.js";

export type ParticlePool = Pool<Particle>;

export function createParticlePool(): ParticlePool {
  return new Pool<Particle>(MAX_PARTICLES, (): Particle => ({
    x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, hue: 0, size: 1, glow: false,
  }));
}

export function pushParticle(
  pool: ParticlePool,
  x: number, y: number,
  vx: number, vy: number,
  life: number,
  hue: number,
  size: number,
  glow: boolean,
): void {
  const p = pool.next();
  p.x = x; p.y = y; p.vx = vx; p.vy = vy;
  p.life = life; p.maxLife = life; p.hue = hue; p.size = size; p.glow = glow;
}

export function burst(
  pool: ParticlePool,
  x: number,
  y: number,
  hue: number,
  amount: number,
  speed: number,
): void {
  for (let i = 0; i < amount; i++) {
    const angle = rand(0, TAU);
    const velocity = rand(speed * 0.25, speed);
    const p = pool.next();
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * velocity;
    p.vy = Math.sin(angle) * velocity;
    p.life = rand(0.35, 0.95);
    p.maxLife = 0.95;
    p.hue = hue + rand(-30, 30);
    p.size = rand(1.5, 5);
    p.glow = random() > 0.5;
  }
}

export function shockwave(
  pool: ParticlePool,
  x: number,
  y: number,
  hue: number,
  strength = 1,
): void {
  const count = Math.floor(28 * strength);
  for (let i = 0; i < count; i++) {
    const angle = (i / 28) * TAU + rand(-0.08, 0.08);
    const velocity = rand(180, 340) * strength;
    const p = pool.next();
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * velocity;
    p.vy = Math.sin(angle) * velocity;
    p.life = rand(0.25, 0.55);
    p.maxLife = 0.55;
    p.hue = hue + rand(-15, 15);
    p.size = rand(2.5, 6);
    p.glow = true;
  }
}

export function tickParticles(pool: ParticlePool, dt: number): void {
  const drag = 0.985;
  for (let r = 0; r < pool.count; r++) {
    const p = pool.buf[r];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= drag;
    p.vy *= drag;
  }
  pool.compact((p) => p.life <= 0);
}
