const { broadcastEnemySpawn } = require('./enemyHandler');
const EnemyAI = require('./enemyAI');
const {
  COOP_MAIN_ENTRY_X,
  COOP_MAIN_ENTRY_Z,
  COOP_PLAYER_START_CLEAR_RADIUS,
  rotationYTowardEntry,
  rotationYTowardArenaCenter,
} = require('./coopArenaLayout');
const mushroomLayout = require('./mushroomLayout');
const mushroomConstants = require('./mushroomConstants');

/** Co-op boss encounters (GLB tier 1, Archon tier 2, Weaver Nexus tier 3). */
const COOP_BOSS_TYPES = new Set(['boss', 'boss2', 'boss3']);
const COOP_BOSS_MAX_HEALTH_PRE_TRINITY = { boss: 5000, boss2: 8500, boss3: 12500 };
const COOP_BOSS_MAX_HEALTH_POST_TRINITY = { boss: 12500, boss2: 20000, boss3: 30000 };
/** Knight damage by boss-kill tier: [base, after boss 1, after boss 2, after boss 3+]. */
const KNIGHT_DAMAGE_BY_TIER = {
  green:  [20, 30, 40, 50],
  red:    [30, 40, 50, 70],
  blue:   [15, 25, 35, 45],
  purple: [20, 30, 40, 50],
};
const KNIGHT_SOUL_STATS = {
  green:  { health: 1250, maxHealth: 1250, attackCooldown: 2500, moveSpeed: 2.0 },
  red:    { health: 1000, maxHealth: 1000, attackCooldown: 2500, moveSpeed: 2.0 },
  blue:   { health: 900,  maxHealth: 900,  attackCooldown: 1250, moveSpeed: 3.25 },
  purple: { health: 900,  maxHealth: 900,  attackCooldown: 2500, moveSpeed: 2.0 },
};
const KNIGHT_SOUL_TYPES = ['red', 'blue', 'purple', 'green'];
/** Max freeze duration (ms) for boss-tier enemies (server + client). */
const BOSS_MAX_FREEZE_MS = 1000;
const ENTANGLEMENT_DURATION_MS = 5000;
const ENTANGLEMENT_DAMAGE_PER_SECOND = 31;
/** Keep in sync with `STAGGER_MAX` / `STAGGER_MAX_BOSS` in `src/utils/talents.ts`. */
const STAGGER_CAP_NORMAL = 100;
const STAGGER_CAP_BOSS = 300;
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
const PYROMANIA_METEOR_ICD_MS = 1000;
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
/** Keep in sync with `ACID_RAIN_VENOM_STACKS_PER_TICK` in src/utils/talents.ts */
const ACID_RAIN_VENOM_STACKS_PER_TICK = 1;
const ALLIED_KNIGHT_ID = 'allied-knight';
const ALLIED_KNIGHT_MAX_HP = 500;
const ALLIED_KNIGHT_DAMAGE = 50;
const ALLIED_KNIGHT_MOVE_SPEED = 2.85;
const ALLIED_KNIGHT_ATTACK_COOLDOWN_MS = 1375;
const ALLIED_KNIGHT_ORB_COUNT = 3;
const ALLIED_HEALER_ID = 'allied-healer';
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
const THRONE_TRAINING_DUMMY_Z = 14.60;

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
const ARCTIC_STING_TEMPEST_CHILL_STACKS_TO_FREEZE = 6;
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
const COOP_ROOM_TYPES = Object.freeze([...COOP_COLORED_ROOM_TYPES, ...COOP_SPECIAL_ROOM_TYPES, 'boss']);
const COOP_ROOMS_BEFORE_BOSS = 3;
const COOP_ROOMS_BEFORE_BOSS_LATE = 4; // after 2nd boss defeated
const COOP_COUNTABLE_COMBAT_ROOM_TYPES = Object.freeze([
  ...COOP_COLORED_ROOM_TYPES, 'stat', 'trial',
]);
const COOP_TERRAIN_THEMES = Object.freeze(['purple', 'blue', 'green']);
const COOP_WAVE_MARTYR_ROOM_CHANCE = 0.33; // 30% of colored rooms have martyr spawns
const COOP_WAVE_TITAN_ROOM_CHANCE = 0.4; // 40% of colored rooms spawn 1 titan after boss 1 (chance tier)
const COOP_WAVE_BOSS1_ROOM_CHANCE = 0.33; // 33% of colored rooms have a mini-boss1 spawn after boss2 is defeated
const COOP_BOSS1_ELITE_KNIGHTS_CHANCE = 0.5; // 50% of 1st boss encounters are 2 elite knights instead of the GLB boss
const BOSS1_ELITE_SIZE_SCALE = 1.33;
const BOSS1_ELITE_SPEED_MULT = 1.15;
const BOSS1_ELITE_HEALTH_MULT = 3;
const COOP_WAVE_GREED_SPAWN_CHANCE = 0.20; // 10% chance for a bonus Greed enemy on any countable combat room's wave init
const COOP_WAVE_WRAITH_ROOM_CHANCE = 0.33; // 33% chance for 1–2 bonus Wraiths on any countable combat room's wave init
const GREED_LIFETIME_MS = 30000; // Greed despawns 30s after spawning if not killed
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
const MERCHANT_HEAL_COST = 50;
const MERCHANT_HEAL_AMOUNT = 100;
const MERCHANT_ITEM_COUNT = 2;
const MERCHANT_DASH_CHARGE_COST = 1000;
const MERCHANT_WEAPON_TALENT_COST = 600;
const MERCHANT_WEAPON_TALENT_MAX = 3;
const MERCHANT_BOSS_ITEM_POOL = Object.freeze([
  { type: 'MANA_SHIELD', label: 'Mana Shield', stat: 'intellect', bonuses: { common: 8, rare: 15, epic: 20, legendary: 30 } },
  { type: 'COLOSSUS_LUNGS', label: 'Colossus Lungs', stat: 'stamina', bonuses: { common: 6, rare: 10, epic: 14, legendary: 20 } },
  { type: 'REAPER_CLAWS', label: 'Reaper Claws', stat: 'agility', bonuses: { common: 6, rare: 10, epic: 14, legendary: 20 } },
  { type: 'TITAN_HEART', label: 'Titan Heart', stat: 'strength', bonuses: { common: 5, rare: 10, epic: 14, legendary: 20 } },
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
  'boss': { fixed: 50 },
  'boss2': { fixed: 100 },
  'boss3': { fixed: 150 },
});
/** Mirror client main arena constants (colored rooms use a circle at this radius). */
const MAIN_ARENA_HEX_RADIUS = 26;
const MAIN_MAP_HALF_X = MAIN_ARENA_HEX_RADIUS;
const MAIN_MAP_HALF_Z = MAIN_ARENA_HEX_RADIUS;
/** Keep foot XZ inside the playable disc with margin for collision radius. */
const MAIN_ARENA_SPAWN_INSET = 1.5;
const MAIN_CIRCLE_INNER_RADIUS = MAIN_ARENA_HEX_RADIUS - MAIN_ARENA_SPAWN_INSET;

