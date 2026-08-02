/**
 * Fae Realm III beast companion allies — keep in sync with
 * backend/gameRoom.js and backend/enemyAI.js ALLIED_BEAST_* / FAE_BEAST_* constants.
 */

export type FaeBeastCompanionKind = 'tiger' | 'wolf' | 'bear' | 'serpent' | 'spider';

export type AlliedBeastEnemyType =
  | 'allied-tiger'
  | 'allied-wolf'
  | 'allied-bear'
  | 'allied-serpent'
  | 'allied-spider';

export const FAE_BEAST_COMPANION_KINDS: readonly FaeBeastCompanionKind[] = [
  'tiger',
  'wolf',
  'bear',
  'serpent',
  'spider',
] as const;

export const ALLIED_BEAST_ENEMY_TYPES: readonly AlliedBeastEnemyType[] = [
  'allied-tiger',
  'allied-wolf',
  'allied-bear',
  'allied-serpent',
  'allied-spider',
] as const;

/** Walk-in spawn: south of owner when Fae Realm III clears. */
export const FAE_BEAST_ENTRY_OFFSET = Object.freeze({ x: 0, z: -8.5 });
/** Meet position beside owner after walk-in. */
export const FAE_BEAST_MEET_OFFSET = Object.freeze({ x: 2.0, z: 0.5 });

export interface AlliedBeastStats {
  kind: FaeBeastCompanionKind;
  enemyType: AlliedBeastEnemyType;
  maxHp: number;
  damage: number;
  walkSpeed: number;
  runSpeed: number;
  attackRange: number;
  attackCooldownMs: number;
  swingLockMs: number;
  hitDelayMs: number;
  aggroRadius: number;
  followDistance: number;
  visualScale: number;
  bodyRadius: number;
  hpRegenAmount: number;
  hpRegenIntervalMs: number;
  showRegenHealNumber: boolean;
  telegraphEvent: string;
  damageType: string;
}

export const ALLIED_BEAST_STATS: Record<FaeBeastCompanionKind, AlliedBeastStats> = {
  tiger: {
    kind: 'tiger',
    enemyType: 'allied-tiger',
    maxHp: 600,
    damage: 29,
    walkSpeed: 2.85,
    runSpeed: 4.2,
    attackRange: 2.6,
    attackCooldownMs: 1100,
    swingLockMs: 1000,
    hitDelayMs: 400,
    aggroRadius: 10,
    followDistance: 3.0,
    visualScale: 1.0,
    bodyRadius: 0.9,
    hpRegenAmount: 15,
    hpRegenIntervalMs: 5000,
    showRegenHealNumber: false,
    telegraphEvent: 'allied-tiger-attack-telegraph',
    damageType: 'allied_tiger_melee',
  },
  wolf: {
    kind: 'wolf',
    enemyType: 'allied-wolf',
    maxHp: 400,
    damage: 33,
    walkSpeed: 3.0,
    runSpeed: 4.2,
    attackRange: 2.4,
    attackCooldownMs: 1100,
    swingLockMs: 600,
    hitDelayMs: 350,
    aggroRadius: 10,
    followDistance: 3.0,
    visualScale: 1.0,
    bodyRadius: 0.58,
    hpRegenAmount: 30,
    hpRegenIntervalMs: 5000,
    showRegenHealNumber: true,
    telegraphEvent: 'allied-wolf-attack-telegraph',
    damageType: 'allied_wolf_melee',
  },
  bear: {
    kind: 'bear',
    enemyType: 'allied-bear',
    maxHp: 800,
    damage: 47,
    walkSpeed: 2.85,
    runSpeed: 4.2,
    attackRange: 2.8,
    attackCooldownMs: 1400,
    swingLockMs: 1500,
    hitDelayMs: 500,
    aggroRadius: 10,
    followDistance: 3.0,
    visualScale: 1.0,
    bodyRadius: 1.0,
    hpRegenAmount: 40,
    hpRegenIntervalMs: 5000,
    showRegenHealNumber: false,
    telegraphEvent: 'allied-bear-attack-telegraph',
    damageType: 'allied_bear_melee',
  },
  serpent: {
    kind: 'serpent',
    enemyType: 'allied-serpent',
    maxHp: 500,
    damage: 37,
    walkSpeed: 2.0,
    runSpeed: 3.0,
    attackRange: 2.6,
    attackCooldownMs: 1100,
    swingLockMs: 1000,
    hitDelayMs: 400,
    aggroRadius: 10,
    followDistance: 3.0,
    visualScale: 0.5,
    bodyRadius: 0.7,
    hpRegenAmount: 15,
    hpRegenIntervalMs: 5000,
    showRegenHealNumber: false,
    telegraphEvent: 'allied-serpent-attack-telegraph',
    damageType: 'allied_serpent_melee',
  },
  spider: {
    kind: 'spider',
    enemyType: 'allied-spider',
    maxHp: 450,
    damage: 32,
    walkSpeed: 1.5,
    runSpeed: 1.5,
    attackRange: 2.5,
    attackCooldownMs: 1400,
    swingLockMs: 900,
    hitDelayMs: 500,
    aggroRadius: 10,
    followDistance: 3.0,
    visualScale: 0.33,
    bodyRadius: 0.55,
    hpRegenAmount: 15,
    hpRegenIntervalMs: 5000,
    showRegenHealNumber: false,
    telegraphEvent: 'allied-spider-attack-telegraph',
    damageType: 'allied_spider_melee',
  },
};

