/**
 * Dream Layer build-defining items: Exodia armor set, rings, and Archmage Coil.
 * Passive effects are checked via `hasOwnedItem` / inventory helpers in combat systems.
 */

import type { InventoryItem } from '@/contexts/MultiplayerContext';
import { INFERNAL_DASH_DAMAGE } from '@/utils/talents';

// ── Item type constants ──────────────────────────────────────────────────────

export const EXODIA_HELM = 'EXODIA_HELM';
export const EXODIA_PAULDRONS = 'EXODIA_PAULDRONS';
export const EXODIA_PLATE = 'EXODIA_PLATE';
export const EXODIA_GREAVES = 'EXODIA_GREAVES';
export const EXODIA_GAUNTLETS = 'EXODIA_GAUNTLETS';
export const ARCHMAGE_COIL = 'ARCHMAGE_COIL';

export const PERSEPHONE = 'PERSEPHONE';
export const WYVERN_AMETHYST = 'WYVERN_AMETHYST';
export const INFINITE_AMBER = 'INFINITE_AMBER';
export const LIQUID_SAPPHIRE = 'LIQUID_SAPPHIRE';
export const JAGUAR_EMERALD = 'JAGUAR_EMERALD';
export const RAZED_DIAMOND = 'RAZED_DIAMOND';

export const EXODIA_ARMOR_TYPES = Object.freeze([
  EXODIA_HELM,
  EXODIA_PAULDRONS,
  EXODIA_PLATE,
  EXODIA_GREAVES,
  EXODIA_GAUNTLETS,
]);

export const DREAM_LAYER_UNIQUE_TYPES = Object.freeze([
  ...EXODIA_ARMOR_TYPES,
  ARCHMAGE_COIL,
  PERSEPHONE,
  WYVERN_AMETHYST,
  INFINITE_AMBER,
  LIQUID_SAPPHIRE,
  JAGUAR_EMERALD,
  RAZED_DIAMOND,
]);

export const MERCHANT_EXODIA_POOL_TYPES = Object.freeze([
  ...EXODIA_ARMOR_TYPES,
  ARCHMAGE_COIL,
]);

// ── Effect constants ─────────────────────────────────────────────────────────

export const KAISER_ICD_SEC = 2.5;
export const KAISER_PILLAR_DAMAGE = INFERNAL_DASH_DAMAGE;

export const SCORPION_SHARD_BASE_DAMAGE = 40;
export const SCORPION_SHARD_AGI_PER_POINT = 4;
export const SCORPION_SHARD_RANGE = 7;
export const SCORPION_LANCE_WINDOW_SEC = 2;
export const SCORPION_LANCE_ICD_SEC = 1.5;

export const ARCHMAGE_COIL_ENERGY_RESTORE = 20;

export const VICEGRIP_BASE_BONUS = 0.1;
export const VICEGRIP_STR_PER_POINT = 0.01;
export const VICEGRIP_MAX_BONUS = 0.5;
export const VICEGRIP_HP_THRESHOLD = 0.5;

export const COLD_GRACE_SHATTER_DAMAGE = 350;

export const JAGUAR_CRIT_VS_VENOMED = 0.3;

export const BLOODROSE_MAX_EXTRA_MULT = 2.5;

export const NEEDLER_MAX_STACKS = 4;
export const NEEDLER_BURST_BASE = 70;
export const NEEDLER_BURST_INT_PER_POINT = 4;

export const INFINITE_AMBER_ENERGY_REGEN_MULT = 1.4;

export const EXODIA_SET_2_STAMINA = 10;
export const EXODIA_SET_3_MAX_ENERGY = 30;
export const EXODIA_SET_4_STR = 10;
export const EXODIA_SET_4_INT = 10;

export const PERSEPHONE_SAVE_HP_FRACTION = 0.9;

// ── Primary attack damage types ──────────────────────────────────────────────

export const PRIMARY_ATTACK_DAMAGE_TYPES = new Set<string>([
  'projectile',
  'burst_arrow',
  'entropic',
  'icebeam',
  'sword',
  'runeblade_combo',
  'sabre_left',
  'sabre_right',
]);

export const Q_ABILITY_DAMAGE_TYPES = new Set<string>([
  'backstab',
  'wraith_strike',
  'barrage',
  'entropic', // mantra totem bolts
]);

// ── Item metadata (descriptions for tooltips / shop) ─────────────────────────

export interface DreamLayerItemMeta {
  type: string;
  label: string;
  passiveName: string;
  description: string;
  iconPath: string;
}

