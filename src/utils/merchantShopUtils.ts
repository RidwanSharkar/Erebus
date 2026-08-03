import type { MerchantPurchaseState, MerchantStockItem } from '@/contexts/MultiplayerContext';
import type { MerchantShopSlotKind } from '@/components/environment/ThroneRoom';
import { StatSystem } from '@/utils/StatSystem';
import { isItemRarity } from '@/utils/itemRarity';
import {
  isSabresWarlordAspect,
  WARLORD_WARPDRIVE_DASH_DISTANCES,
  type WeaponAspect,
} from '@/utils/weaponAspects';

export const MERCHANT_WEAPON_TALENT_MAX = 3;
export const MERCHANT_UTILITY_MAX = 3;
export const MERCHANT_HEAL_COST = 50;
export const MERCHANT_OXYGEN_COST = 300;
export const MERCHANT_WARPDRIVE_COST = 300;
export const MERCHANT_BACKFILL_COST = 1200;

const BASE_MAX_ENERGY = 100;
const OXYGEN_ENERGY_PER_PURCHASE = 20;
const WARPDRIVE_DASH_DISTANCES = [4.125, 4.875, 5.25, 5.825] as const;

export function getOxygenMaxEnergy(purchases: number): number {
  const capped = Math.max(0, Math.min(MERCHANT_UTILITY_MAX, purchases));
  return BASE_MAX_ENERGY + capped * OXYGEN_ENERGY_PER_PURCHASE;
}

export function getWarpdriveDashDistance(
  purchases: number,
  aspect?: WeaponAspect | null,
): number {
  const capped = Math.max(0, Math.min(MERCHANT_UTILITY_MAX, purchases));
  if (isSabresWarlordAspect(aspect)) {
    return WARLORD_WARPDRIVE_DASH_DISTANCES[capped];
  }
  return WARPDRIVE_DASH_DISTANCES[capped];
}

export function getUtilityStock(inventory: MerchantStockItem[]): MerchantStockItem | undefined {
  return inventory.find((entry) => entry.kind === 'oxygen' || entry.kind === 'warpdrive');
}

export function getBackfillStock(
  inventory: MerchantStockItem[],
  slot: 'dash_charge' | 'weapon_talent',
): MerchantStockItem | undefined {
  return inventory.find(
    (entry) => entry.kind === 'boss_drop' && entry.backfillSlot === slot && !entry.sold,
  );
}

/** True when the run-limit for dash charge / weapon talent is exhausted (backfill may appear). */
export function isMerchantBaseSlotSoldOut(
  slot: 'dash_charge' | 'weapon_talent',
  purchaseState: MerchantPurchaseState,
): boolean {
  if (slot === 'dash_charge') return purchaseState.dashChargePurchased;
  return purchaseState.weaponTalentPurchases >= MERCHANT_WEAPON_TALENT_MAX;
}

/**
 * Resolves which stock item a pedestal currently offers:
 * base dash/talent/utility/boss_drop, or premium backfill when the base is sold out for the run.
 */
export function getMerchantSlotStock(
  slot: MerchantShopSlotKind,
  inventory: MerchantStockItem[],
  purchaseState: MerchantPurchaseState,
): MerchantStockItem | undefined {
  if (slot === 'heal') return undefined;
  if (slot === 'utility') return getUtilityStock(inventory);
  if (slot === 'boss_drop') {
    return inventory.find((entry) => entry.kind === 'boss_drop' && !entry.backfillSlot);
  }
  if (slot === 'dash_charge' || slot === 'weapon_talent') {
    if (isMerchantBaseSlotSoldOut(slot, purchaseState)) {
      return getBackfillStock(inventory, slot);
    }
    return inventory.find((entry) => entry.kind === slot);
  }
  return undefined;
}

export function isMerchantSlotTaken(
  slot: MerchantShopSlotKind,
  inventory: MerchantStockItem[],
  purchaseState: MerchantPurchaseState,
): boolean {
  switch (slot) {
    case 'dash_charge':
      if (!purchaseState.dashChargePurchased) return false;
      if (purchaseState.backfillDashPurchasedThisVisit) return true;
      return !getBackfillStock(inventory, 'dash_charge');
    case 'weapon_talent':
      if (purchaseState.weaponTalentPurchases >= MERCHANT_WEAPON_TALENT_MAX) {
        if (purchaseState.backfillTalentPurchasedThisVisit) return true;
        return !getBackfillStock(inventory, 'weapon_talent');
      }
      return purchaseState.weaponTalentPurchasedThisVisit;
    case 'heal':
      return purchaseState.healPurchasedThisVisit;
    case 'utility': {
      const entry = getUtilityStock(inventory);
      if (!entry) return true;
      if (purchaseState.utilityPurchasedThisVisit) return true;
      if (entry.kind === 'oxygen') {
        return purchaseState.oxygenPurchases >= MERCHANT_UTILITY_MAX;
      }
      return purchaseState.warpdrivePurchases >= MERCHANT_UTILITY_MAX;
    }
    case 'boss_drop': {
      const entry = inventory.find((s) => s.kind === 'boss_drop' && !s.backfillSlot);
      return !!entry?.sold || !entry;
    }
    default:
      return false;
  }
}

