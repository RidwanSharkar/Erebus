const { WALL_SEGMENTS } = require('./wallData');
const { rotationYTowardEntry } = require('./coopArenaLayout');

// ─── Navigation grid constants ────────────────────────────────────────────────
// The grid covers the playable area with 1-unit cells. Walls are "inflated" by
// NAV_ENEMY_RADIUS so that enemy centres always stay clear of geometry.
const NAV_MIN_X       = -32;
const NAV_MIN_Z       = -32;
const NAV_CELL_SIZE   = 0.25;
const NAV_COLS        = 64;
const NAV_ROWS        = 64;
const NAV_ENEMY_RADIUS = 0.2;  // slightly wider than collision radius
const NAV_WAYPOINT_REACH = 0.2; // advance to next waypoint when this close
const NAV_RECOMPUTE_DIST = 0.5; // recompute path when target moves this far

// Melee units advance until this much *inside* max swing range so the damage
// check at swing end is harder to escape with a small back-step.
const MELEE_CLOSE_INSET = 0.35;
const KNIGHT_MELEE_WINDUP_STEP = 0.3;
const KNIGHT_MELEE_WINDUP_STEP_DELAY_MS = 450;
const KNIGHT_DASH_COOLDOWN_MS = 8000;
const KNIGHT_DASH_DISTANCE = 4.5;
const KNIGHT_DASH_DURATION_MS = 350;
const KNIGHT_DASH_MIN_DISTANCE = 3.25;

// Knight / templar / ghoul / martyr: ring goals + peer separation (radii match client CoopGameScene hit spheres).
const MELEE_SURROUND_TYPES = new Set(['knight', 'templar', 'ghoul', 'martyr']);
const MELEE_PEER_SEP_PADDING = 0.05;
// Tight ring: closer to player than ~0.82×attackRange so units path/hug obstacles less awkwardly.
const MELEE_SURROUND_STANDOFF_FRAC = 0.18;
const MELEE_SURROUND_STANDOFF_MIN = 0.3;
const MELEE_SURROUND_STANDOFF_MARGIN = 0.08; 

// Leash to current non-player damage threat (arena ~64×64).
const DAMAGE_THREAT_LEASH = 90;

// Infested player-zombie summon lock — keep in sync with client ZombieRenderer SUMMON_DURATION
const INFESTED_ZOMBIE_SUMMON_LOCK_MS = 2800;

// Co-op Viper: client projectile + ground line use this (see ViperArrowProjectile, CoopGameScene).
const VIPER_ARROW_MAX_RANGE = 18;
// Shade daggers: same fixed ray length (telegraphShadeAttack maxRange / endPosition).
const SHADE_DAGGER_MAX_RANGE = VIPER_ARROW_MAX_RANGE;
const SHADE_BLINK_DURATION_MS = 600; // keep in sync with ShadeRenderer.tsx
const SHADE_THROW_ANIMATION_MS = 1500; // keep in sync with ShadeRenderer.tsx ATTACK_DURATION
/** Shade dagger flight time on client (VIPER_ARROW_MAX_RANGE / ShadeDaggerProjectile SPEED); post-blink must run after this so origin stays valid. */
const SHADE_DAGGER_PROJECTILE_SPEED = 25;
const SHADE_POST_ATTACK_BLINK_BUFFER_MS = 80;
const SHADE_POST_ATTACK_BLINK_DELAY_MS =
  SHADE_THROW_ANIMATION_MS +
  Math.ceil((VIPER_ARROW_MAX_RANGE / SHADE_DAGGER_PROJECTILE_SPEED) * 1000) +
  SHADE_POST_ATTACK_BLINK_BUFFER_MS;

// Templar Blink Smite: first cast 15s after aggro, then every 15s; windup 1s then AOE in front of templar
const TEMPLAR_BLINK_SMITE_INTERVAL_MS = 12500;
const TEMPLAR_BLINK_SMITE_STRIKE_DELAY_MS = 750;
const TEMPLAR_BLINK_SMITE_IMPACT_OFFSET = 2.75;
const TEMPLAR_BLINK_SMITE_DAMAGE = 75;
const TEMPLAR_BLINK_SMITE_RADIUS = 2.5;
const TEMPLAR_BLINK_SMITE_ABILITY_LOCK_MS = 2500; // no move/melee during windup + post-strike
const TELEPORT_BEHIND_DISTANCE = 2.2; // same as boss blink (templar blink smite; not used by main co-op boss)

// Co-op main boss (GLB): melee + leap + tectonic
const BOSS_MELEE_RANGE = 3;
const BOSS_MELEE_COOLDOWN_MS = 2750;
const BOSS_MELEE_DAMAGE = 20;
/** No translation during melee swing (matches knight `SWING_LOCK_MS`). */
const BOSS_MELEE_ATTACK_LOCK_MS = 1200;
/** Leap only once at or below this health fraction (not at full HP). */
const BOSS_LEAP_MAX_HP_PCT = 0.95;
const BOSS_STANDOFF_M = 3.2;
const BOSS_LEAP_LAND_STANDOFF_M = 0.65; // land near player for leap (not full walk standoff 3.2m)
const BOSS_LEAP_COOLDOWN_MS = 8000;
const BOSS_LEAP_MAX_TRAVEL = 14;
/** Inside co-op boss throne shell (~`COOP_THRONE_ROOM_RADIUS` 16); keep leaps shorter. */
const BOSS_LEAP_MAX_TRAVEL_THRONE = 12;
/** Playable disc inset so boss feet stay inside grass ring. */
const COOP_BOSS_THRONE_ARENA_CLAMP_R = 14;
const BOSS_LEAP_DURATION_MS = 1325;
const BOSS_LEAP_LANDING_RADIUS = 3.5;
const BOSS_LEAP_DAMAGE = 25;
const BOSS_TECTONIC_COOLDOWN_MS = 20000;
const BOSS_TECTONIC_MAX_HP_PCT = 0.75;
const BOSS_TECTONIC_CENTER_DIST = 0.85;
const BOSS_TECTONIC_JUMP_INTERVAL_MS = 900;
const BOSS_TECTONIC_JUMP_COUNT = 16;
const BOSS_TECTONIC_SPIKE_WARN_MS = 750;
// Keep in sync with TECTONIC_HIT_RADIUS in src/components/enemies/BossTectonicSpikeTelegraph.tsx
const BOSS_TECTONIC_SHARD_RADIUS = 2.5;
const BOSS_TECTONIC_SHARD_DAMAGE = 32;
const BOSS_STATIONARY_EPS = 0.03;
const BOSS_TECTONIC_CENTER = { x: 0, y: 0, z: 0 };
// Boss throw-spear ability
const BOSS_THROW_MIN_RANGE     = 3;
const BOSS_THROW_MAX_RANGE     = 12;
const BOSS_THROW_DAMAGE        = 35;
const BOSS_THROW_COOLDOWN_MS   = 10_000;
const BOSS_THROW_STATIONARY_MS = 1_000;

// Boss 2: Archon warlock
const BOSS2_ARCHON_LIGHTNING_COOLDOWN_MS = 4_000;
const BOSS2_ARCHON_LIGHTNING_WINDUP_MS = 1_250;
const BOSS2_ARCHON_LIGHTNING_DAMAGE = 50;
const BOSS2_ARCHON_LIGHTNING_HALF_WIDTH = 1.0;
const BOSS2_ARCHON_LIGHTNING_RANGE = 14;
/** Phase 1 perpendicular arm half-length at target (capped). */
const BOSS2_ARCHON_LIGHTNING_CROSS_HALF_MIN = 4;
const BOSS2_BLINK_COOLDOWN_MS = 8_000;

// Boss 3: Weaver Nexus (scaled weaver + arcane nova)
const BOSS3_CENTER_HOLD_DIST = 1.2;
const BOSS3_SUMMON_CAST_MS = 3000;
const BOSS3_NOVA_WINDUP_MS = 3000;
const BOSS3_NOVA_COOLDOWN_MS = 3000;
const BOSS3_NOVA_MAX_RANGE = 14;
const BOSS3_NOVA_TRAVEL_MS = 1500;
const BOSS3_NOVA_HALF_WIDTH = 0.85;
const BOSS3_NOVA_DAMAGE = 50;
const BOSS3_NOVA_STEPS = 26;

// Martyr: self-detonation (matches client AOE)
const MARTYR_MELEE_RANGE = 1.4;
const MARTYR_DETONATION_RADIUS = 5.5;
const MARTYR_DETONATION_DAMAGE = 200;
const MARTYR_DETONATION_DELAY_MS = 2160;

// Tentacle-spine environmental trap (co-op wave)
const TENTACLE_SPINE_TRIGGER_R = 6;
const TENTACLE_SPINE_LINE_LEN = 10;
const TENTACLE_SPINE_LINE_HALF_W = 0.85;
const TENTACLE_SPINE_WINDUP_MS = 1000;
const TENTACLE_SPINE_COOLDOWN_MS = 3250;
const TENTACLE_SPINE_DMG_PLAYER = 40;
const TENTACLE_SPINE_DMG_MOB = 175;

function distPointSegmentSqXZ(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const abLen2 = abx * abx + abz * abz;
  const apx = px - ax;
  const apz = pz - az;
  let t = abLen2 > 1e-8 ? (apx * abx + apz * abz) / abLen2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * abx;
  const qz = az + t * abz;
  const dx = px - qx;
  const dz = pz - qz;
  return dx * dx + dz * dz;
}

// Purple warlock: matches WARLOCK_LAUNCH_DURATION in CoopGameScene.tsx — no walk during cast wind-up
const WARLOCK_BLINK_LAUNCH_SHARED_COOLDOWN_MS = 2000;
const WARLOCK_LAUNCH_MOVE_LOCK_MS = 1400;
const WARLOCK_PREFERRED_STAND_RANGE = 9.5; // same as movement stop distance; launch only at or inside this
const WARLOCK_METEOR_PER_HIT_DAMAGE = 100;
const WARLOCK_METEOR_STAGGER_MS = 500;
// Meteor swarm: offset radius around primary target, clamped to co-op square arena
const WARLOCK_METEOR_OFFSET_MIN = 2;
const WARLOCK_METEOR_OFFSET_MAX = 6;
const WARLOCK_METEOR_ARENA_EXTENT = 20; // same half-extent as shade blink (inner castle)

class EnemyAI {
  constructor(roomId, io) {
    this.roomId = roomId;
    this.io = io;
    this.room = null; // Will be set by GameRoom
    this.aiTimer = null;
    this.updateInterval = 33; // Update AI every 33ms (30fps for smooth movement)
    
    // Enemy aggro tracking
    this.enemyAggro = new Map(); // enemyId -> { targetPlayerId, lastUpdate, aggro }
    
    // Boss damage tracking per player
    this.bossDamageTracking = new Map(); // enemyId -> Map(playerId -> totalDamage)
    
    // Boss attack cooldown tracking
    this.bossAttackCooldown = new Map(); // enemyId -> lastAttackTime

    this.bossLeapCooldown = new Map();
    this.bossTectonicCooldown = new Map();
    this.bossMeleePatternIndex = new Map();
    this.bossTectonicData = new Map();
    this.bossLeapEndAt = new Map();
    this.bossLeapLand = new Map();
    this.bossLeapFrom = new Map(); // bossId -> { x, z } leap start (for in-flight lerp)
    this.bossLeapTimeout = new Map();
    this.bossThrowCooldown = new Map(); // bossId -> timestamp of last throw
    this.bossThrowEndAt = new Map();    // bossId -> timestamp throw animation ends
    this.bossThrowTarget = new Map();   // bossId -> stale { x, y, z } target at cast time
    this.bossThrowTimeout = new Map();
    this.bossTectonicSpikePendingTimeouts = new Map(); // bossId -> timeout ids
    this.bossLastAiPos = new Map();
    this.boss2ArchonLightningCooldown = new Map();
    this.boss2ArchonLightningLockUntil = new Map();
    this.boss2ArchonLightningTimeout = new Map();
    /** bossId -> 0 | 1 | 2 — advances each Archon Lightning cast (1 beam → X → fan → …). */
    this.boss2ArchonLightningComboPhase = new Map();
    this.boss2BlinkCooldown = new Map();

    // Boss 3 (Weaver Nexus): nova + summon locks
    this.boss3LockUntil = new Map();
    this.boss3NovaLastRelease = new Map();
    this.boss3NovaWindupTimeout = new Map();
    this.boss3NovaSweepInterval = new Map();

    // Boss skeleton summoning tracking
    this.bossSkeletonSummonCooldown = new Map(); // enemyId -> lastSummonTime
    this.bossSummonedSkeletons = new Map(); // enemyId -> Set of skeleton IDs

    // Boss spawn time tracking (for initial meteor delay)
    this.bossSpawnTime = new Map(); // enemyId -> spawnTimestamp

    // Debug logging throttle for meteor blocking
    this._lastMeteorDebugLog = new Map(); // debugKey -> lastLogTime

    // Enemy taunt tracking (for Wraithblade ability)
    this.enemyTaunts = new Map(); // enemyId -> { taunterPlayerId, tauntEndTime }

    // Warlock ability cooldown tracking
    this.warlockBlinkCooldown  = new Map(); // enemyId -> lastBlinkTime
    this.warlockLaunchCooldown = new Map(); // enemyId -> lastLaunchTime
    this.warlockBlinkLaunchSharedCooldownUntil = new Map(); // enemyId -> timestamp
    this.warlockMeteorCooldown = new Map(); // enemyId -> lastMeteorTime (purple warlock meteor swarm)
    this.warlockLaunchMoveLockUntil = new Map(); // enemyId -> timestamp: purple warlock cannot walk until

    // Shade blink+attack cooldown tracking (4-second cooldown)
    this.shadeBlinkCooldown = new Map(); // enemyId -> lastBlinkTime

    // Viper arrow shot cooldown tracking (2-second cooldown)
    this.viperAttackCooldown = new Map(); // enemyId -> lastAttackTime

    // Weaver ability cooldown tracking
    this.weaverHealCooldown   = new Map(); // enemyId -> lastHealTime
    this.weaverSummonCooldown = new Map(); // enemyId -> lastSummonTime
    this.weaverLightningCooldown = new Map(); // enemyId -> lastLightningTime (blue weaver)

    // Weaver summoned ghoul tracking (1 ghoul per weaver at a time)
    this.weaverSummonedGhouls = new Map(); // weaverId -> ghoulId | null

    // Player zombies (INFESTED STRIKE): owner -> Set(zombieId)
    this.playerZombiesByOwner = new Map();

    // Ghoul attack cooldown tracking
    this.ghoulAttackCooldown = new Map(); // enemyId -> lastAttackTime

    // Knight / Templar / Ghoul melee: timestamp until which the enemy is frozen mid-swing
    // so it cannot move until the swing animation and damage window both resolve.
    this.meleeLockUntil = new Map(); // enemyId -> lockExpiryTimestamp

    // Knight special ability cooldown tracking
    // Each soul type has one unique ability; all share this single cooldown map.
    this.knightAbilityCooldown = new Map(); // enemyId -> lastAbilityTime
    this.knightDashCooldown = new Map(); // enemyId -> lastDashTime

    // Red / Green: Death Grasp (independent 15s CD from knightAbilityCooldown)
    this.knightDeathGraspCooldown = new Map(); // enemyId -> lastCastMs

    // Navigation / pathfinding
    this.navGrid    = null;      // Uint8Array built once on first use
    this.enemyPaths = new Map(); // enemyId -> { waypoints, wpIndex, lastTargetPos }

    // Templar Blink Smite: timestamp when next cast is allowed (per templar; initialized on first aggro)
    this.templarBlinkSmiteNextAt = new Map();

    /** tentacle-spine id -> windup slam setTimeout id */
    this.tentacleSlamTimeouts = new Map();
  }

  setRoom(room) {
    this.room = room;
  }

  startAI() {
    if (this.aiTimer) return; // Already running
    
    this.aiTimer = setInterval(() => {
      this.updateAI();
    }, this.updateInterval);
    
  }

  stopAI() {
    if (this.aiTimer) {
      clearInterval(this.aiTimer);
      this.aiTimer = null;
    }
    
    this.enemyAggro.clear();
    this.bossDamageTracking.clear();
    this.bossAttackCooldown.clear();
    this.bossSpawnTime.clear();
    this.bossLeapCooldown.clear();
    this.bossTectonicCooldown.clear();
    this.bossMeleePatternIndex.clear();
    this.bossTectonicData.clear();
    this.bossLeapEndAt.clear();
    this.bossLeapLand.clear();
    this.bossLeapFrom.clear();
    this.bossLastAiPos.clear();
    this.bossLeapTimeout.forEach((t) => clearTimeout(t));
    this.bossLeapTimeout.clear();
    this.bossThrowCooldown.clear();
    this.bossThrowEndAt.clear();
    this.bossThrowTarget.clear();
    this.bossThrowTimeout.forEach((t) => clearTimeout(t));
    this.bossThrowTimeout.clear();
    this.boss2ArchonLightningCooldown.clear();
    this.boss2ArchonLightningLockUntil.clear();
    this.boss2ArchonLightningTimeout.forEach((t) => clearTimeout(t));
    this.boss2ArchonLightningTimeout.clear();
    this.boss2ArchonLightningComboPhase.clear();
    this.boss2BlinkCooldown.clear();
    this.boss3NovaWindupTimeout.forEach((t) => clearTimeout(t));
    this.boss3NovaWindupTimeout.clear();
    this.boss3NovaSweepInterval.forEach((t) => clearInterval(t));
    this.boss3NovaSweepInterval.clear();
    this.boss3LockUntil.clear();
    this.boss3NovaLastRelease.clear();
    this.tentacleSlamTimeouts.forEach((t) => clearTimeout(t));
    this.tentacleSlamTimeouts.clear();
    this.bossTectonicSpikePendingTimeouts.forEach((ids) => {
      (ids || []).forEach((tid) => clearTimeout(tid));
    });
    this.bossTectonicSpikePendingTimeouts.clear();
    this.bossSkeletonSummonCooldown.clear();
    this.bossSummonedSkeletons.clear();
    this._lastMeteorDebugLog.clear();
    this.enemyTaunts.clear();
    this.warlockBlinkCooldown.clear();
    this.warlockLaunchCooldown.clear();
    this.warlockBlinkLaunchSharedCooldownUntil.clear();
    this.warlockMeteorCooldown.clear();
    this.warlockLaunchMoveLockUntil.clear();
    this.shadeBlinkCooldown.clear();
    this.viperAttackCooldown.clear();
    this.weaverHealCooldown.clear();
    this.weaverSummonCooldown.clear();
    this.weaverLightningCooldown.clear();
    this.weaverSummonedGhouls.clear();
    this.playerZombiesByOwner.clear();
    this.ghoulAttackCooldown.clear();
    this.meleeLockUntil.clear();
    this.knightAbilityCooldown.clear();
    this.knightDashCooldown.clear();
    this.knightDeathGraspCooldown.clear();
    this.enemyPaths.clear();
    this.templarBlinkSmiteNextAt.clear();
  }

  updateAI() {
    if (!this.room || !this.room.getGameStarted()) return;
    
    const enemies = this.room.getEnemies();
    const players = this.room.getPlayers();
    
    if (enemies.length === 0 || players.length === 0) return;
    
    // Update each enemy's AI
    enemies.forEach(enemy => {
      if (enemy.isDying) return;
      
      this.updateEnemyAI(enemy, players);
    });
  }

  updateEnemyAI(enemy, players) {
    // Note: Taunt now works by giving aggro priority instead of overriding AI completely

    if (enemy.type === 'training-dummy') return;

    if (this.room?.isEnemyAffectedBy(enemy.id, 'stun')) return;

    if (enemy.type === 'tentacle-spine') {
      this.updateTentacleSpineTrap(enemy, players);
      return;
    }

    // Special handling for boss enemies
    if (enemy.type === 'boss') {
      this.updateBossAI(enemy, players);
      return;
    }

    if (enemy.type === 'boss2') {
      this.updateBoss2AI(enemy, players);
      return;
    }

    if (enemy.type === 'boss3') {
      this.updateBoss3AI(enemy, players);
      return;
    }

    // Special handling for boss-summoned skeletons
    if (enemy.type === 'boss-skeleton') {
      this.updateBossSkeletonAI(enemy, players);
      return;
    }

    // Special handling for knights
    if (enemy.type === 'knight') {
      this.updateKnightAI(enemy, players);
      return;
    }

    // Special handling for shades
    if (enemy.type === 'shade') {
      this.updateShadeAI(enemy, players);
      return;
    }

    // Special handling for warlocks
    if (enemy.type === 'warlock') {
      this.updateWarlockAI(enemy, players);
      return;
    }

    // Special handling for vipers
    if (enemy.type === 'viper') {
      this.updateViperAI(enemy, players);
      return;
    }

    // Special handling for templars
    if (enemy.type === 'templar') {
      this.updateTemplarAI(enemy, players);
      return;
    }

    // Special handling for weavers
    if (enemy.type === 'weaver') {
      this.updateWeaverAI(enemy, players);
      return;
    }

    if (enemy.type === 'martyr') {
      this.updateMartyrAI(enemy, players);
      return;
    }

    // Player-raised zombies (INFESTED STRIKE)
    if (enemy.type === 'player-zombie') {
      this.updatePlayerZombieAI(enemy, players);
      return;
    }

    // Special handling for ghouls (weaver summons)
    if (enemy.type === 'ghoul') {
      this.updateGhoulAI(enemy, players);
      return;
    }

    // Get or create aggro data for this enemy
    let aggroData = this.enemyAggro.get(enemy.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(enemy, players);
      if (!closestPlayer) return;

      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100
      };
      this.enemyAggro.set(enemy.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, enemy, players);
    if (!resolved) return;

    this.moveEnemyTowardsTarget(enemy, this.aggroTargetToMoveTarget(resolved));
  }

