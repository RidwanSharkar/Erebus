/** Dream Layer item constants (server-side mirror of src/utils/dreamLayerItems.ts). */

const EXODIA_ARMOR_TYPES = Object.freeze([
  'EXODIA_HELM',
  'EXODIA_PAULDRONS',
  'EXODIA_PLATE',
  'EXODIA_GREAVES',
  'EXODIA_GAUNTLETS',
]);

const DREAM_LAYER_UNIQUE_TYPES = Object.freeze([
  ...EXODIA_ARMOR_TYPES,
  'ARCHMAGE_COIL',
  'PERSEPHONE',
  'WYVERN_AMETHYST',
  'INFINITE_AMBER',
  'LIQUID_SAPPHIRE',
  'JAGUAR_EMERALD',
  'RAZED_DIAMOND',
]);

const MERCHANT_EXODIA_POOL = Object.freeze([
  ...EXODIA_ARMOR_TYPES,
  'ARCHMAGE_COIL',
]);

const DREAM_LAYER_ITEM_DESCRIPTIONS = Object.freeze({
  EXODIA_HELM: 'Kaiser: Critical hits spawn a pillar of fire (195 dmg + Ignite). 2.5s ICD.',
  EXODIA_PAULDRONS: 'Scorpion Lance: After dash charge spent, next primary within 2s fires piercing shard (40+4×AGI). 1.5s ICD.',
  EXODIA_PLATE: 'Hatemail Vest: Taking damage returns 300% of the damage back to the attacker.',
  EXODIA_GREAVES: 'Sleepwalker: Enemies drop double FLOW (2/6/15 shards).',
  EXODIA_GAUNTLETS: 'Vicegrip: +10% +1%/STR primary damage vs enemies below 50% HP (cap +50%).',
  ARCHMAGE_COIL: 'Arcane Reservoir: Dash charge spent restores 20 Energy. Cannot stack with Exodia Helm.',
  PERSEPHONE: 'Death Goddess: Next fatal blow sets you to 90% HP and consumes the ring.',
  WYVERN_AMETHYST: 'Leviathan Scales: Venom applies Needler stacks; at 4 stacks burst 70+4×INT.',
  INFINITE_AMBER: "Enchanter's Gift: +40% Energy recovery rate.",
  LIQUID_SAPPHIRE: 'Cold Grace: Primary on frozen enemy shatters for +350 damage.',
  JAGUAR_EMERALD: 'Trial by Fire: Red venom theme; +30% crit vs venomed on primary attacks.',
  RAZED_DIAMOND: 'Bloodrose Ember: Q abilities deal up to +250% damage based on missing HP.',
});

const DREAM_LAYER_ITEM_LABELS = Object.freeze({
  EXODIA_HELM: 'Exodia Helm',
  EXODIA_PAULDRONS: 'Exodia Pauldrons',
  EXODIA_PLATE: 'Exodia Plate',
  EXODIA_GREAVES: 'Exodia Greaves',
  EXODIA_GAUNTLETS: 'Exodia Gauntlets',
  ARCHMAGE_COIL: 'Archmage Coil',
  PERSEPHONE: 'Persephone',
  WYVERN_AMETHYST: 'Wyvern Amethyst',
  INFINITE_AMBER: 'Infinite Amber',
  LIQUID_SAPPHIRE: 'Liquid Sapphire',
  JAGUAR_EMERALD: 'Jaguar Emerald',
  RAZED_DIAMOND: 'Razed Diamond',
});

const PERSEPHONE_SAVE_HP_FRACTION = 0.9;

function isUniqueDreamLayerItem(type) {
  return DREAM_LAYER_UNIQUE_TYPES.includes(type);
}

function getDreamLayerItemDescription(type) {
  return DREAM_LAYER_ITEM_DESCRIPTIONS[type] || 'A legendary relic from the Dream Layer.';
}

function getDreamLayerItemLabel(type) {
  return DREAM_LAYER_ITEM_LABELS[type] || type;
}

function countExodiaPieces(ownedSet) {
  if (!ownedSet || typeof ownedSet.has !== 'function') return 0;
  let n = 0;
  for (const t of EXODIA_ARMOR_TYPES) {
    if (ownedSet.has(t)) n++;
  }
  return n;
}

function ensurePlayerOwnedItems(player) {
  if (!player) return;
  if (!player.ownedUniqueItemTypes) {
    player.ownedUniqueItemTypes = new Set();
  }
}

function playerOwnsItem(player, type) {
  ensurePlayerOwnedItems(player);
  return player.ownedUniqueItemTypes.has(type);
}

function registerPlayerOwnedItem(player, type) {
  ensurePlayerOwnedItems(player);
  if (isUniqueDreamLayerItem(type)) {
    player.ownedUniqueItemTypes.add(type);
  }
  if (type === 'PERSEPHONE') {
    player.hasPersephone = true;
    player.persephoneConsumed = false;
  }
  player.exodiaSetCount = countExodiaPieces(player.ownedUniqueItemTypes);
}

function getMerchantExodiaOfferChance(bossesDefeated, segmentRoomsCleared) {
  const depth = (bossesDefeated || 0) + Math.floor((segmentRoomsCleared || 0) / 3);
  const base = 0.08;
  const scaled = Math.min(0.45, base + depth * 0.04);
  return scaled;
}

function rollMerchantExodiaCost() {
  return 800 + Math.floor(Math.random() * 401);
}

module.exports = {
  EXODIA_ARMOR_TYPES,
  DREAM_LAYER_UNIQUE_TYPES,
  MERCHANT_EXODIA_POOL,
  DREAM_LAYER_ITEM_DESCRIPTIONS,
  DREAM_LAYER_ITEM_LABELS,
  PERSEPHONE_SAVE_HP_FRACTION,
  isUniqueDreamLayerItem,
  getDreamLayerItemDescription,
  getDreamLayerItemLabel,
  countExodiaPieces,
  ensurePlayerOwnedItems,
  playerOwnsItem,
  registerPlayerOwnedItem,
  getMerchantExodiaOfferChance,
  rollMerchantExodiaCost,
};
