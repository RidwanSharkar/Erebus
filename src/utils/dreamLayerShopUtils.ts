import type { DreamLayerPurchaseState, DreamLayerStockItem } from '@/contexts/MultiplayerContext';
import type { DreamLayerShopSlotKind } from '@/components/environment/ThroneRoom';
import { formatRarityLabel, isItemRarity } from '@/utils/itemRarity';

export const DREAM_LAYER_HEAL_COST = 20;
export const DREAM_LAYER_HEAL_AMOUNT = 200;

export function getDreamLayerStockForSlot(
  slot: DreamLayerShopSlotKind,
  inventory: DreamLayerStockItem[],
): DreamLayerStockItem | undefined {
  if (slot === 'heal') return undefined;
  return inventory.find((entry) => entry.kind === slot);
}

export function getDreamLayerShopStockId(
  slot: DreamLayerShopSlotKind,
  inventory: DreamLayerStockItem[],
): string | null {
  if (slot === 'heal') return null;
  return getDreamLayerStockForSlot(slot, inventory)?.id ?? null;
}

export function isDreamLayerSlotTaken(
  slot: DreamLayerShopSlotKind,
  inventory: DreamLayerStockItem[],
  purchaseState: DreamLayerPurchaseState,
): boolean {
  switch (slot) {
    case 'heal':
      return purchaseState.healPurchasedThisVisit;
    case 'warding_pendant':
      return purchaseState.wardingPurchasedThisVisit || !!getDreamLayerStockForSlot(slot, inventory)?.sold;
    case 'exodia':
      return purchaseState.exodiaPurchasedThisVisit || !!getDreamLayerStockForSlot(slot, inventory)?.sold;
    case 'ring':
      return purchaseState.ringPurchasedThisVisit || !!getDreamLayerStockForSlot(slot, inventory)?.sold;
    default:
      return false;
  }
}

export interface DreamLayerShopTooltipData {
  name: string;
  cost: number;
  description: string;
}

export function getDreamLayerShopTooltipData(
  slot: DreamLayerShopSlotKind,
  inventory: DreamLayerStockItem[],
  purchaseState: DreamLayerPurchaseState,
): DreamLayerShopTooltipData | null {
  if (isDreamLayerSlotTaken(slot, inventory, purchaseState)) return null;

  if (slot === 'heal') {
    return {
      name: 'Heart Heal',
      cost: DREAM_LAYER_HEAL_COST,
      description: `Restores ${DREAM_LAYER_HEAL_AMOUNT} HP instantly.`,
    };
  }

  const entry = getDreamLayerStockForSlot(slot, inventory);
  if (!entry || entry.sold) return null;

  const label = entry.label ?? entry.item?.label ?? 'Mystery Item';
  const rarity = entry.item?.rarity;
  const rarityLabel = rarity && isItemRarity(rarity) ? ` (${formatRarityLabel(rarity)})` : '';

  return {
    name: label,
    cost: entry.cost,
    description: entry.description ?? `Architect wares${rarityLabel}.`,
  };
}

export function getDreamLayerShopHintLabel(
  slot: DreamLayerShopSlotKind,
  inventory: DreamLayerStockItem[],
): string {
  if (slot === 'heal') {
    return `Heart Heal — ${DREAM_LAYER_HEAL_COST} FLOW`;
  }
  const entry = getDreamLayerStockForSlot(slot, inventory);
  const label = entry?.label ?? entry?.item?.label ?? 'Mystery Item';
  return `${label} — ${entry?.cost ?? '?'} FLOW`;
}
