/**
 * Dream Layer build-defining items: Exodia armor set, Hexmetal set, Archmage set, and rings.
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
export const ARCHMAGE_BELT = 'ARCHMAGE_BELT';

export const HEXMETAL_CLOAK = 'HEXMETAL_CLOAK';
export const HEXMETAL_LEGGINGS = 'HEXMETAL_LEGGINGS';
export const HEXMETAL_VAMBRACES = 'HEXMETAL_VAMBRACES';

export const PERSEPHONE = 'PERSEPHONE';
export const WYVERN_AMETHYST = 'WYVERN_AMETHYST';
export const INFINITE_AMBER = 'INFINITE_AMBER';
export const LIQUID_SAPPHIRE = 'LIQUID_SAPPHIRE';
export const JAGUAR_EMERALD = 'JAGUAR_EMERALD';
export const RAZED_DIAMOND = 'RAZED_DIAMOND';

export const HUNTERS_MARK = 'HUNTERS_MARK';
export const SOUL_WARD = 'SOUL_WARD';

export const EXODIA_ARMOR_TYPES = Object.freeze([
  EXODIA_HELM,
  EXODIA_PAULDRONS,
  EXODIA_PLATE,
  EXODIA_GREAVES,
  EXODIA_GAUNTLETS,
]);

export const HEXMETAL_SET_TYPES = Object.freeze([
  HEXMETAL_CLOAK,
  HEXMETAL_LEGGINGS,
  HEXMETAL_VAMBRACES,
]);

export const ARCHMAGE_SET_TYPES = Object.freeze([
  ARCHMAGE_COIL,
  ARCHMAGE_BELT,
]);

export const DREAM_LAYER_UNIQUE_TYPES = Object.freeze([
  ...EXODIA_ARMOR_TYPES,
  ...HEXMETAL_SET_TYPES,
  ARCHMAGE_COIL,
  ARCHMAGE_BELT,
  PERSEPHONE,
  WYVERN_AMETHYST,
  INFINITE_AMBER,
  LIQUID_SAPPHIRE,
  JAGUAR_EMERALD,
  RAZED_DIAMOND,
]);

/** Effect pendants from the warding-pendant slot (not boss/enemy ground drops). */
export const EFFECT_PENDANT_TYPES = Object.freeze([
  HUNTERS_MARK,
  SOUL_WARD,
]);

