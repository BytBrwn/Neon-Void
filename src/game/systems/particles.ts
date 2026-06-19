import type { Particle } from "../types.js";
import { MAX_PARTICLES } from "../constants.js";
import { rand, TAU } from "../math.js";

let particleWriteCursor = 0;

export function pushParticle(particles: Particle[], particle: Particle): void {
  if (particles.length < MAX_PARTICLES) {
    particles.push(particle);
    return;
  }
  particles[particleWriteCursor % MAX_PARTICLES] = particle;
  particleWriteCursor += 1;
}

export function burst(
  particles: Particle[],
  x: number,
  y: number,
  hue: number,
  amount: number,
  speed: number,
): void {
  for (let i = 0; i < amount; i += 1) {
    const angle = rand(0, TAU);
    const velocity = rand(speed * 0.25, speed);
    pushParticle(particles, {
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: rand(0.35, 0.95),
      maxLife: 0.95,
      hue: hue + rand(-30, 30),
      size: rand(1.5, 5),
      glow: Math.random() > 0.5,
    });
  }
}

export function shockwave(
  particles: Particle[],
  x: number,
  y: number,
  hue: number,
  strength = 1,
): void {
  for (let i = 0; i < 28 * strength; i += 1) {
    const angle = (i / 28) * TAU + rand(-0.08, 0.08);
    const velocity = rand(180, 340) * strength;
    pushParticle(particles, {
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: rand(0.25, 0.55),
      maxLife: 0.55,
      hue: hue + rand(-15, 15),
      size: rand(2.5, 6),
      glow: true,
    });
  }
}

export function tickParticles(particles: Particle[], dt: number): void {
  let write = 0;
  for (let read = 0; read < particles.length; read += 1) {
    const p = particles[read];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.985;
    p.vy *= 0.985;
    if (p.life > 0) {
      if (write !== read) particles[write] = p;
      write += 1;
    }
  }
  particles.length = write;
}
