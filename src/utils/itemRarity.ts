export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

export const ITEM_RARITY_COLORS: Record<ItemRarity, string> = {
  common: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f97316',
};

export function formatRarityLabel(rarity: ItemRarity): string {
  return rarity.toUpperCase();
}

export function isItemRarity(value: string | undefined): value is ItemRarity {
  return value === 'common' || value === 'rare' || value === 'epic' || value === 'legendary';
}