  updateBossSkeletonAI(skeleton, players) {
    let aggroData = this.enemyAggro.get(skeleton.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(skeleton, players);
      if (!closestPlayer) return;

      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100
      };
      this.enemyAggro.set(skeleton.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, skeleton, players);
    if (!resolved) return;

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(skeleton.position, tpos);
    const attackRange = 2.4;
    const attackCooldown = 2000;

    if (distance <= attackRange) {
      if (!this.bossAttackCooldown.has(skeleton.id)) {
        this.bossAttackCooldown.set(skeleton.id, 0);
      }

      const lastAttackTime = this.bossAttackCooldown.get(skeleton.id);
      const now = Date.now();

      if (now - lastAttackTime >= attackCooldown) {
        this.bossAttackCooldown.set(skeleton.id, now);

        if (resolved.kind === 'player') {
          this.telegraphSkeletonAttack(skeleton, resolved.player);
          const telegraphDelay = 250;
          const pid = resolved.player.id;
          setTimeout(() => {
            if (skeleton.isDying || !this.room?.getGameStarted()) return;
            if (this.room?.isEnemyAffectedBy(skeleton.id, 'stun')) return;
            const currentPlayers = this.room?.getPlayers();
            if (!currentPlayers) return;
            const currentTarget = currentPlayers.find(p => p.id === pid);
            if (!currentTarget || currentTarget.health <= 0) return;
            const currentDistance = this.calculateDistance(skeleton.position, currentTarget.position);
            if (currentDistance <= attackRange) {
              this.bossSkeletonAttackPlayer(skeleton, currentTarget);
            } else {
              console.log(`💀 Skeleton ${skeleton.id} attack missed - player ${currentTarget.id} dodged out of range!`);
            }
          }, telegraphDelay);
        } else if (resolved.kind === 'zombie') {
          const zid = resolved.zombie.id;
          this.telegraphSkeletonAttack(skeleton, {
            id: resolved.zombie.ownerPlayerId || zid,
            position: resolved.zombie.position,
          });
          const telegraphDelay = 250;
          setTimeout(() => {
            if (skeleton.isDying || !this.room?.getGameStarted()) return;
            if (this.room?.isEnemyAffectedBy(skeleton.id, 'stun')) return;
            const z = this.room?.getEnemy(zid);
            if (!z || z.isDying || z.health <= 0) return;
            const currentDistance = this.calculateDistance(skeleton.position, z.position);
            if (currentDistance <= attackRange) {
              const damage = skeleton.damage || 17;
              this.damagePlayerZombieFromMob(skeleton, z, damage, 'boss_skeleton_melee');
            }
          }, telegraphDelay);
        } else {
          const trap = resolved.trap;
          this.telegraphSkeletonAttack(skeleton, {
            id: trap.id,
            position: trap.position,
          });
          const telegraphDelay = 250;
          const trapId = trap.id;
          setTimeout(() => {
            if (skeleton.isDying || !this.room?.getGameStarted()) return;
            if (this.room?.isEnemyAffectedBy(skeleton.id, 'stun')) return;
            const t = this.room?.getEnemy(trapId);
            if (!t || t.isDying || t.health <= 0 || t.type !== 'tentacle-spine') return;
            const currentDistance = this.calculateDistance(skeleton.position, t.position);
            if (currentDistance <= attackRange) {
              const damage = skeleton.damage || 17;
              this.room.damageEnemy(trapId, damage, null, null, {
                sourceEnemyId: skeleton.id,
                damageType: 'boss_skeleton_melee',
              });
            }
          }, telegraphDelay);
        }
      }
    } else {
      this.moveEnemyTowardsTarget(skeleton, moveTarget);
    }
  }

  telegraphSkeletonAttack(skeleton, player) {
    // Broadcast the telegraph to all players so the attack animation starts
    if (this.io) {
      this.io.to(this.roomId).emit('boss-skeleton-attack-telegraph', {
        skeletonId: skeleton.id,
        targetPlayerId: player.id,
        position: skeleton.position,
        timestamp: Date.now()
      });
    }

    console.log(`💀 Boss skeleton ${skeleton.id} telegraphing attack at player ${player.id}!`);
  }

  bossSkeletonAttackPlayer(skeleton, player) {
    const damage = skeleton.damage || 17;

    if (this.io) {
      this.io.to(this.roomId).emit('boss-skeleton-attack', {
        skeletonId: skeleton.id,
        targetPlayerId: player.id,
        damage: damage,
        position: skeleton.position,
        timestamp: Date.now()
      });
    }

    console.log(`💀 Boss skeleton ${skeleton.id} attacked player ${player.id} for ${damage} damage!`);
  }

  // ─── Knight AI ───────────────────────────────────────────────────────────────

  updateKnightAI(knight, players) {
    let aggroData = this.enemyAggro.get(knight.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(knight, players);
      if (!closestPlayer) return;
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(knight.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, knight, players);
    if (!resolved) return;

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(knight.position, tpos);
    const attackRange = 2.6;
    const meleePressDistance = attackRange - MELEE_CLOSE_INSET;
    const attackCooldown = knight.attackCooldown ?? 2500;
    const aggroRadius = 10;

    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);
    if (!aggroData.isAggroed && distance <= aggroRadius && this.hasLineOfSight(knight.position, tpos)) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }

    if (!aggroData.isAggroed) {
      return;
    }

    const now = Date.now();

    const lockUntil = this.meleeLockUntil.get(knight.id) || 0;
    if (now < lockUntil) return;

