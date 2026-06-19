import type {
  BlasterId,
  Player,
  ShopBlasterOffer,
  ShopOffer,
  ShopSkinOffer,
  ShopSupportId,
  ShipSkinId,
} from "../types.js";
import { BLASTERS } from "../factories/blasterFactory.js";
import { SHIP_SKINS } from "../assets/shipSkins.js";

export const SUPPORT_CATALOG: Array<{ id: ShopSupportId; label: string; detail: string }> = [
  { id: "repair", label: "Hull Repair", detail: "Restore full health" },
  { id: "maxHealth", label: "Reinforced Hull", detail: "+20 max health" },
];

export function supportCost(id: ShopSupportId, player: Player, maxHealthPurchases: number): number {
  const prices: Record<ShopSupportId, number> = {
    repair: 35 + Math.floor((player.maxHealth - player.health) * 0.15),
    maxHealth: 55 + maxHealthPurchases * 20,
  };
  return prices[id];
}

export function supportSoldOut(id: ShopSupportId, player: Player, maxHealthPurchases: number): boolean {
  if (id === "maxHealth") return maxHealthPurchases >= 4;
  if (id === "repair") return player.health >= player.maxHealth;
  return false;
}

export function buildShopOffers(player: Player, maxHealthPurchases: number): ShopOffer[] {
  return SUPPORT_CATALOG.map((item) => ({
    ...item,
    cost: supportCost(item.id, player, maxHealthPurchases),
    soldOut: supportSoldOut(item.id, player, maxHealthPurchases),
  }));
}

export function buildShopBlasters(player: Player, ownedBlasters: Set<BlasterId>): ShopBlasterOffer[] {
  return (Object.keys(BLASTERS) as BlasterId[]).map((id) => {
    const spec = BLASTERS[id];
    return {
      id,
      label: spec.label,
      detail: spec.detail,
      cost: spec.cost,
      owned: ownedBlasters.has(id),
      equipped: player.blaster === id,
    };
  });
}

export function buildShopSkins(player: Player, ownedSkins: Set<ShipSkinId>): ShopSkinOffer[] {
  return (Object.keys(SHIP_SKINS) as ShipSkinId[]).map((id) => {
    const spec = SHIP_SKINS[id];
    return {
      id,
      label: spec.label,
      detail: spec.detail,
      cost: spec.cost,
      owned: ownedSkins.has(id),
      equipped: player.skin === id,
    };
  });
}

export function applyShopSupport(id: ShopSupportId, player: Player, maxHealthPurchases: number): number {
  let next = maxHealthPurchases;
  switch (id) {
    case "repair":
      player.health = player.maxHealth;
      break;
    case "maxHealth":
      next += 1;
      player.maxHealth += 20;
      player.health = Math.min(player.maxHealth, player.health + 20);
      break;
  }
  return next;
}
