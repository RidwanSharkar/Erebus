export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

export const ITEM_RARITY_COLORS: Record<ItemRarity, string> = {
  common: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f97316',
};

export const ITEM_RARITY_RANK: Record<ItemRarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
};

export function compareRarity(a: ItemRarity | undefined, b: ItemRarity | undefined): number {
  const rankA = a && isItemRarity(a) ? ITEM_RARITY_RANK[a] : -1;
  const rankB = b && isItemRarity(b) ? ITEM_RARITY_RANK[b] : -1;
  return rankA - rankB;
}

export function formatRarityLabel(rarity: ItemRarity): string {
  return rarity.toUpperCase();
}

export function isItemRarity(value: string | undefined): value is ItemRarity {
  return value === 'common' || value === 'rare' || value === 'epic' || value === 'legendary';
}
