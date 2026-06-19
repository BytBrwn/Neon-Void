import type { Vec2 } from "./types.js";
import { TAU } from "./constants.js";

export { TAU };

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normalize(x: number, y: number): Vec2 {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

export function lerpAngle(from: number, to: number, t: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= TAU;
  while (diff < -Math.PI) diff += TAU;
  return from + diff * t;
}

export function expSmoothing(speed: number, dt: number): number {
  return 1 - Math.exp(-speed * dt);
}

export function waveScale(wave: number): number {
  return 1 + (wave - 1) * 0.14;
}

export function randomEdgePoint(width: number, height: number): Vec2 {
  const edge = Math.floor(Math.random() * 4);
  const pad = 48;
  if (edge === 0) return { x: rand(pad, width - pad), y: -pad };
  if (edge === 1) return { x: width + pad, y: rand(pad, height - pad) };
  if (edge === 2) return { x: rand(pad, width - pad), y: height + pad };
  return { x: -pad, y: rand(pad, height - pad) };
}
