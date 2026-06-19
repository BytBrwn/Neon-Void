import type { Enemy, EnemyKind, Vec2 } from "../types.js";
import { rand, waveScale, TAU } from "../math.js";

export type EnemySpawnContext = {
  wave: number;
  spawn: Vec2;
};

export function createEnemy(kind: EnemyKind, ctx: EnemySpawnContext): Enemy {
  const { wave, spawn } = ctx;
  const scale = waveScale(wave);
  const base = {
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    spin: rand(-2, 2),
    pulse: rand(0, TAU),
    timer: rand(0, 2),
    orbitDir: Math.random() > 0.5 ? 1 : -1,
    phase: rand(0, TAU),
  };

  const hp = (value: number): number => Math.floor(value * scale);

  switch (kind) {
    case "boss":
      return { ...base, radius: 50, health: hp(110 + wave * 32), maxHealth: hp(110 + wave * 32), hue: rand(280, 320), kind };
    case "tank":
      return { ...base, radius: 28, health: hp(44 + wave * 5), maxHealth: hp(44 + wave * 5), hue: rand(20, 45), kind };
    case "hunter":
      return { ...base, radius: 20, health: hp(18 + wave * 2.5), maxHealth: hp(18 + wave * 2.5), hue: rand(155, 195), kind };
    case "skitter":
      return { ...base, radius: 13, health: hp(9 + wave * 1.2), maxHealth: hp(9 + wave * 1.2), hue: rand(90, 130), kind, vx: rand(-120, 120) * scale, vy: rand(-120, 120) * scale };
    case "orbiter":
      return { ...base, radius: 18, health: hp(16 + wave * 2.5), maxHealth: hp(16 + wave * 2.5), hue: rand(200, 240), kind };
    case "splitter":
      return { ...base, radius: 19, health: hp(14 + wave * 2.5), maxHealth: hp(14 + wave * 2.5), hue: rand(300, 340), kind };
    case "phantom":
      return { ...base, radius: 17, health: hp(14 + wave * 2.5), maxHealth: hp(14 + wave * 2.5), hue: rand(260, 290), kind };
    case "stalker":
      return { ...base, radius: 16, health: hp(10 + wave * 1.5), maxHealth: hp(10 + wave * 1.5), hue: rand(350, 20), kind };
    case "bomber":
      return { ...base, radius: 22, health: hp(22 + wave * 3), maxHealth: hp(22 + wave * 3), hue: rand(40, 70), kind };
    case "sentinel":
      return { ...base, radius: 24, health: hp(30 + wave * 4), maxHealth: hp(30 + wave * 4), hue: rand(170, 210), kind };
    default:
      return { ...base, radius: 15, health: hp(10 + wave * 1.1), maxHealth: hp(10 + wave * 1.1), hue: rand(0, 360), kind: "drifter", vx: rand(-90, 90) * scale, vy: rand(-90, 90) * scale };
  }
}

export const ENEMY_SCORE: Record<EnemyKind, number> = {
  drifter: 35,
  skitter: 45,
  hunter: 75,
  orbiter: 90,
  splitter: 65,
  phantom: 85,
  tank: 120,
  stalker: 95,
  bomber: 110,
  sentinel: 140,
  boss: 550,
};

export const ENEMY_CREDITS: Record<EnemyKind, number> = {
  drifter: 3,
  skitter: 4,
  hunter: 6,
  orbiter: 7,
  splitter: 5,
  phantom: 7,
  tank: 10,
  stalker: 8,
  bomber: 9,
  sentinel: 12,
  boss: 50,
};
