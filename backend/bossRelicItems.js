/** Upgradeable boss-stat relics (server-side mirror of src/utils/bossRelicItems.ts). */

const UPGRADEABLE_BOSS_RELIC_TYPES = Object.freeze([
  'MANA_SHIELD',
  'COLOSSUS_LUNGS',
  'REAPER_CLAWS',
  'TITAN_HEART',
]);

const BOSS_RELIC_ICON_PATHS = Object.freeze({
  MANA_SHIELD: '/icons/items/manaShield.svg',
  COLOSSUS_LUNGS: '/icons/items/colossusLungs.svg',
  REAPER_CLAWS: '/icons/items/reaperClaws.svg',
  TITAN_HEART: '/icons/items/titanHeart.svg',
});

const RARITY_ORDER = Object.freeze(['common', 'rare', 'epic', 'legendary']);

const RARITY_RANK = Object.freeze({
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
});

function isUpgradeableBossRelic(type) {
  return UPGRADEABLE_BOSS_RELIC_TYPES.includes(type);
}

function isBossRelicRarity(value) {
  return value === 'common' || value === 'rare' || value === 'epic' || value === 'legendary';
}

function compareBossRelicRarity(a, b) {
  const rankA = isBossRelicRarity(a) ? RARITY_RANK[a] : -1;
  const rankB = isBossRelicRarity(b) ? RARITY_RANK[b] : -1;
  return rankA - rankB;
}

function nextRarity(rarity) {
  if (!isBossRelicRarity(rarity)) return null;
  const idx = RARITY_ORDER.indexOf(rarity);
  if (idx < 0 || idx >= RARITY_ORDER.length - 1) return null;
  return RARITY_ORDER[idx + 1];
}

/** True when player does not own the type, or incoming rarity is strictly higher. */
function canAcquireBossRelic(ownedRarity, incomingRarity) {
  if (!isBossRelicRarity(incomingRarity)) return false;
  if (ownedRarity == null || !isBossRelicRarity(ownedRarity)) return true;
  return compareBossRelicRarity(incomingRarity, ownedRarity) > 0;
}

/**
 * Resolve pickup outcome for an upgradeable relic.
 * @returns {'new' | 'upgrade' | 'discard'}
 */
function resolveBossRelicPickup(ownedRarity, incomingRarity) {
  if (!isBossRelicRarity(incomingRarity)) return 'discard';
  if (ownedRarity == null || !isBossRelicRarity(ownedRarity)) return 'new';
  if (compareBossRelicRarity(incomingRarity, ownedRarity) > 0) return 'upgrade';
  return 'discard';
}

module.exports = {
  UPGRADEABLE_BOSS_RELIC_TYPES,
  BOSS_RELIC_ICON_PATHS,
  RARITY_ORDER,
  RARITY_RANK,
  isUpgradeableBossRelic,
  isBossRelicRarity,
  compareBossRelicRarity,
  nextRarity,
  canAcquireBossRelic,
  resolveBossRelicPickup,
};
