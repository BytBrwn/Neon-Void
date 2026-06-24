import type { ShipSkinId, BlasterId } from "./types.js";
import type { IPersistence } from "./persistence/IPersistence.js";
import { defaultPersistence } from "./persistence/LocalStoragePersistence.js";
import { SHIP_SKINS } from "./assets/shipSkins.js";
import { BLASTERS } from "./factories/blasterFactory.js";

export const HIGH_SCORE_KEY = "catalyx-neon-high";
export const OWNED_SKINS_KEY = "catalyx-neon-skins";
export const EQUIPPED_SKIN_KEY = "catalyx-neon-ship";
export const OWNED_BLASTERS_KEY = "catalyx-neon-blasters";
export const EQUIPPED_BLASTER_KEY = "catalyx-neon-blaster";
export const VOLUME_KEY = "catalyx-neon-volume";
export const MUTED_KEY = "catalyx-neon-muted";

export function loadHighScore(store: IPersistence = defaultPersistence): number {
  return Number(store.getItem(HIGH_SCORE_KEY) ?? 0);
}

export function saveHighScore(score: number, store: IPersistence = defaultPersistence): void {
  store.setItem(HIGH_SCORE_KEY, String(score));
}

export function loadOwnedSkins(store: IPersistence = defaultPersistence): Set<ShipSkinId> {
  const saved = store.getItem(OWNED_SKINS_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as ShipSkinId[];
      return new Set(parsed.filter((id) => id in SHIP_SKINS));
    } catch {
      /* ignore malformed data */
    }
  }
  return new Set<ShipSkinId>(["interceptor"]);
}

export function loadEquippedSkin(owned: Set<ShipSkinId>, store: IPersistence = defaultPersistence): ShipSkinId {
  const equipped = store.getItem(EQUIPPED_SKIN_KEY) as ShipSkinId | null;
  if (equipped && equipped in SHIP_SKINS && owned.has(equipped)) {
    return equipped;
  }
  return "interceptor";
}

export function saveSkinProgress(
  owned: Set<ShipSkinId>,
  equipped: ShipSkinId,
  store: IPersistence = defaultPersistence,
): void {
  store.setItem(OWNED_SKINS_KEY, JSON.stringify([...owned]));
  store.setItem(EQUIPPED_SKIN_KEY, equipped);
}

export function loadOwnedBlasters(store: IPersistence = defaultPersistence): Set<BlasterId> {
  const saved = store.getItem(OWNED_BLASTERS_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as BlasterId[];
      return new Set(parsed.filter((id) => id in BLASTERS));
    } catch {
      /* ignore malformed data */
    }
  }
  return new Set<BlasterId>(["pulse"]);
}

export function loadEquippedBlaster(owned: Set<BlasterId>, store: IPersistence = defaultPersistence): BlasterId {
  const equipped = store.getItem(EQUIPPED_BLASTER_KEY) as BlasterId | null;
  if (equipped && equipped in BLASTERS && owned.has(equipped)) {
    return equipped;
  }
  return "pulse";
}

export function saveBlasterProgress(
  owned: Set<BlasterId>,
  equipped: BlasterId,
  store: IPersistence = defaultPersistence,
): void {
  store.setItem(OWNED_BLASTERS_KEY, JSON.stringify([...owned]));
  store.setItem(EQUIPPED_BLASTER_KEY, equipped);
}

export function loadVolume(store: IPersistence = defaultPersistence): number {
  const saved = Number(store.getItem(VOLUME_KEY));
  return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : 0.45;
}

export function saveVolume(volume: number, store: IPersistence = defaultPersistence): void {
  store.setItem(VOLUME_KEY, String(volume));
}

export function loadMuted(store: IPersistence = defaultPersistence): boolean {
  return store.getItem(MUTED_KEY) === "1";
}

export function saveMuted(muted: boolean, store: IPersistence = defaultPersistence): void {
  store.setItem(MUTED_KEY, muted ? "1" : "0");
}
