/**
 * Eternity Palace III pet companion upgrades — keep combat constants in sync with
 * backend/gameRoom.js and backend/enemyAI.js.
 */

import {
  FAE_BEAST_KIND_LABELS,
  getFaeBeastCompanionIconSrc,
  type FaeBeastCompanionKind,
} from './faeBeastCompanion';

export type PetCompanionUpgradeId =
  | 'bear_siegebreaker'
  | 'bear_mending_spores'
  | 'bear_grizzly_claws'
  | 'serpent_neurotoxin'
  | 'serpent_mending_spores'
  | 'serpent_basilisk_hide'
  | 'spider_ensnaring_threads'
  | 'spider_mending_spores'
  | 'spider_arachnid_matter'
  | 'tiger_apex_killer'
  | 'tiger_evasion'
  | 'tiger_dire_hide'
  | 'wolf_pack_expansion'
  | 'wolf_persistence_hunter'
  | 'wolf_dire_hide';

/** Shared Mending Spores effect IDs (bear / serpent / spider pools). */
export const MENDING_SPORES_UPGRADE_IDS: readonly PetCompanionUpgradeId[] = [
  'bear_mending_spores',
  'serpent_mending_spores',
  'spider_mending_spores',
] as const;

export const PET_COMPANION_UPGRADE_OPTIONS: Record<
  FaeBeastCompanionKind,
  readonly PetCompanionUpgradeId[]
> = {
  bear: ['bear_siegebreaker', 'bear_mending_spores', 'bear_grizzly_claws'],
  serpent: ['serpent_neurotoxin', 'serpent_mending_spores', 'serpent_basilisk_hide'],
  spider: ['spider_ensnaring_threads', 'spider_mending_spores', 'spider_arachnid_matter'],
  tiger: ['tiger_apex_killer', 'tiger_evasion', 'tiger_dire_hide'],
  wolf: ['wolf_pack_expansion', 'wolf_persistence_hunter', 'wolf_dire_hide'],
};

/** Combat / proximity constants — keep in sync with backend. */
export const PET_UPGRADE_SIEGEBREAKER_HP = 1000;
export const PET_UPGRADE_SIEGEBREAKER_TAUNT_RANGE = 7;
export const PET_UPGRADE_SIEGEBREAKER_TAUNT_CD_MS = 6000;
export const PET_UPGRADE_GRIZZLY_CLAWS_DAMAGE = 40;
export const PET_UPGRADE_MENDING_SPORES_RANGE = 6;
export const PET_UPGRADE_MENDING_SPORES_HPS = 1;
export const PET_UPGRADE_DIRE_HIDE_HP = 600;
export const PET_UPGRADE_APEX_KILLER_DAMAGE = 71;
export const PET_UPGRADE_APEX_KILLER_CRIT_CHANCE = 0.2;
export const PET_UPGRADE_EVASION_RANGE = 6;
export const PET_UPGRADE_EVASION_CHANCE = 0.2;
export const PET_UPGRADE_ENSNARING_THREADS_DAMAGE = 70;
export const PET_UPGRADE_ENSNARING_THREADS_CD_MS = 2500;
export const PET_UPGRADE_ENSNARING_THREADS_CAST_MS = 800;
export const PET_UPGRADE_ENSNARING_THREADS_RANGE = 12;
export const PET_UPGRADE_ENSNARING_THREADS_SPEED = 11;
export const PET_UPGRADE_PERSISTENCE_HUNTER_RANGE = 10;
export const PET_UPGRADE_PERSISTENCE_HUNTER_WALK_SPEED = 4.0;
export const PET_UPGRADE_PERSISTENCE_HUNTER_BASE_WALK_SPEED = 3.575;
export const PET_UPGRADE_PERSISTENCE_HUNTER_RUN_ANIM_SCALE = 1.12;

export interface PetCompanionUpgradeDefinition {
  id: PetCompanionUpgradeId;
  name: string;
  description: string;
  beastKind: FaeBeastCompanionKind;
}

