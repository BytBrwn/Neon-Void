import type { ShopItemId, ShopOffer, ShopSkinOffer, ShipSkinId, WeaponStats, Player } from "../types.js";
import { clamp } from "../math.js";
import { SHIP_SKINS } from "../assets/shipSkins.js";

export const SHOP_CATALOG: Array<{ id: ShopItemId; label: string; detail: string }> = [
  { id: "rapid", label: "Rapid Fire", detail: "Boost fire rate" },
  { id: "spread", label: "Wide Spread", detail: "More bullets per volley" },
  { id: "pierce", label: "Pierce Round", detail: "Bullets pass through foes" },
  { id: "damage", label: "Overcharge", detail: "Increase shot damage" },
  { id: "repair", label: "Hull Repair", detail: "Restore full health" },
  { id: "maxHealth", label: "Reinforced Hull", detail: "+20 max health" },
  { id: "mega", label: "Mega Bundle", detail: "+1 to all weapon stats" },
];

export function shopCost(id: ShopItemId, player: Player, maxHealthPurchases: number): number {
  const w = player.weapon;
  const prices: Record<ShopItemId, number> = {
    rapid: 22 + w.fireRate * 24,
    spread: 28 + w.spread * 28,
    pierce: 26 + w.pierce * 24,
    damage: 30 + w.damage * 30,
    repair: 35 + Math.floor((player.maxHealth - player.health) * 0.15),
    maxHealth: 55 + maxHealthPurchases * 20,
    mega: 95,
  };
  return prices[id];
}

export function shopSoldOut(id: ShopItemId, player: Player, maxHealthPurchases: number): boolean {
  const w = player.weapon;
  if (id === "rapid") return w.fireRate >= 4;
  if (id === "spread") return w.spread >= 3;
  if (id === "pierce") return w.pierce >= 3;
  if (id === "damage") return w.damage >= 4;
  if (id === "maxHealth") return maxHealthPurchases >= 4;
  if (id === "repair") return player.health >= player.maxHealth;
  return false;
}

export function buildShopOffers(player: Player, maxHealthPurchases: number, wave: number): ShopOffer[] {
  return SHOP_CATALOG.map((item) => ({
    ...item,
    cost: item.id === "mega" ? 95 + wave * 4 : shopCost(item.id, player, maxHealthPurchases),
    soldOut: shopSoldOut(item.id, player, maxHealthPurchases),
  }));
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

export function applyShopItem(id: ShopItemId, player: Player, maxHealthPurchases: number): number {
  const w = player.weapon;
  let next = maxHealthPurchases;
  switch (id) {
    case "rapid":
      w.fireRate = clamp(w.fireRate + 1, 0, 4);
      break;
    case "spread":
      w.spread = clamp(w.spread + 1, 0, 3);
      break;
    case "pierce":
      w.pierce = clamp(w.pierce + 1, 0, 3);
      break;
    case "damage":
      w.damage = clamp(w.damage + 1, 0, 4);
      break;
    case "repair":
      player.health = player.maxHealth;
      break;
    case "maxHealth":
      next += 1;
      player.maxHealth += 20;
      player.health = clamp(player.health + 20, 0, player.maxHealth);
      break;
    case "mega":
      w.fireRate = clamp(w.fireRate + 1, 0, 4);
      w.spread = clamp(w.spread + 1, 0, 3);
      w.pierce = clamp(w.pierce + 1, 0, 3);
      w.damage = clamp(w.damage + 1, 0, 4);
      break;
  }
  return next;
}

export function weaponLabel(weapon: WeaponStats): string {
  const parts: string[] = [];
  if (weapon.fireRate > 0) parts.push(`RAPID x${weapon.fireRate}`);
  if (weapon.spread > 0) parts.push(`SPREAD x${weapon.spread}`);
  if (weapon.pierce > 0) parts.push(`PIERCE x${weapon.pierce}`);
  if (weapon.damage > 0) parts.push(`POWER x${weapon.damage}`);
  return parts.length > 0 ? parts.join(" · ") : "STANDARD";
}