export const MERCHANT_EXODIA_POOL_TYPES = Object.freeze([
  ...EXODIA_ARMOR_TYPES,
  ...HEXMETAL_SET_TYPES,
  ARCHMAGE_COIL,
  ARCHMAGE_BELT,
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

/** Hexmetal Cloak — no single source of damage can exceed this amount. */
export const HEXMETAL_DAMAGE_CAP = 50;
/** Hexmetal Leggings — attack-slow multiplier (default is 0.5 = 50% slow). */
export const HEXMETAL_ATTACK_SLOW_MULT = 0.75;
/** Hexmetal 2pc — walk speed while not sprinting. */
export const HEXMETAL_SET_2_WALK_SPEED = 4.125;
/** Hexmetal 3pc — bonus dash charges. */
export const HEXMETAL_SET_3_BONUS_DASH_CHARGES = 1;
/** Archmage 2pc — intellect bonus. */
export const ARCHMAGE_SET_2_INT = 15;

/** Vicegrip (Exodia Gauntlets) — flat base damage on Sabres left/right swings. */
export const VICEGRIP_SABRE_FLAT_BONUS = 20;
/** Vicegrip — flat base damage on each Runeblade LMB combo hit (all 3 steps). */
export const VICEGRIP_RUNEBLADE_COMBO_FLAT_BONUS = 50;

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
/** 5-piece Exodia set bonus — stacks on top of the 2pc stamina tier. */
export const EXODIA_SET_5_STAMINA = 100;

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
      'Sabres left/right swings gain +20 damage. Runeblade combo swings gain +50 damage. No effect on Scythe or Bow.',
    iconPath: '/icons/items/exodiaGauntlet.svg',
  },
  [ARCHMAGE_COIL]: {
    type: ARCHMAGE_COIL,
    label: 'Archmage Coil',
    passiveName: 'Arcane Reservoir',
    description:
      'Expending a dash charge restores 20 Energy. Cannot stack with Exodia Helm. 2pc (with Belt): +15 Intellect.',
    iconPath: '/icons/items/archmageCoil.svg',
  },
  [ARCHMAGE_BELT]: {
    type: ARCHMAGE_BELT,
    label: 'Archmage Belt',
    passiveName: 'Quickened Mind',
    description:
      'Reduces Q ability cooldowns (Frostbite 6s, Wraith Strike 3.75s, Mantra 6s, Backstab 2.75s). 2pc (with Coil): +15 Intellect.',
    iconPath: '/icons/items/archmageBelt.svg',
  },
  [HEXMETAL_CLOAK]: {
    type: HEXMETAL_CLOAK,
    label: 'Hexmetal Cloak',
    passiveName: 'Damage Ward',
    description:
      'No single source of damage can exceed 50. 2pc: base walk speed 4.125 (does not stack with sprint). 3pc: +1 dash charge.',
    iconPath: '/icons/items/hexmetalCloak.svg',
  },
  [HEXMETAL_LEGGINGS]: {
    type: HEXMETAL_LEGGINGS,
    label: 'Hexmetal Leggings',
    passiveName: 'Momentum Weave',
    description:
      'Halves movement speed reduction while attacking (Runeblade, Scythe, Bow LMB). 2pc: base walk speed 4.125. 3pc: +1 dash charge.',
    iconPath: '/icons/items/hexmetalLeggings.svg',
  },
  [HEXMETAL_VAMBRACES]: {
    type: HEXMETAL_VAMBRACES,
    label: 'Hexmetal Vambraces',
    passiveName: 'Swift Arms',
    description:
      'Reduces E ability cooldowns (Reaping Talons 5s, Colossus Strike 6s/4.5s Legionnaire, Crossentropy 6s, Flourish 0.75s). 2pc: walk 4.125. 3pc: +1 dash charge.',
    iconPath: '/icons/items/hexmetalVambraces.svg',
  },
  [PERSEPHONE]: {
    type: PERSEPHONE,
    label: 'Persephone',
    passiveName: 'Death Goddess',
    description:
      'The next fatal blow sets you to 90% HP and consumes the ring. Regenerated by Immortal Union (4pc Exodia).',
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
  [HUNTERS_MARK]: {
    type: HUNTERS_MARK,
    label: "Hunter's Mark",
    passiveName: "Hunter's Mark",
    description: 'Your beast companions deal +30 melee damage.',
    iconPath: '/icons/items/huntersMark.svg',
  },
  [SOUL_WARD]: {
    type: SOUL_WARD,
    label: 'Soul Ward',
    passiveName: 'Soul Bond',
    description: 'Negate a hit and deal double the damage to your ally instead. 6s cooldown.',
    iconPath: '/icons/items/soulWard.svg',
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

function countOwnedSetPieces(
  inventory: InventoryItem[] | Set<string>,
  setTypes: readonly string[],
): number {
  const types =
    inventory instanceof Set
      ? inventory
      : new Set(inventory.map((i) => i.type));
  let count = 0;
  for (const t of setTypes) {
    if (types.has(t)) count++;
  }
  return count;
}

export function getExodiaSetCount(inventory: InventoryItem[] | Set<string>): number {
  return countOwnedSetPieces(inventory, EXODIA_ARMOR_TYPES);
}

export function getHexmetalSetCount(inventory: InventoryItem[] | Set<string>): number {
  return countOwnedSetPieces(inventory, HEXMETAL_SET_TYPES);
}

export function getArchmageSetCount(inventory: InventoryItem[] | Set<string>): number {
  return countOwnedSetPieces(inventory, ARCHMAGE_SET_TYPES);
}

export function isUniqueDreamLayerItem(type: string): boolean {
  return (DREAM_LAYER_UNIQUE_TYPES as readonly string[]).includes(type);
}

export function isEffectPendant(type: string): boolean {
  return (EFFECT_PENDANT_TYPES as readonly string[]).includes(type);
}

/** Unique ownership (shop/loot duplicate guards) — includes effect pendants. */
export function isUniqueOwnedItem(type: string): boolean {
  return isUniqueDreamLayerItem(type) || isEffectPendant(type);
}

export function getExodiaSetStatBonuses(exodiaCount: number): {
  stamina: number;
  strength: number;
  intellect: number;
  maxEnergy: number;
} {
  return {
    stamina:
      (exodiaCount >= 2 ? EXODIA_SET_2_STAMINA : 0) +
      (exodiaCount >= 5 ? EXODIA_SET_5_STAMINA : 0),
    strength: exodiaCount >= 4 ? EXODIA_SET_4_STR : 0,
    intellect: exodiaCount >= 4 ? EXODIA_SET_4_INT : 0,
    maxEnergy: exodiaCount >= 3 ? EXODIA_SET_3_MAX_ENERGY : 0,
  };
}

export function getArchmageSetStatBonuses(archmageCount: number): {
  intellect: number;
} {
  return {
    intellect: archmageCount >= 2 ? ARCHMAGE_SET_2_INT : 0,
  };
}

export function hasImmortalUnion(exodiaCount: number): boolean {
  return exodiaCount >= 4;
}

// ── Effect formulas ──────────────────────────────────────────────────────────

export function getVicegripSabreFlatBonus(): number {
  return VICEGRIP_SABRE_FLAT_BONUS;
}

export function getVicegripRunebladeComboFlatBonus(): number {
  return VICEGRIP_RUNEBLADE_COMBO_FLAT_BONUS;
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
  if (enemyType === 'boss' || enemyType === 'boss2' || enemyType === 'boss3' || enemyType === 'destiny') return 15;
  return 2;
}

export function getDefaultDreamShardCount(enemyType?: string | null): number {
  if (!enemyType || enemyType === 'training-dummy') return 0;
  if (enemyType === 'titan' || enemyType === 'nemesis') return 3;
  if (enemyType === 'boss' || enemyType === 'boss2' || enemyType === 'boss3' || enemyType === 'destiny') return 5;
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
