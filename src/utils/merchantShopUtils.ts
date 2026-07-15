import type { MerchantPurchaseState, MerchantStockItem } from '@/contexts/MultiplayerContext';
import type { MerchantShopSlotKind } from '@/components/environment/ThroneRoom';
import { StatSystem } from '@/utils/StatSystem';
import { isItemRarity } from '@/utils/itemRarity';

export const MERCHANT_WEAPON_TALENT_MAX = 3;
export const MERCHANT_UTILITY_MAX = 3;
export const MERCHANT_HEAL_COST = 50;
export const MERCHANT_OXYGEN_COST = 300;
export const MERCHANT_WARPDRIVE_COST = 300;

const BASE_MAX_ENERGY = 100;
const OXYGEN_ENERGY_PER_PURCHASE = 20;
const WARPDRIVE_DASH_DISTANCES = [4.125, 4.5, 4.875, 5.125] as const;

export function getOxygenMaxEnergy(purchases: number): number {
  const capped = Math.max(0, Math.min(MERCHANT_UTILITY_MAX, purchases));
  return BASE_MAX_ENERGY + capped * OXYGEN_ENERGY_PER_PURCHASE;
}

export function getWarpdriveDashDistance(purchases: number): number {
  const capped = Math.max(0, Math.min(MERCHANT_UTILITY_MAX, purchases));
  return WARPDRIVE_DASH_DISTANCES[capped];
}

export function getUtilityStock(inventory: MerchantStockItem[]): MerchantStockItem | undefined {
  return inventory.find((entry) => entry.kind === 'oxygen' || entry.kind === 'warpdrive');
}

export function getStockForSlot(
  slot: MerchantShopSlotKind,
  inventory: MerchantStockItem[],
): MerchantStockItem | undefined {
  if (slot === 'utility') return getUtilityStock(inventory);
  if (slot === 'boss_drop') return inventory.find((entry) => entry.kind === 'boss_drop');
  if (slot === 'heal') return undefined;
  return inventory.find((entry) => entry.kind === slot);
}

export interface MerchantShopTooltipData {
  name: string;
  cost: number;
  description: string;
  limitLabel?: string;
}

export function getMerchantShopTooltipData(
  slot: MerchantShopSlotKind,
  inventory: MerchantStockItem[],
  purchaseState: MerchantPurchaseState,
): MerchantShopTooltipData | null {
  switch (slot) {
    case 'dash_charge': {
      const entry = inventory.find((item) => item.kind === 'dash_charge');
      return {
        name: entry?.label ?? 'Dash Charge',
        cost: entry?.cost ?? 1000,
        description: entry?.description ?? 'Adds a 4th dash charge for the run.',
      };
    }
    case 'weapon_talent': {
      const entry = inventory.find((item) => item.kind === 'weapon_talent');
      const purchases = purchaseState.weaponTalentPurchases;
      return {
        name: entry?.label ?? 'Class Talent',
        cost: entry?.cost ?? 600,
        description: entry?.description ?? 'Grants a random unowned class talent from your weapon.',
        limitLabel: purchases > 0 ? `${purchases}/${MERCHANT_WEAPON_TALENT_MAX} purchased` : undefined,
      };
    }
    case 'heal':
      return {
        name: 'Heart Heal',
        cost: MERCHANT_HEAL_COST,
        description: 'Restores 125 HP instantly.',
      };
    case 'boss_drop': {
      const entry = inventory.find((item) => item.kind === 'boss_drop');
      if (!entry || entry.sold) return null;
      const item = entry.item;
      const label = item?.label ?? entry.label ?? 'Mystery Item';
      const stat = item?.stat;
      const statBonus = item?.statBonus;
      const rarity = item?.rarity;
      const statName = stat ? StatSystem.getStatDisplayName(stat) : 'Stats';
      const rarityLabel = rarity && isItemRarity(rarity) ? ` (${rarity})` : '';
      const description =
        statBonus != null && stat
          ? `Grants +${statBonus} ${statName}${rarityLabel}.`
          : 'A powerful relic from a fallen boss.';
      return {
        name: label,
        cost: entry.cost,
        description,
      };
    }
    case 'utility': {
      const entry = getUtilityStock(inventory);
      if (!entry) return null;
      const purchases =
        entry.kind === 'oxygen'
          ? purchaseState.oxygenPurchases
          : purchaseState.warpdrivePurchases;
      if (purchases >= MERCHANT_UTILITY_MAX) return null;
      const nextEnergy = getOxygenMaxEnergy(purchases + 1);
      const nextDash = getWarpdriveDashDistance(purchases + 1);
      const description =
        entry.kind === 'oxygen'
          ? entry.description ?? `Increases max Energy to ${nextEnergy} (+20 per purchase, max 160).`
          : entry.description ?? `Increases dash distance to ${nextDash.toFixed(3)} (+0.375 per purchase).`;
      return {
        name: entry.label ?? (entry.kind === 'oxygen' ? 'Oxygen' : 'Warpdrive'),
        cost: entry.cost,
        description,
        limitLabel: purchases > 0 ? `${purchases}/${MERCHANT_UTILITY_MAX} purchased` : undefined,
      };
    }
    default:
      return null;
  }
}
