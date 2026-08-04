const { broadcastEnemySpawn } = require('./enemyHandler');
const EnemyAI = require('./enemyAI');
const {
  COOP_MAIN_ENTRY_X,
  COOP_MAIN_ENTRY_Z,
  CASTLE_ROOM_HALF_SIZE,
  CASTLE_ROOM_ENTRY_X,
  CASTLE_ROOM_ENTRY_Z,
  COOP_PLAYER_START_CLEAR_RADIUS,
  COOP_MAIN_COMBAT_PEDESTAL_X,
  COOP_MAIN_COMBAT_PEDESTAL_Z,
  COOP_MAIN_COMBAT_INTERMISSION_CLEAR_RADIUS,
  rotationYTowardEntry,
  rotationYTowardArenaCenter,
  FAE_REALM_HEX_RADIUS,
  FAE_REALM_ENTRY_X,
  FAE_REALM_ENTRY_Z,
  ETERNITY_PALACE_HEX_RADIUS,
  ETERNITY_PALACE_ENTRY_X,
  ETERNITY_PALACE_ENTRY_Z,
} = require('./coopArenaLayout');
const { rollCoopSkyPresetIndex } = require('./coopSkyPresets');
const { rollCoopGrassPresetIndex } = require('./coopGrassPresets');
const mushroomLayout = require('./mushroomLayout');
const mushroomConstants = require('./mushroomConstants');
const dreamLayerItems = require('./dreamLayerItems');
const bossRelicItems = require('./bossRelicItems');

/** Co-op boss encounters (GLB tier 1, Archon tier 2, Weaver Nexus, Destiny dragon). */
const COOP_BOSS_TYPES = new Set(['boss', 'boss2', 'boss3', 'destiny']);
const COOP_BOSS_MAX_HEALTH_PRE_TRINITY = { boss: 7500, boss2: 9250, boss3: 11250, destiny: 35000 };
const COOP_BOSS_MAX_HEALTH_POST_TRINITY = { boss: 12500, boss2: 20000, boss3: 30000, destiny: 55000 };
/** Knight damage by boss-kill tier: [base, after boss 1, after boss 2, after boss 3+]. */
const KNIGHT_DAMAGE_BY_TIER = {
  green:  [21, 27, 37, 47],
  red:    [27, 36, 44, 58],
  blue:   [18, 27, 36, 44],
  purple: [19, 29, 39, 49],
};
const KNIGHT_SOUL_STATS = {
  green:  { health: 1250, maxHealth: 1250, attackCooldown: 2500, moveSpeed: 2.0 },
  red:    { health: 1000, maxHealth: 1000, attackCooldown: 2500, moveSpeed: 2.0 },
  blue:   { health: 900,  maxHealth: 900,  attackCooldown: 1250, moveSpeed: 2.25 },
  purple: { health: 900,  maxHealth: 900,  attackCooldown: 2500, moveSpeed: 3.25 },
};
const KNIGHT_SOUL_TYPES = ['red', 'blue', 'purple', 'green'];
/** Max freeze duration (ms) for boss-tier enemies (server + client). */
const BOSS_MAX_FREEZE_MS = 1000;
const ENTANGLEMENT_DURATION_MS = 5000;
const ENTANGLEMENT_DAMAGE_PER_SECOND = 31;
/** Keep in sync with `STAGGER_MAX` / `STAGGER_MAX_BOSS` in `src/utils/talents.ts`. */
const STAGGER_CAP_NORMAL = 100;
const STAGGER_CAP_BOSS = 225;
// Safety-net only: released when every connected player sends 'coop-combat-transition-ready'
// (after their loading screen fully fades).  This fallback only fires if a client crashes or
// disconnects mid-transition and never sends the confirmation.  Keep it large enough to never
// race with a legitimate slow load.
const COOP_COMBAT_TRANSITION_FALLBACK_MS = 30000;
/** Reject client position writes briefly after portal teleport (covers merchant path with no transition). */
const COOP_POST_TELEPORT_POSITION_GUARD_MS = 1500;
/** Delay after portal teleport before the initial enemy wave is added to the map. */
const COOP_ROOM_ENTRY_ENEMY_SPAWN_DELAY_MS = 1000;
const CROSSENTROPY_METEOR_SINGLE_CHANCE = 0.8;
const CROSSENTROPY_METEOR_DOUBLE_CHANCE = 0.15;
/** Throne room weapon pedestals — keep in sync with `COOP_THRONE_WEAPON_TYPES` in weapons.ts */
const COOP_THRONE_WEAPONS = ['RUNEBLADE', 'SABRES', 'SCYTHE', 'BOW'];
const COOP_DEFAULT_SUBCLASS = {
  RUNEBLADE: 'ARCANE',
  SCYTHE: 'CHAOS',
  SABRES: 'FROST',
  BOW: 'ELEMENTAL',
};
/** Throne weapon aspects — keep in sync with `WEAPON_ASPECTS_BY_WEAPON` in weaponAspects.ts */
const COOP_DEFAULT_WEAPON_ASPECT = {
  RUNEBLADE: 'BLADEMASTER',
  SCYTHE: 'NECROMANCER',
  SABRES: 'FIRE_AFFINITY',
  BOW: 'SNIPER',
};
const COOP_WEAPON_ASPECTS_BY_WEAPON = {
  RUNEBLADE: ['BLADEMASTER', 'LEGIONNAIRE', 'ROYAL_GUARD', 'DEATHDEALER'],
  SCYTHE: ['NECROMANCER', 'ARCHMAGE', 'DRACONIC'],
  SABRES: ['FIRE_AFFINITY', 'FROST_AFFINITY', 'WARLORD'],
  BOW: ['SNIPER', 'BEASTMASTER', 'DRUID'],
};
const COOP_ALL_WEAPON_ASPECTS = new Set([
  'LEGIONNAIRE',
  'BLADEMASTER',
  'DEATHDEALER',
  'ROYAL_GUARD',
  'ARCHMAGE',
  'NECROMANCER',
  'DRACONIC',
  'FIRE_AFFINITY',
  'FROST_AFFINITY',
  'WARLORD',
  'SNIPER',
  'DRUID',
  'BEASTMASTER',
]);
/** Keep in sync with `SNIPER_HUNTERS_MARK_DURATION_MS` in src/utils/weaponAspects.ts */
const SNIPER_HUNTERS_MARK_DURATION_MS = 5000;
/** Damage types whose HP sync is throttled in damageEnemy (avoid allocating per hit). */
const DOT_DAMAGE_TYPES = new Set([
  'ignite',
  'shadowflame',
  'venom',
  'entanglement',
  'allied_enchantress_entanglement',
  'blizzard',
  'cloudkill',
  'prime_materia',
]);
function defaultWeaponAspectForWeapon(weapon) {
  const key = weapon != null ? String(weapon).toUpperCase() : '';
  return COOP_DEFAULT_WEAPON_ASPECT[key] ?? 'LEGIONNAIRE';
}
function normalizeWeaponAspectForWeapon(aspect, weapon) {
  const raw = aspect != null ? String(aspect).toUpperCase() : '';
  const allowedForWeapon = COOP_WEAPON_ASPECTS_BY_WEAPON[String(weapon || '').toUpperCase()];
  const fallback = defaultWeaponAspectForWeapon(weapon);
  if (!COOP_ALL_WEAPON_ASPECTS.has(raw)) return fallback;
  if (allowedForWeapon && !allowedForWeapon.includes(raw)) return fallback;
  return raw;
}
const CROSSENTROPY_METEOR_TRIPLE_CHANCE = 0.05;
const CROSSENTROPY_METEOR_STAGGER_MS = 500;
const CROSSENTROPY_METEOR_DAMAGE = 240;
const CROSSENTROPY_METEOR_RADIUS = 2.99;
const CROSSENTROPY_METEOR_WARNING_MS = 100;
const CROSSENTROPY_METEOR_SPEED = 31;
const CROSSENTROPY_METEOR_SKY_OFFSET_MIN = 2.5;
const CROSSENTROPY_METEOR_SKY_OFFSET_MAX = 8;
const CROSSENTROPY_METEOR_SKY_HEIGHT_MIN = 44;
const CROSSENTROPY_METEOR_SKY_HEIGHT_MAX = 66;
const INFERNAL_DASH_IGNITE_DOT_FRACTION = 0.8;
const INFERNAL_DASH_IGNITE_DURATION_MS = 4000;
const INFERNAL_DASH_IGNITE_TICKS = 4;
const FIRE_AFFINITY_IGNITE_DOT_FRACTION = 0.8;
const FIRE_AFFINITY_IGNITE_DURATION_MS = 4000;
const FIRE_AFFINITY_IGNITE_TICKS = 4;
/** Keep in sync with Fire Affinity Skyfall ignite constants in src/utils/weaponAspects.ts */
const FIRE_AFFINITY_SKYFALL_IGNITE_DOT_FRACTION = 0.8;
const FIRE_AFFINITY_SKYFALL_IGNITE_DURATION_MS = 3000;
const FIRE_AFFINITY_SKYFALL_IGNITE_TICKS = 3;
/** Keep in sync with Tempest Sweep ignite constants in src/utils/weaponAspects.ts */
const TEMPEST_SWEEP_IGNITE_DOT_FRACTION = 0.8;
const TEMPEST_SWEEP_IGNITE_DURATION_MS = 4000;
const TEMPEST_SWEEP_IGNITE_TICKS = 4;
/** Keep in sync with Archmage Entropic Ignite constants in src/utils/weaponAspects.ts */
const ARCHMAGE_ENTROPIC_IGNITE_DOT_FRACTION = 2.0;
const ARCHMAGE_ENTROPIC_IGNITE_DURATION_MS = 4000;
const ARCHMAGE_ENTROPIC_IGNITE_TICKS = 4;
/** Keep in sync with Archmage flame pillar constants in src/utils/weaponAspects.ts */
const ARCHMAGE_FLAME_PILLAR_BASE_DAMAGE = 125;
const ARCHMAGE_FLAME_PILLAR_DAMAGE_PER_INTELLECT = 5;
/** Keep in sync with Blademaster Shadowflame constants in src/utils/weaponAspects.ts */
const BLADEMASTER_SHADOWFLAME_DOT_FRACTION = 0.7;
const BLADEMASTER_SHADOWFLAME_DURATION_MS = 2500;
const BLADEMASTER_SHADOWFLAME_TICKS = 5;
const METEOR_IGNITE_DOT_BASE_FRACTION = 0.8;
const METEOR_IGNITE_DOT_INTELLECT_BONUS_PER_POINT = 0.02;
const METEOR_IGNITE_DURATION_MS = 4000;
const METEOR_IGNITE_TICKS = 4;
const FISSON_EXPLOSION_DAMAGE = 240;
const FISSON_EXPLOSION_RADIUS = 4.0;
const FISSON_IGNITE_DOT_FRACTION = 0.8;
const FISSON_IGNITE_DURATION_MS = 4000;
const FISSON_IGNITE_TICKS = 4;
const CROSSENTROPY_PLAGUE_VENOM_STACKS = 3;
/** Keep in sync with `INFESTED_TALENT_CONCENTRATED_VENOM_STACKS` in src/utils/talents.ts */
const INFESTED_TALENT_CONCENTRATED_VENOM_STACKS = 1;
/** Keep in sync with `WARLORD_BACKSTAB_CONCENTRATED_VENOM_STACKS` in src/utils/weaponAspects.ts */
const WARLORD_BACKSTAB_CONCENTRATED_VENOM_STACKS = 1;
/** Keep in sync with `POISON_DART_CONCENTRATED_VENOM_STACKS` in src/utils/weaponAspects.ts */
const POISON_DART_CONCENTRATED_VENOM_STACKS = 1;
/** Keep in sync with `DEATHDEALER_THIRD_HIT_STAGGER_PROC_CHANCE` in src/utils/weaponAspects.ts */
const DEATHDEALER_THIRD_HIT_STAGGER_PROC_CHANCE = 0.5;
/** Keep in sync with `INFESTED_COMBO_VENOM_PROC_CHANCE` in src/utils/talents.ts */
const INFESTED_COMBO_VENOM_PROC_CHANCE = 0.30;
/** Keep in sync with `INFESTING_SABRES_SWIPES_VENOM_PROC_CHANCE` in src/utils/talents.ts */
const INFESTING_SABRES_SWIPES_VENOM_PROC_CHANCE = 0.15;
const WYVERN_VENOM_DPS_PER_STACK = 31;
const WYVERN_VENOM_MAX_STACKS = 5;
/** Keep in sync with `LETHAL_INJECTION_CONCENTRATED_VENOM_MAX_STACKS` in src/utils/talents.ts */
const LETHAL_INJECTION_VENOM_MAX_STACKS = 10;
const WYVERN_VENOM_DURATION_MS = 8000;
/** Keep in sync with `STORM_SHIELD_BASE_RESTORE` in src/utils/talents.ts */
const STORM_SHIELD_BASE_RESTORE = 30;
/** Keep in sync with `STORM_SHIELD_AGILITY_PER_POINT` in src/utils/talents.ts */
const STORM_SHIELD_AGILITY_PER_POINT = 5;
/** Keep in sync with `PYROMANIA_METEOR_ICD_MS` in src/utils/talents.ts */
const PYROMANIA_METEOR_ICD_MS = 1250;
/** Keep in sync with `DIVINE_COLD_BLIZZARD_ICD_MS` in src/utils/talents.ts */
const DIVINE_COLD_BLIZZARD_ICD_MS = 2000;
/** Keep in sync with `DIVINE_COLD_FORWARD_RANGE` in src/utils/talents.ts */
const DIVINE_COLD_FORWARD_RANGE = 20;
/** Keep in sync with `DIVINE_COLD_FORWARD_CONE_HALF_ANGLE_DEG` in src/utils/talents.ts */
const DIVINE_COLD_FORWARD_CONE_HALF_ANGLE_DEG = 60;
const TYRANTS_CLOAK_IGNITE_STAGGER_PER_TICK = 10;
/** Keep in sync with Hellfire Venom ignite constants in src/utils/talents.ts */
const HELLFIRE_VENOM_IGNITE_BASE_PER_LEVEL = 100;
const HELLFIRE_VENOM_IGNITE_ICD_MS = 1000;
const HELLFIRE_VENOM_IGNITE_DOT_FRACTION = 0.8;
const HELLFIRE_VENOM_IGNITE_DURATION_MS = 4000;
const HELLFIRE_VENOM_IGNITE_TICKS = 4;
/** Keep in sync with `STORM_WITCH_VENOM_STACKS` in src/utils/talents.ts */
const STORM_WITCH_VENOM_STACKS = 2;
/** Keep in sync with Duality / Arctic blizzard constants in src/utils/talents.ts */
const DUALITY_BLIZZARD_PROC_CHANCE = 0.15;
const DUALITY_BLIZZARD_DAMAGE_PER_TICK = 30;
const DUALITY_BLIZZARD_DURATION_MS = 6000;
const DUALITY_BLIZZARD_TICK_MS = 500;
const DUALITY_BLIZZARD_HIT_RADIUS = 3;
/** Keep in sync with Alchemist Prime Materia constants in src/utils/talents.ts (toggle timing is client-only). */
const PRIME_MATERIA_RADIUS = 4.0;
const PRIME_MATERIA_TICK_MS = 500;
const PRIME_MATERIA_MIN_DAMAGE = 25;
const PRIME_MATERIA_MAX_DAMAGE = 90;
const PRIME_MATERIA_RAMP_TIME_SEC = 6;
const PRIME_MATERIA_HEAL_FRACTION = 0.1;
/** Keep in sync with Sorceress Incineration constants in src/utils/talents.ts */
const INCINERATION_IGNITE_DOT_FRACTION = 0.8;
const INCINERATION_IGNITE_DURATION_MS = 4000;
const INCINERATION_IGNITE_TICKS = 4;
const INCINERATION_PLASMA_CHARGE_THRESHOLD = 90;
const INCINERATION_PLASMA_DAMAGE_PER_SHIELD = 4;
/** Keep in sync with `ACID_RAIN_VENOM_STACKS_PER_TICK` in src/utils/talents.ts */
const ACID_RAIN_VENOM_STACKS_PER_TICK = 1;
const ALLIED_KNIGHT_ID = 'allied-knight';
const ALLIED_KNIGHT_MAX_HP = 550;
const ALLIED_KNIGHT_DAMAGE = 50;
const ALLIED_KNIGHT_MOVE_SPEED = 2.85;
const ALLIED_KNIGHT_ATTACK_COOLDOWN_MS = 1375;
const ALLIED_KNIGHT_ORB_COUNT = 3;
const ALLIED_HUNTRESS_ID = 'allied-huntress';
const ALLIED_HUNTRESS_MAX_HP = 450;
const ALLIED_HUNTRESS_DAMAGE = 65;
const ALLIED_HUNTRESS_MOVE_SPEED = 2.0;
const ALLIED_HUNTRESS_ATTACK_COOLDOWN_MS = 1250;
const ALLIED_PHANTOM_ID = 'allied-phantom';
const ALLIED_PHANTOM_MAX_HP = 400;
const ALLIED_PHANTOM_DAMAGE = 40;
const ALLIED_PHANTOM_MOVE_SPEED = 2.0;
const ALLIED_PHANTOM_ATTACK_COOLDOWN_MS = 4000;
const ALLIED_DEMON_ID = 'allied-demon';
const ALLIED_DEMON_MAX_HP = 500;
const ALLIED_DEMON_DAMAGE = 48;
const ALLIED_DEMON_MOVE_SPEED = 3.0;
const ALLIED_DEMON_ATTACK_COOLDOWN_MS = 900;
const ALLIED_ENCHANTRESS_ID = 'allied-enchantress';
const ALLIED_ENCHANTRESS_MAX_HP = 375;
const ALLIED_ENCHANTRESS_MOVE_SPEED = 2.25;
const ALLIED_HEALER_ID = 'allied-healer';
/** Beastmaster bow companion — keep in sync with `BEASTMASTER_TIGER_*` in weaponAspects.ts */
const BEASTMASTER_TIGER_MAX_HP = 525;
const BEASTMASTER_TIGER_DAMAGE = 29;
const BEASTMASTER_TIGER_AGGRO_RADIUS = 10;
const BEASTMASTER_TIGER_FOLLOW_DISTANCE = 3.0;
const BEASTMASTER_TIGER_ATTACK_RANGE = 2.6;
const BEASTMASTER_TIGER_WALK_SPEED = 2.85;
const BEASTMASTER_TIGER_RUN_SPEED = 4.2;
const BEASTMASTER_TIGER_ATTACK_COOLDOWN_MS = 1100;
/** Sniper Terminal Velocity (+20 + 2/AGI when hit from >10 range) is client-applied on Perfect Shot / Reaping Talons — same as Execute/Giantkiller. */

/** Necromancer Vengeful Spirit — keep in sync with `VENGEFUL_SPIRIT_*` in weaponAspects.ts */
const VENGEFUL_SPIRIT_BASE_DAMAGE = 50;
const VENGEFUL_SPIRIT_DAMAGE_PER_STAT_POINT = 1;
const VENGEFUL_SPIRIT_ATTACK_COOLDOWN_MS = 850;
const VENGEFUL_SPIRIT_DURATION_MS = 12000;
const VENGEFUL_SPIRIT_SUMMON_LOCK_MS = 3000;
const VENGEFUL_SPIRIT_EXPIRE_ANIM_MS = 2200;
const VENGEFUL_SPIRIT_MAX_ACTIVE = 4;
/** Throne prep: Beastmaster tiger disengages dummy if owner has not hit it recently. Keep in sync with weaponAspects.ts */
const THRONE_DUMMY_TIGER_DISENGAGE_MS = 5000;

/**
 * Fae Realm III beast companions — keep in sync with src/utils/faeBeastCompanion.ts
 * and ALLIED_BEAST_* in enemyAI.js.
 */
const FAE_BEAST_COMPANION_KINDS = ['tiger', 'wolf', 'bear', 'serpent', 'spider'];
const FAE_BEAST_ENTRY_OFFSET = Object.freeze({ x: 0, z: -8.5 });
/** @deprecated Prefer COMPANION_SLOT_OFFSETS — kept for any legacy callers. */
const FAE_BEAST_MEET_OFFSET = Object.freeze({ x: 2.0, z: 0.5 });
/** Owner-local flank offsets (rotated by owner yaw). Keep in sync with enemyAI companion follow. */
const COMPANION_SLOT_OFFSETS = Object.freeze({
  beastmaster: { x: -2.2, z: -1.5 }, // left-rear flank
  fae: { x: 2.2, z: -1.5 }, // right-rear flank
  fae_pack: { x: 0, z: -2.8 }, // Pack Expansion second wolf (rear center)
});

/**
 * Eternity Palace III pet companion upgrades — keep in sync with
 * src/utils/petCompanionUpgrades.ts
 */
const PET_COMPANION_UPGRADE_OPTIONS = Object.freeze({
  bear: ['bear_siegebreaker', 'bear_mending_spores', 'bear_grizzly_claws'],
  serpent: ['serpent_neurotoxin', 'serpent_mending_spores', 'serpent_basilisk_hide'],
  spider: ['spider_ensnaring_threads', 'spider_mending_spores', 'spider_arachnid_matter'],
  tiger: ['tiger_apex_killer', 'tiger_evasion', 'tiger_dire_hide'],
  wolf: ['wolf_pack_expansion', 'wolf_persistence_hunter', 'wolf_dire_hide'],
});
const PET_UPGRADE_SIEGEBREAKER_HP = 1000;
const PET_UPGRADE_GRIZZLY_CLAWS_DAMAGE = 40;
const PET_UPGRADE_MENDING_SPORES_RANGE = 6;
const PET_UPGRADE_MENDING_SPORES_HPS = 1;
const PET_UPGRADE_DIRE_HIDE_HP = 600;
const PET_UPGRADE_APEX_KILLER_DAMAGE = 71;
const PET_UPGRADE_APEX_KILLER_CRIT_CHANCE = 0.2;
const PET_UPGRADE_APEX_KILLER_CRIT_MULT = 2;
const PET_UPGRADE_EVASION_RANGE = 6;
const PET_UPGRADE_EVASION_CHANCE = 0.2;
const PET_UPGRADE_PERSISTENCE_HUNTER_RANGE = 10;

function isValidPetCompanionUpgradeId(upgradeId, kind) {
  const options = PET_COMPANION_UPGRADE_OPTIONS[kind];
  return !!options && options.includes(upgradeId);
}

function isMendingSporesUpgrade(upgradeId) {
  return upgradeId === 'bear_mending_spores'
    || upgradeId === 'serpent_mending_spores'
    || upgradeId === 'spider_mending_spores';
}
const ALLIED_BEAST_ENEMY_TYPES = new Set([
  'allied-tiger', 'allied-wolf', 'allied-bear', 'allied-serpent', 'allied-spider',
]);
const FAE_BEAST_STATS = Object.freeze({
  tiger: {
    enemyType: 'allied-tiger',
    maxHp: 525,
    damage: 29,
    walkSpeed: 2.85,
    attackCooldownMs: 1100,
    visualScale: 1.0,
    hpRegenAmount: 15,
    hpRegenIntervalMs: 5000,
  },
  wolf: {
    enemyType: 'allied-wolf',
    maxHp: 400,
    damage: 26,
    walkSpeed: 3.0,
    attackCooldownMs: 850,
    visualScale: 1.0,
    hpRegenAmount: 30,
    hpRegenIntervalMs: 5000,
  },
  bear: {
    enemyType: 'allied-bear',
    maxHp: 675,
    damage: 41,
    walkSpeed: 2.85,
    attackCooldownMs: 1400,
    visualScale: 1.0,
    hpRegenAmount: 40,
    hpRegenIntervalMs: 5000,
  },
  serpent: {
    enemyType: 'allied-serpent',
    maxHp: 500,
    damage: 37,
    walkSpeed: 2.0,
    attackCooldownMs: 1100,
    visualScale: 0.5,
    hpRegenAmount: 15,
    hpRegenIntervalMs: 5000,
  },
  spider: {
    enemyType: 'allied-spider',
    maxHp: 450,
    damage: 32,
    walkSpeed: 1.5,
    attackCooldownMs: 1400,
    visualScale: 0.33,
    hpRegenAmount: 15,
    hpRegenIntervalMs: 5000,
  },
});
const BOSS_UNIT_TO_FAE_BEAST_KIND = Object.freeze({
  'boss-tiger': 'tiger',
  'boss-wolf': 'wolf',
  'boss-bear': 'bear',
  'boss-serpent': 'serpent',
  'bone-spider': 'spider',
});

function normalizeFaeBeastCompanionKind(kind) {
  const k = String(kind || '').toLowerCase();
  return FAE_BEAST_COMPANION_KINDS.includes(k) ? k : null;
}

function bossUnitTypeToFaeBeastKind(unitType) {
  return BOSS_UNIT_TO_FAE_BEAST_KIND[String(unitType || '')] || null;
}
const COOP_ALLY_KINDS = ['knight', 'huntress', 'phantom', 'demon', 'enchantress'];
const COOP_ALLY_KIND_TO_ID = {
  knight: ALLIED_KNIGHT_ID,
  huntress: ALLIED_HUNTRESS_ID,
  phantom: ALLIED_PHANTOM_ID,
  demon: ALLIED_DEMON_ID,
  enchantress: ALLIED_ENCHANTRESS_ID,
};
const ALL_COOP_PRIMARY_ALLY_IDS = Object.values(COOP_ALLY_KIND_TO_ID);

function normalizeCoopAllyKind(kind) {
  const k = String(kind || '').toLowerCase();
  return COOP_ALLY_KINDS.includes(k) ? k : 'knight';
}
const ALLIED_HEALER_MAX_HP = 350;
const ALLIED_HEALER_MOVE_SPEED = 2.0;
/** Temporarily disable allied healer (Ally 2); allied knight unchanged. */
const COOP_ALLIED_HEALER_ENABLED = false;

function rollCrossentropyMeteorStrikeCount() {
  const roll = Math.random();
  if (roll < CROSSENTROPY_METEOR_SINGLE_CHANCE) return 1;
  if (roll < CROSSENTROPY_METEOR_SINGLE_CHANCE + CROSSENTROPY_METEOR_DOUBLE_CHANCE) return 2;
  return 3;
}

/** Keep in sync with `CLOUDKILL_*` in src/utils/talents.ts */
const CLOUDKILL_ARROW_COUNT_MIN = 4;
const CLOUDKILL_ARROW_COUNT_MAX = 8;
const CLOUDKILL_ARROW_DELAY_MS = 125;
const CLOUDKILL_DAMAGE = 35;
const CLOUDKILL_RADIUS = 1.5;
const CLOUDKILL_WARNING_MS = 100;
const CLOUDKILL_ARROW_SPEED = 26.5;
const CLOUDKILL_SKY_HEIGHT_MIN = 50;
const CLOUDKILL_SKY_HEIGHT_MAX = 70;

function rollCloudkillArrowCount() {
  return (
    CLOUDKILL_ARROW_COUNT_MIN +
    Math.floor(Math.random() * (CLOUDKILL_ARROW_COUNT_MAX - CLOUDKILL_ARROW_COUNT_MIN + 1))
  );
}

/**
 * Z and X offsets must match ThroneRoom.tsx `THRONE_TRAINING_DUMMY_SPAWNS` / `THRONE_TRAINING_DUMMY_SPAWN_Z`.
 */
const THRONE_TRAINING_DUMMY_Z = 12.60;

/**
 * @typedef {'knight'} ThDummyVisual
 * @type {ReadonlyArray<{ id: string; x: number; z: number; dummyVisual: ThDummyVisual }>}
 */
const THRONE_TRAINING_DUMMY_SPAWNS = Object.freeze([
  { id: 'throne-training-dummy', x: 0, z: THRONE_TRAINING_DUMMY_Z, dummyVisual: 'knight' },
]);

/** @deprecated use THRONE_TRAINING_DUMMY_SPAWNS; kept for client imports */
const THRONE_TRAINING_DUMMY_ID = 'throne-training-dummy';

/** Runeblade Blizzard talent — Chill; keep in sync with src/utils/talents.ts */
const BLIZZARD_CHILL_STACK_DURATION_MS = 6000;
const BLIZZARD_CHILL_STACKS_TO_FREEZE = 5;
const BLIZZARD_CHILL_SLOW_PER_STACK = 0.15;
/** Arctic Sting Tempest Rounds — keep in sync with src/utils/talents.ts CHILL_STACKS_TO_FREEZE */
const ARCTIC_STING_TEMPEST_CHILL_STACKS_TO_FREEZE = 5;
const ARCTIC_STING_TEMPEST_FREEZE_MS = 4000;
/** Explosive Talons — keep in sync with src/utils/talents.ts */
const EXPLOSIVE_TALONS_MAX_TRAVEL = 13;
const EXPLOSIVE_TALONS_EXPLOSION_RADIUS = 4.0;
const EXPLOSIVE_TALONS_CAST_TTL_MS = 6000;
const EXPLOSIVE_TALONS_RADIUS_TOLERANCE = 0.85;

/**
 * Co-op arena: required kills to clear a combat room and advance the segment.
 * Quota scales by boss-defeat tier (6/7/8/9); martyr/greed/ghoul are additive bonuses.
 */
const COOP_COLORED_ROOM_TYPES = Object.freeze(['blue', 'red', 'green', 'purple']);
const COOP_SPECIAL_ROOM_TYPES = Object.freeze(['stat', 'trial', 'merchant']);
/** Mid-act dual-portal specials — merchant only appears in the forced pre-boss sequence. */
const COOP_MID_ACT_SPECIAL_ROOM_TYPES = Object.freeze(['stat', 'trial']);
const COOP_PRE_BOSS_SPECIAL_TYPES = Object.freeze(['stat', 'trial']);
const COOP_PRE_BOSS_REWARD_TO_MERCHANT_MS = 5000;
const COOP_ROOM_TYPES = Object.freeze([...COOP_COLORED_ROOM_TYPES, ...COOP_SPECIAL_ROOM_TYPES, 'boss', 'intro', 'deep_sanctum', 'sunken_temple', 'eternity_palace', 'eden', 'false_eden', 'delirium_gate', 'erebus_gate', 'dream_layer', 'fae_realm', 'eden_finale']);
const COOP_SURPRISE_CHANCE = 0.29;
const COOP_SURPRISE_KINDS = Object.freeze(['eden', 'false_eden', 'delirium_gate', 'erebus_gate', 'dream_layer']);
const EREBUS_GATE_RADIUS = CASTLE_ROOM_HALF_SIZE;
const EREBUS_GATE_INNER_RADIUS = EREBUS_GATE_RADIUS - 0.5;
const EREBUS_GATE_OPPONENT_KINDS = Object.freeze(['titan', 'valkyrie', 'nemesis', 'boss', 'knights']);
const COOP_FALSE_EDEN_SPINE_MIN = 12;
const COOP_FALSE_EDEN_SPINE_MAX = 16;
const DELIRIUM_STRUCTURE_HP = 750;
const DELIRIUM_EVENT_DURATION_MS = 60000;
const DELIRIUM_GHOUL_SPAWN_INTERVAL_MS = 6000;
const DELIRIUM_GHOUL_SPAWN_BATCH = 3;
const DELIRIUM_GHOUL_MAX_ALIVE = 10;
const DELIRIUM_STRUCTURE_X = 0;
const DELIRIUM_STRUCTURE_Z = -12;
const COOP_INTRO_ROOM_GOLD = Object.freeze([50, 75, 100, 0]);
const COOP_SUNKEN_ROOM_GOLD = COOP_INTRO_ROOM_GOLD;
const COOP_ETERNITY_ROOM_GOLD = Object.freeze([50, 75, 0, 75, 0]);
const COOP_FAE_REALM_ROOM_GOLD = Object.freeze([40, 60, 80]);
const FAE_REALM_INNER_APOTHEM = FAE_REALM_HEX_RADIUS * Math.cos(Math.PI / 6) - 1.4;
const ETERNITY_PALACE_INNER_APOTHEM = ETERNITY_PALACE_HEX_RADIUS * Math.cos(Math.PI / 6) - 1.4;
const COOP_VOID_PORTAL_CHANCE = .175;
const COOP_DEEP_SANCTUM_START_LEVEL = 5;
const COOP_DEEP_SANCTUM_GOLD_MIN = 150;
const COOP_DEEP_SANCTUM_GOLD_MAX = 300;
const COOP_DEEP_SANCTUM_STAT_POINTS = 8;
const COOP_INTRO_FOUNTAIN_HEAL = 100;
const COOP_ROOMS_BEFORE_BOSS = 2;
const COOP_ROOMS_BEFORE_BOSS_LATE = 3; // after 2nd boss defeated
const COOP_COUNTABLE_COMBAT_ROOM_TYPES = Object.freeze([
  ...COOP_COLORED_ROOM_TYPES, 'stat', 'trial', 'deep_sanctum',
]);
const COOP_TERRAIN_THEMES = Object.freeze(['purple', 'blue', 'green']);
const COOP_WAVE_MARTYR_ROOM_CHANCE = 0.33; // 30% of colored rooms have martyr spawns
const COOP_WAVE_TITAN_ROOM_CHANCE = 0.25; // 25% of colored rooms spawn 1 elite at boss-count tier 1 (used by Nemesis; Titans require boss 2+)
const COOP_WAVE_TITAN_ROOM_CHANCE_AFTER_BOSS2 = 0.40; // 40% of colored rooms spawn 1 elite after boss 2 (capped at 1)
const COOP_WAVE_BOSS1_ROOM_CHANCE = 0.20; // 33% of colored rooms have a mini-boss1 spawn after boss2 is defeated
const COOP_BOSS1_ELITE_KNIGHTS_CHANCE = 0.45; // 50% of 1st boss encounters are 2 elite knights instead of the GLB boss
const BOSS1_ELITE_SIZE_SCALE = 1.33;
const BOSS1_ELITE_SPEED_MULT = 1.15;
const BOSS1_ELITE_HEALTH_MULT = 4;
/** Boss-2 slot: 50% chance to spawn Weaver (current boss3) instead of the warlock/weaver sub-roll. */
const COOP_BOSS2_WEAVER_EARLY_CHANCE = 0.50;
/** Of the remaining Boss-2 slot rolls: 60% Archon warlock, 40% Weaver. */
const COOP_BOSS2_WARLOCK_CHANCE = 0.60;
const COOP_WAVE_GREED_SPAWN_CHANCE = 0.175; // 10% chance for a bonus Greed enemy on any countable combat room's wave init
const COOP_WAVE_WRAITH_ROOM_CHANCE = 0.33; // 33% chance for 1–2 bonus Wraiths on any countable combat room's wave init
const GREED_LIFETIME_MS = 27500; // Greed despawns 30s after spawning if not killed
const GREED_COLORS = ['green', 'red', 'blue', 'purple'];
/** Client default kill-bar target until first server `required` emit (see ExperienceBar.tsx). */
const COOP_MIXED_WAVE_COUNT = 8;
/** Max living basic mobs on screen; titans/Boss1 spawn on top; martyr/ghoul/greed exempt. */
const COOP_WAVE_BASIC_ON_SCREEN_CAP = 4;
/** Stagger between successive required spawns at wave init (ms). */
const COOP_WAVE_SPAWN_STAGGER_MS = 2000;
/** Stagger between kill-triggered reserve reinforcements (ms). */
const COOP_WAVE_REINFORCE_STAGGER_MS = 2500;
/** Starting concurrent basic cap at wave init — grows with kills. */
const COOP_WAVE_INITIAL_ALIVE = 2;
/** Kills per +1 soft cap step up to COOP_WAVE_BASIC_ON_SCREEN_CAP. */
const COOP_WAVE_SOFTCAP_KILLS_PER_STEP = 2;
/** Per-tier room-clear quotas keyed by coopBossesDefeatedCount (0–3+). */
const COOP_WAVE_QUOTA_BY_TIER = Object.freeze([6, 7, 8, 9]);
const GOLD_DROP_EXPIRE_MS = 60000;
const GOLD_VISUAL_PIECE_CAP = 20;
const MERCHANT_HEAL_COST = 60;
const MERCHANT_HEAL_AMOUNT = 125;
const MERCHANT_ITEM_COUNT = 1;
const MERCHANT_DASH_CHARGE_COST = 1050;
const MERCHANT_WEAPON_TALENT_COST = 850;
const MERCHANT_WEAPON_TALENT_MAX = 3;
const MERCHANT_UTILITY_MAX = 3;
const MERCHANT_OXYGEN_COST = 375;
const MERCHANT_WARPDRIVE_COST = 375;
const MERCHANT_BACKFILL_COST = 1200;
const MERCHANT_BOSS_ITEM_POOL = Object.freeze([
  { type: 'MANA_SHIELD', label: 'Mana Shield', stat: 'intellect', bonuses: { common: 7, rare: 10, epic: 13, legendary: 17 } },
  { type: 'COLOSSUS_LUNGS', label: 'Colossus Lungs', stat: 'stamina', bonuses: { common: 5, rare: 8, epic: 11, legendary: 15 } },
  { type: 'REAPER_CLAWS', label: 'Reaper Claws', stat: 'agility', bonuses: { common: 6, rare: 9, epic: 12, legendary: 16 } },
  { type: 'TITAN_HEART', label: 'Titan Heart', stat: 'strength', bonuses: { common: 6, rare: 9, epic: 12, legendary: 16 } },
]);
/** Premium relics that replace dash/talent pedestals when those are sold out for the run. */
const MERCHANT_BACKFILL_POOL = Object.freeze([
  ...dreamLayerItems.MERCHANT_EXODIA_POOL,
  'PERSEPHONE',
  'WYVERN_AMETHYST',
  'INFINITE_AMBER',
  'LIQUID_SAPPHIRE',
  'JAGUAR_EMERALD',
  'RAZED_DIAMOND',
]);
const DREAM_LAYER_HEAL_COST = 20;
const DREAM_LAYER_HEAL_AMOUNT = 200;
const DREAM_LAYER_WARDING_COST = 50;
const DREAM_LAYER_EXODIA_COST = 75;
const WARDING_PENDANT_BANES = Object.freeze([
  { type: 'WARD_TEMPLAR', label: "Templar's Bane", bannedEnemyType: 'templar', description: 'No enemy Templars spawn for the rest of this run.' },
  { type: 'WARD_WARLOCK', label: "Warlock's Bane", bannedEnemyType: 'warlock', description: 'No enemy Warlocks spawn for the rest of this run.' },
  { type: 'WARD_VIPER', label: "Viper's Bane", bannedEnemyType: 'viper', description: 'No enemy Vipers spawn for the rest of this run.' },
  { type: 'WARD_SHADE', label: "Shade's Bane", bannedEnemyType: 'shade', description: 'No enemy Shades spawn for the rest of this run.' },
  { type: 'WARD_WEAVER', label: "Weaver's Bane", bannedEnemyType: 'weaver', description: 'No enemy Weavers spawn for the rest of this run.' },
  { type: 'WARD_MARTYR', label: "Martyr's Bane", bannedEnemyType: 'martyr', description: 'No enemy Martyrs spawn for the rest of this run.' },
  { type: 'WARD_WRAITH', label: "Wraith's Bane", bannedEnemyType: 'wraith', description: 'No enemy Wraiths spawn for the rest of this run.' },
]);
const SOUL_WARD_COOLDOWN_MS = 6000;
const SOUL_WARD_DAMAGE_MULT = 2;
const EFFECT_PENDANTS = Object.freeze([
  {
    type: 'HUNTERS_MARK',
    label: "Hunter's Mark",
    iconPath: '/icons/items/huntersMark.svg',
    description: 'Your beast companions deal +30 melee damage.',
  },
  {
    type: 'SOUL_WARD',
    label: 'Soul Ward',
    iconPath: '/icons/items/soulWard.svg',
    description: 'Negate a hit and deal double the damage to your ally instead. 6s cooldown.',
  },
]);
const PENDANT_POOL = Object.freeze([...WARDING_PENDANT_BANES, ...EFFECT_PENDANTS]);
const EXODIA_ITEM_POOL = Object.freeze([
  { type: 'EXODIA_HELM', label: 'Exodia Helm' },
  { type: 'EXODIA_PAULDRONS', label: 'Exodia Pauldrons' },
  { type: 'EXODIA_PLATE', label: 'Exodia Plate' },
  { type: 'EXODIA_GREAVES', label: 'Exodia Greaves' },
  { type: 'EXODIA_GAUNTLETS', label: 'Exodia Gauntlets' },
  { type: 'ARCHMAGE_COIL', label: 'Archmage Coil' },
  { type: 'ARCHMAGE_BELT', label: 'Archmage Belt' },
  { type: 'HEXMETAL_CLOAK', label: 'Hexmetal Cloak' },
  { type: 'HEXMETAL_LEGGINGS', label: 'Hexmetal Leggings' },
  { type: 'HEXMETAL_VAMBRACES', label: 'Hexmetal Vambraces' },
]);
const DREAM_LAYER_RING_POOL = Object.freeze([
  { type: 'PERSEPHONE', label: 'Persephone', cost: 60 },
  { type: 'WYVERN_AMETHYST', label: 'Wyvern Amethyst', cost: 60 },
  { type: 'INFINITE_AMBER', label: 'Infinite Amber', cost: 60 },
  { type: 'LIQUID_SAPPHIRE', label: 'Liquid Sapphire', cost: 60 },
  { type: 'JAGUAR_EMERALD', label: 'Jaguar Emerald', cost: 60 },
  { type: 'RAZED_DIAMOND', label: 'Razed Diamond', cost: 60 },
]);
/** Combined armor-set + ring pool for Dream Layer legendary pedestals A/B. */
const DREAM_LAYER_COMBINED_LEGENDARY_POOL = Object.freeze([
  ...EXODIA_ITEM_POOL.map((entry) => ({
    type: entry.type,
    label: entry.label,
    cost: DREAM_LAYER_EXODIA_COST,
    category: 'armor',
  })),
  ...DREAM_LAYER_RING_POOL.map((entry) => ({
    type: entry.type,
    label: entry.label,
    cost: entry.cost,
    category: 'ring',
  })),
]);
const GOLD_REWARD_TABLE = Object.freeze({
  'knight:red': { min: 8, max: 10 },
  'knight:blue': { min: 7, max: 9 },
  'knight:green': { min: 6, max: 8 },
  'knight:purple': { min: 6, max: 8 },
  'viper': { min: 6, max: 8 },
  'shade': { min: 6, max: 8 },
  'templar': { min: 16, max: 24 },
  'warlock:purple': { min: 9, max: 14 },
  'warlock:red': { min: 12, max: 18 },
  'weaver:green': { min: 9, max: 14 },
  'weaver:blue': { min: 8, max: 12 },
  'ghoul': { min: 0, max: 4 },
  'wraith': { min: 50, max: 80 },
  'spectre': { min: 14, max: 20 },
  'death-knight': { min: 16, max: 22 },
  'shaman': { min: 16, max: 22 },
  'assassin': { min: 16, max: 22 },
  'serpent': { min: 0, max: 0 },
  'boss-serpent': { min: 0, max: 0 },
  'frost-queen': { min: 16, max: 22 },
  'wyvern': { min: 0, max: 0 },
  'terrorhawk': { min: 0, max: 0 },
  'tiger': { min: 0, max: 0 },
  'boss-tiger': { min: 0, max: 0 },
  'wolf': { min: 0, max: 0 },
  'boss-wolf': { min: 0, max: 0 },
  'bear': { min: 0, max: 0 },
  'boss-bear': { min: 0, max: 0 },
  'skyray': { min: 0, max: 0 },
  'bone-spider': { min: 0, max: 0 },
  'sentinel': { min: 16, max: 22 },
  'nemesis': { min: 28, max: 38 },
  'valkyrie': { min: 24, max: 32 },
  'medusa': { min: 28, max: 38 },
  'boss': { fixed: 50 },
  'boss2': { fixed: 100 },
  'boss3': { fixed: 150 },
  'destiny': { fixed: 175 },
});
/** Mirror client main arena constants (colored rooms use a circle at this radius). */
const MAIN_ARENA_HEX_RADIUS = 16;
const MAIN_MAP_HALF_X = MAIN_ARENA_HEX_RADIUS;
const MAIN_MAP_HALF_Z = MAIN_ARENA_HEX_RADIUS;
/** Keep foot XZ inside the playable disc with margin for collision radius. */
const MAIN_ARENA_SPAWN_INSET = 1.5;
const MAIN_CIRCLE_INNER_RADIUS = MAIN_ARENA_HEX_RADIUS - MAIN_ARENA_SPAWN_INSET;

/**
 * Hex combat arena (stat / trial) — must match `HexCombatArena.tsx`:
 * `HEX_ARENA_RADIUS` and `HexTileField` apothem − `HEX_FLOOR_MARGIN`.
 */
const HEX_ARENA_RADIUS = 18;
const HEX_FLOOR_MARGIN = 1.4;
const HEX_INNER_APOTHEM = HEX_ARENA_RADIUS * Math.cos(Math.PI / 6) - HEX_FLOOR_MARGIN;

function isInsideCircleArenaFloor(x, z, radius = MAIN_CIRCLE_INNER_RADIUS) {
  return Math.hypot(x, z) <= radius;
}

function isInsideHexArenaFloor(x, z, apothem = HEX_INNER_APOTHEM) {
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    if (x * Math.cos(a) + z * Math.sin(a) > apothem) return false;
  }
  return true;
}

function clampPositionToMainArenaXZ(x, z) {
  const maxR = MAIN_CIRCLE_INNER_RADIUS;
  const len = Math.hypot(x, z);
  if (len <= maxR || len < 1e-6) return { x, z };
  const s = maxR / len;
  return { x: x * s, z: z * s };
}

function clampPositionToErebusGateXZ(x, z) {
  const maxR = EREBUS_GATE_RADIUS - MAIN_ARENA_SPAWN_INSET;
  const len = Math.hypot(x, z);
  if (len <= maxR || len < 1e-6) return { x, z };
  const s = maxR / len;
  return { x: x * s, z: z * s };
}

function clampPositionToCastleRoomXZ(x, z) {
  const inset = MAIN_ARENA_SPAWN_INSET;
  const mx = CASTLE_ROOM_HALF_SIZE - inset;
  const mz = CASTLE_ROOM_HALF_SIZE - inset;
  return {
    x: Math.max(-mx, Math.min(mx, x)),
    z: Math.max(-mz, Math.min(mz, z)),
  };
}

function clampPositionToHexXZ(x, z, radius = FAE_REALM_HEX_RADIUS, inset = MAIN_ARENA_SPAWN_INSET) {
  const apothem = radius * Math.cos(Math.PI / 6) - inset;
  let cx = x;
  let cz = z;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      const excess = cx * nx + cz * nz - apothem;
      if (excess > 0) {
        cx -= nx * excess;
        cz -= nz * excess;
      }
    }
  }
  return { x: cx, z: cz };
}

function clampPositionToPentagonXZ(x, z, radius = CASTLE_ROOM_HALF_SIZE, inset = MAIN_ARENA_SPAWN_INSET) {
  const apothem = radius * Math.cos(Math.PI / 5) - inset;
  let cx = x;
  let cz = z;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < 5; i++) {
      const a = (2 * Math.PI / 5) * i - Math.PI / 2;
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      const excess = cx * nx + cz * nz - apothem;
      if (excess > 0) {
        cx -= nx * excess;
        cz -= nz * excess;
      }
    }
  }
  return { x: cx, z: cz };
}

/** Ally spawn beside room entry — sunken temple uses the smaller pentagon footprint. */
function resolveAllySpawnXZ(roomKind, offsetX) {
  const offsetZ = 0.6;
  if (roomKind === 'sunken_temple') {
    return clampPositionToPentagonXZ(
      CASTLE_ROOM_ENTRY_X + offsetX,
      CASTLE_ROOM_ENTRY_Z + offsetZ,
    );
  }
  if (roomKind === 'eternity_palace') {
    return clampPositionToHexXZ(
      ETERNITY_PALACE_ENTRY_X + offsetX,
      ETERNITY_PALACE_ENTRY_Z + offsetZ,
      ETERNITY_PALACE_HEX_RADIUS,
    );
  }
  if (roomKind === 'fae_realm') {
    return clampPositionToHexXZ(
      FAE_REALM_ENTRY_X + offsetX,
      FAE_REALM_ENTRY_Z + offsetZ,
      FAE_REALM_HEX_RADIUS,
    );
  }
  return clampPositionToMainArenaXZ(
    COOP_MAIN_ENTRY_X + offsetX,
    COOP_MAIN_ENTRY_Z + offsetZ,
  );
}

function maxCircleAbsXAtZ(z, radius = MAIN_CIRCLE_INNER_RADIUS) {
  const zAbs = Math.abs(z);
  if (zAbs >= radius) return 0;
  return Math.sqrt(radius * radius - z * z);
}

class GameRoom {
  constructor(roomId, io) {
    this.roomId = roomId;
    this.players = new Map();
    this.enemies = new Map();
    this.lastUpdate = Date.now();
    this.io = io; // Store io reference for broadcasting
    this.nextDamageEventId = 1;
    /** playerId -> { endX, endZ, castAt } for Explosive Talons detonation validation */
    this.explosiveTalonsCastByPlayer = new Map();

    // Game state management
    this.gameStarted = false;
    this.killCount = 0; // Shared kill count for all players
    this.gameMode = 'coop'; // Default to co-op mode

    // Item drop system
    this.droppedItems = new Map(); // itemId -> { id, type, stat, label, position, droppedAt }
    this.goldDrops = new Map(); // dropId -> { id, amount, pieceCount, position, droppedAt, enemyType, soulType }
    this.merchantInventory = [];
    this.dreamLayerInventory = [];
    /** Run-scoped enemy types excluded from spawning after Warding Pendant purchase. */
    this.bannedEnemyTypes = new Set();

    // Status effect tracking for enemies
    this.enemyStatusEffects = new Map(); // enemyId -> { stun: expiration, freeze: expiration, slow: expiration }
    /** playerId -> { stun: expiration, freeze: expiration } */
    this.playerStatusEffects = new Map();
    /** Blizzard talent: enemyId -> { stacks, expiresAt } (expiresAt = epoch ms) */
    this.enemyChill = new Map();

    // Initialize enemy AI system but don't start it yet
    this.enemyAI = new EnemyAI(roomId, io);
    this.enemyAI.setRoom(this);

    // Timer references for cleanup
    this.bossSpawnTimer = null;

    /** All room-level setTimeout IDs tracked for bulk cancellation on teardown. */
    this._scheduledTimers = new Set();

    /** playerId -> { intervalId, enemyTimeInAura: Map<enemyId, seconds> } */
    this.playerPrimeMateriaAuras = new Map();

    // Track when game started for boss spawning
    this.gameStartTime = 0;
    this.bossSpawned = false;

    /** enemyId -> { lastAt, lastStagger } — throttle stagger broadcasts (~10 Hz). */
    this._staggerBroadcastByEnemy = new Map();

    /** enemyId -> { lastAt, lastStacks } — throttle concentrated venom broadcasts (~10 Hz). */
    this._concentratedVenomBroadcastByEnemy = new Map();

    /** enemyId -> last emit ms — throttle DoT HP sync broadcasts (~10 Hz). */
    this._dotHpSyncLastMs = new Map();

    /** Co-op: false until a player uses the throne-room portal (enemies + AI start then). */
    this.combatArenaActive = false;

    // Kill tracking toward the staged co-op room clear target.
    this.skeletonKillCount = 0;

    /** Session archetype for co-op (`initializeEnemies`); sent on `camps-initialized` and `room-joined`. */
    this.sessionCampTypes = [];
    /** Last wave camp key (red/green/blue/purple); kept for loot when `sessionCampTypes` is cleared (e.g. boss intermission). */
    this.lastCoopWaveCampColor = null;
    /** Co-op: current room destination/reward kind (`blue`/`stat`/`boss`, etc.). */
    this.currentCoopRoomKind = null;
    /** Co-op: last completed room kind for pedestal reward dispatch. */
    this.clearedCoopRoomKind = null;

    /** Co-op throne: two distinct main-room archetypes offered until a portal is used. */
    this.thronePortalOffer = [];

    /** Set in `activateCombatArena` — consumed by `initializeEnemies` on first combat spawn. */
    this.pendingCoopArchetype = null;
    /** Set before special-room spawns; mixed rooms roll each enemy from any colored camp. */
    this.pendingCoopRoomKind = null;

    /**
     * Co-op: initial prep only (`rim` portals). Main-map intermissions use `coopMainArenaPortalPhase`.
     */
    this.coopThroneStep = 'rim';
    /** Combat rooms cleared in the current segment (colored/stat/trial only; merchant never counts). */
    this.coopSegmentCombatRoomsCleared = 0;
    /**
     * Defeated co-op bosses this run — picks next boss tier (Boss 1, Archon+, placeholder for Boss 3).
     */
    this.coopBossesDefeatedCount = 0;
    /** Co-op: per-color visit counts for roman-numeral hall titles (red/blue/green/purple only). */
    this.coopColoredRoomVisitCounts = { red: 0, blue: 0, green: 0, purple: 0 };
    /** Co-op: boss chamber entries this run — drives CHAMBER OF DEATH I/II/III titles. */
    this.coopBossRoomVisitCount = 0;
    /**
     * Set between waves on the main combat map (not throne): players pick next wave / boss in arena center.
     * @type {null | 'pick_wave2' | 'pick_pre_boss' | 'pre_boss_reward' | 'pre_boss_merchant' | 'pick_boss' | 'pick_post_boss' | 'pick_sunken_entry' | 'pick_eternity_entry' | 'pick_eternity_late_entry' | 'pick_trinity_finale' | 'eden_exit'}
     */
    this.coopMainArenaPortalPhase = null;
    /** Co-op: true during the mandatory Trial/Stat → Merchant → Boss sequence before each boss. */
    this.coopPreBossSequenceActive = false;
    /** Co-op: true while inside the pre-boss Trial or Stat room (post-quota; does not increment segment). */
    this.coopInPreBossSpecialRoom = false;
    /** Co-op: idempotent guard — first reward claim schedules the in-place merchant transition. */
    this._preBossRewardClaimScheduled = false;

    /** Co-op: true during boss fight on stripped throne shell and post-boss portal pause. */
    this.coopBossThroneArena = false;
    /**
     * Co-op: which boss fight the throne shell is for (`pick_boss` / dev shortcuts). Null after fight or on main map.
     * Drives client visuals: boss (GLB tier 1), boss2 Archon warlock, boss3 Weaver+Nexus, destiny dragon.
     * @type {null | 'boss' | 'boss2' | 'boss3' | 'destiny' | 'boss_all'}
     */
    this.coopThroneBossKind = null;
    /** Co-op: ensure post-boss intermission emits once per boss kill. */
    this._postBossIntermissionScheduled = false;

    /**
     * Co-op wave: campDef + isMixed flag for the current room (used by bonus spawners).
     * @type {null | { campDef: object, isMixed?: boolean }}
     */
    this.coopWaveSpawnPlan = null;
    /**
     * Pending required enemy specs for the current room (basics + titans + boss1).
     * @type {Array<{ kind: 'basic'|'titan'|'valkyrie'|'nemesis'|'boss1', unitType: string, pos: { x: number, z: number }, campDef: object, slotIndex: number }>}
     */
    this.coopRequiredQueue = [];
    /** Room-clear kill target for the current wave (6/7/8/9 by boss tier). */
    this.coopWaveQuota = 0;
    /** Single pending stagger timer for the spawn chain; null when idle. */
    this._coopSpawnChainTimer = null;
    /** Whether the current colored room has martyr spawning enabled (30% chance, rolled per room). */
    this.roomHasMartyrs = false;
    /** Whether the current room has any titans planned (derived from roomTitanQuota). */
    this.roomHasTitans = false;
    /** Number of titans to spawn this room (0–2), based on coopBossesDefeatedCount tier. */
    this.roomTitanQuota = 0;
    /** Post–Sunken Temple IV: independent valkyrie / nemesis rolls in colored rooms (same tier odds as titans). */
    this.roomValkyrieQuota = 0;
    this.roomNemesisQuota = 0;
    /** Global slot indices (0–7) reserved for titans in the current 8-enemy wave. */
    this.roomTitanSlotIndices = new Set();
    /** Whether the current colored room has a mini-boss1 spawn (33% chance after boss2 defeated). */
    this.roomHasMiniBoss1 = false;
    /** Tracks whether the mini-boss1 for this room has already been assigned to a slot. */
    this.miniBoss1SpawnedThisRoom = false;
    /** Tracks IDs of the three bosses in the triple-boss encounter; null outside that fight. */
    this.tripleBossIds = null;
    /** Tracks IDs of the two elite knights in the alternate Boss1 encounter; null outside that fight. */
    this.boss1EliteKnightIds = null;

    /** Co-op: per-index HP for `mushroomLayout` instances; reset on new game. */
    this.mushroomHealth = null;
    this._resetMushroomState();

    /** Dev-only: next `spawnBoss` forces `boss2` (Archon). Cleared in `spawnBoss`. */
    this._devSpawnBoss2 = false;
    /** Dev-only: next `spawnBoss` forces `boss3` (Weaver Nexus). Cleared in `spawnBoss`. */
    this._devSpawnBoss3 = false;
    /** Dev-only: next `spawnBoss` forces `destiny` (dragon). Cleared in `spawnBoss`. */
    this._devSpawnDestiny = false;

    /** Co-op: active portal loading gate before enemy AI and damage can affect players. */
    this.coopCombatTransitionId = 0;
    this.coopCombatTransition = null;
    /** Co-op: reject stale client position writes until this timestamp after portal teleport. */
    this.coopPostTeleportPositionGuardUntil = 0;
    /** Co-op: monotonic token bumped on each portal teleport; stamped on authoritative position events. */
    this.coopRoomEntryToken = 0;
    /**
     * Co-op: server-authoritative CustomSky preset index for the current room.
     * Rolled on each room entry (including throne prep); sunken temple keeps its fixed underwater sky.
     */
    this.coopSkyPresetIndex = 0;
    /**
     * Co-op: server-authoritative StylizedGrass preset index for prep ThroneRoom.
     * Rolled once on throne prep entry (startGame); bossArena keeps fixed purple.
     */
    this.coopGrassPresetIndex = 0;
    /** Co-op colored room: one whisper SFX per room visit on first combat engagement. */
    this.coopRoomWhisperPlayed = false;
    /** Co-op: pending post-teleport initial wave spawn (`_schedulePostTeleportEnemyWave`). */
    this._coopDelayedEnemyWaveTimeoutId = null;
    /** Lightweight AI tick for Beastmaster tigers when main combat AI is stopped (throne / intermission). */
    this.companionAiTimer = null;
    /** Throne prep: last time each player damaged the training dummy (for Beastmaster tiger engage). */
    this.throneDummyPlayerHitAt = new Map();

    /** Co-op intro: one-time 4-room sequence before the normal loop (start of run only). */
    this.coopIntroPending = false;
    this.coopIntroActive = false;
    /** @type {0|1|2|3|4} 0 = not started; 1–4 = current intro room index. */
    this.coopIntroRoomIndex = 0;
    /** True after an intro room is cleared — void portal at center is interactable. */
    this.coopIntroPortalOpen = false;
    /** True after intro room 4 cleared — fountain + ally choice + dual portals before normal loop. */
    this.coopIntroFountainPhase = false;
    /** True after any player uses the intro healing fountain. */
    this.coopIntroFountainUsed = false;
    /** True after a player recruits an ally at intro room 4; remains true for the rest of the run. */
    this.coopIntroAllyChoiceMade = false;
    /** @type {'knight'|'huntress'|'phantom'|'demon'|'enchantress'} Chosen co-op ally for the rest of the run. */
    this.coopAllyKind = 'knight';
    /** @type {string[]} Three random ally kinds offered at intro room 4 (subset of COOP_ALLY_KINDS). */
    this.coopAllyOffer = [];
    /** Living intro enemies remaining (fixed compositions, no bonus spawns). */
    this.coopIntroLivingCount = 0;

    /** Co-op Fae Realm: 3-room hex sequence between throne and Inner Sanctum. */
    this.coopFaeRealmPending = false;
    this.coopFaeRealmActive = false;
    /** @type {0|1|2|3} 0 = not started; 1–3 = current fae room index. */
    this.coopFaeRealmRoomIndex = 0;
    /** True after a fae room is cleared — void portal at center is interactable. */
    this.coopFaeRealmPortalOpen = false;
    /** Living fae realm enemies remaining (fixed compositions). */
    this.coopFaeRealmLivingCount = 0;
    /** @type {'tiger'|'wolf'|'bear'|'serpent'|'spider'|null} Boss recipe chosen for Fae Realm III. */
    this.coopFaeRealmBossKind = null;
    /** True after Fae Realm III clear has granted beast companions to all players. */
    this.coopFaeBeastCompanionGranted = false;
    /** @type {'tiger'|'wolf'|'bear'|'serpent'|'spider'|null} Kind granted for the rest of the run. */
    this.coopFaeBeastCompanionKind = null;

    /** Co-op sunken temple: one-time 4-room sequence after Boss 1 (mid-run). */
    this.coopSunkenActive = false;
    /** @type {0|1|2|3|4} 0 = not started; 1–4 = current sunken room index. */
    this.coopSunkenRoomIndex = 0;
    /** True after a sunken room is cleared — void portal at center is interactable. */
    this.coopSunkenPortalOpen = false;
    /** True after sunken room 4 cleared — fountain + ally choice + dual portals before main loop resumes. */
    this.coopSunkenFountainPhase = false;
    /** True after any player uses the sunken healing fountain. */
    this.coopSunkenFountainUsed = false;
    /** @deprecated Sunken IV uses sentinel loot instead; kept for snapshot compat. */
    this.coopSunkenAllyChoiceMade = false;
    /** Three free boss-loot offers rolled at end of sunken room 4 (ward / ring / exodia). */
    this.coopSunkenLootOffer = [];
    /** Player ids who claimed their free sunken loot pick. */
    this.coopSunkenLootClaimedPlayerIds = new Set();
    /** True once every connected player has claimed sunken loot — unlocks fountain. */
    this.coopSunkenLootPhaseComplete = false;
    /** True after the sunken temple sequence has been completed once this run. */
    this.coopSunkenCompleted = false;
    /** Living sunken temple enemies remaining (fixed compositions). */
    this.coopSunkenLivingCount = 0;

    /** Co-op Eternity's Palace: one-time 3-room sequence after Boss 2 (mid-run); rooms 4–5 after Boss 3. */
    this.coopEternityActive = false;
    /** @type {0|1|2|3|4|5} 0 = not started; 1–5 = current eternity room index. */
    this.coopEternityRoomIndex = 0;
    /** True after an eternity room is cleared — orange void portal at center is interactable. */
    this.coopEternityPortalOpen = false;
    /** True after eternity room 3/5 cleared — fountain + loot + dual portals before main loop resumes. */
    this.coopEternityFountainPhase = false;
    /** True after any player uses the eternity healing fountain. */
    this.coopEternityFountainUsed = false;
    /** Three free boss-loot offers rolled at end of eternity room 3 (ward / ring / exodia). */
    this.coopEternityLootOffer = [];
    /** Player ids who claimed their free eternity loot pick. */
    this.coopEternityLootClaimedPlayerIds = new Set();
    /** True once every connected player has claimed eternity loot — unlocks fountain. */
    this.coopEternityLootPhaseComplete = false;
    /** True after the early eternity palace sequence (I–III) has been completed once this run. */
    this.coopEternityCompleted = false;
    /** True while inside the late eternity sequence (rooms IV–V after Boss 3). */
    this.coopEternityLateSequence = false;
    /** True after the late eternity palace sequence (IV–V) has been completed once this run. */
    this.coopEternityLateCompleted = false;
    /** Living eternity palace enemies remaining (fixed compositions). */
    this.coopEternityLivingCount = 0;
    /** When true, the next `_registerCoopWaveKill` is skipped (Colossus resurrection). */
    this._skipNextCoopWaveKill = false;

    /** Main-loop optional void portal at center of dual gateway intermissions. */
    this.coopVoidPortalOffered = false;
    /** True while inside a deep sanctum (Inner Sanctum IV+) castle encounter. */
    this.coopDeepSanctumActive = false;
    /** @type {number} Roman level index for deep sanctum (starts at 5 on first entry). */
    this.coopDeepSanctumLevel = 0;
    /** @type {'gold'|'stat'|'talent'|null} Pre-rolled reward after deep sanctum clear. */
    this.coopDeepSanctumRewardKind = null;
    /** Living deep sanctum enemies remaining (fixed compositions). */
    this.coopDeepSanctumLivingCount = 0;
    /** Portal phase to restore after deep sanctum if segment quota was already met. */
    this.coopSavedPortalPhase = null;

    /** Co-op Eden: surprise safe room — at most once per boss segment. */
    this.coopEdenUsedThisSegment = false;
    /** True after any player drinks from the Eden fountain. */
    this.coopEdenFountainUsed = false;
    /** Intended destination after Eden (`red`/`stat`/`deep_sanctum`, etc.). */
    this.coopEdenResumeKind = null;
    /** Preserve pre-boss Trial/Stat semantics when Eden diverted from `pick_pre_boss`. */
    this.coopEdenResumeAsPreBoss = false;
    /** Portal phase to restore when Eden resume target is deep sanctum. */
    this.coopEdenResumePortalPhase = null;

    /** False Eden: tentacle spines remaining before fountain unlocks. */
    this.coopFalseEdenLivingCount = 0;
    /** True after all False Eden spines are destroyed. */
    this.coopFalseEdenCleared = false;

    /** Delirium Gate encounter state. */
    this.coopDeliriumActive = false;
    this.coopDeliriumLivingCount = 0;
    this.coopDeliriumEventEnded = false;
    this.coopDeliriumSuccess = false;
    /** @type {{ hp: number, maxHp: number, position: { x: number, z: number }, destroyed: boolean } | null} */
    this.deliriumStructure = null;
    this._deliriumSpawnIntervalId = null;
    this._deliriumEventEndTimeoutId = null;

    /** Erebus Gate: single-opponent surprise arena. */
    this.coopErebusGateActive = false;
    /** @type {Set<string> | null} */
    this.erebusGateOpponentIds = null;
  }

  /** Schedule a one-shot timer tracked for bulk cancellation on room teardown. */
  _scheduleTimeout(fn, ms) {
    const id = setTimeout(() => {
      this._scheduledTimers.delete(id);
      fn();
    }, ms);
    this._scheduledTimers.add(id);
    return id;
  }

  /** Cancel and discard all pending tracked room timers. */
  _cancelAllTimers() {
    if (this._deliriumSpawnIntervalId != null) {
      clearInterval(this._deliriumSpawnIntervalId);
      this._deliriumSpawnIntervalId = null;
    }
    this._scheduledTimers.forEach(id => clearTimeout(id));
    this._scheduledTimers.clear();
    this._coopDelayedEnemyWaveTimeoutId = null;
  }

  _clearCoopDelayedEnemyWaveTimer() {
    if (this._coopDelayedEnemyWaveTimeoutId == null) return;
    clearTimeout(this._coopDelayedEnemyWaveTimeoutId);
    this._scheduledTimers.delete(this._coopDelayedEnemyWaveTimeoutId);
    this._coopDelayedEnemyWaveTimeoutId = null;
  }

  /** Wait after portal teleport so players can reach the entry spawn before initial enemies appear. */
  _schedulePostTeleportEnemyWave() {
    this._clearCoopDelayedEnemyWaveTimer();
    this._coopDelayedEnemyWaveTimeoutId = this._scheduleTimeout(() => {
      this._coopDelayedEnemyWaveTimeoutId = null;
      if (!this.gameStarted || !this.combatArenaActive || this.bossSpawned) return;
      this.spawnEnemyWave();
    }, COOP_ROOM_ENTRY_ENEMY_SPAWN_DELAY_MS);
  }

  /** Clear any active DoT setIntervals attached to an enemy object. */
  _clearEnemyDoTTimers(enemyId) {
    const enemy = this.enemies.get(enemyId);
    if (!enemy) return;
    if (enemy._concentratedVenomIntervalId) {
      clearInterval(enemy._concentratedVenomIntervalId);
      enemy._concentratedVenomIntervalId = null;
    }
    if (enemy._entanglementIntervalId) {
      clearInterval(enemy._entanglementIntervalId);
      enemy._entanglementIntervalId = null;
    }
  }

  /** Schedule ignite DoT ticks: dotFraction of appliedDamage over durationMs in tickCount equal intervals. */
  _scheduleIgniteDot(enemyId, appliedDamage, dotFraction, durationMs, tickCount, fromPlayerId, player, dotDamageType = 'ignite') {
    const totalDot = Math.floor(appliedDamage * dotFraction);
    if (totalDot <= 0 || tickCount <= 0) return;
    const baseTick = Math.floor(totalDot / tickCount);
    const remainder = totalDot - baseTick * tickCount;
    const intervalMs = durationMs / tickCount;
    for (let i = 0; i < tickCount; i++) {
      const tickDamage = i === tickCount - 1 ? baseTick + remainder : baseTick;
      if (tickDamage <= 0) continue;
      const delayMs = Math.round(intervalMs * (i + 1));
      this._scheduleTimeout(() => {
        const target = this.enemies.get(enemyId);
        if (!target || target.isDying || target.health <= 0) return;
        const tickPlayer = fromPlayerId ? this.players.get(fromPlayerId) : player;
        const tyrantsCloak = tickPlayer?.coopStaggerRoomBoons?.tyrantsCloak;
        const igniteMeta = { damageType: dotDamageType };
        if (tyrantsCloak && dotDamageType === 'ignite') {
          igniteMeta.staggerToAdd = TYRANTS_CLOAK_IGNITE_STAGGER_PER_TICK;
        }
        if (
          tickPlayer?.coopStaggerRoomBoons?.duality &&
          Math.random() < DUALITY_BLIZZARD_PROC_CHANCE
        ) {
          this._spawnDualityBlizzard(
            { x: target.position.x, y: target.position.y, z: target.position.z },
            fromPlayerId,
            tickPlayer,
          );
        }
        this.damageEnemy(enemyId, tickDamage, fromPlayerId, tickPlayer || player, igniteMeta);
      }, delayMs);
    }
  }

  /**
   * Execute one stagger lightning bolt proc: damage, stun, duo boon side effects, VFX emit.
   * Used by natural stagger-cap procs and Tyrant's Cloak counter-strikes.
   * Does NOT modify staggerBuildup (caller handles decrement for natural procs).
   */
  _triggerStaggerLightningProc(enemyId, fromPlayerId, player) {
    if (!fromPlayerId) return null;
    const procEnemy = this.enemies.get(enemyId);
    if (!procEnemy || procEnemy.isDying || procEnemy.health <= 0) return null;

    const noStaggerTypes = new Set(['boss-skeleton', 'player-zombie', 'vengeful-spirit', 'tentacle-spine']);
    if (noStaggerTypes.has(procEnemy.type)) return null;

    const staggerBoons = this.players.get(fromPlayerId)?.coopStaggerRoomBoons;
    const STUN_MS = staggerBoons?.overshock ? 2500 : 1000;

    let procBase = staggerBoons?.guardbreak ? 300 : 150;
    if (staggerBoons?.unstableEnergy) {
      const agi = typeof staggerBoons.agility === 'number' ? staggerBoons.agility : 0;
      procBase += Math.max(0, agi) * 8;
    }
    let procDamage = procBase;
    let isCritical = false;
    if (staggerBoons?.unstableEnergy) {
      const critChance = typeof staggerBoons.critChance === 'number' ? staggerBoons.critChance : 0;
      const critMult = typeof staggerBoons.critDamageMult === 'number' ? staggerBoons.critDamageMult : 2;
      isCritical = Math.random() < critChance;
      if (isCritical) {
        procDamage = Math.floor(procBase * critMult);
      }
    }

    const livePlayer = player || this.players.get(fromPlayerId) || null;
    const procResult = this.damageEnemy(enemyId, procDamage, fromPlayerId, livePlayer, { damageType: 'stagger_break' });
    this.applyStatusEffect(enemyId, 'stun', STUN_MS);
    let afterEnemy = this.enemies.get(enemyId);

    // MAGMA CURRENT (duo: red + blue) — stagger lightning procs also IGNITE: 80% of proc damage over 4s, 4 ticks.
    const magmaCurrentDotEligible =
      staggerBoons?.magmaCurrent &&
      procResult &&
      !procResult.wasKilled &&
      afterEnemy &&
      !afterEnemy.isDying &&
      afterEnemy.health > 0;
    if (magmaCurrentDotEligible) {
      this.applyStatusEffect(enemyId, 'ignite', 4000, { fromPlayerId, player: livePlayer });
      this._scheduleIgniteDot(enemyId, procDamage, 0.8, 4000, 4, fromPlayerId, livePlayer);
    }

    // FORCE OF NATURE (duo: blue + green) — stagger lightning procs heal fromPlayer 1 HP per Agility point.
    if (staggerBoons?.forceOfNature && fromPlayerId && livePlayer && livePlayer.maxHealth != null) {
      const agi = typeof staggerBoons.agility === 'number' ? staggerBoons.agility : 0;
      const healAmt = Math.max(1, Math.round(Math.max(0, agi)));
      livePlayer.health = Math.min(livePlayer.maxHealth, livePlayer.health + healAmt);
      if (this.io) {
        this.io.to(this.roomId).emit('player-health-updated', {
          playerId: fromPlayerId,
          health: livePlayer.health,
          maxHealth: livePlayer.maxHealth,
        });
        this.io.to(this.roomId).emit('player-healing', {
          sourcePlayerId: fromPlayerId,
          targetPlayerId: fromPlayerId,
          healingAmount: healAmt,
          healingType: 'room_boon_force_of_nature',
          position: livePlayer.position || { x: 0, y: 0, z: 0 },
          timestamp: Date.now(),
        });
      }
    }

    // STORM SHIELD (ultimate: blue) — stagger lightning procs restore shield.
    if (staggerBoons?.stormShield && fromPlayerId && livePlayer) {
      const agi = typeof staggerBoons.agility === 'number' ? staggerBoons.agility : 0;
      const restore = STORM_SHIELD_BASE_RESTORE + STORM_SHIELD_AGILITY_PER_POINT * Math.max(0, agi);
      const maxShield = livePlayer.maxShield ?? 100;
      const newShield = Math.min(maxShield, (livePlayer.shield ?? 0) + restore);
      livePlayer.shield = newShield;
      if (this.io) {
        this.io.to(this.roomId).emit('player-shield-changed', {
          playerId: fromPlayerId,
          shield: newShield,
          maxShield,
        });
      }
    }

    // STORM WITCH (duo: blue + green) — stagger lightning procs also apply Concentrated Venom stacks.
    afterEnemy = this.enemies.get(enemyId);
    if (
      staggerBoons?.stormWitch &&
      procResult &&
      !procResult.wasKilled &&
      afterEnemy &&
      !afterEnemy.isDying &&
      afterEnemy.health > 0
    ) {
      this._addConcentratedVenomStacks(enemyId, STORM_WITCH_VENOM_STACKS, fromPlayerId);
    }

    if (this.io && afterEnemy && procResult) {
      this.io.to(this.roomId).emit('enemy-stagger-proc', {
        enemyId,
        position: { x: afterEnemy.position.x, y: afterEnemy.position.y, z: afterEnemy.position.z },
        damage: procDamage,
        isCritical,
        magmaCurrent: !!staggerBoons?.magmaCurrent,
        forceOfNature: !!staggerBoons?.forceOfNature,
        stormShield: !!staggerBoons?.stormShield,
        fromPlayerId: fromPlayerId || null,
        timestamp: Date.now(),
      });
    }

    return { procDamage, isCritical, procResult };
  }

  /** HELLFIRE VENOM (duo: red + green) — venom sources also Ignite (level-scaled, per-enemy ICD). */
  _tryHellfireVenomIgnite(enemyId, fromPlayerId, player) {
    if (!fromPlayerId) return;
    const livePlayer = player || this.players.get(fromPlayerId);
    if (!livePlayer?.coopZombieBoons?.hellfireVenom) return;

    const enemy = this.enemies.get(enemyId);
    if (!enemy || enemy.isDying || enemy.health <= 0) return;

    const now = Date.now();
    if (enemy._hellfireVenomIgniteAt && now - enemy._hellfireVenomIgniteAt < HELLFIRE_VENOM_IGNITE_ICD_MS) {
      return;
    }
    enemy._hellfireVenomIgniteAt = now;

    const level = typeof livePlayer.level === 'number' ? livePlayer.level : 1;
    const baseDamage = HELLFIRE_VENOM_IGNITE_BASE_PER_LEVEL * Math.max(1, level);
    this.applyStatusEffect(enemyId, 'ignite', HELLFIRE_VENOM_IGNITE_DURATION_MS, {
      fromPlayerId,
      player: livePlayer,
    });
    this._scheduleIgniteDot(
      enemyId,
      baseDamage,
      HELLFIRE_VENOM_IGNITE_DOT_FRACTION,
      HELLFIRE_VENOM_IGNITE_DURATION_MS,
      HELLFIRE_VENOM_IGNITE_TICKS,
      fromPlayerId,
      livePlayer,
    );
  }

  /** Wyvern Bite / Plague Crossentropy — Concentrated Venom stacks with 1s DPS ticks. */
  _getConcentratedVenomMaxStacks(fromPlayerId) {
    if (!fromPlayerId) return WYVERN_VENOM_MAX_STACKS;
    const player = this.players.get(fromPlayerId);
    if (player?.coopStaggerRoomBoons?.lethalInjection) return LETHAL_INJECTION_VENOM_MAX_STACKS;
    return WYVERN_VENOM_MAX_STACKS;
  }

  _addConcentratedVenomStacks(enemyId, stackCount, fromPlayerId) {
    const enemy = this.enemies.get(enemyId);
    if (!enemy || enemy.isDying || enemy.health <= 0) return;
    if (stackCount <= 0) return;
    const maxStacks = this._getConcentratedVenomMaxStacks(fromPlayerId);
    if (enemy.concentratedVenomStacks == null) enemy.concentratedVenomStacks = 0;
    enemy.concentratedVenomStacks = Math.min(
      maxStacks,
      enemy.concentratedVenomStacks + stackCount,
    );
    enemy.concentratedVenomExpireAt = Date.now() + WYVERN_VENOM_DURATION_MS;
    enemy.concentratedVenomLastPlayerId = fromPlayerId;

    this._maybeBroadcastConcentratedVenom(
      enemyId,
      enemy.concentratedVenomStacks,
      enemy.concentratedVenomExpireAt,
    );

    if (!enemy._concentratedVenomIntervalId) {
      enemy._concentratedVenomIntervalId = setInterval(() => {
        const e = this.enemies.get(enemyId);
        if (!e || e.isDying || e.health <= 0) {
          if (e && e._concentratedVenomIntervalId) {
            clearInterval(e._concentratedVenomIntervalId);
            e._concentratedVenomIntervalId = null;
          }
          return;
        }
        const now = Date.now();
        if (!e.concentratedVenomExpireAt || now >= e.concentratedVenomExpireAt) {
          if (e._concentratedVenomIntervalId) {
            clearInterval(e._concentratedVenomIntervalId);
            e._concentratedVenomIntervalId = null;
          }
          e.concentratedVenomStacks = 0;
          e.concentratedVenomExpireAt = null;
          this._maybeBroadcastConcentratedVenom(enemyId, 0, null);
          return;
        }
        const stacks = e.concentratedVenomStacks || 0;
        if (stacks <= 0) return;
        const tickPlayer = this.players.get(e.concentratedVenomLastPlayerId);
        this.damageEnemy(
          enemyId,
          stacks * WYVERN_VENOM_DPS_PER_STACK,
          e.concentratedVenomLastPlayerId,
          tickPlayer || null,
          { damageType: 'venom', wyvernBiteConcentratedDoT: true },
        );
      }, 1000);
    }

    const stackPlayer = fromPlayerId ? this.players.get(fromPlayerId) : null;
    this._tryHellfireVenomIgnite(enemyId, fromPlayerId, stackPlayer);
  }

  /** Remove all per-enemy map entries when an enemy is fully cleaned up. */
  _pruneEnemyMaps(enemyId) {
    this.enemyStatusEffects.delete(enemyId);
    this.enemyChill.delete(enemyId);
    this._staggerBroadcastByEnemy.delete(enemyId);
    this._concentratedVenomBroadcastByEnemy.delete(enemyId);
    this._dotHpSyncLastMs.delete(enemyId);
  }

  _resetMushroomState() {
    const n = mushroomLayout.MUSHROOM_COUNT;
    this.mushroomHealth = new Array(n).fill(mushroomConstants.MUSHROOM_MAX_HP);
  }

  /**
   * After the 3rd boss is defeated, Titan soul type is randomized across all four colors
   * regardless of the host room's camp. Before that threshold it matches the room camp.
   * @param {{ knightSoulType: string }} campDef
   * @returns {string}
   */
  _resolveTitanSoulType(campDef) {
    if (this.coopBossesDefeatedCount >= 3) {
      return COOP_COLORED_ROOM_TYPES[Math.floor(Math.random() * COOP_COLORED_ROOM_TYPES.length)];
    }
    return campDef.knightSoulType;
  }

  // ── Enemy archetype definitions ────────────────────────────────────────────
  // One archetype is randomly chosen per game session. All regular wave enemies share it.
  // enemyPool: unit types that can fill non-knight slots.
  // knightSoulType: the soul colour used for knights in this archetype.
  static get CAMP_TYPES() {
    return {
      blue:   { color: 'blue',   knightSoulType: 'blue',   enemyPool: ['knight', 'shade', 'weaver', ] },
      green:  { color: 'green',  knightSoulType: 'green',  enemyPool: ['knight', 'viper', 'weaver', 'ghoul', 'viper' ] },
      red:    { color: 'red',    knightSoulType: 'red',    enemyPool: ['knight', 'warlock', 'templar'] },
      purple: { color: 'purple', knightSoulType: 'purple', enemyPool: ['knight', 'shade', 'warlock' ] },
    };
  }

  // Start the actual game
  startGame(initiatingPlayerId) {
    if (this.gameStarted) {
      return false;
    }

    this.gameStarted = true;
    this.gameStartTime = Date.now();
    this.bossSpawned = false;
    this.skeletonKillCount = 0;
    this.coopThroneStep = 'rim';
    this.coopMainArenaPortalPhase = null;
    this.coopBossThroneArena = false;
    this.coopThroneBossKind = null;
    this.pendingCoopArchetype = null;
    this.pendingCoopRoomKind = null;
    this.currentCoopRoomKind = null;
    this.clearedCoopRoomKind = null;
    this._postBossIntermissionScheduled = false;
    this.coopSegmentCombatRoomsCleared = 0;
    this.coopBossesDefeatedCount = 0;
    this.coopColoredRoomVisitCounts = { red: 0, blue: 0, green: 0, purple: 0 };
    this.coopBossRoomVisitCount = 0;
    this.coopRoomWhisperPlayed = false;
    this._clearCoopCombatTransitionTimer();
    this.coopCombatTransition = null;
    this.coopCombatTransitionId = 0;
    this.coopPostTeleportPositionGuardUntil = 0;
    this.coopRoomEntryToken = 0;
    this.coopSkyPresetIndex = 0;
    this.coopGrassPresetIndex = 0;
    this._devSpawnBoss2 = false;
    this._devSpawnBoss3 = false;
    this._devSpawnDestiny = false;
    this._resetMushroomState();
    this.coopIntroPending = false;
    this.coopIntroActive = false;
    this.coopIntroRoomIndex = 0;
    this.coopIntroPortalOpen = false;
    this.coopIntroFountainPhase = false;
    this.coopIntroFountainUsed = false;
    this.coopIntroAllyChoiceMade = false;
    this.coopAllyKind = 'knight';
    this.coopAllyOffer = [];
    this.coopIntroLivingCount = 0;
    this.coopFaeRealmPending = false;
    this.coopFaeRealmActive = false;
    this.coopFaeRealmRoomIndex = 0;
    this.coopFaeRealmPortalOpen = false;
    this.coopFaeRealmLivingCount = 0;
    this.coopFaeRealmBossKind = null;
    this.coopFaeBeastCompanionGranted = false;
    this.coopFaeBeastCompanionKind = null;
    this.coopSunkenActive = false;
    this.coopSunkenRoomIndex = 0;
    this.coopSunkenPortalOpen = false;
    this.coopSunkenFountainPhase = false;
    this.coopSunkenFountainUsed = false;
    this.coopSunkenAllyChoiceMade = false;
    this.coopSunkenLootOffer = [];
    this.coopSunkenLootClaimedPlayerIds = new Set();
    this.coopSunkenLootPhaseComplete = false;
    this.coopSunkenCompleted = false;
    this.coopSunkenLivingCount = 0;
    this.coopEternityActive = false;
    this.coopEternityRoomIndex = 0;
    this.coopEternityPortalOpen = false;
    this.coopEternityFountainPhase = false;
    this.coopEternityFountainUsed = false;
    this.coopEternityLootOffer = [];
    this.coopEternityLootClaimedPlayerIds = new Set();
    this.coopEternityLootPhaseComplete = false;
    this.coopEternityCompleted = false;
    this.coopEternityLateSequence = false;
    this.coopEternityLateCompleted = false;
    this.coopEternityLivingCount = 0;
    this.coopVoidPortalOffered = false;
    this.coopDeepSanctumActive = false;
    this.coopDeepSanctumLevel = 0;
    this.coopDeepSanctumRewardKind = null;
    this.coopDeepSanctumLivingCount = 0;
    this.coopSavedPortalPhase = null;
    this.coopEdenUsedThisSegment = false;
    this.coopEdenFountainUsed = false;
    this.coopEdenResumeKind = null;
    this.coopEdenResumeAsPreBoss = false;
    this.coopEdenResumePortalPhase = null;
    this._resetFalseEdenState();
    this._resetDeliriumState();
    this._clearPreBossSequenceState();

    if (this.gameMode === 'coop') {
      for (const player of this.players.values()) {
        player.merchantDashChargePurchased = false;
        player.merchantWeaponTalentPurchases = 0;
        player.merchantOxygenPurchases = 0;
        player.merchantWarpdrivePurchases = 0;
        this._resetMerchantVisitPurchases(player);
        player.flow = 0;
        player.fate = 3;
        player.soulWardReadyAt = 0;
        this.bannedEnemyTypes = new Set();
        if (this.io) {
          this.io.to(this.roomId).emit('player-flow-changed', {
            playerId: player.id,
            flow: player.flow,
            timestamp: Date.now(),
          });
          this.io.to(this.roomId).emit('player-fate-changed', {
            playerId: player.id,
            fate: player.fate,
            timestamp: Date.now(),
          });
        }
      }
    }

    // Co-op: begin in the throne prep room — void portal opens after weapon pick
    if (this.gameMode === 'coop') {
      this.combatArenaActive = false;
      this.coopFaeRealmPending = true;
      this.coopIntroPending = false;
      this.thronePortalOffer = [];
      this._rollCoopSkyPresetForEntry(null);
      this._rollCoopGrassPresetForEntry();
      this.teleportAllPlayersToThroneRoom();
      this.spawnThroneTrainingDummy();
      this.syncAllBeastmasterTigers();
    } else {
      this.combatArenaActive = true;
    }

    if (this.gameMode === 'coop' && this.combatArenaActive) {
      this.spawnEnemyWave();
      this.startEnemyAI();
    }
    
    // Broadcast game start to all players
    if (this.io) {
      this.io.to(this.roomId).emit('game-started', {
        roomId: this.roomId,
        initiatingPlayerId,
        killCount: this.killCount,
        timestamp: Date.now(),
        combatArenaActive: this.combatArenaActive,
        players: this.getPlayers(),
        /** Full snapshot so clients never miss `enemy-spawned` (e.g. throne training dummy). */
        enemies: this.getEnemies(),
        thronePortalOffer: this.gameMode === 'coop' ? [...this.thronePortalOffer] : [],
        thronePortalLayout: this.getThronePortalLayout(),
        coopMainArenaPortalPhase: this.gameMode === 'coop' ? this.getCoopMainArenaPortalPhase() : null,
        coopBossThroneArena: this.gameMode === 'coop' ? this.getCoopBossThroneArena() : false,
        coopThroneBossKind: this.gameMode === 'coop' ? this.getCoopThroneBossKind() : null,
        coopTerrainTheme: this.gameMode === 'coop' ? this.getCoopTerrainTheme() : null,
        coopCurrentRoomKind: this.gameMode === 'coop' ? this.getCoopCurrentRoomKind() : null,
        coopClearedRoomKind: this.gameMode === 'coop' ? this.getCoopClearedRoomKind() : null,
        merchantInventory: this.gameMode === 'coop' ? this.getMerchantInventory() : [],
        mushroomState: this.getMushroomState(),
        coopIntroPending: this.gameMode === 'coop' ? this.coopIntroPending : false,
        coopIntroActive: this.gameMode === 'coop' ? this.coopIntroActive : false,
        coopIntroRoomIndex: this.gameMode === 'coop' ? this.coopIntroRoomIndex : 0,
        coopIntroPortalOpen: this.gameMode === 'coop' ? this.coopIntroPortalOpen : false,
        coopIntroFountainPhase: this.gameMode === 'coop' ? this.coopIntroFountainPhase : false,
        coopIntroFountainUsed: this.gameMode === 'coop' ? this.coopIntroFountainUsed : false,
        coopIntroAllyChoiceMade: this.gameMode === 'coop' ? this.coopIntroAllyChoiceMade : false,
        coopAllyKind: this.gameMode === 'coop' ? this.coopAllyKind : 'knight',
        coopAllyOffer: this.gameMode === 'coop' ? [...this.coopAllyOffer] : [],
        ...this.gameMode === 'coop' ? this._getFaeRealmPayloadFields() : {},
        ...this.gameMode === 'coop' ? this._getSunkenPayloadFields() : {},
        ...this.gameMode === 'coop' ? this._getEternityPayloadFields() : {},
        ...this.gameMode === 'coop' ? this._getDeepSanctumPayloadFields() : {},
        ...this.gameMode === 'coop' ? this._getEdenPayloadFields() : {},
        ...this.gameMode === 'coop' ? this._getCoopSkyPayloadFields() : {},
        ...this.gameMode === 'coop' ? this._getCoopGrassPayloadFields() : {},
      });
    }
    
    return true;
  }

  /** Co-op throne prep: snapshot for mid-session joiners (mirrors `game-started` payload). */
  getCoopThroneSyncPayload() {
    return {
      roomId: this.roomId,
      killCount: this.killCount,
      timestamp: Date.now(),
      combatArenaActive: this.combatArenaActive,
      players: this.getPlayers(),
      enemies: this.getEnemies(),
      thronePortalOffer: [...this.thronePortalOffer],
      thronePortalLayout: this.getThronePortalLayout(),
      coopMainArenaPortalPhase: this.getCoopMainArenaPortalPhase(),
      coopBossThroneArena: this.getCoopBossThroneArena(),
      coopThroneBossKind: this.getCoopThroneBossKind(),
      coopTerrainTheme: this.getCoopTerrainTheme(),
      coopCurrentRoomKind: this.getCoopCurrentRoomKind(),
      coopClearedRoomKind: this.getCoopClearedRoomKind(),
      merchantInventory: this.getMerchantInventory(),
      mushroomState: this.getMushroomState(),
      coopIntroPending: this.coopIntroPending,
      coopIntroActive: this.coopIntroActive,
      coopIntroRoomIndex: this.coopIntroRoomIndex,
      coopIntroPortalOpen: this.coopIntroPortalOpen,
      coopIntroFountainPhase: this.coopIntroFountainPhase,
      coopIntroFountainUsed: this.coopIntroFountainUsed,
      coopIntroAllyChoiceMade: this.coopIntroAllyChoiceMade,
      coopAllyKind: this.coopAllyKind,
      coopAllyOffer: [...this.coopAllyOffer],
      ...this._getFaeRealmPayloadFields(),
      ...this._getSunkenPayloadFields(),
      ...this._getEternityPayloadFields(),
      ...this._getDeepSanctumPayloadFields(),
      ...this._getEdenPayloadFields(),
      ...this._getCoopSkyPayloadFields(),
      ...this._getCoopGrassPayloadFields(),
    };
  }

  /** @returns {boolean} true when party is in co-op throne prep (game running, combat not started). */
  isInCoopThronePrep() {
    return (
      this.gameMode === 'coop'
      && this.gameStarted
      && !this.combatArenaActive
      && !this.coopBossThroneArena
    );
  }

  /**
   * Throne prep: Beastmaster tiger may attack the training dummy only after its owner
   * has recently damaged the dummy (within THRONE_DUMMY_TIGER_DISENGAGE_MS).
   */
  canBeastmasterTigerAttackThroneDummy(playerId) {
    if (!playerId || !this.isInCoopThronePrep()) return false;
    const lastHit = this.throneDummyPlayerHitAt?.get(playerId);
    if (!lastHit) return false;
    return Date.now() - lastHit <= THRONE_DUMMY_TIGER_DISENGAGE_MS;
  }

  /** Staging area (client grass/play disc `COOP_THRONE_ROOM_RADIUS` 24m in ThroneRoom; pillars/portals stay legacy layout). */
  spawnThroneTrainingDummy() {
    if (this.gameMode !== 'coop') return;
    for (const def of THRONE_TRAINING_DUMMY_SPAWNS) {
      const dummy = {
        id: def.id,
        type: 'training-dummy',
        position: { x: def.x, y: 0, z: def.z },
        rotation: rotationYTowardEntry(def.x, def.z),
        health: 1000,
        maxHealth: 1000,
        isDying: false,
        soulType: 'yellow',
        campType: 'yellow',
        dummyVisual: def.dummyVisual,
        staggerBuildup: 0,
      };
      this.enemies.set(dummy.id, dummy);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-spawned', { enemy: dummy, timestamp: Date.now() });
      }
    }
  }

  removeThroneTrainingDummy() {
    this.throneDummyPlayerHitAt?.clear();
    for (const def of THRONE_TRAINING_DUMMY_SPAWNS) {
      if (!this.enemies.has(def.id)) continue;
      this.enemies.delete(def.id);
      if (this.enemyAI) {
        this.enemyAI.removeEnemyAggro(def.id);
      }
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-removed', {
          enemyId: def.id,
          timestamp: Date.now(),
        });
      }
    }
  }

  teleportAllPlayersToThroneRoom() {
    const THRONE_SPAWN_R = 3;
    const ids = Array.from(this.players.keys());
    const n = Math.max(ids.length, 1);
    let idx = 0;
    for (const id of ids) {
      const player = this.players.get(id);
      if (!player) continue;
      const angle = (idx / n) * Math.PI * 2;
      player.position = {
        x: Math.sin(angle) * THRONE_SPAWN_R,
        y: 1,
        z: Math.cos(angle) * THRONE_SPAWN_R,
      };
      player.rotation = { x: 0, y: 0, z: 0 };
      idx++;
    }
    this.repositionBeastmasterTigersNearOwners();
  }

  teleportAllPlayersToCombatSpawn() {
    if (this.gameMode === 'coop') {
      this.coopRoomEntryToken += 1;
      this.coopPostTeleportPositionGuardUntil = Date.now() + COOP_POST_TELEPORT_POSITION_GUARD_MS;
      this._rollCoopSkyPresetForEntry(this.currentCoopRoomKind);
    }
    const spawnBaseX = COOP_MAIN_ENTRY_X;
    const spawnBaseZ = COOP_MAIN_ENTRY_Z;
    const totalPlayers = Math.max(this.players.size, 1);
    let idx = 0;
    for (const player of this.players.values()) {
      const angleStep = (Math.PI * 2) / Math.max(3, totalPlayers);
      const angle = idx * angleStep;
      const spawnRadius = 1.25;
      const rawX = spawnBaseX + Math.sin(angle) * spawnRadius;
      const rawZ = spawnBaseZ + Math.cos(angle) * spawnRadius;
      const c = this.currentCoopRoomKind === 'erebus_gate'
        ? clampPositionToErebusGateXZ(
          CASTLE_ROOM_ENTRY_X + Math.sin(angle) * spawnRadius,
          CASTLE_ROOM_ENTRY_Z + Math.cos(angle) * spawnRadius,
        )
        : clampPositionToMainArenaXZ(rawX, rawZ);
      player.position = {
        x: c.x,
        y: 1,
        z: c.z,
      };
      const y = rotationYTowardArenaCenter(c.x, c.z);
      player.rotation = { x: 0, y, z: 0 };
      idx++;
    }
    this.repositionBeastmasterTigersNearOwners();
  }

  isAlliedUnitEnemy(enemy) {
    return !!enemy && enemy.alliedUnit === true;
  }

  _isAlliedBeastCompanion(enemy) {
    return !!enemy && ALLIED_BEAST_ENEMY_TYPES.has(enemy.type);
  }

  _isCoopPlayerAllyEnemy(enemy) {
    return !!enemy && (
      enemy.alliedUnit === true
      || enemy.type === 'player-zombie'
      || enemy.type === 'vengeful-spirit'
      || this._isAlliedBeastCompanion(enemy)
    );
  }

  /** Necromancer — Vengeful Spirit melee: 15 + 1 per STR/STA/INT/AGI (from synced coopAlliedKnightBoons). */
  getVengefulSpiritDamage(player) {
    const b = player?.coopAlliedKnightBoons ?? {};
    const total =
      Math.max(0, typeof b.strength === 'number' ? b.strength : 0) +
      Math.max(0, typeof b.stamina === 'number' ? b.stamina : 0) +
      Math.max(0, typeof b.intellect === 'number' ? b.intellect : 0) +
      Math.max(0, typeof b.agility === 'number' ? b.agility : 0);
    return VENGEFUL_SPIRIT_BASE_DAMAGE + VENGEFUL_SPIRIT_DAMAGE_PER_STAT_POINT * total;
  }

  getBeastmasterTigerId(playerId) {
    return `beastmaster-tiger-${playerId}`;
  }

  getFaeBeastCompanionId(playerId) {
    return `fae-beast-${playerId}`;
  }

  getPackWolfCompanionId(playerId) {
    return `fae-beast-pack-${playerId}`;
  }

  playerHasHuntersMark(playerId) {
    const player = this.players.get(playerId);
    return !!player?.ownedUniqueItemTypes?.has?.('HUNTERS_MARK');
  }

  /** Fae primary companion (companionSlot === 'fae'), not pack wolf. */
  getLivingFaeBeastForPlayer(playerId) {
    const beastId = this.getFaeBeastCompanionId(playerId);
    const beast = this.enemies.get(beastId);
    if (!beast || beast.isDying || (beast.health ?? 0) <= 0) return null;
    return beast;
  }

  getLivingPackWolfForPlayer(playerId) {
    const beastId = this.getPackWolfCompanionId(playerId);
    const beast = this.enemies.get(beastId);
    if (!beast || beast.isDying || (beast.health ?? 0) <= 0) return null;
    return beast;
  }

  _playerOwnsPetUpgrade(player, upgradeId) {
    return !!player && player.coopPetCompanionUpgrade === upgradeId;
  }

  _isPlayerNearOwnedFaeBeast(player, range) {
    if (!player) return false;
    const beast = this.getLivingFaeBeastForPlayer(player.id);
    if (!beast) return false;
    const dx = (player.position?.x ?? 0) - (beast.position?.x ?? 0);
    const dz = (player.position?.z ?? 0) - (beast.position?.z ?? 0);
    return dx * dx + dz * dz <= range * range;
  }

  _applyPetCompanionUpgradeStats(beast, upgradeId) {
    if (!beast || !upgradeId) return;
    const kind = beast.beastCompanionKind;
    if (!isValidPetCompanionUpgradeId(upgradeId, kind)) return;
    const base = FAE_BEAST_STATS[kind];
    if (!base) return;

    // Reset to base then re-apply so respawn/sync never double-stacks.
    beast.maxHealth = base.maxHp;
    beast.damage = base.damage;
    beast.petUpgradeSiegebreaker = false;
    beast.petUpgradeApexKiller = false;
    beast.petUpgradeNeurotoxin = false;
    beast.petUpgradeEnsnaringThreads = false;
    beast.petUpgradeMendingSpores = false;
    beast.petUpgradeEvasion = false;
    beast.petUpgradePersistenceHunter = false;

    if (upgradeId === 'bear_siegebreaker') {
      beast.maxHealth = base.maxHp + PET_UPGRADE_SIEGEBREAKER_HP;
      beast.petUpgradeSiegebreaker = true;
    } else if (upgradeId === 'bear_grizzly_claws') {
      beast.damage = base.damage + PET_UPGRADE_GRIZZLY_CLAWS_DAMAGE;
    } else if (upgradeId === 'serpent_basilisk_hide'
      || upgradeId === 'spider_arachnid_matter'
      || upgradeId === 'tiger_dire_hide'
      || upgradeId === 'wolf_dire_hide') {
      beast.maxHealth = base.maxHp + PET_UPGRADE_DIRE_HIDE_HP;
    } else if (upgradeId === 'tiger_apex_killer') {
      beast.damage = PET_UPGRADE_APEX_KILLER_DAMAGE;
      beast.petUpgradeApexKiller = true;
    } else if (upgradeId === 'serpent_neurotoxin') {
      beast.petUpgradeNeurotoxin = true;
    } else if (upgradeId === 'spider_ensnaring_threads') {
      beast.petUpgradeEnsnaringThreads = true;
    } else if (upgradeId === 'bear_mending_spores'
      || upgradeId === 'serpent_mending_spores'
      || upgradeId === 'spider_mending_spores') {
      beast.petUpgradeMendingSpores = true;
    } else if (upgradeId === 'tiger_evasion') {
      beast.petUpgradeEvasion = true;
    } else if (upgradeId === 'wolf_persistence_hunter') {
      beast.petUpgradePersistenceHunter = true;
    }

    if (beast.health == null || beast.health <= 0 || beast.health > beast.maxHealth) {
      beast.health = beast.maxHealth;
    } else if (beast.health < beast.maxHealth && beast.health === base.maxHp) {
      // Fresh spawn at base HP with an HP upgrade — fill to new max.
      beast.health = beast.maxHealth;
    }
  }

  _applyPetCompanionUpgradeToPlayerBeast(playerId, upgradeId) {
    const player = this.players.get(playerId);
    if (!player || !upgradeId) return;
    const beast = this.getLivingFaeBeastForPlayer(playerId);
    if (beast) {
      const prevMax = beast.maxHealth ?? 0;
      const prevHp = beast.health ?? 0;
      this._applyPetCompanionUpgradeStats(beast, upgradeId);
      const maxDelta = Math.max(0, (beast.maxHealth ?? 0) - prevMax);
      if (maxDelta > 0) {
        beast.health = Math.min(beast.maxHealth, prevHp + maxDelta);
      }
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-spawned', { enemy: beast, timestamp: Date.now() });
      }
    }
    if (upgradeId === 'wolf_pack_expansion') {
      this.spawnPackWolfForPlayer(playerId);
    }
  }

  shouldPlayerHaveBeastmasterTiger(player) {
    if (!player) return false;
    return String(player.weapon || '').toUpperCase() === 'BOW'
      && String(player.weaponAspect || '').toUpperCase() === 'BEASTMASTER';
  }

  _hasLivingBeastCompanion() {
    for (const enemy of this.enemies.values()) {
      if (
        this._isAlliedBeastCompanion(enemy)
        && !enemy.isDying
        && (enemy.health ?? 0) > 0
      ) {
        return true;
      }
    }
    return false;
  }

  _hasLivingVengefulSpirit() {
    for (const enemy of this.enemies.values()) {
      if (
        enemy.type === 'vengeful-spirit'
        && !enemy.isDying
        && (enemy.health ?? 0) > 0
      ) {
        return true;
      }
    }
    return false;
  }

  /** True when companion AI should tick outside main combat AI (beasts, or spirits while arena inactive). */
  _needsCompanionAiTick() {
    if (this._hasLivingBeastCompanion()) return true;
    return this.combatArenaActive === false && this._hasLivingVengefulSpirit();
  }

  /** @deprecated Prefer `_hasLivingBeastCompanion` — kept for call-site clarity. */
  _hasLivingBeastmasterTiger() {
    return this._hasLivingBeastCompanion();
  }

  /** Place companion beside its owner at a slot-specific flank (used on spawn and after teleports). */
  getCompanionFollowPosition(owner, companionSlot = 'beastmaster') {
    const offset = COMPANION_SLOT_OFFSETS[companionSlot] ?? COMPANION_SLOT_OFFSETS.beastmaster;
    const yaw = typeof owner?.rotation === 'number'
      ? owner.rotation
      : (owner?.rotation?.y ?? 0);
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const ox = owner?.position?.x ?? 0;
    const oz = owner?.position?.z ?? 0;
    return {
      x: ox + offset.x * cos - offset.z * sin,
      y: 0,
      z: oz + offset.x * sin + offset.z * cos,
    };
  }

  /** @deprecated Prefer getCompanionFollowPosition(owner, 'beastmaster'). */
  _beastmasterTigerSpawnPosition(owner) {
    return this.getCompanionFollowPosition(owner, 'beastmaster');
  }

  _faeBeastEntryPosition(owner) {
    const ox = owner?.position?.x ?? 0;
    const oz = owner?.position?.z ?? 0;
    return {
      x: ox + FAE_BEAST_ENTRY_OFFSET.x,
      y: 0,
      z: oz + FAE_BEAST_ENTRY_OFFSET.z,
    };
  }

  _faeBeastMeetPosition(owner) {
    return this.getCompanionFollowPosition(owner, 'fae');
  }

  spawnBeastmasterTigerForPlayer(playerId) {
    if (this.gameMode !== 'coop' || !this.gameStarted) return null;
    const player = this.players.get(playerId);
    if (!this.shouldPlayerHaveBeastmasterTiger(player)) return null;

    const tigerId = this.getBeastmasterTigerId(playerId);
    const existing = this.enemies.get(tigerId);
    if (existing && !existing.isDying && (existing.health ?? 0) > 0) {
      return existing;
    }
    if (existing) {
      this.removeBeastmasterTigerForPlayer(playerId);
    }

    const pos = this._beastmasterTigerSpawnPosition(player);
    const tiger = {
      id: tigerId,
      type: 'allied-tiger',
      position: { x: pos.x, y: 0, z: pos.z },
      rotation: player.rotation?.y ?? 0,
      health: BEASTMASTER_TIGER_MAX_HP,
      maxHealth: BEASTMASTER_TIGER_MAX_HP,
      isDying: false,
      damage: BEASTMASTER_TIGER_DAMAGE,
      attackCooldown: BEASTMASTER_TIGER_ATTACK_COOLDOWN_MS,
      moveSpeed: BEASTMASTER_TIGER_WALK_SPEED,
      alliedUnit: true,
      ownerPlayerId: playerId,
      combatInitiated: false,
      alliedTargetEnemyId: null,
      attackVariant: 1,
      tigerLocomotion: 'walk',
      beastCompanionPhase: 'active',
      beastCompanionKind: 'tiger',
      companionSlot: 'beastmaster',
      visualScale: 1.0,
      staggerBuildup: 0,
    };
    this.addEnemy(tiger);
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-spawned', { enemy: tiger, timestamp: Date.now() });
    }
    this.startCompanionAI();
    return tiger;
  }

  removeBeastmasterTigerForPlayer(playerId) {
    const tigerId = this.getBeastmasterTigerId(playerId);
    if (!this.enemies.has(tigerId)) return;
    this._clearEnemyDoTTimers(tigerId);
    this._pruneEnemyMaps(tigerId);
    if (this.enemyAI) {
      this.enemyAI.removeEnemyAggro(tigerId);
    }
    this.enemies.delete(tigerId);
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-removed', {
        enemyId: tigerId,
        timestamp: Date.now(),
      });
    }
    if (!this._hasLivingBeastCompanion()) {
      this.stopCompanionAI();
    }
  }

  removeFaeBeastCompanionForPlayer(playerId) {
    const beastId = this.getFaeBeastCompanionId(playerId);
    if (!this.enemies.has(beastId)) return;
    this._clearEnemyDoTTimers(beastId);
    this._pruneEnemyMaps(beastId);
    if (this.enemyAI) {
      this.enemyAI.removeEnemyAggro(beastId);
    }
    this.enemies.delete(beastId);
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-removed', {
        enemyId: beastId,
        timestamp: Date.now(),
      });
    }
    if (!this._hasLivingBeastCompanion()) {
      this.stopCompanionAI();
    }
  }

  removePackWolfForPlayer(playerId) {
    const beastId = this.getPackWolfCompanionId(playerId);
    if (!this.enemies.has(beastId)) return;
    this._clearEnemyDoTTimers(beastId);
    this._pruneEnemyMaps(beastId);
    if (this.enemyAI) {
      this.enemyAI.removeEnemyAggro(beastId);
    }
    this.enemies.delete(beastId);
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-removed', {
        enemyId: beastId,
        timestamp: Date.now(),
      });
    }
    if (!this._hasLivingBeastCompanion()) {
      this.stopCompanionAI();
    }
  }

  spawnPackWolfForPlayer(playerId) {
    if (this.gameMode !== 'coop' || !this.gameStarted) return null;
    const player = this.players.get(playerId);
    if (!player || player.coopPetCompanionUpgrade !== 'wolf_pack_expansion') return null;
    if (!this.coopFaeBeastCompanionGranted) return null;
    const kind = normalizeFaeBeastCompanionKind(this.coopFaeBeastCompanionKind);
    if (kind !== 'wolf') return null;
    const stats = FAE_BEAST_STATS.wolf;
    if (!stats) return null;

    const beastId = this.getPackWolfCompanionId(playerId);
    const existing = this.enemies.get(beastId);
    if (existing && !existing.isDying && (existing.health ?? 0) > 0) {
      return existing;
    }
    if (existing) {
      this.removePackWolfForPlayer(playerId);
    }

    const pos = this.getCompanionFollowPosition(player, 'fae_pack');
    const beast = {
      id: beastId,
      type: stats.enemyType,
      position: { x: pos.x, y: 0, z: pos.z },
      rotation: player.rotation?.y ?? 0,
      health: stats.maxHp,
      maxHealth: stats.maxHp,
      isDying: false,
      damage: stats.damage,
      attackCooldown: stats.attackCooldownMs,
      moveSpeed: stats.walkSpeed,
      alliedUnit: true,
      ownerPlayerId: playerId,
      combatInitiated: false,
      alliedTargetEnemyId: null,
      attackVariant: 1,
      tigerLocomotion: 'walk',
      beastCompanionPhase: 'active',
      beastCompanionKind: 'wolf',
      companionSlot: 'fae_pack',
      visualScale: stats.visualScale,
      staggerBuildup: 0,
      isPackWolf: true,
    };
    this.addEnemy(beast);
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-spawned', { enemy: beast, timestamp: Date.now() });
    }
    this.startCompanionAI();
    return beast;
  }

  syncPackWolfForPlayer(playerId) {
    if (this.gameMode !== 'coop' || !this.gameStarted) return;
    const player = this.players.get(playerId);
    if (!player || player.coopPetCompanionUpgrade !== 'wolf_pack_expansion') {
      this.removePackWolfForPlayer(playerId);
      return;
    }
    const existing = this.getLivingPackWolfForPlayer(playerId);
    if (existing) {
      this.startCompanionAI();
      return;
    }
    this.spawnPackWolfForPlayer(playerId);
  }

  /**
   * Ensure Beastmaster players have a living tiger; remove tiger if aspect/weapon no longer qualifies.
   * Dead/missing tigers are respawned at full HP.
   */
  syncBeastmasterTigerForPlayer(playerId) {
    if (this.gameMode !== 'coop' || !this.gameStarted) return;
    const player = this.players.get(playerId);
    if (!this.shouldPlayerHaveBeastmasterTiger(player)) {
      this.removeBeastmasterTigerForPlayer(playerId);
      return;
    }
    const tigerId = this.getBeastmasterTigerId(playerId);
    const existing = this.enemies.get(tigerId);
    if (existing && !existing.isDying && (existing.health ?? 0) > 0) {
      this.startCompanionAI();
      return;
    }
    this.spawnBeastmasterTigerForPlayer(playerId);
  }

  spawnFaeBeastCompanionForPlayer(playerId, kind, { walkIn = true } = {}) {
    if (this.gameMode !== 'coop' || !this.gameStarted) return null;
    const player = this.players.get(playerId);
    if (!player) return null;
    const companionKind = normalizeFaeBeastCompanionKind(kind);
    if (!companionKind) return null;
    const stats = FAE_BEAST_STATS[companionKind];
    if (!stats) return null;

    const beastId = this.getFaeBeastCompanionId(playerId);
    const existing = this.enemies.get(beastId);
    if (existing && !existing.isDying && (existing.health ?? 0) > 0) {
      return existing;
    }
    if (existing) {
      this.removeFaeBeastCompanionForPlayer(playerId);
    }

    const pos = walkIn
      ? this._faeBeastEntryPosition(player)
      : this._faeBeastMeetPosition(player);
    const meet = this._faeBeastMeetPosition(player);
    const rotation = Math.atan2(meet.x - pos.x, meet.z - pos.z);
    const beast = {
      id: beastId,
      type: stats.enemyType,
      position: { x: pos.x, y: 0, z: pos.z },
      rotation,
      health: stats.maxHp,
      maxHealth: stats.maxHp,
      isDying: false,
      damage: stats.damage,
      attackCooldown: stats.attackCooldownMs,
      moveSpeed: stats.walkSpeed,
      alliedUnit: true,
      ownerPlayerId: playerId,
      combatInitiated: false,
      alliedTargetEnemyId: null,
      attackVariant: 1,
      tigerLocomotion: 'walk',
      beastCompanionPhase: walkIn ? 'entering' : 'active',
      beastCompanionKind: companionKind,
      companionSlot: 'fae',
      visualScale: stats.visualScale,
      staggerBuildup: 0,
    };
    const upgradeId = player.coopPetCompanionUpgrade || null;
    if (upgradeId) {
      this._applyPetCompanionUpgradeStats(beast, upgradeId);
    }
    this.addEnemy(beast);
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-spawned', { enemy: beast, timestamp: Date.now() });
    }
    this.startCompanionAI();
    return beast;
  }

  syncFaeBeastCompanionForPlayer(playerId) {
    if (this.gameMode !== 'coop' || !this.gameStarted) return;
    if (!this.coopFaeBeastCompanionGranted) return;
    const kind = normalizeFaeBeastCompanionKind(this.coopFaeBeastCompanionKind);
    if (!kind) return;
    if (!this.players.has(playerId)) {
      this.removeFaeBeastCompanionForPlayer(playerId);
      return;
    }
    const beastId = this.getFaeBeastCompanionId(playerId);
    const existing = this.enemies.get(beastId);
    if (existing && !existing.isDying && (existing.health ?? 0) > 0) {
      this.startCompanionAI();
      return;
    }
    // Respawn beside owner (no walk-in on mid-run revive).
    this.spawnFaeBeastCompanionForPlayer(playerId, kind, { walkIn: false });
  }

  syncAllBeastmasterTigers() {
    if (this.gameMode !== 'coop' || !this.gameStarted) return;
    for (const playerId of this.players.keys()) {
      this.syncBeastmasterTigerForPlayer(playerId);
    }
    // Remove orphan tigers whose owner left
    for (const [id, enemy] of this.enemies) {
      if (enemy?.type !== 'allied-tiger' || enemy?.companionSlot === 'fae') continue;
      const ownerId = enemy.ownerPlayerId;
      if (!ownerId || !this.players.has(ownerId)) {
        this._clearEnemyDoTTimers(id);
        this._pruneEnemyMaps(id);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(id);
        this.enemies.delete(id);
        if (this.io) {
          this.io.to(this.roomId).emit('enemy-removed', { enemyId: id, timestamp: Date.now() });
        }
      }
    }
    if (!this._hasLivingBeastCompanion()) {
      this.stopCompanionAI();
    } else {
      this.startCompanionAI();
    }
  }

  syncAllFaeBeastCompanions() {
    if (this.gameMode !== 'coop' || !this.gameStarted) return;
    if (!this.coopFaeBeastCompanionGranted) return;
    for (const playerId of this.players.keys()) {
      this.syncFaeBeastCompanionForPlayer(playerId);
      this.syncPackWolfForPlayer(playerId);
    }
    for (const [id, enemy] of this.enemies) {
      if (!this._isAlliedBeastCompanion(enemy)) continue;
      if (enemy?.companionSlot !== 'fae' && enemy?.companionSlot !== 'fae_pack') continue;
      const ownerId = enemy.ownerPlayerId;
      if (!ownerId || !this.players.has(ownerId)) {
        this._clearEnemyDoTTimers(id);
        this._pruneEnemyMaps(id);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(id);
        this.enemies.delete(id);
        if (this.io) {
          this.io.to(this.roomId).emit('enemy-removed', { enemyId: id, timestamp: Date.now() });
        }
      }
    }
    if (!this._hasLivingBeastCompanion()) {
      this.stopCompanionAI();
    } else {
      this.startCompanionAI();
    }
  }

  grantFaeBeastCompanionsToAllPlayers() {
    if (this.gameMode !== 'coop' || !this.gameStarted) return;
    if (this.coopFaeBeastCompanionGranted) return;
    const kind = normalizeFaeBeastCompanionKind(this.coopFaeRealmBossKind);
    if (!kind) return;
    this.coopFaeBeastCompanionGranted = true;
    this.coopFaeBeastCompanionKind = kind;
    for (const playerId of this.players.keys()) {
      this.spawnFaeBeastCompanionForPlayer(playerId, kind, { walkIn: true });
    }
  }

  /** Keep living beast companions beside owners after teleports (throne / combat spawn). */
  repositionBeastmasterTigersNearOwners() {
    this.repositionAllBeastCompanionsNearOwners();
  }

  repositionAllBeastCompanionsNearOwners() {
    for (const enemy of this.enemies.values()) {
      if (!this._isAlliedBeastCompanion(enemy) || enemy.isDying || (enemy.health ?? 0) <= 0) continue;
      // Don't snap mid walk-in.
      if (enemy.beastCompanionPhase === 'entering') continue;
      const owner = this.players.get(enemy.ownerPlayerId);
      if (!owner) continue;
      const slot = enemy.companionSlot === 'fae'
        ? 'fae'
        : (enemy.companionSlot === 'fae_pack' ? 'fae_pack' : 'beastmaster');
      const pos = this.getCompanionFollowPosition(owner, slot);
      enemy.position = { x: pos.x, y: 0, z: pos.z };
      enemy.rotation = owner.rotation?.y ?? enemy.rotation ?? 0;
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-moved', {
          enemyId: enemy.id,
          position: enemy.position,
          rotation: enemy.rotation,
          timestamp: Date.now(),
        });
      }
    }
  }

  startCompanionAI() {
    if (this.gameMode !== 'coop' || !this.gameStarted) return;
    if (this.companionAiTimer) return;
    if (!this._needsCompanionAiTick()) return;
    this.companionAiTimer = setInterval(() => {
      if (!this.gameStarted || !this._needsCompanionAiTick()) {
        this.stopCompanionAI();
        return;
      }
      // Main combat AI already ticks beasts — avoid double-updates.
      if (this.enemyAI?.aiTimer) return;
      if (this.isCoopCombatTransitionActive()) return;
      this.enemyAI?.updateCompanionAI?.();
    }, 33);
  }

  stopCompanionAI() {
    if (this.companionAiTimer) {
      clearInterval(this.companionAiTimer);
      this.companionAiTimer = null;
    }
  }

  spawnOrReviveAlliedKnightForEnemyRoom() {
    return this.spawnOrReviveAlliedUnitsForEnemyRoom()?.knight ?? null;
  }

  spawnOrReviveAlliedUnitsForEnemyRoom() {
    if (this.gameMode !== 'coop' || !this.gameStarted || !this.combatArenaActive) return null;
    if (
      this.coopBossThroneArena
      || this.bossSpawned
      || this.currentCoopRoomKind === 'boss'
      || this.currentCoopRoomKind === 'merchant'
      || this.currentCoopRoomKind === 'intro'
      || this.currentCoopRoomKind === 'fae_realm'
      || this.currentCoopRoomKind === 'eternity_palace'
      || this.currentCoopRoomKind === 'eden'
      || this.currentCoopRoomKind === 'false_eden'
      || this.currentCoopRoomKind === 'eden_finale'
      || this.currentCoopRoomKind === 'delirium_gate'
      || this.currentCoopRoomKind === 'erebus_gate'
    ) {
      return null;
    }

    if (!COOP_ALLIED_HEALER_ENABLED && this.enemies.has(ALLIED_HEALER_ID)) {
      this.enemies.delete(ALLIED_HEALER_ID);
      if (this.enemyAI) {
        this.enemyAI.removeEnemyAggro(ALLIED_HEALER_ID);
      }
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-removed', {
          enemyId: ALLIED_HEALER_ID,
          timestamp: Date.now(),
        });
      }
    }

    const allyKind = normalizeCoopAllyKind(this.coopAllyKind);
    const primaryAllyId = COOP_ALLY_KIND_TO_ID[allyKind];
    for (const staleAllyId of ALL_COOP_PRIMARY_ALLY_IDS) {
      if (staleAllyId === primaryAllyId || !this.enemies.has(staleAllyId)) continue;
      this.enemies.delete(staleAllyId);
      if (this.enemyAI) {
        this.enemyAI.removeEnemyAggro(staleAllyId);
      }
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-removed', {
          enemyId: staleAllyId,
          timestamp: Date.now(),
        });
      }
    }

    const allyPos = resolveAllySpawnXZ(this.currentCoopRoomKind, 2.1);
    const healerPos = resolveAllySpawnXZ(this.currentCoopRoomKind, -2.1);
    let primaryAlly = null;

    if (allyKind === 'huntress') {
      primaryAlly = {
        id: ALLIED_HUNTRESS_ID,
        type: 'allied-huntress',
        position: { x: allyPos.x, y: 0, z: allyPos.z },
        rotation: rotationYTowardArenaCenter(allyPos.x, allyPos.z),
        health: ALLIED_HUNTRESS_MAX_HP,
        maxHealth: ALLIED_HUNTRESS_MAX_HP,
        isDying: false,
        damage: ALLIED_HUNTRESS_DAMAGE,
        attackCooldown: ALLIED_HUNTRESS_ATTACK_COOLDOWN_MS,
        moveSpeed: ALLIED_HUNTRESS_MOVE_SPEED,
        alliedUnit: true,
        combatInitiated: false,
        alliedTargetEnemyId: null,
        staggerBuildup: 0,
      };
    } else if (allyKind === 'phantom') {
      primaryAlly = {
        id: ALLIED_PHANTOM_ID,
        type: 'allied-phantom',
        position: { x: allyPos.x, y: 0, z: allyPos.z },
        rotation: rotationYTowardArenaCenter(allyPos.x, allyPos.z),
        health: ALLIED_PHANTOM_MAX_HP,
        maxHealth: ALLIED_PHANTOM_MAX_HP,
        isDying: false,
        damage: ALLIED_PHANTOM_DAMAGE,
        attackCooldown: ALLIED_PHANTOM_ATTACK_COOLDOWN_MS,
        moveSpeed: ALLIED_PHANTOM_MOVE_SPEED,
        alliedUnit: true,
        soulType: 'yellow',
        combatInitiated: false,
        alliedTargetEnemyId: null,
        staggerBuildup: 0,
      };
    } else if (allyKind === 'demon') {
      primaryAlly = {
        id: ALLIED_DEMON_ID,
        type: 'allied-demon',
        position: { x: allyPos.x, y: 0, z: allyPos.z },
        rotation: rotationYTowardArenaCenter(allyPos.x, allyPos.z),
        health: ALLIED_DEMON_MAX_HP,
        maxHealth: ALLIED_DEMON_MAX_HP,
        isDying: false,
        damage: ALLIED_DEMON_DAMAGE,
        attackCooldown: ALLIED_DEMON_ATTACK_COOLDOWN_MS,
        moveSpeed: ALLIED_DEMON_MOVE_SPEED,
        alliedUnit: true,
        combatInitiated: false,
        alliedTargetEnemyId: null,
        staggerBuildup: 0,
      };
    } else if (allyKind === 'enchantress') {
      primaryAlly = {
        id: ALLIED_ENCHANTRESS_ID,
        type: 'allied-enchantress',
        position: { x: allyPos.x, y: 0, z: allyPos.z },
        rotation: rotationYTowardArenaCenter(allyPos.x, allyPos.z),
        health: ALLIED_ENCHANTRESS_MAX_HP,
        maxHealth: ALLIED_ENCHANTRESS_MAX_HP,
        isDying: false,
        moveSpeed: ALLIED_ENCHANTRESS_MOVE_SPEED,
        alliedUnit: true,
        soulType: 'green',
        combatInitiated: false,
        alliedTargetEnemyId: null,
        staggerBuildup: 0,
      };
    } else {
      primaryAlly = {
        id: ALLIED_KNIGHT_ID,
        type: 'allied-knight',
        position: { x: allyPos.x, y: 0, z: allyPos.z },
        rotation: rotationYTowardArenaCenter(allyPos.x, allyPos.z),
        health: ALLIED_KNIGHT_MAX_HP,
        maxHealth: ALLIED_KNIGHT_MAX_HP,
        isDying: false,
        damage: ALLIED_KNIGHT_DAMAGE,
        attackCooldown: ALLIED_KNIGHT_ATTACK_COOLDOWN_MS,
        moveSpeed: ALLIED_KNIGHT_MOVE_SPEED,
        alliedUnit: true,
        combatInitiated: false,
        alliedTargetEnemyId: null,
        staggerBuildup: 0,
        alliedOrbSlots: Array(ALLIED_KNIGHT_ORB_COUNT).fill(true),
        alliedOrbRecoverAt: Array(ALLIED_KNIGHT_ORB_COUNT).fill(0),
        alliedSmiteCooldownUntil: 0,
      };
    }
    let healer = null;
    if (COOP_ALLIED_HEALER_ENABLED) {
      healer = {
        id: ALLIED_HEALER_ID,
        type: 'allied-healer',
        position: { x: healerPos.x, y: 0, z: healerPos.z },
        rotation: rotationYTowardArenaCenter(healerPos.x, healerPos.z),
        health: ALLIED_HEALER_MAX_HP,
        maxHealth: ALLIED_HEALER_MAX_HP,
        isDying: false,
        damage: 0,
        attackCooldown: 0,
        moveSpeed: ALLIED_HEALER_MOVE_SPEED,
        alliedUnit: true,
        combatInitiated: false,
        staggerBuildup: 0,
        alliedGreaterHealCooldownUntil: 0,
        allyHealerAttackCooldownUntil: 0,
      };
    }

    this.addEnemy(primaryAlly);
    if (healer) {
      this.addEnemy(healer);
    }
    if (this.io) {
      const timestamp = Date.now();
      this.io.to(this.roomId).emit('enemy-spawned', { enemy: primaryAlly, timestamp });
      if (healer) {
        this.io.to(this.roomId).emit('enemy-spawned', { enemy: healer, timestamp });
      }
    }
    return { primaryAlly, healer };
  }

  _pickThronePortalOffer() {
    const keys = COOP_COLORED_ROOM_TYPES;
    const a = keys[Math.floor(Math.random() * keys.length)];
    let b = keys[Math.floor(Math.random() * keys.length)];
    while (b === a) {
      b = keys[Math.floor(Math.random() * keys.length)];
    }
    this.thronePortalOffer = [a, b];
  }

  _pickCoopAllyOffer() {
    const pool = [...COOP_ALLY_KINDS];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.coopAllyOffer = pool.slice(0, 2);
  }

  _pickPostFirstRoomPortalOffer() {
    const color = COOP_COLORED_ROOM_TYPES[Math.floor(Math.random() * COOP_COLORED_ROOM_TYPES.length)];
    const special = COOP_MID_ACT_SPECIAL_ROOM_TYPES[
      Math.floor(Math.random() * COOP_MID_ACT_SPECIAL_ROOM_TYPES.length)
    ];
    this.thronePortalOffer = [color, special];
  }

  _pickPreBossPortalOffer() {
    const a = COOP_PRE_BOSS_SPECIAL_TYPES[0];
    const b = COOP_PRE_BOSS_SPECIAL_TYPES[1];
    this.thronePortalOffer = Math.random() < 0.5 ? [a, b] : [b, a];
  }

  _clearPreBossSequenceState() {
    this.coopPreBossSequenceActive = false;
    this.coopInPreBossSpecialRoom = false;
    this._preBossRewardClaimScheduled = false;
  }

  _getIntroPayloadFields() {
    return {
      coopIntroPending: this.coopIntroPending,
      coopIntroActive: this.coopIntroActive,
      coopIntroRoomIndex: this.coopIntroRoomIndex,
      coopIntroPortalOpen: this.coopIntroPortalOpen,
      coopIntroFountainPhase: this.coopIntroFountainPhase,
      coopIntroFountainUsed: this.coopIntroFountainUsed,
      coopIntroAllyChoiceMade: this.coopIntroAllyChoiceMade,
      coopAllyKind: this.coopAllyKind,
      coopAllyOffer: [...this.coopAllyOffer],
    };
  }

  /**
   * Server-authoritative CustomSky index for the current room.
   * Clients resolve via `resolveSkyPresetByIndex` (excludes sunken temple fixed sky).
   */
  _getCoopSkyPayloadFields() {
    return {
      coopSkyPresetIndex: this.coopSkyPresetIndex,
    };
  }

  /**
   * Server-authoritative StylizedGrass index for prep ThroneRoom.
   * Clients resolve via `resolveGrassPresetByIndex` (excludes purple/grey).
   */
  _getCoopGrassPayloadFields() {
    return {
      coopGrassPresetIndex: this.coopGrassPresetIndex,
    };
  }

  /**
   * Roll a new random sky for a room entry. Sunken temple keeps its fixed underwater sky.
   * @param {string|null|undefined} roomKind
   */
  _rollCoopSkyPresetForEntry(roomKind) {
    if (roomKind === 'sunken_temple') return;
    this.coopSkyPresetIndex = rollCoopSkyPresetIndex();
  }

  /** Roll a new random grass palette for prep ThroneRoom entry. */
  _rollCoopGrassPresetForEntry() {
    this.coopGrassPresetIndex = rollCoopGrassPresetIndex();
  }

  _getFaeRealmPayloadFields() {
    return {
      coopFaeRealmPending: this.coopFaeRealmPending,
      coopFaeRealmActive: this.coopFaeRealmActive,
      coopFaeRealmRoomIndex: this.coopFaeRealmRoomIndex,
      coopFaeRealmPortalOpen: this.coopFaeRealmPortalOpen,
      coopFaeRealmBossKind: this.coopFaeRealmBossKind,
      coopFaeBeastCompanionGranted: this.coopFaeBeastCompanionGranted,
      coopFaeBeastCompanionKind: this.coopFaeBeastCompanionKind,
    };
  }

  _getSunkenPayloadFields() {
    return {
      coopSunkenActive: this.coopSunkenActive,
      coopSunkenRoomIndex: this.coopSunkenRoomIndex,
      coopSunkenPortalOpen: this.coopSunkenPortalOpen,
      coopSunkenFountainPhase: this.coopSunkenFountainPhase,
      coopSunkenFountainUsed: this.coopSunkenFountainUsed,
      coopSunkenAllyChoiceMade: this.coopSunkenAllyChoiceMade,
      coopSunkenLootOffer: this.getCoopSunkenLootOffer(),
      coopSunkenLootClaimedPlayerIds: [...this.coopSunkenLootClaimedPlayerIds],
      coopSunkenLootPhaseComplete: this.coopSunkenLootPhaseComplete,
      coopSunkenCompleted: this.coopSunkenCompleted,
      coopAllyKind: this.coopAllyKind,
      coopAllyOffer: [...this.coopAllyOffer],
    };
  }

  getCoopSunkenLootOffer() {
    return this.coopSunkenLootOffer.map((entry) => ({
      ...entry,
      item: entry.item ? { ...entry.item } : entry.item,
    }));
  }

  _getEternityPayloadFields() {
    return {
      coopEternityActive: this.coopEternityActive,
      coopEternityRoomIndex: this.coopEternityRoomIndex,
      coopEternityPortalOpen: this.coopEternityPortalOpen,
      coopEternityFountainPhase: this.coopEternityFountainPhase,
      coopEternityFountainUsed: this.coopEternityFountainUsed,
      coopEternityLootOffer: [],
      coopEternityLootClaimedPlayerIds: [...this.coopEternityLootClaimedPlayerIds],
      coopEternityLootPhaseComplete: this.coopEternityLootPhaseComplete,
      coopEternityCompleted: this.coopEternityCompleted,
      coopEternityLateSequence: this.coopEternityLateSequence,
      coopEternityLateCompleted: this.coopEternityLateCompleted,
      coopFaeBeastCompanionGranted: this.coopFaeBeastCompanionGranted,
      coopFaeBeastCompanionKind: this.coopFaeBeastCompanionKind,
      coopEternityPetUpgradePhase: this.coopEternityFountainPhase,
    };
  }

  getCoopEternityLootOffer() {
    return [];
  }

  getPetCompanionUpgradeOptionsForPlayer(playerId) {
    if (!this.coopFaeBeastCompanionGranted) return [];
    const kind = normalizeFaeBeastCompanionKind(this.coopFaeBeastCompanionKind);
    if (!kind) return [];
    return [...(PET_COMPANION_UPGRADE_OPTIONS[kind] || [])];
  }

  _getDeepSanctumPayloadFields() {
    return {
      coopVoidPortalOffered: this.coopVoidPortalOffered,
      coopDeepSanctumActive: this.coopDeepSanctumActive,
      coopDeepSanctumLevel: this.coopDeepSanctumLevel,
      deepSanctumRewardKind: this.coopDeepSanctumRewardKind,
    };
  }

  _getEdenPayloadFields() {
    return {
      coopEdenUsedThisSegment: this.coopEdenUsedThisSegment,
      coopEdenFountainUsed: this.coopEdenFountainUsed,
      coopEdenResumeKind: this.coopEdenResumeKind,
      coopFalseEdenCleared: this.coopFalseEdenCleared,
      coopDeliriumActive: this.coopDeliriumActive,
      coopDeliriumEventEnded: this.coopDeliriumEventEnded,
      coopDeliriumSuccess: this.coopDeliriumSuccess,
      deliriumStructure: this.deliriumStructure
        ? {
          hp: this.deliriumStructure.hp,
          maxHp: this.deliriumStructure.maxHp,
          position: { ...this.deliriumStructure.position },
          destroyed: this.deliriumStructure.destroyed,
        }
        : null,
      coopErebusGateActive: this.coopErebusGateActive,
    };
  }

  _resetFalseEdenState() {
    this.coopFalseEdenLivingCount = 0;
    this.coopFalseEdenCleared = false;
  }

  _resetDeliriumState() {
    if (this._deliriumSpawnIntervalId != null) {
      clearInterval(this._deliriumSpawnIntervalId);
      this._deliriumSpawnIntervalId = null;
    }
    if (this._deliriumEventEndTimeoutId != null) {
      clearTimeout(this._deliriumEventEndTimeoutId);
      this._scheduledTimers.delete(this._deliriumEventEndTimeoutId);
      this._deliriumEventEndTimeoutId = null;
    }
    this.coopDeliriumActive = false;
    this.coopDeliriumLivingCount = 0;
    this.coopDeliriumEventEnded = false;
    this.coopDeliriumSuccess = false;
    this.deliriumStructure = null;
  }

  _resetErebusGateState() {
    this.coopErebusGateActive = false;
    this.erebusGateOpponentIds = null;
  }

  _resetEdenSegmentState() {
    this.coopEdenUsedThisSegment = false;
    this.coopEdenFountainUsed = false;
    this.coopEdenResumeKind = null;
    this.coopEdenResumeAsPreBoss = false;
    this.coopEdenResumePortalPhase = null;
    this._resetFalseEdenState();
    this._resetDeliriumState();
    this._resetErebusGateState();
  }

  _isSurpriseRoomKind(kind) {
    const k = this._normalizeCoopRoomKind(kind);
    return k === 'eden' || k === 'false_eden' || k === 'delirium_gate' || k === 'erebus_gate' || k === 'dream_layer';
  }

  _isEdenEligibleResumeKind(kind) {
    const k = this._normalizeCoopRoomKind(kind);
    if (!k || this._isSurpriseRoomKind(k) || k === 'merchant' || k === 'boss' || k === 'intro') return false;
    if (k === 'deep_sanctum') return true;
    return COOP_COLORED_ROOM_TYPES.includes(k) || k === 'stat' || k === 'trial';
  }

  _pickSurpriseRoomKind() {
    return COOP_SURPRISE_KINDS[Math.floor(Math.random() * COOP_SURPRISE_KINDS.length)];
  }

  /**
   * Surprise diversion: eligible portal picks may send the party to a surprise room (once per segment).
   * @param {string} resumeKind
   * @param {{ asPreBoss?: boolean, savedPortalPhase?: string|null }} [options]
   * @returns {boolean}
   */
  _tryDivertToEden(resumeKind, { asPreBoss = false, savedPortalPhase = null } = {}) {
    if (!this.gameStarted || this.gameMode !== 'coop' || !this.combatArenaActive) return false;
    if (this.coopIntroActive || this.coopIntroPending) return false;
    if (this.coopFaeRealmActive || this.coopFaeRealmPending) return false;
    if (this.coopEdenUsedThisSegment) return false;
    if (!this._isEdenEligibleResumeKind(resumeKind)) return false;
    if (Math.random() >= COOP_SURPRISE_CHANCE) return false;

    const kind = this._normalizeCoopRoomKind(resumeKind);
    const surpriseKind = this._pickSurpriseRoomKind();
    this.coopEdenUsedThisSegment = true;
    this.coopEdenFountainUsed = false;
    this.coopEdenResumeKind = kind;
    this.coopEdenResumeAsPreBoss = !!asPreBoss;
    this.coopEdenResumePortalPhase = savedPortalPhase;

    this._clearAllCombatEnemies();
    this.skeletonKillCount = 0;
    this.pendingCoopArchetype = null;
    this.pendingCoopRoomKind = null;
    this.clearedCoopRoomKind = null;
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.coopVoidPortalOffered = false;
    this.coopBossThroneArena = false;
    this.coopThroneBossKind = null;
    this.merchantInventory = [];
    this._resetMushroomState();
    this._resetFalseEdenState();
    this._resetDeliriumState();
    this._resetErebusGateState();

    this.currentCoopRoomKind = surpriseKind;
    const needsAI = surpriseKind === 'false_eden'
      || surpriseKind === 'delirium_gate'
      || surpriseKind === 'erebus_gate';
    const coopCombatTransitionId = this._beginCoopCombatTransition({
      startAIOnRelease: needsAI,
      spawnInitialWave: false,
    });
    this.teleportAllPlayersToCombatSpawn();

    if (surpriseKind === 'false_eden') {
      this._spawnFalseEdenSpines();
    } else if (surpriseKind === 'delirium_gate') {
      this.sessionCampTypes = ['red'];
      this._beginDeliriumGate();
    } else if (surpriseKind === 'erebus_gate') {
      this.sessionCampTypes = [];
      this._beginErebusGate();
    } else if (surpriseKind === 'dream_layer') {
      this.sessionCampTypes = [];
      this.generateDreamLayerInventory();
      this._revealSurpriseExitPortal();
    } else {
      this.sessionCampTypes = [];
    }

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        campTypes: this.sessionCampTypes,
        merchantInventory: this.getMerchantInventory(),
        dreamLayerInventory: this.getDreamLayerInventory(),
        ...(surpriseKind === 'dream_layer'
          ? { dreamLayerPurchaseStates: this._getDreamLayerPurchaseStatesByPlayer() }
          : {}),
        coopMainArenaPortalPhase: this.coopMainArenaPortalPhase,
        thronePortalOffer: [...this.thronePortalOffer],
        coopColoredRoomVisitIndex: this._getCoopColoredRoomVisitIndexForEmit(),
        coopBossRoomVisitIndex: this._getCoopBossRoomVisitIndexForEmit(),
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        ...this._getDeepSanctumPayloadFields(),
        ...this._getEdenPayloadFields(),
        timestamp: Date.now(),
      });
    }

    console.log(`🌿 Surprise room ${surpriseKind} — intended destination: ${kind}`);
    return true;
  }

  _emitEdenIntermission(extra = {}) {
    if (!this.io) return;
    this.io.to(this.roomId).emit('coop-eden-intermission', {
      combatArenaActive: true,
      thronePortalOffer: [...this.thronePortalOffer],
      coopMainArenaPortalPhase: this.coopMainArenaPortalPhase,
      coopCurrentRoomKind: this.currentCoopRoomKind,
      ...this._getEdenPayloadFields(),
      ...extra,
      timestamp: Date.now(),
    });
  }

  _emitDeliriumStructureUpdated(extra = {}) {
    if (!this.io || !this.deliriumStructure) return;
    this.io.to(this.roomId).emit('delirium-structure-updated', {
      deliriumStructure: {
        hp: this.deliriumStructure.hp,
        maxHp: this.deliriumStructure.maxHp,
        position: { ...this.deliriumStructure.position },
        destroyed: this.deliriumStructure.destroyed,
      },
      ...extra,
      timestamp: Date.now(),
    });
  }

  /** Spawn 10–15 tentacle spines scattered across the False Eden hex arena. */
  _spawnFalseEdenSpines() {
    const n = COOP_FALSE_EDEN_SPINE_MIN
      + Math.floor(Math.random() * (COOP_FALSE_EDEN_SPINE_MAX - COOP_FALSE_EDEN_SPINE_MIN + 1));
    const positions = this._generateScatteredPositions(n, true);
    const campDef = GameRoom.CAMP_TYPES.green || { color: 'green', enemyPool: ['knight'] };
    const SLOT_BASE = 910;
    let spawned = 0;
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const enemy = this._buildEnemy('tentacle-spine', 0, SLOT_BASE + i, pos, campDef);
      this.enemies.set(enemy.id, enemy);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-spawned', { enemy, timestamp: Date.now() });
      }
      spawned += 1;
    }
    this.coopFalseEdenLivingCount = spawned;
    console.log(`🌿 False Eden — spawned ${spawned} tentacle spines`);
  }

  _registerFalseEdenKill() {
    if (this.currentCoopRoomKind !== 'false_eden' || this.coopFalseEdenCleared) return;
    this.coopFalseEdenLivingCount = Math.max(0, this.coopFalseEdenLivingCount - 1);
    if (this.coopFalseEdenLivingCount <= 0) {
      this._onFalseEdenCleared();
    }
  }

  _onFalseEdenCleared() {
    if (this.coopFalseEdenCleared) return;
    this.coopFalseEdenCleared = true;
    this._emitEdenIntermission({ falseEdenCleared: true });
    console.log('🌿 False Eden cleared — fountain unlocked');
  }

  _beginErebusGate() {
    this.coopErebusGateActive = true;
    this._spawnErebusGateOpponent();
  }

  _spawnErebusGateOpponent() {
    this.erebusGateOpponentIds = new Set();
    const pick = EREBUS_GATE_OPPONENT_KINDS[
      Math.floor(Math.random() * EREBUS_GATE_OPPONENT_KINDS.length)
    ];

    if (pick === 'knights') {
      this._spawnErebusGateEliteKnights();
    } else if (pick === 'boss') {
      this._spawnErebusGateBoss();
    } else {
      this._spawnErebusGateElite(pick);
    }
  }

  _spawnErebusGateElite(type) {
    const campDef = GameRoom.CAMP_TYPES.green || { color: 'green', enemyPool: ['knight'] };
    const pos = { x: 0, y: 0, z: 0 };
    const enemy = this._buildEnemy(type, 0, 920, pos, campDef);
    enemy.erebusGateOpponent = true;
    if (type === 'titan') {
      enemy.erebusForceCannon = true;
    }
    this.enemies.set(enemy.id, enemy);
    this.erebusGateOpponentIds.add(enemy.id);
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-spawned', { enemy, timestamp: Date.now() });
    }
    console.log(`⚔️ Erebus Gate — spawned ${type}`);
  }

  _spawnErebusGateBoss() {
    const bossId = `boss-erebus-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const position = { x: 0, y: 0, z: 0 };
    const maxHealth = this.getCoopBossMaxHealth('boss');
    const bossData = {
      id: bossId,
      type: 'boss',
      position,
      initialPosition: { ...position },
      rotation: rotationYTowardEntry(0, 0),
      health: maxHealth,
      maxHealth,
      moveSpeed: 2.5,
      spawnedAt: Date.now(),
      isDying: false,
      staggerBuildup: 0,
      bossStationary: false,
      erebusGateOpponent: true,
    };

    this.enemies.set(bossId, bossData);
    this.erebusGateOpponentIds.add(bossId);

    if (this.io) {
      this.io.to(this.roomId).emit('boss-spawned', {
        boss: bossData,
        timestamp: Date.now(),
      });
      broadcastEnemySpawn(this.io, this.roomId, bossData);
    }

    console.log(`⚔️ Erebus Gate — spawned Boss 1 (${maxHealth} HP)`);
  }

  _spawnErebusGateEliteKnights() {
    const now = Date.now();
    const rand = () => Math.random().toString(36).substr(2, 9);
    const shuffled = [...KNIGHT_SOUL_TYPES].sort(() => Math.random() - 0.5);
    const soulTypes = shuffled.slice(0, 2);

    const spawnConfigs = [
      { soulType: soulTypes[0], pos: { x: -3, y: 0, z: 1 } },
      { soulType: soulTypes[1], pos: { x: 3, y: 0, z: 1 } },
    ];

    for (const cfg of spawnConfigs) {
      const stats = KNIGHT_SOUL_STATS[cfg.soulType];
      const knightId = `knight-erebus-elite-${cfg.soulType}-${now}-${rand()}`;
      const maxHealth = Math.round(stats.maxHealth * BOSS1_ELITE_HEALTH_MULT);
      const knightData = {
        id: knightId,
        type: 'knight',
        position: { ...cfg.pos },
        initialPosition: { ...cfg.pos },
        rotation: rotationYTowardEntry(cfg.pos.x, cfg.pos.z),
        health: maxHealth,
        maxHealth,
        damage: KNIGHT_DAMAGE_BY_TIER[cfg.soulType][0],
        attackCooldown: stats.attackCooldown,
        moveSpeed: stats.moveSpeed * BOSS1_ELITE_SPEED_MULT,
        spawnedAt: now,
        isDying: false,
        staggerBuildup: 0,
        campIndex: 0,
        campType: cfg.soulType,
        soulType: cfg.soulType,
        bossId: null,
        visualScale: BOSS1_ELITE_SIZE_SCALE,
        isBoss1EliteKnight: true,
        erebusGateOpponent: true,
      };

      this.enemies.set(knightId, knightData);
      this.erebusGateOpponentIds.add(knightId);

      if (this.io) {
        broadcastEnemySpawn(this.io, this.roomId, knightData);
      }
    }

    console.log(`⚔️ Erebus Gate — spawned elite knights (${soulTypes.join(' + ')})`);
  }

  _registerErebusGateKill(enemy) {
    if (this.currentCoopRoomKind !== 'erebus_gate' || !this.erebusGateOpponentIds) return;
    this.erebusGateOpponentIds.delete(enemy.id);
    if (this.erebusGateOpponentIds.size > 0) return;
    this.erebusGateOpponentIds = null;
    this.spawnBossItemDrops(enemy.position);
    this._tryDreamLayerDropOnKill(enemy);
    this._revealSurpriseExitPortal();
    console.log('⚔️ Erebus Gate — opponents defeated, boss item dropped');
  }

  _beginDeliriumGate() {
    this.coopDeliriumActive = true;
    this.coopDeliriumLivingCount = 0;
    this.coopDeliriumEventEnded = false;
    this.coopDeliriumSuccess = false;
    this.deliriumStructure = {
      hp: DELIRIUM_STRUCTURE_HP,
      maxHp: DELIRIUM_STRUCTURE_HP,
      position: { x: DELIRIUM_STRUCTURE_X, z: DELIRIUM_STRUCTURE_Z },
      destroyed: false,
    };
    this._emitDeliriumStructureUpdated();

    this._spawnDeliriumGhoulBatch(DELIRIUM_GHOUL_SPAWN_BATCH);

    this._deliriumSpawnIntervalId = setInterval(() => {
      if (!this.coopDeliriumActive || this.coopDeliriumEventEnded) return;
      this._spawnDeliriumGhoulBatch(DELIRIUM_GHOUL_SPAWN_BATCH);
    }, DELIRIUM_GHOUL_SPAWN_INTERVAL_MS);

    this._deliriumEventEndTimeoutId = this._scheduleTimeout(() => {
      this._deliriumEventEndTimeoutId = null;
      this._onDeliriumEventEnd();
    }, DELIRIUM_EVENT_DURATION_MS);

    console.log('🔥 Delirium Gate — defend the structure for 60s');
  }

  _countAliveDeliriumGhouls() {
    let n = 0;
    for (const e of this.enemies.values()) {
      if (e.type === 'ghoul' && e.deliriumGhoul && !e.isDying && (e.health == null || e.health > 0)) {
        n += 1;
      }
    }
    return n;
  }

  _spawnDeliriumGhoulBatch(batchSize) {
    if (!this.coopDeliriumActive || this.coopDeliriumEventEnded) return;
    const alive = this._countAliveDeliriumGhouls();
    const toSpawn = Math.min(batchSize, DELIRIUM_GHOUL_MAX_ALIVE - alive);
    if (toSpawn <= 0) return;

    const MAP_HALF_X = MAIN_MAP_HALF_X - MAIN_ARENA_SPAWN_INSET;
    const MAP_HALF_Z = MAIN_MAP_HALF_Z - MAIN_ARENA_SPAWN_INSET;
    const exclusions = [
      { x: COOP_MAIN_ENTRY_X, z: COOP_MAIN_ENTRY_Z, radius: COOP_PLAYER_START_CLEAR_RADIUS },
      { x: DELIRIUM_STRUCTURE_X, z: DELIRIUM_STRUCTURE_Z, radius: 4 },
      {
        x: COOP_MAIN_COMBAT_PEDESTAL_X,
        z: COOP_MAIN_COMBAT_PEDESTAL_Z,
        radius: COOP_MAIN_COMBAT_INTERMISSION_CLEAR_RADIUS,
      },
    ];
    const existing = [];
    for (let i = 0; i < toSpawn; i++) {
      const pos = this._randomMapPos(MAP_HALF_X, MAP_HALF_Z, exclusions, existing, 3.5, false, null, MAIN_CIRCLE_INNER_RADIUS);
      if (!pos) continue;
      existing.push({ x: pos.x, z: pos.z });
      this._spawnDeliriumGhoulAt(pos);
    }
  }

  _spawnDeliriumGhoulAt(ritualPosition) {
    const spawnerId = 'delirium-gate-spawner';
    if (this.io) {
      this.io.to(this.roomId).emit('weaver-summon-telegraph', {
        weaverId: spawnerId,
        ritualPosition: { x: ritualPosition.x, y: 0, z: ritualPosition.z },
        timestamp: Date.now(),
      });
    }

    this._scheduleTimeout(() => {
      if (!this.coopDeliriumActive || !this.gameStarted) return;

      const ghoulId = `ghoul-delirium-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const ghoul = {
        id: ghoulId,
        type: 'ghoul',
        position: { x: ritualPosition.x, y: 0, z: ritualPosition.z },
        rotation: Math.atan2(COOP_MAIN_ENTRY_X - ritualPosition.x, COOP_MAIN_ENTRY_Z - ritualPosition.z),
        health: 450,
        maxHealth: 450,
        isDying: false,
        damage: 28,
        attackCooldown: 2000,
        moveSpeed: 0,
        spawnedAt: Date.now(),
        deliriumGhoul: true,
        targetStructure: true,
      };

      this.addEnemy(ghoul);
      this.coopDeliriumLivingCount += 1;

      if (this.enemyAI) {
        this.enemyAI.setDeliriumGhoulAggro(ghoulId);
      }

      if (this.io) {
        this.io.to(this.roomId).emit('weaver-ghoul-summoned', {
          weaverId: spawnerId,
          ghoul,
          ritualPosition: { x: ritualPosition.x, y: 0, z: ritualPosition.z },
          timestamp: Date.now(),
        });
      }

      this._scheduleTimeout(() => {
        const spawnedGhoul = this.enemies.get(ghoulId);
        if (spawnedGhoul && !spawnedGhoul.isDying) {
          spawnedGhoul.moveSpeed = 2.5;
        }
      }, 4500);
    }, 2000);
  }

  damageDeliriumStructure(amount, sourceEnemyId = null) {
    if (!this.deliriumStructure || this.deliriumStructure.destroyed) return false;
    const dmg = Math.max(0, Math.floor(amount));
    if (dmg <= 0) return false;

    this.deliriumStructure.hp = Math.max(0, this.deliriumStructure.hp - dmg);
    this._emitDeliriumStructureUpdated({ sourceEnemyId });

    if (this.deliriumStructure.hp <= 0) {
      this._onDeliriumStructureDestroyed();
    }
    return true;
  }

  _onDeliriumStructureDestroyed() {
    if (!this.deliriumStructure || this.deliriumStructure.destroyed) return;
    this.deliriumStructure.destroyed = true;
    this.deliriumStructure.hp = 0;
    this.coopDeliriumSuccess = false;
    this._emitDeliriumStructureUpdated({ destroyed: true });

    if (this._deliriumSpawnIntervalId != null) {
      clearInterval(this._deliriumSpawnIntervalId);
      this._deliriumSpawnIntervalId = null;
    }

    for (const enemy of this.enemies.values()) {
      if (enemy.type === 'ghoul' && enemy.deliriumGhoul) {
        enemy.targetStructure = false;
        if (this.enemyAI) {
          this.enemyAI.clearDeliriumStructureAggro(enemy.id);
        }
      }
    }
    console.log('🔥 Delirium Gate — structure destroyed');
    this._tryCompleteDeliriumEncounter();
  }

  _onDeliriumEventEnd() {
    if (!this.coopDeliriumActive || this.coopDeliriumEventEnded) return;
    this.coopDeliriumEventEnded = true;

    if (this._deliriumSpawnIntervalId != null) {
      clearInterval(this._deliriumSpawnIntervalId);
      this._deliriumSpawnIntervalId = null;
    }

    const structureAlive = this.deliriumStructure && !this.deliriumStructure.destroyed;
    this.coopDeliriumSuccess = !!structureAlive;

    if (structureAlive && this.deliriumStructure) {
      this.spawnBossItemDrops(this.deliriumStructure.position);
      // Delirium clear uses Boss 1 Dream Layer drop rate.
      this._tryDreamLayerDropOnKill({
        type: 'boss',
        position: this.deliriumStructure.position,
      });
      console.log('🔥 Delirium Gate — structure survived, boss item dropped');
    } else {
      console.log('🔥 Delirium Gate — event ended, clear remaining ghouls');
    }
    this._tryCompleteDeliriumEncounter();
  }

  _registerDeliriumKill() {
    if (this.currentCoopRoomKind !== 'delirium_gate') return;
    this.coopDeliriumLivingCount = Math.max(0, this.coopDeliriumLivingCount - 1);
    if (
      this.coopDeliriumEventEnded
      || (this.deliriumStructure && this.deliriumStructure.destroyed)
    ) {
      this._tryCompleteDeliriumEncounter();
    }
  }

  _tryCompleteDeliriumEncounter() {
    if (this.currentCoopRoomKind !== 'delirium_gate') return;
    const canExit =
      this.coopDeliriumEventEnded
      || (this.deliriumStructure && this.deliriumStructure.destroyed);
    if (!canExit) return;
    const alive = this._countAliveDeliriumGhouls();
    if (alive > 0) return;
    this._revealSurpriseExitPortal();
  }

  _revealSurpriseExitPortal() {
    if (this.coopMainArenaPortalPhase === 'eden_exit') return;
    this.coopMainArenaPortalPhase = 'eden_exit';
    this.thronePortalOffer = this.coopEdenResumeKind ? [this.coopEdenResumeKind] : [];
    this._emitEdenIntermission({
      deliriumComplete: true,
      deliriumSuccess: this.coopDeliriumSuccess,
    });
  }

  /** Heal all players from a co-op fountain interaction. */
  _applyCoopFountainHealAll(triggerPlayerId) {
    for (const player of this.players.values()) {
      const previousHealth = player.health;
      const nextHealth = Math.min(player.maxHealth, previousHealth + COOP_INTRO_FOUNTAIN_HEAL);
      const actualHealingAmount = nextHealth - previousHealth;
      if (actualHealingAmount <= 0) continue;
      this.updatePlayerHealth(player.id, nextHealth);
      const position = player.position || { x: 0, y: 0, z: 0 };
      if (this.io) {
        this.io.to(this.roomId).emit('player-health-updated', {
          playerId: player.id,
          health: player.health,
          maxHealth: player.maxHealth,
          timestamp: Date.now(),
        });
        this.io.to(this.roomId).emit('player-healing', {
          sourcePlayerId: triggerPlayerId,
          targetPlayerId: player.id,
          healingAmount: actualHealingAmount,
          healingType: 'fountain',
          position,
          timestamp: Date.now(),
        });
        
      }
    }
  }

  /**
   * Enter deep sanctum after Eden exit (void diversion resume).
   * @param {string|null} savedPortalPhase
   * @returns {boolean}
   */
  _beginDeepSanctumFromEdenResume(savedPortalPhase) {
    if (!this.gameStarted || this.gameMode !== 'coop' || !this.combatArenaActive) return false;

    this.coopSavedPortalPhase = savedPortalPhase;
    if (this.coopDeepSanctumLevel < COOP_DEEP_SANCTUM_START_LEVEL) {
      this.coopDeepSanctumLevel = COOP_DEEP_SANCTUM_START_LEVEL;
    } else {
      this.coopDeepSanctumLevel += 1;
    }

    this.coopVoidPortalOffered = false;
    this.coopDeepSanctumActive = true;
    this.coopDeepSanctumRewardKind = null;
    this.coopBossThroneArena = false;
    this.coopThroneBossKind = null;
    this.currentCoopRoomKind = 'deep_sanctum';
    this.clearedCoopRoomKind = null;
    this.skeletonKillCount = 0;
    this.bossSpawned = false;
    this.merchantInventory = [];
    this._resetMushroomState();

    const coopCombatTransitionId = this._beginCoopCombatTransition({ spawnInitialWave: true });
    this.teleportAllPlayersToIntroSpawn();

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopColoredRoomVisitIndex: null,
        coopBossRoomVisitIndex: null,
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        ...this._getDeepSanctumPayloadFields(),
        ...this._getEdenPayloadFields(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  /**
   * Enter the intended co-op room after leaving Eden.
   * @param {string} roomKind
   * @param {{ asPreBoss?: boolean }} [options]
   * @returns {boolean}
   */
  _enterCoopResumeRoom(roomKind, { asPreBoss = false } = {}) {
    const kind = this._normalizeCoopRoomKind(roomKind);
    if (!kind || this._isSurpriseRoomKind(kind) || kind === 'boss' || kind === 'merchant') return false;

    this.pendingCoopArchetype = GameRoom.CAMP_TYPES[kind] ? kind : null;
    this.pendingCoopRoomKind = kind;
    this.currentCoopRoomKind = kind;
    this.clearedCoopRoomKind = null;
    this._bumpColoredRoomVisit(kind);
    this._resetCoopRoomWhisperForEntry(kind);
    this.skeletonKillCount = 0;
    this._resetMushroomState();
    if (asPreBoss) {
      this.coopInPreBossSpecialRoom = true;
    }

    const coopCombatTransitionId = this._beginCoopCombatTransition({ spawnInitialWave: true });
    this.teleportAllPlayersToCombatSpawn();
    this.merchantInventory = [];

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopColoredRoomVisitIndex: this._getCoopColoredRoomVisitIndexForEmit(),
        coopBossRoomVisitIndex: this._getCoopBossRoomVisitIndexForEmit(),
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        ...this._getDeepSanctumPayloadFields(),
        ...this._getEdenPayloadFields(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  /**
   * Leave Eden via the resume portal after drinking from the fountain.
   * @param {string} [chosenCampType]
   * @returns {boolean}
   */
  _resolveEdenExitPortal(chosenCampType) {
    if (!this._isSurpriseRoomKind(this.currentCoopRoomKind)) return false;
    if (this.currentCoopRoomKind === 'eden' || this.currentCoopRoomKind === 'false_eden') {
      if (!this.coopEdenFountainUsed) return false;
    } else if (this.currentCoopRoomKind === 'delirium_gate' || this.currentCoopRoomKind === 'erebus_gate' || this.currentCoopRoomKind === 'dream_layer') {
      if (this.coopMainArenaPortalPhase !== 'eden_exit') return false;
    }
    const resumeKind = this.coopEdenResumeKind;
    if (!resumeKind) return false;

    let pick = chosenCampType != null ? String(chosenCampType).toLowerCase() : '';
    if (!pick || pick !== resumeKind) pick = resumeKind;

    const asPreBoss = this.coopEdenResumeAsPreBoss;
    const savedPortalPhase = this.coopEdenResumePortalPhase;

    this.coopEdenFountainUsed = false;
    this.coopEdenResumeKind = null;
    this.coopEdenResumeAsPreBoss = false;
    this.coopEdenResumePortalPhase = null;
    this.coopMainArenaPortalPhase = null;
    this.thronePortalOffer = [];
    this._resetFalseEdenState();
    this._resetDeliriumState();
    this._resetErebusGateState();
    this.sessionCampTypes = [];

    this._clearAllCombatEnemies();

    if (resumeKind === 'deep_sanctum') {
      return this._beginDeepSanctumFromEdenResume(savedPortalPhase);
    }
    return this._enterCoopResumeRoom(pick, { asPreBoss });
  }

  _maybeOfferVoidPortal() {
    this.coopVoidPortalOffered = Math.random() < COOP_VOID_PORTAL_CHANCE;
  }

  _rollDeepSanctumRewardKind() {
    const roll = Math.random();
    if (roll < 0.40) return 'gold';
    if (roll < 0.80) return 'stat';
    return 'talent';
  }

  _pickRandomCampColor() {
    return COOP_COLORED_ROOM_TYPES[Math.floor(Math.random() * COOP_COLORED_ROOM_TYPES.length)];
  }

  _generateIntroSpawnPositions(count) {
    const inset = 3.5;
    const half = CASTLE_ROOM_HALF_SIZE - inset;
    const positions = [];
    for (let i = 0; i < count; i++) {
      let placed = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        const x = (Math.random() * 2 - 1) * half;
        const z = (Math.random() * 2 - 1) * half;
        const distFromEntry = Math.hypot(x - CASTLE_ROOM_ENTRY_X, z - CASTLE_ROOM_ENTRY_Z);
        if (distFromEntry < 6) continue;
        if (positions.some((p) => Math.hypot(p.x - x, p.z - z) < 3.5)) continue;
        positions.push({ x, z });
        placed = true;
        break;
      }
      if (!placed) {
        const angle = (Math.PI * 2 * i) / Math.max(count, 1);
        positions.push({
          x: Math.sin(angle) * (half * 0.55),
          z: Math.cos(angle) * (half * 0.55),
        });
      }
    }
    return positions;
  }

  _buildIntroEnemySpecs(roomIndex) {
    const positions = this._generateIntroSpawnPositions(3);
    const pickColor = () => this._pickRandomCampColor();
    const INTRO_KNIGHT_COLORS = ['red', 'green', 'purple'];
    const pickKnightColor = () => INTRO_KNIGHT_COLORS[Math.floor(Math.random() * INTRO_KNIGHT_COLORS.length)];
    const camp = (color) => GameRoom.CAMP_TYPES[color];

    if (roomIndex === 1) {
      const twoKnightsRecipe = () => {
        const positions1 = this._generateIntroSpawnPositions(2);
        return [
          { unitType: 'knight', campDef: camp(pickKnightColor()), pos: positions1[0] },
          { unitType: 'knight', campDef: camp(pickKnightColor()), pos: positions1[1] },
        ];
      };
      const spectreRecipe = () => {
        const color = pickColor();
        const positions1 = this._generateIntroSpawnPositions(1);
        return [
          { unitType: 'spectre', campDef: camp(color), pos: positions1[0] },
        ];
      };
      const deathKnightRecipe = () => {
        const color = pickColor();
        const positions1 = this._generateIntroSpawnPositions(1);
        return [
          { unitType: 'death-knight', campDef: camp(color), pos: positions1[0] },
        ];
      };
      const shamanRecipe = () => {
        const color = pickColor();
        const positions1 = this._generateIntroSpawnPositions(1);
        return [
          { unitType: 'shaman', campDef: camp(color), pos: positions1[0] },
        ];
      };
      // 40% 2 knights / 20% spectre / 20% death-knight / 20% shaman
      const roll = Math.random();
      if (roll < 0.40) return twoKnightsRecipe();
      if (roll < 0.60) return spectreRecipe();
      if (roll < 0.80) return deathKnightRecipe();
      return shamanRecipe();
    }

    if (roomIndex === 2) {
      const recipes = [
        () => Array.from({ length: 3 }, (_, i) => ({
          unitType: 'viper',
          campDef: camp(i % 2 === 0 ? 'green' : 'blue'),
          pos: positions[i],
        })),
        () => {
          const colors = [...COOP_COLORED_ROOM_TYPES];
          return Array.from({ length: 3 }, (_, i) => ({
            unitType: 'shade',
            campDef: camp(colors[i % colors.length]),
            pos: positions[i],
          }));
        },
        () => Array.from({ length: 2 }, (_, i) => ({
          unitType: 'weaver',
          campDef: camp('green'),
          pos: positions[i],
        })),
        () => Array.from({ length: 2 }, (_, i) => ({
          unitType: 'warlock',
          campDef: camp('red'),
          pos: positions[i],
        })),
      ];
      return recipes[Math.floor(Math.random() * recipes.length)]();
    }

    if (roomIndex === 3) {
      const room3Recipes = [
        () => [
          { unitType: 'knight', campDef: camp(pickKnightColor()), pos: positions[0] },
          { unitType: 'viper', campDef: camp('green'), pos: positions[1] },
          { unitType: 'viper', campDef: camp('blue'), pos: positions[2] },
        ],
        () => [
          { unitType: 'knight', campDef: camp(pickKnightColor()), pos: positions[0] },
          { unitType: 'shade', campDef: camp(pickColor()), pos: positions[1] },
          { unitType: 'shade', campDef: camp(pickColor()), pos: positions[2] },
        ],
        () => [
          { unitType: 'knight', campDef: camp(pickKnightColor()), pos: positions[0] },
          { unitType: 'knight', campDef: camp(pickKnightColor()), pos: positions[1] },
          { unitType: 'weaver', campDef: camp('green'), pos: positions[2] },
        ],
        () => [
          { unitType: 'knight', campDef: camp('red'), pos: positions[0] },
          { unitType: 'templar', campDef: camp('red'), pos: positions[1] },
          { unitType: 'templar', campDef: camp('purple'), pos: positions[2] },
        ],
        () => [
          { unitType: 'weaver', campDef: camp('green'), pos: positions[0] },
          { unitType: 'weaver', campDef: camp('blue'), pos: positions[1] },
          { unitType: 'viper', campDef: camp('green'), pos: positions[2] },
        ],
        () => [
          { unitType: 'viper', campDef: camp('green'), pos: positions[0] },
          { unitType: 'viper', campDef: camp('blue'), pos: positions[1] },
          { unitType: 'shade', campDef: camp(pickColor()), pos: positions[2] },
        ],
        () => [
          { unitType: 'warlock', campDef: camp('purple'), pos: positions[0] },
          { unitType: 'warlock', campDef: camp('purple'), pos: positions[1] },
          { unitType: 'knight', campDef: camp('purple'), pos: positions[2] },
        ],
      ];
      return room3Recipes[Math.floor(Math.random() * room3Recipes.length)]();
    }

    if (roomIndex === 4) {
      const positions4 = this._generateIntroSpawnPositions(4);
      const room4Recipes = [
        () => [
          { unitType: 'warlock', campDef: camp('red'), pos: positions4[0] },
          { unitType: 'warlock', campDef: camp('red'), pos: positions4[1] },
          { unitType: 'knight', campDef: camp(pickKnightColor()), pos: positions4[2] },
          { unitType: 'knight', campDef: camp(pickKnightColor()), pos: positions4[3] },
        ],
        () => [
          { unitType: 'warlock', campDef: camp('purple'), pos: positions4[0] },
          { unitType: 'warlock', campDef: camp('purple'), pos: positions4[1] },
          { unitType: 'warlock', campDef: camp('purple'), pos: positions4[2] },
          { unitType: 'shade', campDef: camp(pickColor()), pos: positions4[3] },
        ],
        () => {
          const count = 10 + Math.floor(Math.random() * 6);
          const martyrPositions = this._generateIntroSpawnPositions(count);
          const martyrCamp = camp(pickColor());
          return Array.from({ length: count }, (_, i) => ({
            unitType: 'martyr',
            campDef: martyrCamp,
            pos: martyrPositions[i],
          }));
        },
        () => [
          { unitType: 'knight', campDef: camp(pickKnightColor()), pos: positions4[0] },
          { unitType: 'knight', campDef: camp(pickKnightColor()), pos: positions4[1] },
          { unitType: 'viper', campDef: camp('green'), pos: positions4[2] },
          { unitType: 'viper', campDef: camp('blue'), pos: positions4[3] },
        ],
        () => Array.from({ length: 4 }, (_, i) => ({
          unitType: 'shade',
          campDef: camp('purple'),
          pos: positions4[i],
        })),
        () => [
          { unitType: 'weaver', campDef: camp('green'), pos: positions4[0] },
          { unitType: 'weaver', campDef: camp('blue'), pos: positions4[1] },
          { unitType: 'weaver', campDef: camp('green'), pos: positions4[2] },
          { unitType: 'knight', campDef: camp(pickKnightColor()), pos: positions4[3] },
        ],
        () => [
          { unitType: 'viper', campDef: camp('green'), pos: positions4[0] },
          { unitType: 'viper', campDef: camp('blue'), pos: positions4[1] },
          { unitType: 'viper', campDef: camp('green'), pos: positions4[2] },
          { unitType: 'warlock', campDef: camp('red'), pos: positions4[3] },
        ],
        () => [
          { unitType: 'knight', campDef: camp(pickKnightColor()), pos: positions4[0] },
          { unitType: 'templar', campDef: camp('red'), pos: positions4[1] },
          { unitType: 'shade', campDef: camp(pickColor()), pos: positions4[2] },
          { unitType: 'viper', campDef: camp('green'), pos: positions4[3] },
        ],
      ];
      return room4Recipes[Math.floor(Math.random() * room4Recipes.length)]();
    }

    return [];
  }

  spawnIntroWave(roomIndex) {
    this.coopWaveSpawnPlan = null;
    this.coopRequiredQueue = [];
    this.roomHasMartyrs = false;
    this.roomHasTitans = false;
    this.roomTitanQuota = 0;
    this.roomHasMiniBoss1 = false;
    this.roomHasWraith = false;

    const specs = this._buildIntroEnemySpecs(roomIndex);
    const isMartyrSwarm = specs.length > 0 && specs.every((spec) => spec.unitType === 'martyr');
    this.coopIntroLivingCount = specs.length;
    this.coopWaveQuota = specs.length;
    this.skeletonKillCount = 0;
    this.sessionCampTypes = ['intro'];
    this.currentCoopRoomKind = 'intro';

    if (isMartyrSwarm) {
      this.coopRequiredQueue = specs.map((spec, slotIndex) => ({
        kind: 'basic',
        unitType: spec.unitType,
        pos: spec.pos,
        campDef: spec.campDef,
        slotIndex,
      }));
      this._pumpCoopSpawns();
    } else {
      specs.forEach((spec, slotIndex) => {
        const enemy = this._buildEnemy(spec.unitType, 0, slotIndex, spec.pos, spec.campDef);
        this.enemies.set(enemy.id, enemy);
        if (this.io) {
          this.io.to(this.roomId).emit('enemy-spawned', { enemy, timestamp: Date.now() });
        }
      });
    }

    if (this.io) {
      this.io.to(this.roomId).emit('skeleton-kill-count-updated', {
        skeletonKillCount: 0,
        required: specs.length,
        timestamp: Date.now(),
      });
      this.io.to(this.roomId).emit('camps-initialized', {
        campTypes: this.sessionCampTypes,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        timestamp: Date.now(),
      });
    }
  }

  _pickSunkenFillerCampColor(unitType) {
    if (unitType === 'warlock') return Math.random() < 0.5 ? 'red' : 'purple';
    if (unitType === 'viper') return Math.random() < 0.5 ? 'green' : 'blue';
    if (unitType === 'weaver') return Math.random() < 0.5 ? 'green' : 'blue';
    if (unitType === 'shade') return Math.random() < 0.5 ? 'purple' : 'blue';
    if (unitType === 'knight') return this._pickRandomCampColor();
    return this._pickRandomCampColor();
  }

  _pickSunkenFillerSpec(pos) {
    const SUNKEN_FILLER_TYPES = ['warlock', 'viper', 'knight', 'shade', 'weaver'];
    const unitType = SUNKEN_FILLER_TYPES[Math.floor(Math.random() * SUNKEN_FILLER_TYPES.length)];
    const campColor = this._pickSunkenFillerCampColor(unitType);
    return {
      unitType,
      campDef: GameRoom.CAMP_TYPES[campColor],
      pos,
    };
  }

  _buildSunkenEnemySpecs(roomIndex) {
    const spawnCount = roomIndex === 2 ? 1 : roomIndex === 3 ? 2 : roomIndex === 4 ? 1 : 4;
    const positions = this._generateIntroSpawnPositions(spawnCount);
    const camp = (color) => GameRoom.CAMP_TYPES[color];

    if (roomIndex === 1) {
      return [
        { unitType: 'sentinel', campDef: camp('blue'), pos: positions[0] },
        { unitType: 'wraith', campDef: camp(this._pickRandomCampColor()), pos: positions[1] },
        this._pickSunkenFillerSpec(positions[2]),
        this._pickSunkenFillerSpec(positions[3]),
      ];
    }
    if (roomIndex === 2) {
      return [{ unitType: 'valkyrie', campDef: camp('green'), pos: positions[0] }];
    }
    if (roomIndex === 3) {
      const nemesisPos = positions[0];
      const duelOffset = 3.5;
      const angle = Math.random() * Math.PI * 2;
      return [
        { unitType: 'nemesis', campDef: camp('red'), pos: nemesisPos },
        {
          unitType: 'valkyrie',
          campDef: camp('green'),
          pos: {
            x: nemesisPos.x + Math.cos(angle) * duelOffset,
            z: nemesisPos.z + Math.sin(angle) * duelOffset,
          },
        },
      ];
    }
    if (roomIndex === 4) {
      const roll = Math.floor(Math.random() * 3);
      const unitType = roll === 0 ? 'medusa' : roll === 1 ? 'assassin' : 'frost-queen';
      const campColor = unitType === 'medusa' ? 'purple' : this._pickRandomCampColor();
      return [{
        unitType,
        campDef: camp(campColor),
        pos: { x: 0, z: 0 },
      }];
    }
    return [];
  }

  spawnSunkenWave(roomIndex) {
    this.coopWaveSpawnPlan = null;
    this.coopRequiredQueue = [];
    this.roomHasMartyrs = false;
    this.roomHasTitans = false;
    this.roomTitanQuota = 0;
    this.roomHasMiniBoss1 = false;
    this.roomHasWraith = false;

    const specs = this._buildSunkenEnemySpecs(roomIndex);
    const isMartyrSwarm = specs.length > 0 && specs.every((spec) => spec.unitType === 'martyr');
    this.coopSunkenLivingCount = specs.length;
    this.coopWaveQuota = specs.length;
    this.skeletonKillCount = 0;
    this.sessionCampTypes = ['sunken_temple'];
    this.currentCoopRoomKind = 'sunken_temple';

    if (isMartyrSwarm) {
      this.coopRequiredQueue = specs.map((spec, slotIndex) => ({
        kind: 'basic',
        unitType: spec.unitType,
        pos: spec.pos,
        campDef: spec.campDef,
        slotIndex,
      }));
      this._pumpCoopSpawns();
    } else {
      specs.forEach((spec, slotIndex) => {
        const enemy = this._buildEnemy(spec.unitType, 0, slotIndex, spec.pos, spec.campDef);
        this.enemies.set(enemy.id, enemy);
        if (this.io) {
          this.io.to(this.roomId).emit('enemy-spawned', { enemy, timestamp: Date.now() });
        }
      });
      // Sunken Temple III duel aggro is seeded in spawnEnemyWave after clearNonPlayerAggroTargets.
    }

    if (this.io) {
      this.io.to(this.roomId).emit('skeleton-kill-count-updated', {
        skeletonKillCount: 0,
        required: specs.length,
        timestamp: Date.now(),
      });
      this.io.to(this.roomId).emit('camps-initialized', {
        campTypes: this.sessionCampTypes,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        timestamp: Date.now(),
      });
    }
  }

  _buildDeepSanctumEnemySpecs(level) {
    const camp = (color) => GameRoom.CAMP_TYPES[color];
    const pickColor = () => this._pickRandomCampColor();

    if (level <= 5) {
      const positions = this._generateIntroSpawnPositions(4);
      const recipes = [
        () => [
          { unitType: 'weaver', campDef: camp('green'), pos: positions[0] },
          { unitType: 'weaver', campDef: camp('blue'), pos: positions[1] },
          { unitType: 'knight', campDef: camp(pickColor()), pos: positions[2] },
          { unitType: 'knight', campDef: camp(pickColor()), pos: positions[3] },
        ],
        () => [
          { unitType: 'knight', campDef: camp(pickColor()), pos: positions[0] },
          { unitType: 'knight', campDef: camp(pickColor()), pos: positions[1] },
          { unitType: 'viper', campDef: camp('green'), pos: positions[2] },
          { unitType: 'viper', campDef: camp('blue'), pos: positions[3] },
        ],
        () => {
          const greedColor = GREED_COLORS[Math.floor(Math.random() * GREED_COLORS.length)];
          const specs = [
            { unitType: 'greed', greedColor, pos: positions[0] },
          ];
          for (let i = 1; i < 4; i++) {
            const color = pickColor();
            specs.push({
              unitType: this._pickBasicUnitType(camp(color)),
              campDef: camp(color),
              pos: positions[i],
            });
          }
          return specs;
        },
        () => [
          { unitType: 'warlock', campDef: camp('purple'), pos: positions[0] },
          { unitType: 'weaver', campDef: camp('blue'), pos: positions[1] },
          { unitType: 'weaver', campDef: camp('blue'), pos: positions[2] },
          { unitType: 'weaver', campDef: camp('blue'), pos: positions[3] },
        ],
        () => [
          { unitType: 'knight', campDef: camp(pickColor()), pos: positions[0] },
          { unitType: 'warlock', campDef: camp('red'), pos: positions[1] },
          { unitType: 'warlock', campDef: camp('red'), pos: positions[2] },
          { unitType: 'warlock', campDef: camp('red'), pos: positions[3] },
        ],
        () => [
          { unitType: 'templar', campDef: camp('red'), pos: positions[0] },
          { unitType: 'templar', campDef: camp('purple'), pos: positions[1] },
          { unitType: 'shade', campDef: camp(pickColor()), pos: positions[2] },
          { unitType: 'shade', campDef: camp(pickColor()), pos: positions[3] },
        ],
      ];
      return recipes[Math.floor(Math.random() * recipes.length)]();
    }

    const positions = this._generateIntroSpawnPositions(3);
    const pairTypes = ['viper', 'shade', 'templar', 'weaver', 'warlock', 'knight'];
    const pairType = pairTypes[Math.floor(Math.random() * pairTypes.length)];
    const titanCamp = camp(pickColor());
    const pairCamp = pairType === 'viper'
      ? (i) => camp(i % 2 === 0 ? 'green' : 'blue')
      : pairType === 'warlock'
        ? (i) => camp(i % 2 === 0 ? 'red' : 'purple')
        : pairType === 'weaver'
          ? (i) => camp(i % 2 === 0 ? 'green' : 'blue')
          : pairType === 'templar'
            ? (i) => camp(i % 2 === 0 ? 'red' : 'purple')
            : () => camp(pickColor());

    return [
      { unitType: 'titan', campDef: titanCamp, pos: positions[0] },
      { unitType: pairType, campDef: pairCamp(0), pos: positions[1] },
      { unitType: pairType, campDef: pairCamp(1), pos: positions[2] },
    ];
  }

  spawnDeepSanctumWave(level) {
    this.coopWaveSpawnPlan = null;
    this.coopRequiredQueue = [];
    this.roomHasMartyrs = false;
    this.roomHasTitans = false;
    this.roomTitanQuota = 0;
    this.roomHasMiniBoss1 = false;
    this.roomHasWraith = false;

    const specs = this._buildDeepSanctumEnemySpecs(level);
    this.coopDeepSanctumLivingCount = specs.length;
    this.coopWaveQuota = specs.length;
    this.skeletonKillCount = 0;
    this.sessionCampTypes = ['deep_sanctum'];
    this.currentCoopRoomKind = 'deep_sanctum';

    specs.forEach((spec, slotIndex) => {
      let enemy;
      if (spec.unitType === 'greed') {
        enemy = this._buildGreedEnemy(spec.greedColor, spec.pos);
        enemy._deepSanctumRequired = true;
      } else {
        enemy = this._buildEnemy(spec.unitType, 0, slotIndex, spec.pos, spec.campDef);
      }
      this.enemies.set(enemy.id, enemy);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-spawned', { enemy, timestamp: Date.now() });
      }
    });

    if (this.io) {
      this.io.to(this.roomId).emit('skeleton-kill-count-updated', {
        skeletonKillCount: 0,
        required: specs.length,
        timestamp: Date.now(),
      });
      this.io.to(this.roomId).emit('camps-initialized', {
        campTypes: this.sessionCampTypes,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        timestamp: Date.now(),
      });
    }
    this.startEnemyAI();
  }

  _registerDeepSanctumKill(emojiLog) {
    if (!this.coopDeepSanctumActive || this.bossSpawned) return;
    this.skeletonKillCount += 1;
    const killTarget = this.coopDeepSanctumLivingCount || this.coopWaveQuota || 1;
    console.log(`${emojiLog} (deep sanctum ${this.coopDeepSanctumLevel}: ${this.skeletonKillCount}/${killTarget})`);
    if (this.io) {
      this.io.to(this.roomId).emit('skeleton-kill-count-updated', {
        skeletonKillCount: this.skeletonKillCount,
        required: killTarget,
        timestamp: Date.now(),
      });
    }
    if (this.skeletonKillCount >= killTarget) {
      this._onDeepSanctumCleared();
    }
  }

  _onDeepSanctumCleared() {
    this._clearAllCombatEnemies();
    this.skeletonKillCount = 0;
    this.clearedCoopRoomKind = 'deep_sanctum';
    this.sessionCampTypes = [];
    this.coopDeepSanctumRewardKind = this._rollDeepSanctumRewardKind();
    this._emitDeepSanctumIntermission();
    console.log(`✨ Deep sanctum ${this.coopDeepSanctumLevel} cleared — reward: ${this.coopDeepSanctumRewardKind}`);
  }

  _emitDeepSanctumIntermission(extra = {}) {
    if (!this.io) return;
    this.io.to(this.roomId).emit('coop-deep-sanctum-intermission', {
      combatArenaActive: true,
      coopCurrentRoomKind: this.currentCoopRoomKind,
      coopClearedRoomKind: this.clearedCoopRoomKind,
      coopMainArenaPortalPhase: null,
      coopBossThroneArena: false,
      coopThroneBossKind: null,
      coopTerrainTheme: this.getCoopTerrainTheme(),
      merchantInventory: this.getMerchantInventory(),
      players: this.getPlayers(),
      enemies: this.getEnemies(),
      ...this._getDeepSanctumPayloadFields(),
      ...extra,
      timestamp: Date.now(),
    });
  }

  /**
   * Enter the post-Trinity finale room (Eden lookalike with center daisy).
   * @returns {boolean}
   */
  beginEdenFinaleRoom() {
    if (!this.gameStarted || this.gameMode !== 'coop' || !this.combatArenaActive) return false;
    if (this.coopMainArenaPortalPhase !== 'pick_trinity_finale') return false;

    this._clearAllCombatEnemies();
    this.coopVoidPortalOffered = false;
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.coopBossThroneArena = false;
    this.coopThroneBossKind = null;
    this.currentCoopRoomKind = 'eden_finale';
    this.clearedCoopRoomKind = null;
    this.combatArenaActive = true;
    this.skeletonKillCount = 0;
    this.bossSpawned = false;
    this.merchantInventory = [];
    this.sessionCampTypes = [];
    this._resetMushroomState();

    const coopCombatTransitionId = this._beginCoopCombatTransition({
      startAIOnRelease: false,
      spawnInitialWave: false,
    });
    this.teleportAllPlayersToCombatSpawn();

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        campTypes: this.sessionCampTypes,
        merchantInventory: this.getMerchantInventory(),
        coopMainArenaPortalPhase: null,
        thronePortalOffer: [],
        coopColoredRoomVisitIndex: null,
        coopBossRoomVisitIndex: null,
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        ...this._getDeepSanctumPayloadFields(),
        timestamp: Date.now(),
      });
    }
    console.log('🌼 Eden finale room entered — run complete');
    return true;
  }

  /**
   * Enter a deep sanctum (Inner Sanctum IV+) from the main-loop void portal.
   * @returns {boolean}
   */
  beginDeepSanctumRoom() {
    if (!this.gameStarted || this.gameMode !== 'coop' || !this.combatArenaActive) return false;
    const phase = this.coopMainArenaPortalPhase;
    if (!phase || !['pick_wave2', 'pick_pre_boss', 'pick_post_boss'].includes(phase)) return false;
    if (!this.coopVoidPortalOffered) return false;

    this.coopSavedPortalPhase = phase;
    if (this.coopDeepSanctumLevel < COOP_DEEP_SANCTUM_START_LEVEL) {
      this.coopDeepSanctumLevel = COOP_DEEP_SANCTUM_START_LEVEL;
    } else {
      this.coopDeepSanctumLevel += 1;
    }

    this.coopVoidPortalOffered = false;
    this.coopDeepSanctumActive = true;
    this.coopDeepSanctumRewardKind = null;
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.coopBossThroneArena = false;
    this.coopThroneBossKind = null;
    this.currentCoopRoomKind = 'deep_sanctum';
    this.clearedCoopRoomKind = null;
    this.combatArenaActive = true;
    this.skeletonKillCount = 0;
    this.bossSpawned = false;
    this.merchantInventory = [];
    this._resetMushroomState();

    const coopCombatTransitionId = this._beginCoopCombatTransition({ spawnInitialWave: true });
    this.teleportAllPlayersToIntroSpawn();

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopColoredRoomVisitIndex: null,
        coopBossRoomVisitIndex: null,
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        ...this._getDeepSanctumPayloadFields(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  /**
   * Client claimed the deep sanctum pedestal reward — grant gold server-side, resume main loop.
   * @param {string} playerId
   * @returns {boolean}
   */
  claimDeepSanctumReward(playerId) {
    if (!this.coopDeepSanctumActive || !this.coopDeepSanctumRewardKind) return false;
    if (!this.players.get(playerId)) return false;

    let goldGranted = 0;
    if (this.coopDeepSanctumRewardKind === 'gold') {
      goldGranted = COOP_DEEP_SANCTUM_GOLD_MIN
        + Math.floor(Math.random() * (COOP_DEEP_SANCTUM_GOLD_MAX - COOP_DEEP_SANCTUM_GOLD_MIN + 1));
      for (const player of this.players.values()) {
        player.gold = (player.gold || 0) + goldGranted;
        if (this.io) {
          this.io.to(this.roomId).emit('player-gold-changed', {
            playerId: player.id,
            gold: player.gold,
            timestamp: Date.now(),
          });
        }
      }
    }

    const savedPhase = this.coopSavedPortalPhase;
    const rewardKind = this.coopDeepSanctumRewardKind;
    this.coopSavedPortalPhase = null;
    this.coopDeepSanctumActive = false;
    this.coopDeepSanctumRewardKind = null;
    this.coopDeepSanctumLivingCount = 0;
    this.currentCoopRoomKind = null;
    this.clearedCoopRoomKind = null;
    this.sessionCampTypes = [];
    this.skeletonKillCount = 0;
    this._resetMushroomState();

    this.teleportAllPlayersToCombatSpawn();

    if (this.io) {
      this.io.to(this.roomId).emit('coop-deep-sanctum-reward-claimed', {
        rewardKind,
        goldGranted,
        deepSanctumStatPoints: COOP_DEEP_SANCTUM_STAT_POINTS,
        timestamp: Date.now(),
      });
    }

    if (savedPhase === 'pick_pre_boss') {
      this.startMainArenaPortalIntermission('pre_boss_gate');
    } else {
      this.coopSegmentCombatRoomsCleared += 1;
      const required = this._getCoopRoomsRequiredBeforeBoss();
      if (this.coopSegmentCombatRoomsCleared >= required) {
        this.startMainArenaPortalIntermission('pre_boss_gate');
      } else {
        this.startMainArenaPortalIntermission('second_wave');
      }
    }

    return true;
  }

  teleportAllPlayersToIntroSpawn() {
    if (this.gameMode === 'coop') {
      this.coopRoomEntryToken += 1;
      this.coopPostTeleportPositionGuardUntil = Date.now() + COOP_POST_TELEPORT_POSITION_GUARD_MS;
      this._rollCoopSkyPresetForEntry(this.currentCoopRoomKind);
    }
    const spawnBaseX = CASTLE_ROOM_ENTRY_X;
    const spawnBaseZ = CASTLE_ROOM_ENTRY_Z;
    const totalPlayers = Math.max(this.players.size, 1);
    let idx = 0;
    for (const player of this.players.values()) {
      const angleStep = (Math.PI * 2) / Math.max(3, totalPlayers);
      const angle = idx * angleStep;
      const spawnRadius = 1.25;
      const rawX = spawnBaseX + Math.sin(angle) * spawnRadius;
      const rawZ = spawnBaseZ + Math.cos(angle) * spawnRadius;
      const c = clampPositionToCastleRoomXZ(rawX, rawZ);
      player.position = { x: c.x, y: 1, z: c.z };
      const y = rotationYTowardArenaCenter(c.x, c.z);
      player.rotation = { x: 0, y, z: 0 };
      idx++;
    }
    this.repositionAllBeastCompanionsNearOwners();
  }

  teleportAllPlayersToSunkenSpawn() {
    if (this.gameMode === 'coop') {
      this.coopRoomEntryToken += 1;
      this.coopPostTeleportPositionGuardUntil = Date.now() + COOP_POST_TELEPORT_POSITION_GUARD_MS;
    }
    const spawnBaseX = CASTLE_ROOM_ENTRY_X;
    const spawnBaseZ = CASTLE_ROOM_ENTRY_Z;
    const totalPlayers = Math.max(this.players.size, 1);
    let idx = 0;
    for (const player of this.players.values()) {
      const angleStep = (Math.PI * 2) / Math.max(3, totalPlayers);
      const angle = idx * angleStep;
      const spawnRadius = 1.25;
      const rawX = spawnBaseX + Math.sin(angle) * spawnRadius;
      const rawZ = spawnBaseZ + Math.cos(angle) * spawnRadius;
      const c = clampPositionToPentagonXZ(rawX, rawZ);
      player.position = { x: c.x, y: 1, z: c.z };
      const y = rotationYTowardArenaCenter(c.x, c.z);
      player.rotation = { x: 0, y, z: 0 };
      idx++;
    }
    this.repositionAllBeastCompanionsNearOwners();
  }

  /**
   * Enter a Fae Realm room (1–3). Called from throne void portal or post-clear void portal.
   * @param {1|2|3} roomIndex
   * @returns {boolean}
   */
  beginFaeRealmRoom(roomIndex) {
    if (!this.gameStarted || this.gameMode !== 'coop') return false;
    const n = Number(roomIndex);
    if (!Number.isFinite(n) || n < 1 || n > 3) return false;

    if (n === 1) {
      if (this.combatArenaActive || !this.coopFaeRealmPending) return false;
      for (const player of this.players.values()) {
        if (!this._playerThronePrepReady(player)) return false;
      }
    } else {
      if (!this.coopFaeRealmActive || !this.coopFaeRealmPortalOpen || this.coopFaeRealmRoomIndex !== n - 1) {
        return false;
      }
    }

    this.removeThroneTrainingDummy();
    this._clearAllCombatEnemies();
    this.coopFaeRealmPending = false;
    this.coopFaeRealmActive = true;
    this.coopFaeRealmRoomIndex = n;
    this.coopFaeRealmPortalOpen = false;
    this.coopIntroPending = false;
    this.coopIntroActive = false;
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.coopBossThroneArena = false;
    this.coopThroneBossKind = null;
    this.currentCoopRoomKind = 'fae_realm';
    this.clearedCoopRoomKind = null;
    this.combatArenaActive = true;
    this.skeletonKillCount = 0;
    this.bossSpawned = false;
    this.merchantInventory = [];
    this._resetMushroomState();

    const coopCombatTransitionId = this._beginCoopCombatTransition({ spawnInitialWave: true });
    this.teleportAllPlayersToFaeRealmSpawn();

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopColoredRoomVisitIndex: null,
        coopBossRoomVisitIndex: null,
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        ...this._getFaeRealmPayloadFields(),
        ...this._getIntroPayloadFields(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  _generateFaeRealmSpawnPositions(count) {
    const inset = 2.5;
    const apothem = FAE_REALM_HEX_RADIUS * Math.cos(Math.PI / 6) - inset;
    const positions = [];
    for (let i = 0; i < count; i++) {
      let placed = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        const x = (Math.random() * 2 - 1) * FAE_REALM_HEX_RADIUS;
        const z = (Math.random() * 2 - 1) * FAE_REALM_HEX_RADIUS;
        if (!isInsideHexArenaFloor(x, z, apothem)) continue;
        const distFromEntry = Math.hypot(x - FAE_REALM_ENTRY_X, z - FAE_REALM_ENTRY_Z);
        if (distFromEntry < 5.5) continue;
        if (positions.some((p) => Math.hypot(p.x - x, p.z - z) < 3.5)) continue;
        positions.push({ x, z });
        placed = true;
        break;
      }
      if (!placed) {
        const angle = (Math.PI * 2 * i) / Math.max(count, 1);
        positions.push({
          x: Math.sin(angle) * (apothem * 0.45),
          z: Math.cos(angle) * (apothem * 0.45),
        });
      }
    }
    return positions;
  }

  _buildFaeRealmEnemySpecs(roomIndex) {
    const pickColor = () => this._pickRandomCampColor();
    const camp = (color) => GameRoom.CAMP_TYPES[color];

    if (roomIndex === 1) {
      const recipes = [
        () => {
          const positions = this._generateFaeRealmSpawnPositions(2);
          return [
            { unitType: 'tiger', campDef: camp(pickColor()), pos: positions[0] },
            { unitType: 'tiger', campDef: camp(pickColor()), pos: positions[1] },
          ];
        },
        () => {
          const positions = this._generateFaeRealmSpawnPositions(2);
          return [
            { unitType: 'serpent', campDef: camp('green'), pos: positions[0] },
            { unitType: 'serpent', campDef: camp('blue'), pos: positions[1] },
          ];
        },
        () => {
          const positions = this._generateFaeRealmSpawnPositions(5);
          return positions.map((pos) => ({
            unitType: 'wolf',
            campDef: camp(pickColor()),
            pos,
          }));
        },
      ];
      return recipes[Math.floor(Math.random() * recipes.length)]();
    }

    if (roomIndex === 2) {
      const wyvernRecipe = () => {
        const positions = this._generateFaeRealmSpawnPositions(1);
        return [
          { unitType: 'wyvern', campDef: camp(pickColor()), pos: positions[0] },
        ];
      };
      const terrorhawkRecipe = () => {
        const positions = this._generateFaeRealmSpawnPositions(1);
        return [
          { unitType: 'terrorhawk', campDef: camp(pickColor()), pos: positions[0] },
        ];
      };
      const skyrayRecipe = () => {
        const positions = this._generateFaeRealmSpawnPositions(3);
        return positions.map((pos) => ({
          unitType: 'skyray',
          campDef: camp(pickColor()),
          pos,
        }));
      };
      const beastTrioRecipe = () => {
        const positions = this._generateFaeRealmSpawnPositions(3);
        return [
          { unitType: 'bear', campDef: camp(pickColor()), pos: positions[0] },
          { unitType: 'wolf', campDef: camp(pickColor()), pos: positions[1] },
          { unitType: 'tiger', campDef: camp(pickColor()), pos: positions[2] },
        ];
      };
      // 15% wyvern / 15% terrorhawk / 35% 3 skyrays / 35% bear+wolf+tiger
      const roll = Math.random();
      if (roll < 0.15) return wyvernRecipe();
      if (roll < 0.30) return terrorhawkRecipe();
      if (roll < 0.65) return skyrayRecipe();
      return beastTrioRecipe();
    }

    if (roomIndex === 3) {
      const recipes = [
        () => {
          const positions = this._generateFaeRealmSpawnPositions(4);
          return {
            bossKind: 'tiger',
            specs: [
              { unitType: 'boss-tiger', campDef: camp(pickColor()), pos: positions[0] },
              { unitType: 'tiger', campDef: camp(pickColor()), pos: positions[1] },
              { unitType: 'tiger', campDef: camp(pickColor()), pos: positions[2] },
              { unitType: 'tiger', campDef: camp(pickColor()), pos: positions[3] },
            ],
          };
        },
        () => {
          const positions = this._generateFaeRealmSpawnPositions(9);
          return {
            bossKind: 'wolf',
            specs: [
              { unitType: 'boss-wolf', campDef: camp(pickColor()), pos: positions[0] },
              ...positions.slice(1).map((pos) => ({
                unitType: 'wolf',
                campDef: camp(pickColor()),
                pos,
              })),
            ],
          };
        },
        () => {
          const positions = this._generateFaeRealmSpawnPositions(4);
          return {
            bossKind: 'serpent',
            specs: [
              { unitType: 'boss-serpent', campDef: camp(pickColor()), pos: positions[0] },
              { unitType: 'serpent', campDef: camp(pickColor()), pos: positions[1] },
              { unitType: 'serpent', campDef: camp(pickColor()), pos: positions[2] },
              { unitType: 'serpent', campDef: camp(pickColor()), pos: positions[3] },
            ],
          };
        },
        () => {
          const positions = this._generateFaeRealmSpawnPositions(2);
          return {
            bossKind: 'bear',
            specs: [
              { unitType: 'boss-bear', campDef: camp(pickColor()), pos: positions[0] },
              { unitType: 'bear', campDef: camp(pickColor()), pos: positions[1] },
            ],
          };
        },
        () => {
          const positions = this._generateFaeRealmSpawnPositions(1);
          return {
            bossKind: 'spider',
            specs: [
              { unitType: 'bone-spider', campDef: camp(pickColor()), pos: positions[0] },
            ],
          };
        },
      ];
      return recipes[Math.floor(Math.random() * recipes.length)]();
    }

    return { bossKind: null, specs: [] };
  }

  spawnFaeRealmWave(roomIndex) {
    this.coopWaveSpawnPlan = null;
    this.coopRequiredQueue = [];
    this.roomHasMartyrs = false;
    this.roomHasTitans = false;
    this.roomTitanQuota = 0;
    this.roomHasMiniBoss1 = false;
    this.roomHasWraith = false;

    const built = this._buildFaeRealmEnemySpecs(roomIndex);
    // Rooms 1–2 return a plain specs array; room 3 returns { bossKind, specs }.
    const specs = Array.isArray(built) ? built : (built?.specs || []);
    const bossKind = Array.isArray(built)
      ? null
      : normalizeFaeBeastCompanionKind(built?.bossKind);
    this.coopFaeRealmBossKind = roomIndex === 3 ? bossKind : this.coopFaeRealmBossKind;
    this.coopFaeRealmLivingCount = specs.length;
    this.coopWaveQuota = specs.length;
    this.skeletonKillCount = 0;
    this.sessionCampTypes = ['fae_realm'];
    this.currentCoopRoomKind = 'fae_realm';

    const wavePositions = [];
    specs.forEach((spec, slotIndex) => {
      const enemy = this._buildEnemy(spec.unitType, 0, slotIndex, spec.pos, spec.campDef);
      this.enemies.set(enemy.id, enemy);
      wavePositions.push({ x: spec.pos.x, z: spec.pos.z });
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-spawned', { enemy, timestamp: Date.now() });
      }
    });

    const spineCamp = GameRoom.CAMP_TYPES[this._pickRandomCampColor()];
    this._spawnTentacleSpinesForWave(wavePositions, spineCamp, {
      mapHalf: FAE_REALM_HEX_RADIUS - MAIN_ARENA_SPAWN_INSET,
      entryPos: { x: FAE_REALM_ENTRY_X, z: FAE_REALM_ENTRY_Z },
      entryClearRadius: 5.5,
      shape: 'hex',
      hexApothem: FAE_REALM_INNER_APOTHEM,
    });

    if (this.io) {
      const hasBossWolf = specs.some((s) => s.unitType === 'boss-wolf');
      const wolfCount = specs.filter(
        (s) => s.unitType === 'wolf' || s.unitType === 'boss-wolf',
      ).length;
      if (hasBossWolf || wolfCount >= 5) {
        this.io.to(this.roomId).emit('wolf-pack-howls', {
          position: wavePositions[0]
            ? { x: wavePositions[0].x, y: 0, z: wavePositions[0].z }
            : { x: 0, y: 0, z: 0 },
          timestamp: Date.now(),
        });
      }
      this.io.to(this.roomId).emit('skeleton-kill-count-updated', {
        skeletonKillCount: 0,
        required: specs.length,
        timestamp: Date.now(),
      });
      this.io.to(this.roomId).emit('camps-initialized', {
        campTypes: this.sessionCampTypes,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        timestamp: Date.now(),
      });
    }
  }

  _registerFaeRealmKill(emojiLog) {
    if (!this.coopFaeRealmActive || this.bossSpawned) return;
    this.skeletonKillCount += 1;
    const killTarget = this.coopFaeRealmLivingCount || this.coopWaveQuota || 1;
    console.log(`${emojiLog} (fae ${this.coopFaeRealmRoomIndex}: ${this.skeletonKillCount}/${killTarget})`);
    if (this.io) {
      this.io.to(this.roomId).emit('skeleton-kill-count-updated', {
        skeletonKillCount: this.skeletonKillCount,
        required: killTarget,
        timestamp: Date.now(),
      });
    }
    if (this.skeletonKillCount >= killTarget) {
      this._onFaeRealmRoomCleared(this.coopFaeRealmRoomIndex);
    }
  }

  _awardFaeRealmRoomGold(roomIndex) {
    const gold = COOP_FAE_REALM_ROOM_GOLD[roomIndex - 1] || 0;
    if (gold <= 0) return gold;
    for (const player of this.players.values()) {
      player.gold = (player.gold || 0) + gold;
      if (this.io) {
        this.io.to(this.roomId).emit('player-gold-changed', {
          playerId: player.id,
          gold: player.gold,
          timestamp: Date.now(),
        });
      }
    }
    return gold;
  }

  _emitFaeRealmIntermission(extra = {}) {
    if (!this.io) return;
    this.io.to(this.roomId).emit('coop-fae-realm-intermission', {
      combatArenaActive: true,
      coopCurrentRoomKind: this.currentCoopRoomKind,
      coopClearedRoomKind: this.clearedCoopRoomKind,
      thronePortalOffer: [...this.thronePortalOffer],
      coopMainArenaPortalPhase: this.coopMainArenaPortalPhase,
      coopBossThroneArena: false,
      coopThroneBossKind: null,
      coopTerrainTheme: this.getCoopTerrainTheme(),
      merchantInventory: this.getMerchantInventory(),
      players: this.getPlayers(),
      enemies: this.getEnemies(),
      ...this._getFaeRealmPayloadFields(),
      ...extra,
      timestamp: Date.now(),
    });
  }

  _onFaeRealmRoomCleared(roomIndex) {
    const goldAmount = this._awardFaeRealmRoomGold(roomIndex);
    this._clearAllCombatEnemies();
    this.skeletonKillCount = 0;
    this.clearedCoopRoomKind = 'fae_realm';
    this.sessionCampTypes = [];
    this.coopFaeRealmPortalOpen = true;
    let faeBeastCompanionGranted = false;
    let faeBeastCompanionKind = null;
    if (roomIndex === 3 && !this.coopFaeBeastCompanionGranted) {
      this.grantFaeBeastCompanionsToAllPlayers();
      faeBeastCompanionGranted = this.coopFaeBeastCompanionGranted;
      faeBeastCompanionKind = this.coopFaeBeastCompanionKind;
    }
    this._emitFaeRealmIntermission({
      faeRealmGoldReward: goldAmount,
      faeBeastCompanionGranted,
      faeBeastCompanionKind,
    });
    console.log(`✨ Fae Realm room ${roomIndex} cleared (+${goldAmount} gold) — void portal open.`);
  }

  teleportAllPlayersToFaeRealmSpawn() {
    if (this.gameMode === 'coop') {
      this.coopRoomEntryToken += 1;
      this.coopPostTeleportPositionGuardUntil = Date.now() + COOP_POST_TELEPORT_POSITION_GUARD_MS;
      this._rollCoopSkyPresetForEntry(this.currentCoopRoomKind ?? 'fae_realm');
    }
    const spawnBaseX = FAE_REALM_ENTRY_X;
    const spawnBaseZ = FAE_REALM_ENTRY_Z;
    const totalPlayers = Math.max(this.players.size, 1);
    let idx = 0;
    for (const player of this.players.values()) {
      const angleStep = (Math.PI * 2) / Math.max(3, totalPlayers);
      const angle = idx * angleStep;
      const spawnRadius = 1.25;
      const rawX = spawnBaseX + Math.sin(angle) * spawnRadius;
      const rawZ = spawnBaseZ + Math.cos(angle) * spawnRadius;
      const c = clampPositionToHexXZ(rawX, rawZ, FAE_REALM_HEX_RADIUS);
      player.position = { x: c.x, y: 1, z: c.z };
      const y = rotationYTowardArenaCenter(c.x, c.z);
      player.rotation = { x: 0, y, z: 0 };
      idx++;
    }
    this.repositionAllBeastCompanionsNearOwners();
  }

  /**
   * Enter an introductory castle room (1–4). Called from Fae Realm III void portal or post-clear void portal.
   * @param {1|2|3|4} roomIndex
   * @returns {boolean}
   */
  beginIntroRoom(roomIndex) {
    if (!this.gameStarted || this.gameMode !== 'coop') return false;
    const n = Number(roomIndex);
    if (!Number.isFinite(n) || n < 1 || n > 4) return false;

    if (n === 1) {
      const fromFae = this.coopFaeRealmActive && this.coopFaeRealmPortalOpen && this.coopFaeRealmRoomIndex === 3;
      if (!fromFae) return false;
      this.coopFaeRealmActive = false;
      this.coopFaeRealmPortalOpen = false;
      this.coopFaeRealmPending = false;
      this.coopFaeRealmRoomIndex = 0;
      this.coopFaeRealmLivingCount = 0;
    } else {
      if (!this.coopIntroActive || !this.coopIntroPortalOpen || this.coopIntroRoomIndex !== n - 1) {
        return false;
      }
    }

    this.removeThroneTrainingDummy();
    this._clearAllCombatEnemies();
    this.coopIntroPending = false;
    this.coopIntroActive = true;
    this.coopIntroRoomIndex = n;
    this.coopIntroPortalOpen = false;
    this.coopIntroFountainPhase = false;
    this.coopIntroFountainUsed = false;
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.coopBossThroneArena = false;
    this.coopThroneBossKind = null;
    this.currentCoopRoomKind = 'intro';
    this.clearedCoopRoomKind = null;
    this.combatArenaActive = true;
    this.skeletonKillCount = 0;
    this.bossSpawned = false;
    this.merchantInventory = [];
    this._resetMushroomState();

    const coopCombatTransitionId = this._beginCoopCombatTransition({ spawnInitialWave: true });
    this.teleportAllPlayersToIntroSpawn();

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopColoredRoomVisitIndex: null,
        coopBossRoomVisitIndex: null,
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        ...this._getIntroPayloadFields(),
        ...this._getFaeRealmPayloadFields(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  _registerIntroKill(emojiLog) {
    if (!this.coopIntroActive || this.bossSpawned) return;
    this.skeletonKillCount += 1;
    const killTarget = this.coopIntroLivingCount || this.coopWaveQuota || 1;
    console.log(`${emojiLog} (intro ${this.coopIntroRoomIndex}: ${this.skeletonKillCount}/${killTarget})`);
    if (this.io) {
      this.io.to(this.roomId).emit('skeleton-kill-count-updated', {
        skeletonKillCount: this.skeletonKillCount,
        required: killTarget,
        timestamp: Date.now(),
      });
    }
    if (this.skeletonKillCount >= killTarget) {
      this._onIntroRoomCleared(this.coopIntroRoomIndex);
      return;
    }
    if (this.coopRequiredQueue.length > 0) {
      this._pumpCoopSpawns(COOP_WAVE_REINFORCE_STAGGER_MS);
    }
  }

  _awardIntroRoomGold(roomIndex) {
    const gold = COOP_INTRO_ROOM_GOLD[roomIndex - 1] || 0;
    if (gold <= 0) return gold;
    for (const player of this.players.values()) {
      player.gold = (player.gold || 0) + gold;
      if (this.io) {
        this.io.to(this.roomId).emit('player-gold-changed', {
          playerId: player.id,
          gold: player.gold,
          timestamp: Date.now(),
        });
      }
    }
    return gold;
  }

  _emitIntroIntermission(extra = {}) {
    if (!this.io) return;
    this.io.to(this.roomId).emit('coop-intro-intermission', {
      combatArenaActive: true,
      coopCurrentRoomKind: this.currentCoopRoomKind,
      coopClearedRoomKind: this.clearedCoopRoomKind,
      thronePortalOffer: [...this.thronePortalOffer],
      coopMainArenaPortalPhase: this.coopMainArenaPortalPhase,
      coopBossThroneArena: false,
      coopThroneBossKind: null,
      coopTerrainTheme: this.getCoopTerrainTheme(),
      merchantInventory: this.getMerchantInventory(),
      players: this.getPlayers(),
      enemies: this.getEnemies(),
      ...this._getIntroPayloadFields(),
      ...extra,
      timestamp: Date.now(),
    });
  }

  _onIntroRoomCleared(roomIndex) {
    const goldAmount = this._awardIntroRoomGold(roomIndex);
    this._clearAllCombatEnemies();
    this.skeletonKillCount = 0;
    this.clearedCoopRoomKind = 'intro';
    this.sessionCampTypes = [];

    if (roomIndex < 4) {
      this.coopIntroPortalOpen = true;
      this._emitIntroIntermission({ introGoldReward: goldAmount, fountainPhase: false });
      console.log(`✨ Intro room ${roomIndex} cleared (+${goldAmount} gold) — void portal open.`);
      return;
    }

    this.coopIntroPortalOpen = false;
    this.coopIntroFountainPhase = true;
    this.coopIntroFountainUsed = false;
    this.coopIntroAllyChoiceMade = false;
    this._pickCoopAllyOffer();
    this._pickThronePortalOffer();
    this._emitIntroIntermission({ introGoldReward: goldAmount, fountainPhase: true });
    console.log(`✨ Intro room 4 cleared (+${goldAmount} gold) — ally choice + fountain + portal choice.`);
  }

  /**
   * Lock in Knight or Huntress as the co-op ally for the rest of the run.
   * @param {string} playerId
   * @param {string} allyKind
   * @returns {boolean}
   */
  chooseCoopAlly(playerId, allyKind) {
    const inIntro = this.coopIntroFountainPhase && !this.coopIntroAllyChoiceMade;
    if (!inIntro) return false;
    if (!this.players.get(playerId)) return false;

    const kind = normalizeCoopAllyKind(allyKind);
    if (!this.coopAllyOffer.includes(kind)) return false;
    this.coopAllyKind = kind;
    this.coopIntroAllyChoiceMade = true;
    this._emitIntroIntermission({ allyChoiceMade: true, coopAllyKind: kind });
    console.log(`🤝 Co-op ally chosen: ${kind}`);
    return true;
  }

  /** Heal all players +100 HP and unlock the dual colored portals after intro room 4 ally choice. */
  useCoopFountain(playerId) {
    if (this.currentCoopRoomKind === 'eden') {
      if (this.coopEdenFountainUsed) return false;
      const trigger = this.players.get(playerId);
      if (!trigger) return false;

      this._applyCoopFountainHealAll(playerId);
      this.coopEdenFountainUsed = true;
      this.coopMainArenaPortalPhase = 'eden_exit';
      this.thronePortalOffer = this.coopEdenResumeKind ? [this.coopEdenResumeKind] : [];
      this._emitEdenIntermission({ fountainUsed: true });
      return true;
    }

    if (this.currentCoopRoomKind === 'false_eden') {
      if (!this.coopFalseEdenCleared || this.coopEdenFountainUsed) return false;
      const trigger = this.players.get(playerId);
      if (!trigger) return false;

      this._applyCoopFountainHealAll(playerId);
      this.coopEdenFountainUsed = true;
      this.coopMainArenaPortalPhase = 'eden_exit';
      this.thronePortalOffer = this.coopEdenResumeKind ? [this.coopEdenResumeKind] : [];
      this._emitEdenIntermission({ fountainUsed: true });
      return true;
    }

    if (!this.coopIntroFountainPhase && !this.coopSunkenFountainPhase && !this.coopEternityFountainPhase) return false;
    if (this.coopIntroFountainPhase) {
      if (this.coopIntroFountainUsed || !this.coopIntroAllyChoiceMade) return false;
    } else if (this.coopSunkenFountainPhase) {
      if (this.coopSunkenFountainUsed || !this.coopSunkenLootPhaseComplete) return false;
    } else if (this.coopEternityFountainPhase) {
      if (this.coopEternityFountainUsed || !this.coopEternityLootPhaseComplete) return false;
    }
    const trigger = this.players.get(playerId);
    if (!trigger) return false;

    this._applyCoopFountainHealAll(playerId);

    if (this.coopSunkenFountainPhase) {
      this.coopSunkenFountainUsed = true;
      this._emitSunkenIntermission({ fountainUsed: true });
    } else if (this.coopEternityFountainPhase) {
      this.coopEternityFountainUsed = true;
      this._emitEternityIntermission({ fountainUsed: true });
    } else {
      this.coopIntroFountainUsed = true;
      this._emitIntroIntermission({ fountainUsed: true });
    }
    return true;
  }

  /**
   * After intro sequence: enter the first normal colored room and resume the standard loop.
   * @param {string} chosenCampType
   * @returns {boolean}
   */
  enterFirstNormalRoomAfterIntro(chosenCampType) {
    if (!this.coopIntroFountainPhase || !this.coopIntroFountainUsed || !this.coopIntroAllyChoiceMade) return false;
    const offer = this.thronePortalOffer;
    if (!offer || offer.length !== 2) return false;

    let pick = chosenCampType != null ? String(chosenCampType).toLowerCase() : '';
    if (!pick || !offer.includes(pick)) pick = offer[0];
    if (!GameRoom.CAMP_TYPES[pick]) return false;

    this.coopIntroActive = false;
    this.coopIntroPending = false;
    this.coopIntroFountainPhase = false;
    this.coopIntroPortalOpen = false;
    this.coopIntroFountainUsed = false;
    // Keep coopIntroAllyChoiceMade true so HUD ally badges persist for the run.
    this.coopIntroRoomIndex = 0;
    this.coopIntroLivingCount = 0;
    this.coopSegmentCombatRoomsCleared = 0;
    this._resetEdenSegmentState();
    this._clearPreBossSequenceState();

    this.pendingCoopArchetype = pick;
    this.pendingCoopRoomKind = pick;
    this.currentCoopRoomKind = pick;
    this.clearedCoopRoomKind = null;
    this._bumpColoredRoomVisit(pick);
    this._resetCoopRoomWhisperForEntry(pick);
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.merchantInventory = [];
    this._resetMushroomState();
    this.skeletonKillCount = 0;

    const coopCombatTransitionId = this._beginCoopCombatTransition({ spawnInitialWave: true });
    this.teleportAllPlayersToCombatSpawn();

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopColoredRoomVisitIndex: this._getCoopColoredRoomVisitIndexForEmit(),
        coopBossRoomVisitIndex: this._getCoopBossRoomVisitIndexForEmit(),
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        ...this._getIntroPayloadFields(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  /**
   * Enter a sunken temple room (1–4). Called from post-Boss 1 void rift or post-clear void portal.
   * @param {1|2|3|4} roomIndex
   * @returns {boolean}
   */
  beginSunkenRoom(roomIndex) {
    if (!this.gameStarted || this.gameMode !== 'coop') return false;
    const n = Number(roomIndex);
    if (!Number.isFinite(n) || n < 1 || n > 4) return false;

    if (n === 1) {
      if (!this.combatArenaActive || this.coopSunkenCompleted) return false;
      if (this.coopMainArenaPortalPhase !== 'pick_sunken_entry') return false;
    } else {
      if (!this.coopSunkenActive || !this.coopSunkenPortalOpen || this.coopSunkenRoomIndex !== n - 1) {
        return false;
      }
    }

    this._clearAllCombatEnemies();
    this.coopSunkenActive = true;
    this.coopSunkenRoomIndex = n;
    this.coopSunkenPortalOpen = false;
    this.coopSunkenFountainPhase = false;
    this.coopSunkenFountainUsed = false;
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.coopBossThroneArena = false;
    this.coopThroneBossKind = null;
    this.currentCoopRoomKind = 'sunken_temple';
    this.clearedCoopRoomKind = null;
    this.combatArenaActive = true;
    this.skeletonKillCount = 0;
    this.bossSpawned = false;
    this.merchantInventory = [];
    this._resetMushroomState();

    const coopCombatTransitionId = this._beginCoopCombatTransition({ spawnInitialWave: true });
    this.teleportAllPlayersToSunkenSpawn();

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopColoredRoomVisitIndex: null,
        coopBossRoomVisitIndex: null,
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        ...this._getSunkenPayloadFields(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  _registerSunkenKill(emojiLog) {
    if (!this.coopSunkenActive || this.bossSpawned) return;
    this.skeletonKillCount += 1;
    const killTarget = this.coopSunkenLivingCount || this.coopWaveQuota || 1;
    console.log(`${emojiLog} (sunken ${this.coopSunkenRoomIndex}: ${this.skeletonKillCount}/${killTarget})`);
    if (this.io) {
      this.io.to(this.roomId).emit('skeleton-kill-count-updated', {
        skeletonKillCount: this.skeletonKillCount,
        required: killTarget,
        timestamp: Date.now(),
      });
    }
    if (this.skeletonKillCount >= killTarget) {
      this._onSunkenRoomCleared(this.coopSunkenRoomIndex);
      return;
    }
    if (this.coopRequiredQueue.length > 0) {
      this._pumpCoopSpawns(COOP_WAVE_REINFORCE_STAGGER_MS);
    }
  }

  _awardSunkenRoomGold(roomIndex) {
    const gold = COOP_SUNKEN_ROOM_GOLD[roomIndex - 1] || 0;
    if (gold <= 0) return gold;
    for (const player of this.players.values()) {
      player.gold = (player.gold || 0) + gold;
      if (this.io) {
        this.io.to(this.roomId).emit('player-gold-changed', {
          playerId: player.id,
          gold: player.gold,
          timestamp: Date.now(),
        });
      }
    }
    return gold;
  }

  _emitSunkenIntermission(extra = {}) {
    if (!this.io) return;
    this.io.to(this.roomId).emit('coop-sunken-intermission', {
      combatArenaActive: true,
      coopCurrentRoomKind: this.currentCoopRoomKind,
      coopClearedRoomKind: this.clearedCoopRoomKind,
      thronePortalOffer: [...this.thronePortalOffer],
      coopMainArenaPortalPhase: this.coopMainArenaPortalPhase,
      coopBossThroneArena: false,
      coopThroneBossKind: null,
      coopTerrainTheme: this.getCoopTerrainTheme(),
      merchantInventory: this.getMerchantInventory(),
      players: this.getPlayers(),
      enemies: this.getEnemies(),
      ...this._getSunkenPayloadFields(),
      ...extra,
      timestamp: Date.now(),
    });
  }

  _onSunkenRoomCleared(roomIndex) {
    const goldAmount = this._awardSunkenRoomGold(roomIndex);
    this._clearAllCombatEnemies();
    this.skeletonKillCount = 0;
    this.clearedCoopRoomKind = 'sunken_temple';
    this.sessionCampTypes = [];

    if (roomIndex < 4) {
      this.coopSunkenPortalOpen = true;
      this._emitSunkenIntermission({ sunkenGoldReward: goldAmount, fountainPhase: false });
      console.log(`✨ Sunken temple room ${roomIndex} cleared (+${goldAmount} gold) — void portal open.`);
      return;
    }

    this.coopSunkenPortalOpen = false;
    this.coopSunkenFountainPhase = true;
    this.coopSunkenFountainUsed = false;
    this.coopSunkenAllyChoiceMade = false;
    this.coopSunkenLootClaimedPlayerIds = new Set();
    this.coopSunkenLootPhaseComplete = false;
    this._rollSunkenTempleLootOffer();
    this._pickThronePortalOffer();
    this._emitSunkenIntermission({ sunkenGoldReward: goldAmount, fountainPhase: true });
    console.log(`✨ Sunken temple room 4 cleared (+${goldAmount} gold) — sentinel loot + fountain + portal choice.`);
  }

  _rollSunkenTempleLootOffer() {
    const pendant = PENDANT_POOL[Math.floor(Math.random() * PENDANT_POOL.length)];
    const exodia = EXODIA_ITEM_POOL[Math.floor(Math.random() * EXODIA_ITEM_POOL.length)];
    const ring = DREAM_LAYER_RING_POOL[Math.floor(Math.random() * DREAM_LAYER_RING_POOL.length)];
    const ts = Date.now();
    this.coopSunkenLootOffer = [
      {
        id: `sunken-loot-warding-${ts}`,
        kind: 'warding_pendant',
        cost: 0,
        sold: false,
        label: pendant.label,
        description: pendant.description,
        item: {
          id: `sunken-ward-${ts}`,
          type: pendant.type,
          label: pendant.label,
          category: 'ward',
          bannedEnemyType: pendant.bannedEnemyType,
          iconPath: pendant.iconPath,
        },
      },
      {
        id: `sunken-loot-exodia-${ts}`,
        kind: 'exodia',
        cost: 0,
        sold: false,
        label: exodia.label,
        description: dreamLayerItems.getDreamLayerItemDescription(exodia.type),
        item: {
          id: `sunken-exodia-${ts}`,
          type: exodia.type,
          label: exodia.label,
          category: 'boss_drop',
          rarity: 'legendary',
        },
      },
      {
        id: `sunken-loot-ring-${ts}`,
        kind: 'ring',
        cost: 0,
        sold: false,
        label: ring.label,
        description: dreamLayerItems.getDreamLayerItemDescription(ring.type),
        item: {
          id: `sunken-ring-${ts}`,
          type: ring.type,
          label: ring.label,
          category: 'boss_drop',
          rarity: 'legendary',
        },
      },
    ];
  }

  /**
   * Claim one free boss-loot item from the sunken room 4 sentinel offer.
   * @param {string} playerId
   * @param {string} stockId
   * @returns {boolean}
   */
  chooseSunkenTempleLoot(playerId, stockId) {
    if (!this.coopSunkenFountainPhase || this.coopSunkenLootPhaseComplete) return false;
    const player = this.players.get(playerId);
    if (!player) return false;
    if (this.coopSunkenLootClaimedPlayerIds.has(playerId)) return false;

    const entry = this.coopSunkenLootOffer.find((item) => item.id === stockId);
    if (!entry || entry.sold) return false;

    const itemType = entry.item?.type;
    if (itemType && dreamLayerItems.isUniqueOwnedItem(itemType) && dreamLayerItems.playerOwnsItem(player, itemType)) {
      this._emitSunkenLootFailure(playerId, 'item_already_owned');
      return false;
    }
    if (itemType === 'PERSEPHONE' && (player.hasPersephone || player.persephoneConsumed || dreamLayerItems.playerOwnsItem(player, 'PERSEPHONE'))) {
      this._emitSunkenLootFailure(playerId, 'item_already_owned');
      return false;
    }

    const item = {
      ...entry.item,
      id: `${entry.item?.type || entry.kind}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    };

    if (entry.kind === 'warding_pendant' && item.bannedEnemyType) {
      this.bannedEnemyTypes.add(item.bannedEnemyType);
    }

    if (item.type) {
      this._registerPlayerDreamLayerItem(playerId, player, item.type);
    }

    this.coopSunkenLootClaimedPlayerIds.add(playerId);
    if (this.coopSunkenLootClaimedPlayerIds.size >= this.players.size) {
      this.coopSunkenLootPhaseComplete = true;
    }

    if (this.io) {
      this.io.to(this.roomId).emit('item-picked-up', {
        itemId: item.id,
        playerId,
        item,
        timestamp: Date.now(),
      });
      this.io.to(playerId).emit('coop-sunken-loot-chosen', {
        stockId,
        item,
        coopSunkenLootClaimedPlayerIds: [...this.coopSunkenLootClaimedPlayerIds],
        coopSunkenLootPhaseComplete: this.coopSunkenLootPhaseComplete,
        timestamp: Date.now(),
      });
    }

    this._emitSunkenIntermission({
      coopSunkenLootClaimedPlayerIds: [...this.coopSunkenLootClaimedPlayerIds],
      coopSunkenLootPhaseComplete: this.coopSunkenLootPhaseComplete,
    });
    console.log(`🎁 Sunken loot chosen by ${playerId}: ${item.label ?? item.type}`);
    return true;
  }

  _emitSunkenLootFailure(playerId, reason) {
    if (!this.io) return;
    this.io.to(playerId).emit('coop-sunken-loot-failed', {
      reason,
      timestamp: Date.now(),
    });
  }

  /**
   * After sunken temple sequence: resume the normal loop where Boss 1 left off.
   * @param {string} chosenCampType
   * @returns {boolean}
   */
  enterMainLoopAfterSunken(chosenCampType) {
    if (!this.coopSunkenFountainPhase || !this.coopSunkenFountainUsed || !this.coopSunkenLootPhaseComplete) return false;
    const offer = this.thronePortalOffer;
    if (!offer || offer.length !== 2) return false;

    let pick = chosenCampType != null ? String(chosenCampType).toLowerCase() : '';
    if (!pick || !offer.includes(pick)) pick = offer[0];
    if (!GameRoom.CAMP_TYPES[pick]) return false;

    this.coopSunkenActive = false;
    this.coopSunkenFountainPhase = false;
    this.coopSunkenPortalOpen = false;
    this.coopSunkenFountainUsed = false;
    this.coopSunkenAllyChoiceMade = false;
    this.coopSunkenLootOffer = [];
    this.coopSunkenLootClaimedPlayerIds = new Set();
    this.coopSunkenLootPhaseComplete = false;
    this.coopSunkenRoomIndex = 0;
    this.coopSunkenLivingCount = 0;
    this.coopSunkenCompleted = true;
    this.coopSegmentCombatRoomsCleared = 0;
    this._resetEdenSegmentState();
    this._clearPreBossSequenceState();

    this.pendingCoopArchetype = pick;
    this.pendingCoopRoomKind = pick;
    this.currentCoopRoomKind = pick;
    this.clearedCoopRoomKind = null;
    this._bumpColoredRoomVisit(pick);
    this._resetCoopRoomWhisperForEntry(pick);
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.merchantInventory = [];
    this._resetMushroomState();
    this.skeletonKillCount = 0;

    const coopCombatTransitionId = this._beginCoopCombatTransition({ spawnInitialWave: true });
    this.teleportAllPlayersToCombatSpawn();

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopColoredRoomVisitIndex: this._getCoopColoredRoomVisitIndexForEmit(),
        coopBossRoomVisitIndex: this._getCoopBossRoomVisitIndexForEmit(),
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        ...this._getSunkenPayloadFields(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  teleportAllPlayersToEternitySpawn() {
    if (this.gameMode === 'coop') {
      this.coopRoomEntryToken += 1;
      this.coopPostTeleportPositionGuardUntil = Date.now() + COOP_POST_TELEPORT_POSITION_GUARD_MS;
      this._rollCoopSkyPresetForEntry(this.currentCoopRoomKind ?? 'eternity_palace');
    }
    const spawnBaseX = ETERNITY_PALACE_ENTRY_X;
    const spawnBaseZ = ETERNITY_PALACE_ENTRY_Z;
    const totalPlayers = Math.max(this.players.size, 1);
    let idx = 0;
    for (const player of this.players.values()) {
      const angleStep = (Math.PI * 2) / Math.max(3, totalPlayers);
      const angle = idx * angleStep;
      const spawnRadius = 1.25;
      const rawX = spawnBaseX + Math.sin(angle) * spawnRadius;
      const rawZ = spawnBaseZ + Math.cos(angle) * spawnRadius;
      const c = clampPositionToHexXZ(rawX, rawZ, ETERNITY_PALACE_HEX_RADIUS);
      player.position = { x: c.x, y: 1, z: c.z };
      const y = rotationYTowardArenaCenter(c.x, c.z);
      player.rotation = { x: 0, y, z: 0 };
      idx++;
    }
    this.repositionAllBeastCompanionsNearOwners();
  }

  _generateEternitySpawnPositions(count) {
    const inset = 2.5;
    const apothem = ETERNITY_PALACE_HEX_RADIUS * Math.cos(Math.PI / 6) - inset;
    const positions = [];
    for (let i = 0; i < count; i++) {
      let placed = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        const x = (Math.random() * 2 - 1) * ETERNITY_PALACE_HEX_RADIUS;
        const z = (Math.random() * 2 - 1) * ETERNITY_PALACE_HEX_RADIUS;
        if (!isInsideHexArenaFloor(x, z, apothem)) continue;
        const distFromEntry = Math.hypot(x - ETERNITY_PALACE_ENTRY_X, z - ETERNITY_PALACE_ENTRY_Z);
        if (distFromEntry < 5.5) continue;
        if (positions.some((p) => Math.hypot(p.x - x, p.z - z) < 3.5)) continue;
        positions.push({ x, z });
        placed = true;
        break;
      }
      if (!placed) {
        const angle = (Math.PI * 2 * i) / Math.max(count, 1);
        positions.push({
          x: Math.sin(angle) * (apothem * 0.45),
          z: Math.cos(angle) * (apothem * 0.45),
        });
      }
    }
    return positions;
  }

  _buildEternityEnemySpecs(roomIndex) {
    const pickColor = () => this._pickRandomCampColor();
    const camp = (color) => GameRoom.CAMP_TYPES[color];

    if (roomIndex === 1) {
      const recipes = [
        () => {
          const positions = this._generateEternitySpawnPositions(3);
          return [
            { unitType: 'wyvern', campDef: camp(pickColor()), pos: positions[0] },
            { unitType: 'knight', campDef: camp(pickColor()), pos: positions[1] },
            { unitType: 'knight', campDef: camp(pickColor()), pos: positions[2] },
          ];
        },
        () => {
          const positions = this._generateEternitySpawnPositions(1);
          return [
            { unitType: 'stone-giant', campDef: camp(pickColor()), pos: positions[0] },
          ];
        },
      ];
      return recipes[Math.floor(Math.random() * recipes.length)]();
    }
    if (roomIndex === 2) {
      const recipes = [
        () => {
          const positions = this._generateEternitySpawnPositions(3);
          return [
            { unitType: 'terrorhawk', campDef: camp(pickColor()), pos: positions[0] },
            { unitType: 'viper', campDef: camp('green'), pos: positions[1] },
            { unitType: 'viper', campDef: camp('blue'), pos: positions[2] },
          ];
        },
        () => {
          const positions = this._generateEternitySpawnPositions(1);
          return [
            { unitType: 'eternal-oak', campDef: camp(pickColor()), pos: positions[0] },
          ];
        },
      ];
      return recipes[Math.floor(Math.random() * recipes.length)]();
    }
    if (roomIndex === 3) {
      const recipes = [
        () => {
          const positions = this._generateEternitySpawnPositions(3);
          return [
            { unitType: 'wyvern', campDef: camp(pickColor()), pos: positions[0] },
            { unitType: 'wyvern', campDef: camp(pickColor()), pos: positions[1] },
            { unitType: 'terrorhawk', campDef: camp(pickColor()), pos: positions[2] },
          ];
        },
        () => {
          const positions = this._generateEternitySpawnPositions(1);
          return [
            { unitType: 'colossus', campDef: camp(pickColor()), pos: positions[0] },
          ];
        },
      ];
      return recipes[Math.floor(Math.random() * recipes.length)]();
    }
    if (roomIndex === 4) {
      const recipes = [
        () => {
          const positions = this._generateEternitySpawnPositions(3);
          return [
            { unitType: 'terrorhawk', campDef: camp(pickColor()), pos: positions[0] },
            { unitType: 'terrorhawk', campDef: camp(pickColor()), pos: positions[1] },
            { unitType: 'assassin', campDef: camp(pickColor()), pos: positions[2] },
          ];
        },
        () => {
          const positions = this._generateEternitySpawnPositions(3);
          return [
            { unitType: 'terrorhawk', campDef: camp(pickColor()), pos: positions[0] },
            { unitType: 'wyvern', campDef: camp(pickColor()), pos: positions[1] },
            { unitType: 'death-knight', campDef: camp(pickColor()), pos: positions[2] },
          ];
        },
        () => {
          const positions = this._generateEternitySpawnPositions(3);
          return [
            { unitType: 'wyvern', campDef: camp(pickColor()), pos: positions[0] },
            { unitType: 'wyvern', campDef: camp(pickColor()), pos: positions[1] },
            { unitType: 'spectre', campDef: camp(pickColor()), pos: positions[2] },
          ];
        },
        () => {
          const positions = this._generateEternitySpawnPositions(4);
          return [
            { unitType: 'wyvern', campDef: camp(pickColor()), pos: positions[0] },
            { unitType: 'tiger', campDef: camp(pickColor()), pos: positions[1] },
            { unitType: 'tiger', campDef: camp(pickColor()), pos: positions[2] },
            { unitType: 'shaman', campDef: camp(pickColor()), pos: positions[3] },
          ];
        },
      ];
      return recipes[Math.floor(Math.random() * recipes.length)]();
    }
    if (roomIndex === 5) {
      const recipes = [
        () => {
          const positions = this._generateEternitySpawnPositions(4);
          return [
            { unitType: 'eternal-oak', campDef: camp(pickColor()), pos: positions[0] },
            { unitType: 'knight', campDef: camp(pickColor()), pos: positions[1] },
            { unitType: 'knight', campDef: camp(pickColor()), pos: positions[2] },
            { unitType: 'knight', campDef: camp(pickColor()), pos: positions[3] },
          ];
        },
        () => {
          const positions = this._generateEternitySpawnPositions(4);
          return [
            { unitType: 'stone-giant', campDef: camp(pickColor()), pos: positions[0] },
            { unitType: 'knight', campDef: camp(pickColor()), pos: positions[1] },
            { unitType: 'knight', campDef: camp(pickColor()), pos: positions[2] },
            { unitType: 'knight', campDef: camp(pickColor()), pos: positions[3] },
          ];
        },
        () => {
          const positions = this._generateEternitySpawnPositions(4);
          return [
            { unitType: 'colossus', campDef: camp(pickColor()), pos: positions[0] },
            { unitType: 'templar', campDef: camp(pickColor()), pos: positions[1] },
            { unitType: 'knight', campDef: camp(pickColor()), pos: positions[2] },
            { unitType: 'viper', campDef: camp(pickColor()), pos: positions[3] },
          ];
        },
      ];
      return recipes[Math.floor(Math.random() * recipes.length)]();
    }
    return [];
  }

  spawnEternityWave(roomIndex) {
    this.coopWaveSpawnPlan = null;
    this.coopRequiredQueue = [];
    this.roomHasMartyrs = false;
    this.roomHasTitans = false;
    this.roomTitanQuota = 0;
    this.roomHasMiniBoss1 = false;
    this.roomHasWraith = false;

    const specs = this._buildEternityEnemySpecs(roomIndex);
    this.coopEternityLivingCount = specs.length;
    this.coopWaveQuota = specs.length;
    this.skeletonKillCount = 0;
    this.sessionCampTypes = ['eternity_palace'];
    this.currentCoopRoomKind = 'eternity_palace';

    specs.forEach((spec, slotIndex) => {
      const enemy = this._buildEnemy(spec.unitType, 0, slotIndex, spec.pos, spec.campDef);
      this.enemies.set(enemy.id, enemy);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-spawned', { enemy, timestamp: Date.now() });
      }
    });
  }

  beginEternityRoom(roomIndex) {
    if (!this.gameStarted || this.gameMode !== 'coop') return false;
    const n = Number(roomIndex);
    if (!Number.isFinite(n) || n < 1 || n > 5) return false;

    if (n === 1) {
      if (!this.combatArenaActive || this.coopEternityCompleted) return false;
      if (this.coopMainArenaPortalPhase !== 'pick_eternity_entry') return false;
    } else if (n === 4) {
      if (!this.combatArenaActive || this.coopEternityLateCompleted) return false;
      if (this.coopMainArenaPortalPhase !== 'pick_eternity_late_entry') return false;
      this.coopEternityLateSequence = true;
    } else {
      if (!this.coopEternityActive || !this.coopEternityPortalOpen || this.coopEternityRoomIndex !== n - 1) {
        return false;
      }
    }

    this._clearAllCombatEnemies();
    this.coopEternityActive = true;
    this.coopEternityRoomIndex = n;
    this.coopEternityPortalOpen = false;
    this.coopEternityFountainPhase = false;
    this.coopEternityFountainUsed = false;
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.coopBossThroneArena = false;
    this.coopThroneBossKind = null;
    this.currentCoopRoomKind = 'eternity_palace';
    this.clearedCoopRoomKind = null;
    this.combatArenaActive = true;
    this.skeletonKillCount = 0;
    this.bossSpawned = false;
    this.merchantInventory = [];
    this._resetMushroomState();

    const coopCombatTransitionId = this._beginCoopCombatTransition({ spawnInitialWave: true });
    this.teleportAllPlayersToEternitySpawn();

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopColoredRoomVisitIndex: null,
        coopBossRoomVisitIndex: null,
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        ...this._getEternityPayloadFields(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  _registerEternityKill(emojiLog) {
    if (!this.coopEternityActive || this.bossSpawned) return;
    this.skeletonKillCount += 1;
    const killTarget = this.coopEternityLivingCount || this.coopWaveQuota || 1;
    console.log(`${emojiLog} (eternity ${this.coopEternityRoomIndex}: ${this.skeletonKillCount}/${killTarget})`);
    if (this.io) {
      this.io.to(this.roomId).emit('skeleton-kill-count-updated', {
        skeletonKillCount: this.skeletonKillCount,
        required: killTarget,
        timestamp: Date.now(),
      });
    }
    if (this.skeletonKillCount >= killTarget) {
      this._onEternityRoomCleared(this.coopEternityRoomIndex);
      return;
    }
    if (this.coopRequiredQueue.length > 0) {
      this._pumpCoopSpawns(COOP_WAVE_REINFORCE_STAGGER_MS);
    }
  }

  _awardEternityRoomGold(roomIndex) {
    const gold = COOP_ETERNITY_ROOM_GOLD[roomIndex - 1] || 0;
    if (gold <= 0) return gold;
    for (const player of this.players.values()) {
      player.gold = (player.gold || 0) + gold;
      if (this.io) {
        this.io.to(this.roomId).emit('player-gold-changed', {
          playerId: player.id,
          gold: player.gold,
          timestamp: Date.now(),
        });
      }
    }
    return gold;
  }

  _emitEternityIntermission(extra = {}) {
    if (!this.io) return;
    this.io.to(this.roomId).emit('coop-eternity-intermission', {
      combatArenaActive: true,
      coopCurrentRoomKind: this.currentCoopRoomKind,
      coopClearedRoomKind: this.clearedCoopRoomKind,
      thronePortalOffer: [...this.thronePortalOffer],
      coopMainArenaPortalPhase: this.coopMainArenaPortalPhase,
      coopBossThroneArena: false,
      coopThroneBossKind: null,
      coopTerrainTheme: this.getCoopTerrainTheme(),
      merchantInventory: this.getMerchantInventory(),
      players: this.getPlayers(),
      enemies: this.getEnemies(),
      ...this._getEternityPayloadFields(),
      ...extra,
      timestamp: Date.now(),
    });
  }

  _onEternityRoomCleared(roomIndex) {
    const goldAmount = this._awardEternityRoomGold(roomIndex);
    this._clearAllCombatEnemies();
    this.skeletonKillCount = 0;
    this.clearedCoopRoomKind = 'eternity_palace';
    this.sessionCampTypes = [];

    if (roomIndex < 3 || roomIndex === 4) {
      this.coopEternityPortalOpen = true;
      this._emitEternityIntermission({ eternityGoldReward: goldAmount, fountainPhase: false });
      console.log(`✨ Eternity palace room ${roomIndex} cleared (+${goldAmount} gold) — orange void portal open.`);
      return;
    }

    this.coopEternityPortalOpen = false;
    this.coopEternityFountainPhase = true;
    this.coopEternityFountainUsed = false;
    this.coopEternityLootClaimedPlayerIds = new Set();
    this.coopEternityLootOffer = [];

    if (roomIndex === 5) {
      // Late sequence finale: fountain + dual gateways only (no pet upgrade).
      this.coopEternityLootPhaseComplete = true;
      this._pickThronePortalOffer();
      this._emitEternityIntermission({ eternityGoldReward: goldAmount, fountainPhase: true });
      console.log(`✨ Eternity palace room 5 cleared (+${goldAmount} gold) — fountain + portal choice.`);
      return;
    }

    this.coopEternityLootPhaseComplete = false;
    this._beginEternityPetUpgradePhase();
    this._pickThronePortalOffer();
    this._emitEternityIntermission({ eternityGoldReward: goldAmount, fountainPhase: true });
    console.log(`✨ Eternity palace room 3 cleared (+${goldAmount} gold) — pet upgrades + fountain + portal choice.`);
  }

  /**
   * After Eternity III: each player with a Fae companion picks one pet upgrade.
   * Players without a Fae companion are auto-claimed so they don't block the fountain.
   */
  _beginEternityPetUpgradePhase() {
    this.coopEternityLootOffer = [];
    this.coopEternityLootClaimedPlayerIds = new Set();
    this.coopEternityLootPhaseComplete = false;

    if (!this.coopFaeBeastCompanionGranted || !normalizeFaeBeastCompanionKind(this.coopFaeBeastCompanionKind)) {
      for (const playerId of this.players.keys()) {
        this.coopEternityLootClaimedPlayerIds.add(playerId);
      }
      this.coopEternityLootPhaseComplete = this.coopEternityLootClaimedPlayerIds.size >= this.players.size;
      return;
    }

    // Auto-claim anyone who already picked (shouldn't happen mid-run) or has no seat.
    for (const [playerId, player] of this.players) {
      if (player?.coopPetCompanionUpgrade) {
        this.coopEternityLootClaimedPlayerIds.add(playerId);
      }
    }
    this.coopEternityLootPhaseComplete =
      this.players.size > 0
      && this.coopEternityLootClaimedPlayerIds.size >= this.players.size;
  }

  /**
   * Claim one pet companion upgrade after Eternity Palace III.
   * @param {string} playerId
   * @param {string} upgradeId
   * @returns {boolean}
   */
  chooseEternityPetUpgrade(playerId, upgradeId) {
    if (!this.coopEternityFountainPhase || this.coopEternityLootPhaseComplete) return false;
    const player = this.players.get(playerId);
    if (!player) return false;
    if (this.coopEternityLootClaimedPlayerIds.has(playerId)) return false;
    if (!this.coopFaeBeastCompanionGranted) return false;

    const kind = normalizeFaeBeastCompanionKind(this.coopFaeBeastCompanionKind);
    if (!kind || !isValidPetCompanionUpgradeId(upgradeId, kind)) {
      this._emitEternityPetUpgradeFailure(playerId, 'invalid_upgrade');
      return false;
    }

    player.coopPetCompanionUpgrade = upgradeId;
    this._applyPetCompanionUpgradeToPlayerBeast(playerId, upgradeId);

    this.coopEternityLootClaimedPlayerIds.add(playerId);
    if (this.coopEternityLootClaimedPlayerIds.size >= this.players.size) {
      this.coopEternityLootPhaseComplete = true;
    }

    if (this.io) {
      this.io.to(playerId).emit('coop-eternity-pet-upgrade-chosen', {
        upgradeId,
        coopFaeBeastCompanionKind: kind,
        coopEternityLootClaimedPlayerIds: [...this.coopEternityLootClaimedPlayerIds],
        coopEternityLootPhaseComplete: this.coopEternityLootPhaseComplete,
        timestamp: Date.now(),
      });
      this.io.to(this.roomId).emit('coop-pet-companion-upgrade-synced', {
        playerId,
        upgradeId,
        packExpansion: upgradeId === 'wolf_pack_expansion',
        timestamp: Date.now(),
      });
    }

    this._emitEternityIntermission({
      coopEternityLootClaimedPlayerIds: [...this.coopEternityLootClaimedPlayerIds],
      coopEternityLootPhaseComplete: this.coopEternityLootPhaseComplete,
    });
    console.log(`🐾 Eternity pet upgrade chosen by ${playerId}: ${upgradeId}`);
    return true;
  }

  /** @deprecated Replaced by chooseEternityPetUpgrade — kept for socket compat no-op. */
  chooseEternityPalaceLoot(playerId, stockId) {
    return false;
  }

  _rollEternityPalaceLootOffer() {
    this.coopEternityLootOffer = [];
  }

  _emitEternityPetUpgradeFailure(playerId, reason) {
    if (!this.io) return;
    this.io.to(playerId).emit('coop-eternity-pet-upgrade-failed', {
      reason,
      timestamp: Date.now(),
    });
  }

  _emitEternityLootFailure(playerId, reason) {
    this._emitEternityPetUpgradeFailure(playerId, reason);
  }

  /**
   * Tick Mending Spores (+1 HP/s while owner is within 6 of their Fae pet).
   * Called from companion AI / combat loop.
   */
  tickPetCompanionProximityBuffs(now = Date.now()) {
    if (this.gameMode !== 'coop' || !this.gameStarted) return;
    for (const [playerId, player] of this.players) {
      if (!player || player.health <= 0) continue;
      const upgradeId = player.coopPetCompanionUpgrade;
      if (!isMendingSporesUpgrade(upgradeId)) continue;
      if (!this._isPlayerNearOwnedFaeBeast(player, PET_UPGRADE_MENDING_SPORES_RANGE)) continue;

      const last = player._mendingSporesLastHealAt || 0;
      if (now - last < 1000) continue;
      player._mendingSporesLastHealAt = now;

      const maxHp = player.maxHealth ?? 0;
      if (maxHp <= 0 || player.health >= maxHp) continue;
      const prev = player.health;
      player.health = Math.min(maxHp, player.health + PET_UPGRADE_MENDING_SPORES_HPS);
      if (player.health === prev || !this.io) continue;
      this.io.to(this.roomId).emit('player-health-updated', {
        playerId,
        health: player.health,
        maxHealth: maxHp,
        healingType: 'mending_spores',
        timestamp: now,
      });
    }
  }

  /**
   * Tiger Evasion: 20% chance to negate incoming damage while within 6 of Fae tiger.
   * @returns {boolean}
   */
  _rollTigerEvasion(player) {
    if (!player || player.coopPetCompanionUpgrade !== 'tiger_evasion') return false;
    if (!this._isPlayerNearOwnedFaeBeast(player, PET_UPGRADE_EVASION_RANGE)) return false;
    return Math.random() < PET_UPGRADE_EVASION_CHANCE;
  }

  /**
   * After eternity palace sequence: resume the normal loop where Boss 2 (or Boss 3 for late) left off.
   * @param {string} chosenCampType
   * @returns {boolean}
   */
  enterMainLoopAfterEternity(chosenCampType) {
    if (!this.coopEternityFountainPhase || !this.coopEternityFountainUsed || !this.coopEternityLootPhaseComplete) return false;
    const offer = this.thronePortalOffer;
    if (!offer || offer.length !== 2) return false;

    let pick = chosenCampType != null ? String(chosenCampType).toLowerCase() : '';
    if (!pick || !offer.includes(pick)) pick = offer[0];
    if (!GameRoom.CAMP_TYPES[pick]) return false;

    const wasLateSequence = this.coopEternityLateSequence;

    this.coopEternityActive = false;
    this.coopEternityFountainPhase = false;
    this.coopEternityPortalOpen = false;
    this.coopEternityFountainUsed = false;
    this.coopEternityLootOffer = [];
    this.coopEternityLootClaimedPlayerIds = new Set();
    this.coopEternityLootPhaseComplete = false;
    this.coopEternityRoomIndex = 0;
    this.coopEternityLivingCount = 0;
    if (wasLateSequence) {
      this.coopEternityLateCompleted = true;
      this.coopEternityLateSequence = false;
    } else {
      this.coopEternityCompleted = true;
    }
    this.coopSegmentCombatRoomsCleared = 0;
    this._resetEdenSegmentState();
    this._clearPreBossSequenceState();

    this.pendingCoopArchetype = pick;
    this.pendingCoopRoomKind = pick;
    this.currentCoopRoomKind = pick;
    this.clearedCoopRoomKind = null;
    this._bumpColoredRoomVisit(pick);
    this._resetCoopRoomWhisperForEntry(pick);
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.merchantInventory = [];
    this._resetMushroomState();
    this.skeletonKillCount = 0;

    const coopCombatTransitionId = this._beginCoopCombatTransition({ spawnInitialWave: true });
    this.teleportAllPlayersToCombatSpawn();

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopColoredRoomVisitIndex: this._getCoopColoredRoomVisitIndexForEmit(),
        coopBossRoomVisitIndex: this._getCoopBossRoomVisitIndexForEmit(),
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        ...this._getEternityPayloadFields(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  _normalizeCoopRoomKind(value) {
    const kind = String(value || '').toLowerCase();
    if (kind === 'healing') return 'merchant';
    return COOP_ROOM_TYPES.includes(kind) ? kind : null;
  }

  _getCoopRoomsRequiredBeforeBoss() {
    return this.coopBossesDefeatedCount >= 2
      ? COOP_ROOMS_BEFORE_BOSS_LATE
      : COOP_ROOMS_BEFORE_BOSS;
  }

  /** Required kills to clear the current co-op combat room (6/7/8/9 by boss tier). */
  _getCoopWaveQuota() {
    const tier = Math.min(Math.max(0, this.coopBossesDefeatedCount || 0), 3);
    return COOP_WAVE_QUOTA_BY_TIER[tier];
  }

  _isCountableCoopCombatRoom(kind) {
    const k = this._normalizeCoopRoomKind(kind);
    return k != null && COOP_COUNTABLE_COMBAT_ROOM_TYPES.includes(k);
  }

  /** @param {string} roomKind @returns {number|null} 1-based visit index for colored halls */
  _bumpColoredRoomVisit(roomKind) {
    const kind = String(roomKind || '').toLowerCase();
    if (!COOP_COLORED_ROOM_TYPES.includes(kind)) return null;
    const next = (this.coopColoredRoomVisitCounts[kind] || 0) + 1;
    this.coopColoredRoomVisitCounts[kind] = next;
    return next;
  }

  /** @returns {number|null} visit index for the current colored room, if any */
  _getCoopColoredRoomVisitIndexForEmit() {
    const kind = this.currentCoopRoomKind != null ? String(this.currentCoopRoomKind).toLowerCase() : '';
    if (!COOP_COLORED_ROOM_TYPES.includes(kind)) return null;
    const count = this.coopColoredRoomVisitCounts[kind];
    return count > 0 ? count : null;
  }

  /** @returns {number} 1-based boss chamber visit index */
  _bumpBossRoomVisit() {
    this.coopBossRoomVisitCount = (this.coopBossRoomVisitCount || 0) + 1;
    return this.coopBossRoomVisitCount;
  }

  /** @returns {number|null} visit index when entering the boss chamber */
  _getCoopBossRoomVisitIndexForEmit() {
    if (this.currentCoopRoomKind !== 'boss') return null;
    const count = this.coopBossRoomVisitCount;
    return count > 0 ? count : null;
  }

  /** Reset once-per-room whisper when entering a colored combat room. */
  _resetCoopRoomWhisperForEntry(roomKind) {
    const kind = String(roomKind || '').toLowerCase();
    if (!COOP_COLORED_ROOM_TYPES.includes(kind)) return;
    this.coopRoomWhisperPlayed = false;
  }

  /** First player↔enemy engagement in a colored room — broadcast whisper SFX once. */
  _tryEmitCoopRoomWhisper() {
    if (this.gameMode !== 'coop' || this.coopRoomWhisperPlayed) return;
    if (this.isCoopCombatTransitionActive()) return;
    const roomColor = this.currentCoopRoomKind != null
      ? String(this.currentCoopRoomKind).toLowerCase()
      : '';
    if (!COOP_COLORED_ROOM_TYPES.includes(roomColor)) return;
    this.coopRoomWhisperPlayed = true;
    if (this.io) {
      this.io.to(this.roomId).emit('coop-room-whisper', {
        roomColor,
        timestamp: Date.now(),
      });
    }
  }

  getCoopCurrentRoomKind() {
    return this.currentCoopRoomKind;
  }

  getCoopClearedRoomKind() {
    return this.clearedCoopRoomKind;
  }

  /** @returns {string[]} copy of the two offered archetype keys (co-op throne), or [] */
  getThronePortalOffer() {
    return [...this.thronePortalOffer];
  }

  /** Thrine prep: portals stay on the south rim only. */
  getThronePortalLayout() {
    return 'rim';
  }

  getCoopMainArenaPortalPhase() {
    return this.coopMainArenaPortalPhase;
  }

  getCoopBossThroneArena() {
    return !!this.coopBossThroneArena;
  }

  getCoopCombatTransitionId() {
    return this.coopCombatTransition?.id ?? null;
  }

  getCoopThroneBossKind() {
    return this.coopThroneBossKind;
  }

  getCoopBossMaxHealth(bossType) {
    const table = this.coopBossesDefeatedCount >= 4
      ? COOP_BOSS_MAX_HEALTH_POST_TRINITY
      : COOP_BOSS_MAX_HEALTH_PRE_TRINITY;
    return table[bossType] ?? table.boss;
  }

  getCoopTerrainTheme() {
    if (this.coopBossesDefeatedCount <= 0) return COOP_TERRAIN_THEMES[0];
    if (this.coopBossesDefeatedCount === 1) return COOP_TERRAIN_THEMES[1];
    if (this.coopBossesDefeatedCount === 2) return COOP_TERRAIN_THEMES[2];
    // 4th encounter (Trinity) cycles back to purple for a distinct finale feel.
    return COOP_TERRAIN_THEMES[0];
  }

  _beginCoopCombatTransition({ startAIOnRelease = true, spawnInitialWave = false } = {}) {
    if (this.gameMode !== 'coop') {
      if (startAIOnRelease) this.startEnemyAI();
      return null;
    }

    this._clearCoopCombatTransitionTimer();
    const id = ++this.coopCombatTransitionId;
    const transition = {
      id,
      readyPlayerIds: new Set(),
      startAIOnRelease,
      spawnInitialWave,
      startedAt: Date.now(),
      timeoutId: null,
    };
    transition.timeoutId = setTimeout(() => {
      this._releaseCoopCombatTransition(id, 'timeout');
    }, COOP_COMBAT_TRANSITION_FALLBACK_MS);
    this.coopCombatTransition = transition;
    return id;
  }

  _clearCoopCombatTransitionTimer() {
    if (this.coopCombatTransition?.timeoutId) {
      clearTimeout(this.coopCombatTransition.timeoutId);
      this.coopCombatTransition.timeoutId = null;
    }
  }

  _releaseCoopCombatTransition(id, reason = 'ready') {
    const transition = this.coopCombatTransition;
    if (!transition || transition.id !== id) {
      return false;
    }

    this._clearCoopCombatTransitionTimer();
    this.coopCombatTransition = null;
    this._regenerateImmortalUnionPersephoneForAllPlayers();
    if (transition.spawnInitialWave) {
      this.spawnEnemyWave();
    } else if (transition.startAIOnRelease) {
      this.startEnemyAI();
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🌀 Co-op combat transition ${id} released (${reason})`, {
        spawnInitialWave: !!transition.spawnInitialWave,
        startAIOnRelease: !!transition.startAIOnRelease,
      });
      if (this.enemyAI?.scheduleAggroDebugSnapshot) {
        this.enemyAI.scheduleAggroDebugSnapshot(`transition-${id}`);
      }
    }
    return true;
  }

  markCoopCombatTransitionReady(playerId, transitionId) {
    const transition = this.coopCombatTransition;
    const id = Number(transitionId);
    if (!transition || !Number.isFinite(id) || transition.id !== id) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('⚠️ coop-combat-transition-ready rejected', {
          playerId,
          transitionId: id,
          activeTransitionId: transition?.id ?? null,
        });
      }
      return false;
    }
    if (!this.players.has(playerId)) {
      return false;
    }

    transition.readyPlayerIds.add(playerId);
    const activePlayerIds = Array.from(this.players.keys());
    if (activePlayerIds.length > 0 && activePlayerIds.every((id) => transition.readyPlayerIds.has(id))) {
      return this._releaseCoopCombatTransition(transition.id, 'players-ready');
    }
    return true;
  }

  isCoopCombatTransitionActive() {
    return this.gameMode === 'coop' && !!this.coopCombatTransition;
  }

  isCoopPostTeleportPositionGuardActive() {
    return this.gameMode === 'coop' && Date.now() < this.coopPostTeleportPositionGuardUntil;
  }

  getCoopRoomEntryToken() {
    return this.coopRoomEntryToken;
  }

  _clearAllCombatEnemies() {
    this._clearCoopDelayedEnemyWaveTimer();
    this.coopWaveSpawnPlan = null;
    this.coopRequiredQueue = [];
    this.coopWaveQuota = 0;
    this._coopSpawnChainTimer = null;
    this.roomHasMartyrs = false;
    this.roomHasTitans = false;
    this.roomTitanQuota = 0;
    this.roomTitanSlotIndices = new Set();
    this.roomValkyrieQuota = 0;
    this.roomNemesisQuota = 0;
    this.roomHasMiniBoss1 = false;
    this.miniBoss1SpawnedThisRoom = false;
    this.tripleBossIds = null;
    this.boss1EliteKnightIds = null;
    if (this.coopCombatTransition) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('⚠️ _clearAllCombatEnemies clearing active coopCombatTransition without release');
      }
      this._clearCoopCombatTransitionTimer();
      this.coopCombatTransition = null;
    }
    this.stopEnemyAI();
    const ids = Array.from(this.enemies.keys());
    for (const id of ids) {
      const enemy = this.enemies.get(id);
      // Beast companions persist across room clears while alive.
      if (
        this._isAlliedBeastCompanion(enemy)
        && !enemy.isDying
        && (enemy.health ?? 0) > 0
      ) {
        continue;
      }
      this._clearEnemyDoTTimers(id);
      this._pruneEnemyMaps(id);
      if (this.enemyAI) {
        this.enemyAI.removeEnemyAggro(id);
      }
      this.enemies.delete(id);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-removed', { enemyId: id, timestamp: Date.now() });
      }
    }
    if (this._hasLivingBeastCompanion()) {
      this.startCompanionAI();
    }
  }

  /** Remove adds still alive when their summoning boss dies (skeletons, warlocks, ghouls, wyverns). */
  _clearBossSummonedAdds(bossId) {
    if (!bossId) return;

    const idsToRemove = [];
    for (const [id, e] of this.enemies) {
      if (id === bossId) continue;
      if (
        e.bossId === bossId ||
        e.summonedByBoss2Id === bossId ||
        e.summonedByBoss3Id === bossId ||
        e.summonedByDestinyId === bossId ||
        e.summonerId === bossId
      ) {
        idsToRemove.push(id);
      }
    }

    for (const id of idsToRemove) {
      const add = this.enemies.get(id);
      this._clearEnemyDoTTimers(id);
      this._pruneEnemyMaps(id);
      if (this.enemyAI) {
        if (add?.type === 'boss-skeleton' && add.bossId) {
          this.enemyAI.removeBossSkeleton(add.bossId, id);
        }
        this.enemyAI.removeEnemyAggro(id);
      }
      this.enemies.delete(id);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-removed', { enemyId: id, timestamp: Date.now() });
      }
    }
  }

  /** Safety net: drop adds whose parent boss is no longer in the roster. */
  _clearOrphanedBossSummonedAdds() {
    const idsToRemove = [];
    for (const [id, e] of this.enemies) {
      const parentId =
        e.bossId ||
        e.summonedByBoss2Id ||
        e.summonedByBoss3Id ||
        e.summonedByDestinyId ||
        e.summonerId ||
        null;
      if (!parentId) continue;
      if (!this.enemies.has(parentId)) {
        idsToRemove.push(id);
      }
    }

    for (const id of idsToRemove) {
      const add = this.enemies.get(id);
      this._clearEnemyDoTTimers(id);
      this._pruneEnemyMaps(id);
      if (this.enemyAI) {
        if (add?.type === 'boss-skeleton' && add.bossId) {
          this.enemyAI.removeBossSkeleton(add.bossId, id);
        }
        this.enemyAI.removeEnemyAggro(id);
      }
      this.enemies.delete(id);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-removed', { enemyId: id, timestamp: Date.now() });
      }
    }
  }

  /**
   * After clearing a main-map combat room: dual portals until the segment quota is met, then pre-boss Trial/Stat.
   * Colored/stat/trial rooms count; merchant (pink) never does. Quota is 3, or 4 after Boss 2.
   * @param {'second_wave'|'pre_boss_gate'|'boss_gate'} phase
   */
  startMainArenaPortalIntermission(phase) {
    this._clearAllCombatEnemies();
    this.skeletonKillCount = 0;
    this.pendingCoopArchetype = null;
    this.pendingCoopRoomKind = null;
    const clearedColor =
      Array.isArray(this.sessionCampTypes) && this.sessionCampTypes.length > 0
        ? String(this.sessionCampTypes[0]).toLowerCase()
        : null;
    this.clearedCoopRoomKind = this.currentCoopRoomKind || clearedColor;
    this.sessionCampTypes = [];
    this.combatArenaActive = true;

    this.coopBossThroneArena = false;
    this.coopThroneBossKind = null;

    if (phase === 'second_wave') {
      this._pickPostFirstRoomPortalOffer();
      this.coopMainArenaPortalPhase = 'pick_wave2';
      this._maybeOfferVoidPortal();
    } else if (phase === 'pre_boss_gate') {
      this._pickPreBossPortalOffer();
      this.coopMainArenaPortalPhase = 'pick_pre_boss';
      this.coopPreBossSequenceActive = true;
      this._maybeOfferVoidPortal();
    } else {
      this.thronePortalOffer = ['boss'];
      this.coopMainArenaPortalPhase = 'pick_boss';
    }

    if (this.io) {
      this.io.to(this.roomId).emit('coop-main-arena-intermission', {
        combatArenaActive: true,
        thronePortalOffer: [...this.thronePortalOffer],
        coopMainArenaPortalPhase: this.coopMainArenaPortalPhase,
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopClearedRoomColor: clearedColor,
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: this.clearedCoopRoomKind,
        merchantInventory: this.getMerchantInventory(),
        merchantPurchaseStates: this._getMerchantPurchaseStatesByPlayer(),
        players: this.getPlayers(),
        enemies: this.getEnemies(),
        ...this._getDeepSanctumPayloadFields(),
        timestamp: Date.now(),
      });
    }
  }

  _onCoopWaveThresholdMet() {
    if (this.coopInPreBossSpecialRoom) {
      this._onPreBossSpecialRoomCleared();
      return;
    }

    this.coopSegmentCombatRoomsCleared += 1;
    const required = this._getCoopRoomsRequiredBeforeBoss();
    if (this.coopSegmentCombatRoomsCleared >= required) {
      console.log(`🌀 Segment complete (${required} combat rooms cleared) — pre-boss Trial/Stat choice.`);
      this.startMainArenaPortalIntermission('pre_boss_gate');
    } else {
      console.log(
        `🌀 Combat room ${this.coopSegmentCombatRoomsCleared}/${required} cleared — choose next room (center portals).`,
      );
      this.startMainArenaPortalIntermission('second_wave');
    }
  }

  /** Pre-boss Trial/Stat room cleared — reward pedestal only; merchant follows after claim + delay. */
  _onPreBossSpecialRoomCleared() {
    this.coopInPreBossSpecialRoom = false;
    this._clearAllCombatEnemies();
    this.skeletonKillCount = 0;
    this.pendingCoopArchetype = null;
    this.pendingCoopRoomKind = null;
    this.sessionCampTypes = [];
    this.combatArenaActive = true;
    this.coopBossThroneArena = false;
    this.coopThroneBossKind = null;
    this.clearedCoopRoomKind = this.currentCoopRoomKind;
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = 'pre_boss_reward';
    this._preBossRewardClaimScheduled = false;

    if (this.io) {
      this.io.to(this.roomId).emit('coop-main-arena-intermission', {
        combatArenaActive: true,
        thronePortalOffer: [],
        coopMainArenaPortalPhase: this.coopMainArenaPortalPhase,
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopClearedRoomColor: null,
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: this.clearedCoopRoomKind,
        merchantInventory: this.getMerchantInventory(),
        merchantPurchaseStates: this._getMerchantPurchaseStatesByPlayer(),
        players: this.getPlayers(),
        enemies: this.getEnemies(),
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Client claimed the pre-boss Trial/Stat pedestal reward — schedule in-place merchant after 5s.
   * @param {string} _playerId
   * @returns {boolean}
   */
  claimPreBossReward(_playerId) {
    if (!this.gameStarted || this.gameMode !== 'coop' || !this.combatArenaActive) return false;
    if (!this.coopPreBossSequenceActive) return false;
    if (this.coopMainArenaPortalPhase !== 'pre_boss_reward') return false;
    if (this._preBossRewardClaimScheduled) return true;

    this._preBossRewardClaimScheduled = true;
    this._scheduleTimeout(() => {
      if (!this.gameStarted || this.gameMode !== 'coop' || !this.combatArenaActive) return;
      if (!this.coopPreBossSequenceActive) return;
      if (this.coopMainArenaPortalPhase !== 'pre_boss_reward') return;
      this._beginInPlacePreBossMerchant();
    }, COOP_PRE_BOSS_REWARD_TO_MERCHANT_MS);
    return true;
  }

  /** Swap the hex arena to merchant in place — no teleport or combat-arena-entered. */
  _beginInPlacePreBossMerchant() {
    this._clearAllCombatEnemies();
    this.skeletonKillCount = 0;
    this.pendingCoopArchetype = null;
    this.pendingCoopRoomKind = null;
    this.sessionCampTypes = [];
    this.combatArenaActive = true;
    this.coopBossThroneArena = false;
    this.coopThroneBossKind = null;
    this.currentCoopRoomKind = 'merchant';
    this.clearedCoopRoomKind = 'merchant';
    this.thronePortalOffer = ['boss'];
    this.coopMainArenaPortalPhase = 'pre_boss_merchant';
    this.generateMerchantInventory();
    this._rollCoopSkyPresetForEntry('merchant');

    if (this.io) {
      this.io.to(this.roomId).emit('coop-main-arena-intermission', {
        combatArenaActive: true,
        thronePortalOffer: [...this.thronePortalOffer],
        coopMainArenaPortalPhase: this.coopMainArenaPortalPhase,
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopClearedRoomColor: null,
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: this.clearedCoopRoomKind,
        merchantInventory: this.getMerchantInventory(),
        merchantPurchaseStates: this._getMerchantPurchaseStatesByPlayer(),
        players: this.getPlayers(),
        enemies: this.getEnemies(),
        ...this._getCoopSkyPayloadFields(),
        timestamp: Date.now(),
      });
    }
    this._emitMerchantNpcGreet('arrival');
    this._maybeSpawnGreedInMerchantRoom();
  }

  /**
   * Client finished the pre-boss merchant transaction — reveal the boss portal in place.
   * @param {string} _playerId
   * @returns {boolean}
   */
  finishPreBossMerchant(_playerId) {
    if (!this.gameStarted || this.gameMode !== 'coop' || !this.combatArenaActive) return false;
    if (!this.coopPreBossSequenceActive) return false;
    if (this.coopMainArenaPortalPhase !== 'pre_boss_merchant') return false;

    this._clearPreBossSequenceState();
    this.startMainArenaPortalIntermission('boss_gate');
    return true;
  }

  /**
   * Record an enemy kill for the current co-op wave.
   * Martyr kills count toward the same `COOP_MIXED_WAVE_COUNT` quota as every other staged mob —
   * excluding them deadlock’d colored rooms (~8 slots vs 8 kills).
   * All combat rooms use the mixed-room staged release thresholds.
   */
  _registerCoopWaveKill(emojiLog) {
    if (this._skipNextCoopWaveKill) {
      this._skipNextCoopWaveKill = false;
      return;
    }
    if (this.gameMode !== 'coop' || !this.combatArenaActive || this.bossSpawned) return;
    if (this.coopDeepSanctumActive) {
      this._registerDeepSanctumKill(emojiLog);
      return;
    }
    if (this.coopEternityActive) {
      this._registerEternityKill(emojiLog);
      return;
    }
    if (this.coopSunkenActive) {
      this._registerSunkenKill(emojiLog);
      return;
    }
    if (this.coopFaeRealmActive) {
      this._registerFaeRealmKill(emojiLog);
      return;
    }
    if (this.coopIntroActive) {
      this._registerIntroKill(emojiLog);
      return;
    }
    if (!this._isCountableCoopCombatRoom(this.currentCoopRoomKind)) return;

    this.skeletonKillCount++;
    const killTarget = this.coopWaveQuota || this._getCoopWaveQuota();
    console.log(`${emojiLog} (${this.skeletonKillCount}/${killTarget})`);
    if (this.io) {
      this.io.to(this.roomId).emit('skeleton-kill-count-updated', {
        skeletonKillCount: this.skeletonKillCount,
        required: killTarget,
        timestamp: Date.now(),
      });
    }

    this._pumpCoopSpawns(COOP_WAVE_REINFORCE_STAGGER_MS);

    if (this.skeletonKillCount >= killTarget) {
      this._onCoopWaveThresholdMet();
    }
  }

  /**
   * Throne prep only: first time entering the main map (south-rim two portals in throne).
   * @param {string} [chosenCampType] — must be one of `thronePortalOffer`
   * @returns {boolean} true if activation ran, false if already active or invalid
   */
  activateCombatArena(chosenCampType) {
    if (!this.gameStarted || this.combatArenaActive || this.gameMode !== 'coop') {
      return false;
    }

    const offer = this.thronePortalOffer;
    if (!offer || offer.length !== 2) {
      return false;
    }

    for (const player of this.players.values()) {
      if (!this._playerThronePrepReady(player)) {
        return false;
      }
    }

    let pick = chosenCampType != null ? String(chosenCampType).toLowerCase() : '';
    if (!pick || !offer.includes(pick)) {
      pick = offer[0];
    }
    if (!GameRoom.CAMP_TYPES[pick]) {
      return false;
    }
    this.pendingCoopArchetype = pick;
    this.pendingCoopRoomKind = pick;
    this.currentCoopRoomKind = pick;
    this.clearedCoopRoomKind = null;
    this._bumpColoredRoomVisit(pick);
    this._resetCoopRoomWhisperForEntry(pick);
    this.removeThroneTrainingDummy();
    this.combatArenaActive = true;
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.coopThroneStep = 'rim';
    this.merchantInventory = [];
    this._resetMushroomState();
    const coopCombatTransitionId = this._beginCoopCombatTransition({ spawnInitialWave: true });
    this.teleportAllPlayersToCombatSpawn();

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopColoredRoomVisitIndex: this._getCoopColoredRoomVisitIndexForEmit(),
        coopBossRoomVisitIndex: this._getCoopBossRoomVisitIndexForEmit(),
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  /**
   * Development-only shortcut: jump from throne prep directly into the boss arena.
   * Mirrors the normal `pick_boss` transition without requiring the wave intermission state.
   */
  activateDevBossArena() {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    if (!this.gameStarted || this.combatArenaActive || this.gameMode !== 'coop') {
      return false;
    }

    this.removeThroneTrainingDummy();
    this.combatArenaActive = true;
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.coopBossThroneArena = true;
    this.coopThroneBossKind = 'boss';
    this.currentCoopRoomKind = 'boss';
    this.clearedCoopRoomKind = null;
    this._bumpBossRoomVisit();
    this.pendingCoopArchetype = null;
    this.pendingCoopRoomKind = null;
    this._postBossIntermissionScheduled = false;
    this.merchantInventory = [];
    this._resetMushroomState();
    const coopCombatTransitionId = this._beginCoopCombatTransition();
    this.teleportAllPlayersToCombatSpawn();
    const defeated = this.coopBossesDefeatedCount;
    if (defeated === 0 && Math.random() < COOP_BOSS1_ELITE_KNIGHTS_CHANCE) {
      this.spawnBoss1EliteKnights();
    } else {
      this.spawnBoss();
    }
    this.bossSpawned = true;

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: true,
        coopThroneBossKind: this.coopThroneBossKind,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopColoredRoomVisitIndex: this._getCoopColoredRoomVisitIndexForEmit(),
        coopBossRoomVisitIndex: this._getCoopBossRoomVisitIndexForEmit(),
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  /**
   * Development-only: jump into boss arena with the alternate Boss1 elite-knight encounter.
   */
  activateDevBoss1EliteArena() {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    if (!this.gameStarted || this.combatArenaActive || this.gameMode !== 'coop') {
      return false;
    }

    this.removeThroneTrainingDummy();
    this.combatArenaActive = true;
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.coopBossThroneArena = true;
    this.coopThroneBossKind = 'boss';
    this.currentCoopRoomKind = 'boss';
    this.clearedCoopRoomKind = null;
    this._bumpBossRoomVisit();
    this.pendingCoopArchetype = null;
    this.pendingCoopRoomKind = null;
    this._postBossIntermissionScheduled = false;
    this.merchantInventory = [];
    this._resetMushroomState();
    const coopCombatTransitionId = this._beginCoopCombatTransition();
    this.teleportAllPlayersToCombatSpawn();
    this.spawnBoss1EliteKnights();
    this.bossSpawned = true;

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: true,
        coopThroneBossKind: this.coopThroneBossKind,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopColoredRoomVisitIndex: this._getCoopColoredRoomVisitIndexForEmit(),
        coopBossRoomVisitIndex: this._getCoopBossRoomVisitIndexForEmit(),
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  /**
   * Development-only: jump into boss arena with the 2nd boss (Archon / `boss2`) instead of the GLB boss.
   */
  activateDevBoss2Arena() {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    if (!this.gameStarted || this.combatArenaActive || this.gameMode !== 'coop') {
      return false;
    }

    this._devSpawnBoss2 = true;
    this.removeThroneTrainingDummy();
    this.combatArenaActive = true;
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.coopBossThroneArena = true;
    this.coopThroneBossKind = 'boss2';
    this.currentCoopRoomKind = 'boss';
    this.clearedCoopRoomKind = null;
    this._bumpBossRoomVisit();
    this.pendingCoopArchetype = null;
    this.pendingCoopRoomKind = null;
    this._postBossIntermissionScheduled = false;
    this.merchantInventory = [];
    this._resetMushroomState();
    const coopCombatTransitionId = this._beginCoopCombatTransition();
    this.teleportAllPlayersToCombatSpawn();
    this.spawnBoss();
    this.bossSpawned = true;

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: true,
        coopThroneBossKind: this.coopThroneBossKind,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopColoredRoomVisitIndex: this._getCoopColoredRoomVisitIndexForEmit(),
        coopBossRoomVisitIndex: this._getCoopBossRoomVisitIndexForEmit(),
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  /**
   * Development-only: jump into boss arena with Destiny (dragon / 3rd boss slot).
   */
  activateDevBoss3Arena() {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    if (!this.gameStarted || this.combatArenaActive || this.gameMode !== 'coop') {
      return false;
    }

    this._devSpawnDestiny = true;
    this.removeThroneTrainingDummy();
    this.combatArenaActive = true;
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.coopBossThroneArena = true;
    this.coopThroneBossKind = 'destiny';
    this.currentCoopRoomKind = 'boss';
    this.clearedCoopRoomKind = null;
    this._bumpBossRoomVisit();
    this.pendingCoopArchetype = null;
    this.pendingCoopRoomKind = null;
    this._postBossIntermissionScheduled = false;
    this.merchantInventory = [];
    this._resetMushroomState();
    const coopCombatTransitionId = this._beginCoopCombatTransition();
    this.teleportAllPlayersToCombatSpawn();
    this.spawnBoss();
    this.bossSpawned = true;

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: true,
        coopThroneBossKind: this.coopThroneBossKind,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopColoredRoomVisitIndex: this._getCoopColoredRoomVisitIndexForEmit(),
        coopBossRoomVisitIndex: this._getCoopBossRoomVisitIndexForEmit(),
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  /** Shared guard for local-dev room teleports (throne prep only). */
  _canUseDevRoomShortcut() {
    if (process.env.NODE_ENV === 'production') return false;
    if (!this.gameStarted || this.combatArenaActive || this.gameMode !== 'coop') return false;
    return true;
  }

  /** Clear sequence flags so a throne-prep hop into a mid-run room stays consistent. */
  _resetCoopFlowForDevShortcut() {
    this.coopIntroPending = false;
    this.coopIntroActive = false;
    this.coopIntroRoomIndex = 0;
    this.coopIntroPortalOpen = false;
    this.coopIntroFountainPhase = false;
    this.coopIntroFountainUsed = false;
    this.coopIntroLivingCount = 0;

    this.coopFaeRealmPending = false;
    this.coopFaeRealmActive = false;
    this.coopFaeRealmRoomIndex = 0;
    this.coopFaeRealmPortalOpen = false;
    this.coopFaeRealmLivingCount = 0;
    this.coopFaeRealmBossKind = null;

    this.coopSunkenActive = false;
    this.coopSunkenRoomIndex = 0;
    this.coopSunkenPortalOpen = false;
    this.coopSunkenFountainPhase = false;
    this.coopSunkenFountainUsed = false;
    this.coopSunkenAllyChoiceMade = false;
    this.coopSunkenLootOffer = [];
    this.coopSunkenLootClaimedPlayerIds = new Set();
    this.coopSunkenLootPhaseComplete = false;
    this.coopSunkenCompleted = false;
    this.coopSunkenLivingCount = 0;

    this.coopEternityActive = false;
    this.coopEternityRoomIndex = 0;
    this.coopEternityPortalOpen = false;
    this.coopEternityFountainPhase = false;
    this.coopEternityFountainUsed = false;
    this.coopEternityLootOffer = [];
    this.coopEternityLootClaimedPlayerIds = new Set();
    this.coopEternityLootPhaseComplete = false;
    this.coopEternityCompleted = false;
    this.coopEternityLateSequence = false;
    this.coopEternityLateCompleted = false;
    this.coopEternityLivingCount = 0;

    this.coopVoidPortalOffered = false;
    this.coopDeepSanctumActive = false;
    this.coopDeepSanctumRewardKind = null;
    this.coopDeepSanctumLivingCount = 0;
    this.coopSavedPortalPhase = null;

    this.coopEdenUsedThisSegment = false;
    this.coopEdenFountainUsed = false;
    this.coopEdenResumeKind = null;
    this.coopEdenResumeAsPreBoss = false;
    this.coopEdenResumePortalPhase = null;
    this._resetFalseEdenState();
    this._resetDeliriumState();
    this._resetErebusGateState();

    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.coopBossThroneArena = false;
    this.coopThroneBossKind = null;
    this.pendingCoopArchetype = null;
    this.pendingCoopRoomKind = null;
    this.clearedCoopRoomKind = null;
    this.merchantInventory = [];
    this._resetMushroomState();
  }

  /**
   * Development-only: jump from throne prep into Inner Sanctum room 1–4.
   * @param {1|2|3|4} roomIndex
   * @returns {boolean}
   */
  activateDevIntroRoom(roomIndex) {
    if (!this._canUseDevRoomShortcut()) return false;
    const n = Number(roomIndex);
    if (!Number.isFinite(n) || n < 1 || n > 4) return false;

    this.removeThroneTrainingDummy();
    this._clearAllCombatEnemies();
    this._resetCoopFlowForDevShortcut();

    this.coopIntroActive = true;
    this.coopIntroRoomIndex = n;
    this.coopIntroPortalOpen = false;
    this.coopIntroFountainPhase = false;
    this.coopIntroFountainUsed = false;
    this.currentCoopRoomKind = 'intro';
    this.combatArenaActive = true;
    this.skeletonKillCount = 0;
    this.bossSpawned = false;

    const coopCombatTransitionId = this._beginCoopCombatTransition({ spawnInitialWave: true });
    this.teleportAllPlayersToIntroSpawn();

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopColoredRoomVisitIndex: null,
        coopBossRoomVisitIndex: null,
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        ...this._getIntroPayloadFields(),
        ...this._getFaeRealmPayloadFields(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  /**
   * Development-only: jump from throne prep into Sunken Temple room 1–4.
   * @param {1|2|3|4} roomIndex
   * @returns {boolean}
   */
  activateDevSunkenRoom(roomIndex) {
    if (!this._canUseDevRoomShortcut()) return false;
    const n = Number(roomIndex);
    if (!Number.isFinite(n) || n < 1 || n > 4) return false;

    this.removeThroneTrainingDummy();
    this._clearAllCombatEnemies();
    this._resetCoopFlowForDevShortcut();

    this.coopSunkenActive = true;
    this.coopSunkenRoomIndex = n;
    this.coopSunkenPortalOpen = false;
    this.coopSunkenFountainPhase = false;
    this.coopSunkenFountainUsed = false;
    this.currentCoopRoomKind = 'sunken_temple';
    this.combatArenaActive = true;
    this.skeletonKillCount = 0;
    this.bossSpawned = false;

    const coopCombatTransitionId = this._beginCoopCombatTransition({ spawnInitialWave: true });
    this.teleportAllPlayersToSunkenSpawn();

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopColoredRoomVisitIndex: null,
        coopBossRoomVisitIndex: null,
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        ...this._getSunkenPayloadFields(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  /**
   * Development-only: jump from throne prep into Eternity's Palace room 1–5.
   * @param {1|2|3|4|5} roomIndex
   * @returns {boolean}
   */
  activateDevEternityRoom(roomIndex) {
    if (!this._canUseDevRoomShortcut()) return false;
    const n = Number(roomIndex);
    if (!Number.isFinite(n) || n < 1 || n > 5) return false;

    this.removeThroneTrainingDummy();
    this._clearAllCombatEnemies();
    this._resetCoopFlowForDevShortcut();

    this.coopEternityActive = true;
    this.coopEternityRoomIndex = n;
    this.coopEternityPortalOpen = false;
    this.coopEternityFountainPhase = false;
    this.coopEternityFountainUsed = false;
    this.coopEternityLateSequence = n >= 4;
    this.currentCoopRoomKind = 'eternity_palace';
    this.combatArenaActive = true;
    this.skeletonKillCount = 0;
    this.bossSpawned = false;

    const coopCombatTransitionId = this._beginCoopCombatTransition({ spawnInitialWave: true });
    this.teleportAllPlayersToEternitySpawn();

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopColoredRoomVisitIndex: null,
        coopBossRoomVisitIndex: null,
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        ...this._getEternityPayloadFields(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  /**
   * Development-only: jump from throne prep into Erebus Gate surprise room.
   * @returns {boolean}
   */
  activateDevErebusGate() {
    if (!this._canUseDevRoomShortcut()) return false;

    this.removeThroneTrainingDummy();
    this._clearAllCombatEnemies();
    this._resetCoopFlowForDevShortcut();

    this.coopEdenUsedThisSegment = true;
    this.coopEdenResumeKind = 'red';
    this.currentCoopRoomKind = 'erebus_gate';
    this.combatArenaActive = true;
    this.skeletonKillCount = 0;
    this.bossSpawned = false;
    this.sessionCampTypes = [];

    const coopCombatTransitionId = this._beginCoopCombatTransition({
      startAIOnRelease: true,
      spawnInitialWave: false,
    });
    this.teleportAllPlayersToCombatSpawn();
    this._beginErebusGate();

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        campTypes: this.sessionCampTypes,
        merchantInventory: this.getMerchantInventory(),
        dreamLayerInventory: this.getDreamLayerInventory(),
        coopMainArenaPortalPhase: this.coopMainArenaPortalPhase,
        thronePortalOffer: [...this.thronePortalOffer],
        coopColoredRoomVisitIndex: this._getCoopColoredRoomVisitIndexForEmit(),
        coopBossRoomVisitIndex: this._getCoopBossRoomVisitIndexForEmit(),
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        ...this._getDeepSanctumPayloadFields(),
        ...this._getEdenPayloadFields(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  /**
   * Development-only: jump from throne prep into Delirium Gate surprise room.
   * @returns {boolean}
   */
  activateDevDeliriumGate() {
    if (!this._canUseDevRoomShortcut()) return false;

    this.removeThroneTrainingDummy();
    this._clearAllCombatEnemies();
    this._resetCoopFlowForDevShortcut();

    this.coopEdenUsedThisSegment = true;
    this.coopEdenResumeKind = 'red';
    this.currentCoopRoomKind = 'delirium_gate';
    this.combatArenaActive = true;
    this.skeletonKillCount = 0;
    this.bossSpawned = false;
    this.sessionCampTypes = ['red'];

    const coopCombatTransitionId = this._beginCoopCombatTransition({
      startAIOnRelease: true,
      spawnInitialWave: false,
    });
    this.teleportAllPlayersToCombatSpawn();
    this._beginDeliriumGate();

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        campTypes: this.sessionCampTypes,
        merchantInventory: this.getMerchantInventory(),
        dreamLayerInventory: this.getDreamLayerInventory(),
        coopMainArenaPortalPhase: this.coopMainArenaPortalPhase,
        thronePortalOffer: [...this.thronePortalOffer],
        coopColoredRoomVisitIndex: this._getCoopColoredRoomVisitIndexForEmit(),
        coopBossRoomVisitIndex: this._getCoopBossRoomVisitIndexForEmit(),
        coopCombatTransitionId,
        coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
        mushroomState: this.getMushroomState(),
        ...this._getDeepSanctumPayloadFields(),
        ...this._getEdenPayloadFields(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  /**
   * Main combat map: after wave 1–2 (dual) or pre-boss wave 3 (boss), resolve the chosen center portal.
   * @param {string} [chosenCampType] — camp or `boss`
   * @returns {boolean}
   */
  resolveMainArenaPortal(chosenCampType) {
    if (!this.gameStarted || this.gameMode !== 'coop' || !this.combatArenaActive) {
      return false;
    }
    const phase = this.coopMainArenaPortalPhase;
    if (!phase) {
      return false;
    }

    if (phase === 'eden_exit') {
      return this._resolveEdenExitPortal(chosenCampType);
    }

    if (phase === 'pick_pre_boss' || phase === 'pick_wave2') {
      const offer = this.thronePortalOffer;
      if (!offer || offer.length !== 2) {
        return false;
      }
      let pick = chosenCampType != null ? String(chosenCampType).toLowerCase() : '';
      if (pick === 'void') {
        if (!this.coopVoidPortalOffered) return false;
        if (this._tryDivertToEden('deep_sanctum', {
          asPreBoss: phase === 'pick_pre_boss',
          savedPortalPhase: phase,
        })) {
          return true;
        }
        return this.beginDeepSanctumRoom();
      }
      if (!pick || !offer.includes(pick)) {
        pick = offer[0];
      }
      const roomKind = this._normalizeCoopRoomKind(pick);
      if (!roomKind || roomKind === 'boss') {
        return false;
      }
      if (phase === 'pick_pre_boss' && !COOP_PRE_BOSS_SPECIAL_TYPES.includes(roomKind)) {
        return false;
      }
      if (this._tryDivertToEden(roomKind, {
        asPreBoss: phase === 'pick_pre_boss',
        savedPortalPhase: null,
      })) {
        return true;
      }
      this.pendingCoopArchetype = GameRoom.CAMP_TYPES[roomKind] ? roomKind : null;
      this.pendingCoopRoomKind = roomKind;
      this.currentCoopRoomKind = roomKind;
      this.clearedCoopRoomKind = null;
      this._bumpColoredRoomVisit(roomKind);
      this._resetCoopRoomWhisperForEntry(roomKind);
      this.thronePortalOffer = [];
      this.coopMainArenaPortalPhase = null;
      this.skeletonKillCount = 0;
      this._resetMushroomState();
      if (phase === 'pick_pre_boss') {
        this.coopInPreBossSpecialRoom = true;
      }
      const coopCombatTransitionId = roomKind === 'merchant'
        ? null
        : this._beginCoopCombatTransition({ spawnInitialWave: true });
      this.teleportAllPlayersToCombatSpawn();
      if (roomKind === 'merchant') {
        this.sessionCampTypes = [];
        this.generateMerchantInventory();
      } else {
        this.merchantInventory = [];
      }

      if (this.io) {
        this.io.to(this.roomId).emit('combat-arena-entered', {
          players: this.getPlayers(),
          coopBossThroneArena: false,
          coopThroneBossKind: null,
          coopTerrainTheme: this.getCoopTerrainTheme(),
          coopCurrentRoomKind: this.currentCoopRoomKind,
          coopClearedRoomKind: null,
          merchantInventory: this.getMerchantInventory(),
          ...(roomKind === 'merchant'
            ? { merchantPurchaseStates: this._getMerchantPurchaseStatesByPlayer() }
            : {}),
          coopColoredRoomVisitIndex: this._getCoopColoredRoomVisitIndexForEmit(),
          coopBossRoomVisitIndex: this._getCoopBossRoomVisitIndexForEmit(),
          coopCombatTransitionId,
          coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
          mushroomState: this.getMushroomState(),
          timestamp: Date.now(),
        });
      }
      if (roomKind === 'merchant') {
        this.startMainArenaPortalIntermission('second_wave');
        this._emitMerchantNpcGreet('arrival');
        this._maybeSpawnGreedInMerchantRoom();
      }
      return true;
    }

    if (phase === 'pick_boss' || phase === 'pre_boss_merchant') {
      const offer = this.thronePortalOffer;
      if (!offer || offer.length !== 1 || String(offer[0]).toLowerCase() !== 'boss') {
        return false;
      }
      if (String(chosenCampType != null ? chosenCampType : 'boss').toLowerCase() !== 'boss') {
        return false;
      }
      if (phase === 'pre_boss_merchant') {
        this._clearPreBossSequenceState();
      }
      this.thronePortalOffer = [];
      this.coopMainArenaPortalPhase = null;
      this.coopBossThroneArena = true;
      const defeated = this.coopBossesDefeatedCount;
      if (defeated === 0) {
        this.coopThroneBossKind = 'boss';
      } else if (defeated === 1) {
        this.coopThroneBossKind = 'boss2';
      } else if (defeated === 2) {
        this.coopThroneBossKind = 'destiny';
      } else {
        // 4th encounter onward — the Trinity: all three bosses simultaneously.
        this.coopThroneBossKind = 'boss_all';
      }
      this.currentCoopRoomKind = 'boss';
      this.clearedCoopRoomKind = null;
      this._bumpBossRoomVisit();
      this._postBossIntermissionScheduled = false;
      this.merchantInventory = [];
      this._resetMushroomState();
      const coopCombatTransitionId = this._beginCoopCombatTransition();
      this.teleportAllPlayersToCombatSpawn();
      if (defeated === 0 && Math.random() < COOP_BOSS1_ELITE_KNIGHTS_CHANCE) {
        this.spawnBoss1EliteKnights();
      } else if (defeated === 1) {
        this.spawnBoss2Encounter();
      } else {
        this.spawnBoss();
      }
      this.bossSpawned = true;

      if (this.io) {
        this.io.to(this.roomId).emit('combat-arena-entered', {
          players: this.getPlayers(),
          coopBossThroneArena: true,
          coopThroneBossKind: this.coopThroneBossKind,
          coopTerrainTheme: this.getCoopTerrainTheme(),
          coopCurrentRoomKind: this.currentCoopRoomKind,
          coopClearedRoomKind: null,
          merchantInventory: this.getMerchantInventory(),
          coopColoredRoomVisitIndex: this._getCoopColoredRoomVisitIndexForEmit(),
          coopBossRoomVisitIndex: this._getCoopBossRoomVisitIndexForEmit(),
          coopCombatTransitionId,
          coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
          mushroomState: this.getMushroomState(),
          timestamp: Date.now(),
        });
      }
      return true;
    }

    if (phase === 'pick_sunken_entry') {
      const pick = chosenCampType != null ? String(chosenCampType).toLowerCase() : '';
      if (pick !== 'void') return false;
      return this.beginSunkenRoom(1);
    }

    if (phase === 'pick_eternity_entry') {
      const pick = chosenCampType != null ? String(chosenCampType).toLowerCase() : '';
      if (pick !== 'void') return false;
      return this.beginEternityRoom(1);
    }

    if (phase === 'pick_eternity_late_entry') {
      const pick = chosenCampType != null ? String(chosenCampType).toLowerCase() : '';
      if (pick !== 'void') return false;
      return this.beginEternityRoom(4);
    }

    if (phase === 'pick_trinity_finale') {
      const pick = chosenCampType != null ? String(chosenCampType).toLowerCase() : '';
      if (pick !== 'void') return false;
      return this.beginEdenFinaleRoom();
    }

    if (phase === 'pick_post_boss') {
      const offer = this.thronePortalOffer;
      if (!offer || offer.length !== 2) {
        return false;
      }
      let pick = chosenCampType != null ? String(chosenCampType).toLowerCase() : '';
      if (pick === 'void') {
        if (!this.coopVoidPortalOffered) return false;
        if (this._tryDivertToEden('deep_sanctum', { savedPortalPhase: phase })) {
          return true;
        }
        return this.beginDeepSanctumRoom();
      }
      if (!pick || !offer.includes(pick)) {
        pick = offer[0];
      }
      if (!GameRoom.CAMP_TYPES[pick]) {
        return false;
      }
      if (this._tryDivertToEden(pick, { savedPortalPhase: null })) {
        return true;
      }
      this.pendingCoopArchetype = pick;
      this.pendingCoopRoomKind = pick;
      this.currentCoopRoomKind = pick;
      this.clearedCoopRoomKind = null;
      this._bumpColoredRoomVisit(pick);
      this._resetCoopRoomWhisperForEntry(pick);
      this.thronePortalOffer = [];
      this.coopMainArenaPortalPhase = null;
      this.skeletonKillCount = 0;
      this.coopBossThroneArena = false;
      this.coopThroneBossKind = null;
      this.bossSpawned = false;
      this.merchantInventory = [];
      this._resetMushroomState();
      const coopCombatTransitionId = this._beginCoopCombatTransition({ spawnInitialWave: true });
      this.teleportAllPlayersToCombatSpawn();

      if (this.io) {
        this.io.to(this.roomId).emit('combat-arena-entered', {
          players: this.getPlayers(),
          coopBossThroneArena: false,
          coopThroneBossKind: null,
          coopTerrainTheme: this.getCoopTerrainTheme(),
          coopCurrentRoomKind: this.currentCoopRoomKind,
          coopClearedRoomKind: null,
          merchantInventory: this.getMerchantInventory(),
          coopColoredRoomVisitIndex: this._getCoopColoredRoomVisitIndexForEmit(),
          coopBossRoomVisitIndex: this._getCoopBossRoomVisitIndexForEmit(),
          coopCombatTransitionId,
          coopRoomEntryToken: this.coopRoomEntryToken,
        ...this._getCoopSkyPayloadFields(),
          mushroomState: this.getMushroomState(),
          timestamp: Date.now(),
        });
      }
      return true;
    }

    return false;
  }

  /**
   * After Trinity clear: no pedestal / dual portals — yellow void appears after 5s for the finale room.
   */
  _scheduleTrinityFinaleIntermission() {
    if (this.gameMode !== 'coop' || !this.combatArenaActive) return;
    if (!this.coopBossThroneArena) return;
    if (this._postBossIntermissionScheduled) return;
    this._postBossIntermissionScheduled = true;

    this._scheduleTimeout(() => {
      if (!this.gameStarted || this.gameMode !== 'coop' || !this.combatArenaActive) return;
      if (!this.coopBossThroneArena) return;

      this._clearOrphanedBossSummonedAdds();

      this.bossSpawned = false;
      this.skeletonKillCount = 0;
      this.coopSegmentCombatRoomsCleared = 0;
      this._resetEdenSegmentState();
      this._clearPreBossSequenceState();
      this.pendingCoopArchetype = null;
      this.pendingCoopRoomKind = null;
      this.clearedCoopRoomKind = null;
      this.coopThroneBossKind = null;
      this.merchantInventory = [];
      this.sessionCampTypes = [];
      this.thronePortalOffer = [];
      this.coopMainArenaPortalPhase = 'pick_trinity_finale';
      this.coopVoidPortalOffered = false;

      if (this.io) {
        this.io.to(this.roomId).emit('coop-main-arena-intermission', {
          combatArenaActive: true,
          thronePortalOffer: [],
          coopMainArenaPortalPhase: this.coopMainArenaPortalPhase,
          coopBossThroneArena: true,
          coopThroneBossKind: null,
          coopTerrainTheme: this.getCoopTerrainTheme(),
          coopClearedRoomColor: null,
          coopCurrentRoomKind: this.currentCoopRoomKind,
          coopClearedRoomKind: null,
          merchantInventory: this.getMerchantInventory(),
          players: this.getPlayers(),
          enemies: this.getEnemies(),
          ...this._getDeepSanctumPayloadFields(),
          timestamp: Date.now(),
        });
      }
    }, 5000);
  }

  /**
   * After boss death: two random camp portals on the boss throne shell (delayed so removal/VFX can finish).
   */
  _schedulePostBossPortalIntermission() {
    if (this.gameMode !== 'coop' || !this.combatArenaActive) return;
    if (!this.coopBossThroneArena) return;
    if (this._postBossIntermissionScheduled) return;
    this._postBossIntermissionScheduled = true;

    this._scheduleTimeout(() => {
      if (!this.gameStarted || this.gameMode !== 'coop' || !this.combatArenaActive) return;
      if (!this.coopBossThroneArena) return;

      this._clearOrphanedBossSummonedAdds();

      this.bossSpawned = false;
      this.skeletonKillCount = 0;
      this.coopSegmentCombatRoomsCleared = 0;
      this._resetEdenSegmentState();
      this._clearPreBossSequenceState();
      this.pendingCoopArchetype = null;
      this.pendingCoopRoomKind = null;
      this.clearedCoopRoomKind = 'boss';
      this.coopThroneBossKind = null;
      this.merchantInventory = [];
      const clearedColor = this.lastCoopWaveCampColor
        ? String(this.lastCoopWaveCampColor).toLowerCase()
        : null;
      this.sessionCampTypes = [];

      if (this.coopBossesDefeatedCount === 1 && !this.coopSunkenCompleted) {
        this.thronePortalOffer = [];
        this.coopMainArenaPortalPhase = 'pick_sunken_entry';
        this.coopVoidPortalOffered = false;
      } else if (this.coopBossesDefeatedCount === 2 && !this.coopEternityCompleted) {
        this.thronePortalOffer = [];
        this.coopMainArenaPortalPhase = 'pick_eternity_entry';
        this.coopVoidPortalOffered = false;
      } else if (this.coopBossesDefeatedCount === 3 && !this.coopEternityLateCompleted) {
        this.thronePortalOffer = [];
        this.coopMainArenaPortalPhase = 'pick_eternity_late_entry';
        this.coopVoidPortalOffered = false;
      } else {
        this._pickThronePortalOffer();
        this.coopMainArenaPortalPhase = 'pick_post_boss';
        this._maybeOfferVoidPortal();
      }

      if (this.io) {
        this.io.to(this.roomId).emit('coop-main-arena-intermission', {
          combatArenaActive: true,
          thronePortalOffer: [...this.thronePortalOffer],
          coopMainArenaPortalPhase: this.coopMainArenaPortalPhase,
          coopBossThroneArena: true,
          coopThroneBossKind: null,
          coopTerrainTheme: this.getCoopTerrainTheme(),
          coopClearedRoomColor: clearedColor,
          coopCurrentRoomKind: this.currentCoopRoomKind,
          coopClearedRoomKind: this.clearedCoopRoomKind,
          merchantInventory: this.getMerchantInventory(),
          players: this.getPlayers(),
          enemies: this.getEnemies(),
          ...this._getDeepSanctumPayloadFields(),
          timestamp: Date.now(),
        });
      }
    }, 1550);
  }

  /**
   * Late join after first portal: assign a random throne weapon so the joiner can fight immediately.
   * Sets `player.lateJoinCombatLoadout` for the joining client's `room-joined` payload.
   */
  _grantLateJoinCombatLoadout(player) {
    const weapon = COOP_THRONE_WEAPONS[Math.floor(Math.random() * COOP_THRONE_WEAPONS.length)];
    player.weapon = weapon;
    player.subclass = COOP_DEFAULT_SUBCLASS[weapon] ?? 'ELEMENTAL';
    player.weaponAspect = defaultWeaponAspectForWeapon(weapon);
    player.archetype = 'ROGUE';
    player.lateJoinCombatLoadout = true;
  }

  // Player management
  addPlayer(playerId, playerName, weapon = 'scythe', subclass, gameMode = 'coop') {
    // In co-op mode, health scales with kill count
    const baseHealth = 500;
    const maxHealth = baseHealth + this.killCount;

    // Create player object with default position
    this.players.set(playerId, {
      id: playerId,
      name: playerName,
      position: { x: 0, y: 1, z: 0 }, // Default spawn position
      rotation: { x: 0, y: 0, z: 0 },
      weapon: weapon,
      subclass: subclass,
      weaponAspect: defaultWeaponAspectForWeapon(weapon),
      archetype: 'ROGUE',
      health: maxHealth, // Start with full health
      maxHealth: maxHealth,
      level: 1, // Start at level 1
      essence: 0,
      gold: 0,
      flow: 0,
      fate: 3,
      movementDirection: { x: 0, y: 0, z: 0 },
      joinedAt: Date.now(),
      isStealthing: false, // Sabres stealth ability state
      isInvisible: false, // Whether player is currently invisible
      reaperCrossentropyStack: 0, // Reaper talent: +base damage from Crossentropy kills (session)
      backstabKillstreakStack: 0, // Killstreak talent: +base Backstab damage from Backstab kills (session)
      /** Co-op: universal green zombie room boons synced from client (`coop-zombie-room-boons`). */
      coopZombieBoons: {
        packHunter: false,
        berserkerStrain: false,
        juggernautStrain: false,
        exploderStrain: false,
        legion: false,
        critChance: 0,
        critDamageMult: 2,
      },
      /** Co-op: blue stagger room boons synced from client (`coop-stagger-room-boons`). */
      coopStaggerRoomBoons: {
        guardbreak: false,
        overshock: false,
        unstableEnergy: false,
        magmaCurrent: false,
        frostQueen: false,
        forceOfNature: false,
        tyrantsCloak: false,
        stormWitch: false,
        duality: false,
        acidRain: false,
        spellThief: false,
        divineCold: false,
        pyromania: false,
        lethalInjection: false,
        stormShield: false,
        stamina: 0,
        agility: 0,
        intellect: 0,
        critChance: 0,
        critDamageMult: 2,
      },
      /** Co-op: allied knight room boons synced from client (`coop-allied-knight-boons`). */
      coopAlliedKnightBoons: {
        tempestInitiate: false,
        necrosInitiate: false,
        infernalInitiate: false,
        abyssalInitiate: false,
        agility: 0,
        strength: 0,
        stamina: 0,
        intellect: 0,
      },
      /** Co-op: red room boons synced from client (`coop-red-room-boons`). */
      coopRedRoomBoons: {
        fission: false,
      },
      /** Co-op: Eternity Palace III Fae pet companion upgrade id. */
      coopPetCompanionUpgrade: null,
      merchantDashChargePurchased: false,
      merchantWeaponTalentPurchases: 0,
      merchantOxygenPurchases: 0,
      merchantWarpdrivePurchases: 0,
      merchantHealPurchasedThisVisit: false,
      merchantWeaponTalentPurchasedThisVisit: false,
      merchantUtilityPurchasedThisVisit: false,
      merchantBackfillDashPurchasedThisVisit: false,
      merchantBackfillTalentPurchasedThisVisit: false,
      dreamLayerHealPurchasedThisVisit: false,
      dreamLayerWardingPurchasedThisVisit: false,
      dreamLayerLegendaryAPurchasedThisVisit: false,
      dreamLayerLegendaryBPurchasedThisVisit: false,
      dreamLayerRingPurchasedThisVisit: false,
      ownedUniqueItemTypes: new Set(),
      bossRelicRarities: {},
      hasPersephone: false,
      persephoneConsumed: false,
      exodiaSetCount: 0,
      /** Soul Ward pendant — timestamp when redirect is next available. */
      soulWardReadyAt: 0,
    });

    // Position players for co-op mode
    if (this.gameMode === 'coop') {
      const playerIndex = this.players.size - 1;
      const player = this.players.get(playerId);

      if (this.gameStarted && this.combatArenaActive && player) {
        this._grantLateJoinCombatLoadout(player);
      }

      if (this.gameStarted && !this.combatArenaActive) {
        // Mid-session join while party is still in the throne room
        const n = this.players.size;
        const THRONE_SPAWN_R = 3;
        const angle = (playerIndex / Math.max(n, 1)) * Math.PI * 2;
        if (player) {
          player.position = {
            x: Math.sin(angle) * THRONE_SPAWN_R,
            y: 1,
            z: Math.cos(angle) * THRONE_SPAWN_R,
          };
          player.rotation = { x: 0, y: 0, z: 0 };
        }
      } else if (player) {
        const totalPlayers = 3; // Max players for positioning

        const spawnBaseX = COOP_MAIN_ENTRY_X;
        const spawnBaseZ = COOP_MAIN_ENTRY_Z;

        const angleStep = (Math.PI * 2) / totalPlayers;
        const angle = playerIndex * angleStep;
        const spawnRadius = 1.25;
        const rawX = spawnBaseX + Math.sin(angle) * spawnRadius;
        const rawZ = spawnBaseZ + Math.cos(angle) * spawnRadius;
        const c = clampPositionToMainArenaXZ(rawX, rawZ);

        player.position = {
          x: c.x,
          y: 1,
          z: c.z,
        };
        const y = rotationYTowardArenaCenter(c.x, c.z);
        player.rotation = { x: 0, y, z: 0 };
      }
    }
  }

  removePlayer(playerId) {
    this.stopPrimeMateriaAura(playerId);
    this.removeBeastmasterTigerForPlayer(playerId);
    this.removeFaeBeastCompanionForPlayer(playerId);
    // Remove from aggro charts before deleting so enemies don't target a ghost player
    if (this.enemyAI) {
      this.enemyAI.removePlayerFromAllAggro(playerId);
    }

    this.playerStatusEffects.delete(playerId);
    this.players.delete(playerId);

    // Stop game if no players left
    if (this.players.size === 0 && this.gameStarted) {
      this.stopGame();
      return;
    }

    // If this player was the last one blocking a co-op combat transition, release it.
    const transition = this.coopCombatTransition;
    if (transition) {
      const activePlayerIds = Array.from(this.players.keys());
      if (
        activePlayerIds.length > 0 &&
        activePlayerIds.every((id) => transition.readyPlayerIds.has(id))
      ) {
        this._releaseCoopCombatTransition(transition.id, 'player-disconnected');
      }
    }
  }

  // Stop the game
  stopGame() {
    this.gameStarted = false;
    this.combatArenaActive = false;
    this.thronePortalOffer = [];
    this.pendingCoopArchetype = null;
    this.pendingCoopRoomKind = null;
    this.currentCoopRoomKind = null;
    this.clearedCoopRoomKind = null;
    this.bossSpawned = false;
    this.skeletonKillCount = 0;
    this.coopThroneStep = 'rim';
    this.coopMainArenaPortalPhase = null;
    this.coopBossThroneArena = false;
    this.coopThroneBossKind = null;
    this._postBossIntermissionScheduled = false;
    this._clearPreBossSequenceState();
    this.coopSegmentCombatRoomsCleared = 0;
    this.coopBossesDefeatedCount = 0;
    this.coopWaveSpawnPlan = null;
    this.coopRequiredQueue = [];
    this.coopWaveQuota = 0;
    this._coopSpawnChainTimer = null;
    this.roomHasMartyrs = false;
    this.roomHasTitans = false;
    this.roomTitanQuota = 0;
    this.roomTitanSlotIndices = new Set();
    this._devSpawnBoss2 = false;
    this._devSpawnBoss3 = false;
    this._devSpawnDestiny = false;
    this.stopEnemySpawning();
    this.stopEnemyAI();
    this.stopCompanionAI();

    // Clear DoT intervals before bulk-deleting so they cannot fire afterwards
    for (const id of this.enemies.keys()) {
      this._clearEnemyDoTTimers(id);
    }
    this._clearCoopDelayedEnemyWaveTimer();
    this._cancelAllTimers();

    // Clear all enemies and associated per-enemy maps
    this.enemies.clear();
    this.enemyStatusEffects.clear();
    this.enemyChill.clear();
  }

  getPlayer(playerId) {
    return this.players.get(playerId);
  }

  /**
   * Snapshot of living players. Allocates a new array — prefer `this.players.values()`
   * in hot combat/hazard loops; keep this for network payloads and one-shot snapshots.
   */
  getPlayers() {
    return Array.from(this.players.values());
  }

  _maybeBroadcastStagger(enemyId, stagger) {
    if (!this.io) return;
    const now = Date.now();
    const prev = this._staggerBroadcastByEnemy.get(enemyId);
    if (prev && prev.lastStagger === stagger && now - prev.lastAt < 100) return;
    if (prev && now - prev.lastAt < 100) return;
    this._staggerBroadcastByEnemy.set(enemyId, { lastAt: now, lastStagger: stagger });
    this.io.to(this.roomId).emit('enemy-stagger-updated', {
      enemyId,
      stagger,
      timestamp: now,
    });
  }

  /** Broadcast Concentrated Venom stacks so clients can render VenomEffect. */
  _maybeBroadcastConcentratedVenom(enemyId, stacks, expireAt) {
    if (!this.io) return;
    const now = Date.now();
    const stackCount = typeof stacks === 'number' ? stacks : 0;
    const prev = this._concentratedVenomBroadcastByEnemy.get(enemyId);
    if (prev && prev.lastStacks === stackCount && now - prev.lastAt < 100) return;
    this._concentratedVenomBroadcastByEnemy.set(enemyId, { lastAt: now, lastStacks: stackCount });
    this.io.to(this.roomId).emit('enemy-concentrated-venom-updated', {
      enemyId,
      stacks: stackCount,
      expireAt: expireAt || null,
      timestamp: now,
    });
  }

  getPlayerCount() {
    return this.players.size;
  }

  _emitPlayerDamagedWithHealth(playerId, player, damagePayload) {
    if (!this.io || !player) return;
    this.io.to(this.roomId).emit('player-damaged', damagePayload);
  }

  /**
   * Emit player-damaged after `_applyCoopPlayerIncomingDamage`, remapping dodges / Soul Bond.
   */
  _emitCoopIncomingDamageResult(playerId, player, {
    damage,
    damageType,
    wasKilled,
    persephoneTriggered,
    dodged,
    negationType = null,
    meta = null,
  }) {
    if (dodged) {
      const isSoulBond = negationType === 'soul_bond';
      this._emitPlayerDamagedWithHealth(playerId, player, {
        sourcePlayerId: null,
        targetPlayerId: playerId,
        damage: 0,
        damageType: isSoulBond ? 'soul_bond_blocked' : 'dodge_blocked',
        isCritical: false,
        newHealth: player.health,
        maxHealth: player.maxHealth,
        wasKilled: false,
        persephoneTriggered: false,
        wasDodged: !isSoulBond,
        wasSoulBond: isSoulBond,
        timestamp: Date.now(),
        ...(meta?.sourceEnemyId ? { sourceEnemyId: meta.sourceEnemyId } : {}),
      });
      return;
    }
    if (meta?.sourceEnemyId && this.enemyAI) {
      this.enemyAI.recordAlliedProtectionThreat(meta.sourceEnemyId, playerId, damage);
    }
    this._emitPlayerDamagedWithHealth(playerId, player, {
      sourcePlayerId: null,
      targetPlayerId: playerId,
      damage,
      damageType,
      isCritical: false,
      newHealth: player.health,
      maxHealth: player.maxHealth,
      wasKilled,
      persephoneTriggered,
      timestamp: Date.now(),
      ...(meta?.sourceEnemyId ? { sourceEnemyId: meta.sourceEnemyId } : {}),
    });
  }

  /**
   * Resolve a living Soul Ward redirect target for the player.
   * Priority: primary ancestor ally → Fae beast → pack wolf → Beastmaster tiger.
   */
  _getSoulWardRedirectTarget(player) {
    if (!player) return null;
    const allyKind = this.coopAllyKind;
    const primaryAllyId = allyKind ? COOP_ALLY_KIND_TO_ID[allyKind] : null;
    if (primaryAllyId) {
      const ally = this.enemies.get(primaryAllyId);
      if (ally && !ally.isDying && (ally.health ?? 0) > 0) return ally;
    }
    const fae = this.getLivingFaeBeastForPlayer(player.id);
    if (fae) return fae;
    const pack = this.getLivingPackWolfForPlayer(player.id);
    if (pack) return pack;
    const tigerId = this.getBeastmasterTigerId(player.id);
    const tiger = this.enemies.get(tigerId);
    if (tiger && !tiger.isDying && (tiger.health ?? 0) > 0) return tiger;
    return null;
  }

  /**
   * Soul Ward: negate incoming damage and deal double to ally / beast companion.
   * @returns {boolean} true if the hit was redirected
   */
  _trySoulWardRedirect(player, damage) {
    if (!player || !(damage > 0)) return false;
    if (!player.ownedUniqueItemTypes?.has?.('SOUL_WARD')) return false;
    const now = Date.now();
    if (now < (player.soulWardReadyAt ?? 0)) return false;
    const target = this._getSoulWardRedirectTarget(player);
    if (!target) return false;
    const redirected = Math.round(damage * SOUL_WARD_DAMAGE_MULT);
    this.damageEnemy(target.id, redirected, null, null, {
      damageType: 'soul_ward_redirect',
    });
    player.soulWardReadyAt = now + SOUL_WARD_COOLDOWN_MS;
    return true;
  }

  /**
   * Apply incoming coop player damage.
   * Persephone lethal-save is client-authoritative (Health.lethalSaveHook); this path only
   * tracks HP / Tiger Evasion / Soul Ward. Always returns persephoneTriggered: false so callers stay valid.
   * Tiger Evasion may fully negate the hit (returns dodged: true).
   * Soul Ward may redirect the hit to an ally (dodged: true, negationType: 'soul_bond').
   * Hexmetal Cloak clamps any single source to 50 before HP subtraction.
   * @returns {{ newHealth: number, wasKilled: boolean, persephoneTriggered: boolean, dodged: boolean, negationType: string|null, appliedDamage: number }}
   */
  _applyCoopPlayerIncomingDamage(player, damage) {
    const previousHealth = player.health;
    let appliedDamage = damage;

    if (
      player?.ownedUniqueItemTypes?.has?.('HEXMETAL_CLOAK') &&
      typeof appliedDamage === 'number' &&
      appliedDamage > 50
    ) {
      appliedDamage = 50;
    }

    if (this._rollTigerEvasion(player)) {
      return {
        newHealth: player.health,
        wasKilled: false,
        persephoneTriggered: false,
        dodged: true,
        negationType: null,
        appliedDamage: 0,
      };
    }

    if (this._trySoulWardRedirect(player, appliedDamage)) {
      return {
        newHealth: player.health,
        wasKilled: false,
        persephoneTriggered: false,
        dodged: true,
        negationType: 'soul_bond',
        appliedDamage: 0,
      };
    }

    player.health = Math.max(0, player.health - appliedDamage);

    const wasKilled = previousHealth > 0 && player.health <= 0;
    return {
      newHealth: player.health,
      wasKilled,
      persephoneTriggered: false,
      dodged: false,
      negationType: null,
      appliedDamage,
    };
  }

  _emitPersephoneTriggered(playerId, player) {
    if (!this.io) return;
    this.io.to(this.roomId).emit('persephone-triggered', {
      playerId,
      newHealth: player.health,
      maxHealth: player.maxHealth,
      timestamp: Date.now(),
    });
  }

  /**
   * Client-authoritative Persephone consume: clear ownership so Immortal Union can regenerate
   * on the next room entry, sync HP from the client save, and broadcast inventory removal.
   */
  consumePersephone(playerId, opts = {}) {
    const player = this.players.get(playerId);
    if (!player) return false;
    dreamLayerItems.ensurePlayerOwnedItems(player);
    // Require an active ring (flag or ownership). Blocks double-consume spam.
    if (!player.hasPersephone && !dreamLayerItems.playerOwnsItem(player, 'PERSEPHONE')) {
      return false;
    }

    player.ownedUniqueItemTypes.delete('PERSEPHONE');
    player.hasPersephone = false;
    player.persephoneConsumed = true;
    player.exodiaSetCount = dreamLayerItems.countExodiaPieces(player.ownedUniqueItemTypes);

    if (typeof opts.maxHealth === 'number' && opts.maxHealth > 0) {
      player.maxHealth = opts.maxHealth;
    }
    if (typeof opts.newHealth === 'number' && opts.newHealth > 0) {
      player.health = Math.min(player.maxHealth || opts.newHealth, opts.newHealth);
    } else {
      player.health = Math.max(
        1,
        Math.floor((player.maxHealth || 1) * dreamLayerItems.PERSEPHONE_SAVE_HP_FRACTION),
      );
    }

    this._emitPersephoneTriggered(playerId, player);
    return true;
  }

  _registerPlayerDreamLayerItem(playerId, player, itemType) {
    if (!player || !itemType) return;
    dreamLayerItems.registerPlayerOwnedItem(player, itemType);
    if (
      dreamLayerItems.hasImmortalUnion(player.exodiaSetCount) &&
      !dreamLayerItems.playerOwnsItem(player, 'PERSEPHONE')
    ) {
      this._grantImmortalUnionPersephone(playerId, player);
    }
  }

  _getBossRelicRarity(player, type) {
    if (!player || !type) return null;
    if (!player.bossRelicRarities) player.bossRelicRarities = {};
    const rarity = player.bossRelicRarities[type];
    return bossRelicItems.isBossRelicRarity(rarity) ? rarity : null;
  }

  _registerBossRelic(player, type, rarity) {
    if (!player || !type || !bossRelicItems.isUpgradeableBossRelic(type)) return;
    if (!bossRelicItems.isBossRelicRarity(rarity)) return;
    if (!player.bossRelicRarities) player.bossRelicRarities = {};
    const owned = this._getBossRelicRarity(player, type);
    if (owned == null || bossRelicItems.compareBossRelicRarity(rarity, owned) > 0) {
      player.bossRelicRarities[type] = rarity;
    }
  }

  _grantImmortalUnionPersephone(playerId, player) {
    if (!player || dreamLayerItems.playerOwnsItem(player, 'PERSEPHONE')) return;
    const item = {
      id: `persephone-immortal-union-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      type: 'PERSEPHONE',
      label: dreamLayerItems.getDreamLayerItemLabel('PERSEPHONE'),
      category: 'boss_drop',
      rarity: 'legendary',
      pickedUpAt: Date.now(),
    };
    dreamLayerItems.registerPlayerOwnedItem(player, 'PERSEPHONE');
    if (this.io) {
      this.io.to(this.roomId).emit('item-picked-up', {
        itemId: item.id,
        playerId,
        item,
        timestamp: Date.now(),
      });
    }
  }

  _regenerateImmortalUnionPersephoneForAllPlayers() {
    for (const [playerId, player] of this.players) {
      if (!player) continue;
      dreamLayerItems.ensurePlayerOwnedItems(player);
      player.exodiaSetCount = dreamLayerItems.countExodiaPieces(player.ownedUniqueItemTypes);
      if (!dreamLayerItems.hasImmortalUnion(player.exodiaSetCount)) continue;
      if (player.hasPersephone || !player.persephoneConsumed) continue;
      this._grantImmortalUnionPersephone(playerId, player);
      player.persephoneConsumed = false;
    }
  }

  /**
   * Boss leap / tectonic shards: apply damage to all players in a horizontal XZ ring.
   */
  /**
   * Damage players whose XZ foot position lies within `halfWidth` of segment A→B (inclusive caps).
   */
  damagePlayersInLineSegment(ax, az, bx, bz, halfWidth, damage, damageType = 'tentacle_spine', meta = null) {
    if (!this.io || !this.players || halfWidth <= 0 || damage <= 0) return 0;
    if (this.isCoopCombatTransitionActive()) return 0;
    let hitCount = 0;
    const hw2 = halfWidth * halfWidth;
    const abx = bx - ax;
    const abz = bz - az;
    const abLen2 = abx * abx + abz * abz;
    for (const [playerId, player] of this.players) {
      if (!player || player.health <= 0) continue;
      const px = player.position.x;
      const pz = player.position.z;
      const apx = px - ax;
      const apz = pz - az;
      let t = abLen2 > 1e-8 ? (apx * abx + apz * abz) / abLen2 : 0;
      t = Math.max(0, Math.min(1, t));
      const qx = ax + t * abx;
      const qz = az + t * abz;
      const dx = px - qx;
      const dz = pz - qz;
      if (dx * dx + dz * dz > hw2) continue;

      const { wasKilled, persephoneTriggered, dodged, negationType, appliedDamage } = this._applyCoopPlayerIncomingDamage(player, damage);
      hitCount += 1;
      if (persephoneTriggered) {
        this._emitPersephoneTriggered(playerId, player);
      }
      this._emitCoopIncomingDamageResult(playerId, player, {
        damage: appliedDamage,
        damageType,
        wasKilled,
        persephoneTriggered,
        dodged,
        negationType,
        meta,
      });
    }
    if (hitCount > 0) this._tryEmitCoopRoomWhisper();
    return hitCount;
  }

  /**
   * Like `damagePlayersInLineSegment`, but only damages each player at most once per `hitPlayerIds` Set (mutated on hit).
   * Used by boss 3 nova discs so corridor sweeps cannot multi-tick one player incorrectly.
   */
  damagePlayersInLineSegmentFirstHit(ax, az, bx, bz, halfWidth, damage, damageType = 'boss3_arcane_disc', hitPlayerIds, meta = null) {
    if (!this.io || !this.players || halfWidth <= 0 || damage <= 0 || !hitPlayerIds) return;
    if (this.isCoopCombatTransitionActive()) return;
    let hitAny = false;
    const hw2 = halfWidth * halfWidth;
    const abx = bx - ax;
    const abz = bz - az;
    const abLen2 = abx * abx + abz * abz;
    for (const [playerId, player] of this.players) {
      if (!player || player.health <= 0) continue;
      if (hitPlayerIds.has(playerId)) continue;
      const px = player.position.x;
      const pz = player.position.z;
      const apx = px - ax;
      const apz = pz - az;
      let t = abLen2 > 1e-8 ? (apx * abx + apz * abz) / abLen2 : 0;
      t = Math.max(0, Math.min(1, t));
      const qx = ax + t * abx;
      const qz = az + t * abz;
      const dx = px - qx;
      const dz = pz - qz;
      if (dx * dx + dz * dz > hw2) continue;

      hitPlayerIds.add(playerId);
      hitAny = true;
      const { wasKilled, persephoneTriggered, dodged, negationType, appliedDamage } = this._applyCoopPlayerIncomingDamage(player, damage);
      if (persephoneTriggered) {
        this._emitPersephoneTriggered(playerId, player);
      }
      this._emitCoopIncomingDamageResult(playerId, player, {
        damage: appliedDamage,
        damageType,
        wasKilled,
        persephoneTriggered,
        dodged,
        negationType,
        meta,
      });
      if (!dodged && meta?.stunMs && meta.stunMs > 0) {
        this.applyPlayerStatusEffect(playerId, 'stun', meta.stunMs);
        this.io.to(this.roomId).emit('player-debuff', {
          targetPlayerId: playerId,
          debuffType: 'stunned',
          duration: meta.stunMs,
          effectData: {
            position: {
              x: player.position.x,
              y: player.position.y,
              z: player.position.z,
            },
          },
          timestamp: Date.now(),
        });
      }
    }
    if (hitAny) this._tryEmitCoopRoomWhisper();
  }

  /**
   * Damage players whose XZ foot position lies inside a horizontal cone from origin along facingAngle.
   * @param {number} originX
   * @param {number} originZ
   * @param {number} facingAngle - radians, atan2(dx, dz) matching enemy.rotation
   * @param {number} range - max distance along cone axis
   * @param {number} halfAngleRad - half-angle of cone in radians
   */
  damagePlayersInCone(originX, originZ, facingAngle, range, halfAngleRad, damage, damageType = 'wraith_buzzsaw', meta = null) {
    if (!this.io || !this.players || range <= 0 || halfAngleRad <= 0 || damage <= 0) return 0;
    if (this.isCoopCombatTransitionActive()) return 0;

    const fwdX = Math.sin(facingAngle);
    const fwdZ = Math.cos(facingAngle);
    const cosHalf = Math.cos(halfAngleRad);
    let hitCount = 0;

    for (const [playerId, player] of this.players) {
      if (!player || player.health <= 0) continue;
      const px = player.position.x;
      const pz = player.position.z;
      const dx = px - originX;
      const dz = pz - originZ;
      const dist = Math.hypot(dx, dz);
      if (dist <= 0 || dist > range) continue;

      const dot = (dx * fwdX + dz * fwdZ) / dist;
      if (dot < cosHalf) continue;

      const { wasKilled, persephoneTriggered, dodged, negationType, appliedDamage } = this._applyCoopPlayerIncomingDamage(player, damage);
      hitCount += 1;
      if (persephoneTriggered) {
        this._emitPersephoneTriggered(playerId, player);
      }
      this._emitCoopIncomingDamageResult(playerId, player, {
        damage: appliedDamage,
        damageType,
        wasKilled,
        persephoneTriggered,
        dodged,
        negationType,
        meta,
      });
    }
    if (hitCount > 0) this._tryEmitCoopRoomWhisper();
    return hitCount;
  }

  damagePlayersInHorizontalRing(center, radius, damage, damageType = 'boss_aoe', meta = null) {
    if (!this.io || !this.players || radius <= 0 || damage <= 0 || !center) return;
    if (this.isCoopCombatTransitionActive()) return;
    let hitAny = false;
    const cx = center.x;
    const cz = center.z;
    const r2 = radius * radius;
    for (const [playerId, player] of this.players) {
      if (!player || player.health <= 0) continue;
      const dx = player.position.x - cx;
      const dz = player.position.z - cz;
      if (dx * dx + dz * dz > r2) continue;
      hitAny = true;
      const { wasKilled, persephoneTriggered, dodged, negationType, appliedDamage } = this._applyCoopPlayerIncomingDamage(player, damage);
      if (persephoneTriggered) {
        this._emitPersephoneTriggered(playerId, player);
      }
      this._emitCoopIncomingDamageResult(playerId, player, {
        damage: appliedDamage,
        damageType,
        wasKilled,
        persephoneTriggered,
        dodged,
        negationType,
        meta,
      });
      if (!dodged && meta?.stunMs && meta.stunMs > 0) {
        this.applyPlayerStatusEffect(playerId, 'stun', meta.stunMs);
        this.io.to(this.roomId).emit('player-debuff', {
          targetPlayerId: playerId,
          debuffType: 'stunned',
          duration: meta.stunMs,
          effectData: {
            position: {
              x: player.position.x,
              y: player.position.y,
              z: player.position.z,
            },
          },
          timestamp: Date.now(),
        });
      }
    }
    if (hitAny) this._tryEmitCoopRoomWhisper();
  }

  /**
   * Stun-only AoE — players and allied units within a horizontal ring (no damage).
   * Used by Eternal Oak Earthbreaker.
   */
  stunCombatantsInHorizontalRing(center, radius, stunMs, sourceEnemyId = null) {
    if (!this.io || !center || radius <= 0 || !stunMs || stunMs <= 0) return;
    if (this.isCoopCombatTransitionActive()) return;

    const cx = center.x;
    const cz = center.z;
    const r2 = radius * radius;

    if (this.players) {
      for (const [playerId, player] of this.players) {
        if (!player || player.health <= 0) continue;
        const dx = player.position.x - cx;
        const dz = player.position.z - cz;
        if (dx * dx + dz * dz > r2) continue;
        this.applyPlayerStatusEffect(playerId, 'stun', stunMs);
        this.io.to(this.roomId).emit('player-debuff', {
          targetPlayerId: playerId,
          debuffType: 'stunned',
          duration: stunMs,
          effectData: {
            position: {
              x: player.position.x,
              y: player.position.y,
              z: player.position.z,
            },
          },
          timestamp: Date.now(),
          ...(sourceEnemyId ? { sourceEnemyId } : {}),
        });
      }
    }

    if (this.enemies) {
      for (const [enemyId, enemy] of this.enemies) {
        if (!enemy || enemy.isDying || (enemy.health != null && enemy.health <= 0)) continue;
        if (sourceEnemyId && enemyId === sourceEnemyId) continue;
        if (!this._isCoopPlayerAllyEnemy(enemy)) continue;
        const ex = enemy.position?.x ?? 0;
        const ez = enemy.position?.z ?? 0;
        const dx = ex - cx;
        const dz = ez - cz;
        if (dx * dx + dz * dz > r2) continue;
        this.applyStatusEffect(enemyId, 'stun', stunMs);
      }
    }
  }

  /**
   * @param { { x: number, z: number } } center
   * @param { number } radius
   * @param { number } damage
   * @param { string } [damageType]
   */
  damageEnemiesInHorizontalRing(center, radius, damage, damageType = 'mushroom_eruption', hitMetaExtra = null) {
    if (!this.enemies || radius <= 0 || damage <= 0 || !center) return;
    const cx = center.x;
    const cz = center.z;
    const r2 = radius * radius;
    const sourceEnemyId = hitMetaExtra?.sourceEnemyId ?? null;
    for (const [enemyId, enemy] of this.enemies) {
      if (!enemy || enemy.isDying) continue;
      if (enemy.health != null && enemy.health <= 0) continue;
      if (sourceEnemyId && enemyId === sourceEnemyId) continue;
      const ex = enemy.position?.x ?? 0;
      const ez = enemy.position?.z ?? 0;
      const dx = ex - cx;
      const dz = ez - cz;
      if (dx * dx + dz * dz > r2) continue;
      const dmg = this._isCoopPlayerAllyEnemy(enemy)
        ? mushroomConstants.MUSHROOM_ERUPTION_ALLY_DMG
        : damage;
      this.damageEnemy(enemyId, dmg, null, null, {
        damageType,
        ...(hitMetaExtra && typeof hitMetaExtra === 'object' ? hitMetaExtra : {}),
      });
    }
  }

  _anyPlayerHasFissionRoom() {
    if (!this.players) return false;
    for (const [, player] of this.players) {
      if (player?.coopRedRoomBoons?.fission) return true;
    }
    return false;
  }

  _tryFissionDetonation(deadEnemy, deadEnemyId, fromPlayerId, player) {
    if (!deadEnemy?.position) return;
    const center = {
      x: deadEnemy.position.x,
      y: deadEnemy.position.y ?? 0,
      z: deadEnemy.position.z,
    };
    const timestamp = Date.now();
    if (this.io) {
      this.io.to(this.roomId).emit('fission-detonation', {
        position: center,
        radius: FISSON_EXPLOSION_RADIUS,
        timestamp,
      });
    }
    const radiusSq = FISSON_EXPLOSION_RADIUS * FISSON_EXPLOSION_RADIUS;
    const fissionHitMeta = { damageType: 'fission', fissionRoom: true };
    for (const [enemyId, enemy] of this.enemies) {
      if (!enemy || enemy.isDying) continue;
      if (enemyId === deadEnemyId) continue;
      if (enemy.health != null && enemy.health <= 0) continue;
      const ex = enemy.position?.x ?? 0;
      const ez = enemy.position?.z ?? 0;
      const dx = ex - center.x;
      const dz = ez - center.z;
      if (dx * dx + dz * dz > radiusSq) continue;
      this.damageEnemy(enemyId, FISSON_EXPLOSION_DAMAGE, fromPlayerId, player, fissionHitMeta);
    }
  }

  getRandomCrossentropyMeteorStartPosition(center) {
    const angle = Math.random() * Math.PI * 2;
    const distance =
      CROSSENTROPY_METEOR_SKY_OFFSET_MIN +
      Math.random() * (CROSSENTROPY_METEOR_SKY_OFFSET_MAX - CROSSENTROPY_METEOR_SKY_OFFSET_MIN);
    const height =
      CROSSENTROPY_METEOR_SKY_HEIGHT_MIN +
      Math.random() * (CROSSENTROPY_METEOR_SKY_HEIGHT_MAX - CROSSENTROPY_METEOR_SKY_HEIGHT_MIN);
    return {
      x: center.x + Math.cos(angle) * distance,
      y: height,
      z: center.z + Math.sin(angle) * distance,
    };
  }

  tryProcCrossentropyMeteor(center, fromPlayerId, player, hitMeta) {
    if (!center || !fromPlayerId || fromPlayerId === 'unknown') return;
    if (!hitMeta || hitMeta.damageType !== 'crossentropy') return;
    if (!hitMeta.crossentropyMeteor) return;
    if (hitMeta.crossentropyMeteorDamage) return;
    const meteorCount = rollCrossentropyMeteorStrikeCount();
    for (let i = 0; i < meteorCount; i++) {
      this._scheduleTimeout(() => {
        this.spawnOneCrossentropyMeteor(center, fromPlayerId, player, hitMeta, i);
      }, i * CROSSENTROPY_METEOR_STAGGER_MS);
    }
  }

  spawnOneCrossentropyMeteor(center, fromPlayerId, player, hitMeta, meteorIndex) {
    const startPosition = this.getRandomCrossentropyMeteorStartPosition(center);
    const dx = center.x - startPosition.x;
    const dy = -3 - startPosition.y;
    const dz = center.z - startPosition.z;
    const travelDistance = Math.hypot(dx, dy, dz);
    const travelTimeMs = (travelDistance / CROSSENTROPY_METEOR_SPEED) * 1000;
    const castTimestamp = Date.now();
    if (this.io) {
      this.io.to(this.roomId).emit('crossentropy-meteor-cast', {
        meteorId: `crossentropy-meteor-${fromPlayerId}-${castTimestamp}-${meteorIndex}`,
        targetPosition: { x: center.x, y: center.y ?? 0, z: center.z },
        startPosition,
        timestamp: castTimestamp,
        damage: CROSSENTROPY_METEOR_DAMAGE,
      });
    }

    const impactDelayMs = CROSSENTROPY_METEOR_WARNING_MS + travelTimeMs;
    this._scheduleTimeout(() => {
      if (!this.enemies) return;
      const radiusSq = CROSSENTROPY_METEOR_RADIUS * CROSSENTROPY_METEOR_RADIUS;
      const meteorHitMeta = {
        damageType: 'crossentropy',
        infernoCrossentropy: !!hitMeta.infernoCrossentropy,
        reaperCrossentropy: !!hitMeta.reaperCrossentropy,
        crossentropyPlague: !!hitMeta.crossentropyPlague,
        crossentropyMeteorDamage: true,
        ...(typeof hitMeta.staggerToAdd === 'number' && hitMeta.staggerToAdd > 0
          ? { staggerToAdd: hitMeta.staggerToAdd }
          : {}),
      };
      for (const [enemyId, enemy] of this.enemies) {
        if (!enemy || enemy.isDying) continue;
        if (enemy.health != null && enemy.health <= 0) continue;
        const ex = enemy.position?.x ?? 0;
        const ez = enemy.position?.z ?? 0;
        const ddx = ex - center.x;
        const ddz = ez - center.z;
        if (ddx * ddx + ddz * ddz > radiusSq) continue;
        this.damageEnemy(enemyId, CROSSENTROPY_METEOR_DAMAGE, fromPlayerId, player || null, meteorHitMeta);
      }
    }, impactDelayMs);
  }

  /** Server-authoritative concentrated arctic blizzard at a fixed point (Duality, Divine Cold, etc.). */
  _spawnCoopArcticBlizzard(center, fromPlayerId, player, options = {}) {
    if (!center || !fromPlayerId) return;
    const blizzardIdPrefix = options.blizzardIdPrefix || 'duality-bz';
    const position = {
      x: center.x ?? 0,
      y: Math.max(1.5, center.y ?? 0),
      z: center.z ?? 0,
    };
    const castTimestamp = Date.now();
    if (this.io) {
      this.io.to(this.roomId).emit('duality-blizzard-cast', {
        blizzardId: `${blizzardIdPrefix}-${fromPlayerId}-${castTimestamp}-${Math.random().toString(36).slice(2, 8)}`,
        position,
        durationMs: DUALITY_BLIZZARD_DURATION_MS,
        tickMs: DUALITY_BLIZZARD_TICK_MS,
        radius: DUALITY_BLIZZARD_HIT_RADIUS,
        timestamp: castTimestamp,
      });
    }

    const tickCount = Math.floor(DUALITY_BLIZZARD_DURATION_MS / DUALITY_BLIZZARD_TICK_MS);
    const radiusSq = DUALITY_BLIZZARD_HIT_RADIUS * DUALITY_BLIZZARD_HIT_RADIUS;
    let ticksDone = 0;
    const intervalId = setInterval(() => {
      ticksDone += 1;
      if (!this.enemies || ticksDone > tickCount) {
        clearInterval(intervalId);
        this._scheduledTimers.delete(intervalId);
        return;
      }
      const livePlayer = fromPlayerId ? this.players.get(fromPlayerId) : player;
      for (const [enemyId, enemy] of this.enemies) {
        if (!enemy || enemy.isDying) continue;
        if (enemy.health != null && enemy.health <= 0) continue;
        const ex = enemy.position?.x ?? 0;
        const ez = enemy.position?.z ?? 0;
        const ddx = ex - position.x;
        const ddz = ez - position.z;
        if (ddx * ddx + ddz * ddz > radiusSq) continue;
        this.damageEnemy(
          enemyId,
          DUALITY_BLIZZARD_DAMAGE_PER_TICK,
          fromPlayerId,
          livePlayer || player,
          { damageType: 'blizzard', arcticBlizzard: true },
        );
      }
      if (ticksDone >= tickCount) {
        clearInterval(intervalId);
        this._scheduledTimers.delete(intervalId);
      }
    }, DUALITY_BLIZZARD_TICK_MS);
    this._scheduledTimers.add(intervalId);
  }

  /** DUALITY (duo: red + purple) — server-authoritative concentrated blizzard at a fixed point. */
  _spawnDualityBlizzard(center, fromPlayerId, player) {
    this._spawnCoopArcticBlizzard(center, fromPlayerId, player, { blizzardIdPrefix: 'duality-bz' });
  }

  /** DIVINE COLD (ultimate: purple) — spawn blizzard on an enemy in front after Aegis invuln proc. */
  tryProcDivineColdBlizzard(playerId, targetPosition, direction) {
    if (!playerId || !targetPosition) return;
    const player = this.players.get(playerId);
    if (!player?.coopStaggerRoomBoons?.divineCold) return;

    const now = Date.now();
    if (player._divineColdBlizzardAt && now - player._divineColdBlizzardAt < DIVINE_COLD_BLIZZARD_ICD_MS) {
      return;
    }

    const px = player.position?.x ?? 0;
    const pz = player.position?.z ?? 0;
    const tx = targetPosition.x ?? 0;
    const tz = targetPosition.z ?? 0;
    const dx = tx - px;
    const dz = tz - pz;
    const distSq = dx * dx + dz * dz;
    const maxRangeSq = DIVINE_COLD_FORWARD_RANGE * DIVINE_COLD_FORWARD_RANGE;
    if (distSq <= 0 || distSq > maxRangeSq) return;

    if (direction) {
      const fx = direction.x ?? 0;
      const fz = direction.z ?? 0;
      const fLen = Math.hypot(fx, fz);
      if (fLen > 1e-6) {
        const dist = Math.sqrt(distSq);
        const dot = (dx * fx + dz * fz) / (dist * fLen);
        const cosThreshold = Math.cos((DIVINE_COLD_FORWARD_CONE_HALF_ANGLE_DEG * Math.PI) / 180);
        if (dot < cosThreshold) return;
      }
    }

    let matchedEnemy = null;
    let nearestEnemyDistSq = 4;
    for (const [, enemy] of this.enemies) {
      if (!enemy || enemy.isDying || (enemy.health != null && enemy.health <= 0)) continue;
      const ex = enemy.position?.x ?? 0;
      const ez = enemy.position?.z ?? 0;
      const edx = ex - tx;
      const edz = ez - tz;
      const enemyDistSq = edx * edx + edz * edz;
      if (enemyDistSq <= nearestEnemyDistSq) {
        nearestEnemyDistSq = enemyDistSq;
        matchedEnemy = enemy;
      }
    }
    if (!matchedEnemy) return;

    player._divineColdBlizzardAt = now;
    const center = {
      x: matchedEnemy.position.x,
      y: matchedEnemy.position.y ?? 0,
      z: matchedEnemy.position.z,
    };
    this._spawnCoopArcticBlizzard(center, playerId, player, { blizzardIdPrefix: 'divine-cold-bz' });
  }

  getCloudkillStartPosition(center) {
    const height =
      CLOUDKILL_SKY_HEIGHT_MIN +
      Math.random() * (CLOUDKILL_SKY_HEIGHT_MAX - CLOUDKILL_SKY_HEIGHT_MIN);
    return {
      x: center.x,
      y: height,
      z: center.z,
    };
  }

  tryProcCloudkill(center, fromPlayerId, player, hitMeta) {
    if (!center || !fromPlayerId || fromPlayerId === 'unknown') return;
    if (!hitMeta || hitMeta.damageType !== 'projectile') return;
    if (!hitMeta.cloudkill) return;
    if (hitMeta.cloudkillDamage) return;
    const arrowCount = rollCloudkillArrowCount();
    for (let i = 0; i < arrowCount; i++) {
      this._scheduleTimeout(() => {
        this.spawnOneCloudkillArrow(center, fromPlayerId, player, i);
      }, i * CLOUDKILL_ARROW_DELAY_MS);
    }
  }

  spawnOneCloudkillArrow(center, fromPlayerId, player, arrowIndex) {
    const startPosition = this.getCloudkillStartPosition(center);
    const dx = center.x - startPosition.x;
    const dy = -3 - startPosition.y;
    const dz = center.z - startPosition.z;
    const travelDistance = Math.hypot(dx, dy, dz);
    const travelTimeMs = (travelDistance / CLOUDKILL_ARROW_SPEED) * 1000;
    const castTimestamp = Date.now();
    if (this.io) {
      this.io.to(this.roomId).emit('cloudkill-cast', {
        castId: `cloudkill-${fromPlayerId}-${castTimestamp}-${arrowIndex}`,
        targetPosition: { x: center.x, y: center.y ?? 0, z: center.z },
        startPosition,
        timestamp: castTimestamp,
        delayMs: arrowIndex * CLOUDKILL_ARROW_DELAY_MS,
        damage: CLOUDKILL_DAMAGE,
      });
    }

    const impactDelayMs = CLOUDKILL_WARNING_MS + travelTimeMs;
    this._scheduleTimeout(() => {
      if (!this.enemies) return;
      const radiusSq = CLOUDKILL_RADIUS * CLOUDKILL_RADIUS;
      const cloudkillHitMeta = {
        damageType: 'cloudkill',
        cloudkillDamage: true,
      };
      for (const [enemyId, enemy] of this.enemies) {
        if (!enemy || enemy.isDying) continue;
        if (enemy.health != null && enemy.health <= 0) continue;
        const ex = enemy.position?.x ?? 0;
        const ez = enemy.position?.z ?? 0;
        const ddx = ex - center.x;
        const ddz = ez - center.z;
        if (ddx * ddx + ddz * ddz > radiusSq) continue;
        this.damageEnemy(enemyId, CLOUDKILL_DAMAGE, fromPlayerId, player || null, cloudkillHitMeta);
      }
    }, impactDelayMs);
  }

  getMushroomState() {
    if (!this.mushroomHealth || this.mushroomHealth.length === 0) {
      this._resetMushroomState();
    }
    return { health: [...this.mushroomHealth], maxHealth: mushroomConstants.MUSHROOM_MAX_HP };
  }

  /**
   * @param { number } index
   * @param { number } damage
   * @param { string } playerId
   * @returns { { newHealth: number, destroyed: boolean } | null }
   */
  damageMushroom(index, damage, playerId) {
    if (!this.gameStarted) return null;
    if (this.isCoopCombatTransitionActive()) return null;
    if (this.coopIntroActive || this.coopDeepSanctumActive) return null;
    if (COOP_COLORED_ROOM_TYPES.includes(this.currentCoopRoomKind)) return null;
    const { MUSHROOM_COUNT, getEruptionPosition, getInstances } = mushroomLayout;
    if (typeof index !== 'number' || index < 0 || index >= MUSHROOM_COUNT) return null;
    const d = Math.min(
      Math.max(0, Number(damage) || 0),
      mushroomConstants.MUSHROOM_MAX_DAMAGE_PER_HIT,
    );
    if (d <= 0) return null;
    if (!this.mushroomHealth || this.mushroomHealth[index] <= 0) return null;
    const player = this.players.get(playerId);
    if (!player) return null;
    const inst = getInstances()[index];
    if (!inst) return null;
    const dx = player.position.x - inst.x;
    const dz = player.position.z - inst.z;
    if (dx * dx + dz * dz > 14 * 14) return null;

    this.mushroomHealth[index] = Math.max(0, this.mushroomHealth[index] - d);
    const newHealth = this.mushroomHealth[index];
    if (this.io) {
      this.io.to(this.roomId).emit('mushroom-damaged', {
        index,
        newHealth,
        maxHealth: mushroomConstants.MUSHROOM_MAX_HP,
        damage: d,
        timestamp: Date.now(),
      });
    }
    if (newHealth <= 0) {
      const pos = getEruptionPosition(index);
      this.damagePlayersInHorizontalRing(
        pos,
        mushroomConstants.MUSHROOM_ERUPTION_RADIUS,
        mushroomConstants.MUSHROOM_ERUPTION_PLAYER_DMG,
        'mushroom_eruption',
      );
      this.damageEnemiesInHorizontalRing(
        pos,
        mushroomConstants.MUSHROOM_ERUPTION_RADIUS,
        mushroomConstants.MUSHROOM_ERUPTION_ENEMY_DMG,
        'mushroom_eruption',
      );
      if (this.io) {
        this.io.to(this.roomId).emit('mushroom-destroyed', { index, position: pos, timestamp: Date.now() });
      }
    }
    return { newHealth, destroyed: newHealth <= 0 };
  }

  // Enemy management
  spawnEnemyWave() {
    if (!this.gameStarted) return;

    if (this.gameMode === 'coop') {
      if (this.coopDeepSanctumActive) {
        this.spawnDeepSanctumWave(this.coopDeepSanctumLevel);
      } else if (this.coopEternityActive && this.coopEternityRoomIndex > 0) {
        this.spawnEternityWave(this.coopEternityRoomIndex);
      } else if (this.coopSunkenActive && this.coopSunkenRoomIndex > 0) {
        this.spawnSunkenWave(this.coopSunkenRoomIndex);
      } else if (this.coopFaeRealmActive && this.coopFaeRealmRoomIndex > 0) {
        this.spawnFaeRealmWave(this.coopFaeRealmRoomIndex);
      } else if (this.coopIntroActive && this.coopIntroRoomIndex > 0) {
        this.spawnIntroWave(this.coopIntroRoomIndex);
      } else {
        this.initializeEnemies();
      }
      this.spawnOrReviveAlliedUnitsForEnemyRoom();
      this.syncAllBeastmasterTigers();
      this.syncAllFaeBeastCompanions();
      this.repositionAllBeastCompanionsNearOwners();
      if (this.enemyAI?.clearNonPlayerAggroTargets) {
        this.enemyAI.clearNonPlayerAggroTargets();
      }
      // Re-seed after clearNonPlayerAggroTargets so the wipe does not erase the duel focus.
      if (this.coopSunkenActive && this.coopSunkenRoomIndex === 3 && this.enemyAI) {
        let nemesis = null;
        let valkyrie = null;
        for (const e of this.enemies.values()) {
          if (!nemesis && e.type === 'nemesis') nemesis = e;
          else if (!valkyrie && e.type === 'valkyrie') valkyrie = e;
          if (nemesis && valkyrie) break;
        }
        if (nemesis && valkyrie) {
          this.enemyAI.seedSunkenTempleDuelAggro(nemesis.id, [valkyrie.id]);
        }
      }
      this.startEnemyAI();
    }
  }

  // Enemy types that should NOT get the flame summon spawn VFX:
  // bosses + terrain/trap enemies (tentacle-spine) + allies + training dummies.
  _isSummonVfxEligible(enemy) {
    if (!enemy || !enemy.type) return false;
    const NO_SUMMON_TYPES = new Set([
      'boss', 'boss2', 'boss3', 'destiny',
      'tentacle-spine',
      'training-dummy',
      'allied-knight', 'allied-healer', 'allied-tiger',
      'allied-wolf', 'allied-bear', 'allied-serpent', 'allied-spider',
    ]);
    if (NO_SUMMON_TYPES.has(enemy.type)) return false;
    if (enemy.isTrap) return false;
    return true;
  }

  // Broadcast the flame "summoned from the abyss" spawn VFX for a freshly spawned
  // enemy-room combatant. Skips bosses and terrain/trap enemies.
  _emitEnemySummonVfx(enemy) {
    if (!this.io || !this._isSummonVfxEligible(enemy)) return;
    const pos = enemy.position || { x: 0, y: 0, z: 0 };
    this.io.to(this.roomId).emit('enemy-summon-vfx', {
      enemyId: enemy.id,
      enemyType: enemy.type,
      position: { x: pos.x, y: pos.y ?? 0, z: pos.z },
      timestamp: Date.now(),
    });
  }

  // Enemy types that should NOT get the upward death-beam VFX:
  // allies, training dummies, player zombies, and tentacle-spine traps.
  _isDeathVortexEligible(enemy) {
    if (!enemy?.type) return false;
    const EXCLUDED = new Set(['training-dummy', 'player-zombie', 'vengeful-spirit', 'tentacle-spine']);
    if (EXCLUDED.has(enemy.type)) return false;
    if (enemy.alliedUnit === true) return false;
    return true;
  }

  /**
   * Colossus passive: if a hostile dies within 8 of a living colossus, schedule an identical respawn.
   * @returns {boolean} true when resurrection was scheduled (skip wave kill credit).
   */
  _tryScheduleColossusResurrection(enemy) {
    if (!enemy || !enemy.type || !enemy.position) return false;
    if (this.isAlliedUnitEnemy(enemy)) return false;
    if (COOP_BOSS_TYPES.has(enemy.type)) return false;
    const EXCLUDED = new Set([
      'training-dummy',
      'player-zombie',
      'vengeful-spirit',
      'tentacle-spine',
      'stone-giant',
      'eternal-oak',
      'colossus',
      'boss-skeleton',
    ]);
    if (EXCLUDED.has(enemy.type)) return false;
    if (enemy.isTrap) return false;

    const COLOSSI_AURA_RADIUS = 8;
    let colossusNearby = false;
    for (const other of this.enemies.values()) {
      if (!other || other.isDying || (other.health ?? 0) <= 0) continue;
      if (other.type !== 'colossus') continue;
      const dx = (other.position?.x ?? 0) - (enemy.position.x ?? 0);
      const dz = (other.position?.z ?? 0) - (enemy.position.z ?? 0);
      if (Math.hypot(dx, dz) <= COLOSSI_AURA_RADIUS) {
        colossusNearby = true;
        break;
      }
    }
    if (!colossusNearby) return false;

    const cloneType = enemy.type;
    const clonePos = {
      x: enemy.position.x,
      y: enemy.position.y ?? 0,
      z: enemy.position.z,
    };
    const campColor = String(enemy.campType || enemy.soulType || 'red').toLowerCase();
    const soulType = enemy.soulType || campColor;
    const campDef = GameRoom.CAMP_TYPES[campColor]
      || { color: campColor, knightSoulType: soulType, enemyPool: [] };
    // Prefer the dead unit's soulType for color-matched rebuilds.
    const campDefForBuild = {
      ...campDef,
      knightSoulType: soulType || campDef.knightSoulType,
    };

    this._scheduleTimeout(() => {
      if (!this.gameStarted || this.gameMode !== 'coop') return;
      // Colossus must still be alive for the resurrect to complete.
      let livingColossus = false;
      for (const other of this.enemies.values()) {
        if (!other || other.isDying || (other.health ?? 0) <= 0) continue;
        if (other.type !== 'colossus') continue;
        const dx = (other.position?.x ?? 0) - clonePos.x;
        const dz = (other.position?.z ?? 0) - clonePos.z;
        if (Math.hypot(dx, dz) <= COLOSSI_AURA_RADIUS) {
          livingColossus = true;
          break;
        }
      }
      if (!livingColossus) return;

      const slotIndex = Date.now() % 100000;
      const clone = this._buildEnemy(cloneType, 0, slotIndex, clonePos, campDefForBuild);
      this.enemies.set(clone.id, clone);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-spawned', { enemy: clone, timestamp: Date.now() });
      }
      console.log(`🏔️ Colossus resurrected ${cloneType} as ${clone.id}`);
    }, 2500);

    return true;
  }

  _emitEnemyDeathVortex(enemyId, enemy) {
    if (!this.io || !this._isDeathVortexEligible(enemy)) return;
    const pos = enemy.position || { x: 0, y: 0, z: 0 };
    this.io.to(this.roomId).emit('knight-death-vortex', {
      enemyId,
      position: { x: pos.x, y: pos.y ?? 0, z: pos.z },
      soulType: enemy.soulType || null,
      timestamp: Date.now(),
    });
  }

  // Build one enemy object at the given position for the given type/camp.
  _buildEnemy(type, campIndex, slotIndex, pos, campDef) {
    type = this._resolveSpawnEnemyType(type);
    // Post-boss difficulty scaling, keyed off how many bosses the party has killed.
    // Every kill adds +250 HP to all combatants (martyr & tentacle-spine excluded)
    // and bumps damage along a per-type tier table. Tier is clamped at 3 (3+ bosses).
    const tier = Math.min(this.coopBossesDefeatedCount || 0, 3);
    const hpBonus = 350 * tier;

    const SHADE_DAMAGE_BY_TIER   = [13, 18, 25, 33];
    const TEMPLAR_DAMAGE_BY_TIER = [48, 60, 78, 96];
    const VIPER_DAMAGE_BY_TIER   = [50, 65, 85, 95];

    const ts = Date.now();
    const base = {
      position: { x: pos.x, y: 0, z: pos.z },
      rotation: rotationYTowardEntry(pos.x, pos.z),
      isDying: false,
      campIndex,
      campType: campDef.color,
      staggerBuildup: 0,
    };

    if (type === 'knight') {
      let soulType = campDef.knightSoulType;
      if (this.coopIntroActive && soulType === 'blue') {
        const introKnightColors = ['red', 'green', 'purple'];
        soulType = introKnightColors[Math.floor(Math.random() * introKnightColors.length)];
      }
      const stats = KNIGHT_SOUL_STATS[soulType];
      return { id: `knight-${campIndex}-${slotIndex}-${ts}`, type: 'knight', ...base,
        health: stats.health + hpBonus, maxHealth: stats.maxHealth + hpBonus,
        damage: KNIGHT_DAMAGE_BY_TIER[soulType][tier],
        attackCooldown: stats.attackCooldown, moveSpeed: stats.moveSpeed, bossId: null, soulType };
    }
    if (type === 'shade') {
      return { id: `shade-${campIndex}-${slotIndex}-${ts}`, type: 'shade', ...base,
        health: 750 + hpBonus, maxHealth: 750 + hpBonus,
        damage: SHADE_DAMAGE_BY_TIER[tier], attackCooldown: 5500, moveSpeed: 2.0,
        soulType: campDef.knightSoulType };
    }
    if (type === 'warlock') {
      const isPurple = campDef.knightSoulType === 'purple';
      return { id: `warlock-${campIndex}-${slotIndex}-${ts}`, type: 'warlock', ...base,
        health: 800 + hpBonus, maxHealth: 800 + hpBonus, damage: 100,
        moveSpeed: isPurple ? 1.75 : 0,
        soulType: campDef.knightSoulType };
    }
    if (type === 'templar') {
      return { id: `templar-${campIndex}-${slotIndex}-${ts}`, type: 'templar', ...base,
        health: 1000 + hpBonus, maxHealth: 1000 + hpBonus,
        damage: TEMPLAR_DAMAGE_BY_TIER[tier], attackCooldown: 1600, moveSpeed: 3.5 };
    }
    if (type === 'weaver') {
      return { id: `weaver-${campIndex}-${slotIndex}-${ts}`, type: 'weaver', ...base,
        health: 700 + hpBonus, maxHealth: 700 + hpBonus, damage: 0, moveSpeed: 2.0,
        soulType: campDef.knightSoulType };
    }
    if (type === 'martyr') {
      // Excluded from HP scaling.
      return { id: `martyr-${campIndex}-${slotIndex}-${ts}`, type: 'martyr', ...base,
        health: 200, maxHealth: 175, damage: 0, moveSpeed: 3.0,
        soulType: campDef.knightSoulType };
    }
    if (type === 'wraith') {
      return { id: `wraith-${campIndex}-${slotIndex}-${ts}`, type: 'wraith', ...base,
        health: 800 + hpBonus, maxHealth: 800 + hpBonus,
        damage: 0, moveSpeed: 2.75, soulType: 'orange' };
    }
    if (type === 'titan') {
      // Excluded from HP scaling.
      const TITAN_STATS_BY_SOUL = {
        blue:   { health: 6160, maxHealth: 6160, damage: 134 },
        red:    { health: 6750, maxHealth: 6750, damage: 126 },
        green:  { health: 7200, maxHealth: 7200, damage: 112 },
        purple: { health: 6350, maxHealth: 6350, damage: 148 },
      };
      const soulType = this._resolveTitanSoulType(campDef);
      const stats = TITAN_STATS_BY_SOUL[soulType];
      return { id: `titan-${campIndex}-${slotIndex}-${ts}`, type: 'titan', ...base,
        health: stats.health, maxHealth: stats.maxHealth, damage: stats.damage,
        moveSpeed: 2.5, patrolSpeed: 1.5, attackCooldown: 2500,
        soulType, spawnedAt: ts };
    }
    if (type === 'boss') {
      // Mini-boss1 spawned inside a wave room — identical stats/AI to the real Boss1 encounter.
      return {
        id: `boss-wave-${campIndex}-${slotIndex}-${ts}`, type: 'boss', ...base,
        health: 5000 + hpBonus, maxHealth: 5000 + hpBonus, moveSpeed: 2.5,
        spawnedAt: ts, bossStationary: false, staggerBuildup: 0,
        waveRoomBoss: true,
      };
    }
    if (type === 'tentacle-spine') {
      // Excluded from HP scaling.
      return { id: `tentacle-spine-${campIndex}-${slotIndex}-${ts}`, type: 'tentacle-spine', ...base,
        health: 250, maxHealth: 250, damage: 0, moveSpeed: 0, isTrap: true };
    }
    if (type === 'spectre') {
      return { id: `spectre-${campIndex}-${slotIndex}-${ts}`, type: 'spectre', ...base,
        health: 2750 + hpBonus, maxHealth: 2750 + hpBonus,
        damage: 45, attackCooldown: 1600, moveSpeed: 2.75,
        soulType: campDef.knightSoulType, attackVariant: 1 };
    }
    if (type === 'death-knight') {
      return { id: `death-knight-${campIndex}-${slotIndex}-${ts}`, type: 'death-knight', ...base,
        health: 3150 + hpBonus, maxHealth: 3150 + hpBonus,
        damage: 49, attackCooldown: 1600, moveSpeed: 2.5,
        soulType: campDef.knightSoulType, attackVariant: 1, heartstrikeVariant: 1 };
    }
    if (type === 'shaman') {
      return { id: `shaman-${campIndex}-${slotIndex}-${ts}`, type: 'shaman', ...base,
        health: 2600 + hpBonus, maxHealth: 2600 + hpBonus,
        damage: 32, attackCooldown: 950, moveSpeed: 2.45,
        soulType: campDef.knightSoulType, attackVariant: 1 };
    }
    if (type === 'assassin') {
      return { id: `assassin-${campIndex}-${slotIndex}-${ts}`, type: 'assassin', ...base,
        health: 6200 + hpBonus, maxHealth: 6200 + hpBonus,
        damage: 0, attackCooldown: 5000, moveSpeed: 2.25,
        soulType: campDef.knightSoulType, spawnedAt: ts };
    }
    if (type === 'serpent') {
      return { id: `serpent-${campIndex}-${slotIndex}-${ts}`, type: 'serpent', ...base,
        health: 1270 + hpBonus, maxHealth: 1270 + hpBonus,
        damage: 17, attackCooldown: 1000, moveSpeed: 2.5,
        soulType: campDef.knightSoulType, attackVariant: 1 };
    }
    if (type === 'boss-serpent') {
      return { id: `boss-serpent-${campIndex}-${slotIndex}-${ts}`, type: 'boss-serpent', ...base,
        health: 2850 + hpBonus, maxHealth: 2850 + hpBonus,
        damage: 42, attackCooldown: 1000, moveSpeed: 2.5,
        soulType: campDef.knightSoulType, attackVariant: 1,
        visualScale: 1.4 };
    }
    if (type === 'frost-queen') {
      return { id: `frost-queen-${campIndex}-${slotIndex}-${ts}`, type: 'frost-queen', ...base,
        health: 6700 + hpBonus, maxHealth: 6700 + hpBonus,
        damage: 0, moveSpeed: 0,
        soulType: campDef.knightSoulType };
    }
    if (type === 'medusa') {
      return { id: `medusa-${campIndex}-${slotIndex}-${ts}`, type: 'medusa', ...base,
        health: 8350 + hpBonus, maxHealth: 8350 + hpBonus,
        damage: 0, moveSpeed: 0,
        soulType: campDef.knightSoulType, attackVariant: 1 };
    }
    if (type === 'wyvern') {
      return { id: `wyvern-${campIndex}-${slotIndex}-${ts}`, type: 'wyvern', ...base,
        health: 4660 + hpBonus, maxHealth: 4660 + hpBonus,
        damage: 42, attackCooldown: 1700, moveSpeed: 2.85,
        soulType: campDef.knightSoulType, attackVariant: 1, breathVariant: 1 };
    }
    if (type === 'terrorhawk') {
      return { id: `terrorhawk-${campIndex}-${slotIndex}-${ts}`, type: 'terrorhawk', ...base,
        health: 2300 + hpBonus, maxHealth: 2300 + hpBonus,
        damage: 37, attackCooldown: 1700, moveSpeed: 0,
        terrorhawkPhase: 'takeoff',
        soulType: campDef.knightSoulType, attackVariant: 1, spawnedAt: ts };
    }
    if (type === 'tiger') {
      return { id: `tiger-${campIndex}-${slotIndex}-${ts}`, type: 'tiger', ...base,
        health: 1200 + hpBonus, maxHealth: 1200 + hpBonus,
        damage: 23, attackCooldown: 850, moveSpeed: 1.75,
        soulType: campDef.knightSoulType, attackVariant: 1,
        tigerLocomotion: 'walk',
        wanderAnchor: { x: pos.x, z: pos.z },
        spawnedAt: ts };
    }
    if (type === 'boss-tiger') {
      return { id: `boss-tiger-${campIndex}-${slotIndex}-${ts}`, type: 'boss-tiger', ...base,
        health: 2650 + hpBonus, maxHealth: 2650 + hpBonus,
        damage: 38, attackCooldown: 850, moveSpeed: 1.75,
        soulType: campDef.knightSoulType, attackVariant: 1,
        tigerLocomotion: 'walk',
        pounceDamage: 38,
        visualScale: 1.4,
        wanderAnchor: { x: pos.x, z: pos.z },
        spawnedAt: ts };
    }
    if (type === 'wolf') {
      // Keep howl stagger in sync with WOLF_HOWL_* in enemyAI.js
      const howlStartsAt = ts + slotIndex * 200;
      return { id: `wolf-${campIndex}-${slotIndex}-${ts}`, type: 'wolf', ...base,
        health: 700 + hpBonus, maxHealth: 700 + hpBonus,
        damage: 14, attackCooldown: 850, moveSpeed: 3.1,
        soulType: campDef.knightSoulType, attackVariant: 1,
        howlStartsAt,
        howlEndsAt: howlStartsAt + 2000,
        spawnedAt: ts };
    }
    if (type === 'boss-wolf') {
      return { id: `boss-wolf-${campIndex}-${slotIndex}-${ts}`, type: 'boss-wolf', ...base,
        health: 1900 + hpBonus, maxHealth: 1900 + hpBonus,
        damage: 37, attackCooldown: 850, moveSpeed: 3.1,
        soulType: campDef.knightSoulType, attackVariant: 1,
        visualScale: 2.0,
        spawnedAt: ts };
    }
    if (type === 'bear') {
      return { id: `bear-${campIndex}-${slotIndex}-${ts}`, type: 'bear', ...base,
        health: 1750 + hpBonus, maxHealth: 1750 + hpBonus,
        damage: 46, attackCooldown: 1500, moveSpeed: 2.75,
        soulType: campDef.knightSoulType, attackVariant: 1,
        spawnedAt: ts };
    }
    if (type === 'boss-bear') {
      return { id: `boss-bear-${campIndex}-${slotIndex}-${ts}`, type: 'boss-bear', ...base,
        health: 3350 + hpBonus, maxHealth: 3350 + hpBonus,
        damage: 61, attackCooldown: 1500, moveSpeed: 2.25,
        soulType: campDef.knightSoulType, attackVariant: 1,
        visualScale: 1.4,
        spawnedAt: ts };
    }
    if (type === 'skyray') {
      return { id: `skyray-${campIndex}-${slotIndex}-${ts}`, type: 'skyray', ...base,
        health: 1450 + hpBonus, maxHealth: 1450 + hpBonus,
        damage: 27, attackCooldown: 1200, moveSpeed: 2.6,
        soulType: campDef.knightSoulType, attackVariant: 1, spawnedAt: ts };
    }
    if (type === 'bone-spider') {
      return { id: `bone-spider-${campIndex}-${slotIndex}-${ts}`, type: 'bone-spider', ...base,
        health: 4200 + hpBonus, maxHealth: 4200 + hpBonus,
        damage: 56, attackCooldown: 2100, moveSpeed: 2.5,
        soulType: campDef.knightSoulType, attackVariant: 1, spawnedAt: ts };
    }
    if (type === 'sentinel') {
      return { id: `sentinel-${campIndex}-${slotIndex}-${ts}`, type: 'sentinel', ...base,
        health: 1050 + hpBonus, maxHealth: 1050 + hpBonus,
        damage: 43, moveSpeed: 1.75, soulType: campDef.knightSoulType };
    }
    if (type === 'nemesis') {
      return { id: `nemesis-${campIndex}-${slotIndex}-${ts}`, type: 'nemesis', ...base,
        health: 3200 + hpBonus, maxHealth: 3200 + hpBonus,
        damage: 72, attackCooldown: 1250, moveSpeed: 2.5,
        soulType: campDef.knightSoulType, attackVariant: 1 };
    }
    if (type === 'stone-giant') {
      // Excluded from HP scaling — Eternity Palace elite.
      return { id: `stone-giant-${campIndex}-${slotIndex}-${ts}`, type: 'stone-giant', ...base,
        health: 7200, maxHealth: 7200, damage: 66, attackCooldown: 2900,
        moveSpeed: 2.25, patrolSpeed: 1.35, attackVariant: 1, spawnedAt: ts };
    }
    if (type === 'eternal-oak') {
      // Excluded from HP scaling — Eternity Palace elite.
      return { id: `eternal-oak-${campIndex}-${slotIndex}-${ts}`, type: 'eternal-oak', ...base,
        health: 8600, maxHealth: 8600, damage: 91, attackCooldown: 3300,
        moveSpeed: 2.0, patrolSpeed: 1.2, attackVariant: 1, spawnedAt: ts };
    }
    if (type === 'colossus') {
      // Excluded from HP scaling — Eternity Palace elite.
      return { id: `colossus-${campIndex}-${slotIndex}-${ts}`, type: 'colossus', ...base,
        health: 10520, maxHealth: 10520, damage: 111, attackCooldown: 2100,
        moveSpeed: 2.65, patrolSpeed: 1.59, attackVariant: 1, spawnedAt: ts };
    }
    if (type === 'valkyrie') {
      return { id: `valkyrie-${campIndex}-${slotIndex}-${ts}`, type: 'valkyrie', ...base,
        health: 2650 + hpBonus, maxHealth: 2650 + hpBonus,
        damage: 56, moveSpeed: 0.6, soulType: campDef.knightSoulType };
    }
    // viper
    return { id: `viper-${campIndex}-${slotIndex}-${ts}`, type: 'viper', ...base,
      health: 650 + hpBonus, maxHealth: 650 + hpBonus,
      damage: VIPER_DAMAGE_BY_TIER[tier], attackCooldown: 5000, moveSpeed: 2.0,
      spawnedAt: ts };
  }

  /**
   * Bonus/additive Greed enemy — fully independent of the tier-based kill-quota system.
   * Wanders aimlessly until it notices a player, then flees/casts a color-specific ability,
   * despawns after GREED_LIFETIME_MS if not killed, and never counts toward the room's kill quota.
   */
  _buildGreedEnemy(color, pos) {
    const ts = Date.now();
    return {
      id: `greed-${color}-${ts}`,
      type: 'greed',
      position: { x: pos.x, y: 0, z: pos.z },
      rotation: 0,
      isDying: false,
      health: 1500, maxHealth: 1500, damage: 0,
      moveSpeed: 2.75,
      soulType: color,
      spawnedAt: ts,
      expireAt: ts + GREED_LIFETIME_MS,
      staggerBuildup: 0,
    };
  }

  // Pick a random point inside an arena footprint, excluding certain zones.
  // Returns null if no valid position was found after MAX_ATTEMPTS.
  _randomMapPos(mapHalfX, mapHalfZ, exclusions, existing, minDistFromOthers, useHexInterior = false, hexApothem = null, circleRadius = null) {
    const MAX_ATTEMPTS = 120;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Uniform distribution within the axis-aligned rectangle.
      const x = (Math.random() * 2 - 1) * mapHalfX;
      const z = (Math.random() * 2 - 1) * mapHalfZ;

      const apothem = hexApothem ?? (useHexInterior ? HEX_INNER_APOTHEM : null);
      const inBounds = circleRadius != null
        ? isInsideCircleArenaFloor(x, z, circleRadius)
        : useHexInterior
          ? isInsideHexArenaFloor(x, z, apothem)
          : Math.abs(x) <= mapHalfX && Math.abs(z) <= mapHalfZ;
      if (!inBounds) continue;

      // Check exclusion zones
      if (exclusions.some(e => Math.hypot(x - e.x, z - e.z) < e.radius)) continue;

      // Check minimum distance from existing positions
      if (existing.some(p => Math.hypot(p.x - x, p.z - z) < minDistFromOthers)) continue;

      return { x, z };
    }
    return null;
  }

  // Generate enemy positions spread across the map with organic clustering:
  //   3 clusters of 3 units + (N − 9) lone units (e.g. N=10 → 3×3 + 1 loner)
  _generateScatteredPositions(total, useHexInterior = false) {
    const MAP_HALF_X = useHexInterior ? 18 : MAIN_MAP_HALF_X - MAIN_ARENA_SPAWN_INSET;
    const MAP_HALF_Z = useHexInterior ? 18 : MAIN_MAP_HALF_Z - MAIN_ARENA_SPAWN_INSET;
    const exclusions = [
      { x: COOP_MAIN_ENTRY_X, z: COOP_MAIN_ENTRY_Z, radius: COOP_PLAYER_START_CLEAR_RADIUS },
      {
        x: COOP_MAIN_COMBAT_PEDESTAL_X,
        z: COOP_MAIN_COMBAT_PEDESTAL_Z,
        radius: COOP_MAIN_COMBAT_INTERMISSION_CLEAR_RADIUS,
      },
    ];

    const NUM_CLUSTERS = 3;
    const CLUSTER_SIZE = 3;
    const NUM_LONERS = total - NUM_CLUSTERS * CLUSTER_SIZE;

    const positions = [];

    // ── Clusters ──────────────────────────────────────────────────────────────
    for (let c = 0; c < NUM_CLUSTERS; c++) {
      // Pick a cluster seed well away from other seeds (min 10 units apart)
      const seed = this._randomMapPos(MAP_HALF_X, MAP_HALF_Z, exclusions, positions, 10, useHexInterior);
      if (!seed) continue;
      positions.push(seed);

      // Place remaining cluster members within 5 units of the seed
      for (let m = 1; m < CLUSTER_SIZE; m++) {
        let placed = false;
        for (let attempt = 0; attempt < 60; attempt++) {
          const angle = Math.random() * Math.PI * 2;
          const r = 1.5 + Math.random() * 4.5; // 1.5–6 units from seed
          const mx = seed.x + Math.cos(angle) * r;
          const mz = seed.z + Math.sin(angle) * r;
          const inBounds = useHexInterior
            ? isInsideHexArenaFloor(mx, mz)
            : Math.abs(mx) <= MAP_HALF_X && Math.abs(mz) <= MAP_HALF_Z;
          if (!inBounds) continue;
          if (exclusions.some(e => Math.hypot(mx - e.x, mz - e.z) < e.radius)) continue;
          if (positions.some(p => Math.hypot(p.x - mx, p.z - mz) < 1.8)) continue;
          positions.push({ x: mx, z: mz });
          placed = true;
          break;
        }
        if (!placed) {
          let placed2 = false;
          for (let attempt = 0; attempt < 48; attempt++) {
            const ox = seed.x + (Math.random() - 0.5) * 3;
            const oz = seed.z + (Math.random() - 0.5) * 3;
            const ok = useHexInterior
              ? isInsideHexArenaFloor(ox, oz)
              : Math.abs(ox) <= MAP_HALF_X && Math.abs(oz) <= MAP_HALF_Z;
            if (!ok) continue;
            if (exclusions.some(e => Math.hypot(ox - e.x, oz - e.z) < e.radius)) continue;
            if (positions.some(p => Math.hypot(p.x - ox, p.z - oz) < 1.8)) continue;
            positions.push({ x: ox, z: oz });
            placed2 = true;
            break;
          }
          if (!placed2) positions.push({ x: seed.x, z: seed.z });
        }
      }
    }

    // ── Lone units ────────────────────────────────────────────────────────────
    for (let i = 0; i < NUM_LONERS; i++) {
      const pos = this._randomMapPos(MAP_HALF_X, MAP_HALF_Z, exclusions, positions, 4, useHexInterior);
      if (pos) positions.push(pos);
    }

    let pad = 0;
    while (positions.length < total && pad < 300) {
      pad += 1;
      const looser = this._randomMapPos(MAP_HALF_X, MAP_HALF_Z, exclusions, positions, 1.2, useHexInterior);
      if (looser) positions.push(looser);
    }
    while (positions.length < total) {
      positions.push({ x: 0, z: 2 });
    }

    return positions;
  }

  /**
   * Generate `count` spawn positions near the far north rim of the circular arena.
   * Enemies spawned here will march south toward players.
   * @param {number} count
   * @returns {Array<{x:number,z:number}>}
   */
  _generateEdgeSpawnPositions(count) {
    const farZ = MAIN_ARENA_HEX_RADIUS * 0.72;
    const positions = [];
    for (let i = 0; i < count; i++) {
      let x, z;
      let placed = false;
      for (let attempt = 0; attempt < 80; attempt++) {
        z = farZ - Math.random() * 2.5; // Inward from the north rim.
        const maxX = Math.max(3, maxCircleAbsXAtZ(z) - 1.5);
        x = (Math.random() * 2 - 1) * maxX;
        if (isInsideCircleArenaFloor(x, z) && !positions.some((p) => Math.hypot(p.x - x, p.z - z) < 2.5)) {
          placed = true;
          break;
        }
      }
      if (!placed) {
        // Fallback: evenly space along the edge
        const maxX = Math.max(3, maxCircleAbsXAtZ(farZ - 1) - 1.5);
        x = -maxX + (i / Math.max(count - 1, 1)) * maxX * 2;
        z = farZ - 1;
      }
      positions.push({ x, z });
    }
    return positions;
  }

  /**
   * 1–3 stationary trap enemies per co-op wave; avoids wave spawn points + entry zone.
   * @param {Array<{x:number,z:number}>} wavePositions
   * @param {object} campDef
   * @param {{ mapHalf?: number, entryPos?: {x:number,z:number}, entryClearRadius?: number, shape?: 'hex'|'circle', hexApothem?: number }} [opts]
   */
  _spawnTentacleSpinesForWave(wavePositions, campDef, opts = {}) {
    const mapHalf = opts.mapHalf ?? (MAIN_MAP_HALF_X - MAIN_ARENA_SPAWN_INSET);
    const entryPos = opts.entryPos ?? { x: COOP_MAIN_ENTRY_X, z: COOP_MAIN_ENTRY_Z };
    const entryClearRadius = opts.entryClearRadius ?? COOP_PLAYER_START_CLEAR_RADIUS;
    const shape = opts.shape ?? 'circle';
    const hexApothem = opts.hexApothem ?? null;
    const exclusions = [
      { x: entryPos.x, z: entryPos.z, radius: entryClearRadius },
    ];
    const n = 1 + Math.floor(Math.random() * 3);
    const existing = wavePositions.map((p) => ({ x: p.x, z: p.z }));
    const SLOT_BASE = 900;
    for (let i = 0; i < n; i++) {
      const pos = shape === 'hex'
        ? this._randomMapPos(mapHalf, mapHalf, exclusions, existing, 3.5, true, hexApothem)
        : this._randomMapPos(mapHalf, mapHalf, exclusions, existing, 3.5, false, null, MAIN_CIRCLE_INNER_RADIUS);
      if (!pos) continue;
      existing.push({ x: pos.x, z: pos.z });
      const enemy = this._buildEnemy('tentacle-spine', 0, SLOT_BASE + i, pos, campDef);
      this.enemies.set(enemy.id, enemy);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-spawned', { enemy, timestamp: Date.now() });
      }
    }
  }

  /** Pick a basic mob type from a camp pool, excluding non-counting ghoul summons and banned types. */
  _pickBasicUnitType(campDef, forceKnight = false) {
    if (forceKnight) return 'knight';
    let pool = campDef.enemyPool.filter((t) => t !== 'ghoul' && !this.bannedEnemyTypes.has(t));
    if (!pool.length) pool = ['knight'];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** Substitute banned enemy types at spawn time. */
  _resolveSpawnEnemyType(type) {
    const normalized = String(type || '').toLowerCase();
    if (!normalized || normalized === 'knight' || normalized === 'ghoul') return normalized || 'knight';
    if (this.bannedEnemyTypes.has(normalized)) return 'knight';
    return normalized;
  }

  /** Insert special required specs at random indices within the basic spec list. */
  _insertSpecsAtRandomIndices(basicSpecs, specialSpecs) {
    const queue = [...basicSpecs];
    for (const spec of specialSpecs) {
      const idx = Math.floor(Math.random() * (queue.length + 1));
      queue.splice(idx, 0, spec);
    }
    return queue;
  }

  /** Living basic mobs tagged as required queue entries (cap enforcement). */
  _countAliveBasics() {
    let n = 0;
    for (const e of this.enemies.values()) {
      if (e._coopRequiredBasic && !e.isDying && (e.health == null || e.health > 0)) {
        n++;
      }
    }
    return n;
  }

  /** Kill-gated soft cap: starts at 2 alive, +1 every 2 kills, max 4. */
  _coopBasicSoftCap() {
    return Math.min(
      COOP_WAVE_BASIC_ON_SCREEN_CAP,
      COOP_WAVE_INITIAL_ALIVE + Math.floor(this.skeletonKillCount / COOP_WAVE_SOFTCAP_KILLS_PER_STEP),
    );
  }

  /** Index of the next queue spec eligible to spawn, or -1 if none. */
  _nextEligibleSpecIndex() {
    const aliveBasics = this._countAliveBasics();
    const softCap = this._coopBasicSoftCap();
    for (let i = 0; i < this.coopRequiredQueue.length; i++) {
      const spec = this.coopRequiredQueue[i];
      if (spec.kind === 'titan' || spec.kind === 'boss1' || spec.kind === 'valkyrie' || spec.kind === 'nemesis') return i;
      if (spec.kind === 'basic' && aliveBasics < softCap) return i;
    }
    return -1;
  }

  /** Spawn one pre-planned required enemy and notify clients. */
  _spawnRequiredSpec(spec) {
    const enemy = this._buildEnemy(spec.unitType, 0, spec.slotIndex, spec.pos, spec.campDef);
    if (spec.kind === 'basic') {
      enemy._coopRequiredBasic = true;
    }
    if (this.enemyAI && enemy.type !== 'titan' && enemy.type !== 'valkyrie') {
      this.enemyAI.forceAggroOnEnemy(enemy);
    }
    this.enemies.set(enemy.id, enemy);
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-spawned', { enemy, timestamp: Date.now() });
      this._emitEnemySummonVfx(enemy);
    }
    this.startEnemyAI();
    console.log(`⚔️ Co-op required spawn: ${spec.unitType} (${spec.kind}, slot ${spec.slotIndex})`);
  }

  /**
   * Event-driven staggered spawner: releases one eligible spec per stagger interval.
   * Basics respect the kill-gated soft cap; titans and Boss1 spawn on top.
   * @param {number} [staggerMs=COOP_WAVE_SPAWN_STAGGER_MS]
   */
  _pumpCoopSpawns(staggerMs = COOP_WAVE_SPAWN_STAGGER_MS) {
    if (this.gameMode !== 'coop' || !this.combatArenaActive || this.bossSpawned) return;
    if (this._coopSpawnChainTimer != null) return;

    const idx = this._nextEligibleSpecIndex();
    if (idx < 0) return;

    const [spec] = this.coopRequiredQueue.splice(idx, 1);
    this._spawnRequiredSpec(spec);

    if (this.coopRequiredQueue.length === 0) return;

    this._coopSpawnChainTimer = this._scheduleTimeout(() => {
      this._coopSpawnChainTimer = null;
      this._pumpCoopSpawns(staggerMs);
    }, staggerMs);
  }

  /**
   * Elite quota by boss-defeat tier (shared by Titan / post-Sunken Valkyrie / Nemesis):
   *   count 1 — colored rooms: 0 or 1 (25% chance) when minBossCount <= 1
   *   count 2 — colored rooms: 0 or 1 (40% chance, hard cap 1)
   *   count 3+ — colored + mixed rooms (mixed only when coloredOnly is false): 1–2 (capped by maxQuota)
   * @param {string} roomKind
   * @param {{ requireSunken?: boolean, coloredOnly?: boolean, minBossCount?: number, maxQuota?: number }} [options]
   */
  _computeEliteRoomQuotaByTier(roomKind, options = {}) {
    const {
      requireSunken = false,
      coloredOnly = false,
      minBossCount = 1,
      maxQuota,
    } = options;
    if (requireSunken && !this.coopSunkenCompleted) return 0;

    const count = this.coopBossesDefeatedCount;
    const isMixed = roomKind === 'stat' || roomKind === 'trial';
    const isColored = COOP_COLORED_ROOM_TYPES.includes(roomKind);
    if (count < minBossCount) return 0;

    let quota = 0;
    if (count >= 3) {
      if (coloredOnly) quota = isColored ? 1 + Math.floor(Math.random() * 2) : 0;
      else quota = (isColored || isMixed) ? 1 + Math.floor(Math.random() * 2) : 0;
    } else if (count === 2 && isColored) {
      quota = Math.random() < COOP_WAVE_TITAN_ROOM_CHANCE_AFTER_BOSS2 ? 1 : 0;
    } else if (count === 1 && isColored) {
      quota = Math.random() < COOP_WAVE_TITAN_ROOM_CHANCE ? 1 : 0;
    }

    if (typeof maxQuota === 'number') {
      quota = Math.min(quota, maxQuota);
    }
    return quota;
  }

  _computeRoomTitanQuota(roomKind) {
    return this._computeEliteRoomQuotaByTier(roomKind, { minBossCount: 2 });
  }

  _computeRoomValkyrieQuota(roomKind) {
    return this._computeEliteRoomQuotaByTier(roomKind, {
      requireSunken: true,
      coloredOnly: true,
      minBossCount: 2,
      maxQuota: 1,
    });
  }

  _computeRoomNemesisQuota(roomKind) {
    return this._computeEliteRoomQuotaByTier(roomKind, {
      requireSunken: true,
      coloredOnly: true,
      minBossCount: 1,
    });
  }

  /**
   * Spawn the initial wave of enemies for the current room.
   *
   * Colored rooms edge-spawn basics from the far north; mixed rooms scatter.
   * A unified required queue (basics + titans + Boss1) releases one enemy at a time,
   * with kill-gated soft cap on living basics. Martyr/greed/ghoul are additive bonuses.
   */
  initializeEnemies() {
    this.coopWaveSpawnPlan = null;
    this.coopRequiredQueue = [];
    this.coopWaveQuota = 0;
    this._coopSpawnChainTimer = null;
    this.roomTitanQuota = 0;
    this.roomHasTitans = false;
    this.roomTitanSlotIndices = new Set();
    this.roomValkyrieQuota = 0;
    this.roomNemesisQuota = 0;
    this.roomHasMiniBoss1 = false;
    this.miniBoss1SpawnedThisRoom = false;

    const campTypeKeys = COOP_COLORED_ROOM_TYPES;
    let typeKey = this.pendingCoopArchetype;
    const roomKind = this.pendingCoopRoomKind || this.currentCoopRoomKind || typeKey;
    this.pendingCoopArchetype = null;
    this.pendingCoopRoomKind = null;
    const isMixedRoom = roomKind === 'stat' || roomKind === 'trial';
    if (!typeKey || !GameRoom.CAMP_TYPES[typeKey]) {
      typeKey = campTypeKeys[Math.floor(Math.random() * campTypeKeys.length)];
    }
    const campDef = GameRoom.CAMP_TYPES[typeKey];

    this.sessionCampTypes = isMixedRoom ? [roomKind] : [typeKey];
    this.lastCoopWaveCampColor = typeKey;
    this.currentCoopRoomKind = roomKind || typeKey;

    const quota = this._getCoopWaveQuota();
    this.coopWaveQuota = quota;
    const titanQuota = this._computeRoomTitanQuota(roomKind);
    const valkyrieQuota = this._computeRoomValkyrieQuota(roomKind);
    const nemesisQuota = this._computeRoomNemesisQuota(roomKind);
    this.roomTitanQuota = titanQuota;
    this.roomValkyrieQuota = valkyrieQuota;
    this.roomNemesisQuota = nemesisQuota;
    this.roomHasTitans = titanQuota > 0;
    this.roomHasWraith = !this.bannedEnemyTypes.has('wraith')
      && Math.random() < COOP_WAVE_WRAITH_ROOM_CHANCE;

    if (isMixedRoom) {
      this.roomHasMartyrs = false;
      this.roomHasMiniBoss1 = false;
    } else {
      this.roomHasMartyrs = !this.bannedEnemyTypes.has('martyr')
        && Math.random() < COOP_WAVE_MARTYR_ROOM_CHANCE;
      this.roomHasMiniBoss1 = this.coopBossesDefeatedCount >= 2
        && Math.random() < COOP_WAVE_BOSS1_ROOM_CHANCE;
    }

    const boss1Count = this.roomHasMiniBoss1 ? 1 : 0;
    const basicCount = Math.max(1, quota - titanQuota - valkyrieQuota - nemesisQuota - boss1Count);
    const basicSpecs = [];

    if (isMixedRoom) {
      const positions = this._generateScatteredPositions(basicCount, true);
      if (roomKind === 'trial') {
        const TRIAL_RECIPES = [
          () => Array.from({ length: basicCount }, (_, i) => ({
            unitType: 'knight',
            campDef: GameRoom.CAMP_TYPES[campTypeKeys[Math.floor(Math.random() * campTypeKeys.length)]],
            pos: positions[i],
          })),
          () => Array.from({ length: basicCount }, (_, i) => ({
            unitType: 'shade',
            campDef: GameRoom.CAMP_TYPES[campTypeKeys[i % campTypeKeys.length]],
            pos: positions[i],
          })),
          () => Array.from({ length: basicCount }, (_, i) => ({
            unitType: 'viper',
            campDef: GameRoom.CAMP_TYPES[i % 2 === 0 ? 'blue' : 'green'],
            pos: positions[i],
          })),
          () => Array.from({ length: basicCount }, (_, i) => ({
            unitType: 'warlock',
            campDef: GameRoom.CAMP_TYPES[i < Math.ceil(basicCount / 2) ? 'purple' : 'red'],
            pos: positions[i],
          })),
          () => Array.from({ length: basicCount }, (_, i) => ({
            unitType: 'weaver',
            campDef: GameRoom.CAMP_TYPES[i < Math.ceil(basicCount / 2) ? 'green' : 'blue'],
            pos: positions[i],
          })),
          () => Array.from({ length: basicCount }, (_, i) => ({
            unitType: 'templar',
            campDef: GameRoom.CAMP_TYPES[i % 2 === 0 ? 'red' : 'purple'],
            pos: positions[i],
          })),
        ];
        const recipe = TRIAL_RECIPES[Math.floor(Math.random() * TRIAL_RECIPES.length)];
        recipe().forEach((e, i) => {
          basicSpecs.push({
            kind: 'basic',
            unitType: e.unitType,
            pos: e.pos,
            campDef: e.campDef,
            slotIndex: i,
          });
        });
      } else {
        for (let slotIndex = 0; slotIndex < basicCount; slotIndex++) {
          const pos = positions[slotIndex];
          const slotTypeKey = campTypeKeys[Math.floor(Math.random() * campTypeKeys.length)];
          const slotCampDef = GameRoom.CAMP_TYPES[slotTypeKey];
          const unitType = slotIndex === 0 ? 'knight' : this._pickBasicUnitType(slotCampDef);
          basicSpecs.push({
            kind: 'basic',
            unitType,
            pos,
            campDef: slotCampDef,
            slotIndex,
          });
        }
      }
      this.coopWaveSpawnPlan = { campDef, isMixed: true };

      const spinePositions = basicSpecs.map((s) => s.pos);
      const spineCamp = GameRoom.CAMP_TYPES[this._pickRandomCampColor()];
      this._spawnTentacleSpinesForWave(spinePositions, spineCamp, {
        mapHalf: HEX_ARENA_RADIUS - MAIN_ARENA_SPAWN_INSET,
        entryPos: { x: COOP_MAIN_ENTRY_X, z: COOP_MAIN_ENTRY_Z },
        entryClearRadius: COOP_PLAYER_START_CLEAR_RADIUS,
        shape: 'hex',
        hexApothem: HEX_INNER_APOTHEM,
      });
    } else {
      const positions = this._generateEdgeSpawnPositions(basicCount);
      for (let i = 0; i < basicCount; i++) {
        basicSpecs.push({
          kind: 'basic',
          unitType: this._pickBasicUnitType(campDef, i === 0),
          pos: positions[i] || { x: 0, z: MAIN_ARENA_HEX_RADIUS * 0.68 },
          campDef,
          slotIndex: i,
        });
      }
      this.coopWaveSpawnPlan = { campDef, isMixed: false };
    }

    const specialSpecs = [];
    let specialSlotOffset = basicCount;
    const appendEliteSpecs = (kind, unitType, eliteQuota) => {
      if (eliteQuota <= 0) return;
      const positions = isMixedRoom
        ? this._generateScatteredPositions(eliteQuota, true)
        : this._generateEdgeSpawnPositions(eliteQuota);
      for (let i = 0; i < eliteQuota; i++) {
        specialSpecs.push({
          kind,
          unitType,
          pos: positions[i] || { x: 0, z: MAIN_ARENA_HEX_RADIUS * 0.68 },
          campDef,
          slotIndex: specialSlotOffset + i,
        });
      }
      specialSlotOffset += eliteQuota;
    };
    appendEliteSpecs('titan', 'titan', titanQuota);
    appendEliteSpecs('valkyrie', 'valkyrie', valkyrieQuota);
    appendEliteSpecs('nemesis', 'nemesis', nemesisQuota);
    if (boss1Count > 0) {
      const bossPos = isMixedRoom
        ? this._generateScatteredPositions(1, true)[0]
        : this._generateEdgeSpawnPositions(1)[0];
      if (bossPos) {
        specialSpecs.push({
          kind: 'boss1',
          unitType: 'boss',
          pos: bossPos,
          campDef,
          slotIndex: specialSlotOffset,
        });
      }
    }

    this.coopRequiredQueue = this._insertSpecsAtRandomIndices(basicSpecs, specialSpecs);
    this.coopRequiredQueue.forEach((spec, i) => { spec.slotIndex = i; });

    console.log(
      `⚔️ Co-op room wave: quota=${quota}, basics=${basicCount}, titans=${titanQuota}, ` +
      `valkyries=${valkyrieQuota}, nemeses=${nemesisQuota}, boss1=${boss1Count}, ` +
      `martyrs=${this.roomHasMartyrs}, room=${this.currentCoopRoomKind}`,
    );

    if (this.io) {
      this.io.to(this.roomId).emit('skeleton-kill-count-updated', {
        skeletonKillCount: 0,
        required: quota,
        timestamp: Date.now(),
      });
    }

    this._pumpCoopSpawns();

    this._maybeSpawnMartyrBonusEnemies(isMixedRoom);
    this._maybeSpawnGreedBonusEnemy(isMixedRoom);
    this._maybeSpawnWraithBonusEnemy(isMixedRoom);

    if (this.io) {
      this.io.to(this.roomId).emit('camps-initialized', {
        campTypes: this.sessionCampTypes,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        timestamp: Date.now(),
      });
    }
  }

  /** Spawn a bonus Greed at `pos` and notify clients. */
  _spawnGreedBonusAtPos(color, pos) {
    const enemy = this._buildGreedEnemy(color, pos);
    this.enemies.set(enemy.id, enemy);
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-spawned', { enemy, timestamp: Date.now() });
    }
    console.log(`💰 Greed (${color}) bonus enemy spawned in room: ${this.currentCoopRoomKind}`);
    this.startEnemyAI();
    return enemy;
  }

  /**
   * 20% chance, on every countable combat room's wave init (colored + mixed alike), to spawn a
   * bonus Greed enemy — fully additive to the tier-based kill quota, same pattern as
   * tentacle-spine. No forced aggro: Greed starts passive/wandering like Titan.
   */
  _maybeSpawnGreedBonusEnemy(isMixedRoom) {
    if (!this._isCountableCoopCombatRoom(this.currentCoopRoomKind)) return;
    if (Math.random() >= COOP_WAVE_GREED_SPAWN_CHANCE) return;

    const color = GREED_COLORS[Math.floor(Math.random() * GREED_COLORS.length)];
    const pos = this._generateScatteredPositions(1, isMixedRoom)[0];
    if (!pos) return;

    this._spawnGreedBonusAtPos(color, pos);
  }

  /** Spawn 1–2 additive martyr bonus enemies in colored rooms (never counts toward quota). */
  _maybeSpawnMartyrBonusEnemies(isMixedRoom) {
    if (this.bannedEnemyTypes.has('martyr')) return;
    if (isMixedRoom || !this.roomHasMartyrs) return;
    if (!this._isCountableCoopCombatRoom(this.currentCoopRoomKind)) return;

    const campDef = this.coopWaveSpawnPlan?.campDef;
    if (!campDef) return;

    const count = 1 + Math.floor(Math.random() * 2);
    const positions = this._generateScatteredPositions(count, false);
    let spawned = 0;
    for (let i = 0; i < count; i++) {
      const pos = positions[i];
      if (!pos) continue;
      const enemy = this._buildEnemy('martyr', 0, 800 + i, pos, campDef);
      this.enemies.set(enemy.id, enemy);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-spawned', { enemy, timestamp: Date.now() });
        this._emitEnemySummonVfx(enemy);
      }
      spawned++;
    }
    if (spawned > 0) {
      console.log(`💣 Martyr bonus: spawned ${spawned} in room ${this.currentCoopRoomKind}`);
      this.startEnemyAI();
    }
  }

  /** Spawn 1–2 additive wraith bonus enemies in countable combat rooms (never counts toward quota). */
  _maybeSpawnWraithBonusEnemy(isMixedRoom) {
    if (this.bannedEnemyTypes.has('wraith')) return;
    if (!this.roomHasWraith) return;
    if (!this._isCountableCoopCombatRoom(this.currentCoopRoomKind)) return;

    let campDef = this.coopWaveSpawnPlan?.campDef;
    if (!campDef) {
      const keys = Object.keys(GameRoom.CAMP_TYPES);
      campDef = GameRoom.CAMP_TYPES[keys[Math.floor(Math.random() * keys.length)]];
    }

    const count = 1 + Math.floor(Math.random() * 2);
    const positions = this._generateScatteredPositions(count, isMixedRoom);
    let spawned = 0;
    for (let i = 0; i < count; i++) {
      const pos = positions[i];
      if (!pos) continue;
      const enemy = this._buildEnemy('wraith', 0, 900 + i, pos, campDef);
      this.enemies.set(enemy.id, enemy);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-spawned', { enemy, timestamp: Date.now() });
        this._emitEnemySummonVfx(enemy);
      }
      spawned++;
    }
    if (spawned > 0) {
      console.log(`👻 Wraith bonus: spawned ${spawned} in room ${this.currentCoopRoomKind}`);
      this.startEnemyAI();
    }
  }

  /** 20% chance to spawn a bonus Greed in the pink merchant hex arena (non-countable room). */
  _maybeSpawnGreedInMerchantRoom() {
    if (this.currentCoopRoomKind !== 'merchant') return;
    if (Math.random() >= COOP_WAVE_GREED_SPAWN_CHANCE) return;

    const color = GREED_COLORS[Math.floor(Math.random() * GREED_COLORS.length)];
    const pos = this._generateScatteredPositions(1, true)[0];
    if (!pos) return;

    this._spawnGreedBonusAtPos(color, pos);
  }

  spawnEnemy(type) {
    // This function is deprecated - use spawnBoss() instead for co-op mode
    return null;
  }

  getEnemyMaxHealth(type) {
    if (COOP_BOSS_TYPES.has(type)) {
      return this.getCoopBossMaxHealth(type);
    }
    return 5000;
  }

  generateRandomPosition() {
    // Not used for boss (boss always spawns at center)
    // Kept for compatibility but returns center position
    return { x: 0, y: 0, z: 0 };
  }

  /**
   * Wyvern Talons: instant remaining Concentrated Venom + optional Cobra venom remainder (client) as one hit.
   * Clears server CV. Cobra cap matches Wyvern Sting intellect-scaled venom (29 + 3×Intellect DPS × 6s; ~50 Intellect ceiling).
   */
  detonateWyvernConcentratedVenom(enemyId, fromPlayerId, cobraRemainingRaw = 0) {
    const WYVERN_COBRA_VENOM_MAX_BURST = (29 + 3 * 50) * 6;
    let cobraRemaining = Math.max(0, Math.floor(Number(cobraRemainingRaw) || 0));
    cobraRemaining = Math.min(cobraRemaining, WYVERN_COBRA_VENOM_MAX_BURST);

    const enemy = this.enemies.get(enemyId);
    if (!enemy || enemy.isDying) return;

    const now = Date.now();
    const wyvernVenomDpsPerStack = 31;
    let cvDamage = 0;
    const stacks = enemy.concentratedVenomStacks || 0;
    const cvLastPlayerId = enemy.concentratedVenomLastPlayerId;

    if (stacks > 0) {
      if (!enemy.concentratedVenomExpireAt || now >= enemy.concentratedVenomExpireAt) {
        if (enemy._concentratedVenomIntervalId) {
          clearInterval(enemy._concentratedVenomIntervalId);
          enemy._concentratedVenomIntervalId = null;
        }
        enemy.concentratedVenomStacks = 0;
        enemy.concentratedVenomExpireAt = null;
      } else {
        const remainingSec = (enemy.concentratedVenomExpireAt - now) / 1000;
        if (remainingSec > 0) {
          cvDamage = Math.max(0, Math.floor(remainingSec * stacks * wyvernVenomDpsPerStack));
        }
        if (enemy._concentratedVenomIntervalId) {
          clearInterval(enemy._concentratedVenomIntervalId);
          enemy._concentratedVenomIntervalId = null;
        }
        enemy.concentratedVenomStacks = 0;
        enemy.concentratedVenomExpireAt = null;
      }
      this._maybeBroadcastConcentratedVenom(enemyId, 0, null);
    }

    const total = cvDamage + cobraRemaining;
    if (total <= 0) return;

    const sourceId = cobraRemaining > 0 ? fromPlayerId : (cvLastPlayerId || fromPlayerId);
    const tickPlayer = this.players.get(sourceId);
    this.damageEnemy(enemyId, total, sourceId, tickPlayer || null, {
      damageType: 'wyvern_talons_detonate',
      wyvernTalonsZombie: true,
    });
  }

  applyEntanglementOnHit(enemyId, fromPlayerId, player, options = {}) {
    const enemy = this.enemies.get(enemyId);
    if (!enemy || enemy.isDying || enemy.health <= 0) return;

    const sourceAlliedUnitId = options.sourceAlliedUnitId || null;
    const entangleTheme = options.entangleTheme || null;

    this.applyStatusEffect(enemyId, 'entangle', ENTANGLEMENT_DURATION_MS);
    enemy.entanglementExpireAt = Date.now() + ENTANGLEMENT_DURATION_MS;
    enemy.entanglementLastPlayerId = fromPlayerId;
    enemy.entanglementSourceAlliedUnitId = sourceAlliedUnitId;
    enemy.entanglementTheme = entangleTheme;
    enemy.entanglementTicksRemaining = Math.ceil(ENTANGLEMENT_DURATION_MS / 1000);

    if (enemy._entanglementIntervalId) {
      clearInterval(enemy._entanglementIntervalId);
      enemy._entanglementIntervalId = null;
    }

    enemy._entanglementIntervalId = setInterval(() => {
      const e = this.enemies.get(enemyId);
      if (!e || e.isDying || e.health <= 0) {
        if (e && e._entanglementIntervalId) {
          clearInterval(e._entanglementIntervalId);
          e._entanglementIntervalId = null;
        }
        return;
      }

      if (!e.entanglementTicksRemaining || e.entanglementTicksRemaining <= 0) {
        clearInterval(e._entanglementIntervalId);
        e._entanglementIntervalId = null;
        return;
      }

      const tickPlayerId = e.entanglementLastPlayerId || fromPlayerId;
      const tickPlayer = this.players.get(tickPlayerId) || player || null;
      e.entanglementTicksRemaining -= 1;
      const tickDamageType = e.entanglementTheme === 'spider'
        ? 'allied_spider_entanglement'
        : (e.entanglementSourceAlliedUnitId
          ? 'allied_enchantress_entanglement'
          : 'entanglement');
      this.damageEnemy(enemyId, ENTANGLEMENT_DAMAGE_PER_SECOND, tickPlayerId, tickPlayer, {
        damageType: tickDamageType,
        sourceAlliedUnitId: e.entanglementSourceAlliedUnitId || undefined,
      });
    }, 1000);

    this._tryHellfireVenomIgnite(enemyId, fromPlayerId, player);
  }

  /**
   * Co-op allied units only — horizontal disk vs center xz (enemy mob AOEs).
   * @returns first damageEnemy result or null if no ally is hit.
   */
  tryDamageAlliedKnightInXZDisk(center, radius, damage, hitMeta = null) {
    if (!center || radius <= 0 || damage <= 0 || !this.enemies) return null;
    const cx = center.x ?? 0;
    const cz = center.z ?? 0;
    const r2 = radius * radius;
    const excludeId = hitMeta?.excludeEnemyId ?? null;
    const damageMeta = hitMeta
      ? (() => {
          const { excludeEnemyId: _exclude, ...rest } = hitMeta;
          return rest;
        })()
      : null;
    const src = hitMeta?.sourceEnemyId
      ? (this.getEnemy?.(hitMeta.sourceEnemyId) || this.enemies.get(hitMeta.sourceEnemyId))
      : null;
    const scaled = this.enemyAI?.scaleDamageVsAlly?.(src, damage) ?? damage;
    let firstResult = null;
    for (const ally of this.enemies.values()) {
      if (!this.isAlliedUnitEnemy(ally) || ally.isDying || ally.health <= 0) continue;
      if (excludeId && ally.id === excludeId) continue;
      const ax = ally.position?.x ?? 0;
      const az = ally.position?.z ?? 0;
      const dx = ax - cx;
      const dz = az - cz;
      if (dx * dx + dz * dz > r2) continue;
      const result = this.damageEnemy(ally.id, scaled, null, null, damageMeta);
      if (!firstResult) firstResult = result;
    }
    return firstResult;
  }

  /**
   * Co-op allied units only — horizontal cone from origin along facingAngle.
   * @returns number of allies hit
   */
  tryDamageAlliedUnitsInCone(originX, originZ, facingAngle, range, halfAngleRad, damage, hitMeta = null) {
    if (!this.enemies || range <= 0 || halfAngleRad <= 0 || damage <= 0) return 0;

    const fwdX = Math.sin(facingAngle);
    const fwdZ = Math.cos(facingAngle);
    const cosHalf = Math.cos(halfAngleRad);
    let hitCount = 0;

    for (const ally of this.enemies.values()) {
      if (!this.isAlliedUnitEnemy(ally) || ally.isDying || ally.health <= 0) continue;
      const ax = ally.position?.x ?? 0;
      const az = ally.position?.z ?? 0;
      const dx = ax - originX;
      const dz = az - originZ;
      const dist = Math.hypot(dx, dz);
      if (dist <= 0 || dist > range) continue;

      const dot = (dx * fwdX + dz * fwdZ) / dist;
      if (dot < cosHalf) continue;

      const result = this.damageEnemy(ally.id, damage, null, null, hitMeta);
      if (result) hitCount += 1;
    }
    return hitCount;
  }

  /** Track Explosive Talons cast origin for end-of-range detonation validation. */
  recordExplosiveTalonsCast(playerId, position, direction) {
    if (!playerId || !position) return;
    let dx = direction?.x ?? 0;
    let dz = direction?.z ?? 0;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) return;
    dx /= len;
    dz /= len;
    this.explosiveTalonsCastByPlayer.set(playerId, {
      endX: position.x + dx * EXPLOSIVE_TALONS_MAX_TRAVEL,
      endZ: position.z + dz * EXPLOSIVE_TALONS_MAX_TRAVEL,
      castAt: Date.now(),
    });
  }

  /** Reject explosion hits outside detonation radius or without a recent Explosive Talons cast. */
  validateExplosiveTalonsExplosionHit(fromPlayerId, enemyId) {
    const cast = this.explosiveTalonsCastByPlayer.get(fromPlayerId);
    if (!cast) return false;
    if (Date.now() - cast.castAt > EXPLOSIVE_TALONS_CAST_TTL_MS) return false;
    const enemy = this.enemies.get(enemyId);
    if (!enemy) return false;
    const horiz = Math.hypot(
      (enemy.position?.x ?? 0) - cast.endX,
      (enemy.position?.z ?? 0) - cast.endZ,
    );
    return horiz <= EXPLOSIVE_TALONS_EXPLOSION_RADIUS + EXPLOSIVE_TALONS_RADIUS_TOLERANCE;
  }

  damageEnemy(enemyId, damage, fromPlayerId, player = null, hitMeta = null) {
    const enemy = this.enemies.get(enemyId);
    if (!enemy || enemy.isDying) {
      // Silently reject damage to dying/dead enemies (prevents spam)
      return null;
    }

    if (
      enemy.type === 'knight' &&
      hitMeta?.damageType !== 'ignite' &&
      hitMeta?.damageType !== 'shadowflame' &&
      hitMeta?.damageType !== 'venom' &&
      this.enemyAI?.isKnightBlocking(enemyId)
    ) {
      return null;
    }

    if (
      enemy.type === 'medusa' &&
      this.enemyAI?.isMedusaVoidWarping(enemyId)
    ) {
      return null;
    }

    if (
      hitMeta?.explosiveTalonsDetonation &&
      fromPlayerId &&
      !this.validateExplosiveTalonsExplosionHit(fromPlayerId, enemyId)
    ) {
      return null;
    }

    let appliedDamage = damage;
    if (
      hitMeta &&
      hitMeta.frostTotemChill &&
      hitMeta.damageType === 'entropic' &&
      this.isEnemyAffectedBy(enemyId, 'freeze')
    ) {
      appliedDamage = Math.floor(appliedDamage * 2);
    }
    if (
      hitMeta &&
      hitMeta.glacialTalons &&
      hitMeta.damageType === 'reaping_talons' &&
      this.isEnemyAffectedBy(enemyId, 'freeze')
    ) {
      appliedDamage = Math.floor(appliedDamage * 2);
    }

    // Player-summoned zombies are allies — no player-sourced damage
    if (enemy.type === 'player-zombie' && fromPlayerId) {
      return null;
    }
    // Vengeful Spirits are fully untargetable (players, mobs, environment)
    if (enemy.type === 'vengeful-spirit') {
      return null;
    }
    if (this.isAlliedUnitEnemy(enemy) && fromPlayerId) {
      return null;
    }

    const previousHealth = enemy.health;
    enemy.health = Math.max(0, enemy.health - appliedDamage);

    if (appliedDamage > 0) {
      enemy.lastDamageAt = Date.now();
      if (
        enemy.type === 'training-dummy' &&
        fromPlayerId &&
        !(hitMeta && hitMeta.sourceAlliedUnitId)
      ) {
        this.throneDummyPlayerHitAt.set(fromPlayerId, Date.now());
      }
      if (enemy.type === 'wraith' && this.enemyAI?.revealWraithStealth) {
        this.enemyAI.revealWraithStealth(enemy.id, 'damage');
      }
      if (enemy.type === 'assassin' && this.enemyAI?.revealAssassinDreamshroud) {
        this.enemyAI.revealAssassinDreamshroud(enemy.id, 'damage');
      }
    }

    if ((enemy.type === 'training-dummy' || enemy.throneTestEnemy) && enemy.health <= 0) {
      enemy.health = enemy.maxHealth;
    }

    if (enemy.type === 'titan' && this.enemyAI && enemy.health > 0 && !enemy.isDying) {
      this.enemyAI.titanMaybeStartBladestorm(enemy);
    }

    // Track damage for aggro system
    if (this.enemyAI) {
      if (COOP_BOSS_TYPES.has(enemy.type)) {
        if (fromPlayerId) {
          this.enemyAI.trackBossDamage(enemyId, fromPlayerId, appliedDamage, player);
        }
      } else if (enemy.type !== 'training-dummy' && !enemy.throneTestEnemy && enemy.type !== 'tentacle-spine') {
        let aggroAmount = appliedDamage;
        if (player && player.isStealthing) {
          aggroAmount *= 10.0; // Same 10x multiplier as bosses
          if (process.env.NODE_ENV !== 'production') {
            console.log(`👤 Stealth aggro bonus: Player ${fromPlayerId} stealth attack on enemy ${enemyId} (${appliedDamage} -> ${aggroAmount} aggro)`);
          }
        }
        if (hitMeta && hitMeta.sourceAlliedUnitId) {
          this.enemyAI.applyAlliedUnitThreat(enemyId, hitMeta.sourceAlliedUnitId, aggroAmount);
        } else if (hitMeta && hitMeta.sourceZombieId) {
          this.enemyAI.applyZombieThreat(enemyId, hitMeta.sourceZombieId, aggroAmount);
        } else if (hitMeta && hitMeta.sourceTrapId) {
          this.enemyAI.applyTrapThreat(enemyId, hitMeta.sourceTrapId, aggroAmount);
        } else if (hitMeta && hitMeta.sourceEnemyId && hitMeta.sourceEnemyId !== enemyId) {
          const src = this.enemies.get(hitMeta.sourceEnemyId);
          if (src && this.enemyAI) {
            this.enemyAI.applyHostileEnemyThreat(enemyId, hitMeta.sourceEnemyId, aggroAmount);
            if (enemy.type === 'nemesis') {
              this.enemyAI.applyNemesisRetaliationThreat(enemyId, hitMeta.sourceEnemyId, aggroAmount);
            }
          }
        } else if (fromPlayerId) {
          this.enemyAI.updateAggro(enemyId, fromPlayerId, aggroAmount);
        }
      }
    }

    if (
      fromPlayerId &&
      appliedDamage > 0 &&
      enemy.type !== 'training-dummy' &&
      enemy.type !== 'tentacle-spine' &&
      enemy.type !== 'player-zombie' && enemy.type !== 'vengeful-spirit' &&
      !this.isAlliedUnitEnemy(enemy)
    ) {
      this._tryEmitCoopRoomWhisper();
    }

    const result = {
      enemyId,
      newHealth: enemy.health,
      maxHealth: enemy.maxHealth,
      damage: appliedDamage,
      fromPlayerId,
      wasKilled: previousHealth > 0 && enemy.health <= 0
    };

    // Always sync HP to clients (socket `enemy-damage` and internal sources e.g. player-zombie hits).
    if (this.io) {
      const damageType = hitMeta && hitMeta.damageType;
      const isThrottledDot = damageType && DOT_DAMAGE_TYPES.has(damageType);
      let shouldEmitHp = true;
      if (isThrottledDot) {
        const now = Date.now();
        const last = this._dotHpSyncLastMs.get(enemyId) || 0;
        if (result.newHealth > 0 && now - last < 100) {
          shouldEmitHp = false;
        } else {
          this._dotHpSyncLastMs.set(enemyId, now);
        }
      }

      if (shouldEmitHp) {
      const damagedPayload = {
        damageEventId: this.nextDamageEventId++,
        enemyId: result.enemyId,
        newHealth: result.newHealth,
        maxHealth: result.maxHealth,
        damage: result.damage,
        fromPlayerId: result.fromPlayerId,
        wasKilled: result.wasKilled,
        isCritical: !!(hitMeta && hitMeta.isCritical),
        timestamp: Date.now(),
      };
      if (hitMeta && hitMeta.damageType === 'ignite') {
        damagedPayload.damageType = 'ignite';
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'shadowflame') {
        damagedPayload.damageType = 'shadowflame';
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'venom') {
        damagedPayload.damageType = 'venom';
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'wyvern_talons_detonate') {
        damagedPayload.damageType = 'wyvern_talons_detonate';
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'entanglement') {
        damagedPayload.damageType = 'entanglement';
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'allied_enchantress_entanglement') {
        damagedPayload.damageType = 'allied_enchantress_entanglement';
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'crossentropy' && hitMeta.crossentropyMeteorDamage) {
        damagedPayload.damageType = 'crossentropy';
        damagedPayload.crossentropyMeteorDamage = true;
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'cloudkill' && hitMeta.cloudkillDamage) {
        damagedPayload.damageType = 'cloudkill';
        damagedPayload.cloudkillDamage = true;
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.sourceZombieId) {
        damagedPayload.damageType = 'player_zombie';
        damagedPayload.sourceZombieId = hitMeta.sourceZombieId;
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'zombie_explosion') {
        damagedPayload.damageType = 'zombie_explosion';
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && (hitMeta.damageType === 'allied_knight_melee' || hitMeta.damageType === 'allied_knight_smite')) {
        damagedPayload.damageType = 'allied_knight';
        if (hitMeta.sourceAlliedUnitId) {
          damagedPayload.sourceAlliedUnitId = hitMeta.sourceAlliedUnitId;
        }
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'allied_huntress_arrow') {
        damagedPayload.damageType = 'allied_huntress';
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'allied_phantom_dagger') {
        damagedPayload.damageType = 'allied_phantom';
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && (hitMeta.damageType === 'allied_demon_leap' || hitMeta.damageType === 'allied_demon_melee')) {
        damagedPayload.damageType = 'allied_demon';
        if (hitMeta.sourceAlliedUnitId) {
          damagedPayload.sourceAlliedUnitId = hitMeta.sourceAlliedUnitId;
        }
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'allied_tiger_melee') {
        damagedPayload.damageType = 'allied_tiger';
        if (hitMeta.sourceAlliedUnitId) {
          damagedPayload.sourceAlliedUnitId = hitMeta.sourceAlliedUnitId;
        }
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'allied_wolf_melee') {
        damagedPayload.damageType = 'allied_wolf';
        if (hitMeta.sourceAlliedUnitId) {
          damagedPayload.sourceAlliedUnitId = hitMeta.sourceAlliedUnitId;
        }
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'allied_bear_melee') {
        damagedPayload.damageType = 'allied_bear';
        if (hitMeta.sourceAlliedUnitId) {
          damagedPayload.sourceAlliedUnitId = hitMeta.sourceAlliedUnitId;
        }
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'allied_serpent_melee') {
        damagedPayload.damageType = 'allied_serpent';
        if (hitMeta.sourceAlliedUnitId) {
          damagedPayload.sourceAlliedUnitId = hitMeta.sourceAlliedUnitId;
        }
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'allied_spider_melee') {
        damagedPayload.damageType = 'allied_spider';
        if (hitMeta.sourceAlliedUnitId) {
          damagedPayload.sourceAlliedUnitId = hitMeta.sourceAlliedUnitId;
        }
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'vengeful_spirit_melee') {
        damagedPayload.damageType = 'vengeful_spirit';
        if (hitMeta.sourceAlliedUnitId) {
          damagedPayload.sourceAlliedUnitId = hitMeta.sourceAlliedUnitId;
        }
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'soul_ward_redirect') {
        damagedPayload.damageType = 'soul_ward_redirect';
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'hatemail') {
        damagedPayload.damageType = 'hatemail';
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'enchantress_earth_shock') {
        damagedPayload.damageType = 'allied_enchantress';
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'mushroom_eruption') {
        damagedPayload.damageType = 'mushroom_eruption';
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'prime_materia') {
        damagedPayload.damageType = 'prime_materia';
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      } else if (hitMeta && hitMeta.damageType === 'archmage_flame_pillar') {
        damagedPayload.damageType = 'archmage_flame_pillar';
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      }
      if (result.wasKilled) {
        damagedPayload.position = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
      }
      this.io.to(this.roomId).emit('enemy-damaged', damagedPayload);
      }
    }

    if (
      this.io &&
      COOP_BOSS_TYPES.has(enemy.type) &&
      appliedDamage > 200 &&
      !result.wasKilled &&
      enemy.health > 0 &&
      enemy.bossStationary
    ) {
      this.io.to(this.roomId).emit('boss-hit-react', { bossId: enemy.id, timestamp: Date.now() });
    }

    if (
      hitMeta &&
      (hitMeta.damageType === 'blizzard' ||
        (hitMeta.damageType === 'entropic' && hitMeta.frostTotemChill)) &&
      appliedDamage > 0 &&
      !result.wasKilled &&
      !enemy.isDying &&
      enemy.health > 0
    ) {
      this.applyBlizzardChillOnHit(enemyId, fromPlayerId, player);
    }

    if (
      hitMeta &&
      hitMeta.damageType === 'blizzard' &&
      appliedDamage > 0 &&
      !result.wasKilled &&
      !enemy.isDying &&
      enemy.health > 0
    ) {
      const blizzardPlayer = fromPlayerId ? this.players.get(fromPlayerId) : player;
      if (blizzardPlayer?.coopStaggerRoomBoons?.acidRain) {
        this._addConcentratedVenomStacks(enemyId, ACID_RAIN_VENOM_STACKS_PER_TICK, fromPlayerId);
      }
    }

    if (
      hitMeta &&
      hitMeta.damageType === 'crossentropy' &&
      !hitMeta.crossentropyMeteorDamage &&
      appliedDamage > 0
    ) {
      this.tryProcCrossentropyMeteor(
        { x: enemy.position.x, y: enemy.position.y, z: enemy.position.z },
        fromPlayerId,
        player,
        hitMeta,
      );
    }

    // Necromancer aspect — summon Vengeful Spirit on direct Crossentropy bolt hits only
    if (
      hitMeta &&
      hitMeta.damageType === 'crossentropy' &&
      !hitMeta.crossentropyMeteorDamage &&
      appliedDamage > 0 &&
      fromPlayerId &&
      String(player?.weapon || '').toUpperCase() === 'SCYTHE' &&
      String(player?.weaponAspect || '').toUpperCase() === 'NECROMANCER'
    ) {
      this.enemyAI?.trySpawnVengefulSpirit?.(fromPlayerId, player, {
        x: enemy.position.x,
        y: enemy.position.y,
        z: enemy.position.z,
      });
    }

    // Archmage aspect — Crossentropy hit on already-Ignited enemy → flame pillar
    // (must run BEFORE Inferno / other Ignite applications on this same hit)
    if (
      hitMeta &&
      hitMeta.damageType === 'crossentropy' &&
      !hitMeta.crossentropyMeteorDamage &&
      appliedDamage > 0 &&
      fromPlayerId &&
      String(player?.weapon || '').toUpperCase() === 'SCYTHE' &&
      String(player?.weaponAspect || '').toUpperCase() === 'ARCHMAGE' &&
      this.isEnemyAffectedBy(enemyId, 'ignite')
    ) {
      const intellect = player?.coopStaggerRoomBoons?.intellect ?? 0;
      const pillarDamage =
        ARCHMAGE_FLAME_PILLAR_BASE_DAMAGE +
        ARCHMAGE_FLAME_PILLAR_DAMAGE_PER_INTELLECT * Math.max(0, intellect);
      if (this.io) {
        this.io.to(this.roomId).emit('archmage-flame-pillar', {
          enemyId,
          position: {
            x: enemy.position.x,
            y: enemy.position.y,
            z: enemy.position.z,
          },
          fromPlayerId,
        });
      }
      if (enemy.health > 0 && !enemy.isDying) {
        this.damageEnemy(enemyId, pillarDamage, fromPlayerId, player, {
          damageType: 'archmage_flame_pillar',
        });
      }
    }

    if (
      hitMeta &&
      hitMeta.damageType === 'projectile' &&
      hitMeta.cloudkill &&
      !hitMeta.cloudkillDamage &&
      appliedDamage > 0
    ) {
      this.tryProcCloudkill(
        { x: enemy.position.x, y: enemy.position.y, z: enemy.position.z },
        fromPlayerId,
        player,
        hitMeta,
      );
    }

    // Infernal Smite / INFERNO (Crossentropy): Ignite DoT — 80% of hit over 3s in 3 ticks (non-lethal hits only)
    const infernoDotEligible =
      !result.wasKilled &&
      hitMeta &&
      appliedDamage > 0 &&
      !enemy.isDying &&
      enemy.health > 0 &&
      ((hitMeta.damageType === 'smite' && hitMeta.infernalSmite) ||
        (hitMeta.damageType === 'crossentropy' && hitMeta.infernoCrossentropy));
    if (infernoDotEligible) {
      this.applyStatusEffect(enemyId, 'ignite', 3000, { fromPlayerId, player });
      this._scheduleIgniteDot(enemyId, appliedDamage, 0.8, 3000, 3, fromPlayerId, player);
    }

    // Sorceress Incineration — Ignite DoT: 80% of hit over 4s in 4 ticks (non-lethal hits only)
    const incinerationDotEligible =
      !result.wasKilled &&
      hitMeta &&
      appliedDamage > 0 &&
      !enemy.isDying &&
      enemy.health > 0 &&
      hitMeta.damageType === 'incineration';
    if (incinerationDotEligible) {
      this.applyStatusEffect(enemyId, 'ignite', INCINERATION_IGNITE_DURATION_MS, { fromPlayerId, player });
      this._scheduleIgniteDot(
        enemyId,
        appliedDamage,
        INCINERATION_IGNITE_DOT_FRACTION,
        INCINERATION_IGNITE_DURATION_MS,
        INCINERATION_IGNITE_TICKS,
        fromPlayerId,
        player,
      );
    }

    // REBUKE room boon — Ignite DoT: 70% of hit over 4s in 4 ticks (non-lethal hits only)
    const rebukeDotEligible =
      !result.wasKilled &&
      hitMeta &&
      appliedDamage > 0 &&
      !enemy.isDying &&
      enemy.health > 0 &&
      hitMeta.rebukeRoom;
    if (rebukeDotEligible) {
      this.applyStatusEffect(enemyId, 'ignite', 4000, { fromPlayerId, player });
      this._scheduleIgniteDot(enemyId, appliedDamage, 0.7, 4000, 4, fromPlayerId, player);
    }

    // INFERNAL DASH room boon — Ignite DoT: 80% of hit over 4s in 4 ticks (non-lethal hits only)
    const infernalDashDotEligible =
      !result.wasKilled &&
      hitMeta &&
      appliedDamage > 0 &&
      !enemy.isDying &&
      enemy.health > 0 &&
      hitMeta.infernalDashRoom;
    if (infernalDashDotEligible) {
      this.applyStatusEffect(enemyId, 'ignite', INFERNAL_DASH_IGNITE_DURATION_MS, { fromPlayerId, player });
      this._scheduleIgniteDot(
        enemyId,
        appliedDamage,
        INFERNAL_DASH_IGNITE_DOT_FRACTION,
        INFERNAL_DASH_IGNITE_DURATION_MS,
        INFERNAL_DASH_IGNITE_TICKS,
        fromPlayerId,
        player,
      );
    }

    // Fire Affinity (Sabres Flourish) — Ignite DoT: 80% of hit over 4s in 4 ticks (non-lethal hits only)
    const fireAffinityDotEligible =
      !result.wasKilled &&
      hitMeta &&
      appliedDamage > 0 &&
      !enemy.isDying &&
      enemy.health > 0 &&
      hitMeta.damageType === 'fire_affinity_storm';
    if (fireAffinityDotEligible) {
      this.applyStatusEffect(enemyId, 'ignite', FIRE_AFFINITY_IGNITE_DURATION_MS, { fromPlayerId, player });
      this._scheduleIgniteDot(
        enemyId,
        appliedDamage,
        FIRE_AFFINITY_IGNITE_DOT_FRACTION,
        FIRE_AFFINITY_IGNITE_DURATION_MS,
        FIRE_AFFINITY_IGNITE_TICKS,
        fromPlayerId,
        player,
      );
    }

    // Royal Guard Tempest Sweep — charged R Ignite: 80% of hit over 4s in 4 ticks (non-lethal hits only)
    const tempestSweepIgniteDotEligible =
      !result.wasKilled &&
      hitMeta &&
      hitMeta.damageType === 'whirlwind' &&
      hitMeta.tempestSweepIgnite === true &&
      appliedDamage > 0 &&
      !enemy.isDying &&
      enemy.health > 0;
    if (tempestSweepIgniteDotEligible) {
      this.applyStatusEffect(enemyId, 'ignite', TEMPEST_SWEEP_IGNITE_DURATION_MS, { fromPlayerId, player });
      this._scheduleIgniteDot(
        enemyId,
        appliedDamage,
        TEMPEST_SWEEP_IGNITE_DOT_FRACTION,
        TEMPEST_SWEEP_IGNITE_DURATION_MS,
        TEMPEST_SWEEP_IGNITE_TICKS,
        fromPlayerId,
        player,
      );
    }

    // Archmage aspect — every 3rd Entropic Bolt Ignite: 200% of hit over 4s in 4 ticks (non-lethal hits only)
    const archmageEntropicIgnitePlayer = player || (fromPlayerId ? this.players.get(fromPlayerId) : null);
    const archmageEntropicIgniteDotEligible =
      !result.wasKilled &&
      hitMeta &&
      hitMeta.damageType === 'entropic' &&
      hitMeta.archmageEntropicIgnite === true &&
      appliedDamage > 0 &&
      !enemy.isDying &&
      enemy.health > 0 &&
      archmageEntropicIgnitePlayer?.weaponAspect === 'ARCHMAGE';
    if (archmageEntropicIgniteDotEligible) {
      this.applyStatusEffect(enemyId, 'ignite', ARCHMAGE_ENTROPIC_IGNITE_DURATION_MS, {
        fromPlayerId,
        player: archmageEntropicIgnitePlayer,
      });
      this._scheduleIgniteDot(
        enemyId,
        appliedDamage,
        ARCHMAGE_ENTROPIC_IGNITE_DOT_FRACTION,
        ARCHMAGE_ENTROPIC_IGNITE_DURATION_MS,
        ARCHMAGE_ENTROPIC_IGNITE_TICKS,
        fromPlayerId,
        archmageEntropicIgnitePlayer,
      );
    }

    // Fire Affinity aspect — Divebomb / Skyfall Ignite: 80% of hit over 3s in 3 ticks (non-lethal hits only)
    const fireAffinitySkyfallPlayer = player || (fromPlayerId ? this.players.get(fromPlayerId) : null);
    const fireAffinitySkyfallDotEligible =
      !result.wasKilled &&
      hitMeta &&
      hitMeta.damageType === 'fire_affinity_skyfall' &&
      appliedDamage > 0 &&
      !enemy.isDying &&
      enemy.health > 0 &&
      fireAffinitySkyfallPlayer?.weaponAspect === 'FIRE_AFFINITY';
    if (fireAffinitySkyfallDotEligible) {
      this.applyStatusEffect(enemyId, 'ignite', FIRE_AFFINITY_SKYFALL_IGNITE_DURATION_MS, {
        fromPlayerId,
        player: fireAffinitySkyfallPlayer,
      });
      this._scheduleIgniteDot(
        enemyId,
        appliedDamage,
        FIRE_AFFINITY_SKYFALL_IGNITE_DOT_FRACTION,
        FIRE_AFFINITY_SKYFALL_IGNITE_DURATION_MS,
        FIRE_AFFINITY_SKYFALL_IGNITE_TICKS,
        fromPlayerId,
        fireAffinitySkyfallPlayer,
      );
    }

    // METEOR impacts (Crossentropy METEOR + R Meteor Strike) — Ignite: (80% + 2%×Intellect) over 4s
    const meteorIgniteEligible =
      !result.wasKilled &&
      hitMeta &&
      appliedDamage > 0 &&
      !enemy.isDying &&
      enemy.health > 0 &&
      hitMeta.damageType === 'crossentropy' &&
      hitMeta.crossentropyMeteorDamage;
    if (meteorIgniteEligible) {
      const intellect = player?.coopStaggerRoomBoons?.intellect ?? 0;
      const dotFraction =
        METEOR_IGNITE_DOT_BASE_FRACTION + Math.max(0, intellect) * METEOR_IGNITE_DOT_INTELLECT_BONUS_PER_POINT;
      this.applyStatusEffect(enemyId, 'ignite', METEOR_IGNITE_DURATION_MS, { fromPlayerId, player });
      this._scheduleIgniteDot(
        enemyId,
        appliedDamage,
        dotFraction,
        METEOR_IGNITE_DURATION_MS,
        METEOR_IGNITE_TICKS,
        fromPlayerId,
        player,
      );
    }

    // FISSION room boon — Ignite DoT on splash survivors: 80% of hit over 4s in 4 ticks (non-lethal hits only)
    const fissionDotEligible =
      !result.wasKilled &&
      hitMeta &&
      hitMeta.fissionRoom &&
      appliedDamage > 0 &&
      !enemy.isDying &&
      enemy.health > 0;
    if (fissionDotEligible) {
      this.applyStatusEffect(enemyId, 'ignite', FISSON_IGNITE_DURATION_MS, { fromPlayerId, player });
      this._scheduleIgniteDot(
        enemyId,
        appliedDamage,
        FISSON_IGNITE_DOT_FRACTION,
        FISSON_IGNITE_DURATION_MS,
        FISSON_IGNITE_TICKS,
        fromPlayerId,
        player,
      );
    }

    // Wyvern Bite — Concentrated Venom: +1 stack per Barrage hit (max 5), 31 DPS per stack, 8s from last stack
    if (
      !result.wasKilled &&
      hitMeta &&
      hitMeta.damageType === 'barrage' &&
      hitMeta.wyvernBiteVenom &&
      damage > 0 &&
      !enemy.isDying &&
      enemy.health > 0
    ) {
      this._addConcentratedVenomStacks(enemyId, 1, fromPlayerId);
    }

    // PLAGUE Crossentropy — 3 stacks of Concentrated Venom on direct hit only (not meteor splash)
    if (
      !result.wasKilled &&
      hitMeta &&
      hitMeta.damageType === 'crossentropy' &&
      hitMeta.crossentropyPlague &&
      !hitMeta.crossentropyMeteorDamage &&
      damage > 0 &&
      !enemy.isDying &&
      enemy.health > 0
    ) {
      this._addConcentratedVenomStacks(enemyId, CROSSENTROPY_PLAGUE_VENOM_STACKS, fromPlayerId);
    }

    // Infested Strike — 1 stack of Concentrated Venom per Wraith Strike hit
    if (
      !result.wasKilled &&
      hitMeta &&
      hitMeta.damageType === 'wraith_strike' &&
      hitMeta.infestedStrike &&
      damage > 0 &&
      !enemy.isDying &&
      enemy.health > 0
    ) {
      this._addConcentratedVenomStacks(enemyId, INFESTED_TALENT_CONCENTRATED_VENOM_STACKS, fromPlayerId);
    }

    // Blademaster — Wraith Strike applies Shadowflame: 60% of hit over 2.5s in 5 ticks
    const blademasterPlayer = player || (fromPlayerId ? this.players.get(fromPlayerId) : null);
    const shadowflameEligible =
      !result.wasKilled &&
      hitMeta &&
      hitMeta.damageType === 'wraith_strike' &&
      appliedDamage > 0 &&
      !enemy.isDying &&
      enemy.health > 0 &&
      blademasterPlayer?.weaponAspect === 'BLADEMASTER';
    if (shadowflameEligible) {
      this.applyStatusEffect(enemyId, 'shadowflame', BLADEMASTER_SHADOWFLAME_DURATION_MS, {
        fromPlayerId,
        player: blademasterPlayer,
      });
      this._scheduleIgniteDot(
        enemyId,
        appliedDamage,
        BLADEMASTER_SHADOWFLAME_DOT_FRACTION,
        BLADEMASTER_SHADOWFLAME_DURATION_MS,
        BLADEMASTER_SHADOWFLAME_TICKS,
        fromPlayerId,
        blademasterPlayer,
        'shadowflame',
      );
    }

    // Infested Stab — 1 stack of Concentrated Venom per Backstab hit
    if (
      !result.wasKilled &&
      hitMeta &&
      hitMeta.damageType === 'backstab' &&
      hitMeta.infestedBackstab &&
      damage > 0 &&
      !enemy.isDying &&
      enemy.health > 0
    ) {
      this._addConcentratedVenomStacks(enemyId, INFESTED_TALENT_CONCENTRATED_VENOM_STACKS, fromPlayerId);
    }

    // Warlord aspect — 2 stacks of Concentrated Venom per Backstab hit (stacks with Infested Stab)
    const warlordPlayer = player || (fromPlayerId ? this.players.get(fromPlayerId) : null);
    if (
      !result.wasKilled &&
      hitMeta &&
      hitMeta.damageType === 'backstab' &&
      damage > 0 &&
      !enemy.isDying &&
      enemy.health > 0 &&
      warlordPlayer?.weaponAspect === 'WARLORD'
    ) {
      this._addConcentratedVenomStacks(enemyId, WARLORD_BACKSTAB_CONCENTRATED_VENOM_STACKS, fromPlayerId);
    }

    // Warlord Poison Dart — 1 stack of Concentrated Venom on dart hit
    if (
      !result.wasKilled &&
      hitMeta &&
      hitMeta.damageType === 'poison_dart' &&
      damage > 0 &&
      !enemy.isDying &&
      enemy.health > 0
    ) {
      this._addConcentratedVenomStacks(enemyId, POISON_DART_CONCENTRATED_VENOM_STACKS, fromPlayerId);
    }

    // Infested Flourish — 1 stack of Concentrated Venom per Flourish / Fan of Knives hit
    if (
      !result.wasKilled &&
      hitMeta &&
      (hitMeta.damageType === 'sunder' || hitMeta.damageType === 'fan_of_knives') &&
      hitMeta.infestedFlourish &&
      damage > 0 &&
      !enemy.isDying &&
      enemy.health > 0
    ) {
      this._addConcentratedVenomStacks(enemyId, INFESTED_TALENT_CONCENTRATED_VENOM_STACKS, fromPlayerId);
    }

    // Infested Combo — 30% chance per Runeblade basic attack hit
    if (
      !result.wasKilled &&
      hitMeta &&
      hitMeta.damageType === 'runeblade_combo' &&
      hitMeta.infestedCombo &&
      damage > 0 &&
      !enemy.isDying &&
      enemy.health > 0 &&
      Math.random() < INFESTED_COMBO_VENOM_PROC_CHANCE
    ) {
      this._addConcentratedVenomStacks(enemyId, INFESTED_TALENT_CONCENTRATED_VENOM_STACKS, fromPlayerId);
    }

    // Infested Blades — 15% chance per Sabres basic attack hit
    if (
      !result.wasKilled &&
      hitMeta &&
      (hitMeta.damageType === 'sabre_left' || hitMeta.damageType === 'sabre_right') &&
      hitMeta.sabreInfestingSwipes &&
      damage > 0 &&
      !enemy.isDying &&
      enemy.health > 0 &&
      Math.random() < INFESTING_SABRES_SWIPES_VENOM_PROC_CHANCE
    ) {
      this._addConcentratedVenomStacks(enemyId, INFESTED_TALENT_CONCENTRATED_VENOM_STACKS, fromPlayerId);
    }

    // Entanglement — Barrage hit roots ordinary movement + 20 DPS for 5s.
    if (
      !result.wasKilled &&
      hitMeta &&
      hitMeta.damageType === 'barrage' &&
      hitMeta.entanglementBarrage &&
      damage > 0 &&
      !enemy.isDying &&
      enemy.health > 0
    ) {
      this.applyEntanglementOnHit(enemyId, fromPlayerId, player);
    }

    // Sniper Hunter's Mark — Barrage marks target for 5s (refresh, no stacks).
    if (
      !result.wasKilled &&
      hitMeta &&
      hitMeta.damageType === 'barrage' &&
      hitMeta.huntersMark &&
      damage > 0 &&
      !enemy.isDying &&
      enemy.health > 0 &&
      String(player?.weaponAspect || '').toUpperCase() === 'SNIPER'
    ) {
      this.applyStatusEffect(enemyId, 'huntersMark', SNIPER_HUNTERS_MARK_DURATION_MS, {
        fromPlayerId,
        player,
      });
    }

    // Sniper Hunter's Mark detonation — Perfect Shot consumes mark → stagger lightning.
    if (
      !result.wasKilled &&
      hitMeta &&
      hitMeta.perfectShot &&
      damage > 0 &&
      !enemy.isDying &&
      enemy.health > 0 &&
      String(player?.weaponAspect || '').toUpperCase() === 'SNIPER' &&
      this.isEnemyAffectedBy(enemyId, 'huntersMark')
    ) {
      this._clearHuntersMark(enemyId);
      this._triggerStaggerLightningProc(enemyId, fromPlayerId, player);
    }

    // Druid Rejuvenating Shot — enemy hit applies Entanglement (same DoT as talent).
    if (
      !result.wasKilled &&
      hitMeta &&
      hitMeta.rejuvenatingShotEntangle &&
      !enemy.isDying &&
      enemy.health > 0
    ) {
      this.applyEntanglementOnHit(enemyId, fromPlayerId, player);
    }

    // Necromancer Mantra totem — pulse applies Entanglement (same DoT as talent).
    if (
      !result.wasKilled &&
      hitMeta &&
      hitMeta.necromancerTotemEntangle &&
      !enemy.isDying &&
      enemy.health > 0
    ) {
      this.applyEntanglementOnHit(enemyId, fromPlayerId, player);
    }

    // HELLFIRE VENOM (duo: red + green) — venom / cobra shot / entanglement hits also Ignite.
    if (
      !result.wasKilled &&
      hitMeta &&
      appliedDamage > 0 &&
      !enemy.isDying &&
      enemy.health > 0 &&
      (hitMeta.damageType === 'venom' ||
        hitMeta.damageType === 'cobra_shot' ||
        hitMeta.damageType === 'entanglement')
    ) {
      this._tryHellfireVenomIgnite(enemyId, fromPlayerId, player);
    }

    // Glacial Bite — +1 chill per Barrage hit; 5 stacks → 6s freeze (longer than blizzard tick freeze)
    if (
      !result.wasKilled &&
      hitMeta &&
      hitMeta.damageType === 'barrage' &&
      hitMeta.glacialBiteChill &&
      damage > 0 &&
      !enemy.isDying &&
      enemy.health > 0
    ) {
      this.applyGlacialBiteChillOnHit(enemyId, fromPlayerId, player);
    }

    // Arctic Sting + Tempest Rounds — +1 chill per burst hit; 6 stacks → freeze
    if (
      !result.wasKilled &&
      hitMeta &&
      hitMeta.damageType === 'projectile' &&
      hitMeta.tempestBurstArcticChill &&
      damage > 0 &&
      !enemy.isDying &&
      enemy.health > 0
    ) {
      this.applyArcticStingTempestChillOnHit(enemyId, fromPlayerId, player);
    }

    // Arctic Shards + Icebeam — +1 chill per beam tick; 5 stacks → 4s freeze
    if (
      !result.wasKilled &&
      hitMeta &&
      hitMeta.damageType === 'icebeam' &&
      hitMeta.icebeamArcticChill &&
      damage > 0 &&
      !enemy.isDying &&
      enemy.health > 0
    ) {
      this.applyBlizzardChillOnHit(enemyId, fromPlayerId, player);
    }

    // Stagger talents: build stagger; at 100 (300 for coop bosses) proc damage + stun + VFX
    if (
      !result.wasKilled &&
      hitMeta &&
      (hitMeta.damageType === 'wraith_strike' ||
        hitMeta.damageType === 'runeblade_combo' ||
        hitMeta.damageType === 'backstab' ||
        hitMeta.damageType === 'sabre_left' ||
        hitMeta.damageType === 'sabre_right' ||
        hitMeta.damageType === 'smite' ||
        hitMeta.damageType === 'sunder' ||
        hitMeta.damageType === 'fan_of_knives' ||
        hitMeta.damageType === 'barrage' ||
        hitMeta.damageType === 'reaping_talons' ||
        hitMeta.damageType === 'projectile' ||
        hitMeta.damageType === 'crossentropy' ||
        hitMeta.damageType === 'entropic' ||
        hitMeta.damageType === 'icebeam' ||
        hitMeta.damageType === 'lightning_storm' ||
        hitMeta.damageType === 'blizzard' ||
        hitMeta.damageType === 'ignite') &&
      typeof hitMeta.staggerToAdd === 'number' &&
      hitMeta.staggerToAdd > 0 &&
      !enemy.isDying
    ) {
      const noStaggerTypes = new Set(['boss-skeleton', 'player-zombie', 'vengeful-spirit', 'tentacle-spine']);
      if (!noStaggerTypes.has(enemy.type)) {
        if (enemy.staggerBuildup == null) enemy.staggerBuildup = 0;
        enemy.staggerBuildup += hitMeta.staggerToAdd;
        const staggerCap = COOP_BOSS_TYPES.has(enemy.type) ? STAGGER_CAP_BOSS : STAGGER_CAP_NORMAL;
        let procEnemy = this.enemies.get(enemyId);
        while (
          procEnemy &&
          !procEnemy.isDying &&
          typeof procEnemy.staggerBuildup === 'number' &&
          procEnemy.staggerBuildup >= staggerCap
        ) {
          procEnemy.staggerBuildup -= staggerCap;
          this._triggerStaggerLightningProc(enemyId, fromPlayerId, player);
          procEnemy = this.enemies.get(enemyId);
        }
        const syncEnemy = this.enemies.get(enemyId);
        if (syncEnemy && !syncEnemy.isDying) {
          if (syncEnemy.staggerBuildup == null) syncEnemy.staggerBuildup = 0;
          this._maybeBroadcastStagger(enemyId, syncEnemy.staggerBuildup);
        }
      }
    }

    if (result.wasKilled) {
      console.log(`💀 Enemy ${enemyId} killed by player ${fromPlayerId}`);
      this._clearEnemyDoTTimers(enemyId);
      enemy.entanglementTicksRemaining = 0;
      enemy.concentratedVenomStacks = 0;
      enemy.concentratedVenomExpireAt = null;
      this._maybeBroadcastConcentratedVenom(enemyId, 0, null);
      enemy.isDying = true;
      enemy.deathTime = Date.now();

      // Colossus aura: resurrect non-heavy hostiles that die within 8 units.
      if (this._tryScheduleColossusResurrection(enemy)) {
        enemy.skipCoopWaveKill = true;
        this._skipNextCoopWaveKill = true;
      }

      // Shaman Spirit Wolves use summonerId — clear them when the shaman dies.
      if (enemy.type === 'shaman') {
        this._clearBossSummonedAdds(enemyId);
      }

      if (this.isAlliedUnitEnemy(enemy)) {
        if (this.enemyAI) {
          this.enemyAI.clearZombieAsAggroTarget(enemyId);
          this.enemyAI.removeEnemyAggro(enemyId);
        }
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', {
              enemyId,
              timestamp: Date.now(),
            });
          }
        }, 2500);
        return result;
      }

      this._emitEnemyDeathVortex(enemyId, enemy);

      if (
        fromPlayerId &&
        hitMeta &&
        (hitMeta.damageType === 'stagger_break' || hitMeta.damageType === 'blizzard')
      ) {
        const killer = this.players.get(fromPlayerId);
        if (killer?.coopStaggerRoomBoons?.spellThief && this.io) {
          this.io.to(fromPlayerId).emit('spell-thief-dash-restore', { timestamp: Date.now() });
        }
      }

      if (
        this._anyPlayerHasFissionRoom() &&
        this.isEnemyAffectedBy(enemyId, 'ignite') &&
        enemy.type !== 'training-dummy' &&
        !COOP_BOSS_TYPES.has(enemy.type) &&
        enemy.type !== 'player-zombie' && enemy.type !== 'vengeful-spirit'
      ) {
        this._tryFissionDetonation(enemy, enemyId, fromPlayerId, player);
      }

      // INFESTED STRIKE: raise zombie on Wraith Strike kill (non-boss, non-dummy)
      if (
        hitMeta &&
        hitMeta.damageType === 'wraith_strike' &&
        hitMeta.infestedStrike &&
        fromPlayerId &&
        fromPlayerId !== 'unknown' &&
        enemy.type !== 'training-dummy' &&
        !COOP_BOSS_TYPES.has(enemy.type) &&
        enemy.type !== 'player-zombie' && enemy.type !== 'vengeful-spirit' &&
        this.enemyAI
      ) {
        this.enemyAI.trySpawnInfestedZombie(fromPlayerId, {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        });
      }

      // INFESTED SMITE: same zombie rules as Infested Strike (Wraith Strike kill)
      if (
        hitMeta &&
        hitMeta.damageType === 'smite' &&
        hitMeta.infestedSmite &&
        fromPlayerId &&
        fromPlayerId !== 'unknown' &&
        enemy.type !== 'training-dummy' &&
        !COOP_BOSS_TYPES.has(enemy.type) &&
        enemy.type !== 'player-zombie' && enemy.type !== 'vengeful-spirit' &&
        this.enemyAI
      ) {
        this.enemyAI.trySpawnInfestedZombie(fromPlayerId, {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        });
      }

      // INFESTED COMBO: Runeblade basic (runeblade_combo) kill — same zombie rules as Infested Smite
      if (
        hitMeta &&
        hitMeta.damageType === 'runeblade_combo' &&
        hitMeta.infestedCombo &&
        fromPlayerId &&
        fromPlayerId !== 'unknown' &&
        enemy.type !== 'training-dummy' &&
        !COOP_BOSS_TYPES.has(enemy.type) &&
        enemy.type !== 'player-zombie' && enemy.type !== 'vengeful-spirit' &&
        this.enemyAI
      ) {
        this.enemyAI.trySpawnInfestedZombie(fromPlayerId, {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        });
      }

      // INFESTED BACKSTAB: Sabres Backstab kill — same zombie rules as Infested Strike
      if (
        hitMeta &&
        hitMeta.damageType === 'backstab' &&
        hitMeta.infestedBackstab &&
        fromPlayerId &&
        fromPlayerId !== 'unknown' &&
        enemy.type !== 'training-dummy' &&
        !COOP_BOSS_TYPES.has(enemy.type) &&
        enemy.type !== 'player-zombie' && enemy.type !== 'vengeful-spirit' &&
        this.enemyAI
      ) {
        this.enemyAI.trySpawnInfestedZombie(fromPlayerId, {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        });
      }

      // INFESTING SABRES SWIPES: Sabres LMB blade kill — same zombie rules
      if (
        hitMeta &&
        (hitMeta.damageType === 'sabre_left' || hitMeta.damageType === 'sabre_right') &&
        hitMeta.sabreInfestingSwipes &&
        fromPlayerId &&
        fromPlayerId !== 'unknown' &&
        enemy.type !== 'training-dummy' &&
        !COOP_BOSS_TYPES.has(enemy.type) &&
        enemy.type !== 'player-zombie' && enemy.type !== 'vengeful-spirit' &&
        this.enemyAI
      ) {
        this.enemyAI.trySpawnInfestedZombie(fromPlayerId, {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        });
      }

      // INFESTED FLOURISH: Sabres Flourish (sunder / Fan of Knives) kill — same zombie rules as Infesting Swipes
      if (
        hitMeta &&
        (hitMeta.damageType === 'sunder' || hitMeta.damageType === 'fan_of_knives') &&
        hitMeta.infestedFlourish &&
        fromPlayerId &&
        fromPlayerId !== 'unknown' &&
        enemy.type !== 'training-dummy' &&
        !COOP_BOSS_TYPES.has(enemy.type) &&
        enemy.type !== 'player-zombie' && enemy.type !== 'vengeful-spirit' &&
        this.enemyAI
      ) {
        this.enemyAI.trySpawnInfestedZombie(fromPlayerId, {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        });
      }

      // INFESTING ENTROPIC BOLTS: Scythe LMB bolt kill — same zombie rules as Infested Smite
      if (
        hitMeta &&
        hitMeta.damageType === 'entropic' &&
        hitMeta.entropicInfesting &&
        fromPlayerId &&
        fromPlayerId !== 'unknown' &&
        enemy.type !== 'training-dummy' &&
        !COOP_BOSS_TYPES.has(enemy.type) &&
        enemy.type !== 'player-zombie' && enemy.type !== 'vengeful-spirit' &&
        this.enemyAI
      ) {
        this.enemyAI.trySpawnInfestedZombie(fromPlayerId, {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        });
      }

      // INFESTING ENTROPIC BEAM: Icebeam kill — zombie + 5 HP heal to killer
      if (
        hitMeta &&
        hitMeta.damageType === 'icebeam' &&
        hitMeta.icebeamInfested &&
        fromPlayerId &&
        fromPlayerId !== 'unknown' &&
        enemy.type !== 'training-dummy' &&
        !COOP_BOSS_TYPES.has(enemy.type) &&
        enemy.type !== 'player-zombie' && enemy.type !== 'vengeful-spirit' &&
        this.enemyAI
      ) {
        this.enemyAI.trySpawnInfestedZombie(fromPlayerId, {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        });
        const killer = this.players.get(fromPlayerId);
        if (killer && killer.maxHealth != null) {
          killer.health = Math.min(killer.maxHealth, killer.health + 5);
          if (this.io) {
            this.io.to(this.roomId).emit('player-health-updated', {
              playerId: fromPlayerId,
              health: killer.health,
              maxHealth: killer.maxHealth,
            });
          }
        }
      }

      // WYVERN STING: Cobra venom DoT kill (client sends meta)
      if (
        hitMeta &&
        hitMeta.damageType === 'venom' &&
        hitMeta.wyvernStingVenomZombie &&
        fromPlayerId &&
        fromPlayerId !== 'unknown' &&
        enemy.type !== 'training-dummy' &&
        !COOP_BOSS_TYPES.has(enemy.type) &&
        enemy.type !== 'player-zombie' && enemy.type !== 'vengeful-spirit' &&
        this.enemyAI
      ) {
        this.enemyAI.trySpawnInfestedZombie(fromPlayerId, {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        });
      }

      // WYVERN STING + Tempest Rounds: burst projectile kill
      if (
        hitMeta &&
        hitMeta.damageType === 'projectile' &&
        hitMeta.tempestBurstWyvernZombie &&
        fromPlayerId &&
        fromPlayerId !== 'unknown' &&
        enemy.type !== 'training-dummy' &&
        !COOP_BOSS_TYPES.has(enemy.type) &&
        enemy.type !== 'player-zombie' && enemy.type !== 'vengeful-spirit' &&
        this.enemyAI
      ) {
        this.enemyAI.trySpawnInfestedZombie(fromPlayerId, {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        });
      }

      // WYVERN BITE: Concentrated Venom DoT kill
      if (
        hitMeta &&
        hitMeta.damageType === 'venom' &&
        hitMeta.wyvernBiteConcentratedDoT &&
        fromPlayerId &&
        fromPlayerId !== 'unknown' &&
        enemy.type !== 'training-dummy' &&
        !COOP_BOSS_TYPES.has(enemy.type) &&
        enemy.type !== 'player-zombie' && enemy.type !== 'vengeful-spirit' &&
        this.enemyAI
      ) {
        this.enemyAI.trySpawnInfestedZombie(fromPlayerId, {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        });
      }

      // WYVERN TALONS: Reaping Talons kill
      if (
        hitMeta &&
        hitMeta.damageType === 'reaping_talons' &&
        hitMeta.wyvernTalonsZombie &&
        fromPlayerId &&
        fromPlayerId !== 'unknown' &&
        enemy.type !== 'training-dummy' &&
        !COOP_BOSS_TYPES.has(enemy.type) &&
        enemy.type !== 'player-zombie' && enemy.type !== 'vengeful-spirit' &&
        this.enemyAI
      ) {
        this.enemyAI.trySpawnInfestedZombie(fromPlayerId, {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        });
      }

      // WYVERN TALONS: DoT detonation kill
      if (
        hitMeta &&
        hitMeta.damageType === 'wyvern_talons_detonate' &&
        hitMeta.wyvernTalonsZombie &&
        fromPlayerId &&
        fromPlayerId !== 'unknown' &&
        enemy.type !== 'training-dummy' &&
        !COOP_BOSS_TYPES.has(enemy.type) &&
        enemy.type !== 'player-zombie' && enemy.type !== 'vengeful-spirit' &&
        this.enemyAI
      ) {
        this.enemyAI.trySpawnInfestedZombie(fromPlayerId, {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        });
      }

      // PLAGUE Crossentropy — up to two allied zombies per kill (`trySpawnInfestedZombie` respects max 3)
      if (
        hitMeta &&
        hitMeta.damageType === 'crossentropy' &&
        hitMeta.crossentropyPlague &&
        fromPlayerId &&
        fromPlayerId !== 'unknown' &&
        enemy.type !== 'training-dummy' &&
        !COOP_BOSS_TYPES.has(enemy.type) &&
        enemy.type !== 'player-zombie' && enemy.type !== 'vengeful-spirit' &&
        this.enemyAI
      ) {
        const pos = {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        };
        this.enemyAI.trySpawnInfestedZombie(fromPlayerId, pos);
        this.enemyAI.trySpawnInfestedZombie(fromPlayerId, pos);
      }

      // EXPLODER STRAIN: zombie detonation kill — same zombie rules as Infested Strike
      if (
        hitMeta &&
        hitMeta.damageType === 'zombie_explosion' &&
        hitMeta.exploderStrainZombie &&
        fromPlayerId &&
        fromPlayerId !== 'unknown' &&
        enemy.type !== 'training-dummy' &&
        !COOP_BOSS_TYPES.has(enemy.type) &&
        enemy.type !== 'player-zombie' && enemy.type !== 'vengeful-spirit' &&
        this.enemyAI
      ) {
        this.enemyAI.trySpawnInfestedZombie(fromPlayerId, {
          x: enemy.position.x,
          y: enemy.position.y,
          z: enemy.position.z,
        });
      }

      // Reaper (Crossentropy): +1 base damage for this room session per kill
      if (
        hitMeta &&
        hitMeta.damageType === 'crossentropy' &&
        hitMeta.reaperCrossentropy &&
        fromPlayerId &&
        fromPlayerId !== 'unknown' &&
        enemy.type !== 'training-dummy' &&
        this.io
      ) {
        const p = this.players.get(fromPlayerId);
        if (p) {
          p.reaperCrossentropyStack = (p.reaperCrossentropyStack || 0) + 1;
          this.io.to(fromPlayerId).emit('reaper-crossentropy-stack', { stacks: p.reaperCrossentropyStack });
        }
      }

      // Killstreak (Sabres Backstab): +base damage per Backstab kill this session
      if (
        hitMeta &&
        hitMeta.damageType === 'backstab' &&
        hitMeta.killstreakBackstab &&
        fromPlayerId &&
        fromPlayerId !== 'unknown' &&
        enemy.type !== 'training-dummy' &&
        this.io
      ) {
        const p = this.players.get(fromPlayerId);
        if (p) {
          p.backstabKillstreakStack = (p.backstabKillstreakStack || 0) + 1;
          this.io.to(fromPlayerId).emit('backstab-killstreak-stack', { stacks: p.backstabKillstreakStack });
        }
      }

      // Relentless (Sabres Backstab): heal + client cooldown reset on kill (same exclusions as Infesting Icebeam kill heal)
      if (
        hitMeta &&
        hitMeta.damageType === 'backstab' &&
        hitMeta.relentlessBackstab &&
        fromPlayerId &&
        fromPlayerId !== 'unknown' &&
        enemy.type !== 'training-dummy' &&
        !COOP_BOSS_TYPES.has(enemy.type) &&
        enemy.type !== 'player-zombie' && enemy.type !== 'vengeful-spirit' &&
        this.io
      ) {
        const killer = this.players.get(fromPlayerId);
        if (killer && killer.maxHealth != null) {
          // Keep in sync with RELENTLESS_BACKSTAB_KILL_* in src/utils/talents.ts
          const stamina = Math.max(
            0,
            typeof killer.coopStaggerRoomBoons?.stamina === 'number'
              ? killer.coopStaggerRoomBoons.stamina
              : 0,
          );
          const relentlessHeal = 30 + 5 * stamina;
          killer.health = Math.min(killer.maxHealth, killer.health + relentlessHeal);
          this.io.to(this.roomId).emit('player-health-updated', {
            playerId: fromPlayerId,
            health: killer.health,
            maxHealth: killer.maxHealth,
          });
          this.io.to(this.roomId).emit('player-healing', {
            sourcePlayerId: fromPlayerId,
            targetPlayerId: fromPlayerId,
            healingAmount: relentlessHeal,
            healingType: 'relentless_backstab',
            position: killer.position || { x: 0, y: 0, z: 0 },
            timestamp: Date.now(),
          });
          this.io.to(fromPlayerId).emit('sabres-relentless-backstab-kill');
        }
      }

      // Spawn a world gold pile for eligible enemy kills.
      this.spawnGoldDropForKill(enemy);

      // Dream Layer unique drops from non-boss enemies (bosses roll after spawnBossItemDrops).
      if (!COOP_BOSS_TYPES.has(enemy.type)) {
        this._tryDreamLayerDropOnKill(enemy);
      }

      if (
        this.currentCoopRoomKind === 'erebus_gate'
        && enemy.erebusGateOpponent
        && this.erebusGateOpponentIds?.has(enemyId)
      ) {
        const expByType = {
          boss: 1000,
          titan: 100,
          nemesis: 90,
          valkyrie: 85,
          knight: 65,
        };
        const expGain = expByType[enemy.type] ?? 100;
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: expGain,
            source: 'erebus_gate_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        if (COOP_BOSS_TYPES.has(enemy.type)) {
          this._clearBossSummonedAdds(enemyId);
        }
        this._registerErebusGateKill(enemy);
        if (this.enemyAI) {
          this.enemyAI.removeEnemyAggro(enemyId);
        }
        const fadeMs = COOP_BOSS_TYPES.has(enemy.type) ? 3000 : 2500;
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
          }
        }, fadeMs);
        return result;
      }

      // Special rewards for boss kills
      if (COOP_BOSS_TYPES.has(enemy.type)) {
        if (enemy.waveRoomBoss) {
          // ── Mini-boss1 inside a wave room ────────────────────────────────────
          // Grant reduced EXP; no boss-completion flow (no portal, no count increment).
          if (this.io) {
            this.players.forEach((player, playerId) => {
              this.io.to(this.roomId).emit('player-experience-gained', {
                playerId,
                experienceGained: 250,
                source: 'boss_kill',
                enemyId,
                timestamp: Date.now()
              });
            });
          }
          // Count toward the room kill quota so the wave can complete normally.
          this._registerCoopWaveKill('👹 Wave mini-boss1 defeated');
          this._clearBossSummonedAdds(enemyId);
          console.log(`⚔️ Wave-room mini-boss1 defeated by player ${fromPlayerId}`);
        } else if (this.tripleBossIds?.has(enemyId)) {
          // ── Triple-boss encounter (4th boss fight) ───────────────────────────
          // Award EXP and drop an item for each fallen boss; trigger completion only
          // when all three are dead.
          this.tripleBossIds.delete(enemyId);
          this._clearBossSummonedAdds(enemyId);
          if (this.io) {
            this.players.forEach((player, playerId) => {
              this.io.to(this.roomId).emit('player-experience-gained', {
                playerId,
                experienceGained: 1000,
                source: 'boss_kill',
                enemyId,
                timestamp: Date.now()
              });
            });
            this.spawnBossItemDrops(enemy.position);
            this._tryDreamLayerDropOnKill(enemy);
          }
          console.log(`👹 Triple-boss: one defeated (${this.tripleBossIds.size} remaining)`);
          if (this.tripleBossIds.size === 0) {
            this.tripleBossIds = null;
            if (this.io) {
              this.io.to(this.roomId).emit('boss-defeated', {
                bossId: enemyId,
                killedBy: fromPlayerId,
                slainLabel: 'trinity',
                timestamp: Date.now()
              });
            }
            this.coopBossesDefeatedCount += 1;
            this._scheduleTrinityFinaleIntermission();
            console.log(`🎉 ALL THREE BOSSES DEFEATED — triple encounter cleared by player ${fromPlayerId}!`);
          }
        } else {
          // ── Normal single-boss fight ─────────────────────────────────────────
          if (this.io) {
            this.players.forEach((player, playerId) => {
              this.io.to(this.roomId).emit('player-experience-gained', {
                playerId,
                experienceGained: 1000,
                source: 'boss_kill',
                enemyId,
                timestamp: Date.now()
              });
            });

            const slainLabel =
              enemy.type === 'boss2' ? 'envy'
              : enemy.type === 'boss3' ? 'fear'
              : enemy.type === 'destiny' ? 'destiny'
              : 'hate';

            this.io.to(this.roomId).emit('boss-defeated', {
              bossId: enemyId,
              killedBy: fromPlayerId,
              slainLabel,
              timestamp: Date.now()
            });

            this.spawnBossItemDrops(enemy.position);
            this._tryDreamLayerDropOnKill(enemy);
          }

          this._clearBossSummonedAdds(enemyId);
          this.coopBossesDefeatedCount += 1;
          this._schedulePostBossPortalIntermission();

          console.log(`🎉 BOSS DEFEATED by player ${fromPlayerId}!`);
        } // end else (normal single-boss)
      } else if (enemy.type === 'boss-skeleton') {
        // Handle boss skeleton death
        if (enemy.bossId && this.enemyAI) {
          this.enemyAI.removeBossSkeleton(enemy.bossId, enemyId);
        }

        // Award +50 EXP for boss skeleton kills to the killer
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 50,
            source: 'boss_skeleton_kill',
            enemyId: enemyId,
            timestamp: Date.now()
          });
        }

        // 10% chance to drop an amulet on skeleton death
        if (Math.random() < 0.10) {
          this.spawnItemDrop(enemy.position, enemy);
        }

        // Remove skeleton immediately (no death animation delay)
        this.enemies.delete(enemyId);
        console.log(`🗑️ Boss skeleton ${enemyId} removed immediately from enemies map`);

        // Broadcast immediate removal to all clients
        if (this.io) {
          this.io.to(this.roomId).emit('enemy-removed', {
            enemyId: enemyId,
            timestamp: Date.now()
          });
        }

        // Clean up aggro immediately
        if (this.enemyAI) {
          this.enemyAI.removeEnemyAggro(enemyId);
        }

        // Return early to skip the setTimeout cleanup below
        return result;

      } else if (enemy.type === 'knight') {
        if (this.boss1EliteKnightIds?.has(enemyId)) {
          this.boss1EliteKnightIds.delete(enemyId);
          if (this.boss1EliteKnightIds.size === 0) {
            this.boss1EliteKnightIds = null;
            if (this.io) {
              this.players.forEach((player, playerId) => {
                this.io.to(this.roomId).emit('player-experience-gained', {
                  playerId,
                  experienceGained: 1000,
                  source: 'boss_kill',
                  enemyId,
                  timestamp: Date.now(),
                });
              });
              this.io.to(this.roomId).emit('boss-defeated', {
                bossId: enemyId,
                killedBy: fromPlayerId,
                slainLabel: 'knights',
                timestamp: Date.now(),
              });
              this.spawnBossItemDrops(enemy.position);
              this._tryDreamLayerDropOnKill({
                ...enemy,
                type: 'boss',
              });
            }
            this.coopBossesDefeatedCount += 1;
            this._schedulePostBossPortalIntermission();
            console.log(`🎉 BOSS1 ELITE KNIGHTS DEFEATED by player ${fromPlayerId}!`);
          }
        }

        // Award +65 EXP for knight kills (tougher than skeleton)
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 65,
            source: 'knight_kill',
            enemyId: enemyId,
            timestamp: Date.now()
          });
        }

        this._registerCoopWaveKill('⚔️ Knight killed');

        // 15% chance to drop an amulet on knight death
        if (Math.random() < 0.15) {
          this.spawnItemDrop(enemy.position, enemy);
        }

        // Stop AI targeting this knight immediately, but delay removal so
        // clients have time to play the death animation + opacity fade
        // (death clip ~1.5s + FADE_DURATION 1.5s → 2500ms covers both).
        if (this.enemyAI) {
          this.enemyAI.removeEnemyAggro(enemyId);
        }

        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          console.log(`🗑️ Knight ${enemyId} removed from enemies map after death animation`);

          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', {
              enemyId: enemyId,
              timestamp: Date.now()
            });
          }
        }, 2500);

        return result;

      } else if (enemy.type === 'shade') {
        // Award EXP for shade kills
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 65,
            source: 'shade_kill',
            enemyId: enemyId,
            timestamp: Date.now()
          });
        }

        this._registerCoopWaveKill('👻 Shade killed');

        // Small item drop chance
        if (Math.random() < 0.15) {
          this.spawnItemDrop(enemy.position, enemy);
        }

        // Stop AI immediately; delay removal so the client fade-out completes.
        if (this.enemyAI) {
          this.enemyAI.removeEnemyAggro(enemyId);
        }

        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          console.log(`🗑️ Shade ${enemyId} removed from enemies map after death fade`);

          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', {
              enemyId: enemyId,
              timestamp: Date.now()
            });
          }
        }, 2500);

        return result;

      } else if (enemy.type === 'warlock') {
        // Award EXP for warlock kills
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 80,
            source: 'warlock_kill',
            enemyId: enemyId,
            timestamp: Date.now()
          });
        }

        this._registerCoopWaveKill('🔮 Warlock killed');

        // Small item drop chance
        if (Math.random() < 0.15) {
          this.spawnItemDrop(enemy.position, enemy);
        }

        // Stop AI immediately; delay removal so the client fade-out completes.
        if (this.enemyAI) {
          this.enemyAI.removeEnemyAggro(enemyId);
        }

        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          console.log(`🗑️ Warlock ${enemyId} removed from enemies map after death fade`);

          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', {
              enemyId: enemyId,
              timestamp: Date.now()
            });
          }
        }, 2500);

        return result;

      } else if (enemy.type === 'templar') {
        // Award EXP for templar kills
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 75,
            source: 'templar_kill',
            enemyId: enemyId,
            timestamp: Date.now()
          });
        }

        this._registerCoopWaveKill('🛡️ Templar killed');

        // Slightly higher item drop chance than shade/warlock
        if (Math.random() < 0.20) {
          this.spawnItemDrop(enemy.position, enemy);
        }

        // Stop AI immediately; delay removal for client fade-out.
        if (this.enemyAI) {
          this.enemyAI.removeEnemyAggro(enemyId);
        }

        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          console.log(`🗑️ Templar ${enemyId} removed from enemies map after death fade`);

          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', {
              enemyId: enemyId,
              timestamp: Date.now()
            });
          }
        }, 2500);

        return result;

      } else if (enemy.type === 'weaver') {
        // Award EXP for weaver kills
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 80,
            source: 'weaver_kill',
            enemyId: enemyId,
            timestamp: Date.now()
          });
        }

        this._registerCoopWaveKill('🧵 Weaver killed');

        if (Math.random() < 0.18) {
          this.spawnItemDrop(enemy.position, enemy);
        }

        if (this.enemyAI) {
          this.enemyAI.removeEnemyAggro(enemyId);
        }

        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          console.log(`🗑️ Weaver ${enemyId} removed from enemies map after death fade`);
          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
          }
        }, 2500);

        return result;

      } else if (enemy.type === 'ghoul') {
        if (enemy.deliriumGhoul) {
          this._registerDeliriumKill();
        }
        // Award EXP for ghoul kills
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 40,
            source: 'ghoul_kill',
            enemyId: enemyId,
            timestamp: Date.now()
          });
        }

        // Ghoul kills no longer count toward the room's kill quota.

        if (this.enemyAI) {
          this.enemyAI.removeEnemyAggro(enemyId);
        }

        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          console.log(`🗑️ Ghoul ${enemyId} removed from enemies map after death fade`);
          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
          }
        }, 2500);

        return result;

      } else if (enemy.type === 'martyr') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 50,
            source: 'martyr_kill',
            enemyId: enemyId,
            timestamp: Date.now()
          });
        }

        if (Math.random() < 0.1) {
          this.spawnItemDrop(enemy.position, enemy);
        }

        if (this.coopIntroActive) {
          this._registerCoopWaveKill('💣 Martyr killed');
        }

        if (this.enemyAI) {
          this.enemyAI.removeEnemyAggro(enemyId);
        }

        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          console.log(`🗑️ Martyr ${enemyId} removed from enemies map after death fade`);
          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
          }
        }, 2500);

        return result;

      } else if (enemy.type === 'wraith') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 75,
            source: 'wraith_kill',
            enemyId: enemyId,
            timestamp: Date.now()
          });
        }

        if (Math.random() < 0.12) {
          this.spawnItemDrop(enemy.position, enemy);
        }

        if (this.coopIntroActive || this.coopSunkenActive || this.coopEternityActive) {
          this._registerCoopWaveKill('👻 Wraith killed');
        }

        if (this.enemyAI) {
          this.enemyAI.removeEnemyAggro(enemyId);
        }

        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          console.log(`🗑️ Wraith ${enemyId} removed from enemies map after death fade`);
          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
          }
        }, 2500);

        return result;

      } else if (enemy.type === 'titan') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 100,
            source: 'titan_kill',
            enemyId: enemyId,
            timestamp: Date.now()
          });
        }

        this._registerCoopWaveKill('🗿 Titan killed');

        if (Math.random() < 0.15) {
          this.spawnItemDrop(enemy.position, enemy);
        }

        if (this.enemyAI) {
          this.enemyAI.removeEnemyAggro(enemyId);
        }

        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          console.log(`🗑️ Titan ${enemyId} removed from enemies map after death fade`);
          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
          }
        }, 2500);

        return result;

      } else if (enemy.type === 'spectre') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 70,
            source: 'spectre_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('👻 Spectre killed');
        if (Math.random() < 0.12) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'death-knight') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 75,
            source: 'death_knight_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('💀 Death Knight killed');
        if (Math.random() < 0.12) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'shaman') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 75,
            source: 'shaman_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('⚡ Shaman killed');
        if (Math.random() < 0.12) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'assassin') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 75,
            source: 'assassin_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('🗡️ Assassin killed');
        if (Math.random() < 0.12) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'serpent') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 60,
            source: 'serpent_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('🐍 Serpent killed');
        if (Math.random() < 0.12) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'boss-serpent') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 100,
            source: 'boss_serpent_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('🐍 Boss Serpent killed');
        if (Math.random() < 0.12) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'tiger') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 60,
            source: 'tiger_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('🐯 Tiger killed');
        if (Math.random() < 0.12) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'boss-tiger') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 100,
            source: 'boss_tiger_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('🐯 Boss Tiger killed');
        if (Math.random() < 0.12) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'wolf') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 60,
            source: 'wolf_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        // Spirit wolves (shaman summons) must not count toward room clear quota.
        if (!enemy.summonerId) {
          this._registerCoopWaveKill('🐺 Wolf killed');
        }
        if (Math.random() < 0.12) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'boss-wolf') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 100,
            source: 'boss_wolf_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('🐺 Boss Wolf killed');
        if (Math.random() < 0.12) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'bear') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 60,
            source: 'bear_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('🐻 Bear killed');
        if (Math.random() < 0.12) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'boss-bear') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 120,
            source: 'boss_bear_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('🐻 Boss Bear killed');
        if (Math.random() < 0.12) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'skyray') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 60,
            source: 'skyray_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('🌊 Skyray killed');
        if (Math.random() < 0.12) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'frost-queen') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 60,
            source: 'frost_queen_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('❄️ Frost Queen killed');
        if (Math.random() < 0.12) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'wyvern') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 90,
            source: 'wyvern_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('🐉 Wyvern killed');
        if (Math.random() < 0.12) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'terrorhawk') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 90,
            source: 'terrorhawk_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('🦅 Terrorhawk killed');
        if (Math.random() < 0.12) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'bone-spider') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 90,
            source: 'bone_spider_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('🕷 Bone Spider killed');
        if (Math.random() < 0.12) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'sentinel') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 75,
            source: 'sentinel_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('🛡️ Sentinel killed');
        if (Math.random() < 0.12) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'nemesis') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 90,
            source: 'nemesis_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('⚔️ Nemesis killed');
        if (Math.random() < 0.15) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'stone-giant') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 100,
            source: 'stone_giant_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('🗿 Stone Giant killed');
        if (Math.random() < 0.15) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'eternal-oak') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 100,
            source: 'eternal_oak_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('🌳 Eternal Oak killed');
        if (Math.random() < 0.15) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'colossus') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 110,
            source: 'colossus_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('🏔️ Colossus killed');
        if (Math.random() < 0.15) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'valkyrie') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 85,
            source: 'valkyrie_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('🪽 Valkyrie killed');
        if (Math.random() < 0.12) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'medusa') {
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 90,
            source: 'medusa_kill',
            enemyId,
            timestamp: Date.now(),
          });
        }
        this._registerCoopWaveKill('🐍 Medusa killed');
        if (Math.random() < 0.12) this.spawnItemDrop(enemy.position, enemy);
        if (this.enemyAI) this.enemyAI.removeEnemyAggro(enemyId);
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }, 2500);
        return result;

      } else if (enemy.type === 'viper') {
        // Award EXP for viper kills
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 60,
            source: 'viper_kill',
            enemyId: enemyId,
            timestamp: Date.now()
          });
        }

        this._registerCoopWaveKill('🐍 Viper killed');

        if (Math.random() < 0.12) {
          this.spawnItemDrop(enemy.position, enemy);
        }

        if (this.enemyAI) {
          this.enemyAI.removeEnemyAggro(enemyId);
        }

        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          console.log(`🗑️ Viper ${enemyId} removed from enemies map after death fade`);
          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
          }
        }, 2500);

        return result;

      } else if (enemy.type === 'tentacle-spine') {
        if (this.currentCoopRoomKind === 'false_eden') {
          this._registerFalseEdenKill();
        }
        if (this.enemyAI) {
          this.enemyAI.clearTrapPendingSlam(enemyId);
          this.enemyAI.clearTrapAsAggroTarget(enemyId);
          this.enemyAI.removeEnemyAggro(enemyId);
        }
        // Match Death clip from tentacle_death.glb (~3.434s) so clients can finish the animation.
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
          }
        }, 3600);
        return result;

      } else if (enemy.type === 'greed') {
        if (this.coopDeepSanctumActive && enemy._deepSanctumRequired) {
          this._registerDeepSanctumKill('💰 Greed killed');
        }
        // Bonus enemy: gold stacks only, no EXP, never counts toward the room's kill quota.
        this._spawnGreedGoldDrops(enemy);
        if (this.enemyAI) {
          this.enemyAI.removeEnemyAggro(enemyId);
        }
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          console.log(`🗑️ Greed ${enemyId} removed from enemies map after death fade`);
          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
          }
        }, 1500);
        return result;

      } else if (enemy.type === 'player-zombie') {
        if (this.enemyAI) {
          this.enemyAI.clearZombieAsAggroTarget(enemyId);
          this.enemyAI.unregisterPlayerZombie(enemy.ownerPlayerId, enemyId);
          this.enemyAI.removeEnemyAggro(enemyId);
        }
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
          }
        }, 1500);
        return result;

      } else {
        // Normal enemy kill rewards
        // Increment shared kill count
        this.killCount++;

        // Award +10 EXP for enemy kills to the killer in co-op mode
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          // Broadcast enemy kill experience to the killer using the new event format
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 10,
            source: 'enemy_kill',
            enemyId: enemyId,
            timestamp: Date.now()
          });
        }

        // Update all players' max health and heal them by 1
        const healthBeforeKillBonus = new Map();
        this.players.forEach((player, playerId) => {
          healthBeforeKillBonus.set(playerId, {
            health: player.health,
            maxHealth: player.maxHealth,
          });
        });

        this.players.forEach((player, playerId) => {
          const newMaxHealth = 200 + this.killCount;
          const newHealth = Math.min(newMaxHealth, player.health + 1);
          player.maxHealth = newMaxHealth;
          player.health = newHealth;
        });

        // Broadcast kill count update to all players
        if (this.io) {
          this.io.to(this.roomId).emit('kill-count-updated', {
            killCount: this.killCount,
            killedBy: fromPlayerId,
            enemyType: enemy.type,
            timestamp: Date.now()
          });

          this.players.forEach((player, playerId) => {
            const before = healthBeforeKillBonus.get(playerId);
            if (
              before &&
              before.health === player.health &&
              before.maxHealth === player.maxHealth
            ) {
              return;
            }
            this.io.to(this.roomId).emit('player-health-updated', {
              playerId: playerId,
              health: player.health,
              maxHealth: player.maxHealth
            });
          });
        }
      }

      // Clean up aggro when enemy dies
      if (this.enemyAI) {
        this.enemyAI.removeEnemyAggro(enemyId);
      }

      // Schedule enemy removal after death animation
      this._scheduleTimeout(() => {
        this._pruneEnemyMaps(enemyId);
        this.enemies.delete(enemyId);
        if (this.io) {
          this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
        }
      }, 1500); // Match death animation duration
    }

    return result;
  }

  /**
   * Snapshot of living enemies. Allocates a new array — prefer `this.enemies.values()`
   * in hot combat/hazard loops; keep this for network payloads and one-shot snapshots.
   */
  getEnemies() {
    return Array.from(this.enemies.values());
  }

  /** Archetype list for clients (same shape as `camps-initialized`). */
  getCampTypes() {
    return [...this.sessionCampTypes];
  }

  getEnemy(enemyId) {
    return this.enemies.get(enemyId);
  }

  // Add enemy to the game (used by boss summoning)
  addEnemy(enemyData) {
    this.enemies.set(enemyData.id, enemyData);
    console.log(`➕ Enemy ${enemyData.id} (${enemyData.type}) added to room ${this.roomId}`);
    this.startEnemyAI();
  }

  // Function to calculate level based on kill count (same as Scene.tsx)
  getLevel(kills) {
    // Kill thresholds scaled ~1.75× from 10 / 25 / 45 / 70 (aligned with client EXP pacing)
    if (kills < 18) return 1;
    if (kills < 44) return 2;
    if (kills < 79) return 3;
    if (kills < 123) return 4;
    return 5;
  }

  // Stop timed spawns (boss prep timer)
  stopEnemySpawning() {
    if (this.bossSpawnTimer) {
      clearTimeout(this.bossSpawnTimer);
      this.bossSpawnTimer = null;
    }
  }

  // Spawn the boss enemy
  // @param {string|null} forceType — optional explicit boss type ('boss'|'boss2'|'boss3'|'destiny')
  spawnBoss(forceType = null) {
    if (!this.gameStarted || this.bossSpawned) {
      this._devSpawnBoss2 = false;
      this._devSpawnBoss3 = false;
      this._devSpawnDestiny = false;
      return null;
    }

    const forceDestiny = this._devSpawnDestiny === true;
    const forceBoss3 = this._devSpawnBoss3 === true;
    const forceBoss2 = this._devSpawnBoss2 === true;
    if (forceDestiny) {
      this._devSpawnDestiny = false;
    }
    if (forceBoss3) {
      this._devSpawnBoss3 = false;
    }
    if (forceBoss2) {
      this._devSpawnBoss2 = false;
    }

    // ── Triple-boss encounter (4th fight: "The Trinity") ──────────────────────
    if (this.coopThroneBossKind === 'boss_all' && !forceType) {
      return this._spawnTripleBoss();
    }

    let bossType = 'boss';
    if (forceType && COOP_BOSS_TYPES.has(forceType)) {
      bossType = forceType;
    } else if (forceDestiny || this.coopThroneBossKind === 'destiny') {
      bossType = 'destiny';
    } else if (forceBoss3 || this.coopThroneBossKind === 'boss3') {
      bossType = 'boss3';
    } else if (forceBoss2 || this.coopThroneBossKind === 'boss2') {
      bossType = 'boss2';
    }

    const bossId = `${bossType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Spawn boss at center of arena
    const position = { x: 0, y: 0, z: 0 };

    const maxHealth = this.getCoopBossMaxHealth(bossType);
    const moveSpeed =
      bossType === 'boss3' || bossType === 'boss2' ? 2.0
      : bossType === 'destiny' ? 2.5
      : 2.5;

    const bossData = {
      id: bossId,
      type: bossType,
      position,
      initialPosition: { ...position },
      rotation: rotationYTowardEntry(0, 0),
      health: maxHealth,
      maxHealth: maxHealth,
      moveSpeed,
      spawnedAt: Date.now(),
      isDying: false,
      staggerBuildup: 0,
      bossStationary: false,
      ...(bossType === 'boss3' ? { summonChargesLeft: 2 } : {}),
      ...(bossType === 'destiny'
        ? {
            attackVariant: 1,
            breathVariant: 1,
            visualScale: 1.8,
            damage: 71,
            destinyPhase: 'ground',
            flyPhaseCompleted: false,
            flyAttackVolleysFired: 0,
            nextAirEmberAt: 0,
          }
        : {}),
    };

    this.enemies.set(bossId, bossData);

    // Broadcast boss spawn to all players with special event
    if (this.io) {
      this.io.to(this.roomId).emit('boss-spawned', {
        boss: bossData,
        timestamp: Date.now()
      });

      // Also broadcast as regular enemy spawn for compatibility
      broadcastEnemySpawn(this.io, this.roomId, bossData);
    }

    const label =
      bossType === 'destiny'
        ? 'Boss tier 3 (Destiny)'
        : bossType === 'boss3'
          ? 'Boss (Weaver Nexus)'
          : bossType === 'boss2'
            ? 'Boss tier 2 (Archon)'
            : 'Boss tier 1';
    console.log(`👹 ${label} spawned with ${maxHealth} HP at center of arena!`);
    this.startEnemyAI();
    return bossData;
  }

  /**
   * Boss-2 encounter slot: 50% early Weaver (boss3), else 60% Archon (boss2) / 40% Weaver.
   * Slot kind stays `boss2`; the spawned enemy type may be boss2 or boss3.
   */
  spawnBoss2Encounter() {
    if (!this.gameStarted || this.bossSpawned) {
      return null;
    }
    let bossType = 'boss2';
    if (Math.random() < COOP_BOSS2_WEAVER_EARLY_CHANCE) {
      bossType = 'boss3';
    } else if (Math.random() >= COOP_BOSS2_WARLOCK_CHANCE) {
      bossType = 'boss3';
    }
    console.log(`👹 Boss-2 encounter roll → ${bossType}`);
    return this.spawnBoss(bossType);
  }

  /**
   * Alternate Boss1 encounter: two elite knights (random distinct colors) instead of the GLB boss.
   * Both IDs are tracked in `this.boss1EliteKnightIds`; the encounter completes only when both fall.
   */
  spawnBoss1EliteKnights() {
    if (!this.gameStarted || this.bossSpawned) {
      return null;
    }

    const now = Date.now();
    const rand = () => Math.random().toString(36).substr(2, 9);
    const shuffled = [...KNIGHT_SOUL_TYPES].sort(() => Math.random() - 0.5);
    const soulTypes = shuffled.slice(0, 2);

    const spawnConfigs = [
      { soulType: soulTypes[0], pos: { x: -4, y: 0, z: 2 } },
      { soulType: soulTypes[1], pos: { x: 4, y: 0, z: 2 } },
    ];

    this.boss1EliteKnightIds = new Set();
    const spawnedKnights = [];

    for (const cfg of spawnConfigs) {
      const stats = KNIGHT_SOUL_STATS[cfg.soulType];
      const knightId = `knight-boss1-elite-${cfg.soulType}-${now}-${rand()}`;
      const maxHealth = Math.round(stats.maxHealth * BOSS1_ELITE_HEALTH_MULT);
      const knightData = {
        id: knightId,
        type: 'knight',
        position: { ...cfg.pos },
        initialPosition: { ...cfg.pos },
        rotation: rotationYTowardEntry(cfg.pos.x, cfg.pos.z),
        health: maxHealth,
        maxHealth,
        damage: KNIGHT_DAMAGE_BY_TIER[cfg.soulType][0],
        attackCooldown: stats.attackCooldown,
        moveSpeed: stats.moveSpeed * BOSS1_ELITE_SPEED_MULT,
        spawnedAt: now,
        isDying: false,
        staggerBuildup: 0,
        campIndex: 0,
        campType: cfg.soulType,
        soulType: cfg.soulType,
        bossId: null,
        visualScale: BOSS1_ELITE_SIZE_SCALE,
        isBoss1EliteKnight: true,
      };

      this.enemies.set(knightId, knightData);
      this.boss1EliteKnightIds.add(knightId);
      spawnedKnights.push(knightData);

      if (this.io) {
        broadcastEnemySpawn(this.io, this.roomId, knightData);
      }
    }

    console.log(
      `⚔️⚔️ Boss1 elite knights spawned (${soulTypes.join(' + ')})! IDs: ${[...this.boss1EliteKnightIds].join(', ')}`
    );
    this.startEnemyAI();
    return spawnedKnights;
  }

  /**
   * Spawn Weaver, Warlock, and Dragon simultaneously for the Trinity encounter (4th boss fight).
   * Triangle formation: Weaver left, Warlock right, Dragon center back.
   * All three IDs are tracked in `this.tripleBossIds`; the encounter completes only
   * when the last one falls.
   */
  _spawnTripleBoss() {
    const now = Date.now();
    const rand = () => Math.random().toString(36).substr(2, 9);

    // Triangle formation — spread wide enough that bosses don't clip each other.
    const spawnConfigs = [
      { type: 'boss3', pos: { x: -8, y: 0, z:  3 }, moveSpeed: 2.0, extra: { summonChargesLeft: 2 } },
      { type: 'boss2', pos: { x:  8, y: 0, z:  3 }, moveSpeed: 2.0, extra: {} },
      { type: 'destiny', pos: { x:  0, y: 0, z: -9 }, moveSpeed: 2.5, extra: { attackVariant: 1, breathVariant: 1, visualScale: 1.8, damage: 55, destinyPhase: 'ground', flyPhaseCompleted: false, flyAttackVolleysFired: 0, nextAirEmberAt: 0 } },
    ];

    this.tripleBossIds = new Set();
    const spawnedBosses = [];

    for (const cfg of spawnConfigs) {
      const bossId = `${cfg.type}-trinity-${now}-${rand()}`;
      // Trinity is the finale — always use post-Trinity HP on the first (only) fight.
      const maxHealth = COOP_BOSS_MAX_HEALTH_POST_TRINITY[cfg.type]
        ?? COOP_BOSS_MAX_HEALTH_POST_TRINITY.boss;
      const bossData = {
        id: bossId,
        type: cfg.type,
        position: { ...cfg.pos },
        initialPosition: { ...cfg.pos },
        rotation: rotationYTowardEntry(cfg.pos.x, cfg.pos.z),
        health: maxHealth,
        maxHealth,
        moveSpeed: cfg.moveSpeed,
        spawnedAt: now,
        isDying: false,
        staggerBuildup: 0,
        bossStationary: false,
        ...cfg.extra,
      };

      this.enemies.set(bossId, bossData);
      this.tripleBossIds.add(bossId);
      spawnedBosses.push(bossData);

      if (this.io) {
        this.io.to(this.roomId).emit('boss-spawned', { boss: bossData, timestamp: now });
        broadcastEnemySpawn(this.io, this.roomId, bossData);
      }
    }

    console.log(
      `👹👹👹 THE TRINITY spawned — Weaver, Warlock, and Dragon all at once! IDs: ${[...this.tripleBossIds].join(', ')}`
    );
    this.startEnemyAI();
    return spawnedBosses;
  }

  // Start enemy AI system
  startEnemyAI() {
    if (!this.gameStarted || this.players.size === 0) return;
    if (this.gameMode === 'coop' && !this.combatArenaActive) return;
    if (this.gameMode === 'coop') {
      // Main AI already ticks companions — stop the no-op 33ms companion wake.
      this.stopCompanionAI();
      this.enemyAI.startAI();
    }
  }

  // Stop enemy AI system
  stopEnemyAI() {
    this.enemyAI.stopAI();
    // Resume companion-only AI when beasts/spirits still need ticks outside combat AI.
    if (this.gameStarted && this.players.size > 0) {
      this.startCompanionAI();
    }
  }

  // Status effect management methods
  applyStatusEffect(enemyId, effectType, duration, options = {}) {
    const { fromPlayerId = null, player = null, source = null } = options;
    const enemy = this.enemies.get(enemyId);
    if (!enemy) return false;

    const PLAYER_DEBUFF_TYPES = new Set(['stun', 'freeze', 'ignite', 'shadowflame', 'corrupted', 'entangle', 'slow', 'huntersMark']);
    const HOSTILE_ONLY_ALLY_TYPES = new Set(['hostileRoot', 'hostileFreeze']);
    if (PLAYER_DEBUFF_TYPES.has(effectType) && this._isCoopPlayerAllyEnemy(enemy)) {
      return false;
    }
    if (HOSTILE_ONLY_ALLY_TYPES.has(effectType) && !this._isCoopPlayerAllyEnemy(enemy)) {
      return false;
    }

    if (
      effectType === 'corrupted' &&
      (COOP_BOSS_TYPES.has(enemy.type) || enemy.type === 'boss-skeleton')
    ) {
      return false;
    }

    if (
      (effectType === 'stun' || effectType === 'freeze') &&
      enemy.type === 'titan'
    ) {
      return false;
    }

    const hadActiveIgnite = effectType === 'ignite' && this.isEnemyAffectedBy(enemyId, 'ignite');

    if (!this.enemyStatusEffects.has(enemyId)) {
      this.enemyStatusEffects.set(enemyId, {});
    }

    let effectiveDuration = duration;
    if (
      effectType === 'freeze' &&
      (COOP_BOSS_TYPES.has(enemy.type) || enemy.type === 'boss-skeleton')
    ) {
      effectiveDuration = Math.min(duration, BOSS_MAX_FREEZE_MS);
    }

    const effects = this.enemyStatusEffects.get(enemyId);
    effects[effectType] = Date.now() + effectiveDuration;

    // Broadcast status effect to all players
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-status-effect', {
        enemyId,
        effectType,
        duration: effectiveDuration,
        timestamp: Date.now(),
        ...(source ? { source } : {}),
        ...(effectType === 'entangle' && enemy.entanglementTheme
          ? { entangleTheme: enemy.entanglementTheme }
          : {}),
      });
    }

    if (effectType === 'ignite' && !hadActiveIgnite && fromPlayerId) {
      const livePlayer = player || this.players.get(fromPlayerId) || null;
      this._maybeTriggerPyromaniaMeteor(enemyId, fromPlayerId, livePlayer);
    }

    return true;
  }

  /** Clear Sniper Hunter's Mark and broadcast duration 0 so clients drop the reticle. */
  _clearHuntersMark(enemyId) {
    const effects = this.enemyStatusEffects.get(enemyId);
    if (!effects || !effects.huntersMark) return;
    delete effects.huntersMark;
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-status-effect', {
        enemyId,
        effectType: 'huntersMark',
        duration: 0,
        timestamp: Date.now(),
      });
    }
  }

  /** Sentinel entangle — roots allied units, player-zombies, and players. */
  applyHostileRootOnAlly(allyId, durationMs = 5000) {
    const ally = this.enemies.get(allyId);
    if (!ally || !this._isCoopPlayerAllyEnemy(ally)) return false;
    if (ally.isDying || ally.health <= 0) return false;
    return this.applyStatusEffect(allyId, 'hostileRoot', durationMs);
  }

  /** Frost Queen Ice Shards — freezes allied units / player-zombies. */
  applyHostileFreezeOnAlly(allyId, durationMs = 2000) {
    const ally = this.enemies.get(allyId);
    if (!ally || !this._isCoopPlayerAllyEnemy(ally)) return false;
    if (ally.isDying || ally.health <= 0) return false;
    return this.applyStatusEffect(allyId, 'hostileFreeze', durationMs);
  }

  applyHostileRootOnPlayer(playerId, durationMs = 5000) {
    const player = this.players.get(playerId);
    if (!player || player.health <= 0) return false;
    this.applyPlayerStatusEffect(playerId, 'entangle', durationMs);
    if (this.io) {
      this.io.to(this.roomId).emit('player-debuff', {
        targetPlayerId: playerId,
        debuffType: 'entangled',
        duration: durationMs,
        effectData: {
          position: {
            x: player.position.x,
            y: player.position.y,
            z: player.position.z,
          },
        },
        timestamp: Date.now(),
      });
    }
    return true;
  }

  applyHostileCorruptedOnPlayer(playerId, durationMs = 8000, options = {}) {
    const player = this.players.get(playerId);
    if (!player || player.health <= 0) return false;
    this.applyPlayerStatusEffect(playerId, 'corrupted', durationMs);
    if (this.io) {
      this.io.to(this.roomId).emit('player-debuff', {
        targetPlayerId: playerId,
        debuffType: 'corrupted',
        duration: durationMs,
        effectData: {
          position: {
            x: player.position.x,
            y: player.position.y,
            z: player.position.z,
          },
          source: options.source ?? null,
        },
        timestamp: Date.now(),
      });
    }
    return true;
  }

  isEnemyAffectedBy(enemyId, effectType) {
    const effects = this.enemyStatusEffects.get(enemyId);
    if (!effects || !effects[effectType]) return false;

    const now = Date.now();
    if (now > effects[effectType]) {
      // Effect expired, clean it up
      delete effects[effectType];
      return false;
    }

    return true;
  }

  applyPlayerStatusEffect(playerId, type, durationMs) {
    if (!playerId || !(durationMs > 0)) return;
    const existing = this.playerStatusEffects.get(playerId) || {};
    existing[type] = Date.now() + durationMs;
    this.playerStatusEffects.set(playerId, existing);
  }

  isPlayerAffectedBy(playerId, type) {
    const existing = this.playerStatusEffects.get(playerId);
    const expiresAt = existing?.[type];
    if (typeof expiresAt !== 'number') return false;
    if (Date.now() >= expiresAt) {
      delete existing[type];
      return false;
    }
    return true;
  }

  getEnemyStatusEffects(enemyId) {
    const effects = this.enemyStatusEffects.get(enemyId);
    if (!effects) return {};

    const now = Date.now();
    const activeEffects = {};

    // Check each effect and remove expired ones
    Object.keys(effects).forEach(effectType => {
      if (now <= effects[effectType]) {
        activeEffects[effectType] = effects[effectType] - now; // Remaining duration
      } else {
        delete effects[effectType]; // Clean up expired effect
      }
    });

    return activeEffects;
  }

  getBlizzardChillMoveMultiplier(enemyId) {
    const chill = this.enemyChill.get(enemyId);
    if (!chill) return 1;
    const now = Date.now();
    if (now > chill.expiresAt) {
      this.enemyChill.delete(enemyId);
      return 1;
    }
    return 1 - BLIZZARD_CHILL_SLOW_PER_STACK * Math.min(4, chill.stacks);
  }

  /** PYROMANIA (ultimate: red) — fresh Ignite applications also call a Meteor at the target. */
  _maybeTriggerPyromaniaMeteor(enemyId, fromPlayerId, player) {
    if (!fromPlayerId || !player) return;
    if (!player.coopStaggerRoomBoons?.pyromania) return;
    const now = Date.now();
    if (player._pyromaniaMeteorAt && now - player._pyromaniaMeteorAt < PYROMANIA_METEOR_ICD_MS) {
      return;
    }
    const enemy = this.enemies.get(enemyId);
    if (!enemy || enemy.isDying || (enemy.health != null && enemy.health <= 0)) return;
    // Stamp ICD only after validating the enemy so a no-op cannot eat the window.
    player._pyromaniaMeteorAt = now;
    const center = { x: enemy.position.x, y: enemy.position.y ?? 0, z: enemy.position.z };
    this.spawnOneCrossentropyMeteor(
      center,
      fromPlayerId,
      player,
      { damageType: 'crossentropy', crossentropyMeteor: true },
      0,
    );
  }

  /** FROST QUEEN (duo: red + purple) — spawns one guaranteed meteor at a newly FROZEN enemy's position. */
  _maybeTriggerFrostQueenMeteor(enemyId, fromPlayerId, player) {
    if (!fromPlayerId || !player) return;
    if (!player.coopStaggerRoomBoons?.frostQueen) return;
    const enemy = this.enemies.get(enemyId);
    if (!enemy) return;
    const center = { x: enemy.position.x, y: enemy.position.y ?? 0, z: enemy.position.z };
    this.spawnOneCrossentropyMeteor(
      center,
      fromPlayerId,
      player,
      { damageType: 'crossentropy', crossentropyMeteor: true },
      0,
    );
  }

  applyBlizzardChillOnHit(enemyId, fromPlayerId, player) {
    const enemy = this.enemies.get(enemyId);
    if (!enemy || enemy.isDying || enemy.health <= 0) return;
    if (this.isEnemyAffectedBy(enemyId, 'freeze')) return;

    const now = Date.now();
    let chill = this.enemyChill.get(enemyId);
    if (!chill || chill.expiresAt < now) {
      chill = { stacks: 0, expiresAt: 0 };
    }

    chill.stacks += 1;
    chill.expiresAt = now + BLIZZARD_CHILL_STACK_DURATION_MS;

    if (chill.stacks >= BLIZZARD_CHILL_STACKS_TO_FREEZE) {
      this.enemyChill.delete(enemyId);
      this.applyStatusEffect(enemyId, 'freeze', 4000);
      this._maybeTriggerFrostQueenMeteor(enemyId, fromPlayerId, player);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-chill-sync', {
          enemyId,
          stacks: 0,
          expiresAt: now,
          timestamp: now,
        });
      }
    } else {
      this.enemyChill.set(enemyId, chill);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-chill-sync', {
          enemyId,
          stacks: chill.stacks,
          expiresAt: chill.expiresAt,
          timestamp: now,
        });
      }
    }
  }

  applyGlacialBiteChillOnHit(enemyId, fromPlayerId, player) {
    const enemy = this.enemies.get(enemyId);
    if (!enemy || enemy.isDying || enemy.health <= 0) return;
    if (this.isEnemyAffectedBy(enemyId, 'freeze')) return;

    const now = Date.now();
    let chill = this.enemyChill.get(enemyId);
    if (!chill || chill.expiresAt < now) {
      chill = { stacks: 0, expiresAt: 0 };
    }

    chill.stacks += 1;
    chill.expiresAt = now + BLIZZARD_CHILL_STACK_DURATION_MS;

    if (chill.stacks >= BLIZZARD_CHILL_STACKS_TO_FREEZE) {
      this.enemyChill.delete(enemyId);
      this.applyStatusEffect(enemyId, 'freeze', 6000);
      this._maybeTriggerFrostQueenMeteor(enemyId, fromPlayerId, player);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-chill-sync', {
          enemyId,
          stacks: 0,
          expiresAt: now,
          timestamp: now,
        });
      }
    } else {
      this.enemyChill.set(enemyId, chill);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-chill-sync', {
          enemyId,
          stacks: chill.stacks,
          expiresAt: chill.expiresAt,
          timestamp: now,
        });
      }
    }
  }

  applyArcticStingTempestChillOnHit(enemyId, fromPlayerId, player) {
    const enemy = this.enemies.get(enemyId);
    if (!enemy || enemy.isDying || enemy.health <= 0) return;
    if (this.isEnemyAffectedBy(enemyId, 'freeze')) return;

    const now = Date.now();
    let chill = this.enemyChill.get(enemyId);
    if (!chill || chill.expiresAt < now) {
      chill = { stacks: 0, expiresAt: 0 };
    }

    chill.stacks += 1;
    chill.expiresAt = now + BLIZZARD_CHILL_STACK_DURATION_MS;

    if (chill.stacks >= ARCTIC_STING_TEMPEST_CHILL_STACKS_TO_FREEZE) {
      this.enemyChill.delete(enemyId);
      this.applyStatusEffect(enemyId, 'freeze', ARCTIC_STING_TEMPEST_FREEZE_MS);
      this._maybeTriggerFrostQueenMeteor(enemyId, fromPlayerId, player);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-chill-sync', {
          enemyId,
          stacks: 0,
          expiresAt: now,
          timestamp: now,
        });
      }
    } else {
      this.enemyChill.set(enemyId, chill);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-chill-sync', {
          enemyId,
          stacks: chill.stacks,
          expiresAt: chill.expiresAt,
          timestamp: now,
        });
      }
    }
  }

  /** @param {{ campType?: string, type?: string, id?: string }} enemy */
  _resolveAmuletCampColor(enemy) {
    const valid = new Set(['red', 'green', 'blue', 'purple']);
    if (enemy && enemy.campType != null) {
      const c = String(enemy.campType).toLowerCase();
      if (valid.has(c)) return c;
    }
    if (enemy && enemy.type === 'boss-skeleton') {
      const k =
        (Array.isArray(this.sessionCampTypes) && this.sessionCampTypes[0]) || this.lastCoopWaveCampColor;
      if (k != null) {
        const c = String(k).toLowerCase();
        if (valid.has(c)) return c;
      }
    }
    return null;
  }

  _resolveGoldRewardRule(enemy) {
    if (!enemy || !enemy.type) return null;
    const type = String(enemy.type).toLowerCase();
    const soulType = enemy.soulType != null ? String(enemy.soulType).toLowerCase() : null;
    const keyedType = type === 'knight' || type === 'warlock' || type === 'weaver';
    const key = keyedType && soulType ? `${type}:${soulType}` : type;
    return GOLD_REWARD_TABLE[key] || null;
  }

  _rollGoldReward(enemy) {
    const rule = this._resolveGoldRewardRule(enemy);
    if (!rule) return 0;
    if (typeof rule.fixed === 'number') return Math.max(0, Math.floor(rule.fixed));
    const min = Number.isFinite(rule.min) ? Math.floor(rule.min) : 0;
    const max = Number.isFinite(rule.max) ? Math.floor(rule.max) : min;
    if (max <= min) return Math.max(0, min);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  _getGoldRecipientIds() {
    return Array.from(this.players.keys()).sort();
  }

  _splitGoldAcrossRecipients(amount, recipientIds) {
    const total = Math.max(0, Math.floor(amount));
    const ids = Array.isArray(recipientIds) ? recipientIds : [];
    if (ids.length === 0 || total <= 0) return new Map();
    const base = Math.floor(total / ids.length);
    let remainder = total % ids.length;
    const out = new Map();
    for (const playerId of ids) {
      const bonus = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder -= 1;
      out.set(playerId, base + bonus);
    }
    return out;
  }

  spawnGoldDropForKill(enemy) {
    const amount = this._rollGoldReward(enemy);
    if (amount <= 0) return null;
    return this.spawnGoldDrop(enemy?.position, amount, enemy);
  }

  /** Greed's death reward: 5–10 fixed 20-gold stacks scattered around the corpse (bypasses GOLD_REWARD_TABLE). */
  _spawnGreedGoldDrops(enemy) {
    const stackCount = 5 + Math.floor(Math.random() * 6); // 5–10 inclusive
    for (let i = 0; i < stackCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 2.2;
      const pos = {
        x: enemy.position.x + Math.cos(angle) * r,
        z: enemy.position.z + Math.sin(angle) * r,
      };
      this.spawnGoldDrop(pos, 20, enemy);
    }
  }

  spawnGoldDrop(position, amount, enemy = null) {
    if (!position || amount <= 0) return null;
    const dropId = `gold-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const drop = {
      id: dropId,
      amount: Math.floor(amount),
      pieceCount: Math.min(Math.floor(amount), GOLD_VISUAL_PIECE_CAP),
      position: {
        x: position.x,
        y: 0.25,
        z: position.z,
      },
      enemyType: enemy?.type || null,
      soulType: enemy?.soulType || null,
      droppedAt: Date.now(),
    };

    this.goldDrops.set(dropId, drop);

    if (this.io) {
      this.io.to(this.roomId).emit('gold-dropped', {
        drop,
        timestamp: Date.now(),
      });
    }

    this._scheduleTimeout(() => {
      if (this.goldDrops.has(dropId)) {
        this.goldDrops.delete(dropId);
        if (this.io) {
          this.io.to(this.roomId).emit('gold-expired', { dropId, timestamp: Date.now() });
        }
      }
    }, GOLD_DROP_EXPIRE_MS);

    return drop;
  }

  pickupGoldDrop(dropId, pickerPlayerId) {
    const drop = this.goldDrops.get(dropId);
    if (!drop) {
      return null;
    }

    this.goldDrops.delete(dropId);

    const recipientIds = this._getGoldRecipientIds();
    const split = this._splitGoldAcrossRecipients(drop.amount, recipientIds);
    const allocations = [];

    for (const playerId of recipientIds) {
      const player = this.players.get(playerId);
      if (!player) continue;
      const gain = split.get(playerId) || 0;
      if (gain <= 0) continue;
      player.gold = (player.gold || 0) + gain;
      allocations.push({
        playerId,
        amount: gain,
        totalGold: player.gold,
      });
      if (this.io) {
        this.io.to(this.roomId).emit('player-gold-changed', {
          playerId,
          gold: player.gold,
          timestamp: Date.now(),
        });
      }
    }

    if (this.io) {
      this.io.to(this.roomId).emit('gold-picked-up', {
        dropId,
        pickerPlayerId,
        drop,
        allocations,
        timestamp: Date.now(),
      });
    }

    return { drop, allocations };
  }

  getGoldDrops() {
    return Array.from(this.goldDrops.values());
  }

  getMerchantInventory() {
    return this.merchantInventory.map((entry) => ({
      ...entry,
      item: entry.item ? { ...entry.item } : entry.item,
    }));
  }

  _rollBossItemRarity() {
    const r = Math.random();
    if (r < 0.6) return 'common';
    if (r < 0.85) return 'rare';
    if (r < 0.95) return 'epic';
    return 'legendary';
  }

  _buildBossRewardItem(itemDef, rarity, idPrefix, position = { x: 0, z: 0 }) {
    const statBonus = itemDef.bonuses[rarity];
    const itemId = `${idPrefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    return {
      id: itemId,
      type: itemDef.type,
      label: itemDef.label,
      category: 'boss_drop',
      stat: itemDef.stat,
      statBonus,
      rarity,
      position: { x: position.x || 0, y: 0.3, z: position.z || 0 },
      droppedAt: Date.now(),
    };
  }

  _priceMerchantBossItem(rarity, statBonus) {
    const rarityBase = {
      common: 90,
      rare: 140,
      epic: 220,
      legendary: 340,
    }[rarity] || 120;
    return (rarityBase + Math.max(0, statBonus || 0) * 4) * 2;
  }

  _resetMerchantVisitPurchases(player) {
    if (!player) return;
    player.merchantHealPurchasedThisVisit = false;
    player.merchantWeaponTalentPurchasedThisVisit = false;
    player.merchantUtilityPurchasedThisVisit = false;
    player.merchantBackfillDashPurchasedThisVisit = false;
    player.merchantBackfillTalentPurchasedThisVisit = false;
  }

  _getMerchantPurchaseState(player) {
    return {
      dashChargePurchased: !!player.merchantDashChargePurchased,
      weaponTalentPurchases: player.merchantWeaponTalentPurchases || 0,
      oxygenPurchases: player.merchantOxygenPurchases || 0,
      warpdrivePurchases: player.merchantWarpdrivePurchases || 0,
      healPurchasedThisVisit: !!player.merchantHealPurchasedThisVisit,
      weaponTalentPurchasedThisVisit: !!player.merchantWeaponTalentPurchasedThisVisit,
      utilityPurchasedThisVisit: !!player.merchantUtilityPurchasedThisVisit,
      backfillDashPurchasedThisVisit: !!player.merchantBackfillDashPurchasedThisVisit,
      backfillTalentPurchasedThisVisit: !!player.merchantBackfillTalentPurchasedThisVisit,
    };
  }

  _getMerchantPurchaseStatesByPlayer() {
    const result = {};
    for (const [playerId, player] of this.players) {
      result[playerId] = this._getMerchantPurchaseState(player);
    }
    return result;
  }

  _buildFixedMerchantStock() {
    return [
      {
        id: 'merchant-stock-dash-charge',
        kind: 'dash_charge',
        cost: MERCHANT_DASH_CHARGE_COST,
        label: 'Dash Charge',
        description: 'Adds a 4th dash charge for the run.',
      },
      {
        id: 'merchant-stock-weapon-talent',
        kind: 'weapon_talent',
        cost: MERCHANT_WEAPON_TALENT_COST,
        label: 'Weapon Talent',
        description: 'Grants a random unowned class talent from your weapon.',
      },
    ];
  }

  /** Roll a premium relic for a sold-out dash/talent pedestal (once per visit per slot). */
  _rollMerchantBackfillStock(backfillSlot, usedTypes = new Set()) {
    const pool = MERCHANT_BACKFILL_POOL.filter(
      (type) =>
        !usedTypes.has(type)
        && !Array.from(this.players.values()).every((p) => dreamLayerItems.playerOwnsItem(p, type)),
    );
    const pickFrom = pool.length > 0 ? pool : MERCHANT_BACKFILL_POOL.filter((type) => !usedTypes.has(type));
    const fallback = MERCHANT_BACKFILL_POOL.filter((type) => !usedTypes.has(type));
    const candidates = pickFrom.length > 0 ? pickFrom : (fallback.length > 0 ? fallback : [...MERCHANT_BACKFILL_POOL]);
    if (candidates.length === 0) return null;
    const pickType = candidates[Math.floor(Math.random() * candidates.length)];
    usedTypes.add(pickType);
    return {
      id: `merchant-stock-backfill-${backfillSlot}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      kind: 'boss_drop',
      backfillSlot,
      cost: MERCHANT_BACKFILL_COST,
      sold: false,
      label: dreamLayerItems.getDreamLayerItemLabel(pickType),
      description: dreamLayerItems.getDreamLayerItemDescription(pickType),
      item: {
        id: `merchant-backfill-${backfillSlot}-${Date.now()}`,
        type: pickType,
        label: dreamLayerItems.getDreamLayerItemLabel(pickType),
        category: 'boss_drop',
        rarity: 'legendary',
      },
    };
  }

  generateMerchantInventory() {
    for (const player of this.players.values()) {
      this._resetMerchantVisitPurchases(player);
    }
    const pool = [...MERCHANT_BOSS_ITEM_POOL];
    const inventory = [...this._buildFixedMerchantStock()];
    const utilityKind = Math.random() < 0.5 ? 'oxygen' : 'warpdrive';
    inventory.push({
      id: `merchant-stock-utility-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      kind: utilityKind,
      cost: utilityKind === 'oxygen' ? MERCHANT_OXYGEN_COST : MERCHANT_WARPDRIVE_COST,
      label: utilityKind === 'oxygen' ? 'Oxygen' : 'Warpdrive',
      description:
        utilityKind === 'oxygen'
          ? 'Increases max Energy by 20 (up to 160).'
          : 'Increases dash distance (up to 3 purchases).',
    });
    const n = Math.min(MERCHANT_ITEM_COUNT, pool.length);
    for (let i = 0; i < n; i++) {
      let placed = false;
      while (pool.length > 0 && !placed) {
        // Prefer types that can still be offered as an upgrade for at least one player.
        const eligiblePool = pool.filter((itemDef) => {
          const players = Array.from(this.players.values());
          if (players.length === 0) return true;
          return !players.every((p) => this._getBossRelicRarity(p, itemDef.type) === 'legendary');
        });
        const pickFrom = eligiblePool.length > 0 ? eligiblePool : pool;
        const pickIndex = Math.floor(Math.random() * pickFrom.length);
        const itemDef = pickFrom[pickIndex];
        const removeIdx = pool.findIndex((d) => d.type === itemDef.type);
        if (removeIdx >= 0) pool.splice(removeIdx, 1);

        let rarity = this._rollBossItemRarity();
        const ownedRarities = Array.from(this.players.values())
          .map((p) => this._getBossRelicRarity(p, itemDef.type))
          .filter((r) => r != null);
        if (ownedRarities.length > 0) {
          let minOwned = ownedRarities[0];
          for (const r of ownedRarities) {
            if (bossRelicItems.compareBossRelicRarity(r, minOwned) < 0) minOwned = r;
          }
          const minOffer = bossRelicItems.nextRarity(minOwned);
          if (minOffer == null) {
            // All owners have legendary — try another type.
            continue;
          }
          if (bossRelicItems.compareBossRelicRarity(rarity, minOffer) < 0) {
            rarity = minOffer;
          }
        }

        const item = this._buildBossRewardItem(itemDef, rarity, `merchant-item-${i}`);
        inventory.push({
          id: `merchant-stock-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
          kind: 'boss_drop',
          cost: this._priceMerchantBossItem(rarity, item.statBonus),
          sold: false,
          item,
        });
        placed = true;
      }
    }

    const usedBackfillTypes = new Set();
    for (const slot of ['dash_charge', 'weapon_talent']) {
      const backfill = this._rollMerchantBackfillStock(slot, usedBackfillTypes);
      if (backfill) inventory.push(backfill);
    }

    const exodiaChance = dreamLayerItems.getMerchantExodiaOfferChance(
      this.coopBossesDefeatedCount,
      this.coopSegmentCombatRoomsCleared,
    );
    if (Math.random() < exodiaChance) {
      const exodiaPool = dreamLayerItems.MERCHANT_EXODIA_POOL.filter(
        (type) => !Array.from(this.players.values()).every((p) => dreamLayerItems.playerOwnsItem(p, type)),
      );
      if (exodiaPool.length > 0) {
        const pickType = exodiaPool[Math.floor(Math.random() * exodiaPool.length)];
        inventory.push({
          id: `merchant-stock-exodia-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          kind: 'boss_drop',
          cost: dreamLayerItems.rollMerchantExodiaCost(),
          sold: false,
          label: dreamLayerItems.getDreamLayerItemLabel(pickType),
          description: dreamLayerItems.getDreamLayerItemDescription(pickType),
          item: {
            id: `merchant-exodia-${Date.now()}`,
            type: pickType,
            label: dreamLayerItems.getDreamLayerItemLabel(pickType),
            category: 'boss_drop',
            rarity: 'legendary',
          },
        });
      }
    }

    this.merchantInventory = inventory;
    if (this.io) {
      this.io.to(this.roomId).emit('merchant-inventory-updated', {
        inventory: this.getMerchantInventory(),
        merchantPurchaseStates: this._getMerchantPurchaseStatesByPlayer(),
        timestamp: Date.now(),
      });
    }
    return this.getMerchantInventory();
  }

  _emitMerchantPurchaseFailure(playerId, reason) {
    if (!this.io) return;
    this.io.to(playerId).emit('merchant-purchase-failed', {
      reason,
      timestamp: Date.now(),
    });
  }

  _isMerchantRoomOpen() {
    return this.gameMode === 'coop' && (
      this.currentCoopRoomKind === 'merchant' ||
      this.clearedCoopRoomKind === 'merchant'
    );
  }

  _emitMerchantNpcGreet(kind) {
    if (!this.io) return;
    this.io.to(this.roomId).emit('merchant-npc-greet', {
      kind,
      timestamp: Date.now(),
    });
  }

  purchaseMerchantItem(playerId, stockId) {
    const player = this.players.get(playerId);
    if (!player || !this._isMerchantRoomOpen()) {
      this._emitMerchantPurchaseFailure(playerId, 'merchant_closed');
      return false;
    }
    const entry = this.merchantInventory.find((item) => item.id === stockId);
    if (!entry) {
      this._emitMerchantPurchaseFailure(playerId, 'item_unavailable');
      return false;
    }

    const kind = entry.kind || 'boss_drop';
    const backfillSlot = entry.backfillSlot || null;
    if (kind === 'boss_drop') {
      if (backfillSlot === 'dash_charge') {
        if (!player.merchantDashChargePurchased) {
          this._emitMerchantPurchaseFailure(playerId, 'backfill_not_available');
          return false;
        }
        if (player.merchantBackfillDashPurchasedThisVisit) {
          this._emitMerchantPurchaseFailure(playerId, 'backfill_already_purchased_this_visit');
          return false;
        }
      } else if (backfillSlot === 'weapon_talent') {
        if ((player.merchantWeaponTalentPurchases || 0) < MERCHANT_WEAPON_TALENT_MAX) {
          this._emitMerchantPurchaseFailure(playerId, 'backfill_not_available');
          return false;
        }
        if (player.merchantBackfillTalentPurchasedThisVisit) {
          this._emitMerchantPurchaseFailure(playerId, 'backfill_already_purchased_this_visit');
          return false;
        }
      } else if (entry.sold) {
        this._emitMerchantPurchaseFailure(playerId, 'item_unavailable');
        return false;
      }
    } else if (kind === 'dash_charge') {
      if (player.merchantDashChargePurchased) {
        this._emitMerchantPurchaseFailure(playerId, 'dash_charge_already_purchased');
        return false;
      }
    } else if (kind === 'weapon_talent') {
      if (player.merchantWeaponTalentPurchasedThisVisit) {
        this._emitMerchantPurchaseFailure(playerId, 'weapon_talent_already_purchased_this_visit');
        return false;
      }
      if ((player.merchantWeaponTalentPurchases || 0) >= MERCHANT_WEAPON_TALENT_MAX) {
        this._emitMerchantPurchaseFailure(playerId, 'weapon_talent_limit_reached');
        return false;
      }
    } else if (kind === 'oxygen') {
      if (player.merchantUtilityPurchasedThisVisit) {
        this._emitMerchantPurchaseFailure(playerId, 'utility_already_purchased_this_visit');
        return false;
      }
      if ((player.merchantOxygenPurchases || 0) >= MERCHANT_UTILITY_MAX) {
        this._emitMerchantPurchaseFailure(playerId, 'oxygen_limit_reached');
        return false;
      }
    } else if (kind === 'warpdrive') {
      if (player.merchantUtilityPurchasedThisVisit) {
        this._emitMerchantPurchaseFailure(playerId, 'utility_already_purchased_this_visit');
        return false;
      }
      if ((player.merchantWarpdrivePurchases || 0) >= MERCHANT_UTILITY_MAX) {
        this._emitMerchantPurchaseFailure(playerId, 'warpdrive_limit_reached');
        return false;
      }
    } else {
      this._emitMerchantPurchaseFailure(playerId, 'item_unavailable');
      return false;
    }

    if ((player.gold || 0) < entry.cost) {
      this._emitMerchantPurchaseFailure(playerId, 'not_enough_gold');
      return false;
    }

    if (kind === 'boss_drop') {
      const itemType = entry.item?.type;
      if (itemType && dreamLayerItems.isUniqueDreamLayerItem(itemType) && dreamLayerItems.playerOwnsItem(player, itemType)) {
        this._emitMerchantPurchaseFailure(playerId, 'item_already_owned');
        return false;
      }
      if (
        itemType
        && bossRelicItems.isUpgradeableBossRelic(itemType)
        && !bossRelicItems.canAcquireBossRelic(this._getBossRelicRarity(player, itemType), entry.item?.rarity)
      ) {
        this._emitMerchantPurchaseFailure(playerId, 'item_already_owned');
        return false;
      }
    }

    player.gold = (player.gold || 0) - entry.cost;

    if (kind === 'dash_charge') {
      player.merchantDashChargePurchased = true;
      if (this.io) {
        this.io.to(this.roomId).emit('player-gold-changed', {
          playerId,
          gold: player.gold,
          timestamp: Date.now(),
        });
        this.io.to(playerId).emit('merchant-purchase-succeeded', {
          stockId,
          kind: 'dash_charge',
          cost: entry.cost,
          merchantPurchaseState: this._getMerchantPurchaseState(player),
          timestamp: Date.now(),
        });
      }
      return true;
    }

    if (kind === 'weapon_talent') {
      player.merchantWeaponTalentPurchases = (player.merchantWeaponTalentPurchases || 0) + 1;
      player.merchantWeaponTalentPurchasedThisVisit = true;
      if (this.io) {
        this.io.to(this.roomId).emit('player-gold-changed', {
          playerId,
          gold: player.gold,
          timestamp: Date.now(),
        });
        this.io.to(playerId).emit('merchant-purchase-succeeded', {
          stockId,
          kind: 'weapon_talent',
          cost: entry.cost,
          purchaseCount: player.merchantWeaponTalentPurchases,
          merchantPurchaseState: this._getMerchantPurchaseState(player),
          timestamp: Date.now(),
        });
      }
      return true;
    }

    if (kind === 'oxygen') {
      player.merchantOxygenPurchases = (player.merchantOxygenPurchases || 0) + 1;
      player.merchantUtilityPurchasedThisVisit = true;
      const fireAffinityEnergyBonus =
        String(player.weaponAspect || '').toUpperCase() === 'FIRE_AFFINITY' ? 25 : 0;
      const nextMaxEnergy = 100 + player.merchantOxygenPurchases * 20 + fireAffinityEnergyBonus;
      player.maxEnergy = nextMaxEnergy;
      player.energy = Math.min(nextMaxEnergy, (player.energy || 0) + 20);
      if (this.io) {
        this.io.to(this.roomId).emit('player-gold-changed', {
          playerId,
          gold: player.gold,
          timestamp: Date.now(),
        });
        this.io.to(playerId).emit('merchant-purchase-succeeded', {
          stockId,
          kind: 'oxygen',
          cost: entry.cost,
          purchaseCount: player.merchantOxygenPurchases,
          merchantPurchaseState: this._getMerchantPurchaseState(player),
          timestamp: Date.now(),
        });
      }
      return true;
    }

    if (kind === 'warpdrive') {
      player.merchantWarpdrivePurchases = (player.merchantWarpdrivePurchases || 0) + 1;
      player.merchantUtilityPurchasedThisVisit = true;
      if (this.io) {
        this.io.to(this.roomId).emit('player-gold-changed', {
          playerId,
          gold: player.gold,
          timestamp: Date.now(),
        });
        this.io.to(playerId).emit('merchant-purchase-succeeded', {
          stockId,
          kind: 'warpdrive',
          cost: entry.cost,
          purchaseCount: player.merchantWarpdrivePurchases,
          merchantPurchaseState: this._getMerchantPurchaseState(player),
          timestamp: Date.now(),
        });
      }
      return true;
    }

    // Boss drop (including pedestal backfill for sold-out dash/talent).
    if (backfillSlot === 'dash_charge') {
      player.merchantBackfillDashPurchasedThisVisit = true;
    } else if (backfillSlot === 'weapon_talent') {
      player.merchantBackfillTalentPurchasedThisVisit = true;
    } else {
      entry.sold = true;
    }
    const item = {
      ...entry.item,
      id: `merchant-purchase-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      pickedUpAt: Date.now(),
    };

    if (item.type && dreamLayerItems.isUniqueDreamLayerItem(item.type)) {
      this._registerPlayerDreamLayerItem(playerId, player, item.type);
    }
    if (item.type && bossRelicItems.isUpgradeableBossRelic(item.type)) {
      this._registerBossRelic(player, item.type, item.rarity);
    }

    if (this.io) {
      this.io.to(this.roomId).emit('player-gold-changed', {
        playerId,
        gold: player.gold,
        timestamp: Date.now(),
      });
      this.io.to(this.roomId).emit('item-picked-up', {
        itemId: item.id,
        playerId,
        item,
        timestamp: Date.now(),
      });
      if (!backfillSlot) {
        this.io.to(this.roomId).emit('merchant-inventory-updated', {
          inventory: this.getMerchantInventory(),
          merchantPurchaseStates: this._getMerchantPurchaseStatesByPlayer(),
          timestamp: Date.now(),
        });
      }
      this.io.to(playerId).emit('merchant-purchase-succeeded', {
        stockId,
        kind: 'boss_drop',
        item,
        cost: entry.cost,
        merchantPurchaseState: this._getMerchantPurchaseState(player),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  purchaseMerchantHeal(playerId) {
    const player = this.players.get(playerId);
    if (!player || !this._isMerchantRoomOpen()) {
      this._emitMerchantPurchaseFailure(playerId, 'merchant_closed');
      return false;
    }
    if (player.merchantHealPurchasedThisVisit) {
      this._emitMerchantPurchaseFailure(playerId, 'heal_already_purchased_this_visit');
      return false;
    }
    if ((player.gold || 0) < MERCHANT_HEAL_COST) {
      this._emitMerchantPurchaseFailure(playerId, 'not_enough_gold');
      return false;
    }
    const previousHealth = player.health;
    const nextHealth = Math.min(player.maxHealth, previousHealth + MERCHANT_HEAL_AMOUNT);
    const actualHealingAmount = nextHealth - previousHealth;
    if (actualHealingAmount <= 0) {
      this._emitMerchantPurchaseFailure(playerId, 'already_full_health');
      return false;
    }

    player.gold = (player.gold || 0) - MERCHANT_HEAL_COST;
    player.merchantHealPurchasedThisVisit = true;
    this.updatePlayerHealth(playerId, nextHealth);
    const position = player.position || { x: 0, y: 0, z: 0 };

    if (this.io) {
      this.io.to(this.roomId).emit('player-gold-changed', {
        playerId,
        gold: player.gold,
        timestamp: Date.now(),
      });
      this.io.to(this.roomId).emit('player-health-updated', {
        playerId,
        health: player.health,
        maxHealth: player.maxHealth,
        timestamp: Date.now(),
      });
      this.io.to(this.roomId).emit('player-healing', {
        sourcePlayerId: playerId,
        targetPlayerId: playerId,
        healingAmount: actualHealingAmount,
        healingType: 'merchant',
        position,
        timestamp: Date.now(),
      });
      this.io.to(playerId).emit('merchant-purchase-succeeded', {
        stockId: 'merchant_heal_100',
        kind: 'heal',
        cost: MERCHANT_HEAL_COST,
        healingAmount: actualHealingAmount,
        merchantPurchaseState: this._getMerchantPurchaseState(player),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  _resetDreamLayerVisitPurchases(player) {
    if (!player) return;
    player.dreamLayerHealPurchasedThisVisit = false;
    player.dreamLayerWardingPurchasedThisVisit = false;
    player.dreamLayerLegendaryAPurchasedThisVisit = false;
    player.dreamLayerLegendaryBPurchasedThisVisit = false;
    player.dreamLayerRingPurchasedThisVisit = false;
  }

  _getDreamLayerPurchaseState(player) {
    return {
      healPurchasedThisVisit: !!player.dreamLayerHealPurchasedThisVisit,
      wardingPurchasedThisVisit: !!player.dreamLayerWardingPurchasedThisVisit,
      legendaryAPurchasedThisVisit: !!player.dreamLayerLegendaryAPurchasedThisVisit,
      legendaryBPurchasedThisVisit: !!player.dreamLayerLegendaryBPurchasedThisVisit,
      ringPurchasedThisVisit: !!player.dreamLayerRingPurchasedThisVisit,
    };
  }

  _getDreamLayerPurchaseStatesByPlayer() {
    const result = {};
    for (const [playerId, player] of this.players) {
      result[playerId] = this._getDreamLayerPurchaseState(player);
    }
    return result;
  }

  /** Roll a legendary (armor set piece or ring) for Dream Layer pedestals A/B. */
  _rollDreamLayerCombinedLegendary(usedTypes = new Set()) {
    const pool = DREAM_LAYER_COMBINED_LEGENDARY_POOL.filter((entry) => !usedTypes.has(entry.type));
    const candidates = pool.length > 0 ? pool : [...DREAM_LAYER_COMBINED_LEGENDARY_POOL];
    if (candidates.length === 0) return null;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    usedTypes.add(pick.type);
    return pick;
  }

  _buildDreamLayerLegendaryStock(kind, pick, ts) {
    return {
      id: `dream-layer-${kind}-${ts}`,
      kind,
      cost: pick.cost,
      sold: false,
      label: pick.label,
      description: dreamLayerItems.getDreamLayerItemDescription(pick.type),
      item: {
        id: `dream-${kind}-${ts}`,
        type: pick.type,
        label: pick.label,
        category: 'boss_drop',
        rarity: 'legendary',
      },
    };
  }

  getDreamLayerInventory() {
    return this.dreamLayerInventory.map((entry) => ({
      ...entry,
      item: entry.item ? { ...entry.item } : entry.item,
    }));
  }

  _emitDreamLayerPurchaseFailure(playerId, reason) {
    if (!this.io) return;
    this.io.to(playerId).emit('dream-layer-purchase-failed', {
      reason,
      timestamp: Date.now(),
    });
  }

  _isDreamLayerRoomOpen() {
    return this.gameMode === 'coop' && this.currentCoopRoomKind === 'dream_layer';
  }

  generateDreamLayerInventory() {
    for (const player of this.players.values()) {
      this._resetDreamLayerVisitPurchases(player);
    }
    const pendant = PENDANT_POOL[Math.floor(Math.random() * PENDANT_POOL.length)];
    const usedLegendaryTypes = new Set();
    const legendaryA = this._rollDreamLayerCombinedLegendary(usedLegendaryTypes);
    const legendaryB = this._rollDreamLayerCombinedLegendary(usedLegendaryTypes);
    const ringPool = DREAM_LAYER_RING_POOL.filter((entry) => !usedLegendaryTypes.has(entry.type));
    const ringPickFrom = ringPool.length > 0 ? ringPool : DREAM_LAYER_RING_POOL;
    const ring = ringPickFrom[Math.floor(Math.random() * ringPickFrom.length)];
    const ts = Date.now();
    this.dreamLayerInventory = [
      {
        id: `dream-layer-warding-${ts}`,
        kind: 'warding_pendant',
        cost: DREAM_LAYER_WARDING_COST,
        sold: false,
        label: pendant.label,
        description: pendant.description,
        item: {
          id: `dream-ward-${ts}`,
          type: pendant.type,
          label: pendant.label,
          category: 'ward',
          bannedEnemyType: pendant.bannedEnemyType,
          iconPath: pendant.iconPath,
        },
      },
    ];
    if (legendaryA) {
      this.dreamLayerInventory.push(this._buildDreamLayerLegendaryStock('legendary_a', legendaryA, ts));
    }
    if (legendaryB) {
      this.dreamLayerInventory.push(this._buildDreamLayerLegendaryStock('legendary_b', legendaryB, `${ts}-b`));
    }
    this.dreamLayerInventory.push({
      id: `dream-layer-ring-${ts}`,
      kind: 'ring',
      cost: ring.cost,
      sold: false,
      label: ring.label,
      description: dreamLayerItems.getDreamLayerItemDescription(ring.type),
      item: {
        id: `dream-ring-${ts}`,
        type: ring.type,
        label: ring.label,
        category: 'boss_drop',
        rarity: 'legendary',
      },
    });
    if (this.io) {
      this.io.to(this.roomId).emit('dream-layer-inventory-updated', {
        inventory: this.getDreamLayerInventory(),
        dreamLayerPurchaseStates: this._getDreamLayerPurchaseStatesByPlayer(),
        timestamp: Date.now(),
      });
    }
    return this.getDreamLayerInventory();
  }

  purchaseDreamLayerItem(playerId, stockId) {
    const player = this.players.get(playerId);
    if (!player || !this._isDreamLayerRoomOpen()) {
      this._emitDreamLayerPurchaseFailure(playerId, 'dream_layer_closed');
      return false;
    }
    const entry = this.dreamLayerInventory.find((item) => item.id === stockId);
    if (!entry || entry.sold) {
      this._emitDreamLayerPurchaseFailure(playerId, 'item_unavailable');
      return false;
    }

    const kind = entry.kind;
    if (kind === 'warding_pendant') {
      if (player.dreamLayerWardingPurchasedThisVisit) {
        this._emitDreamLayerPurchaseFailure(playerId, 'warding_already_purchased_this_visit');
        return false;
      }
    } else if (kind === 'legendary_a') {
      if (player.dreamLayerLegendaryAPurchasedThisVisit) {
        this._emitDreamLayerPurchaseFailure(playerId, 'legendary_a_already_purchased_this_visit');
        return false;
      }
    } else if (kind === 'legendary_b') {
      if (player.dreamLayerLegendaryBPurchasedThisVisit) {
        this._emitDreamLayerPurchaseFailure(playerId, 'legendary_b_already_purchased_this_visit');
        return false;
      }
    } else if (kind === 'ring') {
      if (player.dreamLayerRingPurchasedThisVisit) {
        this._emitDreamLayerPurchaseFailure(playerId, 'ring_already_purchased_this_visit');
        return false;
      }
    } else {
      this._emitDreamLayerPurchaseFailure(playerId, 'item_unavailable');
      return false;
    }

    if ((player.flow || 0) < entry.cost) {
      this._emitDreamLayerPurchaseFailure(playerId, 'not_enough_flow');
      return false;
    }

    const itemType = entry.item?.type;
    if (itemType && dreamLayerItems.isUniqueOwnedItem(itemType) && dreamLayerItems.playerOwnsItem(player, itemType)) {
      this._emitDreamLayerPurchaseFailure(playerId, 'item_already_owned');
      return false;
    }
    if (itemType === 'PERSEPHONE' && (player.hasPersephone || player.persephoneConsumed || dreamLayerItems.playerOwnsItem(player, 'PERSEPHONE'))) {
      this._emitDreamLayerPurchaseFailure(playerId, 'item_already_owned');
      return false;
    }

    player.flow = (player.flow || 0) - entry.cost;
    entry.sold = true;

    if (kind === 'warding_pendant') {
      player.dreamLayerWardingPurchasedThisVisit = true;
    } else if (kind === 'legendary_a') {
      player.dreamLayerLegendaryAPurchasedThisVisit = true;
    } else if (kind === 'legendary_b') {
      player.dreamLayerLegendaryBPurchasedThisVisit = true;
    } else if (kind === 'ring') {
      player.dreamLayerRingPurchasedThisVisit = true;
    }

    const item = {
      ...entry.item,
      id: `${entry.item?.type || kind}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    };

    if (kind === 'warding_pendant' && item.bannedEnemyType) {
      this.bannedEnemyTypes.add(item.bannedEnemyType);
    }

    if (item.type) {
      this._registerPlayerDreamLayerItem(playerId, player, item.type);
    }

    if (this.io) {
      this.io.to(this.roomId).emit('player-flow-changed', {
        playerId,
        flow: player.flow,
        timestamp: Date.now(),
      });
      this.io.to(this.roomId).emit('item-picked-up', {
        itemId: item.id,
        playerId,
        item,
        timestamp: Date.now(),
      });
      this.io.to(this.roomId).emit('dream-layer-inventory-updated', {
        inventory: this.getDreamLayerInventory(),
        dreamLayerPurchaseStates: this._getDreamLayerPurchaseStatesByPlayer(),
        timestamp: Date.now(),
      });
      this.io.to(playerId).emit('dream-layer-purchase-succeeded', {
        stockId,
        kind,
        item,
        cost: entry.cost,
        dreamLayerPurchaseState: this._getDreamLayerPurchaseState(player),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  purchaseDreamLayerHeal(playerId) {
    const player = this.players.get(playerId);
    if (!player || !this._isDreamLayerRoomOpen()) {
      this._emitDreamLayerPurchaseFailure(playerId, 'dream_layer_closed');
      return false;
    }
    if (player.dreamLayerHealPurchasedThisVisit) {
      this._emitDreamLayerPurchaseFailure(playerId, 'heal_already_purchased_this_visit');
      return false;
    }
    if ((player.flow || 0) < DREAM_LAYER_HEAL_COST) {
      this._emitDreamLayerPurchaseFailure(playerId, 'not_enough_flow');
      return false;
    }
    const previousHealth = player.health;
    const nextHealth = Math.min(player.maxHealth, previousHealth + DREAM_LAYER_HEAL_AMOUNT);
    const actualHealingAmount = nextHealth - previousHealth;
    if (actualHealingAmount <= 0) {
      this._emitDreamLayerPurchaseFailure(playerId, 'already_full_health');
      return false;
    }

    player.flow = (player.flow || 0) - DREAM_LAYER_HEAL_COST;
    player.dreamLayerHealPurchasedThisVisit = true;
    this.updatePlayerHealth(playerId, nextHealth);
    const position = player.position || { x: 0, y: 0, z: 0 };

    if (this.io) {
      this.io.to(this.roomId).emit('player-flow-changed', {
        playerId,
        flow: player.flow,
        timestamp: Date.now(),
      });
      this.io.to(this.roomId).emit('player-health-updated', {
        playerId,
        health: player.health,
        maxHealth: player.maxHealth,
        timestamp: Date.now(),
      });
      this.io.to(this.roomId).emit('player-healing', {
        sourcePlayerId: playerId,
        targetPlayerId: playerId,
        healingAmount: actualHealingAmount,
        healingType: 'dream_layer',
        position,
        timestamp: Date.now(),
      });
      this.io.to(playerId).emit('dream-layer-purchase-succeeded', {
        stockId: 'dream_layer_heal',
        kind: 'heal',
        cost: DREAM_LAYER_HEAL_COST,
        healingAmount: actualHealingAmount,
        dreamLayerPurchaseState: this._getDreamLayerPurchaseState(player),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  // Spawn an amulet matching the wave room color (red/green/blue/purple) at the given position
  spawnItemDrop(position, enemy) {
    const color = this._resolveAmuletCampColor(enemy || {});
    if (!color) {
      console.log(`💍 No amulet drop: no valid camp color (enemy ${enemy?.id || '?'})`);
      return null;
    }

    const byColor = {
      red: { type: 'AMULET_OF_STRENGTH', stat: 'strength', label: 'Blood Rune' },
      green: { type: 'AMULET_OF_STAMINA', stat: 'stamina', label: 'Life Rune' },
      blue: { type: 'AMULET_OF_AGILITY', stat: 'agility', label: 'Storm Rune' },
      purple: { type: 'AMULET_OF_INTELLECT', stat: 'intellect', label: 'Mind Rune' },
    };

    const chosen = byColor[color];
    if (!chosen) {
      console.log(`💍 No amulet drop: unknown color ${color}`);
      return null;
    }
    const itemId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const item = {
      id: itemId,
      type: chosen.type,
      stat: chosen.stat,
      label: chosen.label,
      position: { x: position.x, y: 0.3, z: position.z },
      droppedAt: Date.now()
    };

    this.droppedItems.set(item.id, item);

    if (this.io) {
      this.io.to(this.roomId).emit('item-dropped', { item, timestamp: Date.now() });
    }

    // Auto-expire after 60 seconds
    this._scheduleTimeout(() => {
      if (this.droppedItems.has(item.id)) {
        this.droppedItems.delete(item.id);
        if (this.io) {
          this.io.to(this.roomId).emit('item-expired', { itemId: item.id, timestamp: Date.now() });
        }
      }
    }, 60000);

    console.log(`💍 Item dropped: ${item.label} (${itemId}) at (${position.x.toFixed(1)}, ${position.z.toFixed(1)})`);
    return item;
  }

  // Drop 1 random boss reward item (type + weighted rarity) when the boss is slain
  spawnBossItemDrops(position) {
    const itemDef = MERCHANT_BOSS_ITEM_POOL[Math.floor(Math.random() * MERCHANT_BOSS_ITEM_POOL.length)];
    const rarity = this._rollBossItemRarity();
    const item = this._buildBossRewardItem(itemDef, rarity, 'boss-item', position);

    this.droppedItems.set(item.id, item);

    if (this.io) {
      this.io.to(this.roomId).emit('item-dropped', { item, timestamp: Date.now() });
    }

    this._scheduleTimeout(() => {
      if (this.droppedItems.has(item.id)) {
        this.droppedItems.delete(item.id);
        if (this.io) {
          this.io.to(this.roomId).emit('item-expired', { itemId: item.id, timestamp: Date.now() });
        }
      }
    }, 180000);

    console.log(`👑 Boss drop: ${item.label} [${rarity}] +${item.statBonus} ${itemDef.stat} (${item.id}) at (${item.position.x.toFixed(1)}, ${item.position.z.toFixed(1)})`);
  }

  _rollDreamLayerLootType() {
    const pool = (dreamLayerItems.DREAM_LAYER_LOOT_POOL || []).filter(
      (type) => !Array.from(this.players.values()).every((p) => dreamLayerItems.playerOwnsItem(p, type)),
    );
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  _buildDreamLayerDropItem(type, position = { x: 0, z: 0 }) {
    const itemId = `dream-drop-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    return {
      id: itemId,
      type,
      label: dreamLayerItems.getDreamLayerItemLabel(type),
      category: 'boss_drop',
      rarity: 'legendary',
      position: { x: position.x || 0, y: 0.3, z: position.z || 0 },
      droppedAt: Date.now(),
    };
  }

  _spawnDreamLayerDrop(position) {
    const type = this._rollDreamLayerLootType();
    if (!type) return null;
    const item = this._buildDreamLayerDropItem(type, position);
    this.droppedItems.set(item.id, item);
    if (this.io) {
      this.io.to(this.roomId).emit('item-dropped', { item, timestamp: Date.now() });
    }
    this._scheduleTimeout(() => {
      if (this.droppedItems.has(item.id)) {
        this.droppedItems.delete(item.id);
        if (this.io) {
          this.io.to(this.roomId).emit('item-expired', { itemId: item.id, timestamp: Date.now() });
        }
      }
    }, 180000);
    console.log(`✨ Dream Layer drop: ${item.label} (${item.id}) at (${item.position.x.toFixed(1)}, ${item.position.z.toFixed(1)})`);
    return item;
  }

  /**
   * Roll a Dream Layer unique drop on enemy death.
   * Bosses use tiered rates; elites 4%; other non-ghouls 0.5%.
   */
  _tryDreamLayerDropOnKill(enemy) {
    if (!enemy || !enemy.position) return null;
    if (enemy.type === 'ghoul') return null;

    let chance = dreamLayerItems.DREAM_LAYER_ENEMY_DROP_CHANCE;
    if (COOP_BOSS_TYPES.has(enemy.type)) {
      chance = dreamLayerItems.DREAM_LAYER_BOSS_DROP_CHANCE[enemy.type]
        ?? dreamLayerItems.DREAM_LAYER_ENEMY_DROP_CHANCE;
    } else if (
      enemy.type === 'nemesis'
      || enemy.type === 'valkyrie'
      || enemy.type === 'medusa'
      || enemy.type === 'titan'
      || enemy.type === 'stone-giant'
      || enemy.type === 'eternal-oak'
      || enemy.type === 'colossus'
      || (enemy.type === 'knight' && enemy.isBoss1EliteKnight)
    ) {
      chance = dreamLayerItems.DREAM_LAYER_ELITE_DROP_CHANCE;
    }

    if (Math.random() >= chance) return null;
    return this._spawnDreamLayerDrop(enemy.position);
  }

  // Handle a player picking up an item
  pickupItem(itemId, playerId) {
    const item = this.droppedItems.get(itemId);
    if (!item) {
      console.log(`⚠️ Pickup failed: item ${itemId} no longer exists`);
      return null;
    }

    const player = this.players.get(playerId);
    if (player?.position && item.position) {
      const dx = player.position.x - item.position.x;
      const dz = player.position.z - item.position.z;
      const distSq = dx * dx + dz * dz;
      const isAmulet =
        item.category !== 'boss_drop'
        && typeof item.type === 'string'
        && item.type.startsWith('AMULET_OF');
      const maxRadius = isAmulet ? 4 : 6;
      if (distSq > maxRadius * maxRadius) {
        console.log(`⚠️ Pickup failed: player ${playerId} too far from item ${itemId}`);
        return null;
      }
    }

    // Always consume the world drop. Discard if the player cannot usefully acquire it.
    this.droppedItems.delete(itemId);

    let discard = false;
    if (player && item.category === 'boss_drop' && item.type) {
      if (dreamLayerItems.isUniqueDreamLayerItem(item.type)) {
        if (dreamLayerItems.playerOwnsItem(player, item.type)) {
          discard = true;
        }
      } else if (bossRelicItems.isUpgradeableBossRelic(item.type)) {
        const outcome = bossRelicItems.resolveBossRelicPickup(
          this._getBossRelicRarity(player, item.type),
          item.rarity,
        );
        if (outcome === 'discard') discard = true;
      }
    }

    if (discard) {
      if (this.io) {
        this.io.to(this.roomId).emit('item-pickup-discarded', {
          itemId,
          playerId,
          item,
          timestamp: Date.now(),
        });
      }
      console.log(`🗑️ Player ${playerId} discarded duplicate ${item.label || item.type}`);
      return item;
    }

    if (player && item.type) {
      if (dreamLayerItems.isUniqueDreamLayerItem(item.type)) {
        this._registerPlayerDreamLayerItem(playerId, player, item.type);
      }
      if (bossRelicItems.isUpgradeableBossRelic(item.type)) {
        this._registerBossRelic(player, item.type, item.rarity);
      }
    }

    if (this.io) {
      this.io.to(this.roomId).emit('item-picked-up', {
        itemId,
        playerId,
        item,
        timestamp: Date.now()
      });
    }

    console.log(`🎁 Player ${playerId} picked up ${item.label}`);
    return item;
  }

  // Cleanup when room is destroyed
  destroy() {
    for (const playerId of this.playerPrimeMateriaAuras.keys()) {
      this.stopPrimeMateriaAura(playerId);
    }
    // Cancel all pending one-shot timers so they cannot emit after teardown
    this._cancelAllTimers();
    for (const id of this.enemies.keys()) {
      this._clearEnemyDoTTimers(id);
    }
    this.stopEnemySpawning();
    this.stopEnemyAI();
    this.stopCompanionAI();

    this.players.clear();
    this.enemies.clear();
    this.enemyStatusEffects.clear();
    this.playerStatusEffects.clear();
    this.enemyChill.clear();
    this.droppedItems.clear();
    this.goldDrops.clear();
    this.merchantInventory = [];
    this.gameStarted = false;
    this.killCount = 0;
    this.bossSpawned = false;
    this.skeletonKillCount = 0;
    this.coopThroneStep = 'rim';
    this.coopMainArenaPortalPhase = null;
    this.coopBossThroneArena = false;
    this.coopThroneBossKind = null;
    this._postBossIntermissionScheduled = false;
    this._clearPreBossSequenceState();
    this.coopSegmentCombatRoomsCleared = 0;
    this.coopBossesDefeatedCount = 0;
    this.coopWaveSpawnPlan = null;
    this.coopRequiredQueue = [];
    this.coopWaveQuota = 0;
    this._coopSpawnChainTimer = null;
    this.roomHasMartyrs = false;
    this.roomHasTitans = false;
    this.roomTitanQuota = 0;
    this.roomTitanSlotIndices = new Set();
    this._clearCoopCombatTransitionTimer();
    this.coopCombatTransition = null;
    this.coopCombatTransitionId = 0;
    this.coopPostTeleportPositionGuardUntil = 0;
    this.coopRoomEntryToken = 0;
    this.coopSkyPresetIndex = 0;
    this.coopGrassPresetIndex = 0;
  }

  // Get room summary for debugging
  getSummary() {
    return {
      roomId: this.roomId,
      playerCount: this.players.size,
      enemyCount: this.enemies.size,
      gameStarted: this.gameStarted,
      killCount: this.killCount,
      lastUpdate: this.lastUpdate
    };
  }

  updatePlayerPosition(playerId, position, rotation, movementDirection, options = {}) {
    const { authoritative = false } = options;
    if (
      !authoritative &&
      (this.isCoopCombatTransitionActive() || this.isCoopPostTeleportPositionGuardActive())
    ) {
      return;
    }
    const player = this.players.get(playerId);
    if (player) {
      player.position = position;
      player.rotation = rotation;
      if (movementDirection) {
        player.movementDirection = movementDirection;
      }
      player.lastUpdate = Date.now();
    }
  }

  updatePlayerWeapon(playerId, weapon, subclass, aspect) {
    const player = this.players.get(playerId);
    if (player) {
      player.weapon = weapon;
      player.subclass = subclass;
      // Optional aspect (throne pedestal / ControlSystem rebroadcast); else reset to default.
      player.weaponAspect = aspect != null
        ? normalizeWeaponAspectForWeapon(aspect, weapon)
        : defaultWeaponAspectForWeapon(weapon);
      this.syncBeastmasterTigerForPlayer(playerId);
    }
  }

  /** Co-op throne prep — persist local archetype selection. */
  updatePlayerArchetype(playerId, archetype) {
    const player = this.players.get(playerId);
    if (!player) return null;
    const raw = archetype != null ? String(archetype).toUpperCase() : 'NONE';
    const allowed = new Set(['NONE', 'ROGUE', 'GLADIATOR', 'ACOLYTE', 'ALCHEMIST', 'SORCERESS']);
    const normalized = allowed.has(raw) ? raw : 'NONE';
    player.archetype = normalized;
    return normalized;
  }

  /** Co-op throne prep — persist weapon aspect selection. */
  updatePlayerWeaponAspect(playerId, aspect) {
    const player = this.players.get(playerId);
    if (!player) return null;
    const normalized = normalizeWeaponAspectForWeapon(aspect, player.weapon);
    player.weaponAspect = normalized;
    this.syncBeastmasterTigerForPlayer(playerId);
    return normalized;
  }

  /** Alchemist Prime Materia — stop the per-player aura tick loop. */
  stopPrimeMateriaAura(playerId) {
    const state = this.playerPrimeMateriaAuras.get(playerId);
    if (!state) return;
    if (state.intervalId != null) {
      clearInterval(state.intervalId);
      this._scheduledTimers.delete(state.intervalId);
    }
    this.playerPrimeMateriaAuras.delete(playerId);
  }

  /** Alchemist Prime Materia — server-authoritative ramping aura damage + self-heal. */
  startPrimeMateriaAura(playerId) {
    if (this.playerPrimeMateriaAuras.has(playerId)) return;
    const player = this.players.get(playerId);
    if (!player) return;
    if (String(player.archetype || '').toUpperCase() !== 'ALCHEMIST') return;

    const state = {
      intervalId: null,
      enemyTimeInAura: new Map(),
    };

    const tickSec = PRIME_MATERIA_TICK_MS / 1000;
    const radiusSq = PRIME_MATERIA_RADIUS * PRIME_MATERIA_RADIUS;
    const rampRange = PRIME_MATERIA_MAX_DAMAGE - PRIME_MATERIA_MIN_DAMAGE;

    state.intervalId = setInterval(() => {
      const livePlayer = this.players.get(playerId);
      if (!livePlayer || (livePlayer.health != null && livePlayer.health <= 0)) {
        this.stopPrimeMateriaAura(playerId);
        return;
      }

      const pos = livePlayer.position;
      if (!pos) return;
      const cx = pos.x ?? 0;
      const cz = pos.z ?? 0;

      const inRangeThisTick = new Set();
      let totalApplied = 0;

      for (const [enemyId, enemy] of this.enemies) {
        if (!enemy || enemy.isDying) continue;
        if (enemy.health != null && enemy.health <= 0) continue;

        const ex = enemy.position?.x ?? 0;
        const ez = enemy.position?.z ?? 0;
        const dx = ex - cx;
        const dz = ez - cz;
        if (dx * dx + dz * dz > radiusSq) continue;

        inRangeThisTick.add(enemyId);
        const prevTime = state.enemyTimeInAura.get(enemyId) || 0;
        const nextTime = prevTime + tickSec;
        state.enemyTimeInAura.set(enemyId, nextTime);
        const rampT = Math.min(1, nextTime / PRIME_MATERIA_RAMP_TIME_SEC);
        const dmg = Math.round(PRIME_MATERIA_MIN_DAMAGE + rampRange * rampT);

        const result = this.damageEnemy(
          enemyId,
          dmg,
          playerId,
          livePlayer,
          { damageType: 'prime_materia' },
        );
        if (result && result.damage > 0) {
          totalApplied += result.damage;
        }
      }

      for (const enemyId of state.enemyTimeInAura.keys()) {
        if (!inRangeThisTick.has(enemyId)) {
          state.enemyTimeInAura.delete(enemyId);
        }
      }

      if (totalApplied > 0 && livePlayer.maxHealth != null) {
        const previousHealth = livePlayer.health ?? 0;
        const healAmt = Math.max(1, Math.round(totalApplied * PRIME_MATERIA_HEAL_FRACTION));
        const nextHealth = Math.min(livePlayer.maxHealth, previousHealth + healAmt);
        const actualHeal = nextHealth - previousHealth;
        if (actualHeal > 0) {
          livePlayer.health = nextHealth;
          if (this.io) {
            this.io.to(this.roomId).emit('player-health-updated', {
              playerId,
              health: nextHealth,
              maxHealth: livePlayer.maxHealth,
              timestamp: Date.now(),
            });
            this.io.to(this.roomId).emit('player-healing', {
              sourcePlayerId: playerId,
              targetPlayerId: playerId,
              healingAmount: actualHeal,
              healingType: 'prime_materia',
              position: livePlayer.position || { x: 0, y: 0, z: 0 },
              timestamp: Date.now(),
            });
          }
        }
      }
    }, PRIME_MATERIA_TICK_MS);

    this._scheduledTimers.add(state.intervalId);
    this.playerPrimeMateriaAuras.set(playerId, state);
  }

  /** True when a co-op player has chosen a weapon in the throne prep room. */
  _playerThronePrepReady(player) {
    if (!player) return false;
    const weapon = player.weapon != null ? String(player.weapon).toLowerCase() : 'none';
    return !!(weapon && weapon !== 'none');
  }

  updatePlayerHealth(playerId, health) {
    const player = this.players.get(playerId);
    if (player) {
      player.health = Math.max(0, Math.min(player.maxHealth, health));
    }
  }

  updatePlayerShield(playerId, shield, maxShield) {
    const player = this.players.get(playerId);
    if (player) {
      player.shield = Math.max(0, Math.min(maxShield || player.maxShield || 100, shield));
      if (maxShield !== undefined) {
        player.maxShield = maxShield;
      }
    }
  }

  updatePlayerEnergy(playerId, energy, maxEnergy) {
    const player = this.players.get(playerId);
    if (player) {
      player.energy = Math.max(0, Math.min(maxEnergy || player.maxEnergy || 100, energy));
      if (maxEnergy !== undefined) {
        player.maxEnergy = maxEnergy;
      }
    }
  }

  getKillCount() {
    return this.killCount;
  }

  getGameStarted() {
    return this.gameStarted;
  }
}

module.exports = GameRoom;

