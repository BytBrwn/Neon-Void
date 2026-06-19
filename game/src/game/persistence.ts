import type { ShipSkinId, BlasterId } from "./types.js";
import { SHIP_SKINS } from "./assets/shipSkins.js";
import { BLASTERS } from "./factories/blasterFactory.js";

export const HIGH_SCORE_KEY = "catalyx-neon-high";
export const OWNED_SKINS_KEY = "catalyx-neon-skins";
export const EQUIPPED_SKIN_KEY = "catalyx-neon-ship";
export const OWNED_BLASTERS_KEY = "catalyx-neon-blasters";
export const EQUIPPED_BLASTER_KEY = "catalyx-neon-blaster";

export function loadHighScore(): number {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY) ?? 0);
  } catch {
    return 0;
  }
}

export function saveHighScore(score: number): void {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    /* ignore */
  }
}

export function loadOwnedSkins(): Set<ShipSkinId> {
  try {
    const saved = localStorage.getItem(OWNED_SKINS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as ShipSkinId[];
      return new Set(parsed.filter((id) => id in SHIP_SKINS));
    }
  } catch {
    /* ignore */
  }
  const owned = new Set<ShipSkinId>(["interceptor"]);
  owned.add("interceptor");
  return owned;
}

export function loadEquippedSkin(owned: Set<ShipSkinId>): ShipSkinId {
  try {
    const equipped = localStorage.getItem(EQUIPPED_SKIN_KEY) as ShipSkinId | null;
    if (equipped && equipped in SHIP_SKINS && owned.has(equipped)) {
      return equipped;
    }
  } catch {
    /* ignore */
  }
  return "interceptor";
}

export function saveSkinProgress(owned: Set<ShipSkinId>, equipped: ShipSkinId): void {
  try {
    localStorage.setItem(OWNED_SKINS_KEY, JSON.stringify([...owned]));
    localStorage.setItem(EQUIPPED_SKIN_KEY, equipped);
  } catch {
    /* ignore */
  }
}

export function loadOwnedBlasters(): Set<BlasterId> {
  try {
    const saved = localStorage.getItem(OWNED_BLASTERS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as BlasterId[];
      return new Set(parsed.filter((id) => id in BLASTERS));
    }
  } catch {
    /* ignore */
  }
  return new Set<BlasterId>(["pulse"]);
}

export function loadEquippedBlaster(owned: Set<BlasterId>): BlasterId {
  try {
    const equipped = localStorage.getItem(EQUIPPED_BLASTER_KEY) as BlasterId | null;
    if (equipped && equipped in BLASTERS && owned.has(equipped)) {
      return equipped;
    }
  } catch {
    /* ignore */
  }
  return "pulse";
}

export function saveBlasterProgress(owned: Set<BlasterId>, equipped: BlasterId): void {
  try {
    localStorage.setItem(OWNED_BLASTERS_KEY, JSON.stringify([...owned]));
    localStorage.setItem(EQUIPPED_BLASTER_KEY, equipped);
  } catch {
    /* ignore */
  }
}
