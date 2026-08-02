/**
 * Upgradeable boss-stat relics (client mirror of backend/bossRelicItems.js).
 * At most one of each type; higher rarity replaces lower.
 */

import type { ItemRarity } from '@/utils/itemRarity';
import { ITEM_RARITY_RANK, isItemRarity } from '@/utils/itemRarity';

export const MANA_SHIELD_ITEM = 'MANA_SHIELD';
export const COLOSSUS_LUNGS_ITEM = 'COLOSSUS_LUNGS';
export const REAPER_CLAWS_ITEM = 'REAPER_CLAWS';
export const TITAN_HEART_ITEM = 'TITAN_HEART';

export const UPGRADEABLE_BOSS_RELIC_TYPES = Object.freeze([
  MANA_SHIELD_ITEM,
  COLOSSUS_LUNGS_ITEM,
  REAPER_CLAWS_ITEM,
  TITAN_HEART_ITEM,
]);

export const BOSS_RELIC_ICON_PATHS: Record<string, string> = {
  [MANA_SHIELD_ITEM]: '/icons/items/manaShield.svg',
  [COLOSSUS_LUNGS_ITEM]: '/icons/items/colossusLungs.svg',
  [REAPER_CLAWS_ITEM]: '/icons/items/reaperClaws.svg',
  [TITAN_HEART_ITEM]: '/icons/items/titanHeart.svg',
};

const RARITY_ORDER: ItemRarity[] = ['common', 'rare', 'epic', 'legendary'];

export type BossRelicPickupOutcome = 'new' | 'upgrade' | 'discard';

export function isUpgradeableBossRelic(type: string | undefined | null): boolean {
  return type != null && (UPGRADEABLE_BOSS_RELIC_TYPES as readonly string[]).includes(type);
}

export function compareBossRelicRarity(
  a: string | undefined | null,
  b: string | undefined | null,
): number {
  const rankA = a && isItemRarity(a) ? ITEM_RARITY_RANK[a] : -1;
  const rankB = b && isItemRarity(b) ? ITEM_RARITY_RANK[b] : -1;
  return rankA - rankB;
}

export function nextRarity(rarity: string | undefined | null): ItemRarity | null {
  if (!rarity || !isItemRarity(rarity)) return null;
  const idx = RARITY_ORDER.indexOf(rarity);
  if (idx < 0 || idx >= RARITY_ORDER.length - 1) return null;
  return RARITY_ORDER[idx + 1];
}

/** True when player does not own the type, or incoming rarity is strictly higher. */
export function canAcquireBossRelic(
  ownedRarity: string | undefined | null,
  incomingRarity: string | undefined | null,
): boolean {
  if (!incomingRarity || !isItemRarity(incomingRarity)) return false;
  if (!ownedRarity || !isItemRarity(ownedRarity)) return true;
  return compareBossRelicRarity(incomingRarity, ownedRarity) > 0;
}

/**
 * Resolve pickup outcome for an upgradeable relic given owned vs incoming rarity.
 */
export function resolveBossRelicPickup(
  ownedRarity: string | undefined | null,
  incomingRarity: string | undefined | null,
): BossRelicPickupOutcome {
  if (!incomingRarity || !isItemRarity(incomingRarity)) return 'discard';
  if (!ownedRarity || !isItemRarity(ownedRarity)) return 'new';
  if (compareBossRelicRarity(incomingRarity, ownedRarity) > 0) return 'upgrade';
  return 'discard';
}

export function getBossRelicIconPath(type: string): string | undefined {
  return BOSS_RELIC_ICON_PATHS[type];
}