export const DREAM_LAYER_ITEM_META: Record<string, DreamLayerItemMeta> = {
  [EXODIA_HELM]: {
    type: EXODIA_HELM,
    label: 'Exodia Helm',
    passiveName: 'Kaiser',
    description:
      'Critical hits spawn a pillar of fire on the target, dealing 195 damage and inflicting Ignite (2.5s ICD).',
    iconPath: '/icons/items/exodiaHelm.svg',
  },
  [EXODIA_PAULDRONS]: {
    type: EXODIA_PAULDRONS,
    label: 'Exodia Pauldrons',
    passiveName: 'Scorpion Lance',
    description:
      'After expending a dash charge, your next primary attack within 2s fires a piercing shard (40 + 4×AGI dmg, 7u range). 1.5s ICD.',
    iconPath: '/icons/items/exodiaPauldrons.svg',
  },
  [EXODIA_PLATE]: {
    type: EXODIA_PLATE,
    label: 'Exodia Plate',
    passiveName: 'Hatemail Vest',
    description: 'Taking any damage returns 300% of it to the attacker.',
    iconPath: '/icons/items/exodiaPlate.svg',
  },
  [EXODIA_GREAVES]: {
    type: EXODIA_GREAVES,
    label: 'Exodia Greaves',
    passiveName: 'Sleepwalker',
    description:
      'Enemies drop twice the FLOW (2 shards normal, 6 titan/nemesis/valkyrie, 15 bosses).',
    iconPath: '/icons/items/exodiaGreaves.svg',
  },
  [EXODIA_GAUNTLETS]: {
    type: EXODIA_GAUNTLETS,
    label: 'Exodia Gauntlets',
    passiveName: 'Vicegrip',
    description:
      'Primary attacks vs enemies below 50% HP deal +10% + 1% per STR (cap +50%).',
    iconPath: '/icons/items/exodiaGauntlet.svg',
  },
  [ARCHMAGE_COIL]: {
    type: ARCHMAGE_COIL,
    label: 'Archmage Coil',
    passiveName: 'Arcane Reservoir',
    description:
      'Expending a dash charge restores 20 Energy. Cannot stack with Exodia Helm.',
    iconPath: '/icons/items/archmageCoil.svg',
  },
  [PERSEPHONE]: {
    type: PERSEPHONE,
    label: 'Persephone',
    passiveName: 'Death Goddess',
    description:
      'The next fatal blow sets you to 90% HP and consumes the ring. Regenerated by Immortal Union (5pc Exodia).',
    iconPath: '/icons/items/persephone.svg',
  },
  [WYVERN_AMETHYST]: {
    type: WYVERN_AMETHYST,
    label: 'Wyvern Amethyst',
    passiveName: 'Leviathan Scales',
    description:
      'Venom applications also apply 1 Needler stack (max 4). At 4 stacks: burst 70 + 4×INT magic damage.',
    iconPath: '/icons/items/wyvernAmethyst.svg',
  },
  [INFINITE_AMBER]: {
    type: INFINITE_AMBER,
    label: 'Infinite Amber',
    passiveName: "Enchanter's Gift",
    description: 'Increases Energy recovery rate by 40%.',
    iconPath: '/icons/items/infiniteAmber.svg',
  },
  [LIQUID_SAPPHIRE]: {
    type: LIQUID_SAPPHIRE,
    label: 'Liquid Sapphire',
    passiveName: 'Cold Grace',
    description:
      'Primary attacks on frozen enemies consume Freeze to shatter them for +350 bonus damage.',
    iconPath: '/icons/items/liquidSapphire.svg',
  },
  [JAGUAR_EMERALD]: {
    type: JAGUAR_EMERALD,
    label: 'Jaguar Emerald',
    passiveName: 'Trial by Fire',
    description:
      'Venom effects are red-themed. Primary attacks gain +30% crit chance vs venomed enemies.',
    iconPath: '/icons/items/jaguarEmerald.svg',
  },
  [RAZED_DIAMOND]: {
    type: RAZED_DIAMOND,
    label: 'Razed Diamond',
    passiveName: 'Bloodrose Ember',
    description:
      "Q abilities deal increased damage based on missing HP, up to +250%.",
    iconPath: '/icons/items/razedDiamond.svg',
  },
};

export function getDreamLayerItemDescription(type: string): string {
  const meta = DREAM_LAYER_ITEM_META[type];
  if (!meta) return 'A legendary relic from the Dream Layer.';
  return `${meta.passiveName}: ${meta.description}`;
}

export function getDreamLayerItemIconPath(type: string): string | undefined {
  return DREAM_LAYER_ITEM_META[type]?.iconPath;
}

