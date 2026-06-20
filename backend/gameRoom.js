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
/** Max freeze duration (ms) for boss-tier enemies (server + client). */
const BOSS_MAX_FREEZE_MS = 1000;
const ENTANGLEMENT_DURATION_MS = 5000;
const ENTANGLEMENT_DAMAGE_PER_SECOND = 20;
/** Keep in sync with `STAGGER_MAX` / `STAGGER_MAX_BOSS` in `src/utils/talents.ts`. */
const STAGGER_CAP_NORMAL = 100;
const STAGGER_CAP_BOSS = 300;
// Safety-net only: released when every connected player sends 'coop-combat-transition-ready'
// (after their loading screen fully fades).  This fallback only fires if a client crashes or
// disconnects mid-transition and never sends the confirmation.  Keep it large enough to never
// race with a legitimate slow load.
const COOP_COMBAT_TRANSITION_FALLBACK_MS = 30000;
const CROSSENTROPY_METEOR_SINGLE_CHANCE = 0.8;
const CROSSENTROPY_METEOR_DOUBLE_CHANCE = 0.15;
const CROSSENTROPY_METEOR_TRIPLE_CHANCE = 0.05;
const CROSSENTROPY_METEOR_STAGGER_MS = 500;
const CROSSENTROPY_METEOR_DAMAGE = 230;
const CROSSENTROPY_METEOR_RADIUS = 2.99;
const CROSSENTROPY_METEOR_WARNING_MS = 100;
const CROSSENTROPY_METEOR_SPEED = 31;
const CROSSENTROPY_METEOR_SKY_OFFSET_MIN = 2.5;
const CROSSENTROPY_METEOR_SKY_OFFSET_MAX = 8;
const CROSSENTROPY_METEOR_SKY_HEIGHT_MIN = 44;
const CROSSENTROPY_METEOR_SKY_HEIGHT_MAX = 66;
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
const CLOUDKILL_ARROW_DELAY_MS = 250;
const CLOUDKILL_DAMAGE = 25;
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
const THRONE_TRAINING_DUMMY_Z = 10.75;

/**
 * @typedef {'knight'} ThDummyVisual
 * @type {ReadonlyArray<{ id: string; x: number; z: number; dummyVisual: ThDummyVisual }>}
 */
const THRONE_TRAINING_DUMMY_SPAWNS = Object.freeze([
  { id: 'throne-training-dummy', x: 0, z: THRONE_TRAINING_DUMMY_Z, dummyVisual: 'knight' },
]);

/** @deprecated use THRONE_TRAINING_DUMMY_SPAWNS; kept for client imports */
const THRONE_TRAINING_DUMMY_ID = 'throne-training-dummy';

/** Match `ThroneRoom.tsx`: grass disc radius and rim inset. */
const COOP_THRONE_ROOM_RADIUS = 24;
const THRONE_RIM_INSET = 1.25;
/** Match `THRONE_HOSTILE_KNIGHT_FOOT_MARGIN` in ThroneRoom.tsx */
const THRONE_HOSTILE_KNIGHT_FOOT_MARGIN = 0.3;
const THRONE_HOSTILE_KNIGHT_PERIMETER_RADIUS =
  COOP_THRONE_ROOM_RADIUS - THRONE_RIM_INSET - THRONE_HOSTILE_KNIGHT_FOOT_MARGIN;

/** Co-op prep room: hostile knights on a timer — first wave after delay, then every interval. Max live cap. */
const THRONE_KNIGHT_FIRST_SPAWN_MS = 95000;
const THRONE_KNIGHT_SPAWN_INTERVAL_MS = 35000;
const THRONE_KNIGHT_SPAWN_BATCH = 1;
const THRONE_KNIGHT_MAX_LIVE = 1;
/** radians — arc spread for clustered spawns along the perimeter */
const THRONE_KNIGHT_CLUSTER_ARC_SPREAD = 0.14;

/** Runeblade Blizzard talent — Chill; keep in sync with src/utils/talents.ts */
const BLIZZARD_CHILL_STACK_DURATION_MS = 6000;
const BLIZZARD_CHILL_STACKS_TO_FREEZE = 6;
const BLIZZARD_CHILL_SLOW_PER_STACK = 0.15;

/**
 * Co-op arena: non-martyr kills needed to clear a colored room and trigger the boss.
 * Colored rooms and mixed rooms now share the same staged 8-enemy release schedule.
 */
