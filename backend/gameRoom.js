const { broadcastEnemySpawn } = require('./enemyHandler');
const EnemyAI = require('./enemyAI');
const {
  COOP_MAIN_ENTRY_X,
  COOP_MAIN_ENTRY_Z,
  rotationYTowardEntry,
  rotationYTowardArenaCenter,
} = require('./coopArenaLayout');

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

/** Runeblade Blizzard talent — Chill; keep in sync with src/utils/talents.ts */
const BLIZZARD_CHILL_STACK_DURATION_MS = 4000;
const BLIZZARD_CHILL_STACKS_TO_FREEZE = 5;
const BLIZZARD_CHILL_SLOW_PER_STACK = 0.2;

/** Co-op arena: regular enemies spawned per wave; boss spawns after this many kills. */
const COOP_WAVE_ENEMY_COUNT = 10;
/** Staged spawns: initial on map, then +2 after this many wave kills, then +3 after this many (cumulative). */
const COOP_WAVE_INITIAL_ON_MAP = 5;
const COOP_WAVE_FIRST_RESERVE_AT_KILLS = 3;
const COOP_WAVE_FIRST_RESERVE_COUNT = 2;
const COOP_WAVE_SECOND_RESERVE_AT_KILLS = 5;
const COOP_WAVE_SECOND_RESERVE_COUNT = 3;
if (
  COOP_WAVE_INITIAL_ON_MAP + COOP_WAVE_FIRST_RESERVE_COUNT + COOP_WAVE_SECOND_RESERVE_COUNT !==
  COOP_WAVE_ENEMY_COUNT
) {
  throw new Error('Co-op staged spawn counts must sum to COOP_WAVE_ENEMY_COUNT');
}

/** Mirror client `MAIN_MAP_RADIUS` — inner castle wall faces at ±this on X/Z. */
const MAIN_MAP_RADIUS = 20;
/** Keep foot XZ inside the playable square with margin for collision radius. */
const MAIN_ARENA_SPAWN_INSET = 1.5;

function clampPositionToMainArenaXZ(x, z) {
  const m = MAIN_MAP_RADIUS - MAIN_ARENA_SPAWN_INSET;
  return {
    x: Math.max(-m, Math.min(m, x)),
    z: Math.max(-m, Math.min(m, z)),
  };
}

class GameRoom {
  constructor(roomId, io) {
    this.roomId = roomId;
    this.players = new Map();
    this.enemies = new Map();
    this.lastUpdate = Date.now();
    this.io = io; // Store io reference for broadcasting

    // Game state management
    this.gameStarted = false;
    this.killCount = 0; // Shared kill count for all players
    this.gameMode = 'coop'; // Default to co-op mode

    // Item drop system
    this.droppedItems = new Map(); // itemId -> { id, type, stat, label, position, droppedAt }

    // Status effect tracking for enemies
    this.enemyStatusEffects = new Map(); // enemyId -> { stun: expiration, freeze: expiration, slow: expiration }
    /** Blizzard talent: enemyId -> { stacks, expiresAt } (expiresAt = epoch ms) */
    this.enemyChill = new Map();

    // Initialize enemy AI system but don't start it yet
    this.enemyAI = new EnemyAI(roomId, io);
    this.enemyAI.setRoom(this);

    // Timer references for cleanup
    this.bossSpawnTimer = null;

    // Track when game started for boss spawning
    this.gameStartTime = 0;
    this.bossSpawned = false;

    /** Co-op: false until a player uses the throne-room portal (enemies + AI start then). */
    this.combatArenaActive = false;

    // Kill tracking toward boss trigger (COOP_WAVE_ENEMY_COUNT regular enemies per wave)
    this.skeletonKillCount = 0;

    /** Session archetype for co-op (`initializeEnemies`); sent on `camps-initialized` and `room-joined`. */
    this.sessionCampTypes = [];
    /** Last wave camp key (red/green/blue/purple); kept for loot when `sessionCampTypes` is cleared (e.g. boss intermission). */
    this.lastCoopWaveCampColor = null;

    /** Co-op throne: two distinct main-room archetypes offered until a portal is used. */
    this.thronePortalOffer = [];

    /** Set in `activateCombatArena` — consumed by `initializeEnemies` on first combat spawn. */
    this.pendingCoopArchetype = null;

    /**
     * Co-op: initial prep only (`rim` portals). Main-map intermissions use `coopMainArenaPortalPhase`.
     */
    this.coopThroneStep = 'rim';
    /** 0 = in throne or waiting for main-arena portal, 1 = first combat wave, 2 = second combat wave. */
    this.coopWaveIndex = 0;
    /**
     * Set between waves on the main combat map (not throne): players pick next wave / boss in arena center.
     * @type {null | 'pick_wave2' | 'pick_boss'}
     */
    this.coopMainArenaPortalPhase = null;

    /**
     * Co-op wave: precomputed slots for staged spawn (5 + 2 + 3). Null when not in an active wave layout.
     * @type {null | { campDef: object, entries: { unitType: string, pos: { x: number, z: number } }[] }}
     */
    this.coopWaveSpawnPlan = null;
    /** How many reserve batches already emitted (0 = only initial 5, 1 = +2 released, 2 = +3 released). */
    this.coopWaveReserveReleased = 0;
  }