// ── Inventory helpers ────────────────────────────────────────────────────────

export function inventoryToOwnedTypes(inventory: InventoryItem[]): Set<string> {
  return new Set(inventory.map((i) => i.type));
}

export function hasOwnedItem(owned: Set<string> | string[], type: string): boolean {
  if (owned instanceof Set) return owned.has(type);
  return owned.includes(type);
}

export function getExodiaSetCount(inventory: InventoryItem[] | Set<string>): number {
  const types =
    inventory instanceof Set
      ? inventory
      : new Set(inventory.map((i) => i.type));
  let count = 0;
  for (const t of EXODIA_ARMOR_TYPES) {
    if (types.has(t)) count++;
  }
  return count;
}

export function isUniqueDreamLayerItem(type: string): boolean {
  return (DREAM_LAYER_UNIQUE_TYPES as readonly string[]).includes(type);
}

export function getExodiaSetStatBonuses(exodiaCount: number): {
  stamina: number;
  strength: number;
  intellect: number;
  maxEnergy: number;
} {
  return {
    stamina: exodiaCount >= 2 ? EXODIA_SET_2_STAMINA : 0,
    strength: exodiaCount >= 4 ? EXODIA_SET_4_STR : 0,
    intellect: exodiaCount >= 4 ? EXODIA_SET_4_INT : 0,
    maxEnergy: exodiaCount >= 3 ? EXODIA_SET_3_MAX_ENERGY : 0,
  };
}

export function hasImmortalUnion(exodiaCount: number): boolean {
  return exodiaCount >= 5;
}

// ── Effect formulas ──────────────────────────────────────────────────────────

export function getVicegripDamageMultiplier(effectiveStrength: number): number {
  const bonus = Math.min(
    VICEGRIP_MAX_BONUS,
    VICEGRIP_BASE_BONUS + VICEGRIP_STR_PER_POINT * Math.max(0, effectiveStrength),
  );
  return 1 + bonus;
}

export function getBloodroseQDamageMultiplier(currentHealth: number, maxHealth: number): number {
  if (maxHealth <= 0) return 1;
  const hpFrac = Math.max(0, Math.min(1, currentHealth / maxHealth));
  const missingFrac = 1 - hpFrac;
  return 1 + BLOODROSE_MAX_EXTRA_MULT * missingFrac;
}

export function getScorpionShardDamage(effectiveAgility: number): number {
  return SCORPION_SHARD_BASE_DAMAGE + SCORPION_SHARD_AGI_PER_POINT * Math.max(0, effectiveAgility);
}

export function getWyvernNeedlerBurstDamage(effectiveIntellect: number): number {
  return NEEDLER_BURST_BASE + NEEDLER_BURST_INT_PER_POINT * Math.max(0, effectiveIntellect);
}

export function isPrimaryAttackDamageType(damageType?: string | null): boolean {
  return !!damageType && PRIMARY_ATTACK_DAMAGE_TYPES.has(damageType);
}

export function isQAbilityDamageType(damageType?: string | null): boolean {
  return !!damageType && Q_ABILITY_DAMAGE_TYPES.has(damageType);
}

export function isEnemyVenomed(enemy: {
  isVenomous?: boolean;
  concentratedVenomStacks?: number;
} | null | undefined): boolean {
  if (!enemy) return false;
  return !!enemy.isVenomous || (enemy.concentratedVenomStacks ?? 0) > 0;
}

/** Dream shard counts when Sleepwalker (Exodia Greaves) is owned. */
export function getSleepwalkerDreamShardCount(enemyType?: string | null): number {
  if (!enemyType || enemyType === 'training-dummy') return 0;
  if (enemyType === 'titan' || enemyType === 'nemesis' || enemyType === 'valkyrie') return 6;
  if (enemyType === 'boss' || enemyType === 'boss2' || enemyType === 'boss3') return 15;
  return 2;
}

export function getDefaultDreamShardCount(enemyType?: string | null): number {
  if (!enemyType || enemyType === 'training-dummy') return 0;
  if (enemyType === 'titan' || enemyType === 'nemesis') return 3;
  if (enemyType === 'boss' || enemyType === 'boss2' || enemyType === 'boss3') return 5;
  return 1;
}

/** Global flag for red venom theming (Jaguar Emerald). Set from CoopGameScene. */
let jaguarEmeraldOwnedGlobal = false;

export function setJaguarEmeraldOwnedGlobal(owned: boolean): void {
  jaguarEmeraldOwnedGlobal = owned;
}

export function isJaguarEmeraldVenomThemed(): boolean {
  return jaguarEmeraldOwnedGlobal;
}