const COOP_COLORED_ROOM_TYPES = Object.freeze(['blue', 'red', 'green', 'purple']);
const COOP_SPECIAL_ROOM_TYPES = Object.freeze(['stat', 'trial', 'merchant']);
const COOP_ROOM_TYPES = Object.freeze([...COOP_COLORED_ROOM_TYPES, ...COOP_SPECIAL_ROOM_TYPES, 'boss']);
const COOP_TERRAIN_THEMES = Object.freeze(['purple', 'blue', 'green']);
const COOP_WAVE_MARTYR_ROOM_CHANCE = 0.33; // 30% of colored rooms have martyr spawns
const COOP_WAVE_TITAN_ROOM_CHANCE = 0.4; // 40% of colored rooms spawn 1 titan after boss 1 (chance tier)
const COOP_WAVE_BOSS1_ROOM_CHANCE = 0.33; // 33% of colored rooms have a mini-boss1 spawn after boss2 is defeated
/** Staged room wave settings — mixed rooms scatter, colored rooms edge-spawn. */
const COOP_MIXED_WAVE_COUNT = 8;
const COOP_MIXED_INITIAL_ON_MAP = 2;
const COOP_MIXED_FIRST_RESERVE_AT_KILLS = 1;
const COOP_MIXED_SECOND_RESERVE_AT_KILLS = 3;
const COOP_MIXED_THIRD_RESERVE_AT_KILLS = 5;
const COOP_MIXED_FIRST_RESERVE_COUNT = 2;
const COOP_MIXED_SECOND_RESERVE_COUNT = 2;
const COOP_MIXED_THIRD_RESERVE_COUNT = 2;
const GOLD_DROP_EXPIRE_MS = 60000;
const GOLD_VISUAL_PIECE_CAP = 25;
const MERCHANT_HEAL_COST = 50;
const MERCHANT_HEAL_AMOUNT = 125;
const MERCHANT_ITEM_COUNT = 2;
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
    /** 0 = intermission/boss; 1–3 = combat waves on main map. */
    this.coopWaveIndex = 0;
    /**
     * After a main-map wave completes, the next `pick_wave2` should spawn this wave (2 or 3). Not used for `boss_gate`.
     * @type {2|3|0}
     */
    this._coopNextWaveAfterPortal = 0;
    /**
     * Defeated co-op bosses this run — picks next boss tier (Boss 1, Archon+, placeholder for Boss 3).
     */
    this.coopBossesDefeatedCount = 0;
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
     * Co-op wave: spawn plan for the current room. For colored rooms, only { campDef } is stored.
     * @type {null | { campDef: object, isMixed?: boolean, entries?: { unitType: string, pos: { x: number, z: number } }[] }}
     */
    this.coopWaveSpawnPlan = null;
    /** How many edge batches have been sent beyond the initial one (colored rooms). */
    this.coopWaveReserveReleased = 0;
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

    /** Co-op throne prep: timer hostile knight spawns (`true` on spawned `knight` enemies). */
    this._throneKnightFirstSpawnTimeoutId = null;
    this._throneKnightSpawnIntervalId = null;
    this._throneKnightSlotSeq = 0;
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

  /** Remove all per-enemy map entries when an enemy is fully cleaned up. */
  _pruneEnemyMaps(enemyId) {
    this.enemyStatusEffects.delete(enemyId);
    this.enemyChill.delete(enemyId);
  }

  _resetMushroomState() {
    const n = mushroomLayout.MUSHROOM_COUNT;
    this.mushroomHealth = new Array(n).fill(mushroomConstants.MUSHROOM_MAX_HP);
  }

  // ── Enemy archetype definitions ────────────────────────────────────────────
  // One archetype is randomly chosen per game session. All regular wave enemies share it.
  // enemyPool: unit types that can fill non-knight slots.
  // knightSoulType: the soul colour used for knights in this archetype.
  static get CAMP_TYPES() {
    return {
      blue:   { color: 'blue',   knightSoulType: 'blue',   enemyPool: ['knight', 'shade', 'weaver', 'viper' ] },
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
    this.coopWaveIndex = 0;
    this.coopMainArenaPortalPhase = null;
    this.coopBossThroneArena = false;
    this.coopThroneBossKind = null;
    this.pendingCoopArchetype = null;
    this.pendingCoopRoomKind = null;
    this.currentCoopRoomKind = null;
    this.clearedCoopRoomKind = null;
    this._postBossIntermissionScheduled = false;
    this._coopNextWaveAfterPortal = 0;
    this.coopBossesDefeatedCount = 0;
    this._clearCoopCombatTransitionTimer();
    this.coopCombatTransition = null;
    this.coopCombatTransitionId = 0;
    this._devSpawnBoss2 = false;
    this._devSpawnBoss3 = false;
    this._resetMushroomState();

    // Co-op: begin in the throne prep room — combat arena + enemies start after portal
    if (this.gameMode === 'coop') {
      this.combatArenaActive = false;
      this._pickThronePortalOffer();
      this.teleportAllPlayersToThroneRoom();
      this.spawnThroneTrainingDummy();
      this._throneKnightSlotSeq = 0;
      this.startThroneKnightSpawningLoop();
      this.startEnemyAI();
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

  /** @returns {number} */
  _countLiveThroneKnights() {
    let n = 0;
    for (const e of this.enemies.values()) {
      if (!e || e.type !== 'knight' || !e.throneKnight) continue;
      if (e.isDying) continue;
      if (e.health != null && e.health <= 0) continue;
      n++;
    }
    return n;
  }

  /**
   * @param {number} count
   * @returns {Array<{ x: number, z: number }>}
   */
  _generateThroneKnightPerimeterBatchPositions(count) {
    const positions = [];
    const baseAngle = Math.random() * Math.PI * 2;
    const R = THRONE_HOSTILE_KNIGHT_PERIMETER_RADIUS;
    const half = count > 1 ? (count - 1) / 2 : 0;
    for (let i = 0; i < count; i++) {
      const arcOff = (i - half) * THRONE_KNIGHT_CLUSTER_ARC_SPREAD + (Math.random() - 0.5) * 0.04;
      const radialJitter = (Math.random() - 0.5) * 0.55;
      const rEff = Math.min(COOP_THRONE_ROOM_RADIUS - 0.65, Math.max(R - 0.6, R + radialJitter));
      const a = baseAngle + arcOff;
      positions.push({
        x: Math.cos(a) * rEff,
        z: Math.sin(a) * rEff,
      });
    }
    return positions;
  }

  /** Remove hostile throne-prep knights before leaving staging (so they don't mix with arena spawns). */
  removeAllThroneKnights() {
    const toRemove = [];
    for (const [id, e] of this.enemies) {
      if (e && e.throneKnight && e.type === 'knight') toRemove.push(id);
    }
    for (const id of toRemove) {
      if (!this.enemies.has(id)) continue;
      this.enemies.delete(id);
      if (this.enemyAI) {
        this.enemyAI.removeEnemyAggro(id);
      }
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-removed', {
          enemyId: id,
          timestamp: Date.now(),
        });
      }
    }
  }

  stopThroneKnightSpawningLoop() {
    if (this._throneKnightFirstSpawnTimeoutId) {
      clearTimeout(this._throneKnightFirstSpawnTimeoutId);
      this._throneKnightFirstSpawnTimeoutId = null;
    }
    if (this._throneKnightSpawnIntervalId) {
      clearInterval(this._throneKnightSpawnIntervalId);
      this._throneKnightSpawnIntervalId = null;
    }
  }

  _tickThroneKnightSpawns() {
    if (!this.gameStarted || this.gameMode !== 'coop') return;
    if (this.combatArenaActive) return;

    const live = this._countLiveThroneKnights();
    const batch = Math.min(THRONE_KNIGHT_SPAWN_BATCH, THRONE_KNIGHT_MAX_LIVE - live);
    if (batch <= 0) return;

    const positions = this._generateThroneKnightPerimeterBatchPositions(batch);
    const campKeys = COOP_COLORED_ROOM_TYPES;
    const ts = Date.now();

    for (let i = 0; i < batch; i++) {
      const pick = campKeys[Math.floor(Math.random() * campKeys.length)];
      const campDef = GameRoom.CAMP_TYPES[pick];
      if (!campDef) continue;
      this._throneKnightSlotSeq += 1;
      const pos = positions[i] || { x: 0, z: THRONE_HOSTILE_KNIGHT_PERIMETER_RADIUS };
      const enemy = this._buildEnemy('knight', 0, 900000 + this._throneKnightSlotSeq, pos, campDef);
      enemy.throneKnight = true;

      this.enemies.set(enemy.id, enemy);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-spawned', { enemy, timestamp: ts });
      }
    }
  }

  /** Co-op prep only: first spawn after `THRONE_KNIGHT_FIRST_SPAWN_MS`, then every `THRONE_KNIGHT_SPAWN_INTERVAL_MS`. */
  startThroneKnightSpawningLoop() {
    if (this.gameMode !== 'coop') return;
    this.stopThroneKnightSpawningLoop();
    this._throneKnightFirstSpawnTimeoutId = setTimeout(() => {
      this._throneKnightFirstSpawnTimeoutId = null;
      this._tickThroneKnightSpawns();
      this._throneKnightSpawnIntervalId = setInterval(
        () => this._tickThroneKnightSpawns(),
        THRONE_KNIGHT_SPAWN_INTERVAL_MS,
      );
    }, THRONE_KNIGHT_FIRST_SPAWN_MS);
  }

  /** Staging area (client grass/play disc `COOP_THRONE_ROOM_RADIUS` 32m in ThroneRoom; pillars/portals stay legacy layout). */
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

  getCoopThroneBossKind() {
    return this.coopThroneBossKind;
  }

  getCoopTerrainTheme() {
    if (this.coopBossesDefeatedCount <= 0) return COOP_TERRAIN_THEMES[0];
    if (this.coopBossesDefeatedCount === 1) return COOP_TERRAIN_THEMES[1];
    if (this.coopBossesDefeatedCount === 2) return COOP_TERRAIN_THEMES[2];
    // 4th encounter (Trinity) cycles back to purple for a distinct finale feel.
    return COOP_TERRAIN_THEMES[0];
  }

  _beginCoopCombatTransition({ startAIOnRelease = true } = {}) {
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
    if (transition.startAIOnRelease) {
      this.startEnemyAI();
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🌀 Co-op combat transition ${id} released (${reason})`);
    }
    return true;
  }

  markCoopCombatTransitionReady(playerId, transitionId) {
    const transition = this.coopCombatTransition;
    const id = Number(transitionId);
    if (!transition || !Number.isFinite(id) || transition.id !== id) {
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

  _clearAllCombatEnemies() {
    this.coopWaveSpawnPlan = null;
    this.coopWaveReserveReleased = 0;
    this.roomHasMartyrs = false;
    this.roomHasTitans = false;
    this.roomTitanQuota = 0;
    this.roomTitanSlotIndices = new Set();
    this.roomHasMiniBoss1 = false;
    this.miniBoss1SpawnedThisRoom = false;
    this.tripleBossIds = null;
    this._clearCoopCombatTransitionTimer();
    this.coopCombatTransition = null;
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

  /**
   * After clearing a main-map wave: dual portals until the 3rd room in a segment, then a boss portal; after boss, repeats (3 rooms → boss …).
   * @param {'second_wave'|'boss_gate'} phase
   */
  startMainArenaPortalIntermission(phase) {
    this._clearAllCombatEnemies();
    this.skeletonKillCount = 0;
    this.coopWaveIndex = 0;
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
    if (this.coopWaveIndex === 1) {
      console.log('🌀 Wave 1 complete — main arena: choose next room (center portals).');
      this._coopNextWaveAfterPortal = 2;
      this.startMainArenaPortalIntermission('second_wave');
    } else if (this.coopWaveIndex === 2) {
      console.log('🌀 Wave 2 complete — main arena: choose next room (center portals).');
      this._coopNextWaveAfterPortal = 3;
      this.startMainArenaPortalIntermission('second_wave');
    } else if (this.coopWaveIndex === 3) {
      console.log('🌀 Segment complete (3 enemy rooms cleared) — main arena: boss portal.');
      this.startMainArenaPortalIntermission('boss_gate');
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
    if (this.coopWaveIndex !== 1 && this.coopWaveIndex !== 2 && this.coopWaveIndex !== 3) return;

    const isMixedRoom = this.coopWaveSpawnPlan?.isMixed === true;

    this.skeletonKillCount++;
    const killTarget = COOP_MIXED_WAVE_COUNT;
    console.log(`${emojiLog} (${this.skeletonKillCount}/${killTarget})`);
    if (this.io) {
      this.io.to(this.roomId).emit('skeleton-kill-count-updated', {
        skeletonKillCount: this.skeletonKillCount,
        required: killTarget,
        timestamp: Date.now(),
      });
    }

    if (
      this.skeletonKillCount === COOP_MIXED_FIRST_RESERVE_AT_KILLS ||
      this.skeletonKillCount === COOP_MIXED_SECOND_RESERVE_AT_KILLS ||
      this.skeletonKillCount === COOP_MIXED_THIRD_RESERVE_AT_KILLS
    ) {
      if (isMixedRoom) {
        this._spawnMixedRoomReserveBatch();
      } else {
        this._spawnCoopWaveBatch();
      }
    }

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
    this.stopThroneKnightSpawningLoop();
    this.removeAllThroneKnights();
    this.removeThroneTrainingDummy();
    this.combatArenaActive = true;
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.coopWaveIndex = 1;
    this.coopThroneStep = 'rim';
    this.merchantInventory = [];
    this.teleportAllPlayersToCombatSpawn();
    this.spawnEnemyWave();
    const coopCombatTransitionId = this._beginCoopCombatTransition();

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: false,
        coopThroneBossKind: null,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopCombatTransitionId,
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

    this.stopThroneKnightSpawningLoop();
    this.removeAllThroneKnights();
    this.removeThroneTrainingDummy();
    this.combatArenaActive = true;
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.coopWaveIndex = 0;
    this.coopBossThroneArena = true;
    this.coopThroneBossKind = 'boss';
    this.currentCoopRoomKind = 'boss';
    this.clearedCoopRoomKind = null;
    this.pendingCoopArchetype = null;
    this.pendingCoopRoomKind = null;
    this._postBossIntermissionScheduled = false;
    this.merchantInventory = [];
    this.teleportAllPlayersToCombatSpawn();
    this.spawnBoss();
    this.bossSpawned = true;
    const coopCombatTransitionId = this._beginCoopCombatTransition();

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: true,
        coopThroneBossKind: this.coopThroneBossKind,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopCombatTransitionId,
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
    this.stopThroneKnightSpawningLoop();
    this.removeAllThroneKnights();
    this.removeThroneTrainingDummy();
    this.combatArenaActive = true;
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.coopWaveIndex = 0;
    this.coopBossThroneArena = true;
    this.coopThroneBossKind = 'boss2';
    this.currentCoopRoomKind = 'boss';
    this.clearedCoopRoomKind = null;
    this.pendingCoopArchetype = null;
    this.pendingCoopRoomKind = null;
    this._postBossIntermissionScheduled = false;
    this.merchantInventory = [];
    this.teleportAllPlayersToCombatSpawn();
    this.spawnBoss();
    this.bossSpawned = true;
    const coopCombatTransitionId = this._beginCoopCombatTransition();

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: true,
        coopThroneBossKind: this.coopThroneBossKind,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopCombatTransitionId,
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
    this.stopThroneKnightSpawningLoop();
    this.removeAllThroneKnights();
    this.removeThroneTrainingDummy();
    this.combatArenaActive = true;
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.coopWaveIndex = 0;
    this.coopBossThroneArena = true;
    this.coopThroneBossKind = 'boss3';
    this.currentCoopRoomKind = 'boss';
    this.clearedCoopRoomKind = null;
    this.pendingCoopArchetype = null;
    this.pendingCoopRoomKind = null;
    this._postBossIntermissionScheduled = false;
    this.merchantInventory = [];
    this.teleportAllPlayersToCombatSpawn();
    this.spawnBoss();
    this.bossSpawned = true;
    const coopCombatTransitionId = this._beginCoopCombatTransition();

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        coopBossThroneArena: true,
        coopThroneBossKind: this.coopThroneBossKind,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        coopClearedRoomKind: null,
        merchantInventory: this.getMerchantInventory(),
        coopCombatTransitionId,
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
      this.thronePortalOffer = [];
      this.coopMainArenaPortalPhase = null;
      const nextWave = this._coopNextWaveAfterPortal === 2 || this._coopNextWaveAfterPortal === 3
        ? this._coopNextWaveAfterPortal
        : 2;
      this.coopWaveIndex = nextWave;
      this.skeletonKillCount = 0;
      this.teleportAllPlayersToCombatSpawn();
      if (roomKind === 'merchant') {
        this.sessionCampTypes = [];
        this.generateMerchantInventory();
      } else {
        this.merchantInventory = [];
        this.spawnEnemyWave();
      }
      const coopCombatTransitionId = roomKind === 'merchant' ? null : this._beginCoopCombatTransition();

      if (this.io) {
        this.io.to(this.roomId).emit('combat-arena-entered', {
          players: this.getPlayers(),
          coopBossThroneArena: false,
          coopThroneBossKind: null,
          coopTerrainTheme: this.getCoopTerrainTheme(),
          coopCurrentRoomKind: this.currentCoopRoomKind,
          coopClearedRoomKind: null,
          merchantInventory: this.getMerchantInventory(),
          coopCombatTransitionId,
          timestamp: Date.now(),
        });
      }
      if (roomKind === 'merchant') {
        this.startMainArenaPortalIntermission('second_wave');
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
      this.coopWaveIndex = 0;
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
      this._postBossIntermissionScheduled = false;
      this.merchantInventory = [];
      this.teleportAllPlayersToCombatSpawn();
      this.spawnBoss();
      this.bossSpawned = true;
      const coopCombatTransitionId = this._beginCoopCombatTransition();

      if (this.io) {
        this.io.to(this.roomId).emit('combat-arena-entered', {
          players: this.getPlayers(),
          coopBossThroneArena: true,
          coopThroneBossKind: this.coopThroneBossKind,
          coopTerrainTheme: this.getCoopTerrainTheme(),
          coopCurrentRoomKind: this.currentCoopRoomKind,
          coopClearedRoomKind: null,
          merchantInventory: this.getMerchantInventory(),
          coopCombatTransitionId,
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
      this.thronePortalOffer = [];
      this.coopMainArenaPortalPhase = null;
      this.coopWaveIndex = 1;
      this.skeletonKillCount = 0;
      this.coopBossThroneArena = false;
      this.coopThroneBossKind = null;
      this.bossSpawned = false;
      this.merchantInventory = [];
      this.teleportAllPlayersToCombatSpawn();
      this.spawnEnemyWave();
      const coopCombatTransitionId = this._beginCoopCombatTransition();

      if (this.io) {
        this.io.to(this.roomId).emit('combat-arena-entered', {
          players: this.getPlayers(),
          coopBossThroneArena: false,
          coopThroneBossKind: null,
          coopTerrainTheme: this.getCoopTerrainTheme(),
          coopCurrentRoomKind: this.currentCoopRoomKind,
          coopClearedRoomKind: null,
          merchantInventory: this.getMerchantInventory(),
          coopCombatTransitionId,
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

      this.bossSpawned = false;
      this.skeletonKillCount = 0;
      this.coopWaveIndex = 0;
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
        everliving: false,
        adrenaline: false,
        juggernautStrain: false,
      },
      /** Co-op: blue stagger room boons synced from client (`coop-stagger-room-boons`). */
      coopStaggerRoomBoons: {
        guardbreak: false,
        overshock: false,
      },
    });

    // Position players for co-op mode
    if (gameMode === 'coop') {
      const playerIndex = this.players.size - 1;
      const player = this.players.get(playerId);

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
    this.coopWaveIndex = 0;
    this.coopMainArenaPortalPhase = null;
    this.coopBossThroneArena = false;
    this.coopThroneBossKind = null;
    this._postBossIntermissionScheduled = false;
    this._coopNextWaveAfterPortal = 0;
    this.coopBossesDefeatedCount = 0;
    this.coopWaveSpawnPlan = null;
    this.coopWaveReserveReleased = 0;
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

  getPlayerCount() {
    return this.players.size;
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
      this.io.to(this.roomId).emit('player-damaged', {
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
      this.io.to(this.roomId).emit('player-health-updated', {
        playerId,
        health: player.health,
        maxHealth: player.maxHealth,
      });
    }
    return hitCount;
  }

  /**
   * Like `damagePlayersInLineSegment`, but only damages each player at most once per `hitPlayerIds` Set (mutated on hit).
   * Used by boss 3 nova discs so corridor sweeps cannot multi-tick one player incorrectly.
   */
  damagePlayersInLineSegmentFirstHit(ax, az, bx, bz, halfWidth, damage, damageType = 'boss3_arcane_disc', hitPlayerIds, meta = null) {
    if (!this.io || !this.players || halfWidth <= 0 || damage <= 0 || !hitPlayerIds) return;
    if (this.isCoopCombatTransitionActive()) return;
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
      const previousHealth = player.health;
      player.health = Math.max(0, player.health - damage);
      const wasKilled = previousHealth > 0 && player.health <= 0;
      if (meta?.sourceEnemyId && this.enemyAI) {
        this.enemyAI.recordAlliedProtectionThreat(meta.sourceEnemyId, playerId, damage);
      }
      this.io.to(this.roomId).emit('player-damaged', {
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
      this.io.to(this.roomId).emit('player-health-updated', {
        playerId,
        health: player.health,
        maxHealth: player.maxHealth,
      });
    }
  }

  damagePlayersInHorizontalRing(center, radius, damage, damageType = 'boss_aoe', meta = null) {
    if (!this.io || !this.players || radius <= 0 || damage <= 0 || !center) return;
    if (this.isCoopCombatTransitionActive()) return;
    const cx = center.x;
    const cz = center.z;
    const r2 = radius * radius;
    for (const [playerId, player] of this.players) {
      if (!player || player.health <= 0) continue;
      const dx = player.position.x - cx;
      const dz = player.position.z - cz;
      if (dx * dx + dz * dz > r2) continue;
      const previousHealth = player.health;
      player.health = Math.max(0, player.health - damage);
      const wasKilled = previousHealth > 0 && player.health <= 0;
      if (meta?.sourceEnemyId && this.enemyAI) {
        this.enemyAI.recordAlliedProtectionThreat(meta.sourceEnemyId, playerId, damage);
      }
      this.io.to(this.roomId).emit('player-damaged', {
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
      this.io.to(this.roomId).emit('player-health-updated', {
        playerId,
        health: player.health,
        maxHealth: player.maxHealth
      });
      if (meta?.stunMs && meta.stunMs > 0) {
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
      this.damageEnemy(enemyId, damage, null, null, { damageType });
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

    // Damage by boss-kill tier: [base, after boss 1, after boss 2, after boss 3+].
    const KNIGHT_DAMAGE_BY_TIER = {
      green:  [20, 30, 40, 50],
      red:    [30, 40, 50, 70],
      blue:   [15, 25, 35, 45],
      purple: [20, 30, 40, 50],
    };
    const SHADE_DAMAGE_BY_TIER   = [18, 25, 35, 40];
    const TEMPLAR_DAMAGE_BY_TIER = [48, 60, 78, 96];
    const VIPER_DAMAGE_BY_TIER   = [55, 70, 85, 95];

    const soulStats = {
      green:  { health: 1250, maxHealth: 1250, attackCooldown: 2500, moveSpeed: 2.0 },
      red:    { health: 1000, maxHealth: 1000, attackCooldown: 2500, moveSpeed: 2.0 },
      blue:   { health: 900,  maxHealth: 900,  attackCooldown: 1250, moveSpeed: 2.0 },
      purple: { health: 900,  maxHealth: 900,  attackCooldown: 2500, moveSpeed: 3.25 },
    };

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
      const stats = soulStats[soulType];
      return { id: `knight-${campIndex}-${slotIndex}-${ts}`, type: 'knight', ...base,
        health: stats.health + hpBonus, maxHealth: stats.maxHealth + hpBonus,
        damage: KNIGHT_DAMAGE_BY_TIER[soulType][tier],
        attackCooldown: stats.attackCooldown, moveSpeed: stats.moveSpeed, bossId: null, soulType };
    }
    if (type === 'shade') {
      return { id: `shade-${campIndex}-${slotIndex}-${ts}`, type: 'shade', ...base,
        health: 750 + hpBonus, maxHealth: 750 + hpBonus,
        damage: SHADE_DAMAGE_BY_TIER[tier], attackCooldown: 5500, moveSpeed: 2.0 };
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
    if (type === 'titan') {
      // Excluded from HP scaling.
      const TITAN_STATS_BY_SOUL = {
        blue:   { health: 3500, maxHealth: 3500, damage: 148 },
        red:    { health: 4000, maxHealth: 4000, damage: 134 },
        green:  { health: 5000, maxHealth: 5000, damage: 100 },
        purple: { health: 3000, maxHealth: 3000, damage: 166 },
      };
      const soulType = campDef.knightSoulType;
      const stats = TITAN_STATS_BY_SOUL[soulType];
      return { id: `titan-${campIndex}-${slotIndex}-${ts}`, type: 'titan', ...base,
        health: stats.health, maxHealth: stats.maxHealth, damage: stats.damage,
        moveSpeed: 2.5, patrolSpeed: 1.5, attackCooldown: 2500,
        soulType };
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

  /**
   * Release the next pre-planned reserve slice for stat/trial mixed rooms.
   * Mirrors the staged-spawn logic: +2 at 1 kill, +2 at 3, +2 at 5.
   */
  _spawnMixedRoomReserveBatch() {
    if (this.gameMode !== 'coop' || !this.combatArenaActive || this.bossSpawned) return;
    const plan = this.coopWaveSpawnPlan;
    if (!plan || !plan.isMixed || !plan.entries) return;

    let sliceStart;
    let sliceEnd;
    if (this.coopWaveReserveReleased === 0) {
      sliceStart = COOP_MIXED_INITIAL_ON_MAP;
      sliceEnd = sliceStart + COOP_MIXED_FIRST_RESERVE_COUNT;
      this.coopWaveReserveReleased = 1;
    } else if (this.coopWaveReserveReleased === 1) {
      sliceStart = COOP_MIXED_INITIAL_ON_MAP + COOP_MIXED_FIRST_RESERVE_COUNT;
      sliceEnd = sliceStart + COOP_MIXED_SECOND_RESERVE_COUNT;
      this.coopWaveReserveReleased = 2;
    } else if (this.coopWaveReserveReleased === 2) {
      sliceStart = COOP_MIXED_INITIAL_ON_MAP + COOP_MIXED_FIRST_RESERVE_COUNT + COOP_MIXED_SECOND_RESERVE_COUNT;
      sliceEnd = sliceStart + COOP_MIXED_THIRD_RESERVE_COUNT;
      this.coopWaveReserveReleased = 3;
    } else {
      return;
    }

    const { campDef, entries } = plan;
    for (let slotIndex = sliceStart; slotIndex < sliceEnd; slotIndex++) {
      const cell = entries[slotIndex];
      if (!cell) continue;
      const slotCampDef = cell.campDef || campDef;
      const enemy = this._buildEnemy(cell.unitType, 0, slotIndex, cell.pos, slotCampDef);
      this.enemies.set(enemy.id, enemy);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-spawned', { enemy, timestamp: Date.now() });
        this._emitEnemySummonVfx(enemy);
      }
    }
    console.log(`⚔️ Mixed room reserve: slots ${sliceStart}–${sliceEnd - 1} (${sliceEnd - sliceStart} enemies)`);
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

  /** Pick `quota` random slot indices from [0, totalSlots), excluding reserved slots. */
  _pickTitanSlotIndices(quota, totalSlots, reservedSlots) {
    if (quota <= 0) return new Set();
    const eligible = [];
    for (let i = 0; i < totalSlots; i++) {
      if (!reservedSlots.has(i)) eligible.push(i);
    }
    for (let i = eligible.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
    }
    return new Set(eligible.slice(0, Math.min(quota, eligible.length)));
  }

  /** Overwrite unitType on chosen mixed-room entry slots (keeps campDef for soul color). */
  _injectTitansIntoMixedEntries(entries, quota, reservedSlots = new Set()) {
    if (quota <= 0 || !entries?.length) return;
    const indices = this._pickTitanSlotIndices(quota, entries.length, reservedSlots);
    for (const idx of indices) {
      if (entries[idx]) entries[idx].unitType = 'titan';
    }
  }

  _applyRoomTitanPlan(quota, totalSlots, reservedSlots) {
    this.roomTitanQuota = quota;
    this.roomHasTitans = quota > 0;
    this.roomTitanSlotIndices = this._pickTitanSlotIndices(quota, totalSlots, reservedSlots);
  }

  /**
   * Spawn the next staged batch of colored-room enemies at the far north edge.
   * Initial batch is 2 enemies; reserve batches release at the mixed-room thresholds.
   */
  _spawnCoopWaveBatch(isInitial = false) {
    if (this.gameMode !== 'coop' || !this.combatArenaActive || this.bossSpawned) return;
    if (this.coopWaveIndex !== 1 && this.coopWaveIndex !== 2 && this.coopWaveIndex !== 3) return;
    const plan = this.coopWaveSpawnPlan;
    if (!plan || !plan.campDef || plan.isMixed) return;

    const { campDef } = plan;
    let count;
    let slotOffset;
    if (isInitial) {
      count = COOP_MIXED_INITIAL_ON_MAP;
      slotOffset = 0;
    } else if (this.coopWaveReserveReleased === 0) {
      count = COOP_MIXED_FIRST_RESERVE_COUNT;
      slotOffset = COOP_MIXED_INITIAL_ON_MAP;
    } else if (this.coopWaveReserveReleased === 1) {
      count = COOP_MIXED_SECOND_RESERVE_COUNT;
      slotOffset = COOP_MIXED_INITIAL_ON_MAP + COOP_MIXED_FIRST_RESERVE_COUNT;
    } else if (this.coopWaveReserveReleased === 2) {
      count = COOP_MIXED_THIRD_RESERVE_COUNT;
      slotOffset = COOP_MIXED_INITIAL_ON_MAP + COOP_MIXED_FIRST_RESERVE_COUNT + COOP_MIXED_SECOND_RESERVE_COUNT;
    } else {
      return;
    }

    const positions = this._generateEdgeSpawnPositions(count);
    const batchIndex = isInitial ? 0 : this.coopWaveReserveReleased + 1;

    for (let i = 0; i < count; i++) {
      const pos = positions[i] || { x: 0, z: MAIN_ARENA_HEX_RADIUS * 0.68 };
      const slotIndex = slotOffset + i;
      let unitType;
      if (slotIndex === 0) {
        unitType = 'knight';
      } else if (this.roomHasMiniBoss1 && !this.miniBoss1SpawnedThisRoom && slotIndex === 1) {
        // Assign exactly one mini-boss1 to slot 1 for the whole room (spawns in the initial wave).
        unitType = 'boss';
        this.miniBoss1SpawnedThisRoom = true;
      } else if (this.roomTitanSlotIndices.has(slotIndex)) {
        unitType = 'titan';
      } else if (this.roomHasMartyrs && Math.random() < 0.33) {
        unitType = 'martyr';
      } else {
        const pool = campDef.enemyPool;
        unitType = pool[Math.floor(Math.random() * pool.length)];
      }
      const enemy = this._buildEnemy(unitType, 0, slotIndex, pos, campDef);
      this.enemies.set(enemy.id, enemy);
      // Pre-seed aggro so the enemy immediately marches toward players without
      // needing to enter the short (8–12 unit) proximity aggro radius first.
      // Titans patrol passively until provoked — skip forced aggro.
      if (enemy.type !== 'titan') {
        this.enemyAI.forceAggroOnEnemy(enemy);
      }
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-spawned', { enemy, timestamp: Date.now() });
        this._emitEnemySummonVfx(enemy);
      }
    }

    if (!isInitial) {
      this.coopWaveReserveReleased++;
    }
    console.log(`⚔️ Co-op edge batch ${batchIndex + 1} spawned (${count} enemies at north edge)`);
  }

  /**
   * Spawn the initial wave of enemies for the current room.
   *
   * Colored rooms (red/blue/green/purple) edge-spawn from the far north.
   * Mixed rooms (stat/trial) keep scattered placement. Both use the same 8-enemy
   * staged schedule: 2 initial, then +2 at 1/3/5 counted kills.
   */
  initializeEnemies() {
    this.coopWaveSpawnPlan = null;
    this.coopWaveReserveReleased = 0;
    this.roomTitanQuota = 0;
    this.roomHasTitans = false;
    this.roomTitanSlotIndices = new Set();

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

    if (isMixedRoom) {
      // ── Mixed rooms: scattered-spawn logic ───────────────────────────────────
      const MIXED_WAVE_COUNT = COOP_MIXED_WAVE_COUNT;
      const positions = this._generateScatteredPositions(MIXED_WAVE_COUNT, true);
      const MIXED_INITIAL = COOP_MIXED_INITIAL_ON_MAP;

      const entries = [];

      if (roomKind === 'trial') {
        // ── Trial room: fixed homogeneous composition picked at random ──────────
        const TRIAL_RECIPES = [
          // Knights, each a random camp color
          () => campTypeKeys.map((_k, i) => ({
            unitType: 'knight',
            campDef: GameRoom.CAMP_TYPES[campTypeKeys[i % campTypeKeys.length]],
          })).concat(Array.from({ length: 6 }, (_, i) => ({
            unitType: 'knight',
            campDef: GameRoom.CAMP_TYPES[campTypeKeys[(i + 2) % campTypeKeys.length]],
          }))).slice(0, MIXED_WAVE_COUNT).map((e, i) => ({
            ...e,
            campDef: GameRoom.CAMP_TYPES[campTypeKeys[Math.floor(Math.random() * campTypeKeys.length)]],
            pos: positions[i],
          })),
          // Shades — use blue camp (shades exist in blue + purple; blue gives variety)
          () => Array.from({ length: MIXED_WAVE_COUNT }, (_, i) => ({
            unitType: 'shade',
            campDef: GameRoom.CAMP_TYPES[campTypeKeys[i % campTypeKeys.length]],
            pos: positions[i],
          })),
          // Vipers — alternate blue/green camps (both have vipers)
          () => Array.from({ length: MIXED_WAVE_COUNT }, (_, i) => ({
            unitType: 'viper',
            campDef: GameRoom.CAMP_TYPES[i % 2 === 0 ? 'blue' : 'green'],
            pos: positions[i],
          })),
          // Warlocks — split purple/red
          () => Array.from({ length: MIXED_WAVE_COUNT }, (_, i) => ({
            unitType: 'warlock',
            campDef: GameRoom.CAMP_TYPES[i < 5 ? 'purple' : 'red'],
            pos: positions[i],
          })),
          // Weavers — split green/blue
          () => Array.from({ length: MIXED_WAVE_COUNT }, (_, i) => ({
            unitType: 'weaver',
            campDef: GameRoom.CAMP_TYPES[i < 5 ? 'green' : 'blue'],
            pos: positions[i],
          })),
          // Templars — alternate red/purple
          () => Array.from({ length: MIXED_WAVE_COUNT }, (_, i) => ({
            unitType: 'templar',
            campDef: GameRoom.CAMP_TYPES[i % 2 === 0 ? 'red' : 'purple'],
            pos: positions[i],
          })),
        ];
        const recipe = TRIAL_RECIPES[Math.floor(Math.random() * TRIAL_RECIPES.length)];
        entries.push(...recipe());
      } else {
        // ── Stat room: original random mixed camp/pool behavior ─────────────────
        const pickPool = (def) => { const p = def.enemyPool; return p[Math.floor(Math.random() * p.length)]; };
        for (let slotIndex = 0; slotIndex < MIXED_WAVE_COUNT; slotIndex++) {
          const pos = positions[slotIndex];
          const slotTypeKey = campTypeKeys[Math.floor(Math.random() * campTypeKeys.length)];
          const slotCampDef = GameRoom.CAMP_TYPES[slotTypeKey];
          const unitType = slotIndex === 0 ? 'knight' : pickPool(slotCampDef);
          entries.push({ unitType, pos, campDef: slotCampDef });
        }
      }

      const mixedTitanQuota = this._computeRoomTitanQuota(roomKind);
      const mixedReservedSlots = roomKind === 'stat' ? new Set([0]) : new Set();
      this._injectTitansIntoMixedEntries(entries, mixedTitanQuota, mixedReservedSlots);
      this.roomTitanQuota = mixedTitanQuota;
      this.roomHasTitans = mixedTitanQuota > 0;
      this.roomTitanSlotIndices = new Set(
        entries.map((e, i) => (e.unitType === 'titan' ? i : -1)).filter((i) => i >= 0),
      );

      this.coopWaveSpawnPlan = { campDef, entries, isMixed: true };

      let totalSpawned = 0;
      for (let slotIndex = 0; slotIndex < MIXED_INITIAL; slotIndex++) {
        const { unitType, pos, campDef: slotCampDef } = entries[slotIndex];
        const enemy = this._buildEnemy(unitType, 0, slotIndex, pos, slotCampDef || campDef);
        this.enemies.set(enemy.id, enemy);
        if (this.io) {
          this.io.to(this.roomId).emit('enemy-spawned', { enemy, timestamp: Date.now() });
          this._emitEnemySummonVfx(enemy);
        }
        totalSpawned++;
      }
      console.log(
        `⚔️ Mixed room: spawned ${totalSpawned}/${MIXED_WAVE_COUNT} enemies, titans=${this.roomTitanQuota}, room: ${this.currentCoopRoomKind}`,
      );
    } else {
      // ── Colored rooms: edge-spawn batch system ────────────────────────────────
      this.roomHasMartyrs = Math.random() < COOP_WAVE_MARTYR_ROOM_CHANCE;
      // Roll for a mini-boss1 appearance in this room (only available after Boss2 is defeated).
      this.roomHasMiniBoss1 = this.coopBossesDefeatedCount >= 2
        && Math.random() < COOP_WAVE_BOSS1_ROOM_CHANCE;
      this.miniBoss1SpawnedThisRoom = false;
      const titanQuota = this._computeRoomTitanQuota(roomKind);
      const titanReservedSlots = new Set([0]);
      if (this.roomHasMiniBoss1) titanReservedSlots.add(1);
      this._applyRoomTitanPlan(titanQuota, COOP_MIXED_WAVE_COUNT, titanReservedSlots);
      // Store a minimal plan so _spawnCoopWaveBatch knows the pool.
      this.coopWaveSpawnPlan = { campDef };

      // Spawn initial batch at the far north edge.
      this._spawnCoopWaveBatch(true);

      // Spawn tentacle-spine traps scattered around the arena.
      const edgePositions = this._generateEdgeSpawnPositions(COOP_MIXED_INITIAL_ON_MAP);
      this._spawnTentacleSpinesForWave(edgePositions, campDef);

      console.log(
        `⚔️ Colored room (${typeKey}): batch 1 at north edge, martyrs=${this.roomHasMartyrs}, titans=${this.roomTitanQuota}, miniBoss1=${this.roomHasMiniBoss1}, room: ${this.currentCoopRoomKind}`,
      );
    }

    if (this.io) {
      this.io.to(this.roomId).emit('camps-initialized', {
        campTypes: this.sessionCampTypes,
        coopTerrainTheme: this.getCoopTerrainTheme(),
        coopCurrentRoomKind: this.currentCoopRoomKind,
        timestamp: Date.now()
      });
    }
  }

  spawnEnemy(type) {
    // This function is deprecated - use spawnBoss() instead for co-op mode
    return null;
  }

  getEnemyMaxHealth(type) {
    if (type === 'boss3') {
      return 8500;
    }
    if (type === 'boss' || type === 'boss2') {
      return 5000;
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
   * Clears server CV. Cobra cap matches client COBRA_SHOT venom (29 DPS × 6s).
   */
  detonateWyvernConcentratedVenom(enemyId, fromPlayerId, cobraRemainingRaw = 0) {
    const WYVERN_COBRA_VENOM_MAX_BURST = 29 * 6;
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
    this.damageEnemy(enemyId, total, sourceId, tickPlayer || null, { damageType: 'wyvern_talons_detonate' });
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

  damageEnemy(enemyId, damage, fromPlayerId, player = null, hitMeta = null) {
    const enemy = this.enemies.get(enemyId);
    if (!enemy || enemy.isDying) {
      // Silently reject damage to dying/dead enemies (prevents spam)
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

    if (enemy.type === 'training-dummy' && enemy.health <= 0) {
      enemy.health = enemy.maxHealth;
    }

    console.log(`💥 Enemy ${enemyId} (${enemy.type}) damaged by ${appliedDamage} from player ${fromPlayerId}. Health: ${previousHealth} -> ${enemy.health}`);

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
          console.log(`👤 Stealth aggro bonus: Player ${fromPlayerId} stealth attack on enemy ${enemyId} (${appliedDamage} -> ${aggroAmount} aggro)`);
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
      const damagedPayload = {
        damageEventId: this.nextDamageEventId++,
        enemyId: result.enemyId,
        newHealth: result.newHealth,
        maxHealth: result.maxHealth,
        damage: result.damage,
        fromPlayerId: result.fromPlayerId,
        wasKilled: result.wasKilled,
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
      }
      this.io.to(this.roomId).emit('enemy-damaged', damagedPayload);
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
      this.applyBlizzardChillOnHit(enemyId);
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
      this.applyStatusEffect(enemyId, 'ignite', 3000);
      const totalDot = Math.floor(appliedDamage * 0.8);
      if (totalDot > 0) {
        const tickCount = 3;
        const baseTick = Math.floor(totalDot / tickCount);
        const remainder = totalDot - baseTick * tickCount;
        const tickAmounts = [baseTick, baseTick, baseTick + remainder];
        const delaysMs = [1000, 2000, 3000];
        for (let i = 0; i < tickCount; i++) {
          const tickDamage = tickAmounts[i];
          if (tickDamage <= 0) continue;
          this._scheduleTimeout(() => {
            const target = this.enemies.get(enemyId);
            if (!target || target.isDying || target.health <= 0) return;
            this.damageEnemy(enemyId, tickDamage, fromPlayerId, player, { damageType: 'ignite' });
          }, delaysMs[i]);
        }
      }
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
      this.applyStatusEffect(enemyId, 'ignite', 4000);
      const totalDot = Math.floor(appliedDamage * 0.7);
      if (totalDot > 0) {
        const tickCount = 4;
        const baseTick = Math.floor(totalDot / tickCount);
        const remainder = totalDot - baseTick * tickCount;
        const tickAmounts = [baseTick, baseTick, baseTick, baseTick + remainder];
        const delaysMs = [1000, 2000, 3000, 4000];
        for (let i = 0; i < tickCount; i++) {
          const tickDamage = tickAmounts[i];
          if (tickDamage <= 0) continue;
          this._scheduleTimeout(() => {
            const target = this.enemies.get(enemyId);
            if (!target || target.isDying || target.health <= 0) return;
            this.damageEnemy(enemyId, tickDamage, fromPlayerId, player, { damageType: 'ignite' });
          }, delaysMs[i]);
        }
      }
    }

    // Wyvern Bite — Concentrated Venom: +1 stack per Barrage hit (max 5), 17 DPS per stack, 8s from last stack
    const wyvernVenomDpsPerStack = 17;
    const wyvernVenomMaxStacks = 5;
    const wyvernVenomDurationMs = 8000;
    if (
      !result.wasKilled &&
      hitMeta &&
      hitMeta.damageType === 'barrage' &&
      hitMeta.wyvernBiteVenom &&
      damage > 0 &&
      !enemy.isDying &&
      enemy.health > 0
    ) {
      if (enemy.concentratedVenomStacks == null) enemy.concentratedVenomStacks = 0;
      enemy.concentratedVenomStacks = Math.min(
        wyvernVenomMaxStacks,
        enemy.concentratedVenomStacks + 1,
      );
      enemy.concentratedVenomExpireAt = Date.now() + wyvernVenomDurationMs;
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
            stacks * wyvernVenomDpsPerStack,
            e.concentratedVenomLastPlayerId,
            tickPlayer || null,
            { damageType: 'venom', wyvernBiteConcentratedDoT: true },
          );
        }, 1000);
      }
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
      this.applyGlacialBiteChillOnHit(enemyId);
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
      this.applyBlizzardChillOnHit(enemyId);
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
        hitMeta.damageType === 'icebeam') &&
      typeof hitMeta.staggerToAdd === 'number' &&
      hitMeta.staggerToAdd > 0 &&
      !enemy.isDying
    ) {
      const noStaggerTypes = new Set(['boss-skeleton', 'player-zombie', 'tentacle-spine']);
      if (!noStaggerTypes.has(enemy.type)) {
        if (enemy.staggerBuildup == null) enemy.staggerBuildup = 0;
        enemy.staggerBuildup += hitMeta.staggerToAdd;
        const staggerCap = COOP_BOSS_TYPES.has(enemy.type) ? STAGGER_CAP_BOSS : STAGGER_CAP_NORMAL;
        /** Keep in sync with `STAGGER_PROC_DAMAGE` / `GUARDBREAK_STAGGER_PROC_DAMAGE` in src/utils/talents.ts */
        const staggerBoons = fromPlayerId ? this.players.get(fromPlayerId)?.coopStaggerRoomBoons : null;
        const PROC_DAMAGE = staggerBoons?.guardbreak ? 300 : 150;
        const STUN_MS = staggerBoons?.overshock ? 2500 : 1000;
        let procEnemy = this.enemies.get(enemyId);
        while (
          procEnemy &&
          !procEnemy.isDying &&
          typeof procEnemy.staggerBuildup === 'number' &&
          procEnemy.staggerBuildup >= staggerCap
        ) {
          procEnemy.staggerBuildup -= staggerCap;
          this.damageEnemy(enemyId, PROC_DAMAGE, fromPlayerId, player, { damageType: 'stagger_break' });
          this.applyStatusEffect(enemyId, 'stun', STUN_MS);
          procEnemy = this.enemies.get(enemyId);
          if (this.io && procEnemy) {
            this.io.to(this.roomId).emit('enemy-stagger-proc', {
              enemyId,
              position: { x: procEnemy.position.x, y: procEnemy.position.y, z: procEnemy.position.z },
              damage: PROC_DAMAGE,
              fromPlayerId: fromPlayerId || null,
              timestamp: Date.now(),
            });
          }
        }
        const syncEnemy = this.enemies.get(enemyId);
        if (this.io && syncEnemy && !syncEnemy.isDying) {
          if (syncEnemy.staggerBuildup == null) syncEnemy.staggerBuildup = 0;
          this.io.to(this.roomId).emit('enemy-stagger-updated', {
            enemyId,
            stagger: syncEnemy.staggerBuildup,
            timestamp: Date.now(),
          });
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
          killer.health = Math.min(killer.maxHealth, killer.health + 30);
          this.io.to(this.roomId).emit('player-health-updated', {
            playerId: fromPlayerId,
            health: killer.health,
            maxHealth: killer.maxHealth,
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
          console.log(`⚔️ Wave-room mini-boss1 defeated by player ${fromPlayerId}`);
        } else if (this.tripleBossIds?.has(enemyId)) {
          // ── Triple-boss encounter (4th boss fight) ───────────────────────────
          // Award EXP and drop an item for each fallen boss; trigger completion only
          // when all three are dead.
          this.tripleBossIds.delete(enemyId);
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

            this.io.to(this.roomId).emit('boss-defeated', {
              bossId: enemyId,
              killedBy: fromPlayerId,
              timestamp: Date.now()
            });

            this.spawnBossItemDrops(enemy.position);
          }

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

        // If this skeleton was summoned by a wave-room mini-boss, count it toward
        // the room kill quota (_registerCoopWaveKill is a no-op during real boss fights).
        const parentBoss = enemy.bossId ? this.enemies.get(enemy.bossId) : null;
        if (parentBoss?.waveRoomBoss) {
          this._registerCoopWaveKill('💀 Wave mini-boss skeleton defeated');
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

        this._registerCoopWaveKill('💀 Ghoul killed');

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

        this._registerCoopWaveKill('💣 Martyr killed');

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

          // Also broadcast player health updates
          this.players.forEach((player, playerId) => {
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

  // Stop timed spawns (boss prep timer + throne-prep knight waves)
  stopEnemySpawning() {
    this.stopThroneKnightSpawningLoop();
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

    const maxHealth = bossType === 'boss3' ? 7500 : 5000;
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
    return bossData;
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
      { type: 'boss',  pos: { x: -8, y: 0, z:  3 }, maxHealth: 5000, moveSpeed: 2.5, extra: {} },
      { type: 'boss2', pos: { x:  8, y: 0, z:  3 }, maxHealth: 8500, moveSpeed: 2.0, extra: {} },
      { type: 'boss3', pos: { x:  0, y: 0, z: -9 }, maxHealth: 15000, moveSpeed: 2.0, extra: { summonChargesLeft: 2 } },
    ];

    this.tripleBossIds = new Set();
    const spawnedBosses = [];

    for (const cfg of spawnConfigs) {
      const bossId = `${cfg.type}-trinity-${now}-${rand()}`;
      const bossData = {
        id: bossId,
        type: cfg.type,
        position: { ...cfg.pos },
        initialPosition: { ...cfg.pos },
        rotation: rotationYTowardEntry(cfg.pos.x, cfg.pos.z),
        health: cfg.maxHealth,
        maxHealth: cfg.maxHealth,
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
    return spawnedBosses;
  }

  // Start enemy AI system
  startEnemyAI() {
    if (this.gameStarted && this.players.size > 0) {
      // Start enemy AI for co-op mode
      if (this.gameMode === 'coop') {
        this.enemyAI.startAI();
      }
    }
  }

  // Stop enemy AI system
  stopEnemyAI() {
    this.enemyAI.stopAI();
  }

  // Status effect management methods
  applyStatusEffect(enemyId, effectType, duration) {
    const enemy = this.enemies.get(enemyId);
    if (!enemy) return false;

    if (
      effectType === 'corrupted' &&
      (COOP_BOSS_TYPES.has(enemy.type) || enemy.type === 'boss-skeleton')
    ) {
      return false;
    }

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

  applyBlizzardChillOnHit(enemyId) {
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

  applyGlacialBiteChillOnHit(enemyId) {
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
    return rarityBase + Math.max(0, statBonus || 0) * 4;
  }

  generateMerchantInventory() {
    const pool = [...MERCHANT_BOSS_ITEM_POOL];
    const inventory = [];
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

  purchaseMerchantItem(playerId, stockId) {
    const player = this.players.get(playerId);
    if (!player || !this._isMerchantRoomOpen()) {
      this._emitMerchantPurchaseFailure(playerId, 'merchant_closed');
      return false;
    }
    const entry = this.merchantInventory.find((item) => item.id === stockId);
    if (!entry || entry.sold) {
      this._emitMerchantPurchaseFailure(playerId, 'item_unavailable');
      return false;
    }
    if ((player.gold || 0) < entry.cost) {
      this._emitMerchantPurchaseFailure(playerId, 'not_enough_gold');
      return false;
    }

    player.gold = (player.gold || 0) - entry.cost;
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
        item,
        cost: entry.cost,
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
      red: { type: 'AMULET_OF_STRENGTH', stat: 'strength', label: 'Amulet of Strength' },
      green: { type: 'AMULET_OF_STAMINA', stat: 'stamina', label: 'Amulet of Stamina' },
      blue: { type: 'AMULET_OF_AGILITY', stat: 'agility', label: 'Amulet of Agility' },
      purple: { type: 'AMULET_OF_INTELLECT', stat: 'intellect', label: 'Amulet of Intellect' },
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
    this.enemyChill.clear();
    this.droppedItems.clear();
    this.goldDrops.clear();
    this.merchantInventory = [];
    this.gameStarted = false;
    this.killCount = 0;
    this.bossSpawned = false;
    this.skeletonKillCount = 0;
    this.coopThroneStep = 'rim';
    this.coopWaveIndex = 0;
    this.coopMainArenaPortalPhase = null;
    this.coopBossThroneArena = false;
    this.coopThroneBossKind = null;
    this._postBossIntermissionScheduled = false;
    this._coopNextWaveAfterPortal = 0;
    this.coopBossesDefeatedCount = 0;
    this.coopWaveSpawnPlan = null;
    this.coopWaveReserveReleased = 0;
    this.roomHasMartyrs = false;
    this.roomHasTitans = false;
    this.roomTitanQuota = 0;
    this.roomTitanSlotIndices = new Set();
    this._clearCoopCombatTransitionTimer();
    this.coopCombatTransition = null;
    this.coopCombatTransitionId = 0;
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

  updatePlayerPosition(playerId, position, rotation, movementDirection) {
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

  getKillCount() {
    return this.killCount;
  }

  getGameStarted() {
    return this.gameStarted;
  }
}

module.exports = GameRoom;