const DEFINITIONS: Record<PetCompanionUpgradeId, PetCompanionUpgradeDefinition> = {
  bear_siegebreaker: {
    id: 'bear_siegebreaker',
    name: 'Siegebreaker',
    description:
      'The Bear gains +1000 max HP permanently, and gains a Taunt ability (6s cooldown) that AOE-taunts all enemies within 7 range.',
    beastKind: 'bear',
  },
  bear_mending_spores: {
    id: 'bear_mending_spores',
    name: 'Mending Spores',
    description:
      'While within 6 range of your Bear ally, gain +1 HP regeneration per second.',
    beastKind: 'bear',
  },
  bear_grizzly_claws: {
    id: 'bear_grizzly_claws',
    name: 'Grizzly Claws',
    description: 'Increases the base attack damage of the Bear by +40.',
    beastKind: 'bear',
  },
  serpent_neurotoxin: {
    id: 'serpent_neurotoxin',
    name: 'Neurotoxin',
    description: 'All melee hits of the Serpent inflict 1 stack of Concentrated Venom.',
    beastKind: 'serpent',
  },
  serpent_mending_spores: {
    id: 'serpent_mending_spores',
    name: 'Mending Spores',
    description:
      'While within 6 range of your Serpent ally, gain +1 HP regeneration per second.',
    beastKind: 'serpent',
  },
  serpent_basilisk_hide: {
    id: 'serpent_basilisk_hide',
    name: 'Basilisk Hide',
    description: 'Increases maximum health of the Serpent by 600.',
    beastKind: 'serpent',
  },
  spider_ensnaring_threads: {
    id: 'spider_ensnaring_threads',
    name: 'Ensnaring Threads',
    description:
      'Spider shoots grey web missiles (70 damage, 2.5s cooldown) that entangle enemies. Prefers ranged shots and spreads entangles across targets.',
    beastKind: 'spider',
  },
  spider_mending_spores: {
    id: 'spider_mending_spores',
    name: 'Mending Spores',
    description:
      'While within 6 range of your Spider ally, gain +1 HP regeneration per second.',
    beastKind: 'spider',
  },
  spider_arachnid_matter: {
    id: 'spider_arachnid_matter',
    name: 'Arachnid Matter',
    description: 'Increases maximum health of the Spider by 600.',
    beastKind: 'spider',
  },
  tiger_apex_killer: {
    id: 'tiger_apex_killer',
    name: 'Apex Killer',
    description:
      'The Tiger now has a base damage of 71 per hit with a 20% critical strike chance.',
    beastKind: 'tiger',
  },
  tiger_evasion: {
    id: 'tiger_evasion',
    name: 'Evasion',
    description:
      'While within 6 range of your Tiger ally, you have a 20% chance to entirely dodge incoming damage.',
    beastKind: 'tiger',
  },
  tiger_dire_hide: {
    id: 'tiger_dire_hide',
    name: 'Dire Hide',
    description: 'Increases maximum health of the Tiger by 600.',
    beastKind: 'tiger',
  },
  wolf_pack_expansion: {
    id: 'wolf_pack_expansion',
    name: 'Pack Expansion',
    description: 'Gain a second Wolf companion that fights alongside you.',
    beastKind: 'wolf',
  },
  wolf_persistence_hunter: {
    id: 'wolf_persistence_hunter',
    name: 'Persistence Hunter',
    description:
      'While within 10 range of your Wolf ally, gain permanent bonus movement speed (3.575 → 4.0). Sprint speed is unchanged.',
    beastKind: 'wolf',
  },
  wolf_dire_hide: {
    id: 'wolf_dire_hide',
    name: 'Dire Hide',
    description: 'Increases maximum health of the Wolf by 600.',
    beastKind: 'wolf',
  },
};

export function isPetCompanionUpgradeId(
  id: string | null | undefined,
): id is PetCompanionUpgradeId {
  return !!id && id in DEFINITIONS;
}

export function getPetCompanionUpgradeDefinition(
  id: PetCompanionUpgradeId,
): PetCompanionUpgradeDefinition {
  return DEFINITIONS[id];
}

export function getPetCompanionUpgradeOptionsForKind(
  kind: FaeBeastCompanionKind,
): readonly PetCompanionUpgradeId[] {
  return PET_COMPANION_UPGRADE_OPTIONS[kind];
}

export function isUpgradeValidForBeastKind(
  upgradeId: PetCompanionUpgradeId,
  kind: FaeBeastCompanionKind,
): boolean {
  return PET_COMPANION_UPGRADE_OPTIONS[kind].includes(upgradeId);
}

export function isMendingSporesUpgrade(id: string | null | undefined): boolean {
  return MENDING_SPORES_UPGRADE_IDS.includes(id as PetCompanionUpgradeId);
}

export function getPetCompanionUpgradeIconSrc(id: PetCompanionUpgradeId): string {
  return getFaeBeastCompanionIconSrc(DEFINITIONS[id].beastKind);
}

export function getPetCompanionUpgradeBeastLabel(id: PetCompanionUpgradeId): string {
  return FAE_BEAST_KIND_LABELS[DEFINITIONS[id].beastKind];
}

/** Compact combat payload for client / HUD sync. */
export function getPetCompanionUpgradePayload(id: PetCompanionUpgradeId | null | undefined): {
  upgradeId: PetCompanionUpgradeId | null;
  mendingSpores: boolean;
  tigerEvasion: boolean;
  persistenceHunter: boolean;
  packExpansion: boolean;
  siegebreaker: boolean;
  ensnaringThreads: boolean;
  neurotoxin: boolean;
  apexKiller: boolean;
} {
  const upgradeId = isPetCompanionUpgradeId(id) ? id : null;
  return {
    upgradeId,
    mendingSpores: isMendingSporesUpgrade(upgradeId),
    tigerEvasion: upgradeId === 'tiger_evasion',
    persistenceHunter: upgradeId === 'wolf_persistence_hunter',
    packExpansion: upgradeId === 'wolf_pack_expansion',
    siegebreaker: upgradeId === 'bear_siegebreaker',
    ensnaringThreads: upgradeId === 'spider_ensnaring_threads',
    neurotoxin: upgradeId === 'serpent_neurotoxin',
    apexKiller: upgradeId === 'tiger_apex_killer',
  };
}