/**
 * Hex combat arena (stat / trial) — must match `HexCombatArena.tsx`:
 * `HEX_ARENA_RADIUS` and `HexTileField` apothem − `HEX_FLOOR_MARGIN`.
 */
const HEX_ARENA_RADIUS = 22;
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

    // Track when game started for boss spawning
    this.gameStartTime = 0;
    this.bossSpawned = false;

    /** enemyId -> { lastAt, lastStagger } — throttle stagger broadcasts (~10 Hz). */
    this._staggerBroadcastByEnemy = new Map();

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
     * @type {null | 'pick_wave2' | 'pick_boss' | 'pick_post_boss'}
     */
    this.coopMainArenaPortalPhase = null;

    /** Co-op: true during boss fight on stripped throne shell and post-boss portal pause. */
    this.coopBossThroneArena = false;
    /**
     * Co-op: which boss fight the throne shell is for (`pick_boss` / dev shortcuts). Null after fight or on main map.
     * Drives client visuals: boss (GLB tier 1), boss2 Archon warlock, boss3 Weaver+Nexus tier.
     * @type {null | 'boss' | 'boss2' | 'boss3'}
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
     * @type {Array<{ kind: 'basic'|'titan'|'boss1', unitType: string, pos: { x: number, z: number }, campDef: object, slotIndex: number }>}
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

    /** Co-op: active portal loading gate before enemy AI and damage can affect players. */
    this.coopCombatTransitionId = 0;
    this.coopCombatTransition = null;
    /** Co-op: reject stale client position writes until this timestamp after portal teleport. */
    this.coopPostTeleportPositionGuardUntil = 0;
    /** Co-op: monotonic token bumped on each portal teleport; stamped on authoritative position events. */
    this.coopRoomEntryToken = 0;
    /** Co-op colored room: one whisper SFX per room visit on first combat engagement. */
    this.coopRoomWhisperPlayed = false;
    /** Co-op: pending post-teleport initial wave spawn (`_schedulePostTeleportEnemyWave`). */
    this._coopDelayedEnemyWaveTimeoutId = null;
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
  _scheduleIgniteDot(enemyId, appliedDamage, dotFraction, durationMs, tickCount, fromPlayerId, player) {
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
        const igniteMeta = { damageType: 'ignite' };
        if (tyrantsCloak) {
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

    const noStaggerTypes = new Set(['boss-skeleton', 'player-zombie', 'tentacle-spine']);
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
    this._devSpawnBoss2 = false;
    this._devSpawnBoss3 = false;
    this._resetMushroomState();

    if (this.gameMode === 'coop') {
      for (const player of this.players.values()) {
        player.merchantDashChargePurchased = false;
        player.merchantWeaponTalentPurchases = 0;
      }
    }

    // Co-op: begin in the throne prep room — combat arena + enemies start after portal
    if (this.gameMode === 'coop') {
      this.combatArenaActive = false;
      this._pickThronePortalOffer();
      this.teleportAllPlayersToThroneRoom();
      this.spawnThroneTrainingDummy();
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
  }

  teleportAllPlayersToCombatSpawn() {
    if (this.gameMode === 'coop') {
      this.coopRoomEntryToken += 1;
      this.coopPostTeleportPositionGuardUntil = Date.now() + COOP_POST_TELEPORT_POSITION_GUARD_MS;
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
      const c = clampPositionToMainArenaXZ(rawX, rawZ);
      player.position = {
        x: c.x,
        y: 1,
        z: c.z,
      };
      const y = rotationYTowardArenaCenter(c.x, c.z);
      player.rotation = { x: 0, y, z: 0 };
      idx++;
    }
  }

  isAlliedUnitEnemy(enemy) {
    return !!enemy && enemy.alliedUnit === true;
  }

  _isCoopPlayerAllyEnemy(enemy) {
    return !!enemy && (enemy.alliedUnit === true || enemy.type === 'player-zombie');
  }

  spawnOrReviveAlliedKnightForEnemyRoom() {
    return this.spawnOrReviveAlliedUnitsForEnemyRoom()?.knight ?? null;
  }

  spawnOrReviveAlliedUnitsForEnemyRoom() {
    if (this.gameMode !== 'coop' || !this.gameStarted || !this.combatArenaActive) return null;
    if (this.coopBossThroneArena || this.bossSpawned || this.currentCoopRoomKind === 'boss' || this.currentCoopRoomKind === 'merchant') {
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

    const knightPos = clampPositionToMainArenaXZ(COOP_MAIN_ENTRY_X + 2.1, COOP_MAIN_ENTRY_Z + 0.6);
    const healerPos = clampPositionToMainArenaXZ(COOP_MAIN_ENTRY_X - 2.1, COOP_MAIN_ENTRY_Z + 0.6);
    const knight = {
      id: ALLIED_KNIGHT_ID,
      type: 'allied-knight',
      position: { x: knightPos.x, y: 0, z: knightPos.z },
      rotation: rotationYTowardArenaCenter(knightPos.x, knightPos.z),
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

    this.addEnemy(knight);
    if (healer) {
      this.addEnemy(healer);
    }
    if (this.io) {
      const timestamp = Date.now();
      this.io.to(this.roomId).emit('enemy-spawned', { enemy: knight, timestamp });
      if (healer) {
        this.io.to(this.roomId).emit('enemy-spawned', { enemy: healer, timestamp });
      }
    }
    return { knight, healer };
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

  _pickPostFirstRoomPortalOffer() {
    const color = COOP_COLORED_ROOM_TYPES[Math.floor(Math.random() * COOP_COLORED_ROOM_TYPES.length)];
    const special = COOP_SPECIAL_ROOM_TYPES[Math.floor(Math.random() * COOP_SPECIAL_ROOM_TYPES.length)];
    this.thronePortalOffer = [color, special];
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
  }

  /** Remove adds still alive when their summoning boss dies (skeletons, warlocks, ghouls). */
  _clearBossSummonedAdds(bossId) {
    if (!bossId) return;

    const idsToRemove = [];
    for (const [id, e] of this.enemies) {
      if (id === bossId) continue;
      if (
        e.bossId === bossId ||
        e.summonedByBoss2Id === bossId ||
        e.summonedByBoss3Id === bossId ||
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
   * After clearing a main-map combat room: dual portals until the segment quota is met, then a boss portal.
   * Colored/stat/trial rooms count; merchant (pink) never does. Quota is 3, or 4 after Boss 2.
   * @param {'second_wave'|'boss_gate'} phase
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
        players: this.getPlayers(),
        enemies: this.getEnemies(),
        timestamp: Date.now(),
      });
    }
  }

  _onCoopWaveThresholdMet() {
    this.coopSegmentCombatRoomsCleared += 1;
    const required = this._getCoopRoomsRequiredBeforeBoss();
    if (this.coopSegmentCombatRoomsCleared >= required) {
      console.log(`🌀 Segment complete (${required} combat rooms cleared) — main arena: boss portal.`);
      this.startMainArenaPortalIntermission('boss_gate');
    } else {
      console.log(
        `🌀 Combat room ${this.coopSegmentCombatRoomsCleared}/${required} cleared — choose next room (center portals).`,
      );
      this.startMainArenaPortalIntermission('second_wave');
    }
  }

  /**
   * Record an enemy kill for the current co-op wave.
   * Martyr kills count toward the same `COOP_MIXED_WAVE_COUNT` quota as every other staged mob —
   * excluding them deadlock’d colored rooms (~8 slots vs 8 kills).
   * All combat rooms use the mixed-room staged release thresholds.
   */
  _registerCoopWaveKill(emojiLog) {
    if (this.gameMode !== 'coop' || !this.combatArenaActive || this.bossSpawned) return;
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
        mushroomState: this.getMushroomState(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  /**
   * Development-only: jump into boss arena with the 3rd boss (`boss3` / Weaver Nexus).
   */
  activateDevBoss3Arena() {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    if (!this.gameStarted || this.combatArenaActive || this.gameMode !== 'coop') {
      return false;
    }

    this._devSpawnBoss3 = true;
    this.removeThroneTrainingDummy();
    this.combatArenaActive = true;
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.coopBossThroneArena = true;
    this.coopThroneBossKind = 'boss3';
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
        mushroomState: this.getMushroomState(),
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

    if (phase === 'pick_wave2') {
      const offer = this.thronePortalOffer;
      if (!offer || offer.length !== 2) {
        return false;
      }
      let pick = chosenCampType != null ? String(chosenCampType).toLowerCase() : '';
      if (!pick || !offer.includes(pick)) {
        pick = offer[0];
      }
      const roomKind = this._normalizeCoopRoomKind(pick);
      if (!roomKind || roomKind === 'boss') {
        return false;
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
          coopColoredRoomVisitIndex: this._getCoopColoredRoomVisitIndexForEmit(),
          coopBossRoomVisitIndex: this._getCoopBossRoomVisitIndexForEmit(),
          coopCombatTransitionId,
          coopRoomEntryToken: this.coopRoomEntryToken,
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

    if (phase === 'pick_boss') {
      const offer = this.thronePortalOffer;
      if (!offer || offer.length !== 1 || String(offer[0]).toLowerCase() !== 'boss') {
        return false;
      }
      if (String(chosenCampType != null ? chosenCampType : 'boss').toLowerCase() !== 'boss') {
        return false;
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
        this.coopThroneBossKind = 'boss3';
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
          mushroomState: this.getMushroomState(),
          timestamp: Date.now(),
        });
      }
      return true;
    }

    if (phase === 'pick_post_boss') {
      const offer = this.thronePortalOffer;
      if (!offer || offer.length !== 2) {
        return false;
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
          mushroomState: this.getMushroomState(),
          timestamp: Date.now(),
        });
      }
      return true;
    }

    return false;
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
      this.pendingCoopArchetype = null;
      this.pendingCoopRoomKind = null;
      this.clearedCoopRoomKind = 'boss';
      this.coopThroneBossKind = null;
      this.merchantInventory = [];
      const clearedColor = this.lastCoopWaveCampColor
        ? String(this.lastCoopWaveCampColor).toLowerCase()
        : null;
      this.sessionCampTypes = [];

      this._pickThronePortalOffer();
      this.coopMainArenaPortalPhase = 'pick_post_boss';

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
      archetype: 'ROGUE',
      health: maxHealth, // Start with full health
      maxHealth: maxHealth,
      level: 1, // Start at level 1
      essence: 0,
      gold: 0,
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
      },
      /** Co-op: red room boons synced from client (`coop-red-room-boons`). */
      coopRedRoomBoons: {
        fission: false,
      },
      merchantDashChargePurchased: false,
      merchantWeaponTalentPurchases: 0,
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
    this.stopEnemySpawning();
    this.stopEnemyAI();

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

  getPlayerCount() {
    return this.players.size;
  }

  _emitPlayerDamagedWithHealth(playerId, player, damagePayload) {
    if (!this.io || !player) return;
    this.io.to(this.roomId).emit('player-damaged', damagePayload);
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

      const previousHealth = player.health;
      player.health = Math.max(0, player.health - damage);
      hitCount += 1;
      const wasKilled = previousHealth > 0 && player.health <= 0;
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
        timestamp: Date.now(),
        ...(meta?.sourceEnemyId ? { sourceEnemyId: meta.sourceEnemyId } : {}),
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
      const previousHealth = player.health;
      player.health = Math.max(0, player.health - damage);
      const wasKilled = previousHealth > 0 && player.health <= 0;
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
        timestamp: Date.now(),
        ...(meta?.sourceEnemyId ? { sourceEnemyId: meta.sourceEnemyId } : {}),
      });
      if (meta?.stunMs && meta.stunMs > 0) {
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

      const previousHealth = player.health;
      player.health = Math.max(0, player.health - damage);
      hitCount += 1;
      const wasKilled = previousHealth > 0 && player.health <= 0;
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
        timestamp: Date.now(),
        ...(meta?.sourceEnemyId ? { sourceEnemyId: meta.sourceEnemyId } : {}),
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
      const previousHealth = player.health;
      player.health = Math.max(0, player.health - damage);
      const wasKilled = previousHealth > 0 && player.health <= 0;
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
        timestamp: Date.now(),
        ...(meta?.sourceEnemyId ? { sourceEnemyId: meta.sourceEnemyId } : {}),
      });
      if (meta?.stunMs && meta.stunMs > 0) {
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
   * @param { { x: number, z: number } } center
   * @param { number } radius
   * @param { number } damage
   * @param { string } [damageType]
   */
  damageEnemiesInHorizontalRing(center, radius, damage, damageType = 'mushroom_eruption') {
    if (!this.enemies || radius <= 0 || damage <= 0 || !center) return;
    const cx = center.x;
    const cz = center.z;
    const r2 = radius * radius;
    for (const [enemyId, enemy] of this.enemies) {
      if (!enemy || enemy.isDying) continue;
      if (enemy.health != null && enemy.health <= 0) continue;
      const ex = enemy.position?.x ?? 0;
      const ez = enemy.position?.z ?? 0;
      const dx = ex - cx;
      const dz = ez - cz;
      if (dx * dx + dz * dz > r2) continue;
      const dmg = this._isCoopPlayerAllyEnemy(enemy)
        ? mushroomConstants.MUSHROOM_ERUPTION_ALLY_DMG
        : damage;
      this.damageEnemy(enemyId, dmg, null, null, { damageType });
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
      this.initializeEnemies();
      this.spawnOrReviveAlliedUnitsForEnemyRoom();
      if (this.enemyAI?.clearNonPlayerAggroTargets) {
        this.enemyAI.clearNonPlayerAggroTargets();
      }
      this.startEnemyAI();
    }
  }

  // Enemy types that should NOT get the flame summon spawn VFX:
  // bosses + terrain/trap enemies (tentacle-spine) + allies + training dummies.
  _isSummonVfxEligible(enemy) {
    if (!enemy || !enemy.type) return false;
    const NO_SUMMON_TYPES = new Set([
      'boss', 'boss2', 'boss3',
      'tentacle-spine',
      'training-dummy',
      'allied-knight', 'allied-healer',
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

  // Build one enemy object at the given position for the given type/camp.
  _buildEnemy(type, campIndex, slotIndex, pos, campDef) {
    // Post-boss difficulty scaling, keyed off how many bosses the party has killed.
    // Every kill adds +250 HP to all combatants (martyr & tentacle-spine excluded)
    // and bumps damage along a per-type tier table. Tier is clamped at 3 (3+ bosses).
    const tier = Math.min(this.coopBossesDefeatedCount || 0, 3);
    const hpBonus = 225 * tier;

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
      const soulType = campDef.knightSoulType;
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
        damage: 0, moveSpeed: 2.5, soulType: 'orange' };
    }
    if (type === 'titan') {
      // Excluded from HP scaling.
      const TITAN_STATS_BY_SOUL = {
        blue:   { health: 4000, maxHealth: 3500, damage: 148 },
        red:    { health: 4500, maxHealth: 4000, damage: 134 },
        green:  { health: 5000, maxHealth: 5000, damage: 100 },
        purple: { health: 3500, maxHealth: 3000, damage: 166 },
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
    // viper
    return { id: `viper-${campIndex}-${slotIndex}-${ts}`, type: 'viper', ...base,
      health: 650 + hpBonus, maxHealth: 650 + hpBonus,
      damage: VIPER_DAMAGE_BY_TIER[tier], attackCooldown: 5000, moveSpeed: 2.0 };
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
   */
  _spawnTentacleSpinesForWave(wavePositions, campDef) {
    const MAP_HALF_X = MAIN_MAP_HALF_X - MAIN_ARENA_SPAWN_INSET;
    const MAP_HALF_Z = MAIN_MAP_HALF_Z - MAIN_ARENA_SPAWN_INSET;
    const exclusions = [
      { x: COOP_MAIN_ENTRY_X, z: COOP_MAIN_ENTRY_Z, radius: COOP_PLAYER_START_CLEAR_RADIUS },
    ];
    const n = 1 + Math.floor(Math.random() * 3);
    const existing = wavePositions.map((p) => ({ x: p.x, z: p.z }));
    const SLOT_BASE = 900;
    for (let i = 0; i < n; i++) {
      const pos = this._randomMapPos(MAP_HALF_X, MAP_HALF_Z, exclusions, existing, 3.5, false, null, MAIN_CIRCLE_INNER_RADIUS);
      if (!pos) continue;
      existing.push({ x: pos.x, z: pos.z });
      const enemy = this._buildEnemy('tentacle-spine', 0, SLOT_BASE + i, pos, campDef);
      this.enemies.set(enemy.id, enemy);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-spawned', { enemy, timestamp: Date.now() });
      }
    }
  }

  /** Pick a basic mob type from a camp pool, excluding non-counting ghoul summons. */
  _pickBasicUnitType(campDef, forceKnight = false) {
    if (forceKnight) return 'knight';
    const pool = campDef.enemyPool.filter((t) => t !== 'ghoul');
    const safe = pool.length ? pool : ['knight'];
    return safe[Math.floor(Math.random() * safe.length)];
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
      if (spec.kind === 'titan' || spec.kind === 'boss1') return i;
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
    if (this.enemyAI && enemy.type !== 'titan') {
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
   * Titan quota by boss-defeat tier:
   *   count 1 — colored rooms: 0 or 1 (chance)
   *   count 2 — colored rooms: 1–2 (guaranteed)
   *   count 3+ — all combat rooms: 1–2 (guaranteed)
   */
  _computeRoomTitanQuota(roomKind) {
    const count = this.coopBossesDefeatedCount;
    const isMixed = roomKind === 'stat' || roomKind === 'trial';
    const isColored = COOP_COLORED_ROOM_TYPES.includes(roomKind);
    if (count < 1) return 0;
    if (count >= 3 && (isColored || isMixed)) return 1 + Math.floor(Math.random() * 2);
    if (count >= 2 && isColored) return 1 + Math.floor(Math.random() * 2);
    if (count === 1 && isColored) return Math.random() < COOP_WAVE_TITAN_ROOM_CHANCE ? 1 : 0;
    return 0;
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
    this.roomTitanQuota = titanQuota;
    this.roomHasTitans = titanQuota > 0;
    this.roomHasWraith = Math.random() < COOP_WAVE_WRAITH_ROOM_CHANCE;

    if (isMixedRoom) {
      this.roomHasMartyrs = false;
      this.roomHasMiniBoss1 = false;
    } else {
      this.roomHasMartyrs = Math.random() < COOP_WAVE_MARTYR_ROOM_CHANCE;
      this.roomHasMiniBoss1 = this.coopBossesDefeatedCount >= 2
        && Math.random() < COOP_WAVE_BOSS1_ROOM_CHANCE;
    }

    const boss1Count = this.roomHasMiniBoss1 ? 1 : 0;
    const basicCount = Math.max(1, quota - titanQuota - boss1Count);
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

      const edgePositions = this._generateEdgeSpawnPositions(Math.min(2, basicCount));
      this._spawnTentacleSpinesForWave(edgePositions, campDef);
    }

    const specialSpecs = [];
    if (titanQuota > 0) {
      const titanPositions = isMixedRoom
        ? this._generateScatteredPositions(titanQuota, true)
        : this._generateEdgeSpawnPositions(titanQuota);
      for (let i = 0; i < titanQuota; i++) {
        specialSpecs.push({
          kind: 'titan',
          unitType: 'titan',
          pos: titanPositions[i] || { x: 0, z: MAIN_ARENA_HEX_RADIUS * 0.68 },
          campDef,
          slotIndex: basicCount + i,
        });
      }
    }
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
          slotIndex: basicCount + titanQuota,
        });
      }
    }

    this.coopRequiredQueue = this._insertSpecsAtRandomIndices(basicSpecs, specialSpecs);
    this.coopRequiredQueue.forEach((spec, i) => { spec.slotIndex = i; });

    console.log(
      `⚔️ Co-op room wave: quota=${quota}, basics=${basicCount}, titans=${titanQuota}, boss1=${boss1Count}, ` +
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

  applyEntanglementOnHit(enemyId, fromPlayerId, player) {
    const enemy = this.enemies.get(enemyId);
    if (!enemy || enemy.isDying || enemy.health <= 0) return;

    this.applyStatusEffect(enemyId, 'entangle', ENTANGLEMENT_DURATION_MS);
    enemy.entanglementExpireAt = Date.now() + ENTANGLEMENT_DURATION_MS;
    enemy.entanglementLastPlayerId = fromPlayerId;
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
      this.damageEnemy(enemyId, ENTANGLEMENT_DAMAGE_PER_SECOND, tickPlayerId, tickPlayer, {
        damageType: 'entanglement',
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
    let firstResult = null;
    for (const ally of this.enemies.values()) {
      if (!this.isAlliedUnitEnemy(ally) || ally.isDying || ally.health <= 0) continue;
      const ax = ally.position?.x ?? 0;
      const az = ally.position?.z ?? 0;
      const dx = ax - cx;
      const dz = az - cz;
      if (dx * dx + dz * dz > r2) continue;
      const result = this.damageEnemy(ally.id, damage, null, null, hitMeta);
      if (!firstResult) firstResult = result;
    }
    return firstResult;
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
      hitMeta?.damageType !== 'venom' &&
      this.enemyAI?.isKnightBlocking(enemyId)
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
    if (this.isAlliedUnitEnemy(enemy) && fromPlayerId) {
      return null;
    }

    const previousHealth = enemy.health;
    enemy.health = Math.max(0, enemy.health - appliedDamage);

    if (appliedDamage > 0) {
      enemy.lastDamageAt = Date.now();
      if (enemy.type === 'wraith' && this.enemyAI?.revealWraithStealth) {
        this.enemyAI.revealWraithStealth(enemy.id, 'damage');
      }
    }

    if (enemy.type === 'training-dummy' && enemy.health <= 0) {
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
      } else if (enemy.type !== 'training-dummy' && enemy.type !== 'tentacle-spine') {
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
      enemy.type !== 'player-zombie' &&
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
      const dotDamageTypes = new Set(['ignite', 'venom', 'entanglement', 'blizzard', 'cloudkill']);
      const damageType = hitMeta && hitMeta.damageType;
      const isThrottledDot = damageType && dotDamageTypes.has(damageType);
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
      const noStaggerTypes = new Set(['boss-skeleton', 'player-zombie', 'tentacle-spine']);
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
      enemy.isDying = true;
      enemy.deathTime = Date.now();

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
        enemy.type !== 'player-zombie'
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
        enemy.type !== 'player-zombie' &&
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
        enemy.type !== 'player-zombie' &&
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
        enemy.type !== 'player-zombie' &&
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
        enemy.type !== 'player-zombie' &&
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
        enemy.type !== 'player-zombie' &&
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
        enemy.type !== 'player-zombie' &&
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
        enemy.type !== 'player-zombie' &&
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
        enemy.type !== 'player-zombie' &&
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
        enemy.type !== 'player-zombie' &&
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
        enemy.type !== 'player-zombie' &&
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
        enemy.type !== 'player-zombie' &&
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
        enemy.type !== 'player-zombie' &&
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
        enemy.type !== 'player-zombie' &&
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
        enemy.type !== 'player-zombie' &&
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
        enemy.type !== 'player-zombie' &&
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
        enemy.type !== 'player-zombie' &&
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
            this._schedulePostBossPortalIntermission();
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
              : 'hate';

            this.io.to(this.roomId).emit('boss-defeated', {
              bossId: enemyId,
              killedBy: fromPlayerId,
              slainLabel,
              timestamp: Date.now()
            });

            this.spawnBossItemDrops(enemy.position);
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

        // Emit vortex death effect BEFORE removing so clients know the position
        if (this.io) {
          this.io.to(this.roomId).emit('knight-death-vortex', {
            enemyId: enemyId,
            position: { x: enemy.position.x, y: enemy.position.y, z: enemy.position.z },
            soulType: enemy.soulType || null,
            timestamp: Date.now()
          });
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
        if (this.enemyAI) {
          this.enemyAI.clearTrapPendingSlam(enemyId);
          this.enemyAI.clearTrapAsAggroTarget(enemyId);
          this.enemyAI.removeEnemyAggro(enemyId);
        }
        this._scheduleTimeout(() => {
          this._pruneEnemyMaps(enemyId);
          this.enemies.delete(enemyId);
          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
          }
        }, 600);
        return result;

      } else if (enemy.type === 'greed') {
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
  spawnBoss() {
    if (!this.gameStarted || this.bossSpawned) {
      this._devSpawnBoss2 = false;
      this._devSpawnBoss3 = false;
      return null;
    }

    const forceBoss3 = this._devSpawnBoss3 === true;
    const forceBoss2 = this._devSpawnBoss2 === true;
    if (forceBoss3) {
      this._devSpawnBoss3 = false;
    }
    if (forceBoss2) {
      this._devSpawnBoss2 = false;
    }

    // ── Triple-boss encounter (4th fight: "The Trinity") ──────────────────────
    if (this.coopThroneBossKind === 'boss_all') {
      return this._spawnTripleBoss();
    }

    let bossType = 'boss';
    if (forceBoss3 || this.coopThroneBossKind === 'boss3') {
      bossType = 'boss3';
    } else if (forceBoss2 || this.coopThroneBossKind === 'boss2') {
      bossType = 'boss2';
    }

    const bossId = `${bossType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Spawn boss at center of arena
    const position = { x: 0, y: 0, z: 0 };

    const maxHealth = this.getCoopBossMaxHealth(bossType);
    const moveSpeed = bossType === 'boss3' || bossType === 'boss2' ? 2.0 : 2.5;

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
      bossType === 'boss3'
        ? 'Boss tier 3 (Weaver Nexus)'
        : bossType === 'boss2'
          ? 'Boss tier 2 (Archon)'
          : 'Boss tier 1';
    console.log(`👹 ${label} spawned with ${maxHealth} HP at center of arena!`);
    this.startEnemyAI();
    return bossData;
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
   * Spawn all three bosses simultaneously for the Trinity encounter (4th boss fight).
   * Each boss gets a position in a triangle formation so they don't overlap.
   * All three IDs are tracked in `this.tripleBossIds`; the encounter completes only
   * when the last one falls.
   */
  _spawnTripleBoss() {
    const now = Date.now();
    const rand = () => Math.random().toString(36).substr(2, 9);

    // Triangle formation — spread wide enough that bosses don't clip each other.
    const spawnConfigs = [
      { type: 'boss',  pos: { x: -8, y: 0, z:  3 }, moveSpeed: 2.5, extra: {} },
      { type: 'boss2', pos: { x:  8, y: 0, z:  3 }, moveSpeed: 2.0, extra: {} },
      { type: 'boss3', pos: { x:  0, y: 0, z: -9 }, moveSpeed: 2.0, extra: { summonChargesLeft: 2 } },
    ];

    this.tripleBossIds = new Set();
    const spawnedBosses = [];

    for (const cfg of spawnConfigs) {
      const bossId = `${cfg.type}-trinity-${now}-${rand()}`;
      const maxHealth = this.getCoopBossMaxHealth(cfg.type);
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
      `👹👹👹 THE TRINITY spawned — Boss1, Boss2, and Boss3 all at once! IDs: ${[...this.tripleBossIds].join(', ')}`
    );
    this.startEnemyAI();
    return spawnedBosses;
  }

  // Start enemy AI system
  startEnemyAI() {
    if (!this.gameStarted || this.players.size === 0) return;
    if (this.gameMode === 'coop' && !this.combatArenaActive) return;
    if (this.gameMode === 'coop') {
      this.enemyAI.startAI();
    }
  }

  // Stop enemy AI system
  stopEnemyAI() {
    this.enemyAI.stopAI();
  }

  // Status effect management methods
  applyStatusEffect(enemyId, effectType, duration, options = {}) {
    const { fromPlayerId = null, player = null } = options;
    const enemy = this.enemies.get(enemyId);
    if (!enemy) return false;

    const PLAYER_DEBUFF_TYPES = new Set(['stun', 'freeze', 'ignite', 'corrupted', 'entangle', 'slow']);
    if (PLAYER_DEBUFF_TYPES.has(effectType) && this._isCoopPlayerAllyEnemy(enemy)) {
      return false;
    }

    if (
      effectType === 'corrupted' &&
      (COOP_BOSS_TYPES.has(enemy.type) || enemy.type === 'boss-skeleton')
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
      });
    }

    if (effectType === 'ignite' && !hadActiveIgnite && fromPlayerId) {
      const livePlayer = player || this.players.get(fromPlayerId) || null;
      this._maybeTriggerPyromaniaMeteor(enemyId, fromPlayerId, livePlayer);
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
    player._pyromaniaMeteorAt = now;
    const enemy = this.enemies.get(enemyId);
    if (!enemy || enemy.isDying || (enemy.health != null && enemy.health <= 0)) return;
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

  _getMerchantPurchaseState(player) {
    return {
      dashChargePurchased: !!player.merchantDashChargePurchased,
      weaponTalentPurchases: player.merchantWeaponTalentPurchases || 0,
    };
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

  generateMerchantInventory() {
    const pool = [...MERCHANT_BOSS_ITEM_POOL];
    const inventory = [...this._buildFixedMerchantStock()];
    const n = Math.min(MERCHANT_ITEM_COUNT, pool.length);
    for (let i = 0; i < n; i++) {
      const pickIndex = Math.floor(Math.random() * pool.length);
      const [itemDef] = pool.splice(pickIndex, 1);
      const rarity = this._rollBossItemRarity();
      const item = this._buildBossRewardItem(itemDef, rarity, `merchant-item-${i}`);
      inventory.push({
        id: `merchant-stock-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
        kind: 'boss_drop',
        cost: this._priceMerchantBossItem(rarity, item.statBonus),
        sold: false,
        item,
      });
    }
    this.merchantInventory = inventory;
    if (this.io) {
      this.io.to(this.roomId).emit('merchant-inventory-updated', {
        inventory: this.getMerchantInventory(),
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
    if (kind === 'boss_drop') {
      if (entry.sold) {
        this._emitMerchantPurchaseFailure(playerId, 'item_unavailable');
        return false;
      }
    } else if (kind === 'dash_charge') {
      if (player.merchantDashChargePurchased) {
        this._emitMerchantPurchaseFailure(playerId, 'dash_charge_already_purchased');
        return false;
      }
    } else if (kind === 'weapon_talent') {
      if ((player.merchantWeaponTalentPurchases || 0) >= MERCHANT_WEAPON_TALENT_MAX) {
        this._emitMerchantPurchaseFailure(playerId, 'weapon_talent_limit_reached');
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

    entry.sold = true;
    const item = {
      ...entry.item,
      id: `merchant-purchase-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      pickedUpAt: Date.now(),
    };

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
      this.io.to(this.roomId).emit('merchant-inventory-updated', {
        inventory: this.getMerchantInventory(),
        timestamp: Date.now(),
      });
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
        cost: MERCHANT_HEAL_COST,
        healingAmount: actualHealingAmount,
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

  // Handle a player picking up an item
  pickupItem(itemId, playerId) {
    const item = this.droppedItems.get(itemId);
    if (!item) {
      console.log(`⚠️ Pickup failed: item ${itemId} no longer exists`);
      return null;
    }

    this.droppedItems.delete(itemId);

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
    // Cancel all pending one-shot timers so they cannot emit after teardown
    this._cancelAllTimers();
    for (const id of this.enemies.keys()) {
      this._clearEnemyDoTTimers(id);
    }
    this.stopEnemySpawning();
    this.stopEnemyAI();

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

  updatePlayerWeapon(playerId, weapon, subclass) {
    const player = this.players.get(playerId);
    if (player) {
      player.weapon = weapon;
      player.subclass = subclass;
    }
  }

  /** Co-op throne prep — persist local archetype selection. */
  updatePlayerArchetype(playerId, archetype) {
    const player = this.players.get(playerId);
    if (!player) return null;
    const raw = archetype != null ? String(archetype).toUpperCase() : 'NONE';
    const allowed = new Set(['NONE', 'ROGUE', 'GLADIATOR', 'ACOLYTE']);
    const normalized = allowed.has(raw) ? raw : 'NONE';
    player.archetype = normalized;
    return normalized;
  }

  /** True when a co-op player has chosen a weapon and archetype in the throne prep room. */
  _playerThronePrepReady(player) {
    if (!player) return false;
    const weapon = player.weapon != null ? String(player.weapon).toLowerCase() : 'none';
    if (!weapon || weapon === 'none') return false;
    const archetype = player.archetype != null ? String(player.archetype).toUpperCase() : 'NONE';
    return archetype !== 'NONE';
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