    if (resolved.kind === 'player') {
      const targetPlayer = resolved.player;
      if (this.tryKnightDash(knight, targetPlayer, now, distance)) return;

      const deathGraspFired = this.tryKnightDeathGrasp(knight, targetPlayer, now, distance);
      if (deathGraspFired) return;

      const abilityFired = this.tryKnightAbility(knight, targetPlayer, now, distance, attackRange);
      if (abilityFired) return;

      if (distance <= attackRange) {
        if (!this.bossAttackCooldown.has(knight.id)) {
          this.bossAttackCooldown.set(knight.id, 0);
        }

        const lastAttackTime = this.bossAttackCooldown.get(knight.id);

        if (distance > meleePressDistance) {
          this.moveEnemyTowardsTarget(knight, moveTarget, { meleeSurroundAttackRange: attackRange });
        } else if (now - lastAttackTime >= attackCooldown) {
          this.bossAttackCooldown.set(knight.id, now);

          const SWING_LOCK_MS = 1200;
          this.meleeLockUntil.set(knight.id, now + SWING_LOCK_MS);

          const attackFocus = { ...targetPlayer.position };
          this.scheduleKnightMeleeWindupStep(knight, attackFocus);
          this.telegraphKnightAttack(knight, targetPlayer);
          const pid = targetPlayer.id;

          setTimeout(() => {
            if (knight.isDying || !this.room?.getGameStarted()) return;
            if (this.room?.isEnemyAffectedBy(knight.id, 'stun')) return;

            const currentPlayers = this.room?.getPlayers();
            if (!currentPlayers) return;

            const currentTarget = currentPlayers.find(p => p.id === pid);
            if (!currentTarget || currentTarget.health <= 0) return;

            const currentDistance = this.calculateDistance(knight.position, currentTarget.position);
            if (currentDistance <= attackRange) {
              this.knightAttackPlayer(knight, currentTarget);
            } else {
              console.log(`⚔️ Knight ${knight.id} swing missed - player dodged out of range!`);
            }
          }, 1000);
        }
      } else {
        this.moveEnemyTowardsTarget(knight, moveTarget, { meleeSurroundAttackRange: attackRange });
      }
    } else if (resolved.kind === 'zombie') {
      const z = resolved.zombie;
      const fakeTarget = { id: z.ownerPlayerId || z.id, position: z.position };
      if (this.tryKnightDash(knight, fakeTarget, now, distance)) return;

      if (distance <= attackRange) {
        if (!this.bossAttackCooldown.has(knight.id)) {
          this.bossAttackCooldown.set(knight.id, 0);
        }

        const lastAttackTime = this.bossAttackCooldown.get(knight.id);

        if (distance > meleePressDistance) {
          this.moveEnemyTowardsTarget(knight, moveTarget, { meleeSurroundAttackRange: attackRange });
        } else if (now - lastAttackTime >= attackCooldown) {
          this.bossAttackCooldown.set(knight.id, now);

          const SWING_LOCK_MS = 1200;
          this.meleeLockUntil.set(knight.id, now + SWING_LOCK_MS);

          const attackFocus = { ...z.position };
          this.scheduleKnightMeleeWindupStep(knight, attackFocus);
          this.telegraphKnightAttack(knight, {
            id: z.ownerPlayerId || z.id,
            position: z.position,
          });
          const zid = z.id;

          setTimeout(() => {
            if (knight.isDying || !this.room?.getGameStarted()) return;
            if (this.room?.isEnemyAffectedBy(knight.id, 'stun')) return;
            const liveZ = this.room?.getEnemy(zid);
            if (!liveZ || liveZ.isDying || liveZ.health <= 0) return;
            const currentDistance = this.calculateDistance(knight.position, liveZ.position);
            if (currentDistance <= attackRange) {
              const damage = knight.damage || 25;
              this.damagePlayerZombieFromMob(knight, liveZ, damage, 'knight_melee');
            } else {
              console.log(`⚔️ Knight ${knight.id} swing missed — zombie dodged out of range!`);
            }
          }, 1000);
        }
      } else {
        this.moveEnemyTowardsTarget(knight, moveTarget, { meleeSurroundAttackRange: attackRange });
      }
    } else {
      const tr = resolved.trap;
      const fakeTarget = { id: tr.id, position: tr.position };
      if (this.tryKnightDash(knight, fakeTarget, now, distance)) return;

      if (distance <= attackRange) {
        if (!this.bossAttackCooldown.has(knight.id)) {
          this.bossAttackCooldown.set(knight.id, 0);
        }

        const lastAttackTime = this.bossAttackCooldown.get(knight.id);

        if (distance > meleePressDistance) {
          this.moveEnemyTowardsTarget(knight, moveTarget, { meleeSurroundAttackRange: attackRange });
        } else if (now - lastAttackTime >= attackCooldown) {
          this.bossAttackCooldown.set(knight.id, now);

          const SWING_LOCK_MS = 1200;
          this.meleeLockUntil.set(knight.id, now + SWING_LOCK_MS);

          const attackFocus = { ...tr.position };
          this.scheduleKnightMeleeWindupStep(knight, attackFocus);
          this.telegraphKnightAttack(knight, {
            id: tr.id,
            position: tr.position,
          });
          const trapId = tr.id;

          setTimeout(() => {
            if (knight.isDying || !this.room?.getGameStarted()) return;
            if (this.room?.isEnemyAffectedBy(knight.id, 'stun')) return;
            const liveT = this.room?.getEnemy(trapId);
            if (!liveT || liveT.isDying || liveT.health <= 0 || liveT.type !== 'tentacle-spine') return;
            const currentDistance = this.calculateDistance(knight.position, liveT.position);
            if (currentDistance <= attackRange) {
              const damage = knight.damage || 25;
              this.room.damageEnemy(trapId, damage, null, null, {
                sourceEnemyId: knight.id,
                damageType: 'knight_melee',
              });
            }
          }, 1000);
        }
      } else {
        this.moveEnemyTowardsTarget(knight, moveTarget, { meleeSurroundAttackRange: attackRange });
      }
    }
  }

  tryKnightDash(knight, target, now, distance) {
    if (!((this.room?.coopBossesDefeatedCount ?? 0) >= 1)) return false;
    if (this.room?.isEnemyAffectedBy(knight.id, 'freeze')) return false;
    if (!target?.position) return false;
    if (distance < KNIGHT_DASH_MIN_DISTANCE) return false;

    const lastDash = this.knightDashCooldown.get(knight.id) || 0;
    if (now - lastDash < KNIGHT_DASH_COOLDOWN_MS) return false;

    const dx = target.position.x - knight.position.x;
    const dz = target.position.z - knight.position.z;
    const mag = Math.sqrt(dx * dx + dz * dz);
    if (mag < 1e-4) return false;

    const dirX = dx / mag;
    const dirZ = dz / mag;
    const dashDistance = Math.min(KNIGHT_DASH_DISTANCE, Math.max(0, distance - MELEE_CLOSE_INSET));
    if (dashDistance < 0.75) return false;

    const startPosition = { ...knight.position };
    const rawX = knight.position.x + dirX * dashDistance;
    const rawZ = knight.position.z + dirZ * dashDistance;

    let resolved = this.resolveEnemyWallCollisions(rawX, rawZ);
    resolved = this.resolveMeleePeerSeparation(knight, resolved.x, resolved.z);

    const moved = Math.hypot(resolved.x - knight.position.x, resolved.z - knight.position.z);
    if (moved < 0.5) return false;

    knight.position.x = resolved.x;
    knight.position.z = resolved.z;
    knight.rotation = Math.atan2(dirX, dirZ);

    this.knightDashCooldown.set(knight.id, now);
    this.meleeLockUntil.set(knight.id, now + KNIGHT_DASH_DURATION_MS);
    this.enemyPaths.delete(knight.id);

    const endPosition = { ...knight.position };
    if (this.io) {
      this.io.to(this.roomId).emit('knight-dash', {
        knightId: knight.id,
        targetId: target.id,
        startPosition,
        endPosition,
        rotation: knight.rotation,
        distance: moved,
        durationMs: KNIGHT_DASH_DURATION_MS,
        timestamp: Date.now(),
      });
      this.io.to(this.roomId).emit('enemy-moved', {
        enemyId: knight.id,
        position: knight.position,
        rotation: knight.rotation,
        timestamp: Date.now(),
      });
    }

    return true;
  }

  scheduleKnightMeleeWindupStep(knight, attackFocus) {
    if (!attackFocus) return;

    const focusPosition = {
      x: attackFocus.x,
      y: attackFocus.y ?? 0,
      z: attackFocus.z,
    };

    setTimeout(() => {
      if (knight.isDying || !this.room?.getGameStarted()) return;
      if (this.room?.isEnemyAffectedBy(knight.id, 'stun')) return;

      const dx = focusPosition.x - knight.position.x;
      const dz = focusPosition.z - knight.position.z;
      const mag = Math.sqrt(dx * dx + dz * dz);
      if (mag < 1e-4) return;

      const baseSpeed = knight.moveSpeed ?? this.getEnemyMoveSpeed(knight.type);
      const moveSpeed = this.room?.isEnemyAffectedBy(knight.id, 'freeze')
        ? baseSpeed
        : this.getModifiedMovementSpeed(knight.id, baseSpeed);
      if (moveSpeed === 0) return;

      const maxStep = Math.min(
        KNIGHT_MELEE_WINDUP_STEP,
        moveSpeed * (KNIGHT_MELEE_WINDUP_STEP_DELAY_MS / 1000),
        mag,
      );
      const dirX = dx / mag;
      const dirZ = dz / mag;
      const rawX = knight.position.x + dirX * maxStep;
      const rawZ = knight.position.z + dirZ * maxStep;

      let resolved = this.resolveEnemyWallCollisions(rawX, rawZ);
      resolved = this.resolveMeleePeerSeparation(knight, resolved.x, resolved.z);

      knight.position.x = resolved.x;
      knight.position.z = resolved.z;
      knight.rotation = Math.atan2(dirX, dirZ);

      if (this.io) {
        this.io.to(this.roomId).emit('enemy-moved', {
          enemyId: knight.id,
          position: knight.position,
          rotation: knight.rotation,
          timestamp: Date.now(),
        });
      }
    }, KNIGHT_MELEE_WINDUP_STEP_DELAY_MS);
  }

  telegraphKnightAttack(knight, player) {
    if (this.io) {
      this.io.to(this.roomId).emit('knight-attack-telegraph', {
        knightId: knight.id,
        targetPlayerId: player.id,
        position: knight.position,
        timestamp: Date.now()
      });
    }
    console.log(`⚔️ Knight ${knight.id} telegraphing attack at player ${player.id}!`);
  }

  knightAttackPlayer(knight, player) {
    const damage = knight.damage || 25;

    if (this.io) {
      this.io.to(this.roomId).emit('knight-attack', {
        knightId: knight.id,
        targetPlayerId: player.id,
        damage: damage,
        position: knight.position,
        timestamp: Date.now()
      });
    }

    console.log(`⚔️ Knight ${knight.id} attacked player ${player.id} for ${damage} damage!`);
  }

  // ─── Knight Death Grasp (red + green only) ──────────────────────────────────
  // Timings/numbers: keep in sync with src/utils/knightCoopAbilitiesConstants.ts
  // 15s CD, 5u < range ≤ 13u; mirrors frost cast + projectile + dodge test.

  tryKnightDeathGrasp(knight, targetPlayer, now, distance) {
    if (knight.soulType !== 'red' && knight.soulType !== 'green') return false;

    const DEATH_GRASP_MIN_RANGE = 5.0; // must be *over* 5u (strict)
    const DEATH_GRASP_MAX_RANGE = 13.0;
    const DEATH_GRASP_COOLDOWN_MS = 15000;

    if (distance <= DEATH_GRASP_MIN_RANGE || distance > DEATH_GRASP_MAX_RANGE) return false;
    if (targetPlayer.health <= 0) return false;

    const lastDg = this.knightDeathGraspCooldown.get(knight.id) || 0;
    if (now - lastDg < DEATH_GRASP_COOLDOWN_MS) return false;

    this.knightDeathGraspCooldown.set(knight.id, now);
    this.meleeLockUntil.set(knight.id, now + 2000); // same as blue frost cast lock
    this.knightCastDeathGrasp(knight, targetPlayer);
    return true;
  }

  knightCastDeathGrasp(knight, targetPlayer) {
    const CAST_LAUNCH_MS = 1000; // with blue frost
    const PROJECTILE_TRAVEL_MS = 520;
    const HIT_RADIUS = 1.35; // XZ — same as frost
    const STANDOFF = 1.2;

    const tdx = targetPlayer.position.x - knight.position.x;
    const tdz = targetPlayer.position.z - knight.position.z;
    if (tdx !== 0 || tdz !== 0) {
      knight.rotation = Math.atan2(tdx, tdz);
    }

    if (this.io) {
      this.io.to(this.roomId).emit('enemy-moved', {
        enemyId: knight.id,
        position: knight.position,
        rotation: knight.rotation,
        timestamp: Date.now(),
      });
      this.io.to(this.roomId).emit('knight-deathgrasp-telegraph', {
        knightId: knight.id,
        targetPlayerId: targetPlayer.id,
        timestamp: Date.now(),
      });
    }
    console.log(`💀 Knight ${knight.id} (${knight.soulType}) casting Death Grasp at player ${targetPlayer.id}!`);

    const targetId = targetPlayer.id;
    const knightId = knight.id;

    setTimeout(() => {
      if (!this.room?.getGameStarted()) return;
      const liveKnight = this.room?.getEnemy(knightId);
      if (!liveKnight || liveKnight.isDying) return;
      if (this.room?.isEnemyAffectedBy(knightId, 'stun')) return;

      const currentPlayers = this.room?.getPlayers();
      if (!currentPlayers) return;
      const launchTarget = currentPlayers.find(p => p.id === targetId);
      if (!launchTarget || launchTarget.health <= 0) return;

      const startPosition = {
        x: liveKnight.position.x,
        y: liveKnight.position.y + 1.5,
        z: liveKnight.position.z,
      };
      const endPosition = {
        x: launchTarget.position.x,
        y: launchTarget.position.y + 1.0,
        z: launchTarget.position.z,
      };
      const snapX = endPosition.x;
      const snapZ = endPosition.z;

      if (this.io) {
        this.io.to(this.roomId).emit('knight-deathgrasp-projectile', {
          knightId,
          startPosition,
          endPosition,
          travelMs: PROJECTILE_TRAVEL_MS,
          timestamp: Date.now(),
        });
      }

      setTimeout(() => {
        if (!this.room?.getGameStarted()) return;
        if (this.room?.isEnemyAffectedBy(knightId, 'stun')) return;
        const players = this.room?.getPlayers();
        if (!players) return;
        const currentTarget = players.find(p => p.id === targetId);
        if (!currentTarget || currentTarget.health <= 0) return;

        const k = this.room?.getEnemy(knightId);
        if (!k || k.isDying) return;

        const dx = currentTarget.position.x - snapX;
        const dz = currentTarget.position.z - snapZ;
        const distXZ = Math.sqrt(dx * dx + dz * dz);

        if (distXZ > HIT_RADIUS) {
          console.log(`💀 Knight ${knightId} Death Grasp missed — player dodged!`);
          return;
        }

        const pdx = currentTarget.position.x - k.position.x;
        const pdz = currentTarget.position.z - k.position.z;
        const pLen = Math.sqrt(pdx * pdx + pdz * pdz) || 1;
        const nx = pdx / pLen;
        const nz = pdz / pLen;
        const pullY = currentTarget.position.y;
        const newPosition = {
          x: k.position.x + nx * STANDOFF,
          y: pullY,
          z: k.position.z + nz * STANDOFF,
        };

        const p = this.room.getPlayer(targetId);
        if (!p) return;
        const rot = p.rotation || { x: 0, y: 0, z: 0 };
        this.room.updatePlayerPosition(
          targetId,
          newPosition,
          rot,
          { x: 0, y: 0, z: 0 },
        );

        if (this.io) {
          this.io.to(this.roomId).emit('knight-deathgrasp-pull', {
            knightId: knightId,
            targetPlayerId: targetId,
            position: newPosition,
            rotation: rot,
            timestamp: Date.now(),
          });
        }
        console.log(`💀 Knight ${knightId} Death Grasp pulled player ${targetId} to standoff!`);
      }, PROJECTILE_TRAVEL_MS);
    }, CAST_LAUNCH_MS);
  }

  // ─── Knight Special Abilities ────────────────────────────────────────────────
  // Returns true if an ability was triggered (so the caller can skip basic attack).

  tryKnightAbility(knight, targetPlayer, now, distance, meleeRange) {
    const lastAbility = this.knightAbilityCooldown.get(knight.id) || 0;

    switch (knight.soulType) {
      // ── Red: Smite — powered melee slam (75 dmg, 7 s CD, melee range) ───────
      case 'red': {
        const CD = 6000;
        if (now - lastAbility < CD) return false;
        if (distance > meleeRange) return false;

        this.knightAbilityCooldown.set(knight.id, now);
        // Smite animation locks movement for 1 200 ms (same as basic swing)
        this.meleeLockUntil.set(knight.id, now + 1200);
        this.knightCastSmite(knight, targetPlayer);
        return true;
      }

      // ── Green / Purple: Aggro Shout — self-heal for 150 HP (8 s CD) ─────────
      case 'green':
      case 'purple': {
        const CD = 8000;
        if (now - lastAbility < CD) return false;
        // Self-heal is useful only below max HP
        if (knight.health >= knight.maxHealth) return false;

        this.knightAbilityCooldown.set(knight.id, now);
        // Aggro animation takes 1 800 ms — lock movement for the full duration
        this.meleeLockUntil.set(knight.id, now + 1800);
        this.knightCastHeal(knight);
        return true;
      }

      // ── Blue: Frost Ray — ranged slow + 30 dmg (14 s CD, extended range) ──────
      case 'blue': {
        const CD = 14000;
        const FROST_RANGE = 13.0;
        if (now - lastAbility < CD) return false;
        if (distance > FROST_RANGE) return false;

        this.knightAbilityCooldown.set(knight.id, now);
        // Cast animation takes 2 000 ms — lock movement for the full duration
        this.meleeLockUntil.set(knight.id, now + 2000);
        this.knightCastFrost(knight, targetPlayer);
        return true;
      }

      default:
        return false;
    }
  }

  // Red Knight — Smite (melee slam, 75 dmg)
  knightCastSmite(knight, targetPlayer) {
    if (this.io) {
      this.io.to(this.roomId).emit('knight-smite-telegraph', {
        knightId: knight.id,
        targetPlayerId: targetPlayer.id,
        position: knight.position,
        timestamp: Date.now(),
      });
    }
    console.log(`🔴⚡ Red Knight ${knight.id} charging Smite at player ${targetPlayer.id}!`);

    // Damage lands at the visual impact point of the animation (~900 ms)
    setTimeout(() => {
      if (knight.isDying || !this.room?.getGameStarted()) return;
      if (this.room?.isEnemyAffectedBy(knight.id, 'stun')) return;
      const currentPlayers = this.room?.getPlayers();
      if (!currentPlayers) return;
      const currentTarget = currentPlayers.find(p => p.id === targetPlayer.id);
      if (!currentTarget || currentTarget.health <= 0) return;

      const currentDistance = this.calculateDistance(knight.position, currentTarget.position);
      const SMITE_RANGE = 2.8; // same melee range
      if (currentDistance <= SMITE_RANGE) {
        if (this.io) {
          this.io.to(this.roomId).emit('knight-smite', {
            knightId: knight.id,
            targetPlayerId: currentTarget.id,
            damage: 65,
            position: knight.position,
            targetPosition: {
              x: currentTarget.position.x,
              y: currentTarget.position.y + 1.0,
              z: currentTarget.position.z,
            },
            timestamp: Date.now(),
          });
        }
        console.log(`🔴⚡ Red Knight ${knight.id} SMITE hit player ${currentTarget.id} for 75 dmg!`);
      } else {
        console.log(`🔴 Red Knight ${knight.id} Smite missed — player dodged!`);
      }
    }, 900);
  }

  // Green / Purple Knight — Aggro Shout (self-heal 150 HP)
  knightCastHeal(knight) {
    if (this.io) {
      this.io.to(this.roomId).emit('knight-heal-telegraph', {
        knightId: knight.id,
        position: knight.position,
        timestamp: Date.now(),
      });
    }
    console.log(`🟢💚 Knight ${knight.id} (${knight.soulType}) casting Heal!`);

    // Apply the heal at the animation midpoint (~1 200 ms)
    setTimeout(() => {
      if (knight.isDying || !this.room?.getGameStarted()) return;
      if (this.room?.isEnemyAffectedBy(knight.id, 'stun')) return;
      const liveKnight = this.room?.getEnemy(knight.id);
      if (!liveKnight || liveKnight.isDying) return;

      const prevHp = liveKnight.health;
      liveKnight.health = Math.min(liveKnight.maxHealth, liveKnight.health + 150);
      const healed = liveKnight.health - prevHp;

      if (this.io) {
        this.io.to(this.roomId).emit('enemy-healed', {
          enemyId:    liveKnight.id,
          healAmount: healed,
          newHealth:  liveKnight.health,
          maxHealth:  liveKnight.maxHealth,
          timestamp:  Date.now(),
        });
      }
      console.log(`🟢💚 Knight ${knight.id} healed for ${healed} HP (${prevHp} → ${liveKnight.health})`);
    }, 1200);
  }

  // Blue Knight — Frost Ray (30 dmg + 50% slow for 5 s)
  knightCastFrost(knight, targetPlayer) {
    const FROST_CAST_LAUNCH_MS = 1000; // half of 2 s cast; matches client FROST_DURATION
    const FROST_PROJECTILE_TRAVEL_MS = 420;
    const FROST_HIT_RADIUS = 1.35; // XZ — dash out of this to dodge

    const fdx = targetPlayer.position.x - knight.position.x;
    const fdz = targetPlayer.position.z - knight.position.z;
    if (fdx !== 0 || fdz !== 0) {
      knight.rotation = Math.atan2(fdx, fdz);
    }

    if (this.io) {
      this.io.to(this.roomId).emit('enemy-moved', {
        enemyId: knight.id,
        position: knight.position,
        rotation: knight.rotation,
        timestamp: Date.now(),
      });
      this.io.to(this.roomId).emit('knight-frost-telegraph', {
        knightId: knight.id,
        targetPlayerId: targetPlayer.id,
        timestamp: Date.now(),
      });
    }
    console.log(`🔵❄️ Blue Knight ${knight.id} casting Frost Ray at player ${targetPlayer.id}!`);

    const targetId = targetPlayer.id;
    const knightId = knight.id;

    setTimeout(() => {
      if (!this.room?.getGameStarted()) return;
      const liveKnight = this.room?.getEnemy(knightId);
      if (!liveKnight || liveKnight.isDying) return;
      if (this.room?.isEnemyAffectedBy(knightId, 'stun')) return;

      const currentPlayers = this.room?.getPlayers();
      if (!currentPlayers) return;
      const launchTarget = currentPlayers.find(p => p.id === targetId);
      if (!launchTarget || launchTarget.health <= 0) return;

      const startPosition = {
        x: liveKnight.position.x,
        y: liveKnight.position.y + 1.5,
        z: liveKnight.position.z,
      };
      const endPosition = {
        x: launchTarget.position.x,
        y: launchTarget.position.y + 1.0,
        z: launchTarget.position.z,
      };
      const snapX = endPosition.x;
      const snapZ = endPosition.z;

      if (this.io) {
        this.io.to(this.roomId).emit('knight-frost-projectile', {
          knightId,
          startPosition,
          endPosition,
          travelMs: FROST_PROJECTILE_TRAVEL_MS,
          timestamp: Date.now(),
        });
      }

      setTimeout(() => {
        if (!this.room?.getGameStarted()) return;
        if (this.room?.isEnemyAffectedBy(knightId, 'stun')) return;
        const players = this.room?.getPlayers();
        if (!players) return;
        const currentTarget = players.find(p => p.id === targetId);
        if (!currentTarget || currentTarget.health <= 0) return;

        const dx = currentTarget.position.x - snapX;
        const dz = currentTarget.position.z - snapZ;
        const distXZ = Math.sqrt(dx * dx + dz * dz);

        if (distXZ <= FROST_HIT_RADIUS) {
          if (this.io) {
            this.io.to(this.roomId).emit('knight-frost', {
              knightId,
              targetPlayerId: currentTarget.id,
              damage: 25,
              slowDuration: 5000,
              targetPosition: {
                x: currentTarget.position.x,
                y: currentTarget.position.y + 1.0,
                z: currentTarget.position.z,
              },
              timestamp: Date.now(),
            });
          }
          console.log(`🔵❄️ Blue Knight ${knightId} Frost Ray hit player ${currentTarget.id} for 30 dmg + slow!`);
        } else {
          console.log(`🔵 Blue Knight ${knightId} Frost Ray missed — player dodged!`);
        }
      }, FROST_PROJECTILE_TRAVEL_MS);
    }, FROST_CAST_LAUNCH_MS);
  }

  // ─── Shade AI ────────────────────────────────────────────────────────────────

  updateShadeAI(shade, players) {
    let aggroData = this.enemyAggro.get(shade.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(shade, players);
      if (!closestPlayer) return;
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(shade.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, shade, players);
    if (!resolved) return;

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(shade.position, tpos);
    const attackRange = 12.0;
    const aggroRadius = 10;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);

    if (!aggroData.isAggroed && distance <= aggroRadius && this.hasLineOfSight(shade.position, tpos)) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }

    if (!aggroData.isAggroed) return;

    const dx = tpos.x - shade.position.x;
    const dz = tpos.z - shade.position.z;
    shade.rotation = Math.atan2(dx, dz);
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-moved', {
        enemyId: shade.id,
        position: shade.position,
        rotation: shade.rotation,
        timestamp: Date.now()
      });
    }

    if (distance <= attackRange) {
      const blinkCooldown = 4750;
      const lastBlinkTime = this.shadeBlinkCooldown.get(shade.id) || 0;
      const now = Date.now();

      if (now - lastBlinkTime >= blinkCooldown) {
        this.shadeBlinkCooldown.set(shade.id, now);
        if (resolved.kind === 'player') {
          if (this.room?.isEnemyAffectedBy(shade.id, 'freeze')) {
            this.telegraphShadeAttack(shade, resolved.player);
          } else {
            this.shadeCastBlinkAndAttack(shade, resolved.player);
          }
        } else if (resolved.kind === 'zombie') {
          const z = resolved.zombie;
          const fakeTarget = { id: z.ownerPlayerId || z.id, position: z.position };
          this.telegraphShadeAttack(shade, fakeTarget);
          const zid = z.id;
          const shadeId = shade.id;
          [1000, 1250, 1500].forEach((delay) => {
            setTimeout(() => {
              if (shade.isDying || !this.room?.getGameStarted()) return;
              if (this.room?.isEnemyAffectedBy(shadeId, 'stun')) return;
              const zz = this.room?.getEnemy(zid);
              if (!zz || zz.isDying || zz.health <= 0) return;
              if (this.calculateDistance(shade.position, zz.position) > attackRange + 1.5) return;
              this.damagePlayerZombieFromMob({ id: shadeId }, zz, 25, 'shade_dagger');
            }, delay);
          });
        } else {
          const tr = resolved.trap;
          this.telegraphShadeAttack(shade, { id: tr.id, position: tr.position });
          const trapId = tr.id;
          const shadeId = shade.id;
          [1000, 1250, 1500].forEach((delay) => {
            setTimeout(() => {
              if (shade.isDying || !this.room?.getGameStarted()) return;
              if (this.room?.isEnemyAffectedBy(shadeId, 'stun')) return;
              const tt = this.room?.getEnemy(trapId);
              if (!tt || tt.isDying || tt.health <= 0 || tt.type !== 'tentacle-spine') return;
              if (this.calculateDistance(shade.position, tt.position) > attackRange + 1.5) return;
              this.room.damageEnemy(trapId, 25, null, null, {
                sourceEnemyId: shadeId,
                damageType: 'shade_dagger',
              });
            }, delay);
          });
        }
      }
    } else {
      this.moveEnemyTowardsTarget(shade, moveTarget);
    }
  }

  shadeCastBlinkAndAttack(shade, targetPlayer) {
    if (!this.shadeBlinkNearTarget(shade, targetPlayer)) return;

    // After the blink completes, fire daggers at the target's location
    setTimeout(() => {
      if (shade.isDying || !this.room?.getGameStarted()) return;
      if (this.room?.isEnemyAffectedBy(shade.id, 'stun')) return;

      const currentPlayers = this.room?.getPlayers();
      if (!currentPlayers) return;

      const currentTarget = currentPlayers.find(p => p.id === targetPlayer.id);
      if (!currentTarget || currentTarget.health <= 0) return;

      this.telegraphShadeAttack(shade, currentTarget);

      if ((this.room?.coopBossesDefeatedCount ?? 0) >= 1) {
        setTimeout(() => {
          if (shade.isDying || !this.room?.getGameStarted()) return;
          if (this.room?.isEnemyAffectedBy(shade.id, 'freeze')) return;
          if (this.room?.isEnemyAffectedBy(shade.id, 'stun')) return;

          const latestPlayers = this.room?.getPlayers();
          if (!latestPlayers) return;

          const latestTarget = latestPlayers.find(p => p.id === targetPlayer.id);
          if (!latestTarget || latestTarget.health <= 0) return;

          this.shadeBlinkNearTarget(shade, latestTarget, 'post-attack');
        }, SHADE_POST_ATTACK_BLINK_DELAY_MS);
      }
    }, SHADE_BLINK_DURATION_MS);
  }

  shadeBlinkNearTarget(shade, targetPlayer, reason = 'pre-attack') {
    const startPosition = { ...shade.position };

    // Direction from shade toward target
    const dx  = targetPlayer.position.x - shade.position.x;
    const dz  = targetPlayer.position.z - shade.position.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len === 0) return false;

    // Forward and left unit vectors
    const fwdX  =  dx / len;
    const fwdZ  =  dz / len;
    const leftX = -dz / len; // 90° CCW of forward
    const leftZ  =  dx / len;

    // Pick one of four angles relative to forward: ±45° (diagonal) or ±90° (perpendicular).
    // Straight forward (0°) and backward angles are intentionally excluded.
    const ANGLES = [-Math.PI / 2, -Math.PI / 4, Math.PI / 4, Math.PI / 2];
    const theta  = ANGLES[Math.floor(Math.random() * ANGLES.length)];

    // Rotate forward vector by theta: dir = cos(θ)·fwd + sin(θ)·left
    const blinkX = Math.cos(theta) * fwdX + Math.sin(theta) * leftX;
    const blinkZ = Math.cos(theta) * fwdZ + Math.sin(theta) * leftZ;

    const blinkDist = 5;
    const MAP_RADIUS = 20;
    let rawX = shade.position.x + blinkX * blinkDist;
    let rawZ = shade.position.z + blinkZ * blinkDist;

    // Clamp inside the square arena (inner castle wall faces at ±MAP_RADIUS)
    rawX = Math.max(-MAP_RADIUS, Math.min(MAP_RADIUS, rawX));
    rawZ = Math.max(-MAP_RADIUS, Math.min(MAP_RADIUS, rawZ));

    const endPosition = {
      x: rawX,
      y: shade.position.y,
      z: rawZ,
    };

    // Update server position immediately
    shade.position.x = endPosition.x;
    shade.position.y = endPosition.y;
    shade.position.z = endPosition.z;

    // Face the target from the new position
    const rotDx = targetPlayer.position.x - endPosition.x;
    const rotDz = targetPlayer.position.z - endPosition.z;
    shade.rotation = Math.atan2(rotDx, rotDz);

    if (this.io) {
      this.io.to(this.roomId).emit('shade-blink-telegraph', {
        shadeId: shade.id,
        startPosition,
        endPosition,
        rotation: shade.rotation,
        timestamp: Date.now()
      });
    }

    const dirLabel = theta > 0 ? (Math.abs(theta) < Math.PI / 2 ? 'diagonal-fwd-left' : 'left') : (Math.abs(theta) < Math.PI / 2 ? 'diagonal-fwd-right' : 'right');
    console.log(`👻 Shade ${shade.id} ${reason} blinked 5 units ${dirLabel} of target (θ=${(theta * 180 / Math.PI).toFixed(0)}°)`);
    return true;
  }

  telegraphShadeAttack(shade, targetPlayer) {
    if (this.io) {
      const startY = shade.position.y + 1.5;
      const startX = shade.position.x;
      const startZ = shade.position.z;
      const tx = targetPlayer.position.x;
      const ty = targetPlayer.position.y + 1.0;
      const tz = targetPlayer.position.z;
      const dx = tx - startX;
      const dy = ty - startY;
      const dz = tz - startZ;
      const len = Math.hypot(dx, dy, dz) || 1e-6;
      this.io.to(this.roomId).emit('shade-attack-telegraph', {
        shadeId: shade.id,
        targetPlayerId: targetPlayer.id,
        // Offset positions upward so daggers fly at torso/chest height
        // (shade model is ~2× taller than knight after the scale adjustment)
        startPosition: {
          x: startX,
          y: startY,
          z: startZ
        },
        targetPosition: {
          x: tx,
          y: ty,
          z: tz
        },
        maxRange: SHADE_DAGGER_MAX_RANGE,
        endPosition: {
          x: startX + (dx / len) * SHADE_DAGGER_MAX_RANGE,
          y: startY + (dy / len) * SHADE_DAGGER_MAX_RANGE,
          z: startZ + (dz / len) * SHADE_DAGGER_MAX_RANGE
        },
        damage: 25,
        timestamp: Date.now()
      });
    }
    console.log(`👻 Shade ${shade.id} throwing daggers at player ${targetPlayer.id}!`);
  }

  // ─── Warlock AI ──────────────────────────────────────────────────────────────

  updateWarlockAI(warlock, players) {
    let aggroData = this.enemyAggro.get(warlock.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(warlock, players);
      if (!closestPlayer) return;
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(warlock.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, warlock, players);
    if (!resolved) return;

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(warlock.position, tpos);
    const aggroRadius = 8;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);

    if (!aggroData.isAggroed && distance <= aggroRadius && this.hasLineOfSight(warlock.position, tpos)) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }

    if (!aggroData.isAggroed) return;

    const dx = tpos.x - warlock.position.x;
    const dz = tpos.z - warlock.position.z;
    warlock.rotation = Math.atan2(dx, dz);
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-moved', {
        enemyId: warlock.id,
        position: warlock.position,
        rotation: warlock.rotation,
        timestamp: Date.now()
      });
    }

    const now = Date.now();
    const isPurpleWarlock = warlock.soulType === 'purple';

    if (resolved.kind === 'trap') {
      const tr = resolved.trap;
      const launchRange = 12.0;
      const launchCooldown = 7000;
      const lastLaunchTime = this.warlockLaunchCooldown.get(warlock.id) || 0;
      if (distance <= launchRange && now - lastLaunchTime >= launchCooldown) {
        this.warlockLaunchCooldown.set(warlock.id, now);
        this.room.damageEnemy(tr.id, 50, null, null, {
          sourceEnemyId: warlock.id,
          damageType: 'warlock_chaos_chip',
        });
      }
      if (isPurpleWarlock) {
        const lockUntil = this.warlockLaunchMoveLockUntil.get(warlock.id) || 0;
        if (distance > WARLOCK_PREFERRED_STAND_RANGE && now >= lockUntil) {
          this.moveEnemyTowardsTarget(warlock, moveTarget);
        }
      } else if (distance > launchRange) {
        this.moveEnemyTowardsTarget(warlock, moveTarget);
      }
      return;
    }

    if (resolved.kind === 'zombie') {
      const z = resolved.zombie;
      const launchRange = 12.0;
      const launchCooldown = 7000;
      const lastLaunchTime = this.warlockLaunchCooldown.get(warlock.id) || 0;
      if (distance <= launchRange && now - lastLaunchTime >= launchCooldown) {
        this.warlockLaunchCooldown.set(warlock.id, now);
        this.damagePlayerZombieFromMob(warlock, z, 50, 'warlock_chaos_chip');
      }
      if (isPurpleWarlock) {
        const lockUntil = this.warlockLaunchMoveLockUntil.get(warlock.id) || 0;
        if (distance > WARLOCK_PREFERRED_STAND_RANGE && now >= lockUntil) {
          this.moveEnemyTowardsTarget(warlock, moveTarget);
        }
      } else if (distance > launchRange) {
        this.moveEnemyTowardsTarget(warlock, moveTarget);
      }
      return;
    }

    const targetPlayer = resolved.player;

    if (isPurpleWarlock) {
      if (!this.warlockMeteorCooldown.has(warlock.id)) {
        this.warlockMeteorCooldown.set(warlock.id, now);
      }
      const lastMeteorTime = this.warlockMeteorCooldown.get(warlock.id) || 0;
      const meteorCooldown = 9000;
      if (players.length > 0 && now - lastMeteorTime >= meteorCooldown) {
        this.warlockMeteorCooldown.set(warlock.id, now);
        this.warlockCastMeteor(warlock, targetPlayer);
      }
    } else {
      const blinkCooldown = 8000;
      const lastBlinkTime = this.warlockBlinkCooldown.get(warlock.id) || 0;
      const sharedCooldownUntil = this.warlockBlinkLaunchSharedCooldownUntil.get(warlock.id) || 0;

      if (
        now - lastBlinkTime >= blinkCooldown &&
        now >= sharedCooldownUntil &&
        distance > 3 &&
        !this.room?.isEnemyAffectedBy(warlock.id, 'freeze')
      ) {
        this.warlockBlinkCooldown.set(warlock.id, now);
        this.warlockBlinkLaunchSharedCooldownUntil.set(
          warlock.id,
          now + WARLOCK_BLINK_LAUNCH_SHARED_COOLDOWN_MS,
        );
        this.warlockCastBlink(warlock, targetPlayer);
      }
    }

    const launchRange = 12.0;
    const launchCooldown = 7000;
    const lastLaunchTime = this.warlockLaunchCooldown.get(warlock.id) || 0;
    const sharedCooldownUntil = this.warlockBlinkLaunchSharedCooldownUntil.get(warlock.id) || 0;
    const canLaunchByCooldown = distance <= launchRange && now - lastLaunchTime >= launchCooldown;
    const purpleCanLaunch = isPurpleWarlock && canLaunchByCooldown && distance <= WARLOCK_PREFERRED_STAND_RANGE;
    const redCanLaunch = !isPurpleWarlock && canLaunchByCooldown && now >= sharedCooldownUntil;

    if (purpleCanLaunch || redCanLaunch) {
      this.warlockLaunchCooldown.set(warlock.id, now);
      if (redCanLaunch) {
        this.warlockBlinkLaunchSharedCooldownUntil.set(
          warlock.id,
          now + WARLOCK_BLINK_LAUNCH_SHARED_COOLDOWN_MS,
        );
      }
      this.warlockCastLaunch(warlock, targetPlayer);
      if (isPurpleWarlock) {
        this.warlockLaunchMoveLockUntil.set(warlock.id, now + WARLOCK_LAUNCH_MOVE_LOCK_MS);
      }
    }

    if (isPurpleWarlock) {
      const lockUntil = this.warlockLaunchMoveLockUntil.get(warlock.id) || 0;
      if (distance > WARLOCK_PREFERRED_STAND_RANGE && now >= lockUntil) {
        this.moveEnemyTowardsTarget(warlock, moveTarget);
      }
    }
  }

  warlockCastBlink(warlock, targetPlayer) {
    const startPosition = { ...warlock.position };

    // Direction from warlock toward target
    const dx  = targetPlayer.position.x - warlock.position.x;
    const dz  = targetPlayer.position.z - warlock.position.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len === 0) return;

    const blinkDist = 6; // Teleport 5 units closer
    const endPosition = {
      x: warlock.position.x + (dx / len) * blinkDist,
      y: warlock.position.y,
      z: warlock.position.z + (dz / len) * blinkDist,
    };

    // Update server position immediately
    warlock.position.x = endPosition.x;
    warlock.position.y = endPosition.y;
    warlock.position.z = endPosition.z;

    // Rotation to face target from new position
    const rotDx = targetPlayer.position.x - endPosition.x;
    const rotDz = targetPlayer.position.z - endPosition.z;
    warlock.rotation = Math.atan2(rotDx, rotDz);

    if (this.io) {
      this.io.to(this.roomId).emit('warlock-blink-telegraph', {
        warlockId: warlock.id,
        startPosition,
        endPosition,
        rotation: warlock.rotation,
        timestamp: Date.now()
      });

      // Flame strike erupts at the blink destination — clients delay rendering
      // until the blink animation completes (800 ms, matches WarlockRenderer.tsx).
      this.io.to(this.roomId).emit('warlock-flame-strike', {
        warlockId: warlock.id,
        position:  endPosition,
        damage:    36,
        radius:    3.0,
        timestamp: Date.now()
      });
    }

    console.log(`🔮 Warlock ${warlock.id} blinked 5 units closer to player ${targetPlayer.id}`);
  }

  warlockCastLaunch(warlock, targetPlayer) {
    if (this.io) {
      this.io.to(this.roomId).emit('warlock-attack-telegraph', {
        warlockId: warlock.id,
        startPosition: {
          x: warlock.position.x,
          y: warlock.position.y + 2.0,
          z: warlock.position.z,
        },
        targetPosition: {
          x: targetPlayer.position.x,
          y: targetPlayer.position.y + 1.0,
          z: targetPlayer.position.z,
        },
        damage: 42,
        timestamp: Date.now()
      });
    }

    console.log(`🔮 Warlock ${warlock.id} launching chaotic orb at player ${targetPlayer.id}!`);
  }

  /** Purple warlock: 3 meteors near the aggro target; client uses boss-meteor-cast + Meteor. */
  warlockCastMeteor(warlock, targetPlayer) {
    if (!targetPlayer) {
      return;
    }

    const y = targetPlayer.position.y;
    const ex = WARLOCK_METEOR_ARENA_EXTENT;
    const clampXZ = (x, z) => ({
      x: Math.max(-ex, Math.min(ex, x)),
      y,
      z: Math.max(-ex, Math.min(ex, z)),
    });

    const x0 = targetPlayer.position.x;
    const z0 = targetPlayer.position.z;
    const primary = clampXZ(x0, z0);

    const offsetNearPrimary = () => {
      const r = WARLOCK_METEOR_OFFSET_MIN + Math.random() * (WARLOCK_METEOR_OFFSET_MAX - WARLOCK_METEOR_OFFSET_MIN);
      const a = Math.random() * Math.PI * 2;
      return clampXZ(x0 + Math.cos(a) * r, z0 + Math.sin(a) * r);
    };

    const targetPositions = [primary, offsetNearPrimary(), offsetNearPrimary()];

    const meteorId = `meteor-${warlock.id}-${Date.now()}`;

    if (this.io) {
      this.io.to(this.roomId).emit('boss-meteor-cast', {
        bossId: warlock.id,
        meteorId: meteorId,
        targetPositions: targetPositions,
        timestamp: Date.now(),
        damage: WARLOCK_METEOR_PER_HIT_DAMAGE,
        staggerIntervalMs: WARLOCK_METEOR_STAGGER_MS,
      });
    }

    console.log(`☄️ Warlock ${warlock.id} casting meteor swarm (3 impacts near player ${targetPlayer.id})`);
  }

  // ─── Templar AI ──────────────────────────────────────────────────────────────

  updateTemplarAI(templar, players) {
    let aggroData = this.enemyAggro.get(templar.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(templar, players);
      if (!closestPlayer) return;
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(templar.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, templar, players);
    if (!resolved) return;

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(templar.position, tpos);
    const attackRange = 2.6;
    const attackCooldown = templar.attackCooldown ?? 2000;
    const aggroRadius = 10;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);

    if (!aggroData.isAggroed && distance <= aggroRadius && this.hasLineOfSight(templar.position, tpos)) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }

    if (!aggroData.isAggroed) return;

    const now = Date.now();

    if (resolved.kind === 'player' && !templar.isDying) {
      if (!this.templarBlinkSmiteNextAt.has(templar.id)) {
        this.templarBlinkSmiteNextAt.set(templar.id, now + TEMPLAR_BLINK_SMITE_INTERVAL_MS);
      } else if (now >= this.templarBlinkSmiteNextAt.get(templar.id)) {
        this.templarCastBlinkSmite(templar, resolved.player);
        this.templarBlinkSmiteNextAt.set(templar.id, now + TEMPLAR_BLINK_SMITE_INTERVAL_MS);
        return;
      }
    }

    const lockUntil = this.meleeLockUntil.get(templar.id) || 0;
    if (now < lockUntil) return;

    const meleePressDistance = attackRange - MELEE_CLOSE_INSET;

    if (resolved.kind === 'player') {
      const targetPlayer = resolved.player;
      if (distance <= attackRange) {
        if (!this.bossAttackCooldown.has(templar.id)) {
          this.bossAttackCooldown.set(templar.id, 0);
        }

        const lastAttackTime = this.bossAttackCooldown.get(templar.id);

        if (now - lastAttackTime >= attackCooldown) {
          this.bossAttackCooldown.set(templar.id, now);
          const SWING_LOCK_MS = 1200;
          this.meleeLockUntil.set(templar.id, now + SWING_LOCK_MS);
          this.telegraphTemplarAttack(templar, targetPlayer);
          const pid = targetPlayer.id;

          setTimeout(() => {
            if (templar.isDying || !this.room?.getGameStarted()) return;

            const currentPlayers = this.room?.getPlayers();
            if (!currentPlayers) return;

            const currentTarget = currentPlayers.find(p => p.id === pid);
            if (!currentTarget || currentTarget.health <= 0) return;

            const currentDistance = this.calculateDistance(templar.position, currentTarget.position);
            if (currentDistance <= attackRange) {
              this.templarAttackPlayer(templar, currentTarget);
            } else {
              console.log(`🛡️ Templar ${templar.id} swing missed — player dodged!`);
            }
          }, 1000);
        } else if (distance > meleePressDistance) {
          this.moveEnemyTowardsTarget(templar, moveTarget, { meleeSurroundAttackRange: attackRange });
        }
      } else {
        this.moveEnemyTowardsTarget(templar, moveTarget, { meleeSurroundAttackRange: attackRange });
      }
    } else if (resolved.kind === 'zombie') {
      const z = resolved.zombie;
      if (distance <= attackRange) {
        if (!this.bossAttackCooldown.has(templar.id)) {
          this.bossAttackCooldown.set(templar.id, 0);
        }

        const lastAttackTime = this.bossAttackCooldown.get(templar.id);

        if (now - lastAttackTime >= attackCooldown) {
          this.bossAttackCooldown.set(templar.id, now);
          const SWING_LOCK_MS = 1200;
          this.meleeLockUntil.set(templar.id, now + SWING_LOCK_MS);
          this.telegraphTemplarAttack(templar, {
            id: z.ownerPlayerId || z.id,
            position: z.position,
          });
          const zid = z.id;

          setTimeout(() => {
            if (templar.isDying || !this.room?.getGameStarted()) return;
            const liveZ = this.room?.getEnemy(zid);
            if (!liveZ || liveZ.isDying || liveZ.health <= 0) return;
            const currentDistance = this.calculateDistance(templar.position, liveZ.position);
            if (currentDistance <= attackRange) {
              const damage = templar.damage || 48;
              this.damagePlayerZombieFromMob(templar, liveZ, damage, 'templar_melee');
            } else {
              console.log(`🛡️ Templar ${templar.id} swing missed — zombie dodged!`);
            }
          }, 1000);
        } else if (distance > meleePressDistance) {
          this.moveEnemyTowardsTarget(templar, moveTarget, { meleeSurroundAttackRange: attackRange });
        }
      } else {
        this.moveEnemyTowardsTarget(templar, moveTarget, { meleeSurroundAttackRange: attackRange });
      }
    } else {
      const tr = resolved.trap;
      if (distance <= attackRange) {
        if (!this.bossAttackCooldown.has(templar.id)) {
          this.bossAttackCooldown.set(templar.id, 0);
        }

        const lastAttackTime = this.bossAttackCooldown.get(templar.id);

        if (now - lastAttackTime >= attackCooldown) {
          this.bossAttackCooldown.set(templar.id, now);
          const SWING_LOCK_MS = 1200;
          this.meleeLockUntil.set(templar.id, now + SWING_LOCK_MS);
          this.telegraphTemplarAttack(templar, {
            id: tr.id,
            position: tr.position,
          });
          const trapId = tr.id;

          setTimeout(() => {
            if (templar.isDying || !this.room?.getGameStarted()) return;
            const liveT = this.room?.getEnemy(trapId);
            if (!liveT || liveT.isDying || liveT.health <= 0 || liveT.type !== 'tentacle-spine') return;
            const currentDistance = this.calculateDistance(templar.position, liveT.position);
            if (currentDistance <= attackRange) {
              const damage = templar.damage || 46;
              this.room.damageEnemy(trapId, damage, null, null, {
                sourceEnemyId: templar.id,
                damageType: 'templar_melee',
              });
            }
          }, 1000);
        } else if (distance > meleePressDistance) {
          this.moveEnemyTowardsTarget(templar, moveTarget, { meleeSurroundAttackRange: attackRange });
        }
      } else {
        this.moveEnemyTowardsTarget(templar, moveTarget, { meleeSurroundAttackRange: attackRange });
      }
    }
  }

  telegraphTemplarAttack(templar, player) {
    if (this.io) {
      this.io.to(this.roomId).emit('templar-attack-telegraph', {
        templarId: templar.id,
        targetPlayerId: player.id,
        position: templar.position,
        timestamp: Date.now()
      });
    }
    console.log(`🛡️ Templar ${templar.id} telegraphing attack at player ${player.id}!`);
  }

  templarAttackPlayer(templar, player) {
    const damage = templar.damage || 48;

    if (this.io) {
      this.io.to(this.roomId).emit('templar-attack', {
        templarId: templar.id,
        targetPlayerId: player.id,
        damage: damage,
        position: templar.position,
        timestamp: Date.now()
      });
    }

    console.log(`🛡️ Templar ${templar.id} attacked player ${player.id} for ${damage} damage!`);
  }

  /**
   * Shared boss / templar: snap enemy behind the target and face them (boss teleport, templar blink smite).
   * Mutates `enemy.position` and `enemy.rotation`. Returns VFX + sync payloads.
   */
  teleportEnemyBehindTarget(enemy, targetPlayer) {
    const startPosition = {
      x: enemy.position.x,
      y: enemy.position.y,
      z: enemy.position.z
    };
    const playerRotation = targetPlayer.rotation?.y || 0;
    const facingX = Math.sin(playerRotation);
    const facingZ = Math.cos(playerRotation);
    const endPosition = {
      x: targetPlayer.position.x - facingX * TELEPORT_BEHIND_DISTANCE,
      y: targetPlayer.position.y,
      z: targetPlayer.position.z - facingZ * TELEPORT_BEHIND_DISTANCE
    };
    enemy.position.x = endPosition.x;
    enemy.position.y = endPosition.y;
    enemy.position.z = endPosition.z;
    const rotDx = targetPlayer.position.x - endPosition.x;
    const rotDz = targetPlayer.position.z - endPosition.z;
    enemy.rotation = Math.atan2(rotDx, rotDz);
    return { startPosition, endPosition };
  }

  templarCastBlinkSmite(templar, targetPlayer) {
    if (!targetPlayer) return;
    const { startPosition, endPosition } = this.teleportEnemyBehindTarget(templar, targetPlayer);
    const blinkTime = Date.now();
    this.meleeLockUntil.set(templar.id, blinkTime + TEMPLAR_BLINK_SMITE_ABILITY_LOCK_MS);
    if (!this.bossAttackCooldown.has(templar.id)) {
      this.bossAttackCooldown.set(templar.id, 0);
    }
    this.bossAttackCooldown.set(templar.id, Math.max(
      this.bossAttackCooldown.get(templar.id) || 0,
      blinkTime + TEMPLAR_BLINK_SMITE_ABILITY_LOCK_MS
    ));
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-moved', {
        enemyId: templar.id,
        position: { ...templar.position },
        rotation: templar.rotation,
        timestamp: blinkTime
      });
      this.io.to(this.roomId).emit('templar-teleport', {
        templarId: templar.id,
        startPosition,
        endPosition,
        rotation: templar.rotation,
        targetPlayerId: targetPlayer.id,
        timestamp: blinkTime
      });
      this.io.to(this.roomId).emit('templar-blink-smite-windup', {
        templarId: templar.id,
        targetPlayerId: targetPlayer.id,
        timestamp: blinkTime
      });
    }
    const templarId = templar.id;
    setTimeout(() => {
      if (!this.room?.getGameStarted()) return;
      const e = this.room?.enemies?.get(templarId);
      if (!e || e.isDying || e.type !== 'templar') return;
      const r = e.rotation || 0;
      const forwardX = Math.sin(r);
      const forwardZ = Math.cos(r);
      const smiteX = e.position.x + forwardX * TEMPLAR_BLINK_SMITE_IMPACT_OFFSET;
      const smiteZ = e.position.z + forwardZ * TEMPLAR_BLINK_SMITE_IMPACT_OFFSET;
      const smiteY = e.position.y;
      if (this.io) {
        this.io.to(this.roomId).emit('templar-blink-smite-impact', {
          templarId: e.id,
          position: { x: smiteX, y: smiteY, z: smiteZ },
          rotation: r,
          radius: TEMPLAR_BLINK_SMITE_RADIUS,
          damage: TEMPLAR_BLINK_SMITE_DAMAGE,
          timestamp: Date.now()
        });
      }
    }, TEMPLAR_BLINK_SMITE_STRIKE_DELAY_MS);
    console.log(`🛡️ Templar ${templar.id} Blink Smite — behind ${targetPlayer.id}, strike in ${TEMPLAR_BLINK_SMITE_STRIKE_DELAY_MS}ms`);
  }

  // ─── Viper AI ────────────────────────────────────────────────────────────────

  updateViperAI(viper, players) {
    let aggroData = this.enemyAggro.get(viper.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(viper, players);
      if (!closestPlayer) return;
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(viper.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, viper, players);
    if (!resolved) return;

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(viper.position, tpos);
    const attackRange = 12.0;
    const aggroRadius = 12;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);

    if (!aggroData.isAggroed && distance <= aggroRadius && this.hasLineOfSight(viper.position, tpos)) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }

    if (!aggroData.isAggroed) return;

    const dx = tpos.x - viper.position.x;
    const dz = tpos.z - viper.position.z;
    viper.rotation = Math.atan2(dx, dz);
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-moved', {
        enemyId: viper.id,
        position: viper.position,
        rotation: viper.rotation,
        timestamp: Date.now()
      });
    }

    const attackCooldown = viper.attackCooldown ?? 5000;
    const lastAttackTime = this.viperAttackCooldown.get(viper.id) || 0;
    const now = Date.now();

    if (distance <= attackRange) {
      if (now - lastAttackTime >= attackCooldown) {
        this.viperAttackCooldown.set(viper.id, now);
        if (resolved.kind === 'player') {
          this.telegraphViperAttack(viper, resolved.player);
        } else if (resolved.kind === 'zombie') {
          const z = resolved.zombie;
          this.telegraphViperAttack(viper, {
            id: z.ownerPlayerId || z.id,
            position: z.position,
          });
          const zid = z.id;
          setTimeout(() => {
            if (viper.isDying || !this.room?.getGameStarted()) return;
            const zz = this.room?.getEnemy(zid);
            if (!zz || zz.isDying || zz.health <= 0) return;
            if (this.calculateDistance(viper.position, zz.position) > attackRange + 1) return;
            this.damagePlayerZombieFromMob(viper, zz, 70, 'viper_arrow');
          }, 800);
        } else {
          const tr = resolved.trap;
          this.telegraphViperAttack(viper, {
            id: tr.id,
            position: tr.position,
          });
          const trapId = tr.id;
          setTimeout(() => {
            if (viper.isDying || !this.room?.getGameStarted()) return;
            const tt = this.room?.getEnemy(trapId);
            if (!tt || tt.isDying || tt.health <= 0 || tt.type !== 'tentacle-spine') return;
            if (this.calculateDistance(viper.position, tt.position) > attackRange + 1) return;
            this.room.damageEnemy(trapId, 70, null, null, {
              sourceEnemyId: viper.id,
              damageType: 'viper_arrow',
            });
          }, 800);
        }
      }
    } else {
      this.moveEnemyTowardsTarget(viper, moveTarget);
    }
  }

  telegraphViperAttack(viper, targetPlayer) {
    if (this.io) {
      const startY = viper.position.y + 1.5;
      const startX = viper.position.x;
      const startZ = viper.position.z;
      const tx = targetPlayer.position.x;
      const ty = targetPlayer.position.y + 1.0;
      const tz = targetPlayer.position.z;
      const dx = tx - startX;
      const dy = ty - startY;
      const dz = tz - startZ;
      const len = Math.hypot(dx, dy, dz) || 1e-6;
      this.io.to(this.roomId).emit('viper-attack-telegraph', {
        viperId:  viper.id,
        targetPlayerId: targetPlayer.id,
        // Launch arrow from chest height of the viper model.
        startPosition: {
          x: startX,
          y: startY,
          z: startZ
        },
        targetPosition: {
          x: tx,
          y: ty,
          z: tz
        },
        maxRange:      VIPER_ARROW_MAX_RANGE,
        endPosition: {
          x: startX + (dx / len) * VIPER_ARROW_MAX_RANGE,
          y: startY + (dy / len) * VIPER_ARROW_MAX_RANGE,
          z: startZ + (dz / len) * VIPER_ARROW_MAX_RANGE
        },
        damage:    50,
        timestamp: Date.now()
      });
    }
    console.log(`🐍 Viper ${viper.id} drawing bow at player ${targetPlayer.id}!`);
  }

  // ─── Weaver AI ───────────────────────────────────────────────────────────────

  updateWeaverAI(weaver, players) {
    let aggroData = this.enemyAggro.get(weaver.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(weaver, players);
      if (!closestPlayer) return;
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(weaver.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, weaver, players);
    if (!resolved) return;

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(weaver.position, tpos);
    const aggroRadius = 10;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);

    if (!aggroData.isAggroed && distance <= aggroRadius && this.hasLineOfSight(weaver.position, tpos)) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }

    if (!aggroData.isAggroed) return;

    const dx = tpos.x - weaver.position.x;
    const dz = tpos.z - weaver.position.z;
    weaver.rotation = Math.atan2(dx, dz);
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-moved', {
        enemyId: weaver.id,
        position: weaver.position,
        rotation: weaver.rotation,
        timestamp: Date.now()
      });
    }

    const now = Date.now();
    const isBlueWeaver = weaver.soulType === 'blue';

    if (isBlueWeaver) {
      if (!this.weaverLightningCooldown.has(weaver.id)) {
        this.weaverLightningCooldown.set(weaver.id, now);
      }
      const lastLightning = this.weaverLightningCooldown.get(weaver.id) || 0;
      const lightningCooldown = 7000;
      if (now - lastLightning >= lightningCooldown) {
        this.weaverLightningCooldown.set(weaver.id, now);
        if (resolved.kind === 'player') {
          this.weaverCastLightning(weaver, resolved.player, now);
        } else if (resolved.kind === 'zombie') {
          this.weaverCastLightningOnZombie(weaver, resolved.zombie, now);
        } else {
          this.weaverCastLightningOnTrap(weaver, resolved.trap, now);
        }
      }
    } else {
      // ── Summon Ghoul (30-second cooldown; max 1 active ghoul) ────────────
      const summonCooldown = 30000;
      const lastSummonTime = this.weaverSummonCooldown.get(weaver.id) || 0;
      const activeGhoulId  = this.weaverSummonedGhouls.get(weaver.id);
      const ghoulAlive     = activeGhoulId && this.room?.enemies.has(activeGhoulId) &&
                             !this.room?.enemies.get(activeGhoulId)?.isDying;

      if (!ghoulAlive && now - lastSummonTime >= summonCooldown) {
        this.weaverSummonCooldown.set(weaver.id, now);
        this.weaverCastSummon(weaver);
      }

      // ── Heal (5-second cooldown) ───────────────────────────────────────────
      const healCooldown   = 5000;
      const healRange      = 10.0;
      const lastHealTime   = this.weaverHealCooldown.get(weaver.id) || 0;

      if (now - lastHealTime >= healCooldown) {
        const healTarget = this.findLowestHpPercentEnemy(weaver, healRange);
        if (healTarget) {
          this.weaverHealCooldown.set(weaver.id, now);
          this.weaverCastHeal(weaver, healTarget);
        }
      }
    }

    const preferredRange = 8.0;
    if (distance > preferredRange) {
      this.moveEnemyTowardsTarget(weaver, moveTarget);
    }
  }

  weaverCastLightningOnZombie(weaver, zombie, now) {
    const CHARGE_MS = 1500;
    const tx = zombie.position.x;
    const tz = zombie.position.z;
    if (this.io) {
      this.io.to(this.roomId).emit('weaver-lightning-telegraph', {
        weaverId: weaver.id,
        targetPosition: { x: tx, y: 0, z: tz },
        strikeAt: now + CHARGE_MS,
        damage: 45,
        radius: 2.99,
        timestamp: now
      });
    }
    const zid = zombie.id;
    setTimeout(() => {
      if (!this.room?.getGameStarted()) return;
      const zz = this.room?.getEnemy(zid);
      if (!zz || zz.isDying || zz.health <= 0) return;
      const rdx = zz.position.x - tx;
      const rdz = zz.position.z - tz;
      if (Math.sqrt(rdx * rdx + rdz * rdz) <= 2.99) {
        this.damagePlayerZombieFromMob(weaver, zz, 35, 'weaver_lightning');
      }
    }, CHARGE_MS);
    console.log(`🧵 Weaver ${weaver.id} lightning (zombie) at (${tx.toFixed(1)}, ${tz.toFixed(1)})`);
  }

  weaverCastLightningOnTrap(weaver, trap, now) {
    const CHARGE_MS = 1500;
    const tx = trap.position.x;
    const tz = trap.position.z;
    if (this.io) {
      this.io.to(this.roomId).emit('weaver-lightning-telegraph', {
        weaverId: weaver.id,
        targetPosition: { x: tx, y: 0, z: tz },
        strikeAt: now + CHARGE_MS,
        damage: 45,
        radius: 2.99,
        timestamp: now,
      });
    }
    const trapId = trap.id;
    setTimeout(() => {
      if (!this.room?.getGameStarted()) return;
      const tt = this.room?.getEnemy(trapId);
      if (!tt || tt.isDying || tt.health <= 0 || tt.type !== 'tentacle-spine') return;
      const rdx = tt.position.x - tx;
      const rdz = tt.position.z - tz;
      if (Math.sqrt(rdx * rdx + rdz * rdz) <= 2.99) {
        this.room.damageEnemy(trapId, 35, null, null, {
          sourceEnemyId: weaver.id,
          damageType: 'weaver_lightning',
        });
      }
    }, CHARGE_MS);
    console.log(`🧵 Weaver ${weaver.id} lightning (trap) at (${tx.toFixed(1)}, ${tz.toFixed(1)})`);
  }

  // Find the allied enemy (not a player) within healRange of the weaver that has
  // the lowest current HP percentage, skipping dying/dead enemies and the weaver itself.
  findLowestHpPercentEnemy(weaver, range) {
    if (!this.room) return null;

    let lowestPct  = Infinity;
    let bestTarget = null;

    this.room.getEnemies().forEach(enemy => {
      if (enemy.id === weaver.id) return;
      if (enemy.isDying || enemy.health <= 0) return;
      if (enemy.type === 'tentacle-spine') return;
      if (enemy.health >= enemy.maxHealth) return; // Already full — no point healing

      const dist = this.calculateDistance(weaver.position, enemy.position);
      if (dist > range) return;

      const pct = enemy.health / enemy.maxHealth;
      if (pct < lowestPct) {
        lowestPct  = pct;
        bestTarget = enemy;
      }
    });

    return bestTarget;
  }

  weaverCastHeal(weaver, targetEnemy) {
    // Face the heal target
    const dx = targetEnemy.position.x - weaver.position.x;
    const dz = targetEnemy.position.z - weaver.position.z;
    weaver.rotation = Math.atan2(dx, dz);

    if (this.io) {
      this.io.to(this.roomId).emit('weaver-heal-telegraph', {
        weaverId:       weaver.id,
        targetEnemyId:  targetEnemy.id,
        targetPosition: { ...targetEnemy.position },
        timestamp:      Date.now()
      });
    }
    console.log(`🧵 Weaver ${weaver.id} casting Heal on ${targetEnemy.id} (HP: ${targetEnemy.health}/${targetEnemy.maxHealth})`);

    // After cast animation (~1.8s) apply the actual heal.
    setTimeout(() => {
      if (weaver.isDying || !this.room?.getGameStarted()) return;

      const liveEnemy = this.room?.getEnemy(targetEnemy.id);
      if (!liveEnemy || liveEnemy.isDying || liveEnemy.health <= 0) return;

      const healAmount    = 150;
      const previousHp    = liveEnemy.health;
      liveEnemy.health    = Math.min(liveEnemy.maxHealth, liveEnemy.health + healAmount);
      const actualHeal    = liveEnemy.health - previousHp;

      if (this.io) {
        this.io.to(this.roomId).emit('enemy-healed', {
          enemyId:    liveEnemy.id,
          healAmount: actualHeal,
          newHealth:  liveEnemy.health,
          maxHealth:  liveEnemy.maxHealth,
          timestamp:  Date.now()
        });
      }
      console.log(`🧵 Weaver ${weaver.id} healed ${liveEnemy.id} for ${actualHeal} HP (${previousHp} -> ${liveEnemy.health})`);
    }, 1800);
  }

  weaverCastLightning(weaver, targetPlayer, now) {
    // Client shows a blue ground circle; after CHARGE_MS, same dodge/damage as meteor (local check).
    const CHARGE_MS = 1500;
    if (this.io) {
      this.io.to(this.roomId).emit('weaver-lightning-telegraph', {
        weaverId: weaver.id,
        targetPosition: {
          x: targetPlayer.position.x,
          y: 0,
          z: targetPlayer.position.z
        },
        strikeAt: now + CHARGE_MS,
        damage: 45,
        radius: 2.99,
        timestamp: now
      });
    }
    console.log(`🧵 Weaver ${weaver.id} calling lightning at (${targetPlayer.position.x.toFixed(1)}, ${targetPlayer.position.z.toFixed(1)}) in ${CHARGE_MS}ms`);
  }

  weaverCastSummon(weaver) {
    if (!this.room) return;

    // Ritual circle spawns 2–3 units in front/side of weaver
    const angle    = weaver.rotation + (Math.random() - 0.5) * (Math.PI / 3);
    const distance = 2.5 + Math.random() * 1.5;

    const ritualPosition = {
      x: weaver.position.x + Math.sin(angle) * distance,
      y: 0,
      z: weaver.position.z + Math.cos(angle) * distance,
    };

    // Broadcast summon animation telegraph — include ritual position so the
    // client can place the ritual circle immediately at cast start.
    if (this.io) {
      this.io.to(this.roomId).emit('weaver-summon-telegraph', {
        weaverId:       weaver.id,
        ritualPosition: { ...ritualPosition },
        timestamp:      Date.now()
      });
    }
    console.log(`🧵 Weaver ${weaver.id} beginning summon ritual…`);

    // After the cast animation (~3s), spawn the ghoul
    setTimeout(() => {
      if (weaver.isDying || !this.room?.getGameStarted()) return;

      const ghoulId = `ghoul-${weaver.id}-${Date.now()}`;

      const ghoul = {
        id:        ghoulId,
        type:      'ghoul',
        position:  { ...ritualPosition },
        rotation:  rotationYTowardEntry(ritualPosition.x, ritualPosition.z),
        health:    400,
        maxHealth: 400,
        isDying:   false,
        damage:    28,
        attackCooldown: 2000,
        moveSpeed: 0,   // Frozen during summon animation
        summonerId: weaver.id,
      };

      this.weaverSummonedGhouls.set(weaver.id, ghoulId);
      this.room.addEnemy(ghoul);

      if (this.io) {
        this.io.to(this.roomId).emit('weaver-ghoul-summoned', {
          weaverId:       weaver.id,
          ghoul,
          ritualPosition: { ...ritualPosition },
          timestamp:      Date.now()
        });
      }
      console.log(`🧵 Weaver ${weaver.id} summoned ghoul ${ghoulId} at ritual circle!`);

      // Unlock movement once the summon animation finishes (~4500ms, extended to match ritual duration)
      setTimeout(() => {
        const spawnedGhoul = this.room?.getEnemy(ghoulId);
        if (spawnedGhoul && !spawnedGhoul.isDying) {
          spawnedGhoul.moveSpeed = 2.5;
          console.log(`💀 Ghoul ${ghoulId} summon animation complete — movement unlocked`);
        }
      }, 4500);
    }, 3000);
  }

  // ─── Ghoul AI ────────────────────────────────────────────────────────────────

  updateGhoulAI(ghoul, players) {
    let aggroData = this.enemyAggro.get(ghoul.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(ghoul, players);
      if (!closestPlayer) return;
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
        isAggroed: true,
      };
      this.enemyAggro.set(ghoul.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, ghoul, players);
    if (!resolved) return;

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(ghoul.position, tpos);
    const attackRange = 2.4;
    const attackCooldown = ghoul.attackCooldown ?? 2000;

    const now = Date.now();
    const lockUntil = this.meleeLockUntil.get(ghoul.id) || 0;
    if (now < lockUntil) return;

    const meleePressDistance = attackRange - MELEE_CLOSE_INSET;

    if (distance <= attackRange) {
      if (!this.ghoulAttackCooldown.has(ghoul.id)) {
        this.ghoulAttackCooldown.set(ghoul.id, 0);
      }

      const lastAttackTime = this.ghoulAttackCooldown.get(ghoul.id);

      if (now - lastAttackTime >= attackCooldown) {
        this.ghoulAttackCooldown.set(ghoul.id, now);
        const SWING_LOCK_MS = 1200;
        this.meleeLockUntil.set(ghoul.id, now + SWING_LOCK_MS);

        if (resolved.kind === 'player') {
          this.telegraphGhoulAttack(ghoul, resolved.player);
          const pid = resolved.player.id;
          setTimeout(() => {
            if (ghoul.isDying || !this.room?.getGameStarted()) return;

            const currentPlayers = this.room?.getPlayers();
            if (!currentPlayers) return;

            const currentTarget = currentPlayers.find(p => p.id === pid);
            if (!currentTarget || currentTarget.health <= 0) return;

            const currentDistance = this.calculateDistance(ghoul.position, currentTarget.position);
            if (currentDistance <= attackRange) {
              this.ghoulAttackPlayer(ghoul, currentTarget);
            } else {
              console.log(`💀 Ghoul ${ghoul.id} swing missed — player dodged!`);
            }
          }, 900);
        } else if (resolved.kind === 'zombie') {
          const z = resolved.zombie;
          this.telegraphGhoulAttack(ghoul, {
            id: z.ownerPlayerId || z.id,
            position: z.position,
          });
          const zid = z.id;
          setTimeout(() => {
            if (ghoul.isDying || !this.room?.getGameStarted()) return;
            const zz = this.room?.getEnemy(zid);
            if (!zz || zz.isDying || zz.health <= 0) return;
            const currentDistance = this.calculateDistance(ghoul.position, zz.position);
            if (currentDistance <= attackRange) {
              const damage = ghoul.damage || 28;
              this.damagePlayerZombieFromMob(ghoul, zz, damage, 'ghoul_melee');
            } else {
              console.log(`💀 Ghoul ${ghoul.id} swing missed — zombie dodged!`);
            }
          }, 900);
        } else {
          const tr = resolved.trap;
          this.telegraphGhoulAttack(ghoul, {
            id: tr.id,
            position: tr.position,
          });
          const trapId = tr.id;
          setTimeout(() => {
            if (ghoul.isDying || !this.room?.getGameStarted()) return;
            const tt = this.room?.getEnemy(trapId);
            if (!tt || tt.isDying || tt.health <= 0 || tt.type !== 'tentacle-spine') return;
            const currentDistance = this.calculateDistance(ghoul.position, tt.position);
            if (currentDistance <= attackRange) {
              const damage = ghoul.damage || 30;
              this.room.damageEnemy(trapId, damage, null, null, {
                sourceEnemyId: ghoul.id,
                damageType: 'ghoul_melee',
              });
            }
          }, 900);
        }
      } else if (distance > meleePressDistance) {
        this.moveEnemyTowardsTarget(ghoul, moveTarget, { meleeSurroundAttackRange: attackRange });
      }
    } else {
      this.moveEnemyTowardsTarget(ghoul, moveTarget, { meleeSurroundAttackRange: attackRange });
    }
  }

  updateMartyrAI(martyr, players) {
    if (martyr.martyrState === 'priming') {
      return;
    }

    let aggroData = this.enemyAggro.get(martyr.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(martyr, players);
      if (!closestPlayer) return;
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
        isAggroed: true,
      };
      this.enemyAggro.set(martyr.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, martyr, players);
    if (!resolved) return;

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(martyr.position, tpos);
    const attackRange = MARTYR_MELEE_RANGE;

    if (distance <= attackRange) {
      const detX = martyr.position.x;
      const detY = martyr.position.y;
      const detZ = martyr.position.z;
      martyr.martyrState = 'priming';
      this.meleeLockUntil.set(martyr.id, Date.now() + MARTYR_DETONATION_DELAY_MS + 5000);

      const now = Date.now();
      if (this.io) {
        this.io.to(this.roomId).emit('martyr-detonation-telegraph', {
          martyrId: martyr.id,
          position: { x: detX, y: detY, z: detZ },
          radius: MARTYR_DETONATION_RADIUS,
          detonateAt: now + MARTYR_DETONATION_DELAY_MS,
          durationMs: MARTYR_DETONATION_DELAY_MS,
          timestamp: now,
        });
      }

      const martyrId = martyr.id;
      const blastCenter = { x: detX, y: detY, z: detZ };
      setTimeout(() => {
        if (!this.room?.getGameStarted()) return;
        if (this.io) {
          this.io.to(this.roomId).emit('martyr-detonation-impact', {
            martyrId,
            position: { x: detX, y: detY, z: detZ },
            radius: MARTYR_DETONATION_RADIUS,
            damage: MARTYR_DETONATION_DAMAGE,
            timestamp: Date.now(),
          });
        }
        const e = this.room?.enemies?.get(martyrId);
        if (e && !e.isDying && e.health > 0) {
          this.room.damageEnemy(martyrId, MARTYR_DETONATION_DAMAGE, null, null, { damageType: 'martyr_self' });
        }
        if (this.room?.getEnemies) {
          for (const other of this.room.getEnemies()) {
            if (!other || other.id === martyrId || other.isDying || other.health <= 0) continue;
            if (other.type !== 'player-zombie') continue;
            if (this.calculateDistance(blastCenter, other.position) <= MARTYR_DETONATION_RADIUS) {
              this.room.damageEnemy(other.id, MARTYR_DETONATION_DAMAGE, null, null, { damageType: 'martyr_detonation' });
            }
          }
        }
      }, MARTYR_DETONATION_DELAY_MS);
      return;
    }

    this.moveEnemyTowardsTarget(martyr, moveTarget, { meleeSurroundAttackRange: attackRange });
  }

  telegraphGhoulAttack(ghoul, player) {
    if (this.io) {
      this.io.to(this.roomId).emit('ghoul-attack-telegraph', {
        ghoulId:       ghoul.id,
        targetPlayerId: player.id,
        position:       ghoul.position,
        timestamp:      Date.now()
      });
    }
    console.log(`💀 Ghoul ${ghoul.id} telegraphing attack at player ${player.id}!`);
  }

  ghoulAttackPlayer(ghoul, player) {
    const damage = ghoul.damage || 30;

    if (this.io) {
      this.io.to(this.roomId).emit('ghoul-attack', {
        ghoulId:       ghoul.id,
        targetPlayerId: player.id,
        damage,
        position: ghoul.position,
        timestamp: Date.now()
      });
    }
    console.log(`💀 Ghoul ${ghoul.id} attacked player ${player.id} for ${damage} damage!`);
  }

  clearBossAggroForTectonic(boss) {
    if (this.bossDamageTracking.has(boss.id)) {
      this.bossDamageTracking.get(boss.id).clear();
    }
    boss.currentTarget = null;
    this.enemyTaunts.delete(boss.id);
  }

  clearTectonicSpikePendingTimeoutsForBoss(bossId) {
    const arr = this.bossTectonicSpikePendingTimeouts.get(bossId);
    if (arr) {
      arr.forEach((tid) => clearTimeout(tid));
      this.bossTectonicSpikePendingTimeouts.delete(bossId);
    }
  }

  removeTectonicSpikePendingTimeoutHandle(bossId, handle) {
    const arr = this.bossTectonicSpikePendingTimeouts.get(bossId);
    if (!arr) return;
    const i = arr.indexOf(handle);
    if (i >= 0) arr.splice(i, 1);
    if (arr.length === 0) this.bossTectonicSpikePendingTimeouts.delete(bossId);
  }

  scheduleTectonicSpikeHit(boss, landX, landZ, index, tickNow) {
    const spikeId = `tectonic-spike-${boss.id}-${tickNow}-${index}`;
    if (this.io) {
      this.io.to(this.roomId).emit('boss-tectonic-spike-telegraph', {
        bossId: boss.id,
        spikeId,
        position: { x: landX, y: 0, z: landZ },
        warningMs: BOSS_TECTONIC_SPIKE_WARN_MS,
        timestamp: tickNow,
      });
    }
    const handle = setTimeout(() => {
      this.removeTectonicSpikePendingTimeoutHandle(boss.id, handle);
      const b = this.room?.enemies?.get(boss.id);
      if (!b || b.isDying || b.health <= 0) return;
      if (this.room) {
        this.room.damagePlayersInHorizontalRing(
          { x: landX, y: 0, z: landZ },
          BOSS_TECTONIC_SHARD_RADIUS,
          BOSS_TECTONIC_SHARD_DAMAGE,
          'boss_tectonic',
        );
      }
      if (this.io) {
        this.io.to(this.roomId).emit('boss-tectonic-spike-appear', {
          bossId: boss.id,
          spikeId,
          position: { x: landX, y: 0, z: landZ },
          timestamp: Date.now(),
        });
      }
    }, BOSS_TECTONIC_SPIKE_WARN_MS);
    if (!this.bossTectonicSpikePendingTimeouts.has(boss.id)) {
      this.bossTectonicSpikePendingTimeouts.set(boss.id, []);
    }
    this.bossTectonicSpikePendingTimeouts.get(boss.id).push(handle);
  }

  computeBossLeapLandXZ(boss, targetPlayer) {
    const bx = boss.position.x;
    const bz = boss.position.z;
    const tx = targetPlayer.position.x;
    const tz = targetPlayer.position.z;
    const dx = tx - bx;
    const dz = tz - bz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.01) return { x: bx, z: bz };
    const ndx = dx / dist;
    const ndz = dz / dist;
    const want = dist - BOSS_LEAP_LAND_STANDOFF_M;
    const leapCap =
      this.room && this.room.coopBossThroneArena ? BOSS_LEAP_MAX_TRAVEL_THRONE : BOSS_LEAP_MAX_TRAVEL;
    const travel = Math.max(0, Math.min(leapCap, want));
    let lx = bx + ndx * travel;
    let lz = bz + ndz * travel;
    if (this.resolveEnemyWallCollisions) {
      const r = this.resolveEnemyWallCollisions(lx, lz);
      lx = r.x;
      lz = r.z;
    }
    return { x: lx, z: lz };
  }

  moveBossTowardPoint(boss, px, pz) {
    const d = this.calculateDistance(boss.position, { x: px, y: 0, z: pz });
    const baseSpeed = boss.moveSpeed ?? this.getEnemyMoveSpeed('boss');
    const moveSpeed = this.getModifiedMovementSpeed(boss.id, baseSpeed);
    if (d < 0.45 || moveSpeed === 0) return;
    const dx = px - boss.position.x;
    const dz = pz - boss.position.z;
    const mag = Math.sqrt(dx * dx + dz * dz);
    if (mag === 0) return;
    const dirX = dx / mag;
    const dirZ = dz / mag;
    const deltaTime = this.updateInterval / 1000;
    const moveDistance = moveSpeed * deltaTime;
    const rawX = boss.position.x + dirX * moveDistance;
    const rawZ = boss.position.z + dirZ * moveDistance;
    const resolved = this.resolveEnemyWallCollisions(rawX, rawZ);
    boss.position.x = resolved.x;
    boss.position.z = resolved.z;
    boss.rotation = Math.atan2(dirX, dirZ);
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-moved', {
        enemyId: boss.id,
        position: boss.position,
        rotation: boss.rotation,
        timestamp: Date.now(),
      });
    }
  }

  bossStartLeap(boss, targetPlayer) {
    const fromX = boss.position.x;
    const fromZ = boss.position.z;
    const { x: landX, z: landZ } = this.computeBossLeapLandXZ(boss, targetPlayer);
    const endAt = Date.now() + BOSS_LEAP_DURATION_MS;
    this.bossLeapEndAt.set(boss.id, endAt);
    this.bossLeapLand.set(boss.id, { x: landX, z: landZ });
    this.bossLeapFrom.set(boss.id, { x: fromX, z: fromZ });
    if (this.io) {
      this.io.to(this.roomId).emit('boss-leap-start', {
        bossId: boss.id,
        startPosition: { x: boss.position.x, y: boss.position.y, z: boss.position.z },
        landPosition: { x: landX, y: 0, z: landZ },
        durationMs: BOSS_LEAP_DURATION_MS,
        timestamp: Date.now(),
      });
    }
    const t = setTimeout(() => {
      this.bossCompleteLeap(boss.id);
    }, BOSS_LEAP_DURATION_MS);
    this.bossLeapTimeout.set(boss.id, t);
  }

  bossCompleteLeap(bossId) {
    this.bossLeapTimeout.delete(bossId);
    this.bossLeapEndAt.delete(bossId);
    const land = this.bossLeapLand.get(bossId);
    this.bossLeapLand.delete(bossId);
    this.bossLeapFrom.delete(bossId);
    const boss = this.room?.enemies?.get(bossId);
    if (!boss || boss.isDying || boss.health <= 0) return;
    if (land) {
      boss.position.x = land.x;
      boss.position.z = land.z;
    }
    this.bossLeapCooldown.set(bossId, Date.now());
    if (this.room) {
      this.room.damagePlayersInHorizontalRing(land, BOSS_LEAP_LANDING_RADIUS, BOSS_LEAP_DAMAGE, 'boss_leap');
    }
    if (this.io) {
      this.io.to(this.roomId).emit('boss-leap-land', {
        bossId,
        landPosition: land ? { x: land.x, y: 0, z: land.z } : { x: boss.position.x, y: 0, z: boss.position.z },
        timestamp: Date.now(),
      });
      this.io.to(this.roomId).emit('enemy-moved', {
        enemyId: bossId,
        position: { ...boss.position },
        rotation: boss.rotation,
        timestamp: Date.now(),
      });
    }
  }

  getBossThreatTarget(boss, players) {
    if (!this.bossDamageTracking.has(boss.id)) {
      this.bossDamageTracking.set(boss.id, new Map());
    }

    const damageMap = this.bossDamageTracking.get(boss.id);
    const isTaunted = this.isEnemyTaunted(boss.id);
    const tauntTargetId = isTaunted ? this.getEnemyTauntTarget(boss.id) : null;
    let targetPlayer = null;
    let maxDamage = 0;
    let topDamagePlayerId = null;

    damageMap.forEach((damage, playerId) => {
      const player = players.find((p) => p.id === playerId);
      if (!player || player.health <= 0) return;
      let effectiveDamage = damage;
      if (isTaunted && playerId === tauntTargetId) {
        effectiveDamage += 10000;
      }
      if (effectiveDamage > maxDamage) {
        maxDamage = effectiveDamage;
        topDamagePlayerId = playerId;
        targetPlayer = player;
      }
    });

    if (!targetPlayer || maxDamage === 0) {
      targetPlayer = this.findClosestPlayer(boss, players);
    } else if (targetPlayer && (!boss.currentTarget || boss.currentTarget !== topDamagePlayerId)) {
      boss.currentTarget = topDamagePlayerId;
    }

    return targetPlayer;
  }

  updateBoss2AI(boss, players) {
    if (!this.bossDamageTracking.has(boss.id)) {
      this.bossDamageTracking.set(boss.id, new Map());
    }
    if (!this.bossSpawnTime.has(boss.id)) {
      this.bossSpawnTime.set(boss.id, boss.spawnedAt || Date.now());
    }

    const now = Date.now();
    const targetPlayer = this.getBossThreatTarget(boss, players);
    if (!targetPlayer) return;

    this.updateBossRotation(boss, targetPlayer);

    const lockUntil = this.boss2ArchonLightningLockUntil.get(boss.id) || 0;
    if (now < lockUntil) {
      boss.bossStationary = true;
      return;
    }

    const distance = this.calculateDistance(boss.position, targetPlayer.position);
    const lastLightning = this.boss2ArchonLightningCooldown.get(boss.id) || 0;
    if (distance <= BOSS2_ARCHON_LIGHTNING_RANGE && now - lastLightning >= BOSS2_ARCHON_LIGHTNING_COOLDOWN_MS) {
      this.boss2StartArchonLightning(boss, targetPlayer);
      boss.bossStationary = true;
      return;
    }

    const lastBlink = this.boss2BlinkCooldown.get(boss.id) || 0;
    if (distance > 5 && now - lastBlink >= BOSS2_BLINK_COOLDOWN_MS) {
      this.boss2BlinkCooldown.set(boss.id, now);
      this.boss2CastBlink(boss, targetPlayer);
      boss.bossStationary = false;
      return;
    }

    if (distance > 6.5) {
      this.moveEnemyTowardsTarget(boss, targetPlayer);
      boss.bossStationary = false;
    } else {
      boss.bossStationary = true;
    }
  }

  updateBoss3AI(boss, players) {
    if (!this.bossDamageTracking.has(boss.id)) {
      this.bossDamageTracking.set(boss.id, new Map());
    }
    if (!this.bossSpawnTime.has(boss.id)) {
      this.bossSpawnTime.set(boss.id, boss.spawnedAt || Date.now());
    }

    const now = Date.now();

    const targetPlayer = this.getBossThreatTarget(boss, players);
    if (!targetPlayer) {
      const moved = boss.position.x * boss.position.x + boss.position.z * boss.position.z >= BOSS_STATIONARY_EPS * BOSS_STATIONARY_EPS;
      boss.bossStationary = !moved;
      return;
    }

    this.updateBossRotation(boss, targetPlayer);

    const lockUntilBoss = this.boss3LockUntil.get(boss.id) || 0;
    if (now < lockUntilBoss) {
      boss.bossStationary = true;
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-moved', {
          enemyId: boss.id,
          position: boss.position,
          rotation: boss.rotation,
          timestamp: Date.now(),
        });
      }
      return;
    }

    const ox = boss.position.x;
    const oz = boss.position.z;
    const dCenter = Math.hypot(ox, oz);

    if (dCenter > BOSS3_CENTER_HOLD_DIST) {
      this.moveBossTowardPoint(boss, 0, 0);
      boss.bossStationary = false;
      return;
    }

    boss.bossStationary = true;

    let charges = boss.summonChargesLeft;
    if (charges === undefined || charges === null) charges = 2;

    const lastSummonTime = this.weaverSummonCooldown.get(boss.id) || 0;
    const summonCooldown = 30000;
    const activeGhoulId = this.weaverSummonedGhouls.get(boss.id);
    const ghoulAlive =
      activeGhoulId &&
      this.room?.enemies.has(activeGhoulId) &&
      !this.room?.enemies.get(activeGhoulId)?.isDying;

    const canSummon =
      charges > 0 &&
      !ghoulAlive &&
      now - lastSummonTime >= summonCooldown &&
      !(this.boss3NovaWindupTimeout.has(boss.id) || this.boss3NovaSweepInterval.has(boss.id));

    if (canSummon) {
      boss.summonChargesLeft = charges - 1;
      this.weaverSummonCooldown.set(boss.id, now);
      this.weaverCastSummon(boss);
      this.boss3LockUntil.set(boss.id, now + BOSS3_SUMMON_CAST_MS);
      console.log(`🕸 Boss3 ${boss.id} summons ghoul (charges left ${boss.summonChargesLeft}).`);
      return;
    }

    const lastNova = this.boss3NovaLastRelease.get(boss.id);
    const novaReady =
      lastNova === undefined || lastNova === null || now - lastNova >= BOSS3_NOVA_COOLDOWN_MS;
    const castingBlocked = this.boss3NovaWindupTimeout.has(boss.id) || this.boss3NovaSweepInterval.has(boss.id);

    if (!castingBlocked && novaReady) {
      this.boss3StartNovaWindup(boss, targetPlayer, now);
    }
  }

  boss3StartNovaWindup(boss, targetPlayer, startedAt) {
    if (!this.room) return;

    const oldT = this.boss3NovaWindupTimeout.get(boss.id);
    if (oldT) clearTimeout(oldT);

    if (this.io) {
      this.io.to(this.roomId).emit('boss3-nova-start', {
        bossId: boss.id,
        timestamp: startedAt,
        windupMs: BOSS3_NOVA_WINDUP_MS,
      });
    }

    const travelEndAt = startedAt + BOSS3_NOVA_WINDUP_MS + BOSS3_NOVA_TRAVEL_MS;
    this.boss3LockUntil.set(boss.id, travelEndAt);

    const windupTimer = setTimeout(() => {
      const live = this.room?.enemies?.get(boss.id);
      const players = this.room?.getPlayers();
      if (
        !live ||
        live.isDying ||
        live.health <= 0 ||
        live.type !== 'boss3' ||
        !players
      ) {
        this.boss3NovaWindupTimeout.delete(boss.id);
        return;
      }

      const tx =
        typeof targetPlayer?.position?.x === 'number' ? targetPlayer.position.x : live.position.x;
      const tz =
        typeof targetPlayer?.position?.z === 'number' ? targetPlayer.position.z : live.position.z;

      const ox = live.position.x;
      const oz = live.position.z;
      const rdx = tx - ox;
      const rdz = tz - oz;
      const baseAngle = Math.atan2(rdx, rdz);

      const dirs = [0, 1, 2].map(k => ({
        ux: Math.sin(baseAngle + (k * Math.PI * 2) / 3),
        uz: Math.cos(baseAngle + (k * Math.PI * 2) / 3),
      }));

      const releasedAt = Date.now();
      this.boss3NovaLastRelease.set(live.id, releasedAt);

      if (this.io) {
        this.io.to(this.roomId).emit('boss3-nova-release', {
          bossId: live.id,
          origin: { x: ox, z: oz },
          baseAngle,
          directions: dirs,
          maxRange: BOSS3_NOVA_MAX_RANGE,
          travelMs: BOSS3_NOVA_TRAVEL_MS,
          damage: BOSS3_NOVA_DAMAGE,
          timestamp: releasedAt,
        });
      }

      const hitSets = [new Set(), new Set(), new Set()];
      const STEP_MS = Math.max(30, Math.floor(BOSS3_NOVA_TRAVEL_MS / BOSS3_NOVA_STEPS));
      let step = 0;

      const tick = () => {
        const b = this.room?.enemies?.get(live.id);
        const pls = this.room?.getPlayers();
        step += 1;
        if (
          step > BOSS3_NOVA_STEPS ||
          !this.room?.getGameStarted() ||
          !b ||
          b.isDying ||
          b.health <= 0 ||
          !pls
        ) {
          const iv = this.boss3NovaSweepInterval.get(live.id);
          if (iv) clearInterval(iv);
          this.boss3NovaSweepInterval.delete(live.id);
          return;
        }

        const R = BOSS3_NOVA_MAX_RANGE;
        for (let r = 0; r < 3; r += 1) {
          const { ux, uz } = dirs[r];
          const frac0 = (step - 1) / BOSS3_NOVA_STEPS;
          const frac1 = step / BOSS3_NOVA_STEPS;
          const ax = ox + ux * frac0 * R;
          const az = oz + uz * frac0 * R;
          const bx = ox + ux * frac1 * R;
          const bz = oz + uz * frac1 * R;
          this.room.damagePlayersInLineSegmentFirstHit(
            ax,
            az,
            bx,
            bz,
            BOSS3_NOVA_HALF_WIDTH,
            BOSS3_NOVA_DAMAGE,
            'boss3_arcane_disc',
            hitSets[r],
          );
        }

        if (step >= BOSS3_NOVA_STEPS) {
          const iv = this.boss3NovaSweepInterval.get(live.id);
          if (iv) clearInterval(iv);
          this.boss3NovaSweepInterval.delete(live.id);
        }
      };

      const intervalId = setInterval(tick, STEP_MS);
      this.boss3NovaSweepInterval.set(live.id, intervalId);
      this.boss3NovaWindupTimeout.delete(live.id);
      tick();

      console.log(`🕸 Boss3 ${live.id} arcane nova released — 3 discs.`);
    }, BOSS3_NOVA_WINDUP_MS);

    this.boss3NovaWindupTimeout.set(boss.id, windupTimer);
  }

  boss2CastBlink(boss, targetPlayer) {
    const startPosition = { ...boss.position };
    const dx = targetPlayer.position.x - boss.position.x;
    const dz = targetPlayer.position.z - boss.position.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len === 0) return;

    const blinkDist = Math.min(6, Math.max(0, len - 5));
    let endPosition = {
      x: boss.position.x + (dx / len) * blinkDist,
      y: boss.position.y,
      z: boss.position.z + (dz / len) * blinkDist,
    };
    endPosition = this.resolveEnemyWallCollisions(endPosition.x, endPosition.z);
    endPosition.y = boss.position.y;

    boss.position.x = endPosition.x;
    boss.position.y = endPosition.y;
    boss.position.z = endPosition.z;

    const rotDx = targetPlayer.position.x - endPosition.x;
    const rotDz = targetPlayer.position.z - endPosition.z;
    boss.rotation = Math.atan2(rotDx, rotDz);

    if (this.io) {
      this.io.to(this.roomId).emit('warlock-blink-telegraph', {
        warlockId: boss.id,
        startPosition,
        endPosition,
        rotation: boss.rotation,
        timestamp: Date.now(),
      });
      this.io.to(this.roomId).emit('enemy-moved', {
        enemyId: boss.id,
        position: boss.position,
        rotation: boss.rotation,
        timestamp: Date.now(),
      });
    }
  }

  boss2StartArchonLightning(boss, targetPlayer) {
    const now = Date.now();
    const strikeAt = now + BOSS2_ARCHON_LIGHTNING_WINDUP_MS;
    this.boss2ArchonLightningCooldown.set(boss.id, now);
    this.boss2ArchonLightningLockUntil.set(boss.id, strikeAt + 300);

    let comboPhase = this.boss2ArchonLightningComboPhase.get(boss.id);
    if (comboPhase === undefined || comboPhase === null) comboPhase = 0;

    const sx = boss.position.x;
    const sz = boss.position.z;
    const ty = targetPlayer.position.y + 1.1;
    const tx = targetPlayer.position.x;
    const tz = targetPlayer.position.z;
    const bossSkyY = boss.position.y + 3.0;

    /** @type {{ startPosition: { x: number; y: number; z: number }; targetPosition: { x: number; y: number; z: number } }[]} */
    let beams = [];

    if (comboPhase === 0) {
      beams = [
        {
          startPosition: { x: sx, y: bossSkyY, z: sz },
          targetPosition: { x: tx, y: ty, z: tz },
        },
      ];
    } else if (comboPhase === 1) {
      const rdx = tx - sx;
      const rdz = tz - sz;
      const dist = Math.hypot(rdx, rdz) || 1e-6;
      const fwx = rdx / dist;
      const fwz = rdz / dist;
      const perpx = -fwz;
      const perpz = fwx;
      const crossHalfLen = Math.min(
        BOSS2_ARCHON_LIGHTNING_RANGE,
        Math.max(dist, BOSS2_ARCHON_LIGHTNING_CROSS_HALF_MIN),
      );
      const bx1 = tx - perpx * crossHalfLen;
      const bz1 = tz - perpz * crossHalfLen;
      const bx2 = tx + perpx * crossHalfLen;
      const bz2 = tz + perpz * crossHalfLen;
      beams = [
        {
          startPosition: { x: sx, y: bossSkyY, z: sz },
          targetPosition: { x: tx, y: ty, z: tz },
        },
        {
          startPosition: { x: bx1, y: ty, z: bz1 },
          targetPosition: { x: bx2, y: ty, z: bz2 },
        },
      ];
    } else {
      const rdx = tx - sx;
      const rdz = tz - sz;
      const baseAngle = Math.atan2(rdx, rdz);
      const R = BOSS2_ARCHON_LIGHTNING_RANGE;
      const deltas = [0, Math.PI / 6, -Math.PI / 6];
      beams = deltas.map((delta) => {
        const ang = baseAngle + delta;
        const endx = sx + Math.sin(ang) * R;
        const endz = sz + Math.cos(ang) * R;
        return {
          startPosition: { x: sx, y: bossSkyY, z: sz },
          targetPosition: { x: endx, y: ty, z: endz },
        };
      });
    }

    const startPosition = beams[0].startPosition;
    const targetPosition = beams[0].targetPosition;

    this.boss2ArchonLightningComboPhase.set(boss.id, (comboPhase + 1) % 3);

    if (this.io) {
      this.io.to(this.roomId).emit('boss2-archon-lightning', {
        bossId: boss.id,
        startPosition,
        targetPosition,
        beams,
        strikeAt,
        halfWidth: BOSS2_ARCHON_LIGHTNING_HALF_WIDTH,
        damage: BOSS2_ARCHON_LIGHTNING_DAMAGE,
        timestamp: now,
      });
    }

    const segmentsXZ = beams.map((b) => ({
      ax: b.startPosition.x,
      az: b.startPosition.z,
      bx: b.targetPosition.x,
      bz: b.targetPosition.z,
    }));

    const handle = setTimeout(() => {
      this.boss2ArchonLightningTimeout.delete(boss.id);
      const liveBoss = this.room?.enemies?.get(boss.id);
      if (!liveBoss || liveBoss.isDying || liveBoss.health <= 0) return;
      if (!this.room) return;
      for (let i = 0; i < segmentsXZ.length; i += 1) {
        const seg = segmentsXZ[i];
        this.room.damagePlayersInLineSegment(
          seg.ax,
          seg.az,
          seg.bx,
          seg.bz,
          BOSS2_ARCHON_LIGHTNING_HALF_WIDTH,
          BOSS2_ARCHON_LIGHTNING_DAMAGE,
          'boss2_archon_lightning',
        );
      }
    }, BOSS2_ARCHON_LIGHTNING_WINDUP_MS);

    const oldHandle = this.boss2ArchonLightningTimeout.get(boss.id);
    if (oldHandle) clearTimeout(oldHandle);
    this.boss2ArchonLightningTimeout.set(boss.id, handle);
  }

  updateBossAI(boss, players) {
    if (!this.bossDamageTracking.has(boss.id)) {
      this.bossDamageTracking.set(boss.id, new Map());
    }
    if (!this.bossSpawnTime.has(boss.id)) {
      this.bossSpawnTime.set(boss.id, boss.spawnedAt || Date.now());
    }

    const now = Date.now();
    const lastPos = this.bossLastAiPos.get(boss.id);
    this.bossLastAiPos.set(boss.id, { x: boss.position.x, z: boss.position.z });

    const tectonic = this.bossTectonicData.get(boss.id);
    if (tectonic) {
      if (tectonic.phase === 'move') {
        const d = this.calculateDistance(boss.position, BOSS_TECTONIC_CENTER);
        const forwardR = rotationYTowardEntry(0, 0);
        const cur = boss.rotation || 0;
        let rDiff = forwardR - cur;
        while (rDiff > Math.PI) rDiff -= Math.PI * 2;
        while (rDiff < -Math.PI) rDiff += Math.PI * 2;
        const deltaTime = this.updateInterval / 1000;
        boss.rotation = cur + rDiff * Math.min(1, 4.0 * deltaTime);
        if (d <= BOSS_TECTONIC_CENTER_DIST) {
          tectonic.phase = 'jumps';
          tectonic.jumpIndex = 0;
          tectonic.nextAt = now;
        } else {
          this.moveBossTowardPoint(boss, 0, 0);
        }
        boss.bossStationary = false;
        return;
      }
      if (tectonic.phase === 'jumps') {
        boss.rotation = rotationYTowardEntry(0, 0);
        if (now < tectonic.nextAt) {
          boss.bossStationary = false;
          return;
        }
        const idx = tectonic.jumpIndex;
        if (this.io) {
          this.io.to(this.roomId).emit('boss-tectonic-jump', {
            bossId: boss.id,
            index: idx,
            timestamp: now,
          });
          this.io.to(this.roomId).emit('enemy-moved', {
            enemyId: boss.id,
            position: boss.position,
            rotation: boss.rotation,
            timestamp: now,
          });
        }
        if (idx % 2 === 1) {
          const alive = players.filter((p) => p.health > 0);
          let landX = boss.position.x;
          let landZ = boss.position.z;
          if (alive.length) {
            const pick = alive[Math.floor(Math.random() * alive.length)];
            landX = pick.position.x;
            landZ = pick.position.z;
          }
          this.scheduleTectonicSpikeHit(boss, landX, landZ, idx, now);
        }
        tectonic.jumpIndex = idx + 1;
        if (idx + 1 >= BOSS_TECTONIC_JUMP_COUNT) {
          this.bossTectonicData.delete(boss.id);
          this.bossTectonicCooldown.set(boss.id, now);
        } else {
          tectonic.nextAt = now + BOSS_TECTONIC_JUMP_INTERVAL_MS;
        }
        boss.bossStationary = false;
        return;
      }
    }

    if (this.bossLeapEndAt.has(boss.id)) {
      const end = this.bossLeapEndAt.get(boss.id);
      const land = this.bossLeapLand.get(boss.id);
      const from = this.bossLeapFrom.get(boss.id);
      if (now < end && land && from) {
        const startTime = end - BOSS_LEAP_DURATION_MS;
        let u = (now - startTime) / BOSS_LEAP_DURATION_MS;
        if (u < 0) u = 0;
        if (u > 1) u = 1;
        const su = u * u * (3 - 2 * u);
        boss.position.x = from.x + (land.x - from.x) * su;
        boss.position.z = from.z + (land.z - from.z) * su;
        boss.rotation = Math.atan2(land.x - from.x, land.z - from.z);
        if (this.io) {
          this.io.to(this.roomId).emit('enemy-moved', {
            enemyId: boss.id,
            position: boss.position,
            rotation: boss.rotation,
            timestamp: Date.now(),
          });
        }
        boss.bossStationary = false;
        return;
      }
      if (now < end) {
        boss.bossStationary = false;
        return;
      }
      if (this.bossLeapLand.has(boss.id)) {
        this.bossCompleteLeap(boss.id);
      }
      return;
    }

    const bossMeleeLockUntil = this.meleeLockUntil.get(boss.id) || 0;
    if (now < bossMeleeLockUntil) {
      boss.bossStationary = true;
      return;
    }

    const damageMap = this.bossDamageTracking.get(boss.id);
    let targetPlayer = null;
    let maxDamage = 0;
    let topDamagePlayerId = null;
    const isTaunted = this.isEnemyTaunted(boss.id);
    const tauntTargetId = isTaunted ? this.getEnemyTauntTarget(boss.id) : null;

    damageMap.forEach((damage, playerId) => {
      const player = players.find((p) => p.id === playerId);
      if (!player || player.health <= 0) return;
      let effectiveDamage = damage;
      if (isTaunted && playerId === tauntTargetId) {
        effectiveDamage += 10000;
      }
      if (effectiveDamage > maxDamage) {
        maxDamage = effectiveDamage;
        topDamagePlayerId = playerId;
        targetPlayer = player;
      }
    });

    if (!targetPlayer || maxDamage === 0) {
      targetPlayer = this.findClosestPlayer(boss, players);
    } else if (targetPlayer && (!boss.currentTarget || boss.currentTarget !== topDamagePlayerId)) {
      boss.currentTarget = topDamagePlayerId;
    }

    if (
      !this.bossTectonicData.has(boss.id) &&
      !this.bossLeapEndAt.has(boss.id) &&
      !this.bossThrowEndAt.has(boss.id) &&
      boss.maxHealth > 0 &&
      boss.health / boss.maxHealth <= BOSS_TECTONIC_MAX_HP_PCT
    ) {
      const lastT = this.bossTectonicCooldown.get(boss.id);
      const tectonicReady = lastT == null || now - lastT >= BOSS_TECTONIC_COOLDOWN_MS;
      if (tectonicReady) {
        this.clearBossAggroForTectonic(boss);
        this.bossTectonicData.set(boss.id, { phase: 'move' });
        boss.bossStationary = false;
        return;
      }
    }

    if (!targetPlayer) {
      const moved = lastPos
        ? Math.hypot(boss.position.x - lastPos.x, boss.position.z - lastPos.z) >= BOSS_STATIONARY_EPS
        : true;
      boss.bossStationary = !moved;
      return;
    }

    const distance = this.calculateDistance(boss.position, targetPlayer.position);
    this.updateBossRotation(boss, targetPlayer);

    // Block all movement while the throw animation plays
    if (this.bossThrowEndAt.has(boss.id)) {
      boss.bossStationary = true;
      return;
    }

    if (distance > BOSS_MELEE_RANGE) {
      // Throw-spear ability: usable when > 5 units away and cooldown ready
      if (distance > BOSS_THROW_MIN_RANGE) {
        const lastThrow = this.bossThrowCooldown.get(boss.id);
        if (lastThrow == null || now - lastThrow >= BOSS_THROW_COOLDOWN_MS) {
          this.bossStartThrow(boss, targetPlayer);
          boss.bossStationary = true;
          return;
        }
      }

      const hpFrac = boss.maxHealth > 0 ? boss.health / boss.maxHealth : 1;
      const canLeap =
        hpFrac <= BOSS_LEAP_MAX_HP_PCT &&
        (this.bossLeapCooldown.get(boss.id) == null || now - (this.bossLeapCooldown.get(boss.id) || 0) >= BOSS_LEAP_COOLDOWN_MS) &&
        !this.bossLeapEndAt.has(boss.id);
      if (canLeap) {
        this.bossStartLeap(boss, targetPlayer);
        boss.bossStationary = false;
        return;
      }
      this.moveEnemyTowardsTarget(boss, targetPlayer);
    } else {
      const lastAttackTime = this.bossAttackCooldown.get(boss.id) || 0;
      if (now - lastAttackTime >= BOSS_MELEE_COOLDOWN_MS) {
        this.bossAttackPlayer(boss, targetPlayer);
        this.bossAttackCooldown.set(boss.id, now);
      }
    }

    const movedN = lastPos
      ? Math.hypot(boss.position.x - lastPos.x, boss.position.z - lastPos.z) >= BOSS_STATIONARY_EPS
      : true;
    boss.bossStationary = !movedN;
  }

  bossAttackPlayer(boss, player) {
    const isFacingTarget = this.isBossFacingTarget(boss, player);
    if (!isFacingTarget) return;

    const idx = this.bossMeleePatternIndex.get(boss.id) || 0;
    const meleeIndex = idx % 2;
    this.bossMeleePatternIndex.set(boss.id, idx + 1);
    const damage = BOSS_MELEE_DAMAGE;

    if (this.io) {
      this.io.to(this.roomId).emit('boss-attack', {
        bossId: boss.id,
        targetPlayerId: player.id,
        damage,
        position: boss.position,
        meleeIndex,
        timestamp: Date.now(),
      });
    }
    this.meleeLockUntil.set(boss.id, Date.now() + BOSS_MELEE_ATTACK_LOCK_MS);
    console.log(`🔥 Boss ${boss.id} attacked player ${player.id} for ${damage} damage (melee ${meleeIndex})`);
  }

  bossStartThrow(boss, targetPlayer) {
    const staleTarget = { x: targetPlayer.position.x, y: targetPlayer.position.y, z: targetPlayer.position.z };
    this.bossThrowTarget.set(boss.id, staleTarget);
    const endAt = Date.now() + BOSS_THROW_STATIONARY_MS;
    this.bossThrowEndAt.set(boss.id, endAt);

    if (this.io) {
      this.io.to(this.roomId).emit('boss-throw-start', {
        bossId: boss.id,
        position: { ...boss.position },
        timestamp: Date.now(),
      });
    }

    const t = setTimeout(() => {
      this.bossCompleteThrow(boss.id);
    }, BOSS_THROW_STATIONARY_MS);
    this.bossThrowTimeout.set(boss.id, t);
    console.log(`🗡️  Boss ${boss.id} starting throw at player ${targetPlayer.id}`);
  }

  bossCompleteThrow(bossId) {
    clearTimeout(this.bossThrowTimeout.get(bossId));
    this.bossThrowTimeout.delete(bossId);
    this.bossThrowEndAt.delete(bossId);

    const boss = this.room?.enemies?.get(bossId);
    const staleTarget = this.bossThrowTarget.get(bossId);
    this.bossThrowTarget.delete(bossId);

    if (!boss || boss.isDying || boss.health <= 0 || !staleTarget) return;

    this.bossThrowCooldown.set(bossId, Date.now());

    // Compute end position along the aim ray at max range
    const dx = staleTarget.x - boss.position.x;
    const dz = staleTarget.z - boss.position.z;
    const horiz = Math.sqrt(dx * dx + dz * dz) || 1e-6;
    const ndx = dx / horiz;
    const ndz = dz / horiz;
    const endPosition = {
      x: boss.position.x + ndx * BOSS_THROW_MAX_RANGE,
      y: boss.position.y,
      z: boss.position.z + ndz * BOSS_THROW_MAX_RANGE,
    };

    if (this.io) {
      this.io.to(this.roomId).emit('boss-throw-spear', {
        bossId,
        startPosition: { ...boss.position },
        targetPosition: staleTarget,
        endPosition,
        damage: BOSS_THROW_DAMAGE,
        maxRange: BOSS_THROW_MAX_RANGE,
        timestamp: Date.now(),
      });
    }
    console.log(`🗡️  Boss ${bossId} launched spear toward (${staleTarget.x.toFixed(1)}, ${staleTarget.z.toFixed(1)})`);
  }

  bossSummonSkeleton(boss) {
    if (!this.room) return;

    // Generate unique skeleton ID
    const skeletonId = `skeleton-${boss.id}-${Date.now()}`;

    // Position skeleton near boss (random offset)
    const angle = Math.random() * Math.PI * 2;
    const distance = 3 + Math.random() * 2; // 3-5 units away

    const skeletonPosition = {
      x: boss.position.x + Math.cos(angle) * distance,
      y: 0,
      z: boss.position.z + Math.sin(angle) * distance
    };

    // Create skeleton enemy object
    const skeleton = {
      id: skeletonId,
      type: 'boss-skeleton',
      position: skeletonPosition,
      rotation: rotationYTowardEntry(skeletonPosition.x, skeletonPosition.z),
      health: 666,
      maxHealth: 666,
      isDying: false,
      damage: 17,
      bossId: boss.id // Track which boss summoned this skeleton
    };

    // Add to boss's summoned skeletons set
    if (!this.bossSummonedSkeletons.has(boss.id)) {
      this.bossSummonedSkeletons.set(boss.id, new Set());
    }
    this.bossSummonedSkeletons.get(boss.id).add(skeletonId);

    // Add skeleton to room enemies through the game room
    this.room.addEnemy(skeleton);

    // Broadcast skeleton summon to all players
    if (this.io) {
      this.io.to(this.roomId).emit('boss-skeleton-summoned', {
        bossId: boss.id,
        skeleton: skeleton,
        timestamp: Date.now()
      });
    }

    console.log(`💀 Boss ${boss.id} summoned skeleton ${skeletonId} at position (${skeletonPosition.x.toFixed(2)}, ${skeletonPosition.z.toFixed(2)})`);
  }

  // Track when a boss skeleton is killed
  removeBossSkeleton(bossId, skeletonId) {
    const skeletons = this.bossSummonedSkeletons.get(bossId);
    if (skeletons) {
      skeletons.delete(skeletonId);
      console.log(`💀 Skeleton ${skeletonId} removed from boss ${bossId}'s summons (${skeletons.size}/2 remaining)`);
    }
  }

  // Track damage dealt to boss by each player
  trackBossDamage(bossId, playerId, damage, player = null) {
    if (!this.bossDamageTracking.has(bossId)) {
      this.bossDamageTracking.set(bossId, new Map());
    }

    const damageMap = this.bossDamageTracking.get(bossId);
    let effectiveDamage = damage;

    // Apply massive aggro multiplier for Sabres stealth attacks (similar to WraithStrike taunt)
    if (player && player.isStealthing) {
      const stealthMultiplier = 10.0; // 10x aggro generation while stealthing
      effectiveDamage *= stealthMultiplier;
      console.log(`👤 Stealth aggro bonus: Player ${playerId} stealth attack (${damage} damage) -> ${effectiveDamage} effective aggro`);
    }

    const currentDamage = damageMap.get(playerId) || 0;
    damageMap.set(playerId, currentDamage + effectiveDamage);

    console.log(`📊 Boss aggro - Player ${playerId} has dealt ${currentDamage + effectiveDamage} total damage to boss ${bossId}${player?.isStealthing ? ' (STEALTH BONUS)' : ''}`);
  }

  findClosestPlayer(enemy, players) {
    let closestPlayer = null;
    let closestDistance = Infinity;

    players.forEach(player => {
      // Skip dead players (health <= 0)
      if (player.health <= 0) {
        return;
      }

      const distance = this.calculateDistance(enemy.position, player.position);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPlayer = player;
      }
    });

    return closestPlayer;
  }

  // Update boss rotation to face target (called even when stationary)
  updateBossRotation(boss, targetPlayer) {
    if (!targetPlayer) return;
    
    // Calculate direction vector
    const direction = {
      x: targetPlayer.position.x - boss.position.x,
      y: 0, // Keep enemies on ground
      z: targetPlayer.position.z - boss.position.z
    };
    
    // Normalize direction
    const magnitude = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    if (magnitude === 0) return;
    
    direction.x /= magnitude;
    direction.z /= magnitude;
    
    // Calculate target rotation to face target
    const targetRotation = Math.atan2(direction.x, direction.z);
    
    // Get current rotation (initialize if needed)
    const currentRotation = boss.rotation || 0;
    
    // Calculate rotation difference and normalize to [-PI, PI]
    let rotationDiff = targetRotation - currentRotation;
    while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
    
    // Smooth rotation interpolation (4.0 rotation speed like Ascendant)
    const deltaTime = this.updateInterval / 1000; // Convert to seconds
    const rotationSpeed = 4.0; // Radians per second
    const rotationStep = rotationDiff * Math.min(1, rotationSpeed * deltaTime);
    
    // Apply smooth rotation
    boss.rotation = currentRotation + rotationStep;
    
    // Normalize final rotation to [-PI, PI]
    while (boss.rotation > Math.PI) boss.rotation -= Math.PI * 2;
    while (boss.rotation < -Math.PI) boss.rotation += Math.PI * 2;
    
    // Broadcast rotation update to all players
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-moved', {
        enemyId: boss.id,
        position: boss.position,
        rotation: boss.rotation,
        timestamp: Date.now()
      });
    }
  }

  getMeleeBodyRadius(type) {
    switch (type) {
      case 'knight': return 1.3;
      case 'templar':
      case 'ghoul':
        return 1.5;
      case 'martyr': return 1.1;
      default:
        return 1.4;
    }
  }

  /**
   * Ring point on the ray from player through this enemy so units spread around the target.
   */
  computeMeleeSurroundGoal(enemy, playerPos, attackRange) {
    const px = playerPos.x;
    const pz = playerPos.z;
    const ex = enemy.position.x;
    const ez = enemy.position.z;
    let rdx = ex - px;
    let rdz = ez - pz;
    let len = Math.sqrt(rdx * rdx + rdz * rdz);
    if (len < 1e-4) {
      const rot = enemy.rotation || 0;
      rdx = Math.sin(rot);
      rdz = Math.cos(rot);
      len = 1;
    } else {
      rdx /= len;
      rdz /= len;
    }
    const standoff = Math.max(
      MELEE_SURROUND_STANDOFF_MIN,
      Math.min(attackRange - MELEE_SURROUND_STANDOFF_MARGIN, attackRange * MELEE_SURROUND_STANDOFF_FRAC),
    );
    return {
      x: px + rdx * standoff,
      y: playerPos.y ?? 0,
      z: pz + rdz * standoff,
    };
  }

  /**
   * Push this enemy's proposed position away from other melee peers (2 passes).
   */
  resolveMeleePeerSeparation(selfEnemy, x, z) {
    if (!this.room || !MELEE_SURROUND_TYPES.has(selfEnemy.type)) {
      return { x, z };
    }
    const rSelf = this.getMeleeBodyRadius(selfEnemy.type);
    let rx = x;
    let rz = z;

    for (let iter = 0; iter < 2; iter++) {
      for (const other of this.room.getEnemies()) {
        if (!other || other.id === selfEnemy.id || other.isDying || other.health <= 0) continue;
        if (!MELEE_SURROUND_TYPES.has(other.type)) continue;

        const ox = other.position.x;
        const oz = other.position.z;
        let dx = rx - ox;
        let dz = rz - oz;
        let dist = Math.sqrt(dx * dx + dz * dz);
        const rOther = this.getMeleeBodyRadius(other.type);
        const minDist = rSelf + rOther + MELEE_PEER_SEP_PADDING;

        if (dist < 1e-6) {
          const s = (iter + (selfEnemy.id?.length || 0)) * 1.7;
          dx = Math.sin(s);
          dz = Math.cos(s);
          dist = 1;
        }
        if (dist < minDist) {
          const push = (minDist - dist) / dist;
          rx += dx * push;
          rz += dz * push;
        }
      }
    }

    return this.resolveEnemyWallCollisions(rx, rz);
  }

  moveEnemyTowardsTarget(enemy, targetPlayer, options = {}) {
    if (!targetPlayer) return;

    const meleeRange = options?.meleeSurroundAttackRange;
    const useSurround = meleeRange != null && MELEE_SURROUND_TYPES.has(enemy.type);

    let moveTarget = targetPlayer;
    if (useSurround) {
      const goal = this.computeMeleeSurroundGoal(enemy, targetPlayer.position, meleeRange);
      moveTarget = { position: goal, id: targetPlayer.id };
    }

    const distanceToGoal = this.calculateDistance(enemy.position, moveTarget.position);
    const baseSpeed = enemy.moveSpeed ?? this.getEnemyMoveSpeed(enemy.type);
    const moveSpeed = this.getModifiedMovementSpeed(enemy.id, baseSpeed);

    const stopThreshold = useSurround ? 0.18 : 2.0;
    if (distanceToGoal < stopThreshold || moveSpeed === 0) return;

    // Resolve next waypoint via A* when a wall blocks the direct path,
    // otherwise head straight to the target.
    const waypoint = this._getPathWaypoint(enemy, moveTarget);

    const dx = waypoint.x - enemy.position.x;
    const dz = waypoint.z - enemy.position.z;
    const mag = Math.sqrt(dx * dx + dz * dz);
    if (mag === 0) return;

    const dirX = dx / mag;
    const dirZ = dz / mag;

    const deltaTime   = this.updateInterval / 1000;
    const moveDistance = moveSpeed * deltaTime;

    const rawX = enemy.position.x + dirX * moveDistance;
    const rawZ = enemy.position.z + dirZ * moveDistance;

    let resolved = this.resolveEnemyWallCollisions(rawX, rawZ);
    if (useSurround) {
      resolved = this.resolveMeleePeerSeparation(enemy, resolved.x, resolved.z);
    }
    enemy.position.x = resolved.x;
    enemy.position.z = resolved.z;

    // Face the direction of travel
    enemy.rotation = Math.atan2(dirX, dirZ);

    if (this.io) {
      this.io.to(this.roomId).emit('enemy-moved', {
        enemyId:   enemy.id,
        position:  enemy.position,
        rotation:  enemy.rotation,
        timestamp: Date.now(),
      });
    }
  }

  // Get movement speed modified by status effects
  getModifiedMovementSpeed(enemyId, baseSpeed) {
    if (!this.room) return baseSpeed;
    
    let modifiedSpeed = baseSpeed;
    
    // Check for freeze effect - sets speed to 0
    if (this.room.isEnemyAffectedBy(enemyId, 'freeze')) {
      return 0;
    }

    // Check for stun effect - sets speed to 0
    if (this.room.isEnemyAffectedBy(enemyId, 'stun')) {
      return 0;
    }
    
    // Check for slow effect - reduces speed by 50%
    if (this.room.isEnemyAffectedBy(enemyId, 'slow')) {
      modifiedSpeed *= 0.5; // 50% speed
    }
    
    // Check for corrupted effect - gradually increasing slow
    if (this.room.isEnemyAffectedBy(enemyId, 'corrupted')) {
      const corruptedMultiplier = this.getCorruptedSlowMultiplier(enemyId);
      modifiedSpeed *= (1 - corruptedMultiplier);
    }

    if (this.room.getBlizzardChillMoveMultiplier) {
      modifiedSpeed *= this.room.getBlizzardChillMoveMultiplier(enemyId);
    }
    
    return Math.max(0, modifiedSpeed);
  }

  // Calculate corrupted debuff slow multiplier with gradual recovery
  getCorruptedSlowMultiplier(enemyId) {
    if (!this.room) return 0;
    
    const effects = this.room.getEnemyStatusEffects(enemyId);
    if (!effects.corrupted) return 0;
    
    // Get the status effect from room
    const corruptedExpiration = this.room.enemyStatusEffects.get(enemyId)?.corrupted;
    if (!corruptedExpiration) return 0;
    
    const now = Date.now();
    const totalDuration = 8000; // 8 seconds total duration
    const elapsed = totalDuration - (corruptedExpiration - now);
    
    // Initial: 90% slow, recovers 10% per second
    const initialSlowPercent = 0.8;
    const recoveryRate = 0.2; // 10% per second
    const elapsedSeconds = elapsed / 1000;
    
    const currentSlowPercent = Math.max(0, initialSlowPercent - (elapsedSeconds * recoveryRate));
    
    return currentSlowPercent;
  }

  getEnemyMoveSpeed(enemyType) {
    // Different enemy types have different movement speeds
    switch (enemyType) {
      case 'elite': return 0.0;   // Stationary training dummies
      case 'boss': return 2.35;
      case 'boss2': return 2.0;
      case 'boss3': return 2.0;
      case 'boss-skeleton': return 1.75;
      case 'shade':   return 2.0;
      case 'warlock': return 0.0; // Stationary — moves only via blink
      case 'viper':   return 2.0;
      case 'templar': return 3.0;
      case 'weaver':  return 2.0;
      case 'ghoul':   return 2;
      case 'martyr':  return 3.0;
      case 'player-zombie': return 2.0;
      default: return 2.0;
    }
  }

  countLivingPlayerZombies(ownerId) {
    const ids = this.playerZombiesByOwner.get(ownerId);
    if (!ids || ids.size === 0) return 0;
    let n = 0;
    for (const id of ids) {
      const e = this.room?.getEnemy(id);
      if (e && !e.isDying && e.health > 0) n++;
    }
    return n;
  }

  unregisterPlayerZombie(ownerId, zombieId) {
    const set = this.playerZombiesByOwner.get(ownerId);
    if (set) {
      set.delete(zombieId);
      if (set.size === 0) this.playerZombiesByOwner.delete(ownerId);
    }
    this.ghoulAttackCooldown.delete(zombieId);
    this.meleeLockUntil.delete(zombieId);
  }

  trySpawnInfestedZombie(ownerId, position) {
    if (!this.room || !ownerId) return;
    if (this.countLivingPlayerZombies(ownerId) >= 3) return;

    const zombieId = `player-zombie-${ownerId}-${Date.now()}`;
    const now = Date.now();
    const summonLockMs = INFESTED_ZOMBIE_SUMMON_LOCK_MS;
    const zombie = {
      id: zombieId,
      type: 'player-zombie',
      ownerPlayerId: ownerId,
      position: { x: position.x, y: position.y, z: position.z },
      rotation: rotationYTowardEntry(position.x, position.z),
      health: 250,
      maxHealth: 250,
      isDying: false,
      damage: 45,
      attackCooldown: 1000,
      moveSpeed: 0,
      expireAt: now + 30000,
      staggerBuildup: 0,
      summonUnlockAt: now + summonLockMs,
    };

    if (!this.playerZombiesByOwner.has(ownerId)) {
      this.playerZombiesByOwner.set(ownerId, new Set());
    }
    this.playerZombiesByOwner.get(ownerId).add(zombieId);

    this.room.addEnemy(zombie);

    if (this.io) {
      this.io.to(this.roomId).emit('enemy-spawned', {
        enemy: zombie,
        timestamp: Date.now(),
      });
      this.io.to(this.roomId).emit('infested-zombie-summon', {
        zombieId,
        position: { x: position.x, y: position.y, z: position.z },
        durationMs: summonLockMs,
        timestamp: Date.now(),
      });
    }

    setTimeout(() => {
      const spawned = this.room?.getEnemy(zombieId);
      if (spawned && !spawned.isDying && spawned.type === 'player-zombie') {
        spawned.moveSpeed = 1.75;
        spawned.summonUnlockAt = null;
      }
    }, summonLockMs);

    console.log(`🧟 Infested zombie ${zombieId} raised for player ${ownerId}`);
  }

  findNearestHostileForZombie(zombie) {
    if (!this.room) return null;
    let best = null;
    let bestD = Infinity;
    for (const e of this.room.getEnemies()) {
      if (!e || e.id === zombie.id || e.isDying) continue;
      if (e.type === 'player-zombie') continue;
      if (e.type === 'training-dummy') continue;
      if (e.health <= 0) continue;
      const d = this.calculateDistance(zombie.position, e.position);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  telegraphPlayerZombieAttack(zombie, targetEnemy) {
    if (this.io) {
      this.io.to(this.roomId).emit('player-zombie-attack-telegraph', {
        zombieId: zombie.id,
        targetEnemyId: targetEnemy.id,
        position: zombie.position,
        timestamp: Date.now(),
      });
    }
  }

  updatePlayerZombieAI(zombie, players) {
    const now = Date.now();
    if (zombie.expireAt && now >= zombie.expireAt && !zombie.isDying) {
      zombie.isDying = true;
      const zid = zombie.id;
      const ownerId = zombie.ownerPlayerId;
      setTimeout(() => {
        if (!this.room?.getGameStarted()) return;
        if (this.room?.enemies.has(zid)) {
          this.room.enemies.delete(zid);
          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', { enemyId: zid, timestamp: Date.now() });
          }
        }
        this.clearZombieAsAggroTarget(zid);
        this.removeEnemyAggro(zid);
        this.unregisterPlayerZombie(ownerId, zid);
      }, 400);
      return;
    }
    if (zombie.isDying) return;

    if (zombie.summonUnlockAt && now < zombie.summonUnlockAt) return;

    const hostile = this.findNearestHostileForZombie(zombie);
    const attackRange = 2.4;
    const attackCooldown = zombie.attackCooldown ?? 1500;
    const lockUntil = this.meleeLockUntil.get(zombie.id) || 0;
    if (now < lockUntil) return;

    if (hostile) {
      const distance = this.calculateDistance(zombie.position, hostile.position);
      const meleePressDistance = attackRange - MELEE_CLOSE_INSET;

      if (distance <= attackRange) {
        if (!this.ghoulAttackCooldown.has(zombie.id)) {
          this.ghoulAttackCooldown.set(zombie.id, 0);
        }
        const lastAttackTime = this.ghoulAttackCooldown.get(zombie.id);
        if (now - lastAttackTime >= attackCooldown) {
          this.ghoulAttackCooldown.set(zombie.id, now);
          const SWING_LOCK_MS = 1200;
          this.meleeLockUntil.set(zombie.id, now + SWING_LOCK_MS);
          this.telegraphPlayerZombieAttack(zombie, hostile);

          setTimeout(() => {
            if (zombie.isDying || !this.room?.getGameStarted()) return;
            const liveHostile = this.room?.getEnemy(hostile.id);
            if (!liveHostile || liveHostile.isDying || liveHostile.health <= 0) return;
            const currentDist = this.calculateDistance(zombie.position, liveHostile.position);
            if (currentDist <= attackRange + 0.5) {
              const dmg = zombie.damage || 32;
              this.room.damageEnemy(liveHostile.id, dmg, zombie.ownerPlayerId, null, {
                sourceZombieId: zombie.id,
              });
            }
          }, 700);
        } else if (distance > meleePressDistance) {
          this.moveEnemyTowardsTarget(zombie, { position: hostile.position, id: hostile.id });
        }
      } else {
        this.moveEnemyTowardsTarget(zombie, { position: hostile.position, id: hostile.id });
      }
    } else {
      const owner = players.find((p) => p.id === zombie.ownerPlayerId);
      if (owner && owner.health > 0) {
        this.moveEnemyTowardsTarget(zombie, owner);
      }
    }
  }

  // ─── Navigation / A* pathfinding ──────────────────────────────────────────

  /**
   * Build (once) a flat Uint8Array representing the nav grid.
   * 0 = passable, 1 = blocked.  Walls are expanded by NAV_ENEMY_RADIUS so that
   * enemy centres never clip geometry.
   */
  _buildNavGrid() {
    const grid = new Uint8Array(NAV_COLS * NAV_ROWS);
    for (let row = 0; row < NAV_ROWS; row++) {
      for (let col = 0; col < NAV_COLS; col++) {
        const wx = NAV_MIN_X + (col + 0.5) * NAV_CELL_SIZE;
        const wz = NAV_MIN_Z + (row + 0.5) * NAV_CELL_SIZE;
        for (const seg of WALL_SEGMENTS) {
          if (
            Math.abs(wx - seg.center[0]) < seg.sizeX / 2 + NAV_ENEMY_RADIUS &&
            Math.abs(wz - seg.center[2]) < seg.sizeZ / 2 + NAV_ENEMY_RADIUS
          ) {
            grid[row * NAV_COLS + col] = 1;
            break;
          }
        }
      }
    }
    return grid;
  }

  _worldToGrid(wx, wz) {
    return {
      col: Math.max(0, Math.min(NAV_COLS - 1, Math.floor((wx - NAV_MIN_X) / NAV_CELL_SIZE))),
      row: Math.max(0, Math.min(NAV_ROWS - 1, Math.floor((wz - NAV_MIN_Z) / NAV_CELL_SIZE))),
    };
  }

  _gridToWorld(col, row) {
    return {
      x: NAV_MIN_X + (col + 0.5) * NAV_CELL_SIZE,
      z: NAV_MIN_Z + (row + 0.5) * NAV_CELL_SIZE,
    };
  }

  /**
   * A* on the nav grid.  Returns an array of world-space {x,z} waypoints from
   * the cell after start up to and including the goal cell, or null if no path
   * exists.  8-directional movement; diagonal moves are blocked when either
   * adjacent cardinal neighbour is solid (no corner-cutting).
   */
  _findPathAStar(startX, startZ, goalX, goalZ) {
    if (!this.navGrid) this.navGrid = this._buildNavGrid();
    const grid = this.navGrid;

    const { col: sc, row: sr } = this._worldToGrid(startX, startZ);
    const { col: gc, row: gr } = this._worldToGrid(goalX, goalZ);

    if (sc === gc && sr === gr) return [];

    const cellCount = NAV_COLS * NAV_ROWS;
    const gScore   = new Float32Array(cellCount).fill(Infinity);
    const cameFrom = new Int32Array(cellCount).fill(-1);
    const inOpen   = new Uint8Array(cellCount);

    const heuristic = (c, r) => Math.sqrt((c - gc) ** 2 + (r - gr) ** 2);

    // Min-heap keyed on f = g + h
    const heap = [];
    const heapPush = (node) => {
      heap.push(node);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p].f <= heap[i].f) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const heapPop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length > 0) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = 2 * i + 2;
          let m = i;
          if (l < heap.length && heap[l].f < heap[m].f) m = l;
          if (r < heap.length && heap[r].f < heap[m].f) m = r;
          if (m === i) break;
          [heap[i], heap[m]] = [heap[m], heap[i]];
          i = m;
        }
      }
      return top;
    };

    const startIdx = sr * NAV_COLS + sc;
    gScore[startIdx] = 0;
    inOpen[startIdx] = 1;
    heapPush({ col: sc, row: sr, f: heuristic(sc, sr) });

    // 8 directions: [dCol, dRow, moveCost]
    const DIRS = [
      [ 0, -1, 1], [ 0,  1, 1], [-1,  0, 1], [ 1,  0, 1],
      [-1, -1, 1.414], [-1,  1, 1.414], [ 1, -1, 1.414], [ 1,  1, 1.414],
    ];

    let goalFound = false;

    while (heap.length > 0) {
      const { col: cc, row: cr } = heapPop();
      const ci = cr * NAV_COLS + cc;
      inOpen[ci] = 0;

      if (cc === gc && cr === gr) { goalFound = true; break; }

      for (const [dc, dr, cost] of DIRS) {
        const nc = cc + dc, nr = cr + dr;
        if (nc < 0 || nc >= NAV_COLS || nr < 0 || nr >= NAV_ROWS) continue;
        const ni = nr * NAV_COLS + nc;
        if (grid[ni] === 1) continue;
        // No corner-cutting for diagonal moves
        if (dc !== 0 && dr !== 0) {
          if (grid[cr * NAV_COLS + (cc + dc)] === 1) continue;
          if (grid[(cr + dr) * NAV_COLS + cc] === 1) continue;
        }
        const tentG = gScore[ci] + cost;
        if (tentG < gScore[ni]) {
          cameFrom[ni] = ci;
          gScore[ni] = tentG;
          if (!inOpen[ni]) {
            inOpen[ni] = 1;
            heapPush({ col: nc, row: nr, f: tentG + heuristic(nc, nr) });
          }
        }
      }
    }

    if (!goalFound) return null;

    // Reconstruct path (world-space waypoints, excluding the start cell)
    const path = [];
    let cur = gr * NAV_COLS + gc;
    const startI = sr * NAV_COLS + sc;
    while (cur !== startI) {
      const c = cur % NAV_COLS;
      const r = Math.floor(cur / NAV_COLS);
      path.push(this._gridToWorld(c, r));
      const prev = cameFrom[cur];
      if (prev < 0) break;
      cur = prev;
    }
    path.reverse();
    return path;
  }

  /**
   * Returns the world-space position the enemy should move TOWARD this tick.
   * When line-of-sight to the player is clear the player position is returned
   * directly (no grid overhead).  Otherwise a cached A* path is used and
   * recomputed only when the player moves significantly.
   */
  _getPathWaypoint(enemy, targetPlayer) {
    const tx = targetPlayer.position.x;
    const tz = targetPlayer.position.z;

    // Direct walk — no pathfinding needed
    if (this.hasLineOfSight(enemy.position, targetPlayer.position)) {
      this.enemyPaths.delete(enemy.id);
      return targetPlayer.position;
    }

    const cached = this.enemyPaths.get(enemy.id);

    // Decide whether to recompute
    let needsRecompute = !cached || !cached.waypoints || cached.wpIndex >= cached.waypoints.length;
    if (!needsRecompute) {
      const ltp = cached.lastTargetPos;
      if (Math.sqrt((tx - ltp.x) ** 2 + (tz - ltp.z) ** 2) > NAV_RECOMPUTE_DIST) {
        needsRecompute = true;
      }
    }

    if (needsRecompute) {
      const wp = this._findPathAStar(enemy.position.x, enemy.position.z, tx, tz);
      this.enemyPaths.set(enemy.id, {
        waypoints:     wp || [],
        wpIndex:       0,
        lastTargetPos: { x: tx, z: tz },
      });
    }

    const state = this.enemyPaths.get(enemy.id);
    if (!state.waypoints || state.waypoints.length === 0) {
      return targetPlayer.position; // no path found — try direct anyway
    }

    // Advance past waypoints the enemy has already reached
    const ex = enemy.position.x, ez = enemy.position.z;
    while (state.wpIndex < state.waypoints.length - 1) {
      const wp = state.waypoints[state.wpIndex];
      if (Math.sqrt((ex - wp.x) ** 2 + (ez - wp.z) ** 2) < NAV_WAYPOINT_REACH) {
        state.wpIndex++;
      } else {
        break;
      }
    }

    if (state.wpIndex >= state.waypoints.length) {
      return targetPlayer.position;
    }

    return state.waypoints[state.wpIndex];
  }

  /**
   * 2-D ray-AABB slab test (XZ plane only).
   * Returns true when the straight line from posA to posB is not blocked by
   * any castle wall segment, false if at least one wall intersects the segment.
   */
  hasLineOfSight(posA, posB) {
    const ox = posA.x;
    const oz = posA.z;
    const dx = posB.x - posA.x;
    const dz = posB.z - posA.z;

    for (const seg of WALL_SEGMENTS) {
      const halfX = seg.sizeX / 2;
      const halfZ = seg.sizeZ / 2;
      const bx0   = seg.center[0] - halfX;
      const bx1   = seg.center[0] + halfX;
      const bz0   = seg.center[2] - halfZ;
      const bz1   = seg.center[2] + halfZ;

      let tmin = 0;
      let tmax = 1;

      // X-axis slab
      if (Math.abs(dx) < 1e-10) {
        if (ox < bx0 || ox > bx1) continue; // parallel and outside
      } else {
        const tx1 = (bx0 - ox) / dx;
        const tx2 = (bx1 - ox) / dx;
        tmin = Math.max(tmin, Math.min(tx1, tx2));
        tmax = Math.min(tmax, Math.max(tx1, tx2));
        if (tmax < tmin) continue;
      }

      // Z-axis slab
      if (Math.abs(dz) < 1e-10) {
        if (oz < bz0 || oz > bz1) continue;
      } else {
        const tz1 = (bz0 - oz) / dz;
        const tz2 = (bz1 - oz) / dz;
        tmin = Math.max(tmin, Math.min(tz1, tz2));
        tmax = Math.min(tmax, Math.max(tz1, tz2));
      }

      if (tmax >= tmin && tmin <= 1 && tmax >= 0) {
        return false; // wall blocks the path
      }
    }

    return true;
  }

  /**
   * AABB push-out: resolves an enemy's proposed (x, z) position against every
   * castle wall segment.  The enemy is treated as a small box of half-width
   * ENEMY_RADIUS.  On overlap the enemy is pushed out along the axis of
   * minimum penetration, which naturally produces wall-sliding behaviour when
   * called every frame.
   */
  resolveEnemyWallCollisions(x, z) {
    const ENEMY_RADIUS = 0.5;
    let rx = x;
    let rz = z;

    for (const seg of WALL_SEGMENTS) {
      const halfX = seg.sizeX / 2 + ENEMY_RADIUS;
      const halfZ = seg.sizeZ / 2 + ENEMY_RADIUS;
      const relX  = rx - seg.center[0];
      const relZ  = rz - seg.center[2];

      if (Math.abs(relX) < halfX && Math.abs(relZ) < halfZ) {
        const overlapX = halfX - Math.abs(relX);
        const overlapZ = halfZ - Math.abs(relZ);

        if (overlapX < overlapZ) {
          rx += relX >= 0 ? overlapX : -overlapX;
        } else {
          rz += relZ >= 0 ? overlapZ : -overlapZ;
        }
      }
    }

    if (this.room && this.room.coopBossThroneArena) {
      const len = Math.hypot(rx, rz);
      if (len > COOP_BOSS_THRONE_ARENA_CLAMP_R) {
        const s = COOP_BOSS_THRONE_ARENA_CLAMP_R / len;
        rx *= s;
        rz *= s;
      }
    }

    return { x: rx, z: rz };
  }

  calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Check if boss is facing the target within a reasonable angle tolerance
  isBossFacingTarget(boss, player) {
    // Calculate the angle from boss to player
    const direction = {
      x: player.position.x - boss.position.x,
      z: player.position.z - boss.position.z
    };

    // Calculate target angle (same logic as moveEnemyTowardsTarget)
    const targetAngle = Math.atan2(direction.x, direction.z);

    // Get the boss's current facing angle
    const bossAngle = boss.rotation || 0;

    // Calculate the angle difference
    let angleDiff = targetAngle - bossAngle;

    // Normalize angle difference to [-π, π]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    // Get absolute angle difference
    const absAngleDiff = Math.abs(angleDiff);

    // Boss can attack if within 45 degrees (π/4 radians) of facing the target
    const facingTolerance = Math.PI / 4; // 45 degrees (90 degree cone total)

    const isFacing = absAngleDiff <= facingTolerance;
    
    // Debug log when boss tries to attack but isn't facing target
    if (!isFacing) {
      const angleDegrees = (absAngleDiff * 180 / Math.PI).toFixed(1);
      console.log(`🔄 Boss ${boss.id} rotating to face target (${angleDegrees}° off)`);
    }

    return isFacing;
  }

  // Remove enemy from aggro tracking when it dies
  removeEnemyAggro(enemyId) {
    const tst = this.tentacleSlamTimeouts.get(enemyId);
    if (tst) {
      clearTimeout(tst);
      this.tentacleSlamTimeouts.delete(enemyId);
    }
    this.enemyAggro.delete(enemyId);
    this.bossDamageTracking.delete(enemyId);
    this.bossAttackCooldown.delete(enemyId);
    this.bossSpawnTime.delete(enemyId);
    this.bossLeapCooldown.delete(enemyId);
    this.bossTectonicCooldown.delete(enemyId);
    this.bossMeleePatternIndex.delete(enemyId);
    this.bossTectonicData.delete(enemyId);
    this.clearTectonicSpikePendingTimeoutsForBoss(enemyId);
    this.bossLeapEndAt.delete(enemyId);
    this.bossLeapLand.delete(enemyId);
    this.bossLeapFrom.delete(enemyId);
    this.bossLastAiPos.delete(enemyId);
    const leapT = this.bossLeapTimeout.get(enemyId);
    if (leapT) clearTimeout(leapT);
    this.bossLeapTimeout.delete(enemyId);
    this.bossSkeletonSummonCooldown.delete(enemyId);
    this.bossSummonedSkeletons.delete(enemyId);
    this.boss2ArchonLightningCooldown.delete(enemyId);
    this.boss2ArchonLightningLockUntil.delete(enemyId);
    const archonT = this.boss2ArchonLightningTimeout.get(enemyId);
    if (archonT) clearTimeout(archonT);
    this.boss2ArchonLightningTimeout.delete(enemyId);
    this.boss2ArchonLightningComboPhase.delete(enemyId);
    this.boss2BlinkCooldown.delete(enemyId);
    const b3wup = this.boss3NovaWindupTimeout.get(enemyId);
    if (b3wup) clearTimeout(b3wup);
    this.boss3NovaWindupTimeout.delete(enemyId);
    const b3si = this.boss3NovaSweepInterval.get(enemyId);
    if (b3si) clearInterval(b3si);
    this.boss3NovaSweepInterval.delete(enemyId);
    this.boss3LockUntil.delete(enemyId);
    this.boss3NovaLastRelease.delete(enemyId);
    this.warlockBlinkCooldown.delete(enemyId);
    this.warlockLaunchCooldown.delete(enemyId);
    this.warlockBlinkLaunchSharedCooldownUntil.delete(enemyId);
    this.warlockMeteorCooldown.delete(enemyId);
    this.warlockLaunchMoveLockUntil.delete(enemyId);
    this.shadeBlinkCooldown.delete(enemyId);
    this.viperAttackCooldown.delete(enemyId);
    this.weaverHealCooldown.delete(enemyId);
    this.weaverSummonCooldown.delete(enemyId);
    this.weaverLightningCooldown.delete(enemyId);
    this.weaverSummonedGhouls.delete(enemyId);
    this.ghoulAttackCooldown.delete(enemyId);
    this.meleeLockUntil.delete(enemyId);
    this.knightAbilityCooldown.delete(enemyId);
    this.knightDashCooldown.delete(enemyId);
    this.enemyPaths.delete(enemyId);
    this.templarBlinkSmiteNextAt.delete(enemyId);

    // If a ghoul dies, clear it from its summoner's slot so the weaver can resummon
    this.weaverSummonedGhouls.forEach((ghoulId, weaverId) => {
      if (ghoulId === enemyId) {
        this.weaverSummonedGhouls.set(weaverId, null);
        console.log(`🧵 Weaver ${weaverId} ghoul ${enemyId} died — resummon available`);
      }
    });
  }

  // Apply taunt effect to enemy (Wraithblade ability)
  tauntEnemy(enemyId, taunterPlayerId, duration = 10000) { // Default 10 seconds
    const tauntEndTime = Date.now() + duration;
    this.enemyTaunts.set(enemyId, {
      taunterPlayerId,
      tauntEndTime
    });

    // For bosses, add taunt bonus to damage tracking
    // For regular enemies, use regular aggro system
    const enemy = this.room?.enemies.get(enemyId);
    if (enemy && (enemy.type === 'boss' || enemy.type === 'boss2' || enemy.type === 'boss3')) {
      // Initialize damage tracking if does not exist
      if (!this.bossDamageTracking.has(enemyId)) {
        this.bossDamageTracking.set(enemyId, new Map());
      }
      const damageMap = this.bossDamageTracking.get(enemyId);
      const currentDamage = damageMap.get(taunterPlayerId) || 0;
      damageMap.set(taunterPlayerId, currentDamage + 1000); // Large damage bonus for taunt
      console.log(`🎯 Boss ${enemyId} taunted by player ${taunterPlayerId} for ${duration/1000} seconds (damage bonus: +1000)`);
    } else {
      // For regular enemies, use regular aggro system
      this.updateAggro(enemyId, taunterPlayerId, 1000); // Large aggro bonus
      console.log(`🎯 Enemy ${enemyId} taunted by player ${taunterPlayerId} for ${duration/1000} seconds (aggro priority)`);
    }
  }

  // Check if enemy is currently taunted
  isEnemyTaunted(enemyId) {
    const tauntData = this.enemyTaunts.get(enemyId);
    if (!tauntData) return false;

    // Check if taunt has expired
    if (Date.now() > tauntData.tauntEndTime) {
      console.log(`⏰ Taunt expired for enemy ${enemyId}`);
      this.enemyTaunts.delete(enemyId);
      return false;
    }

    return true;
  }

  // Get taunt target for enemy
  getEnemyTauntTarget(enemyId) {
    const tauntData = this.enemyTaunts.get(enemyId);
    return tauntData ? tauntData.taunterPlayerId : null;
  }

  getCombatLeashRadius(aggroData, aggroRadius) {
    const base = aggroRadius * 3;
    if (aggroData.directPlayerDamageAggroed) {
      return Number.POSITIVE_INFINITY;
    }
    if (aggroData.threatFromDamage) {
      return Math.max(base, DAMAGE_THREAT_LEASH);
    }
    return base;
  }

  /** When a player-zombie dies, mobs should stop targeting it. */
  clearZombieAsAggroTarget(zombieId) {
    this.enemyAggro.forEach((data) => {
      if (data.targetZombieId === zombieId) data.targetZombieId = null;
    });
  }

  /**
   * Threat from infested zombie melee — mob focuses the zombie, keeps owner as player fallback for leash/retarget.
   */
  applyZombieThreat(defenderEnemyId, zombieId, aggroAmount = 50) {
    const z = this.room?.enemies?.get?.(zombieId);
    if (!z || z.type !== 'player-zombie' || z.isDying || z.health <= 0) return;

    const ownerId = z.ownerPlayerId;
    const players = this.room?.getPlayers?.();
    let fallbackPlayerId = ownerId;
    if (players && ownerId) {
      const owner = players.find((p) => p.id === ownerId && p.health > 0);
      if (!owner) fallbackPlayerId = null;
    }

    let aggroData = this.enemyAggro.get(defenderEnemyId);
    if (!aggroData) {
      const enemy = this.room?.enemies?.get?.(defenderEnemyId);
      if (!enemy) return;
      aggroData = {
        targetPlayerId: fallbackPlayerId,
        targetZombieId: zombieId,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(defenderEnemyId, aggroData);
    }

    aggroData.targetZombieId = zombieId;
    aggroData.targetTrapId = null;
    if (fallbackPlayerId) aggroData.targetPlayerId = fallbackPlayerId;
    aggroData.aggro += aggroAmount;
    aggroData.lastUpdate = Date.now();
    aggroData.isAggroed = true;
    aggroData.threatFromDamage = true;
    aggroData.directPlayerDamageAggroed = false;
  }

  clearTrapPendingSlam(trapId) {
    const t = this.tentacleSlamTimeouts.get(trapId);
    if (t) {
      clearTimeout(t);
      this.tentacleSlamTimeouts.delete(trapId);
    }
  }

  clearTrapAsAggroTarget(trapId) {
    this.enemyAggro.forEach((data) => {
      if (data.targetTrapId === trapId) data.targetTrapId = null;
    });
  }

  /**
   * Threat from tentacle-spine line — mob focuses the trap (clears zombie focus).
   */
  applyTrapThreat(defenderEnemyId, trapId, aggroAmount = 50) {
    const tr = this.room?.enemies?.get?.(trapId);
    if (!tr || tr.type !== 'tentacle-spine' || tr.isDying || tr.health <= 0) return;

    const players = this.room?.getPlayers?.();
    let fallbackPlayerId = null;
    const selfEnemy = this.room?.enemies?.get?.(defenderEnemyId);
    if (players && selfEnemy) {
      const closest = this.findClosestPlayer(selfEnemy, players);
      if (closest) fallbackPlayerId = closest.id;
    }

    let aggroData = this.enemyAggro.get(defenderEnemyId);
    if (!aggroData) {
      const enemy = this.room?.enemies?.get?.(defenderEnemyId);
      if (!enemy) return;
      aggroData = {
        targetPlayerId: fallbackPlayerId,
        targetZombieId: null,
        targetTrapId: trapId,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(defenderEnemyId, aggroData);
    }

    aggroData.targetTrapId = trapId;
    aggroData.targetZombieId = null;
    if (fallbackPlayerId) aggroData.targetPlayerId = fallbackPlayerId;
    aggroData.aggro += aggroAmount;
    aggroData.lastUpdate = Date.now();
    aggroData.isAggroed = true;
    aggroData.threatFromDamage = true;
    aggroData.directPlayerDamageAggroed = false;
  }

  updateTentacleSpineTrap(trap, players) {
    if (!this.room || trap.isDying || trap.health <= 0) return;
    const now = Date.now();
    if (now < (trap.trapNextReadyAt || 0)) return;
    if (this.tentacleSlamTimeouts.has(trap.id)) return;

    const triggerR2 = TENTACLE_SPINE_TRIGGER_R * TENTACLE_SPINE_TRIGGER_R;
    let best = null;
    let bestD = Infinity;

    for (const p of players) {
      if (!p || p.health <= 0) continue;
      const dx = p.position.x - trap.position.x;
      const dz = p.position.z - trap.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 <= triggerR2 && d2 < bestD) {
        bestD = d2;
        best = { kind: 'player', id: p.id, position: p.position };
      }
    }

    for (const e of this.room.getEnemies()) {
      if (!e || e.id === trap.id || e.isDying || e.health <= 0) continue;
      if (e.type === 'tentacle-spine' || e.type === 'training-dummy') continue;
      if (e.type === 'boss' || e.type === 'boss2' || e.type === 'boss3' || e.type === 'boss-skeleton') continue;
      const dx = e.position.x - trap.position.x;
      const dz = e.position.z - trap.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 <= triggerR2 && d2 < bestD) {
        bestD = d2;
        best = { kind: 'enemy', id: e.id, position: e.position };
      }
    }

    if (!best) return;

    const dx = best.position.x - trap.position.x;
    const dz = best.position.z - trap.position.z;
    const len = Math.hypot(dx, dz) || 1e-6;
    const dirX = dx / len;
    const dirZ = dz / len;
    trap.rotation = Math.atan2(dx, dz);

    if (this.io) {
      this.io.to(this.roomId).emit('enemy-moved', {
        enemyId: trap.id,
        position: trap.position,
        rotation: trap.rotation,
        timestamp: Date.now(),
      });
      this.io.to(this.roomId).emit('tentacle-spine-windup', {
        enemyId: trap.id,
        dirX,
        dirZ,
        position: { x: trap.position.x, y: trap.position.y, z: trap.position.z },
        lineLength: TENTACLE_SPINE_LINE_LEN,
        timestamp: Date.now(),
      });
    }

    const trapId = trap.id;
    const tid = setTimeout(() => {
      this.tentacleSlamTimeouts.delete(trapId);
      this._executeTentacleSpineSlam(trapId, dirX, dirZ);
    }, TENTACLE_SPINE_WINDUP_MS);
    this.tentacleSlamTimeouts.set(trap.id, tid);
  }

  /** Matches client ground telegraph: fixed direction from windup, no re-aim at slam. */
  _executeTentacleSpineSlam(trapId, dirX, dirZ) {
    if (!this.room?.getGameStarted()) return;
    if (this.room?.isEnemyAffectedBy(trapId, 'stun')) return;
    const live = this.room.getEnemy(trapId);
    if (!live || live.type !== 'tentacle-spine' || live.isDying || live.health <= 0) return;

    const ax = live.position.x;
    const az = live.position.z;
    live.rotation = Math.atan2(dirX, dirZ);

    const bx = ax + dirX * TENTACLE_SPINE_LINE_LEN;
    const bz = az + dirZ * TENTACLE_SPINE_LINE_LEN;
    const hw = TENTACLE_SPINE_LINE_HALF_W;
    const hw2 = hw * hw;

    this.room.damagePlayersInLineSegment(
      ax,
      az,
      bx,
      bz,
      hw,
      TENTACLE_SPINE_DMG_PLAYER,
      'tentacle_spine',
    );

    const hit = new Set();
    for (const e of this.room.getEnemies()) {
      if (!e || e.id === trapId || e.isDying || e.health <= 0) continue;
      if (e.type === 'tentacle-spine' || e.type === 'training-dummy') continue;
      if (e.type === 'boss' || e.type === 'boss2' || e.type === 'boss3' || e.type === 'boss-skeleton') continue;
      if (distPointSegmentSqXZ(e.position.x, e.position.z, ax, az, bx, bz) > hw2) continue;
      if (hit.has(e.id)) continue;
      hit.add(e.id);
      this.room.damageEnemy(e.id, TENTACLE_SPINE_DMG_MOB, null, null, {
        sourceTrapId: trapId,
        damageType: 'tentacle_spine',
      });
    }

    live.trapNextReadyAt = Date.now() + TENTACLE_SPINE_COOLDOWN_MS;
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-moved', {
        enemyId: trapId,
        position: live.position,
        rotation: live.rotation,
        timestamp: Date.now(),
      });
      this.io.to(this.roomId).emit('tentacle-spine-slam', {
        enemyId: trapId,
        dirX,
        dirZ,
        position: { x: live.position.x, y: live.position.y, z: live.position.z },
        lineLength: TENTACLE_SPINE_LINE_LEN,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Prefer trap → zombie → player.
   * @returns {{ kind: 'player', player: object } | { kind: 'zombie', zombie: object } | { kind: 'trap', trap: object } | null}
   */
  resolveAggroCombatTarget(aggroData, moverEnemy, players) {
    if (!aggroData || !moverEnemy || !players) return null;

    const tid = aggroData.targetTrapId;
    if (tid) {
      const tr = this.room?.enemies?.get(tid);
      if (tr && tr.type === 'tentacle-spine' && !tr.isDying && tr.health > 0) {
        return { kind: 'trap', trap: tr };
      }
      aggroData.targetTrapId = null;
    }

    const zid = aggroData.targetZombieId;
    if (zid) {
      const z = this.room?.enemies?.get(zid);
      if (z && z.type === 'player-zombie' && !z.isDying && z.health > 0) {
        return { kind: 'zombie', zombie: z };
      }
      aggroData.targetZombieId = null;
    }

    let targetPlayer = players.find((p) => p.id === aggroData.targetPlayerId);
    if (!targetPlayer || targetPlayer.health <= 0) {
      const newTarget = this.findClosestPlayer(moverEnemy, players);
      if (newTarget) {
        aggroData.targetPlayerId = newTarget.id;
        targetPlayer = newTarget;
      } else {
        return null;
      }
    }
    return { kind: 'player', player: targetPlayer };
  }

  aggroTargetToMoveTarget(resolved) {
    if (!resolved) return null;
    if (resolved.kind === 'player') return resolved.player;
    if (resolved.kind === 'trap') return { id: resolved.trap.id, position: resolved.trap.position };
    return { id: resolved.zombie.id, position: resolved.zombie.position };
  }

  combatTargetPosition(resolved) {
    if (!resolved) return null;
    if (resolved.kind === 'player') return resolved.player.position;
    if (resolved.kind === 'trap') return resolved.trap.position;
    return resolved.zombie.position;
  }

  damagePlayerZombieFromMob(mob, zombie, damage, damageType) {
    if (!this.room || !zombie || zombie.type !== 'player-zombie') return;
    this.room.damageEnemy(zombie.id, damage, null, null, { damageType, sourceEnemyId: mob?.id });
  }

  // Update aggro when player damages enemy
  updateAggro(enemyId, playerId, aggroAmount = 50) {
    const players = this.room?.getPlayers?.();
    if (!players || !playerId) return;

    const attacker = players.find(p => p.id === playerId && p.health > 0);
    if (!attacker) return;

    let aggroData = this.enemyAggro.get(enemyId);
    if (!aggroData) {
      const enemy = this.room?.enemies?.get?.(enemyId);
      if (!enemy) return;
      aggroData = {
        targetPlayerId: playerId,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100
      };
      this.enemyAggro.set(enemyId, aggroData);
    }

    aggroData.targetPlayerId = playerId;
    aggroData.targetZombieId = null;
    aggroData.targetTrapId = null;
    aggroData.aggro += aggroAmount;
    aggroData.lastUpdate = Date.now();
    aggroData.isAggroed = true;
    aggroData.threatFromDamage = true;
    aggroData.directPlayerDamageAggroed = true;
  }

  // Remove player from all aggro charts when they die
  removePlayerFromAllAggro(deadPlayerId) {
    console.log(`💀 Removing dead player ${deadPlayerId} from all aggro charts`);

    // Remove from all boss damage tracking
    this.bossDamageTracking.forEach((damageMap, bossId) => {
      if (damageMap.has(deadPlayerId)) {
        damageMap.delete(deadPlayerId);
        console.log(`  - Removed ${deadPlayerId} from boss ${bossId} damage tracking`);
      }
    });

    // Remove from all enemy aggro (regular enemies, skeletons, etc.)
    this.enemyAggro.forEach((aggroData, enemyId) => {
      if (aggroData.targetPlayerId === deadPlayerId) {
        // Clear the target for this enemy - it will find a new target on next update
        aggroData.targetPlayerId = null;
        aggroData.targetZombieId = null;
        aggroData.targetTrapId = null;
        aggroData.aggro = 0;
        aggroData.isAggroed = false;
        aggroData.threatFromDamage = false;
        aggroData.directPlayerDamageAggroed = false;
        console.log(`  - Cleared ${deadPlayerId} as target for enemy ${enemyId}`);
      }
    });
  }
}

module.exports = EnemyAI;