export function getStockForSlot(
  slot: MerchantShopSlotKind,
  inventory: MerchantStockItem[],
  purchaseState?: MerchantPurchaseState,
): MerchantStockItem | undefined {
  if (purchaseState) {
    return getMerchantSlotStock(slot, inventory, purchaseState);
  }
  if (slot === 'utility') return getUtilityStock(inventory);
  if (slot === 'boss_drop') return inventory.find((entry) => entry.kind === 'boss_drop' && !entry.backfillSlot);
  if (slot === 'heal') return undefined;
  return inventory.find((entry) => entry.kind === slot);
}

export interface MerchantShopTooltipData {
  name: string;
  cost: number;
  description: string;
  limitLabel?: string;
}

function getBossDropTooltip(entry: MerchantStockItem): MerchantShopTooltipData {
  const item = entry.item;
  const label = item?.label ?? entry.label ?? 'Mystery Item';
  const stat = item?.stat;
  const statBonus = item?.statBonus;
  const rarity = item?.rarity;
  const statName = stat ? StatSystem.getStatDisplayName(stat) : 'Stats';
  const rarityLabel = rarity && isItemRarity(rarity) ? ` (${rarity})` : '';
  const description =
    entry.description
    ?? (statBonus != null && stat
      ? `Grants +${statBonus} ${statName}${rarityLabel}.`
      : 'A powerful relic from a fallen boss.');
  return {
    name: label,
    cost: entry.cost,
    description,
  };
}

export function getMerchantShopTooltipData(
  slot: MerchantShopSlotKind,
  inventory: MerchantStockItem[],
  purchaseState: MerchantPurchaseState,
  aspect?: WeaponAspect | null,
): MerchantShopTooltipData | null {
  switch (slot) {
    case 'dash_charge': {
      if (isMerchantSlotTaken('dash_charge', inventory, purchaseState)) return null;
      if (isMerchantBaseSlotSoldOut('dash_charge', purchaseState)) {
        const backfill = getBackfillStock(inventory, 'dash_charge');
        if (!backfill) return null;
        return getBossDropTooltip(backfill);
      }
      const entry = inventory.find((item) => item.kind === 'dash_charge');
      return {
        name: entry?.label ?? 'Dash Charge',
        cost: entry?.cost ?? 1000,
        description: entry?.description ?? 'Adds a 4th dash charge for the run.',
      };
    }
    case 'weapon_talent': {
      if (isMerchantSlotTaken('weapon_talent', inventory, purchaseState)) return null;
      if (isMerchantBaseSlotSoldOut('weapon_talent', purchaseState)) {
        const backfill = getBackfillStock(inventory, 'weapon_talent');
        if (!backfill) return null;
        return getBossDropTooltip(backfill);
      }
      const entry = inventory.find((item) => item.kind === 'weapon_talent');
      return {
        name: entry?.label ?? 'Class Talent',
        cost: entry?.cost ?? 600,
        description: entry?.description ?? 'Grants a random unowned class talent from your weapon.',
      };
    }
    case 'heal':
      if (isMerchantSlotTaken('heal', inventory, purchaseState)) return null;
      return {
        name: 'Heart Heal',
        cost: MERCHANT_HEAL_COST,
        description: 'Restores 125 HP instantly.',
      };
    case 'boss_drop': {
      const entry = inventory.find((item) => item.kind === 'boss_drop' && !item.backfillSlot);
      if (!entry || entry.sold) return null;
      return getBossDropTooltip(entry);
    }
    case 'utility': {
      const entry = getUtilityStock(inventory);
      if (!entry || isMerchantSlotTaken('utility', inventory, purchaseState)) return null;
      const purchases =
        entry.kind === 'oxygen'
          ? purchaseState.oxygenPurchases
          : purchaseState.warpdrivePurchases;
      const nextEnergy = getOxygenMaxEnergy(purchases + 1);
      const nextDash = getWarpdriveDashDistance(purchases + 1, aspect);
      const description =
        entry.kind === 'oxygen'
          ? entry.description ?? `Increases max Energy to ${nextEnergy} (+20 per purchase, max 160).`
          : entry.description ?? `Increases dash distance to ${nextDash.toFixed(3)} (+0.375 per purchase).`;
      return {
        name: entry.label ?? (entry.kind === 'oxygen' ? 'Oxygen' : 'Hydrogen'),
        cost: entry.cost,
        description,
      };
    }
    default:
      return null;
  }
}