const BOSS_UNIT_TO_KIND: Record<string, FaeBeastCompanionKind> = {
  'boss-tiger': 'tiger',
  'boss-wolf': 'wolf',
  'boss-bear': 'bear',
  'boss-serpent': 'serpent',
  'bone-spider': 'spider',
};

export function bossUnitTypeToCompanionKind(
  unitType: string | null | undefined,
): FaeBeastCompanionKind | null {
  if (!unitType) return null;
  return BOSS_UNIT_TO_KIND[String(unitType)] ?? null;
}

export function parseFaeBeastCompanionKind(
  kind: string | null | undefined,
): FaeBeastCompanionKind | null {
  const k = String(kind || '').toLowerCase();
  return FAE_BEAST_COMPANION_KINDS.includes(k as FaeBeastCompanionKind)
    ? (k as FaeBeastCompanionKind)
    : null;
}

export function companionKindToEnemyType(kind: FaeBeastCompanionKind): AlliedBeastEnemyType {
  return ALLIED_BEAST_STATS[kind].enemyType;
}

export function getAlliedBeastStats(kind: FaeBeastCompanionKind): AlliedBeastStats {
  return ALLIED_BEAST_STATS[kind];
}

export function getAlliedBeastStatsByEnemyType(
  enemyType: string | null | undefined,
): AlliedBeastStats | null {
  const t = String(enemyType || '');
  for (const kind of FAE_BEAST_COMPANION_KINDS) {
    if (ALLIED_BEAST_STATS[kind].enemyType === t) return ALLIED_BEAST_STATS[kind];
  }
  return null;
}

/** Fixed server enemy id for a player's Fae Realm III beast companion. */
export function resolveFaeBeastCompanionId(playerId: string): string {
  return `fae-beast-${playerId}`;
}

export function isAlliedBeastEnemyType(type: string | null | undefined): boolean {
  return ALLIED_BEAST_ENEMY_TYPES.includes(String(type || '') as AlliedBeastEnemyType);
}

export const FAE_BEAST_KIND_LABELS: Record<FaeBeastCompanionKind, string> = {
  tiger: 'Tiger',
  wolf: 'Wolf',
  bear: 'Bear',
  serpent: 'Serpent',
  spider: 'Spider',
};

export const FAE_BEAST_COMPANION_ICON_SRC: Record<FaeBeastCompanionKind, string> = {
  tiger: '/icons/spiritanimals/tiger.png',
  wolf: '/icons/spiritanimals/wolf.png',
  bear: '/icons/spiritanimals/bear.png',
  serpent: '/icons/spiritanimals/serpent.png',
  spider: '/icons/spiritanimals/spider.png',
};

export function getFaeBeastCompanionIconSrc(kind: FaeBeastCompanionKind): string {
  return FAE_BEAST_COMPANION_ICON_SRC[kind];
}
