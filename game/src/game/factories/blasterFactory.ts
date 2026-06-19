import type { BlasterId } from "../types.js";
import { clamp } from "../math.js";

export type BlasterShot = {
  angleOffset: number;
  speed: number;
  hue: number;
  pierce: number;
  damage: number;
  radius: number;
  tipOffset: number;
};

export type BlasterDef = {
  id: BlasterId;
  label: string;
  detail: string;
  cost: number;
  hue: number;
  cooldown: number;
  recoil: number;
  barrelLength: number;
  barrelWidth: number;
  shots: Omit<BlasterShot, "hue" | "pierce" | "damage">[];
  pierce: number;
  damage: number;
};

export const BLASTERS: Record<BlasterId, BlasterDef> = {
  pulse: {
    id: "pulse",
    label: "Pulse Bolt",
    detail: "Single focused energy shot",
    cost: 0,
    hue: 168,
    cooldown: 0.1,
    recoil: 12,
    barrelLength: 14,
    barrelWidth: 5,
    pierce: 0,
    damage: 18,
    shots: [{ angleOffset: 0, speed: 860, radius: 4.5, tipOffset: 4 }],
  },
  rapid: {
    id: "rapid",
    label: "Needle Stream",
    detail: "Fast narrow bolts",
    cost: 38,
    hue: 195,
    cooldown: 0.042,
    recoil: 6,
    barrelLength: 12,
    barrelWidth: 3.5,
    pierce: 0,
    damage: 9,
    shots: [{ angleOffset: 0, speed: 980, radius: 3.2, tipOffset: 3 }],
  },
  scatter: {
    id: "scatter",
    label: "Shard Burst",
    detail: "Five-shot spread cone",
    cost: 45,
    hue: 42,
    cooldown: 0.16,
    recoil: 18,
    barrelLength: 11,
    barrelWidth: 8,
    pierce: 0,
    damage: 9,
    shots: [
      { angleOffset: -0.22, speed: 760, radius: 3.8, tipOffset: 3 },
      { angleOffset: -0.11, speed: 790, radius: 3.8, tipOffset: 3 },
      { angleOffset: 0, speed: 820, radius: 4, tipOffset: 3 },
      { angleOffset: 0.11, speed: 790, radius: 3.8, tipOffset: 3 },
      { angleOffset: 0.22, speed: 760, radius: 3.8, tipOffset: 3 },
    ],
  },
  lance: {
    id: "lance",
    label: "Pierce Lance",
    detail: "Heavy bolt — punches through",
    cost: 58,
    hue: 280,
    cooldown: 0.2,
    recoil: 22,
    barrelLength: 18,
    barrelWidth: 6,
    pierce: 3,
    damage: 26,
    shots: [{ angleOffset: 0, speed: 920, radius: 5.5, tipOffset: 5 }],
  },
  twin: {
    id: "twin",
    label: "Twin Stream",
    detail: "Dual parallel blasters",
    cost: 72,
    hue: 145,
    cooldown: 0.078,
    recoil: 14,
    barrelLength: 13,
    barrelWidth: 4,
    pierce: 0,
    damage: 12,
    shots: [
      { angleOffset: 0.04, speed: 840, radius: 3.8, tipOffset: 4 },
      { angleOffset: -0.04, speed: 840, radius: 3.8, tipOffset: 4 },
    ],
  },
  nova: {
    id: "nova",
    label: "Nova Cannon",
    detail: "Slow heavy plasma orb",
    cost: 85,
    hue: 12,
    cooldown: 0.34,
    recoil: 28,
    barrelLength: 16,
    barrelWidth: 9,
    pierce: 1,
    damage: 42,
    shots: [{ angleOffset: 0, speed: 640, radius: 7, tipOffset: 6 }],
  },
};

export function getBlasterDef(id: BlasterId): BlasterDef {
  return BLASTERS[id];
}

export function blasterLabel(id: BlasterId): string {
  return BLASTERS[id].label.toUpperCase();
}

export function computeBlasterVolley(
  blasterId: BlasterId,
  combo: number,
  overdrive: number,
): { shots: BlasterShot[]; cooldown: number; recoil: number } {
  const def = getBlasterDef(blasterId);
  const comboPierce = combo >= 5 ? 2 : combo >= 2 ? 1 : 0;
  const amp = overdrive > 0 ? 1.35 : 1;
  const pierce = def.pierce + comboPierce;
  const damage = Math.floor((def.damage + combo * 2) * amp);
  const hueShift = combo * 6;
  const cooldown = clamp(def.cooldown * (overdrive > 0 ? 0.88 : 1) - combo * 0.003, 0.028, def.cooldown);

  const shots: BlasterShot[] = def.shots.map((shot, i) => ({
    ...shot,
    hue: def.hue + hueShift + i * 4,
    pierce,
    damage,
  }));

  return { shots, cooldown, recoil: def.recoil };
}
