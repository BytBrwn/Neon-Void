import type { EnemyKind } from "../types.js";
import { rand } from "../math.js";

export function isBossWave(wave: number): boolean {
  return wave > 0 && wave % 10 === 0;
}

export function isShopWave(wave: number): boolean {
  return wave > 0 && wave % 5 === 0;
}

export function randomWaveCount(wave: number): number {
  const min = Math.floor(4 + wave * 1.1);
  const max = Math.floor(7 + wave * 2.6);
  return Math.floor(rand(min, max + 1));
}

export function pickSpawnKind(wave: number): EnemyKind {
  const roll = Math.random();
  if (wave % 10 === 0 && roll < 0.2) return "boss";
  if (wave >= 8 && roll < 0.1) return "sentinel";
  if (wave >= 6 && roll < 0.16) return "bomber";
  if (wave >= 5 && roll < 0.2) return "stalker";
  if (wave >= 4 && roll < 0.24) return "phantom";
  if (wave >= 3 && roll < 0.32) return "splitter";
  if (wave >= 2 && roll < 0.42) return "orbiter";
  if (roll < 0.55) return "skitter";
  if (roll < 0.68) return "hunter";
  if (roll < 0.82) return "tank";
  return "drifter";
}

export function waveClearBonus(wave: number): number {
  return 18 + wave * 10;
}
