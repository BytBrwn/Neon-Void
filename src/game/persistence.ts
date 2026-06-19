import type { ShipSkinId } from "./types.js";
import { SHIP_SKINS } from "./assets/shipSkins.js";

export const HIGH_SCORE_KEY = "catalyx-neon-high";
export const OWNED_SKINS_KEY = "catalyx-neon-skins";
export const EQUIPPED_SKIN_KEY = "catalyx-neon-ship";

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