  // ── Enemy archetype definitions ────────────────────────────────────────────
  // One archetype is randomly chosen per game session. All regular wave enemies share it.
  // enemyPool: unit types that can fill non-knight slots.
  // knightSoulType: the soul colour used for knights in this archetype.
  static get CAMP_TYPES() {
    return {
      blue:   { color: 'blue',   knightSoulType: 'blue',   enemyPool: ['knight', 'shade', 'weaver'  ] },
      green:  { color: 'green',  knightSoulType: 'green',  enemyPool: ['knight', 'viper', 'weaver'            ] },
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
      });
    }
    
    return true;
  }

  /** Small radial staging area (client grass/play radius uses `COOP_THRONE_ROOM_RADIUS` in ThroneRoom). */
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

  _pickThronePortalOffer() {
    const keys = Object.keys(GameRoom.CAMP_TYPES);
    const a = keys[Math.floor(Math.random() * keys.length)];
    let b = keys[Math.floor(Math.random() * keys.length)];
    while (b === a) {
      b = keys[Math.floor(Math.random() * keys.length)];
    }
    this.thronePortalOffer = [a, b];
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

  _clearAllCombatEnemies() {
    this.coopWaveSpawnPlan = null;
    this.coopWaveReserveReleased = 0;
    this.stopEnemyAI();
    const ids = Array.from(this.enemies.keys());
    for (const id of ids) {
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
   * After wave 1 or 2: stay on main map, show portals in the combat arena center.
   * @param {'second_wave'|'boss_gate'} phase
   */
  startMainArenaPortalIntermission(phase) {
    this._clearAllCombatEnemies();
    this.skeletonKillCount = 0;
    this.coopWaveIndex = 0;
    this.pendingCoopArchetype = null;
    const clearedColor =
      Array.isArray(this.sessionCampTypes) && this.sessionCampTypes.length > 0
        ? String(this.sessionCampTypes[0]).toLowerCase()
        : null;
    this.sessionCampTypes = [];
    this.combatArenaActive = true;

    if (phase === 'second_wave') {
      this._pickThronePortalOffer();
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
        coopClearedRoomColor: clearedColor,
        players: this.getPlayers(),
        enemies: this.getEnemies(),
        timestamp: Date.now(),
      });
    }
  }

  _onCoopWaveThresholdMet() {
    if (this.coopWaveIndex === 1) {
      console.log('🌀 Wave 1 complete — main arena: choose next room (center portals).');
      this.startMainArenaPortalIntermission('second_wave');
    } else if (this.coopWaveIndex === 2) {
      console.log('🌀 Wave 2 complete — main arena: boss gate.');
      this.startMainArenaPortalIntermission('boss_gate');
    }
  }

  _registerCoopWaveKill(emojiLog) {
    if (this.gameMode !== 'coop' || !this.combatArenaActive || this.bossSpawned) return;
    if (this.coopWaveIndex !== 1 && this.coopWaveIndex !== 2) return;
    this.skeletonKillCount++;
    console.log(`${emojiLog} (${this.skeletonKillCount}/${COOP_WAVE_ENEMY_COUNT})`);
    if (this.io) {
      this.io.to(this.roomId).emit('skeleton-kill-count-updated', {
        skeletonKillCount: this.skeletonKillCount,
        required: COOP_WAVE_ENEMY_COUNT,
        timestamp: Date.now(),
      });
    }
    if (
      this.skeletonKillCount === COOP_WAVE_FIRST_RESERVE_AT_KILLS ||
      this.skeletonKillCount === COOP_WAVE_SECOND_RESERVE_AT_KILLS
    ) {
      this._spawnCoopWaveReserveBatch();
    }
    if (this.skeletonKillCount >= COOP_WAVE_ENEMY_COUNT) {
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
    this.removeThroneTrainingDummy();
    this.combatArenaActive = true;
    this.thronePortalOffer = [];
    this.coopMainArenaPortalPhase = null;
    this.coopWaveIndex = 1;
    this.coopThroneStep = 'rim';
    this.teleportAllPlayersToCombatSpawn();
    this.spawnEnemyWave();
    this.startEnemyAI();

    if (this.io) {
      this.io.to(this.roomId).emit('combat-arena-entered', {
        players: this.getPlayers(),
        timestamp: Date.now(),
      });
    }
    return true;
  }

  /**
   * Main combat map: after wave 1 or 2, two portals or boss gate at arena center.
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
      if (!GameRoom.CAMP_TYPES[pick]) {
        return false;
      }
      this.pendingCoopArchetype = pick;
      this.thronePortalOffer = [];
      this.coopMainArenaPortalPhase = null;
      this.coopWaveIndex = 2;
      this.skeletonKillCount = 0;
      this.teleportAllPlayersToCombatSpawn();
      this.spawnEnemyWave();
      this.startEnemyAI();

      if (this.io) {
        this.io.to(this.roomId).emit('combat-arena-entered', {
          players: this.getPlayers(),
          timestamp: Date.now(),
        });
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
      this.teleportAllPlayersToCombatSpawn();
      this.spawnBoss();
      this.bossSpawned = true;
      this.startEnemyAI();

      if (this.io) {
        this.io.to(this.roomId).emit('combat-arena-entered', {
          players: this.getPlayers(),
          timestamp: Date.now(),
        });
      }
      return true;
    }

    return false;
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
      movementDirection: { x: 0, y: 0, z: 0 },
      joinedAt: Date.now(),
      isStealthing: false, // Sabres stealth ability state
      isInvisible: false, // Whether player is currently invisible
      reaperCrossentropyStack: 0, // Reaper talent: +base damage from Crossentropy kills (session)
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
    this.players.delete(playerId);

    // Stop game if no players left
    if (this.players.size === 0 && this.gameStarted) {
      this.stopGame();
    }
  }

  // Stop the game
  stopGame() {
    this.gameStarted = false;
    this.combatArenaActive = false;
    this.thronePortalOffer = [];
    this.pendingCoopArchetype = null;
    this.bossSpawned = false;
    this.skeletonKillCount = 0;
    this.coopThroneStep = 'rim';
    this.coopWaveIndex = 0;
    this.coopMainArenaPortalPhase = null;
    this.coopWaveSpawnPlan = null;
    this.coopWaveReserveReleased = 0;
    this.stopEnemySpawning();
    this.stopEnemyAI();

    // Clear all enemies
    this.enemies.clear();
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

  // Enemy management
  spawnEnemyWave() {
    if (!this.gameStarted) return;

    if (this.gameMode === 'coop') {
      this.initializeEnemies();
    }
  }

  // Build one enemy object at the given position for the given type/camp.
  _buildEnemy(type, campIndex, slotIndex, pos, campDef) {
    const soulStats = {
      green:  { health: 1400, maxHealth: 1400, damage: 25,  attackCooldown: 2500, moveSpeed: 2.0 },
      red:    { health: 1050,  maxHealth: 1050,  damage: 50,  attackCooldown: 2500, moveSpeed: 2.0 },
      blue:   { health: 900,  maxHealth: 900,  damage: 25,  attackCooldown: 1250, moveSpeed: 2.0 },
      purple: { health: 850,  maxHealth: 850,  damage: 30,  attackCooldown: 2500, moveSpeed: 4.0 },
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
        health: stats.health, maxHealth: stats.maxHealth, damage: stats.damage,
        attackCooldown: stats.attackCooldown, moveSpeed: stats.moveSpeed, bossId: null, soulType };
    }
    if (type === 'shade') {
      return { id: `shade-${campIndex}-${slotIndex}-${ts}`, type: 'shade', ...base,
        health: 750, maxHealth: 750, damage: 25, attackCooldown: 3500, moveSpeed: 2.0 };
    }
    if (type === 'warlock') {
      return { id: `warlock-${campIndex}-${slotIndex}-${ts}`, type: 'warlock', ...base,
        health: 800, maxHealth: 800, damage: 100, moveSpeed: 0,
        soulType: campDef.knightSoulType };
    }
    if (type === 'templar') {
      return { id: `templar-${campIndex}-${slotIndex}-${ts}`, type: 'templar', ...base,
        health: 1000, maxHealth: 1000, damage: 60, attackCooldown: 2000, moveSpeed: 3.5 };
    }
    if (type === 'weaver') {
      return { id: `weaver-${campIndex}-${slotIndex}-${ts}`, type: 'weaver', ...base,
        health: 700, maxHealth: 700, damage: 0, moveSpeed: 2.0,
        soulType: campDef.knightSoulType };
    }
    if (type === 'martyr') {
      return { id: `martyr-${campIndex}-${slotIndex}-${ts}`, type: 'martyr', ...base,
        health: 200, maxHealth: 200, damage: 0, moveSpeed: 3.0,
        soulType: campDef.knightSoulType };
    }
    // viper
    return { id: `viper-${campIndex}-${slotIndex}-${ts}`, type: 'viper', ...base,
      health: 650, maxHealth: 650, damage: 70, attackCooldown: 5000, moveSpeed: 2.0 };
  }

  // Pick a random point inside a circle on the map, excluding certain zones.
  // Returns null if no valid position was found after MAX_ATTEMPTS.
  _randomMapPos(mapRadius, exclusions, existing, minDistFromOthers) {
    const MAX_ATTEMPTS = 120;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Uniform distribution within the axis-aligned square [-mapRadius, mapRadius]²
      const x = (Math.random() * 2 - 1) * mapRadius;
      const z = (Math.random() * 2 - 1) * mapRadius;

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
  _generateScatteredPositions(total) {
    const MAX_MAP_RADIUS  = 18;  // keep well within the main map radius (20)
    const SPAWN_EXCL_R    = 9;   // avoid the player entry zone (co-op main entry XZ)
    const exclusions = [
      { x: COOP_MAIN_ENTRY_X, z: COOP_MAIN_ENTRY_Z, radius: SPAWN_EXCL_R },
    ];

    const NUM_CLUSTERS    = 3;
    const CLUSTER_SIZE    = 3;
    const NUM_LONERS      = total - NUM_CLUSTERS * CLUSTER_SIZE;

    const positions = [];

    // ── Clusters ──────────────────────────────────────────────────────────────
    for (let c = 0; c < NUM_CLUSTERS; c++) {
      // Pick a cluster seed well away from other seeds (min 10 units apart)
      const seed = this._randomMapPos(MAX_MAP_RADIUS, exclusions, positions, 10);
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
          if (Math.abs(mx) > MAX_MAP_RADIUS || Math.abs(mz) > MAX_MAP_RADIUS) continue;
          if (exclusions.some(e => Math.hypot(mx - e.x, mz - e.z) < e.radius)) continue;
          if (positions.some(p => Math.hypot(p.x - mx, p.z - mz) < 1.8)) continue;
          positions.push({ x: mx, z: mz });
          placed = true;
          break;
        }
        if (!placed) {
          // Fallback: put near seed with random offset
          positions.push({ x: seed.x + (Math.random() - 0.5) * 3, z: seed.z + (Math.random() - 0.5) * 3 });
        }
      }
    }

    // ── Lone units ────────────────────────────────────────────────────────────
    for (let i = 0; i < NUM_LONERS; i++) {
      const pos = this._randomMapPos(MAX_MAP_RADIUS, exclusions, positions, 4);
      if (pos) positions.push(pos);
    }

    return positions;
  }

  /** Release the next reserve batch (+2 at 3 kills, +3 at 5 kills). */
  _spawnCoopWaveReserveBatch() {
    if (this.gameMode !== 'coop' || !this.combatArenaActive || this.bossSpawned) return;
    if (this.coopWaveIndex !== 1 && this.coopWaveIndex !== 2) return;
    const plan = this.coopWaveSpawnPlan;
    if (!plan || !plan.entries || plan.entries.length !== COOP_WAVE_ENEMY_COUNT) return;

    let sliceStart;
    let sliceEnd;
    if (this.coopWaveReserveReleased === 0) {
      sliceStart = COOP_WAVE_INITIAL_ON_MAP;
      sliceEnd = COOP_WAVE_INITIAL_ON_MAP + COOP_WAVE_FIRST_RESERVE_COUNT;
      this.coopWaveReserveReleased = 1;
    } else if (this.coopWaveReserveReleased === 1) {
      sliceStart = COOP_WAVE_INITIAL_ON_MAP + COOP_WAVE_FIRST_RESERVE_COUNT;
      sliceEnd = sliceStart + COOP_WAVE_SECOND_RESERVE_COUNT;
      this.coopWaveReserveReleased = 2;
    } else {
      return;
    }

    const { campDef, entries } = plan;
    for (let slotIndex = sliceStart; slotIndex < sliceEnd; slotIndex++) {
      const cell = entries[slotIndex];
      if (!cell) continue;
      const enemy = this._buildEnemy(cell.unitType, 0, slotIndex, cell.pos, campDef);
      this.enemies.set(enemy.id, enemy);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-spawned', { enemy, timestamp: Date.now() });
      }
    }
    console.log(`⚔️ Co-op reserve batch: slots ${sliceStart}–${sliceEnd - 1} (${sliceEnd - sliceStart} enemies)`);
  }

  // Spawn all regular enemies using a single randomly chosen archetype.
  // Precomputes 10 slots; only the first 5 enter the map until kill thresholds release +2 and +3.
  initializeEnemies() {
    this.coopWaveSpawnPlan = null;
    this.coopWaveReserveReleased = 0;

    const campTypeKeys = Object.keys(GameRoom.CAMP_TYPES);
    let typeKey = this.pendingCoopArchetype;
    this.pendingCoopArchetype = null;
    if (!typeKey || !GameRoom.CAMP_TYPES[typeKey]) {
      typeKey = campTypeKeys[Math.floor(Math.random() * campTypeKeys.length)];
    }
    const campDef = GameRoom.CAMP_TYPES[typeKey];

    this.sessionCampTypes = [typeKey];
    this.lastCoopWaveCampColor = typeKey;

    const positions = this._generateScatteredPositions(COOP_WAVE_ENEMY_COUNT);
    const martyrCount = 2 + Math.floor(Math.random() * 4); // 2–5 inclusive
    const entries = [];
    for (let slotIndex = 0; slotIndex < COOP_WAVE_ENEMY_COUNT; slotIndex++) {
      const pos = positions[slotIndex];
      let unitType;
      if (slotIndex === 0) {
        unitType = 'knight';
      } else if (slotIndex >= 1 && slotIndex < 1 + martyrCount) {
        unitType = 'martyr';
      } else {
        const pool = campDef.enemyPool;
        unitType = pool[Math.floor(Math.random() * pool.length)];
      }
      entries.push({ unitType, pos });
    }
    this.coopWaveSpawnPlan = { campDef, entries };

    let totalSpawned = 0;
    for (let slotIndex = 0; slotIndex < COOP_WAVE_INITIAL_ON_MAP; slotIndex++) {
      const { unitType, pos } = entries[slotIndex];
      const enemy = this._buildEnemy(unitType, 0, slotIndex, pos, campDef);
      this.enemies.set(enemy.id, enemy);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-spawned', { enemy, timestamp: Date.now() });
      }
      totalSpawned++;
    }

    if (this.io) {
      this.io.to(this.roomId).emit('camps-initialized', {
        campTypes: [typeKey],
        timestamp: Date.now()
      });
    }

    const reserved = COOP_WAVE_ENEMY_COUNT - totalSpawned;
    console.log(
      `⚔️ Spawned ${totalSpawned} enemies (${reserved} staged), archetype: ${typeKey}`
    );
  }

  spawnEnemy(type) {
    // This function is deprecated - use spawnBoss() instead for co-op mode
    return null;
  }

  getEnemyMaxHealth(type) {
    // Co-op mode only supports boss enemies
    if (type === 'boss') {
      return 37500; // Boss has fixed 37,500 HP
    }
    
    return 37500; // Fallback to boss health
  }

  generateRandomPosition() {
    // Not used for boss (boss always spawns at center)
    // Kept for compatibility but returns center position
    return { x: 0, y: 0, z: 0 };
  }

  damageEnemy(enemyId, damage, fromPlayerId, player = null, hitMeta = null) {
    const enemy = this.enemies.get(enemyId);
    if (!enemy || enemy.isDying) {
      // Silently reject damage to dying/dead enemies (prevents spam)
      return null;
    }

    const previousHealth = enemy.health;
    enemy.health = Math.max(0, enemy.health - damage);

    if (enemy.type === 'training-dummy' && enemy.health <= 0) {
      enemy.health = enemy.maxHealth;
    }

    console.log(`💥 Enemy ${enemyId} (${enemy.type}) damaged by ${damage} from player ${fromPlayerId}. Health: ${previousHealth} -> ${enemy.health}`);

    // Track damage for aggro system
    if (this.enemyAI && fromPlayerId) {
      if (enemy.type === 'boss') {
        this.enemyAI.trackBossDamage(enemyId, fromPlayerId, damage, player);
      } else if (enemy.type !== 'training-dummy') {
        // Apply aggro for regular enemies too
        let aggroAmount = damage;
        if (player && player.isStealthing) {
          aggroAmount *= 10.0; // Same 10x multiplier as bosses
          console.log(`👤 Stealth aggro bonus: Player ${fromPlayerId} stealth attack on enemy ${enemyId} (${damage} -> ${aggroAmount} aggro)`);
        }
        this.enemyAI.updateAggro(enemyId, fromPlayerId, aggroAmount);
      }
    }

    const result = {
      enemyId,
      newHealth: enemy.health,
      maxHealth: enemy.maxHealth,
      damage,
      fromPlayerId,
      wasKilled: previousHealth > 0 && enemy.health <= 0
    };

    // Always sync HP to clients (socket `enemy-damage` and internal sources e.g. player-zombie hits).
    if (this.io) {
      const damagedPayload = {
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
      }
      this.io.to(this.roomId).emit('enemy-damaged', damagedPayload);
    }

    if (
      hitMeta &&
      hitMeta.damageType === 'blizzard' &&
      damage > 0 &&
      !result.wasKilled &&
      !enemy.isDying &&
      enemy.health > 0
    ) {
      this.applyBlizzardChillOnHit(enemyId);
    }

    // Infernal Smite / INFERNO (Crossentropy): Ignite DoT — 80% of hit over 3s in 3 ticks (non-lethal hits only)
    const infernoDotEligible =
      !result.wasKilled &&
      hitMeta &&
      damage > 0 &&
      !enemy.isDying &&
      enemy.health > 0 &&
      ((hitMeta.damageType === 'smite' && hitMeta.infernalSmite) ||
        (hitMeta.damageType === 'crossentropy' && hitMeta.infernoCrossentropy));
    if (infernoDotEligible) {
      this.applyStatusEffect(enemyId, 'ignite', 3000);
      const totalDot = Math.floor(damage * 0.8);
      if (totalDot > 0) {
        const tickCount = 3;
        const baseTick = Math.floor(totalDot / tickCount);
        const remainder = totalDot - baseTick * tickCount;
        const tickAmounts = [baseTick, baseTick, baseTick + remainder];
        const delaysMs = [1000, 2000, 3000];
        for (let i = 0; i < tickCount; i++) {
          const tickDamage = tickAmounts[i];
          if (tickDamage <= 0) continue;
          setTimeout(() => {
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
            { damageType: 'venom' },
          );
        }, 1000);
      }
    }

    // Staggering Strike / Staggering Combo / Staggering Swipes: build stagger; at 100, proc damage + stun + VFX
    if (
      !result.wasKilled &&
      hitMeta &&
      (hitMeta.damageType === 'wraith_strike' ||
        hitMeta.damageType === 'runeblade_combo' ||
        hitMeta.damageType === 'sabre_left' ||
        hitMeta.damageType === 'sabre_right' ||
        hitMeta.damageType === 'smite' ||
        hitMeta.damageType === 'projectile') &&
      typeof hitMeta.staggerToAdd === 'number' &&
      hitMeta.staggerToAdd > 0 &&
      !enemy.isDying
    ) {
      const noStaggerTypes = new Set(['boss', 'boss-skeleton', 'player-zombie']);
      if (!noStaggerTypes.has(enemy.type)) {
        if (enemy.staggerBuildup == null) enemy.staggerBuildup = 0;
        enemy.staggerBuildup += hitMeta.staggerToAdd;
        const STAGGER_CAP = 100;
        /** Keep in sync with `STAGGER_PROC_DAMAGE` in src/utils/talents.ts */
        const PROC_DAMAGE = 175;
        let procEnemy = this.enemies.get(enemyId);
        while (
          procEnemy &&
          !procEnemy.isDying &&
          typeof procEnemy.staggerBuildup === 'number' &&
          procEnemy.staggerBuildup >= STAGGER_CAP
        ) {
          procEnemy.staggerBuildup -= STAGGER_CAP;
          this.damageEnemy(enemyId, PROC_DAMAGE, fromPlayerId, player, { damageType: 'stagger_break' });
          this.applyStatusEffect(enemyId, 'stun', 3000);
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
      if (enemy._concentratedVenomIntervalId) {
        clearInterval(enemy._concentratedVenomIntervalId);
        enemy._concentratedVenomIntervalId = null;
      }
      enemy.concentratedVenomStacks = 0;
      enemy.isDying = true;
      enemy.deathTime = Date.now();

      // INFESTED STRIKE: raise zombie on Wraith Strike kill (non-boss, non-dummy)
      if (
        hitMeta &&
        hitMeta.damageType === 'wraith_strike' &&
        hitMeta.infestedStrike &&
        fromPlayerId &&
        fromPlayerId !== 'unknown' &&
        enemy.type !== 'training-dummy' &&
        enemy.type !== 'boss' &&
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
        enemy.type !== 'boss' &&
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
        enemy.type !== 'boss' &&
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

      // Special rewards for boss kills
      if (enemy.type === 'boss') {
        // Award significant EXP to all players for defeating the boss
        if (this.io) {
          this.players.forEach((player, playerId) => {
            this.io.to(this.roomId).emit('player-experience-gained', {
              playerId: playerId,
              experienceGained: 1000, // 1000 EXP for boss kill
              source: 'boss_kill',
              enemyId: enemyId,
              timestamp: Date.now()
            });
          });

          // Broadcast special boss defeated message
          this.io.to(this.roomId).emit('boss-defeated', {
            bossId: enemyId,
            killedBy: fromPlayerId,
            timestamp: Date.now()
          });

          // Always drop 2 random unique boss reward items
          this.spawnBossItemDrops(enemy.position);
        }
        
        console.log(`🎉 BOSS DEFEATED by player ${fromPlayerId}!`);
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

        setTimeout(() => {
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

        setTimeout(() => {
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

        setTimeout(() => {
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

        setTimeout(() => {
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

        setTimeout(() => {
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

        if (this.enemyAI) {
          this.enemyAI.removeEnemyAggro(enemyId);
        }

        setTimeout(() => {
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

        setTimeout(() => {
          this.enemies.delete(enemyId);
          console.log(`🗑️ Martyr ${enemyId} removed from enemies map after death fade`);
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

        setTimeout(() => {
          this.enemies.delete(enemyId);
          console.log(`🗑️ Viper ${enemyId} removed from enemies map after death fade`);
          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', { enemyId, timestamp: Date.now() });
          }
        }, 2500);

        return result;

      } else if (enemy.type === 'player-zombie') {
        if (this.enemyAI) {
          this.enemyAI.unregisterPlayerZombie(enemy.ownerPlayerId, enemyId);
          this.enemyAI.removeEnemyAggro(enemyId);
        }
        setTimeout(() => {
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
      setTimeout(() => {
        this.enemies.delete(enemyId);
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
    if (kills < 10) return 1;
    if (kills < 25) return 2;
    if (kills < 45) return 3;
    if (kills < 70) return 4;
    return 5;                      // Level 5: 70+ kills
  }

  // Stop enemy spawning (no-op now that spawning is replaced by fixed placement)
  stopEnemySpawning() {
    if (this.bossSpawnTimer) {
      clearTimeout(this.bossSpawnTimer);
      this.bossSpawnTimer = null;
    }
  }

  // Spawn the boss enemy
  spawnBoss() {
    if (!this.gameStarted || this.bossSpawned) return null;

    const bossId = `boss-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Spawn boss at center of arena
    const position = { x: 0, y: 0, z: 0 };

    const maxHealth = 6900;
    const bossData = {
      id: bossId,
      type: 'boss',
      position,
      initialPosition: { ...position },
      rotation: rotationYTowardEntry(0, 0),
      health: maxHealth,
      maxHealth: maxHealth,
      spawnedAt: Date.now(),
      isDying: false,
      staggerBuildup: 0,
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

    console.log(`👹 Boss spawned with ${maxHealth} HP at center of arena!`);
    return bossData;
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
    if (!this.enemies.has(enemyId)) return false;

    if (!this.enemyStatusEffects.has(enemyId)) {
      this.enemyStatusEffects.set(enemyId, {});
    }

    const effects = this.enemyStatusEffects.get(enemyId);
    effects[effectType] = Date.now() + duration;

    // Broadcast status effect to all players
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-status-effect', {
        enemyId,
        effectType,
        duration,
        timestamp: Date.now()
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

    this.droppedItems.set(itemId, item);

    if (this.io) {
      this.io.to(this.roomId).emit('item-dropped', { item, timestamp: Date.now() });
    }

    // Auto-expire after 60 seconds
    setTimeout(() => {
      if (this.droppedItems.has(itemId)) {
        this.droppedItems.delete(itemId);
        if (this.io) {
          this.io.to(this.roomId).emit('item-expired', { itemId, timestamp: Date.now() });
        }
      }
    }, 60000);

    console.log(`💍 Item dropped: ${item.label} (${itemId}) at (${position.x.toFixed(1)}, ${position.z.toFixed(1)})`);
    return item;
  }

  // Always drop 2 unique random boss reward items when the boss is slain
  spawnBossItemDrops(position) {
    const bossItemPool = [
      { type: 'CLOAK_OF_SPEED',  label: 'Cloak of Speed',  category: 'boss_drop' },
      { type: 'WARDING_SHIELD',  label: 'Warding Shield',  category: 'boss_drop' },
      { type: 'HOLY_RELIC',      label: 'Holy Relic',      category: 'boss_drop' },
      { type: 'TITAN_HEART',     label: 'Titan Heart',     category: 'boss_drop' },
    ];

    // Shuffle and pick 2 distinct items
    const shuffled = [...bossItemPool].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, 2);

    const offsets = [-2.0, 2.0];
    chosen.forEach((itemDef, index) => {
      const itemId = `boss-item-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const item = {
        id: itemId,
        type: itemDef.type,
        label: itemDef.label,
        category: itemDef.category,
        position: { x: position.x + offsets[index], y: 0.3, z: position.z },
        droppedAt: Date.now(),
      };

      this.droppedItems.set(itemId, item);

      if (this.io) {
        this.io.to(this.roomId).emit('item-dropped', { item, timestamp: Date.now() });
      }

      // Boss items persist for 3 minutes
      setTimeout(() => {
        if (this.droppedItems.has(itemId)) {
          this.droppedItems.delete(itemId);
          if (this.io) {
            this.io.to(this.roomId).emit('item-expired', { itemId, timestamp: Date.now() });
          }
        }
      }, 180000);

      console.log(`👑 Boss drop: ${item.label} (${itemId}) at (${item.position.x.toFixed(1)}, ${item.position.z.toFixed(1)})`);
    });
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
    this.stopEnemySpawning();
    this.stopEnemyAI();

    this.players.clear();
    this.enemies.clear();
    this.enemyStatusEffects.clear();
    this.enemyChill.clear();
    this.droppedItems.clear();
    this.gameStarted = false;
    this.killCount = 0;
    this.bossSpawned = false;
    this.skeletonKillCount = 0;
    this.coopThroneStep = 'rim';
    this.coopWaveIndex = 0;
    this.coopMainArenaPortalPhase = null;
    this.coopWaveSpawnPlan = null;
    this.coopWaveReserveReleased = 0;
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

