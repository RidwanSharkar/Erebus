const { WALL_SEGMENTS } = require('./wallData');
const { rotationYTowardEntry } = require('./coopArenaLayout');

// Mirror client main arena constants (colored rooms use a circle at this radius).
const MAIN_ARENA_HEX_RADIUS = 26;
const MAIN_CIRCLE_INNER_RADIUS = MAIN_ARENA_HEX_RADIUS - 0.5;
/** Stat/trial hex combat arena — must match `HexCombatArena.tsx`. */
const HEX_ARENA_RADIUS = 22;
const HEX_FLOOR_MARGIN = 1.4;
const HEX_INNER_APOTHEM = HEX_ARENA_RADIUS * Math.cos(Math.PI / 6) - HEX_FLOOR_MARGIN;
/** Match `backend/gameRoom.js` COOP_THRONE_ROOM_RADIUS — prep disc; wall resolve when combat not active. */
const COOP_THRONE_ROOM_RADIUS = 24;
/** Match `ThroneRoom.tsx` THRONE_RIM_INSET — inset from grass rim for portals / foot clearance. */
const THRONE_RIM_INSET = 1.25;
const ENEMY_WALL_COLLISION_RADIUS = 0.5;

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

function clampToCircleXZ(x, z, radius = MAIN_CIRCLE_INNER_RADIUS) {
  const len = Math.hypot(x, z);
  if (len <= radius || len < 1e-6) return { x, z };
  const s = radius / len;
  return { x: x * s, z: z * s };
}

function clampToMainHexXZ(x, z, apothem = HEX_INNER_APOTHEM) {
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

// Melee units advance until this much *inside* max swing range so the damage
// check at swing end is harder to escape with a small back-step.
const MELEE_CLOSE_INSET = 0.35;
const KNIGHT_MELEE_WINDUP_STEP = 0.3;
const KNIGHT_MELEE_WINDUP_STEP_DELAY_MS = 450;
const KNIGHT_DASH_COOLDOWN_MS = 7000;
const KNIGHT_DASH_DISTANCE = 4.5;
const KNIGHT_DASH_DURATION_MS = 350;
const KNIGHT_DASH_MIN_DISTANCE = 3.25;
const KNIGHT_SPIN_COOLDOWN_MS = 7000;
const KNIGHT_SPIN_CAST_RANGE = 4.5;
const KNIGHT_SPIN_CHARGE_MS = 500;
const KNIGHT_SPIN_DISTANCE = 4.5;
const KNIGHT_SPIN_TRAVEL_MS = 400; // 31 frames at 30fps
const KNIGHT_SPIN_DAMAGE = 20;
const KNIGHT_SPIN_STRIP_HALF_WIDTH = 0.75;

// Knight / templar / ghoul / martyr / titan: ring goals + peer separation (radii match client CoopGameScene hit spheres).
const MELEE_SURROUND_TYPES = new Set(['knight', 'templar', 'ghoul', 'martyr', 'titan', 'allied-knight']);
const MELEE_PEER_SEP_PADDING = 0.05;
// Tight ring: closer to player than ~0.82×attackRange so units path/hug obstacles less awkwardly.
const MELEE_SURROUND_STANDOFF_FRAC = 0.18;
const MELEE_SURROUND_STANDOFF_MIN = 0.3;
const MELEE_SURROUND_STANDOFF_MARGIN = 0.08; 

// Leash to current non-player damage threat (arena ~64×64).
const DAMAGE_THREAT_LEASH = 90;

// Titan — heavy patrol melee unit (post boss-1 room spawn).
const TITAN_AGGRO_RADIUS = 6;
const TITAN_ATTACK_RANGE = 3.0;
const TITAN_SWING_LOCK_MS = 1500;
const TITAN_HIT_DELAY_MS = 875;
const TITAN_KNOCKBACK_DISTANCE = 7;
const TITAN_KNOCKBACK_DURATION = 0.5;
const TITAN_PATROL_REACH = 0.5;
const TITAN_PATROL_WAYPOINT_COUNT = 8;
const TITAN_PATROL_RADIUS_FRAC = 0.65;
const TITAN_BLADESTORM_HEALTH_PCT = 0.4;
const TITAN_BLADESTORM_POWERUP_MS = 1500;
const TITAN_BLADESTORM_DAMAGE = 15;
const TITAN_BLADESTORM_SPIN_SPEED = 18.0; // rad/s — calm circular orbit (~1 rotation/sec)
const TITAN_BLADESTORM_HIT_RADIUS = 4.75;
const TITAN_STOMP_COOLDOWN_MS = 11_000;
const TITAN_STOMP_WINDUP_MS = 1000;
const TITAN_STOMP_MIN_DISTANCE = 3;
const TITAN_STOMP_MAX_RANGE = 10;
const TITAN_STOMP_STUN_MS = 2000;
const TITAN_STOMP_HALF_WIDTH_MIN = 0.5;
const TITAN_STOMP_HALF_WIDTH_MAX = 2.0;
const TITAN_STOMP_DAMAGE = 15;
const TITAN_STOMP_TRAVEL_MS = 700;
const TITAN_STOMP_STEPS = 10;
const TITAN_CANNON_UNLOCK_BOSS_COUNT = 3;
const TITAN_CANNON_COOLDOWN_MS = 13_000;
const TITAN_CANNON_WINDUP_MS = 1000;
const TITAN_CANNON_TOTAL_LOCK_MS = 1500;
const TITAN_CANNON_RANGE = 25;
const TITAN_CANNON_HALF_WIDTH = 1.8;
const TITAN_CANNON_MIN_RANGE = TITAN_STOMP_MAX_RANGE;
const TITAN_CANNON_START_OFFSET = 0.65;
const TITAN_CANNON_DAMAGE_BY_SOUL = { green: 120, red: 150, purple: 130, blue: 140 };
const TITAN_CANNON_BLUE_HEALTH_PCT = 0.5;
const TITAN_CANNON_BLUE_COOLDOWN_MS = 5000;
const TITAN_CANNON_RED_HEALTH_PCT = 0.9;
const TITAN_CANNON_RED_MAX_CHARGES = 2;
const TITAN_CANNON_RED_CHARGE_MS = 20000;
const TITAN_CANNON_RED_CAST_GAP_MS = 1250;
const TITAN_CANNON_PURPLE_COOLDOWN_MS = 15000;
const TITAN_CANNON_GREEN_COOLDOWN_MS = TITAN_CANNON_COOLDOWN_MS;

// Infested player-zombie summon lock — keep in sync with client ZombieRenderer SUMMON_DURATION
const INFESTED_ZOMBIE_SUMMON_LOCK_MS = 2800;

// Universal green coop room zombie boons — mirrored from client TalentLoadout (see `coop-zombie-room-boons`)
const PLAYER_ZOMBIE_STANDARD_HP = 250;
const PLAYER_ZOMBIE_STANDARD_DAMAGE = 45;
const PLAYER_ZOMBIE_JUGGERNAUT_HP = 600;
const PLAYER_ZOMBIE_JUGGERNAUT_DAMAGE = 135;
const JUGGERNAUT_STRAIN_ROLL_CHANCE = 0.33;
const BERSERKER_STRAIN_HP_MULT = 2;
const BERSERKER_STRAIN_MOVE_MULT = 2;
const PLAYER_ZOMBIE_UNLOCK_MOVE_SPEED = 1.75;
const PACK_HUNTER_DAMAGE_PER_ZOMBIE = 15;
const EXPLODER_STRAIN_RADIUS = 2.5;

const ALLIED_KNIGHT_MAX_HP = 1000;
const ALLIED_KNIGHT_DAMAGE = 50;
const ALLIED_KNIGHT_ATTACK_COOLDOWN_MS = 1250;
const ALLIED_KNIGHT_MOVE_SPEED = 3.0;
const ALLIED_KNIGHT_ATTACK_RANGE = 2.6;
const ALLIED_KNIGHT_FOLLOW_DISTANCE = 3.0;
const ALLIED_KNIGHT_PROTECTIVE_THREAT_TTL_MS = 15000;
const ALLIED_KNIGHT_PROTECTIVE_THREAT_DECAY_PER_SEC = 0.85;
const ALLIED_KNIGHT_PROTECTIVE_OVERRIDE_DAMAGE = 50;
const ALLIED_KNIGHT_ORB_COUNT = 3;
const ALLIED_KNIGHT_SMITE_ORB_COST = 1;
const ALLIED_KNIGHT_SMITE_COOLDOWN_MS = 5000;
const ALLIED_KNIGHT_ORB_RECHARGE_MS = 5000;
const ALLIED_KNIGHT_SMITE_LOCK_MS = 1200;
const ALLIED_KNIGHT_SMITE_IMPACT_DELAY_MS = 900;
const ALLIED_KNIGHT_SMITE_CAST_RANGE = 3.6;
const ALLIED_KNIGHT_SMITE_DAMAGE = 70;
const ALLIED_KNIGHT_SMITE_RADIUS = 1.85;
// TEMPEST INITIATE boon constants (keep in sync with src/utils/talents.ts)
const TEMPEST_INITIATE_SMITE_COOLDOWN_MS = 2500;
const TEMPEST_INITIATE_SMITE_BASE_DAMAGE_BONUS = 20;
const TEMPEST_INITIATE_SMITE_DAMAGE_PER_AGILITY = 5;
// NECROS INITIATE boon constants (keep in sync with src/utils/talents.ts)
const NECROS_INITIATE_KNIGHT_BASE_HP = 750;
const NECROS_INITIATE_KNIGHT_HP_PER_STAMINA = 25;
// INFERNAL INITIATE boon constants (keep in sync with src/utils/talents.ts)
const INFERNAL_INITIATE_KNIGHT_BASE_DAMAGE = 80;
const INFERNAL_INITIATE_KNIGHT_DAMAGE_PER_STRENGTH = 3;
const ALLIED_HEALER_ID = 'allied-healer';
const ALLIED_HEALER_MAX_HP = 350;
const ALLIED_HEALER_MOVE_SPEED = 2.0;
const ALLIED_HEALER_FOLLOW_DISTANCE = 4.0;
const ALLIED_HEALER_GREATER_HEAL_AMOUNT = 50;
const ALLIED_HEALER_MIN_MISSING_HEALTH = 30;
const ALLIED_HEALER_GREATER_HEAL_RANGE = 10;
const ALLIED_HEALER_GREATER_HEAL_COOLDOWN_MS = 9000;
const ALLIED_HEALER_GREATER_HEAL_CAST_MS = 1500;
const ALLIED_HEALER_GREATER_HEAL_HEALCAST_MS = 1100;
const ALLIED_HEALER_GREATER_HEAL_IMPACT_DELAY_MS =
  ALLIED_HEALER_GREATER_HEAL_CAST_MS + ALLIED_HEALER_GREATER_HEAL_HEALCAST_MS;

const ALLIED_HEALER_ATTACK_COOLDOWN_MS = 3500;
const ALLIED_HEALER_ATTACK_RANGE = 9;
const ALLIED_HEALER_ATTACK_DAMAGE = 100;
const ALLIED_HEALER_ATTACK_AOE_RADIUS = 2.5;
const ALLIED_HEALER_ATTACK_CAST_MS = 1200;
const ALLIED_HEALER_ATTACK_TRAVEL_MS = Math.round((ALLIED_HEALER_ATTACK_RANGE / 9) * 1000);

// Co-op Viper: client projectile + ground line use this (see ViperArrowProjectile, CoopGameScene).
const VIPER_ARROW_MAX_RANGE = 18;
// Keep in sync with CoopGameScene.tsx VIPER_DRAWBOW_DURATION.
const VIPER_DRAWBOW_DURATION_MS = 1000;
// Keep in sync with ViperArrowProjectile.tsx SPEED.
const VIPER_ARROW_PROJECTILE_SPEED = 25;
const VIPER_ARROW_MAX_FLIGHT_MS = Math.ceil((VIPER_ARROW_MAX_RANGE / VIPER_ARROW_PROJECTILE_SPEED) * 1000);
const viperArrowFlightMs = (from, to) => {
  const dx = (to?.x ?? from.x) - from.x;
  const dy = (to?.y ?? from.y) - from.y;
  const dz = (to?.z ?? from.z) - from.z;
  const distance = Math.min(VIPER_ARROW_MAX_RANGE, Math.hypot(dx, dy, dz));
  return Math.min(VIPER_ARROW_MAX_FLIGHT_MS, Math.ceil((distance / VIPER_ARROW_PROJECTILE_SPEED) * 1000));
};
// Viper double shot (unlocked after first boss): second arrow fires when the first is released.
const VIPER_DOUBLE_SHOT_UNLOCK_BOSS_COUNT = 1;
const VIPER_DOUBLE_SHOT_FOLLOWUP_DELAY_MS = VIPER_DRAWBOW_DURATION_MS;
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
const SHADE_DAGGER_DELAYS_MS = [650, 900, 1150];       // default/purple — 3 daggers
const SHADE_DAGGER_DELAYS_MS_BLUE = [650, 900];         // blue — 2 daggers

// Templar Blink Smite: first cast 15s after aggro, then every 15s; windup 1s then AOE in front of templar
const TEMPLAR_BLINK_SMITE_INTERVAL_MS = 12000;
const TEMPLAR_BLINK_SMITE_CHARGE_MS = 500;
const TEMPLAR_BLINK_SMITE_STRIKE_DELAY_MS = 975;
const TEMPLAR_BLINK_SMITE_IMPACT_OFFSET = 2.75;
const TEMPLAR_BLINK_SMITE_DAMAGE = 75;
const TEMPLAR_BLINK_SMITE_RADIUS = 2.5;
const TEMPLAR_BLINK_SMITE_ABILITY_LOCK_MS = 2500; // no move/melee during windup + post-strike
const TELEPORT_BEHIND_DISTANCE = 2.2; // same as boss blink (templar blink smite; not used by main co-op boss)

// Co-op main boss (GLB): melee + leap + tectonic
const BOSS_MELEE_RANGE = 2.9;
const BOSS_MELEE_COOLDOWN_MS = 2750;
const BOSS_MELEE_DAMAGE = 19;
/** No translation during melee swing (matches knight `SWING_LOCK_MS`). */
const BOSS_MELEE_ATTACK_LOCK_MS = 1200;
/** Windup before melee damage lands (matches `TITAN_HIT_DELAY_MS`). */
const BOSS_MELEE_HIT_DELAY_MS = 875;
/** Leap only once at or below this health fraction (not at full HP). */
const BOSS_LEAP_MAX_HP_PCT = 1.0;
const BOSS_LEAP_LAND_STANDOFF_M = 0.65; // land near player for leap (not full walk standoff 3.2m)
const BOSS_LEAP_COOLDOWN_MS = 8000;
const BOSS_LEAP_MAX_TRAVEL = 14;
/** Inside co-op boss throne shell (~`COOP_THRONE_ROOM_RADIUS` 24 on client); keep leaps shorter. */
const BOSS_LEAP_MAX_TRAVEL_THRONE = 12;
/** Playable disc inset so boss feet stay inside grass ring. */
const COOP_BOSS_THRONE_ARENA_CLAMP_R =
  COOP_THRONE_ROOM_RADIUS - THRONE_RIM_INSET - ENEMY_WALL_COLLISION_RADIUS;
const BOSS_LEAP_DURATION_MS = 1325;
const BOSS_LEAP_LANDING_RADIUS = 3.5;
const BOSS_LEAP_DAMAGE = 25;
const BOSS_TECTONIC_COOLDOWN_MS = 30000;
const BOSS_TECTONIC_MAX_HP_PCT = 0.75;
const BOSS_TECTONIC_CENTER_DIST = 0.85;
const BOSS_TECTONIC_JUMP_INTERVAL_MS = 900;
const BOSS_TECTONIC_JUMP_COUNT = 10;
const BOSS_TECTONIC_SPIKE_WARN_MS = 750;
// Keep in sync with TECTONIC_HIT_RADIUS in src/components/enemies/BossTectonicSpikeTelegraph.tsx
const BOSS_TECTONIC_SHARD_RADIUS = 2.5;
const BOSS_TECTONIC_SHARD_DAMAGE = 30;
const BOSS_STATIONARY_EPS = 0.03;
const BOSS_TECTONIC_CENTER = { x: 0, y: 0, z: 0 };
// Boss throw-spear ability
const BOSS_THROW_MIN_RANGE     = 3;
const BOSS_THROW_MAX_RANGE     = 18;
const BOSS_THROW_DAMAGE        = 40;
const BOSS_THROW_COOLDOWN_MS   = 10_000;
/** When the spear projectile / `boss-throw-spear` fires during the throw animation. */
const BOSS_THROW_SPEAR_RELEASE_MS = 900;
/** Boss cannot move until this elapses after `boss-throw-start` (full throw clip). */
const BOSS_THROW_MOVE_LOCK_MS = 2_000;
/** Boss 1 cannot use spear throw as an opener. */
const BOSS_THROW_FIGHT_START_DELAY_MS = 6_000;
/** Minimum gap between starting a throw and starting a leap (either order). */
const BOSS_THROW_LEAP_ICD_MS = 2_000;

// Ghoul Leap (unlocked after first boss): mirrors boss leap + player stun (no HP gate)
const GHOUL_LEAP_LAND_STANDOFF_M = 0.25;
const GHOUL_LEAP_COOLDOWN_MS = 10_000;
const GHOUL_LEAP_POST_SPAWN_DELAY_MS = 5_000;
const GHOUL_LEAP_MAX_TRAVEL = 14;
const GHOUL_LEAP_DURATION_MS = BOSS_LEAP_DURATION_MS;
const GHOUL_LEAP_LANDING_RADIUS = 3.5;
const GHOUL_LEAP_DAMAGE = 25;
const GHOUL_LEAP_STUN_MS = 2250;
const GHOUL_BASE_DAMAGE = 28;
const GHOUL_BASE_MOVE_SPEED = 2.5;
const GHOUL_SUMMON_HP = 400;
const BOSS3_SUMMONED_GHOUL_HP = 1200;
const BOSS3_SUMMONED_GHOUL_VISUAL_SCALE = 1.45;
const BOSS3_SUMMONED_GHOUL_SPEED_MULT = 1.25;
const BOSS3_SUMMONED_GHOUL_DAMAGE_MULT = 2;

// Templar Leap (unlocked after first boss): 4–8m range, higher damage, no stun
const TEMPLAR_LEAP_MIN_RANGE = 4;
const TEMPLAR_LEAP_LAND_STANDOFF_M = 0.2;
const TEMPLAR_LEAP_COOLDOWN_MS = 6_000;
const TEMPLAR_LEAP_MAX_TRAVEL = 8;
const TEMPLAR_LEAP_DURATION_MS = BOSS_LEAP_DURATION_MS;
const TEMPLAR_LEAP_LANDING_RADIUS = 2.0;
const TEMPLAR_LEAP_DAMAGE = 60;

/** Co-op player locomotion (matches client Movement.maxSpeed / dash tuning). */
const PLAYER_COOP_MAX_SPEED = 3.575;
const PLAYER_DASH_DISTANCE = 4.125;
const PLAYER_DASH_DURATION_S = 0.35;
const MOB_LEAP_PREDICTION_MAX_OFFSET = 12;

// Boss 2: Archon warlock
const BOSS2_ARCHON_LIGHTNING_COOLDOWN_MS = 3500;
const BOSS2_ARCHON_LIGHTNING_WINDUP_MS = 825;
const BOSS2_ARCHON_LIGHTNING_DAMAGE = 49;
const BOSS2_ARCHON_LIGHTNING_HALF_WIDTH = 1.0;
const BOSS2_ARCHON_LIGHTNING_RANGE = 14;
/** Phase 1 perpendicular arm half-length at target (capped). */
const BOSS2_ARCHON_LIGHTNING_CROSS_HALF_MIN = 4;
const BOSS2_BLINK_COOLDOWN_MS = 8_000;
const BOSS2_DEATH_GRASP_CAST_MS = 1_000;
const BOSS2_DEATH_GRASP_TRAVEL_MS = 670;
const BOSS2_DEATH_GRASP_HIT_RADIUS = 1.35;
const BOSS2_DEATH_GRASP_STANDOFF = 1.2;
const BOSS2_DEATH_GRASP_RANGE = 13;
const BOSS2_DEATH_GRASP_ARC_RADIANS = Math.PI / 9;
const BOSS2_FLAME_PILLAR_DAMAGE = 50;
const BOSS2_FLAME_PILLAR_RADIUS = 2.25;
/** Same as WarlockRenderer / CoopGameScene blink slide — pillars erupt after landing. */
const BOSS2_FLAME_PILLAR_BLINK_DELAY_MS = 800;
const BOSS2_FLAME_PILLAR_STAGGER_MS = 250;
const BOSS2_FLAME_PILLAR_FORWARD_1 = 1.82;
const BOSS2_FLAME_PILLAR_FORWARD_2 = 2.42;
const BOSS2_WARLOCK_SUMMON_INTERVAL_MS = 20_000;
const BOSS2_SUMMON_ARENA_EXTENT = 12;

// Boss 3: Weaver Nexus (scaled weaver + arcane nova)
const BOSS3_CENTER_HOLD_DIST = 1.2;
const BOSS3_SUMMON_CAST_MS = 3000;
const BOSS3_NOVA_WINDUP_MS = 3000;
const BOSS3_NOVA_COOLDOWN_MS = 3000;
const BOSS3_NOVA_MAX_RANGE = 14;
const BOSS3_NOVA_TRAVEL_MS = 1500;
const BOSS3_NOVA_HALF_WIDTH = 0.85;
const BOSS3_NOVA_DAMAGE = 57;
const BOSS3_NOVA_STEPS = 26;
const BOSS3_NOVA_BURST_GAP_MS = 250;
const BOSS3_NOVA_HP_DOUBLE_ROUND = 0.75;
const BOSS3_NOVA_HP_TRIPLE_ROUND = 0.5;
const BOSS3_LIGHTNING_HEALTH_PCT = 0.675;
const BOSS3_LIGHTNING_INTERVAL_MS = 6_000;
const BOSS3_LIGHTNING_CHARGE_MS = 500;
const BOSS3_LIGHTNING_STAGGER_MS = 500;
const BOSS3_LIGHTNING_DAMAGE = 59;
const BOSS3_LIGHTNING_RADIUS = 2.99;
const BOSS3_LIGHTNING_OFFSET_MIN = 2;
const BOSS3_LIGHTNING_OFFSET_MAX = 6;
const BOSS3_GREEN_BEAM_DURATION_MS = 8000;
const BOSS3_GREEN_BEAM_TICK_MS = 1000;
const BOSS3_GREEN_BEAM_DPS = 71;
const BOSS3_GREEN_BEAM_RANGE = 22;
const BOSS3_GREEN_BEAM_HALF_WIDTH = 0.52;
/** Radians/sec — slower than default boss snap so players can sidestep the beam. */
const BOSS3_GREEN_BEAM_ROT_SPEED = 1.0;

// Martyr: self-detonation (matches client AOE)
const MARTYR_MELEE_RANGE = 1.4;
const MARTYR_DETONATION_RADIUS = 5.5;
/** Damage to players in blast (clients apply via `martyr-detonation-impact`). */
const MARTYR_DETONATION_PLAYER_DAMAGE = 150;
/** Damage to detonating martyr and other mobs in blast (server-side). */
const MARTYR_DETONATION_ENEMY_DAMAGE = 200;
const MARTYR_DETONATION_DELAY_MS = 2160;
/** Main bosses are not hit by Martyr splash. */
const MARTYR_DETONATION_SPLASH_EXCLUDED_TYPES = new Set(['boss', 'boss2', 'boss3']);

// Tentacle-spine environmental trap (co-op wave)
const TENTACLE_SPINE_TRIGGER_R = 6;
const TENTACLE_SPINE_LINE_LEN = 10;
const TENTACLE_SPINE_LINE_HALF_W = 0.85;
const TENTACLE_SPINE_WINDUP_MS = 1150;
const TENTACLE_SPINE_COOLDOWN_MS = 3250;
const TENTACLE_SPINE_DMG_PLAYER = 40;
const TENTACLE_SPINE_DMG_MOB = 150;
const TENTACLE_SPINE_DMG_ALLIED_KNIGHT = 35;

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
const WARLOCK_BLINK_LAUNCH_SHARED_COOLDOWN_MS = 3000;
const WARLOCK_LAUNCH_MOVE_LOCK_MS = 1400;
const WARLOCK_PREFERRED_STAND_RANGE = 8.25; // same as movement stop distance; launch only at or inside this
const WARLOCK_METEOR_PER_HIT_DAMAGE = 100;
const WARLOCK_METEOR_COUNT = 2;
const WARLOCK_METEOR_STAGGER_MS = 350;
// Meteor swarm: offset radius around primary target, clamped to co-op rectangle.
const WARLOCK_METEOR_OFFSET_MIN = 2;
const WARLOCK_METEOR_OFFSET_MAX = 6;
/** Chaos orb — aligned with WarlockRenderer / WarlockProjectile.tsx */
const WARLOCK_ORB_CHARGE_MS = 1400;
const WARLOCK_ORB_SPEED = 9;
const WARLOCK_ORB_TURN_RATE = 1.8; // rad/s homing — WarlockProjectile.tsx TURN_RATE
const WARLOCK_ORB_HIT_RADIUS = 1.05; // XZ — match ShadeDaggerProjectile / ViperArrowProjectile
const WARLOCK_ORB_DAMAGE = 42;
const WARLOCK_FLAME_DAMAGE = 42;
const WARLOCK_FLAME_RADIUS = 2.875;
/** Purple meteor impact disk — Meteor.tsx DAMAGE_RADIUS */
const WARLOCK_METEOR_DISK_RADIUS = 2.99;
const WARLOCK_METEOR_WARNING_MS = 100;
const WARLOCK_METEOR_FALL_SPEED = 38;
/** Angled approach — same ranges as Crossentropy METEOR talent (Meteor.tsx impact Y = -3). */
const WARLOCK_METEOR_SKY_OFFSET_MIN = 2.5;
const WARLOCK_METEOR_SKY_OFFSET_MAX = 8;
const WARLOCK_METEOR_SKY_HEIGHT_MIN = 44;
const WARLOCK_METEOR_SKY_HEIGHT_MAX = 66;
const WARLOCK_METEOR_IMPACT_Y = -3;
const WARLOCK_METEOR_EMBER_DURATION_MS = 5000;
const WARLOCK_METEOR_EMBER_TICK_MS = 750;
const WARLOCK_METEOR_EMBER_DAMAGE = 25;
const WARLOCK_METEOR_EMBER_RADIUS = WARLOCK_METEOR_DISK_RADIUS;
/** Warlock blink flame — CoopGameScene WARLOCK_BLINK_ANIM_MS */
const WARLOCK_BLINK_FLAME_DELAY_MS = 1000;
/** Post-boss-2 unlock: single-beam Archon Shock (Boss2 phase-0 clone, purple VFX). */
const WARLOCK_ARCHON_SHOCK_UNLOCK_BOSS_COUNT = 2;
const WARLOCK_ARCHON_SHOCK_COOLDOWN_MS = 7500;
const WARLOCK_ARCHON_SHOCK_WINDUP_MS = 825;
const WARLOCK_ARCHON_SHOCK_DAMAGE = 47;
const WARLOCK_ARCHON_SHOCK_HALF_WIDTH = 1.0;
const WARLOCK_ARCHON_SHOCK_RANGE = 14;

/** Post-boss-2 unlock: all knight colors gain themed Smite (Red Smite buffed). */
const KNIGHT_SMITE_UNLOCK_BOSS_COUNT = 2;
const KNIGHT_SMITE_COOLDOWN_MS = 7000;
const KNIGHT_SMITE_LOCK_MS = 1200;
const KNIGHT_STORM_LASH_COOLDOWN_MS = 12000;
const KNIGHT_STORM_LASH_RANGE = 7.0;
const KNIGHT_STORM_LASH_DURATION_MS = 4000;
const KNIGHT_STORM_LASH_ZAP_INTERVAL_MS = 750;
const KNIGHT_STORM_LASH_ZAP_DAMAGE = 20;
const KNIGHT_STORM_LASH_HALF_WIDTH = 1.0;
const KNIGHT_SMITE_IMPACT_DELAY_MS = 900;
const KNIGHT_SMITE_RADIUS_BASE = 2.8;
const KNIGHT_SMITE_RADIUS_POST_BOSS2 = 3.0;
const KNIGHT_SMITE_DAMAGE_PRE_BOSS2 = { red: 60 };
const KNIGHT_SMITE_DAMAGE_POST_BOSS2 = {
  red: 95,
  blue: 85,
  green: 80,
  purple: 90,
};

/** Post-boss-2 unlock: single tectonic-style ground spike (castheal windup, player-targeted). */
const WEAVER_IMPALE_SPIKE_UNLOCK_BOSS_COUNT = 2;
const WEAVER_IMPALE_SPIKE_COOLDOWN_MS = 7000;
const WEAVER_IMPALE_SPIKE_RANGE = 10;
const WEAVER_IMPALE_SPIKE_CAST_ANIM_MS = 2000;
const WEAVER_IMPALE_SPIKE_POST_ANIM_DELAY_MS = 1000;
const WEAVER_IMPALE_SPIKE_DAMAGE = 43;
/** Movement lock during cast — align with WeaverRenderer clip durations / lightning charge. */
const WEAVER_HEAL_CAST_LOCK_MS = 2000;
const WEAVER_SUMMON_CAST_LOCK_MS = 3000;
const WEAVER_LIGHTNING_CAST_LOCK_MS = 900;

/** Greed — bonus/additive wandering-then-fleeing unit; 4 color variants each with a distinct ability. */
const GREED_AGGRO_RADIUS = 9;
const GREED_FLEE_DISTANCE = 14;
const GREED_WANDER_REPICK_MS = 4000;
const GREED_WANDER_REACH = 1.0;
const GREED_RED_RANGE = 10;
const GREED_RED_COOLDOWN_MS = 8000;
const GREED_RED_DAMAGE = 47;
const GREED_PURPLE_RANGE = 13.0;
const GREED_PURPLE_COOLDOWN_MS = 14000;
const GREED_GREEN_HEAL_INTERVAL_MS = 10000;
const GREED_GREEN_HEAL_AMOUNT = 500;
const GREED_GREEN_CAST_LOCK_MS = 1400;
const GREED_BLUE_EMBER_INTERVAL_MS = 5000;
const GREED_BLUE_EMBER_DURATION_MS = 5000;
const GREED_BLUE_EMBER_TICK_MS = 750;
const GREED_BLUE_EMBER_DAMAGE = 20;
const GREED_BLUE_EMBER_RADIUS = 2.0;
const GREED_FIREBALL_SPEED = 11;
const GREED_FIREBALL_HIT_RADIUS = 1.1;

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
    this.bossCombatStartedMs = new Map(); // bossId -> first player damage timestamp
    /** bossId -> timestamp: next time throw or leap may *start* (shared ICD). */
    this.bossThrowLeapSharedCdUntil = new Map();
    this.bossTectonicSpikePendingTimeouts = new Map(); // bossId -> timeout ids
    this.bossLastAiPos = new Map();
    this.boss2ArchonLightningCooldown = new Map();
    this.boss2ArchonLightningLockUntil = new Map();
    this.boss2ArchonLightningTimeout = new Map();
    /** bossId -> 0 | 1 | 2 — advances each Archon Lightning cast (1 beam → X → fan → …). */
    this.boss2ArchonLightningComboPhase = new Map();
    this.boss2BlinkCooldown = new Map();
    this.boss2DeathGraspTimeouts = new Map();
    /** @type {Map<string, ReturnType<typeof setTimeout>[]>} */
    this.boss2FlamePillarTimeouts = new Map();
    this.boss2WarlockSummonLastAt = new Map();

    // Boss 3 (Weaver Nexus): nova + summon locks
    this.boss3LockUntil = new Map();
    this.boss3NovaLastRelease = new Map();
    this.boss3NovaWindupTimeout = new Map();
    /** @type {Map<string, Set<ReturnType<typeof setInterval>>>} */
    this.boss3NovaSweepInterval = new Map();
    /** @type {Map<string, ReturnType<typeof setTimeout>[]>} */
    this.boss3NovaBurstTimeouts = new Map();
    this.boss3LightningInterval = new Map();
    this.boss3GreenBeamEndAt = new Map();
    /** @type {Map<string, ReturnType<typeof setInterval>>} */
    this.boss3GreenBeamDamageInterval = new Map();
    /** @type {Map<string, { p75: boolean; p50: boolean; p25: boolean }>} */
    this.boss3GreenBeamStages = new Map();

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
    /** @type {Map<string, Set<ReturnType<typeof setInterval>>>} */
    this.warlockOrbIntervals = new Map(); // warlockId -> in-flight chaos orb tick loops
    this.warlockArchonShockCooldown = new Map();
    this.warlockArchonShockLockUntil = new Map();
    this.warlockArchonShockTimeout = new Map();

    // Shade blink+attack cooldown tracking (4-second cooldown)
    this.shadeBlinkCooldown = new Map(); // enemyId -> lastBlinkTime

    // Viper arrow shot cooldown tracking (2-second cooldown)
    this.viperAttackCooldown = new Map(); // enemyId -> lastAttackTime
    this.viperFollowupTimeout = new Map(); // viperId -> pending double-shot follow-up timeout

    // Weaver ability cooldown tracking
    this.weaverHealCooldown   = new Map(); // enemyId -> lastHealTime
    this.weaverSummonCooldown = new Map(); // enemyId -> lastSummonTime
    this.weaverLightningCooldown = new Map(); // enemyId -> lastLightningTime (blue weaver)
    this.weaverImpaleSpikeCooldown = new Map();
    this.weaverCastLockUntil = new Map();
    /** @type {Map<string, ReturnType<typeof setTimeout>[]>} */
    this.weaverImpaleSpikePendingTimeouts = new Map();

    // Weaver summoned ghoul tracking (1 ghoul per weaver at a time)
    this.weaverSummonedGhouls = new Map(); // weaverId -> ghoulId | null

    // Player zombies (INFESTED STRIKE): owner -> Set(zombieId)
    this.playerZombiesByOwner = new Map();

    // Allied knight protection chart: allyId -> enemyId -> { score, lastUpdate }.
    this.alliedProtectionThreat = new Map();

    // Ghoul attack cooldown tracking
    this.ghoulAttackCooldown = new Map(); // enemyId -> lastAttackTime
    this.titanAttackCooldown = new Map(); // enemyId -> lastAttackTime
    this.titanBladestormPowerupTimeout = new Map();
    this.titanStompCooldown = new Map();
    this.titanStompWindupTimeout = new Map();
    this.titanStompShockwaveInterval = new Map();
    this.titanCannonCooldown = new Map();
    this.titanCannonWindupTimeout = new Map();
    this.titanRedCannonCharges = new Map();
    this.titanRedCannonLastCastAt = new Map();
    this.ghoulLeapCooldown = new Map();
    this.ghoulLeapEndAt = new Map();
    this.ghoulLeapLand = new Map();
    this.ghoulLeapFrom = new Map();
    this.ghoulLeapTimeout = new Map();

    // Knight / Templar / Ghoul melee: timestamp until which the enemy is frozen mid-swing
    // so it cannot move until the swing animation and damage window both resolve.
    this.meleeLockUntil = new Map(); // enemyId -> lockExpiryTimestamp

    // Knight special ability cooldown tracking
    // Each soul type has one unique ability; all share this single cooldown map.
    this.knightAbilityCooldown = new Map(); // enemyId -> lastAbilityTime
    this.knightSmiteCooldown = new Map(); // enemyId -> lastSmiteTime (post-boss-2 blue/green/purple)
    this.knightDashCooldown = new Map(); // enemyId -> lastDashTime
    this.knightSpinCooldown = new Map(); // enemyId -> lastSpinTime

    // Red / Green: Death Grasp (independent 15s CD from knightAbilityCooldown)
    this.knightDeathGraspCooldown = new Map(); // enemyId -> lastCastMs

    // Blue: Storm Lash channeled lightning zaps (timeout handles cleared on death)
    this.knightStormLashTimeouts = new Map(); // enemyId -> handle[]

    // Navigation / pathfinding
    this.navGrid    = null;      // Uint8Array built once on first use
    this.enemyPaths = new Map(); // enemyId -> { waypoints, wpIndex, lastTargetPos }
    /** Per-tick cache — avoids repeated Array.from(getEnemies()) in hot paths. */
    this._tickEnemies = null;
    this._meleePeerGrid = null;
    /** Pooled A* typed arrays (reused across path recomputes). */
    this._astarGScore = null;
    this._astarCameFrom = null;
    this._astarInOpen = null;
    /** Skip repeated full scans once allied knights are combat-active. */
    this.alliedCombatStarted = false;
    /** Per-enemy pending timeout handles cleared on death. */
    this.enemyPendingTimeouts = new Map();

    // Templar Blink Smite: timestamp when next cast is allowed (per templar; initialized on first aggro)
    this.templarBlinkSmiteNextAt = new Map();
    this.templarLeapCooldown = new Map();
    this.templarLeapEndAt = new Map();
    this.templarLeapLand = new Map();
    this.templarLeapFrom = new Map();
    this.templarLeapTimeout = new Map();

    /** tentacle-spine id -> windup slam setTimeout id */
    this.tentacleSlamTimeouts = new Map();

    /** Pending move updates collected within one AI tick; flushed as a single batch event. */
    this._pendingMoves = new Map(); // enemyId -> { position, rotation }
  }

  setRoom(room) {
    this.room = room;
  }

  _isStatTrialArena() {
    const kind = this.room?.currentCoopRoomKind;
    return kind === 'stat' || kind === 'trial';
  }

  /** Clamp enemy XZ to the active arena footprint (circle for colored rooms, hex for stat/trial). */
  clampToArenaXZ(x, z) {
    if (this._isStatTrialArena()) {
      return clampToMainHexXZ(x, z, HEX_INNER_APOTHEM);
    }
    return clampToCircleXZ(x, z);
  }

  _arenaPatrolRadius() {
    if (this._isStatTrialArena()) {
      return HEX_INNER_APOTHEM * TITAN_PATROL_RADIUS_FRAC;
    }
    return MAIN_CIRCLE_INNER_RADIUS * TITAN_PATROL_RADIUS_FRAC;
  }

  /** Record a position update to be sent as a batch at end of the current AI tick. */
  _queueMove(enemyId, position, rotation) {
    this._pendingMoves.set(enemyId, { position, rotation });
  }

  /** Emit all queued position updates as a single `enemies-moved` batch event. */
  _flushMoves() {
    if (!this.io || this._pendingMoves.size === 0) return;
    const moves = [];
    this._pendingMoves.forEach((m, id) => {
      moves.push({ enemyId: id, position: m.position, rotation: m.rotation });
    });
    this.io.to(this.roomId).emit('enemies-moved', { moves, timestamp: Date.now() });
    this._pendingMoves.clear();
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
    this.bossCombatStartedMs.clear();
    this.bossThrowLeapSharedCdUntil.clear();
    this.boss2ArchonLightningCooldown.clear();
    this.boss2ArchonLightningLockUntil.clear();
    this.boss2ArchonLightningTimeout.forEach((t) => clearTimeout(t));
    this.boss2ArchonLightningTimeout.clear();
    this.boss2ArchonLightningComboPhase.clear();
    this.boss2BlinkCooldown.clear();
    this.boss2DeathGraspTimeouts.forEach((timers) => {
      (timers || []).forEach((t) => clearTimeout(t));
    });
    this.boss2DeathGraspTimeouts.clear();
    this.boss2FlamePillarTimeouts.forEach((ids) => {
      (ids || []).forEach((t) => clearTimeout(t));
    });
    this.boss2FlamePillarTimeouts.clear();
    this.boss2WarlockSummonLastAt.clear();
    this.boss3NovaWindupTimeout.forEach((t) => clearTimeout(t));
    this.boss3NovaWindupTimeout.clear();
    this.boss3NovaBurstTimeouts.forEach((timeouts) => {
      (timeouts || []).forEach((t) => clearTimeout(t));
    });
    this.boss3NovaBurstTimeouts.clear();
    this.boss3NovaSweepInterval.forEach((set) => {
      (set || []).forEach((t) => clearInterval(t));
    });
    this.boss3NovaSweepInterval.clear();
    this.boss3LightningInterval.forEach((t) => clearInterval(t));
    this.boss3LightningInterval.clear();
    this.boss3GreenBeamDamageInterval.forEach((t) => clearInterval(t));
    this.boss3GreenBeamDamageInterval.clear();
    this.boss3GreenBeamEndAt.clear();
    this.boss3GreenBeamStages.clear();
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
    this.warlockOrbIntervals.forEach((set) => set.forEach((iv) => clearInterval(iv)));
    this.warlockOrbIntervals.clear();
    this.warlockArchonShockTimeout.forEach((t) => clearTimeout(t));
    this.warlockArchonShockTimeout.clear();
    this.warlockArchonShockCooldown.clear();
    this.warlockArchonShockLockUntil.clear();
    this.shadeBlinkCooldown.clear();
    this.viperAttackCooldown.clear();
    this.viperFollowupTimeout.forEach((t) => clearTimeout(t));
    this.viperFollowupTimeout.clear();
    this.weaverHealCooldown.clear();
    this.weaverSummonCooldown.clear();
    this.weaverLightningCooldown.clear();
    this.weaverImpaleSpikePendingTimeouts.forEach((ids) => {
      (ids || []).forEach((tid) => clearTimeout(tid));
    });
    this.weaverImpaleSpikePendingTimeouts.clear();
    this.weaverImpaleSpikeCooldown.clear();
    this.weaverCastLockUntil.clear();
    this.weaverSummonedGhouls.clear();
    this.playerZombiesByOwner.clear();
    this.alliedProtectionThreat.clear();
    this.ghoulAttackCooldown.clear();
    this.titanAttackCooldown.clear();
    this.titanBladestormPowerupTimeout.forEach((t) => clearTimeout(t));
    this.titanBladestormPowerupTimeout.clear();
    this.titanStompCooldown.clear();
    this.titanStompWindupTimeout.forEach((t) => clearTimeout(t));
    this.titanStompWindupTimeout.clear();
    this.titanStompShockwaveInterval.forEach((id) => clearInterval(id));
    this.titanStompShockwaveInterval.clear();
    this.titanCannonCooldown.clear();
    this.titanCannonWindupTimeout.forEach((t) => clearTimeout(t));
    this.titanCannonWindupTimeout.clear();
    this.titanRedCannonCharges.clear();
    this.titanRedCannonLastCastAt.clear();
    this.ghoulLeapCooldown.clear();
    this.ghoulLeapEndAt.clear();
    this.ghoulLeapLand.clear();
    this.ghoulLeapFrom.clear();
    this.ghoulLeapTimeout.forEach((t) => clearTimeout(t));
    this.ghoulLeapTimeout.clear();
    this.meleeLockUntil.clear();
    this.knightAbilityCooldown.clear();
    this.knightSmiteCooldown.clear();
    this.knightDashCooldown.clear();
    this.knightSpinCooldown.clear();
    this.knightDeathGraspCooldown.clear();
    this.enemyPaths.clear();
    this.templarBlinkSmiteNextAt.clear();
    this.templarLeapCooldown.clear();
    this.templarLeapEndAt.clear();
    this.templarLeapLand.clear();
    this.templarLeapFrom.clear();
    this.templarLeapTimeout.forEach((t) => clearTimeout(t));
    this.templarLeapTimeout.clear();
    this.alliedCombatStarted = false;
    for (const pending of this.enemyPendingTimeouts.values()) {
      for (const handle of pending) clearTimeout(handle);
    }
    this.enemyPendingTimeouts.clear();
  }

  updateAI() {
    if (!this.room || !this.room.getGameStarted()) return;
    if (this.room.isCoopCombatTransitionActive && this.room.isCoopCombatTransitionActive()) return;

    const enemies = this.room.getEnemies();
    const players = this.room.getPlayers();
    this._tickEnemies = enemies;
    this._meleePeerGrid = this._buildMeleePeerGrid(enemies);
    
    if (enemies.length === 0 || players.length === 0) {
      this._tickEnemies = null;
      this._meleePeerGrid = null;
      return;
    }
    
    // Update each enemy's AI
    enemies.forEach(enemy => {
      if (enemy.isDying) return;
      
      this.updateEnemyAI(enemy, players);
    });

    // Emit all position updates accumulated during this tick as a single batch
    this._flushMoves();
    this._tickEnemies = null;
    this._meleePeerGrid = null;
  }

  /** Co-op portal loading gate — skip emitting player-bound melee hit events. */
  coopTransitionBlocksOutgoingPlayerHits() {
    return (
      typeof this.room?.isCoopCombatTransitionActive === 'function' &&
      this.room.isCoopCombatTransitionActive()
    );
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

    if (enemy.type === 'titan') {
      this.updateTitanAI(enemy, players);
      return;
    }

    if (enemy.type === 'allied-knight') {
      this.updateAlliedKnightAI(enemy, players);
      return;
    }

    if (enemy.type === 'allied-healer') {
      this.updateAlliedHealerAI(enemy, players);
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

    // Bonus wandering/fleeing enemy (10% chance per countable combat room wave)
    if (enemy.type === 'greed') {
      this.updateGreedAI(enemy, players);
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
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    const damage = skeleton.damage || 17;
    this.recordAlliedProtectionThreat(skeleton.id, player.id, damage);

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
    const aggroRadius = 15;

    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);
    const thronePrepKnight =
      knight.throneKnight === true &&
      this.room &&
      this.room.gameMode === 'coop' &&
      !this.room.combatArenaActive;
    const losOk =
      thronePrepKnight || this.hasLineOfSight(knight.position, tpos);
    if (!aggroData.isAggroed && distance <= aggroRadius && losOk) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }
    this._maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius);

    if (!aggroData.isAggroed) {
      return;
    }

    const now = Date.now();

    const lockUntil = this.meleeLockUntil.get(knight.id) || 0;
    if (now < lockUntil) return;

    if (resolved.kind === 'player') {
      const targetPlayer = resolved.player;
      if (this.tryKnightSpinAttack(knight, targetPlayer, now, distance)) return;
      if (this.tryKnightDash(knight, targetPlayer, now, distance)) return;

      const deathGraspFired = this.tryKnightDeathGrasp(knight, targetPlayer, now, distance);
      if (deathGraspFired) return;

      if (this.tryKnightSmiteUnlocked(knight, targetPlayer, now, distance, attackRange)) return;

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

      if (z.type !== 'allied-knight') {
        const deathGraspFired = this.tryKnightDeathGrasp(knight, fakeTarget, now, distance);
        if (deathGraspFired) return;
      }

      if (this.tryKnightSmiteUnlocked(knight, fakeTarget, now, distance, attackRange)) return;

      const abilityFired = this.tryKnightAbility(knight, fakeTarget, now, distance, attackRange);
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
      this._queueMove(knight.id, knight.position, knight.rotation);
    }

    return true;
  }

  tryKnightSpinAttack(knight, targetPlayer, now, distance) {
    if (this.room?.isEnemyAffectedBy(knight.id, 'freeze')) return false;
    if (this.room?.isEnemyAffectedBy(knight.id, 'stun')) return false;
    if (!targetPlayer?.position || targetPlayer.health <= 0) return false;
    if (distance > KNIGHT_SPIN_CAST_RANGE) return false;

    const lastSpin = this.knightSpinCooldown.get(knight.id) || 0;
    if (now - lastSpin < KNIGHT_SPIN_COOLDOWN_MS) return false;

    const dx = targetPlayer.position.x - knight.position.x;
    const dz = targetPlayer.position.z - knight.position.z;
    const mag = Math.sqrt(dx * dx + dz * dz);
    if (mag < 1e-4) return false;

    const dirX = dx / mag;
    const dirZ = dz / mag;
    knight.rotation = Math.atan2(dirX, dirZ);

    this.knightSpinCooldown.set(knight.id, now);
    this.meleeLockUntil.set(knight.id, now + KNIGHT_SPIN_CHARGE_MS + KNIGHT_SPIN_TRAVEL_MS);
    this.enemyPaths.delete(knight.id);

    const chargePosition = { ...knight.position };
    if (this.io) {
      this.io.to(this.roomId).emit('knight-spin-charge', {
        knightId: knight.id,
        targetPlayerId: targetPlayer.id,
        position: chargePosition,
        rotation: knight.rotation,
        chargeMs: KNIGHT_SPIN_CHARGE_MS,
        timestamp: Date.now(),
      });
      this._queueMove(knight.id, knight.position, knight.rotation);
    }

    const originalTargetId = targetPlayer.id;
    const originalAim = { ...targetPlayer.position };
    setTimeout(() => {
      if (knight.isDying || !this.room?.getGameStarted()) return;
      if (this.room?.isEnemyAffectedBy(knight.id, 'stun')) return;
      if (this.room?.isEnemyAffectedBy(knight.id, 'freeze')) return;

      const currentPlayers = this.room?.getPlayers?.() || [];
      const liveTarget = currentPlayers.find(p => p.id === originalTargetId && p.health > 0);
      const aimPosition = liveTarget?.position || originalAim;
      const aimDx = aimPosition.x - knight.position.x;
      const aimDz = aimPosition.z - knight.position.z;
      const aimMag = Math.sqrt(aimDx * aimDx + aimDz * aimDz);
      if (aimMag < 1e-4) return;

      const spinDirX = aimDx / aimMag;
      const spinDirZ = aimDz / aimMag;
      const startPosition = { ...knight.position };
      const rawX = knight.position.x + spinDirX * KNIGHT_SPIN_DISTANCE;
      const rawZ = knight.position.z + spinDirZ * KNIGHT_SPIN_DISTANCE;

      let resolved = this.resolveEnemyWallCollisions(rawX, rawZ);
      resolved = this.resolveMeleePeerSeparation(knight, resolved.x, resolved.z);

      const moved = Math.hypot(resolved.x - knight.position.x, resolved.z - knight.position.z);
      if (moved < 0.5) return;

      knight.position.x = resolved.x;
      knight.position.z = resolved.z;
      knight.rotation = Math.atan2(spinDirX, spinDirZ);

      const endPosition = { ...knight.position };
      if (this.io) {
        this.io.to(this.roomId).emit('knight-spin-dash', {
          knightId: knight.id,
          targetPlayerId: originalTargetId,
          startPosition,
          endPosition,
          rotation: knight.rotation,
          distance: moved,
          durationMs: KNIGHT_SPIN_TRAVEL_MS,
          damage: KNIGHT_SPIN_DAMAGE,
          timestamp: Date.now(),
        });
        this._queueMove(knight.id, knight.position, knight.rotation);
      }

      this.scheduleKnightSpinPathDamage(knight, startPosition, endPosition);
    }, KNIGHT_SPIN_CHARGE_MS);

    return true;
  }

  scheduleKnightSpinPathDamage(knight, startPosition, endPosition) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;

    const hitPlayerIds = new Set();
    const startedAt = Date.now();
    const sampleEveryMs = 50;
    const sx = startPosition.x;
    const sz = startPosition.z;
    const ex = endPosition.x;
    const ez = endPosition.z;
    const pathX = ex - sx;
    const pathZ = ez - sz;
    const pathLen = Math.hypot(pathX, pathZ);
    if (pathLen < 1e-4) return;

    const applyHitsForProgress = (progress) => {
      if (knight.isDying || !this.room?.getGameStarted()) return false;

      const currentX = sx + pathX * progress;
      const currentZ = sz + pathZ * progress;
      const segX = currentX - sx;
      const segZ = currentZ - sz;
      const segLenSq = segX * segX + segZ * segZ;
      if (segLenSq < 1e-4) return true;

      const players = this.room?.getPlayers?.() || [];
      for (const player of players) {
        if (!player || player.health <= 0 || hitPlayerIds.has(player.id)) continue;

        const px = player.position.x - sx;
        const pz = player.position.z - sz;
        const t = Math.max(0, Math.min(1, (px * segX + pz * segZ) / segLenSq));
        const closestX = sx + segX * t;
        const closestZ = sz + segZ * t;
        const perpendicular = Math.hypot(player.position.x - closestX, player.position.z - closestZ);
        if (perpendicular > KNIGHT_SPIN_STRIP_HALF_WIDTH) continue;

        hitPlayerIds.add(player.id);
        this.recordAlliedProtectionThreat(knight.id, player.id, KNIGHT_SPIN_DAMAGE);
        if (this.io) {
          this.io.to(this.roomId).emit('knight-spin-hit', {
            knightId: knight.id,
            targetPlayerId: player.id,
            damage: KNIGHT_SPIN_DAMAGE,
            position: { x: closestX, y: startPosition.y ?? 0, z: closestZ },
            timestamp: Date.now(),
          });
        }
      }

      return true;
    };

    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(1, elapsed / KNIGHT_SPIN_TRAVEL_MS);
      const shouldContinue = applyHitsForProgress(progress);
      if (!shouldContinue || progress >= 1) {
        clearInterval(interval);
      }
    }, sampleEveryMs);
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
        this._queueMove(knight.id, knight.position, knight.rotation);
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
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    const damage = knight.damage || 25;
    this.recordAlliedProtectionThreat(knight.id, player.id, damage);

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

    this.room?.tryDamageAlliedKnightInXZDisk(
      { x: knight.position.x, z: knight.position.z },
      2.6,
      damage,
      { sourceEnemyId: knight.id, damageType: 'knight_melee' },
    );
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
    const CAST_LAUNCH_MS = 700; // with blue frost
    const PROJECTILE_TRAVEL_MS = 425;
    const HIT_RADIUS = 1.35; // XZ — same as frost
    const STANDOFF = 1.2;

    const tdx = targetPlayer.position.x - knight.position.x;
    const tdz = targetPlayer.position.z - knight.position.z;
    if (tdx !== 0 || tdz !== 0) {
      knight.rotation = Math.atan2(tdx, tdz);
    }

    if (this.io) {
      this._queueMove(knight.id, knight.position, knight.rotation);
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

  /** Post-boss-2: blue/green/purple gain Smite on a separate cooldown from Frost/Heal. */
  tryKnightSmiteUnlocked(knight, targetPlayer, now, distance, meleeRange) {
    if ((this.room?.coopBossesDefeatedCount ?? 0) < KNIGHT_SMITE_UNLOCK_BOSS_COUNT) return false;
    if (knight.soulType === 'red') return false;
    if (distance > meleeRange) return false;

    const lastSmite = this.knightSmiteCooldown.get(knight.id) || 0;
    if (now - lastSmite < KNIGHT_SMITE_COOLDOWN_MS) return false;

    this.knightSmiteCooldown.set(knight.id, now);
    this.meleeLockUntil.set(knight.id, now + KNIGHT_SMITE_LOCK_MS);
    this.knightCastSmite(knight, targetPlayer);
    return true;
  }

  tryKnightAbility(knight, targetPlayer, now, distance, meleeRange) {
    const lastAbility = this.knightAbilityCooldown.get(knight.id) || 0;

    switch (knight.soulType) {
      // ── Red: Smite — powered melee slam (75 dmg pre-boss-2, 125 post-boss-2) ──
      case 'red': {
        if (now - lastAbility < KNIGHT_SMITE_COOLDOWN_MS) return false;
        if (distance > meleeRange) return false;

        this.knightAbilityCooldown.set(knight.id, now);
        this.meleeLockUntil.set(knight.id, now + KNIGHT_SMITE_LOCK_MS);
        this.knightCastSmite(knight, targetPlayer);
        return true;
      }

      // ── Green: Aggro Shout — self-heal for 150 HP (11 s CD) ─────────
      case 'green': {
        const CD = 11000;
        if (now - lastAbility < CD) return false;
        // Self-heal is useful only below max HP
        if (knight.health >= knight.maxHealth) return false;

        this.knightAbilityCooldown.set(knight.id, now);
        // Aggro animation takes 1 800 ms — lock movement for the full duration
        this.meleeLockUntil.set(knight.id, now + 1800);
        this.knightCastHeal(knight);
        return true;
      }

      // ── Purple: Frost Ray — ranged freeze + 17 dmg (12 s CD, extended range) ──────
      case 'purple': {
        const CD = 12000;
        const FROST_RANGE = 13.0;
        if (now - lastAbility < CD) return false;
        if (distance > FROST_RANGE) return false;

        this.knightAbilityCooldown.set(knight.id, now);
        // Cast animation takes 2 000 ms — lock movement for the full duration
        this.meleeLockUntil.set(knight.id, now + 2000);
        this.knightCastFrost(knight, targetPlayer);
        return true;
      }

      // ── Blue: Storm Lash — channeled horizontal lightning zaps (12 s CD, close range) ──────
      case 'blue': {
        if (now - lastAbility < KNIGHT_STORM_LASH_COOLDOWN_MS) return false;
        if (distance > KNIGHT_STORM_LASH_RANGE) return false;

        this.knightAbilityCooldown.set(knight.id, now);
        this.meleeLockUntil.set(knight.id, now + KNIGHT_STORM_LASH_DURATION_MS);
        this.knightCastStormLash(knight, targetPlayer);
        return true;
      }

      default:
        return false;
    }
  }

  // Knight Smite — melee slam; damage/radius scale after Boss 2 defeat.
  knightCastSmite(knight, targetPlayer) {
    const boss2Unlocked = (this.room?.coopBossesDefeatedCount ?? 0) >= KNIGHT_SMITE_UNLOCK_BOSS_COUNT;
    const soulType = knight.soulType || 'red';
    const damage = boss2Unlocked
      ? (KNIGHT_SMITE_DAMAGE_POST_BOSS2[soulType] ?? 85)
      : (KNIGHT_SMITE_DAMAGE_PRE_BOSS2[soulType] ?? 75);
    const radius = boss2Unlocked ? KNIGHT_SMITE_RADIUS_POST_BOSS2 : KNIGHT_SMITE_RADIUS_BASE;
    const knightId = knight.id;
    const targetId = targetPlayer?.id;
    const timestamp = Date.now();

    if (this.io) {
      this.io.to(this.roomId).emit('knight-smite-telegraph', {
        knightId,
        targetPlayerId: targetId,
        soulType,
        radius,
        position: knight.position,
        timestamp,
      });
    }
    console.log(`⚡ ${soulType} Knight ${knightId} charging Smite at target ${targetId}!`);

    setTimeout(() => {
      const liveKnight = this.room?.getEnemy(knightId);
      if (!liveKnight || liveKnight.isDying || !this.room?.getGameStarted()) return;
      if (this.room?.isEnemyAffectedBy(knightId, 'stun')) return;

      const currentPlayers = this.room?.getPlayers();
      const currentTarget =
        currentPlayers && targetId
          ? currentPlayers.find(p => p.id === targetId)
          : null;

      if (currentTarget && currentTarget.health > 0) {
        const currentDistance = this.calculateDistance(liveKnight.position, currentTarget.position);
        if (currentDistance <= radius) {
          if (this.io) {
            this.io.to(this.roomId).emit('knight-smite', {
              knightId,
              targetPlayerId: currentTarget.id,
              soulType,
              damage,
              radius,
              position: liveKnight.position,
              targetPosition: {
                x: currentTarget.position.x,
                y: currentTarget.position.y + 1.0,
                z: currentTarget.position.z,
              },
              timestamp: Date.now(),
            });
          }
          console.log(`⚡ ${soulType} Knight ${knightId} SMITE hit player ${currentTarget.id} for ${damage} dmg!`);
        } else {
          console.log(`⚡ ${soulType} Knight ${knightId} Smite missed — player dodged!`);
        }
      }

      this.room?.tryDamageAlliedKnightInXZDisk(
        { x: liveKnight.position.x, z: liveKnight.position.z },
        radius,
        damage,
        { sourceEnemyId: knightId, damageType: 'knight_smite' },
      );
    }, KNIGHT_SMITE_IMPACT_DELAY_MS);
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

  // Blue Knight — Frost Ray (17 dmg + freeze on hit) — now used by Purple Knight
  knightCastFrost(knight, targetPlayer) {
    const FROST_CAST_LAUNCH_MS = 1000; // half of 2 s cast; matches client FROST_DURATION
    const FROST_PROJECTILE_TRAVEL_MS = 550;
    const FROST_HIT_RADIUS = 1.35; // XZ — dash out of this to dodge

    const fdx = targetPlayer.position.x - knight.position.x;
    const fdz = targetPlayer.position.z - knight.position.z;
    if (fdx !== 0 || fdz !== 0) {
      knight.rotation = Math.atan2(fdx, fdz);
    }

    if (this.io) {
      this._queueMove(knight.id, knight.position, knight.rotation);
      this.io.to(this.roomId).emit('knight-frost-telegraph', {
        knightId: knight.id,
        targetPlayerId: targetPlayer.id,
        timestamp: Date.now(),
      });
    }
    console.log(`🔵❄️ Knight ${knight.id} (${knight.soulType}) casting Frost Ray at player ${targetPlayer.id}!`);

    const targetId = targetPlayer.id;
    const knightId = knight.id;

    setTimeout(() => {
      if (!this.room?.getGameStarted()) return;
      const liveKnight = this.room?.getEnemy(knightId);
      if (!liveKnight || liveKnight.isDying) return;
      if (this.room?.isEnemyAffectedBy(knightId, 'stun')) return;

      const currentPlayers = this.room?.getPlayers();
      const launchTarget = currentPlayers?.find(p => p.id === targetId);
      const aimPos =
        launchTarget && launchTarget.health > 0 ? launchTarget.position : targetPlayer.position;

      const startPosition = {
        x: liveKnight.position.x,
        y: liveKnight.position.y + 1.5,
        z: liveKnight.position.z,
      };
      const endPosition = {
        x: aimPos.x,
        y: aimPos.y + 1.0,
        z: aimPos.z,
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
        const currentTarget = players?.find(p => p.id === targetId);

        if (currentTarget && currentTarget.health > 0) {
          const dx = currentTarget.position.x - snapX;
          const dz = currentTarget.position.z - snapZ;
          const distXZ = Math.sqrt(dx * dx + dz * dz);

          if (distXZ <= FROST_HIT_RADIUS) {
            this.room?.applyPlayerStatusEffect(currentTarget.id, 'freeze', 3500);
            if (this.io) {
              this.io.to(this.roomId).emit('knight-frost', {
                knightId,
                targetPlayerId: currentTarget.id,
                damage: 17,
                slowDuration: 3500,
                targetPosition: {
                  x: currentTarget.position.x,
                  y: currentTarget.position.y + 1.0,
                  z: currentTarget.position.z,
                },
                timestamp: Date.now(),
              });
            }
            console.log(`🔵❄️ Knight ${knightId} Frost Ray hit player ${currentTarget.id} for 17 dmg + freeze!`);
          } else {
            console.log(`🔵 Knight ${knightId} Frost Ray missed — player dodged!`);
          }
        }

        this.room?.tryDamageAlliedKnightInXZDisk(
          { x: snapX, z: snapZ },
          FROST_HIT_RADIUS,
          17,
          { sourceEnemyId: knightId, damageType: 'knight_frost' },
        );
      }, FROST_PROJECTILE_TRAVEL_MS);
    }, FROST_CAST_LAUNCH_MS);
  }

  // Blue Knight — Storm Lash (channeled horizontal lightning zaps, 20 dmg each)
  knightCastStormLash(knight, targetPlayer) {
    const knightId = knight.id;
    const targetId = targetPlayer.id;
    const BEAM_Y = knight.position.y + 1.1;

    const fdx = targetPlayer.position.x - knight.position.x;
    const fdz = targetPlayer.position.z - knight.position.z;
    if (fdx !== 0 || fdz !== 0) {
      knight.rotation = Math.atan2(fdx, fdz);
    }

    if (this.io) {
      this._queueMove(knight.id, knight.position, knight.rotation);
      this.io.to(this.roomId).emit('knight-stormlash-telegraph', {
        knightId,
        targetPlayerId: targetId,
        timestamp: Date.now(),
      });
    }
    console.log(`🔵⚡ Blue Knight ${knightId} channeling Storm Lash at player ${targetId}!`);

    const oldHandles = this.knightStormLashTimeouts.get(knightId);
    if (oldHandles) {
      for (const h of oldHandles) clearTimeout(h);
    }

    const handles = [];
    const zapCount = Math.floor(KNIGHT_STORM_LASH_DURATION_MS / KNIGHT_STORM_LASH_ZAP_INTERVAL_MS);

    for (let i = 1; i <= zapCount; i += 1) {
      const delayMs = i * KNIGHT_STORM_LASH_ZAP_INTERVAL_MS;
      const handle = setTimeout(() => {
        if (!this.room?.getGameStarted()) return;
        const liveKnight = this.room?.getEnemy(knightId);
        if (!liveKnight || liveKnight.isDying) return;
        if (this.room?.isEnemyAffectedBy(knightId, 'stun')) return;

        const players = this.room?.getPlayers();
        const liveTarget = players?.find(p => p.id === targetId);
        if (!liveTarget || liveTarget.health <= 0) return;

        const ax = liveKnight.position.x;
        const az = liveKnight.position.z;
        const dx = liveTarget.position.x - ax;
        const dz = liveTarget.position.z - az;
        const dist = Math.hypot(dx, dz) || 1;
        const ux = dx / dist;
        const uz = dz / dist;
        const reach = Math.min(dist, KNIGHT_STORM_LASH_RANGE);
        const bx = ax + ux * reach;
        const bz = az + uz * reach;
        const strikeAt = Date.now();
        const beams = [
          {
            startPosition: { x: ax, y: BEAM_Y, z: az },
            targetPosition: { x: bx, y: BEAM_Y, z: bz },
          },
        ];

        if (this.io) {
          this.io.to(this.roomId).emit('knight-storm-lash-zap', {
            knightId,
            beams,
            strikeAt,
            halfWidth: KNIGHT_STORM_LASH_HALF_WIDTH,
            damage: KNIGHT_STORM_LASH_ZAP_DAMAGE,
            timestamp: strikeAt,
          });
        }

        this.room?.damagePlayersInLineSegment(
          ax,
          az,
          bx,
          bz,
          KNIGHT_STORM_LASH_HALF_WIDTH,
          KNIGHT_STORM_LASH_ZAP_DAMAGE,
          'knight_storm_lash',
        );
      }, delayMs);
      handles.push(handle);
    }

    this.knightStormLashTimeouts.set(knightId, handles);
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
    const aggroRadius = 15;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);

    if (!aggroData.isAggroed && distance <= aggroRadius && this.hasLineOfSight(shade.position, tpos)) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }
    this._maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius);

    if (!aggroData.isAggroed) return;

    const dx = tpos.x - shade.position.x;
    const dz = tpos.z - shade.position.z;
    shade.rotation = Math.atan2(dx, dz);
    this._queueMove(shade.id, shade.position, shade.rotation);

    if (distance <= attackRange) {
      const blinkCooldown = 5250;
      const lastBlinkTime = this.shadeBlinkCooldown.get(shade.id) || 0;
      const now = Date.now();

      if (now - lastBlinkTime >= blinkCooldown) {
        this.shadeBlinkCooldown.set(shade.id, now);
        if (resolved.kind === 'player') {
          if (this.room?.isEnemyAffectedBy(shade.id, 'freeze')) {
            this.telegraphShadeAttack(shade, resolved.player);
            this.scheduleAllyShadeDaggerChecks(
              shade.id,
              resolved.player.position.x,
              resolved.player.position.z,
              this.getShadeDaggerDelays(shade),
            );
          } else {
            this.shadeCastBlinkAndAttack(shade, resolved.player);
          }
        } else if (resolved.kind === 'zombie') {
          const z = resolved.zombie;
          const fakeTarget = { id: z.ownerPlayerId || z.id, position: z.position };
          this.telegraphShadeAttack(shade, fakeTarget);
          this.scheduleAllyShadeDaggerChecks(
            shade.id,
            z.position.x,
            z.position.z,
            this.getShadeDaggerDelays(shade),
          );
          const zid = z.id;
          const shadeId = shade.id;
          this.getShadeDaggerDelays(shade).forEach((delay) => {
            setTimeout(() => {
              if (shade.isDying || !this.room?.getGameStarted()) return;
              if (this.room?.isEnemyAffectedBy(shadeId, 'stun')) return;
              const zz = this.room?.getEnemy(zid);
              if (!zz || zz.isDying || zz.health <= 0) return;
              if (this.calculateDistance(shade.position, zz.position) > attackRange + 1.5) return;
              this.damagePlayerZombieFromMob({ id: shadeId }, zz, shade.damage || 25, 'shade_dagger');
            }, delay);
          });
        } else {
          const tr = resolved.trap;
          this.telegraphShadeAttack(shade, { id: tr.id, position: tr.position });
          this.scheduleAllyShadeDaggerChecks(
            shade.id,
            tr.position.x,
            tr.position.z,
            this.getShadeDaggerDelays(shade),
          );
          const trapId = tr.id;
          const shadeId = shade.id;
          this.getShadeDaggerDelays(shade).forEach((delay) => {
            setTimeout(() => {
              if (shade.isDying || !this.room?.getGameStarted()) return;
              if (this.room?.isEnemyAffectedBy(shadeId, 'stun')) return;
              const tt = this.room?.getEnemy(trapId);
              if (!tt || tt.isDying || tt.health <= 0 || tt.type !== 'tentacle-spine') return;
              if (this.calculateDistance(shade.position, tt.position) > attackRange + 1.5) return;
              this.room.damageEnemy(trapId, shade.damage || 25, null, null, {
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

      this.scheduleAllyShadeDaggerChecks(
        shade.id,
        currentTarget.position.x,
        currentTarget.position.z,
        this.getShadeDaggerDelays(shade),
      );

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
    let rawX = shade.position.x + blinkX * blinkDist;
    let rawZ = shade.position.z + blinkZ * blinkDist;

    // Clamp inside the main hex arena.
    const clamped = this.clampToArenaXZ(rawX, rawZ);
    rawX = clamped.x;
    rawZ = clamped.z;

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
        damage: shade.damage || 25,
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
    this._maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius);

    if (!aggroData.isAggroed) return;

    const dx = tpos.x - warlock.position.x;
    const dz = tpos.z - warlock.position.z;
    warlock.rotation = Math.atan2(dx, dz);
    this._queueMove(warlock.id, warlock.position, warlock.rotation);

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

    if ((this.room?.coopBossesDefeatedCount ?? 0) >= WARLOCK_ARCHON_SHOCK_UNLOCK_BOSS_COUNT) {
      const shockLockUntil = this.warlockArchonShockLockUntil.get(warlock.id) || 0;
      if (now < shockLockUntil) {
        return;
      }

      const lastShock = this.warlockArchonShockCooldown.get(warlock.id) || 0;
      if (
        distance <= WARLOCK_ARCHON_SHOCK_RANGE &&
        now - lastShock >= WARLOCK_ARCHON_SHOCK_COOLDOWN_MS &&
        !this.room?.isEnemyAffectedBy(warlock.id, 'freeze')
      ) {
        this.warlockCastArchonShock(warlock, targetPlayer);
        return;
      }
    }

    if (isPurpleWarlock) {
      if (!this.warlockMeteorCooldown.has(warlock.id)) {
        this.warlockMeteorCooldown.set(warlock.id, now);
      }
      const lastMeteorTime = this.warlockMeteorCooldown.get(warlock.id) || 0;
      const meteorCooldown = 12000;
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

  warlockCastArchonShock(warlock, targetPlayer) {
    const now = Date.now();
    const strikeAt = now + WARLOCK_ARCHON_SHOCK_WINDUP_MS;
    this.warlockArchonShockCooldown.set(warlock.id, now);
    this.warlockArchonShockLockUntil.set(warlock.id, strikeAt + 300);

    const sx = warlock.position.x;
    const sz = warlock.position.z;
    const ty = targetPlayer.position.y + 1.1;
    const tx = targetPlayer.position.x;
    const tz = targetPlayer.position.z;
    const warlockSkyY = warlock.position.y + 3.0;

    const beams = [
      {
        startPosition: { x: sx, y: warlockSkyY, z: sz },
        targetPosition: { x: tx, y: ty, z: tz },
      },
    ];
    const startPosition = beams[0].startPosition;
    const targetPosition = beams[0].targetPosition;

    if (this.io) {
      this.io.to(this.roomId).emit('warlock-archon-shock', {
        warlockId: warlock.id,
        startPosition,
        targetPosition,
        beams,
        strikeAt,
        halfWidth: WARLOCK_ARCHON_SHOCK_HALF_WIDTH,
        damage: WARLOCK_ARCHON_SHOCK_DAMAGE,
        timestamp: now,
      });
    }

    const seg = {
      ax: startPosition.x,
      az: startPosition.z,
      bx: targetPosition.x,
      bz: targetPosition.z,
    };

    const handle = setTimeout(() => {
      this.warlockArchonShockTimeout.delete(warlock.id);
      const liveWarlock = this.room?.enemies?.get(warlock.id);
      if (!liveWarlock || liveWarlock.isDying || liveWarlock.health <= 0) return;
      if (!this.room) return;
      this.room.damagePlayersInLineSegment(
        seg.ax,
        seg.az,
        seg.bx,
        seg.bz,
        WARLOCK_ARCHON_SHOCK_HALF_WIDTH,
        WARLOCK_ARCHON_SHOCK_DAMAGE,
        'warlock_archon_shock',
      );
    }, WARLOCK_ARCHON_SHOCK_WINDUP_MS);

    const oldHandle = this.warlockArchonShockTimeout.get(warlock.id);
    if (oldHandle) clearTimeout(oldHandle);
    this.warlockArchonShockTimeout.set(warlock.id, handle);
  }

  warlockCastBlink(warlock, targetPlayer) {
    const startPosition = { ...warlock.position };

    // Direction from warlock toward target
    const dx  = targetPlayer.position.x - warlock.position.x;
    const dz  = targetPlayer.position.z - warlock.position.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len === 0) return;

    const blinkDist = 7.5; // Teleport 5 units closer
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
        damage:    WARLOCK_FLAME_DAMAGE,
        radius:    WARLOCK_FLAME_RADIUS,
        timestamp: Date.now()
      });
    }

    console.log(`🔮 Warlock ${warlock.id} blinked 5 units closer to player ${targetPlayer.id}`);

    const flameXZ = { x: endPosition.x, z: endPosition.z };
    const wid = warlock.id;
    setTimeout(() => {
      if (!this.room?.getGameStarted()) return;
      const w = this.room?.getEnemy(wid);
      if (!w || w.isDying) return;
      this.room.damagePlayersInHorizontalRing(
        flameXZ,
        WARLOCK_FLAME_RADIUS,
        WARLOCK_FLAME_DAMAGE,
        'warlock_flame_strike',
        { sourceEnemyId: wid },
      );
      this.room.tryDamageAlliedKnightInXZDisk(flameXZ, WARLOCK_FLAME_RADIUS, WARLOCK_FLAME_DAMAGE, {
        sourceEnemyId: wid,
        damageType: 'warlock_flame_strike',
      });
    }, WARLOCK_BLINK_FLAME_DELAY_MS);
  }

  clearWarlockOrbIntervals(warlockId) {
    const set = this.warlockOrbIntervals.get(warlockId);
    if (set) {
      set.forEach((iv) => clearInterval(iv));
    }
    this.warlockOrbIntervals.delete(warlockId);
  }

  addWarlockOrbInterval(warlockId, intervalId) {
    let set = this.warlockOrbIntervals.get(warlockId);
    if (!set) {
      set = new Set();
      this.warlockOrbIntervals.set(warlockId, set);
    }
    set.add(intervalId);
  }

  removeWarlockOrbInterval(warlockId, intervalId) {
    const set = this.warlockOrbIntervals.get(warlockId);
    if (set) {
      set.delete(intervalId);
      if (set.size === 0) this.warlockOrbIntervals.delete(warlockId);
    }
  }

  warlockOrbGetTargetPos(targetId) {
    const players = this.room?.getPlayers();
    const target = players?.find((p) => p.id === targetId);
    if (!target || target.health <= 0) return null;
    return {
      x: target.position.x,
      y: target.position.y + 1.0,
      z: target.position.z,
    };
  }

  /** Orb state at charge-end launch — re-aims at live target (matches WarlockProjectile.tsx). */
  createWarlockOrbState(start, targetId) {
    const targetPos = this.warlockOrbGetTargetPos(targetId);
    if (!targetPos) return null;

    let dx = targetPos.x - start.x;
    let dy = targetPos.y - start.y;
    let dz = targetPos.z - start.z;
    const dLen = Math.hypot(dx, dy, dz) || 1e-6;
    dx /= dLen;
    dy /= dLen;
    dz /= dLen;

    return {
      px: start.x,
      py: start.y,
      pz: start.z,
      dx,
      dy,
      dz,
      elapsed: 0,
      maxFlightSec: (dLen / WARLOCK_ORB_SPEED) * 1.5,
      targetId,
    };
  }

  /**
   * Advance chaos orb one tick. Matches WarlockProjectile.tsx homing + XZ hit test.
   * Returns { hit, impact, done }.
   */
  stepWarlockOrb(state, dt) {
    const HIT_RADIUS_SQ = WARLOCK_ORB_HIT_RADIUS * WARLOCK_ORB_HIT_RADIUS;
    const liveTarget = this.warlockOrbGetTargetPos(state.targetId);
    if (!liveTarget) {
      return {
        hit: false,
        impact: { x: state.px, y: state.py, z: state.pz },
        done: true,
      };
    }

    let toX = liveTarget.x - state.px;
    let toY = liveTarget.y - state.py;
    let toZ = liveTarget.z - state.pz;
    const toLen = Math.hypot(toX, toY, toZ);
    if (toLen > 0.5) {
      toX /= toLen;
      toY /= toLen;
      toZ /= toLen;
      const lerpT = Math.min(1, WARLOCK_ORB_TURN_RATE * dt);
      state.dx += (toX - state.dx) * lerpT;
      state.dy += (toY - state.dy) * lerpT;
      state.dz += (toZ - state.dz) * lerpT;
      const dLen = Math.hypot(state.dx, state.dy, state.dz) || 1e-6;
      state.dx /= dLen;
      state.dy /= dLen;
      state.dz /= dLen;
    }

    state.px += state.dx * WARLOCK_ORB_SPEED * dt;
    state.py += state.dy * WARLOCK_ORB_SPEED * dt;
    state.pz += state.dz * WARLOCK_ORB_SPEED * dt;
    state.elapsed += dt;

    const players = this.room?.getPlayers();
    if (players) {
      for (const p of players) {
        if (!p || p.health <= 0) continue;
        const pdx = p.position.x - state.px;
        const pdz = p.position.z - state.pz;
        if (pdx * pdx + pdz * pdz <= HIT_RADIUS_SQ) {
          return {
            hit: true,
            impact: { x: state.px, y: state.py, z: state.pz },
            done: true,
          };
        }
      }
    }

    return {
      hit: false,
      impact: { x: state.px, y: state.py, z: state.pz },
      done: state.elapsed >= state.maxFlightSec,
    };
  }

  emitWarlockOrbImpact(warlockId, position, hit) {
    if (!this.io) return;
    this.io.to(this.roomId).emit('warlock-orb-impact', {
      warlockId,
      position: {
        x: position.x,
        y: position.y,
        z: position.z,
      },
      hit: !!hit,
      timestamp: Date.now(),
    });
  }

  startWarlockOrbFlight(warlockId, start, targetId) {
    const state = this.createWarlockOrbState(start, targetId);
    if (!state) return;

    const STEP_MS = 50;
    const intervalId = setInterval(() => {
      if (!this.room?.getGameStarted()) {
        clearInterval(intervalId);
        this.removeWarlockOrbInterval(warlockId, intervalId);
        return;
      }
      const liveWarlock = this.room?.getEnemy(warlockId);
      if (!liveWarlock || liveWarlock.isDying) {
        clearInterval(intervalId);
        this.removeWarlockOrbInterval(warlockId, intervalId);
        return;
      }

      const remaining = state.maxFlightSec - state.elapsed;
      const dt = Math.min(STEP_MS / 1000, remaining > 0 ? remaining : STEP_MS / 1000);
      const { hit, impact, done } = this.stepWarlockOrb(state, dt);

      if (hit && impact) {
        clearInterval(intervalId);
        this.removeWarlockOrbInterval(warlockId, intervalId);
        this.room.damagePlayersInHorizontalRing(
          { x: impact.x, z: impact.z },
          WARLOCK_ORB_HIT_RADIUS,
          WARLOCK_ORB_DAMAGE,
          'warlock_chaos_orb',
          { sourceEnemyId: warlockId },
        );
        this.room.tryDamageAlliedKnightInXZDisk(
          { x: impact.x, z: impact.z },
          WARLOCK_ORB_HIT_RADIUS,
          WARLOCK_ORB_DAMAGE,
          {
            sourceEnemyId: warlockId,
            damageType: 'warlock_chaos_orb',
          },
        );
        this.emitWarlockOrbImpact(warlockId, impact, true);
        return;
      }

      if (done && impact) {
        clearInterval(intervalId);
        this.removeWarlockOrbInterval(warlockId, intervalId);
        this.emitWarlockOrbImpact(warlockId, impact, false);
      }
    }, STEP_MS);

    this.addWarlockOrbInterval(warlockId, intervalId);
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
        damage: WARLOCK_ORB_DAMAGE,
        timestamp: Date.now()
      });
    }

    console.log(`🔮 Warlock ${warlock.id} launching chaotic orb at player ${targetPlayer.id}!`);

    const sx = warlock.position.x;
    const sy = warlock.position.y + 2.0;
    const sz = warlock.position.z;
    const wid = warlock.id;
    const targetId = targetPlayer.id;
    setTimeout(() => {
      if (!this.room?.getGameStarted()) return;
      const w = this.room?.getEnemy(wid);
      if (!w || w.isDying) return;

      this.startWarlockOrbFlight(wid, { x: sx, y: sy, z: sz }, targetId);
    }, WARLOCK_ORB_CHARGE_MS);
  }

  /** Random sky origin for purple warlock meteors — mirrors Crossentropy METEOR talent. */
  getWarlockMeteorStartPosition(center) {
    const angle = Math.random() * Math.PI * 2;
    const distance =
      WARLOCK_METEOR_SKY_OFFSET_MIN +
      Math.random() * (WARLOCK_METEOR_SKY_OFFSET_MAX - WARLOCK_METEOR_SKY_OFFSET_MIN);
    const height =
      WARLOCK_METEOR_SKY_HEIGHT_MIN +
      Math.random() * (WARLOCK_METEOR_SKY_HEIGHT_MAX - WARLOCK_METEOR_SKY_HEIGHT_MIN);
    return {
      x: center.x + Math.cos(angle) * distance,
      y: height,
      z: center.z + Math.sin(angle) * distance,
    };
  }

  /** Purple warlock: 2 meteors near the aggro target; client uses boss-meteor-cast + Meteor. */
  warlockCastMeteor(warlock, targetPlayer) {
    if (!targetPlayer) {
      return;
    }

    const y = targetPlayer.position.y;
    const clampXZ = (x, z) => ({ ...this.clampToArenaXZ(x, z), y });

    const x0 = targetPlayer.position.x;
    const z0 = targetPlayer.position.z;
    const primary = clampXZ(x0, z0);

    const offsetNearPrimary = () => {
      const r = WARLOCK_METEOR_OFFSET_MIN + Math.random() * (WARLOCK_METEOR_OFFSET_MAX - WARLOCK_METEOR_OFFSET_MIN);
      const a = Math.random() * Math.PI * 2;
      return clampXZ(x0 + Math.cos(a) * r, z0 + Math.sin(a) * r);
    };

    const targetPositions = Array.from({ length: WARLOCK_METEOR_COUNT }, (_, i) =>
      i === 0 ? primary : offsetNearPrimary(),
    );
    const startPositions = targetPositions.map((pos) => this.getWarlockMeteorStartPosition(pos));

    const meteorId = `meteor-${warlock.id}-${Date.now()}`;

    if (this.io) {
      this.io.to(this.roomId).emit('boss-meteor-cast', {
        bossId: warlock.id,
        meteorId: meteorId,
        targetPositions: targetPositions,
        startPositions: startPositions,
        timestamp: Date.now(),
        damage: WARLOCK_METEOR_PER_HIT_DAMAGE,
        staggerIntervalMs: WARLOCK_METEOR_STAGGER_MS,
      });
    }

    console.log(`☄️ Warlock ${warlock.id} casting meteor swarm (${WARLOCK_METEOR_COUNT} impacts near player ${targetPlayer.id})`);

    const wid = warlock.id;
    targetPositions.forEach((pos, index) => {
      const start = startPositions[index];
      const dx = pos.x - start.x;
      const dy = WARLOCK_METEOR_IMPACT_Y - start.y;
      const dz = pos.z - start.z;
      const travelMs = (Math.hypot(dx, dy, dz) / WARLOCK_METEOR_FALL_SPEED) * 1000;
      const delayMs = WARLOCK_METEOR_WARNING_MS + travelMs + index * WARLOCK_METEOR_STAGGER_MS;
      setTimeout(() => {
        if (!this.room?.getGameStarted()) return;
        const w = this.room?.getEnemy(wid);
        if (!w || w.isDying) return;
        this.room.tryDamageAlliedKnightInXZDisk(
          { x: pos.x, z: pos.z },
          WARLOCK_METEOR_DISK_RADIUS,
          WARLOCK_METEOR_PER_HIT_DAMAGE,
          { sourceEnemyId: wid, damageType: 'warlock_meteor' },
        );
        this.warlockSpawnMeteorEmberPatch(wid, { x: pos.x, z: pos.z });
      }, delayMs);
    });
  }

  /** Purple warlock — ground ember hazard at meteor impact; ticks player damage for its duration. */
  warlockSpawnMeteorEmberPatch(warlockId, position) {
    const now = Date.now();
    const zoneId = `warlock-meteor-ember-${warlockId}-${now}`;
    this.io?.to(this.roomId).emit('warlock-meteor-ember-zone-spawned', {
      id: zoneId,
      position: { x: position.x, z: position.z },
      radius: WARLOCK_METEOR_EMBER_RADIUS,
      durationMs: WARLOCK_METEOR_EMBER_DURATION_MS,
      timestamp: now,
    });
    let elapsed = 0;
    const intervalId = setInterval(() => {
      if (!this.room?.getGameStarted()) { clearInterval(intervalId); return; }
      elapsed += WARLOCK_METEOR_EMBER_TICK_MS;
      this.room?.damagePlayersInHorizontalRing(
        { x: position.x, z: position.z },
        WARLOCK_METEOR_EMBER_RADIUS,
        WARLOCK_METEOR_EMBER_DAMAGE,
        'warlock_meteor_ember',
        { sourceEnemyId: warlockId },
      );
      if (elapsed >= WARLOCK_METEOR_EMBER_DURATION_MS) {
        clearInterval(intervalId);
        this.io?.to(this.roomId).emit('warlock-meteor-ember-zone-expired', { id: zoneId, timestamp: Date.now() });
      }
    }, WARLOCK_METEOR_EMBER_TICK_MS);
  }

  // ─── Templar AI ──────────────────────────────────────────────────────────────

  updateTemplarAI(templar, players) {
    if (this.tickTemplarLeapFlight(templar)) return;

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
    const attackRange = 2.725;
    const attackCooldown = templar.attackCooldown ?? 2000;
    const aggroRadius = 15;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);

    if (!aggroData.isAggroed && distance <= aggroRadius && this.hasLineOfSight(templar.position, tpos)) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }
    this._maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius);

    if (!aggroData.isAggroed) return;

    const now = Date.now();

    if (!templar.isDying) {
      if (!this.templarBlinkSmiteNextAt.has(templar.id)) {
        this.templarBlinkSmiteNextAt.set(templar.id, now + TEMPLAR_BLINK_SMITE_INTERVAL_MS);
      } else if (now >= this.templarBlinkSmiteNextAt.get(templar.id)) {
        if (resolved.kind === 'player') {
          this.templarCastBlinkSmite(templar, resolved.player);
          this.templarBlinkSmiteNextAt.set(templar.id, now + TEMPLAR_BLINK_SMITE_INTERVAL_MS);
          return;
        }
        if (resolved.kind === 'zombie') {
          const z = resolved.zombie;
          const blinkTarget = {
            id: z.ownerPlayerId || z.id,
            position: z.position,
            rotation:
              typeof z.rotation === 'number' ? { y: z.rotation } : { y: templar.rotation || 0 },
          };
          this.templarCastBlinkSmite(templar, blinkTarget);
          this.templarBlinkSmiteNextAt.set(templar.id, now + TEMPLAR_BLINK_SMITE_INTERVAL_MS);
          return;
        }
      }
    }

    const lockUntil = this.meleeLockUntil.get(templar.id) || 0;
    if (now < lockUntil) return;

    const meleePressDistance = attackRange - MELEE_CLOSE_INSET;

    if (
      resolved.kind === 'player' &&
      (this.room?.coopBossesDefeatedCount ?? 0) >= 1 &&
      distance > attackRange
    ) {
      const canLeap =
        distance >= TEMPLAR_LEAP_MIN_RANGE &&
        (this.templarLeapCooldown.get(templar.id) == null ||
          now - (this.templarLeapCooldown.get(templar.id) || 0) >= TEMPLAR_LEAP_COOLDOWN_MS) &&
        !this.templarLeapEndAt.has(templar.id);
      if (canLeap) {
        this.templarStartLeap(templar, resolved.player);
        return;
      }
    }

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
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    const damage = templar.damage || 48;
    this.recordAlliedProtectionThreat(templar.id, player.id, damage);

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

    this.room?.tryDamageAlliedKnightInXZDisk(
      { x: templar.position.x, z: templar.position.z },
      2.6,
      damage,
      { sourceEnemyId: templar.id, damageType: 'templar_melee' },
    );
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

    const chargeStart = Date.now();
    const templarId = templar.id;
    const targetPlayerId = targetPlayer.id;

    const dx = targetPlayer.position.x - templar.position.x;
    const dz = targetPlayer.position.z - templar.position.z;
    const mag = Math.sqrt(dx * dx + dz * dz);
    if (mag > 1e-4) {
      templar.rotation = Math.atan2(dx / mag, dz / mag);
    }

    const totalLockMs = TEMPLAR_BLINK_SMITE_CHARGE_MS + TEMPLAR_BLINK_SMITE_ABILITY_LOCK_MS;
    this.meleeLockUntil.set(templar.id, chargeStart + totalLockMs);
    if (!this.bossAttackCooldown.has(templar.id)) {
      this.bossAttackCooldown.set(templar.id, 0);
    }
    this.bossAttackCooldown.set(templar.id, Math.max(
      this.bossAttackCooldown.get(templar.id) || 0,
      chargeStart + totalLockMs
    ));

    const chargePosition = { ...templar.position };
    if (this.io) {
      this._queueMove(templar.id, templar.position, templar.rotation);
      this.io.to(this.roomId).emit('templar-blink-smite-charge', {
        templarId: templar.id,
        targetPlayerId,
        position: chargePosition,
        rotation: templar.rotation,
        chargeMs: TEMPLAR_BLINK_SMITE_CHARGE_MS,
        timestamp: chargeStart,
      });
    }

    setTimeout(() => {
      if (!this.room?.getGameStarted()) return;
      const e = this.room?.enemies?.get(templarId);
      if (!e || e.isDying || e.type !== 'templar') return;

      const currentPlayers = this.room?.getPlayers?.() || [];
      const liveTarget = currentPlayers.find(p => p.id === targetPlayerId && p.health > 0);
      if (!liveTarget?.position) return;

      const { startPosition, endPosition } = this.teleportEnemyBehindTarget(e, liveTarget);
      const blinkTime = Date.now();
      if (this.io) {
        this._queueMove(e.id, e.position, e.rotation);
        this.io.to(this.roomId).emit('templar-teleport', {
          templarId: e.id,
          startPosition,
          endPosition,
          rotation: e.rotation,
          targetPlayerId,
          timestamp: blinkTime
        });
        this.io.to(this.roomId).emit('templar-blink-smite-windup', {
          templarId: e.id,
          targetPlayerId,
          timestamp: blinkTime
        });
      }

      setTimeout(() => {
        if (!this.room?.getGameStarted()) return;
        const templar = this.room?.enemies?.get(templarId);
        if (!templar || templar.isDying || templar.type !== 'templar') return;
        const r = templar.rotation || 0;
        const forwardX = Math.sin(r);
        const forwardZ = Math.cos(r);
        const smiteX = templar.position.x + forwardX * TEMPLAR_BLINK_SMITE_IMPACT_OFFSET;
        const smiteZ = templar.position.z + forwardZ * TEMPLAR_BLINK_SMITE_IMPACT_OFFSET;
        const smiteY = templar.position.y;
        if (this.io) {
          this.io.to(this.roomId).emit('templar-blink-smite-impact', {
            templarId: templar.id,
            position: { x: smiteX, y: smiteY, z: smiteZ },
            rotation: r,
            radius: TEMPLAR_BLINK_SMITE_RADIUS,
            damage: TEMPLAR_BLINK_SMITE_DAMAGE,
            timestamp: Date.now()
          });
        }
        this.room?.tryDamageAlliedKnightInXZDisk(
          { x: smiteX, z: smiteZ },
          TEMPLAR_BLINK_SMITE_RADIUS,
          TEMPLAR_BLINK_SMITE_DAMAGE,
          { sourceEnemyId: templar.id, damageType: 'templar_blink_smite' },
        );
      }, TEMPLAR_BLINK_SMITE_STRIKE_DELAY_MS);

      console.log(`🛡️ Templar ${e.id} Blink Smite — behind ${targetPlayerId}, strike in ${TEMPLAR_BLINK_SMITE_STRIKE_DELAY_MS}ms`);
    }, TEMPLAR_BLINK_SMITE_CHARGE_MS);
  }

  // ─── Viper AI ────────────────────────────────────────────────────────────────

  emitViperArrowOutcome(viperId, shotId, hit, position) {
    if (!this.io || !shotId || !position) return;
    this.io.to(this.roomId).emit('viper-arrow-outcome', {
      viperId,
      shotId,
      hit: !!hit,
      position: { x: position.x, y: position.y ?? 0, z: position.z },
      timestamp: Date.now(),
    });
  }

  _trackViperFollowupTimeout(viperId, timeoutId) {
    const prev = this.viperFollowupTimeout.get(viperId);
    if (prev) clearTimeout(prev);
    this.viperFollowupTimeout.set(viperId, timeoutId);
  }

  scheduleViperPlayerShot(viper, player, shotId, { drawDurationMs = VIPER_DRAWBOW_DURATION_MS } = {}) {
    this.telegraphViperAttack(viper, player, shotId);
    const startX = viper.position.x;
    const startZ = viper.position.z;
    const tx = player.position.x;
    const tz = player.position.z;
    const dx = tx - startX;
    const dz = tz - startZ;
    const len = Math.hypot(dx, dz) || 1e-6;
    const endX = startX + (dx / len) * VIPER_ARROW_MAX_RANGE;
    const endZ = startZ + (dz / len) * VIPER_ARROW_MAX_RANGE;
    const impactDelayMs = drawDurationMs + viperArrowFlightMs(
      { x: startX, y: viper.position.y + 1.5, z: startZ },
      { x: tx, y: player.position.y + 1.0, z: tz },
    );
    const pid = player.id;
    const vid = viper.id;
    setTimeout(() => {
      if (viper.isDying || !this.room?.getGameStarted()) return;
      const v = this.room?.getEnemy(vid);
      if (!v || v.isDying) return;
      const players = this.room?.getPlayers();
      const tp = players?.find(p => p.id === pid);
      if (!tp) {
        this.emitViperArrowOutcome(vid, shotId, false, v.position);
        return;
      }
      const playerHits = this.room?.damagePlayersInLineSegment?.(
        startX,
        startZ,
        endX,
        endZ,
        1.05,
        55,
        'viper_arrow',
        { sourceEnemyId: vid },
      ) || 0;
      let hitAny = playerHits > 0;
      const VIPER_ARROW_ALLY_PATH_R2 = 3.5 * 3.5;
      const allyHits = this.damageAlliedUnitsAlongSegmentXZ(startX, startZ, endX, endZ, VIPER_ARROW_ALLY_PATH_R2, 55, {
        sourceEnemyId: vid,
        damageType: 'viper_arrow',
      });
      hitAny = hitAny || allyHits > 0;
      this.emitViperArrowOutcome(vid, shotId, hitAny, {
        x: hitAny ? tp.position.x : endX,
        y: tp.position.y,
        z: hitAny ? tp.position.z : endZ,
      });
    }, impactDelayMs);
  }

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
    const aggroRadius = 15;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);

    if (!aggroData.isAggroed && distance <= aggroRadius && this.hasLineOfSight(viper.position, tpos)) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }
    this._maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius);

    if (!aggroData.isAggroed) return;

    const dx = tpos.x - viper.position.x;
    const dz = tpos.z - viper.position.z;
    viper.rotation = Math.atan2(dx, dz);
    this._queueMove(viper.id, viper.position, viper.rotation);

    const attackCooldown = viper.attackCooldown ?? 5000;
    const lastAttackTime = this.viperAttackCooldown.get(viper.id) || 0;
    const now = Date.now();

    if (distance <= attackRange) {
      if (now - lastAttackTime >= attackCooldown) {
        this.viperAttackCooldown.set(viper.id, now);
        const shotId = `viper-shot-${viper.id}-${now}`;
        if (resolved.kind === 'player') {
          this.scheduleViperPlayerShot(viper, resolved.player, shotId);

          if ((this.room?.coopBossesDefeatedCount ?? 0) >= VIPER_DOUBLE_SHOT_UNLOCK_BOSS_COUNT) {
            const vid = viper.id;
            const pid = resolved.player.id;
            const t = setTimeout(() => {
              if (!this.room?.getGameStarted()) return;
              const liveViper = this.room?.getEnemy(vid);
              if (!liveViper || liveViper.isDying) return;
              if (this.room?.isEnemyAffectedBy(vid, 'freeze')) return;
              if (this.room?.isEnemyAffectedBy(vid, 'stun')) return;
              const tp = this.room?.getPlayers()?.find(p => p.id === pid);
              if (!tp || tp.health <= 0) return;

              const aimDx = tp.position.x - liveViper.position.x;
              const aimDz = tp.position.z - liveViper.position.z;
              liveViper.rotation = Math.atan2(aimDx, aimDz);
              this._queueMove(liveViper.id, liveViper.position, liveViper.rotation);

              const shotId2 = `viper-shot-${vid}-${Date.now()}`;
              this.scheduleViperPlayerShot(liveViper, tp, shotId2);
              this.viperFollowupTimeout.delete(vid);
            }, VIPER_DOUBLE_SHOT_FOLLOWUP_DELAY_MS);

            this._trackViperFollowupTimeout(vid, t);
          }
        } else if (resolved.kind === 'zombie') {
          const z = resolved.zombie;
          const targetPoint = {
            x: z.position.x,
            y: (z.position.y ?? 0) + 1.0,
            z: z.position.z,
          };
          const impactDelayMs = VIPER_DRAWBOW_DURATION_MS + viperArrowFlightMs(
            { x: viper.position.x, y: viper.position.y + 1.5, z: viper.position.z },
            targetPoint,
          );
          this.telegraphViperAttack(viper, {
            id: z.ownerPlayerId || z.id,
            position: z.position,
          }, shotId);
          const zid = z.id;
          setTimeout(() => {
            if (viper.isDying || !this.room?.getGameStarted()) return;
            const liveViper = this.room?.getEnemy(viper.id);
            if (!liveViper || liveViper.isDying) return;
            const zz = this.room?.getEnemy(zid);
            if (!zz || zz.isDying || zz.health <= 0) {
              this.emitViperArrowOutcome(viper.id, shotId, false, liveViper.position);
              return;
            }
            if (this.calculateDistance(liveViper.position, zz.position) > attackRange + 1) {
              this.emitViperArrowOutcome(viper.id, shotId, false, zz.position);
              return;
            }
            const zombieHit = this.damagePlayerZombieFromMob(liveViper, zz, 70, 'viper_arrow');
            this.emitViperArrowOutcome(viper.id, shotId, !!zombieHit, zz.position);
          }, impactDelayMs);
        } else {
          const tr = resolved.trap;
          const targetPoint = {
            x: tr.position.x,
            y: (tr.position.y ?? 0) + 1.0,
            z: tr.position.z,
          };
          const impactDelayMs = VIPER_DRAWBOW_DURATION_MS + viperArrowFlightMs(
            { x: viper.position.x, y: viper.position.y + 1.5, z: viper.position.z },
            targetPoint,
          );
          this.telegraphViperAttack(viper, {
            id: tr.id,
            position: tr.position,
          }, shotId);
          const trapId = tr.id;
          const vid = viper.id;
          setTimeout(() => {
            if (viper.isDying || !this.room?.getGameStarted()) return;
            const liveViper = this.room?.getEnemy(vid);
            if (!liveViper || liveViper.isDying) return;
            const tt = this.room?.getEnemy(trapId);
            if (!tt || tt.isDying || tt.health <= 0 || tt.type !== 'tentacle-spine') {
              this.emitViperArrowOutcome(vid, shotId, false, liveViper.position);
              return;
            }
            if (this.calculateDistance(liveViper.position, tt.position) > attackRange + 1) {
              this.emitViperArrowOutcome(vid, shotId, false, tt.position);
              return;
            }
            let hitAny = !!this.room.damageEnemy(trapId, 70, null, null, {
              sourceEnemyId: vid,
              damageType: 'viper_arrow',
            });

            const startX = liveViper.position.x;
            const startZ = liveViper.position.z;
            const tx = tt.position.x;
            const tz = tt.position.z;
            const ddx = tx - startX;
            const ddz = tz - startZ;
            const segLen = Math.hypot(ddx, ddz) || 1e-6;
            const reach = Math.min(VIPER_ARROW_MAX_RANGE, segLen);
            const endX = startX + (ddx / segLen) * reach;
            const endZ = startZ + (ddz / segLen) * reach;
            const VIPER_ARROW_ALLY_PATH_R2 = 3.5 * 3.5;
            const allyHits = this.damageAlliedUnitsAlongSegmentXZ(startX, startZ, endX, endZ, VIPER_ARROW_ALLY_PATH_R2, 70, {
              sourceEnemyId: vid,
              damageType: 'viper_arrow',
            });
            hitAny = hitAny || allyHits > 0;
            this.emitViperArrowOutcome(vid, shotId, hitAny, tt.position);
          }, impactDelayMs);
        }
      }
    } else {
      this.moveEnemyTowardsTarget(viper, moveTarget);
    }
  }

  telegraphViperAttack(viper, targetPlayer, shotId = `viper-shot-${viper.id}-${Date.now()}`) {
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
      const horizontalLen = Math.hypot(dx, dz) || 1e-6;
      this.io.to(this.roomId).emit('viper-attack-telegraph', {
        viperId:  viper.id,
        shotId,
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
          x: startX + (dx / horizontalLen) * VIPER_ARROW_MAX_RANGE,
          y: startY + (dy / len) * VIPER_ARROW_MAX_RANGE,
          z: startZ + (dz / horizontalLen) * VIPER_ARROW_MAX_RANGE
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
    const aggroRadius = 15;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);

    if (!aggroData.isAggroed && distance <= aggroRadius && this.hasLineOfSight(weaver.position, tpos)) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }
    this._maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius);

    if (!aggroData.isAggroed) return;

    const now = Date.now();
    const lockUntil = this.weaverCastLockUntil.get(weaver.id) || 0;
    if (now < lockUntil) return;

    const dx = tpos.x - weaver.position.x;
    const dz = tpos.z - weaver.position.z;
    weaver.rotation = Math.atan2(dx, dz);
    this._queueMove(weaver.id, weaver.position, weaver.rotation);

    if ((this.room?.coopBossesDefeatedCount ?? 0) >= WEAVER_IMPALE_SPIKE_UNLOCK_BOSS_COUNT) {
      const lastImpale = this.weaverImpaleSpikeCooldown.get(weaver.id) || 0;
      if (
        resolved.kind === 'player' &&
        distance <= WEAVER_IMPALE_SPIKE_RANGE &&
        now - lastImpale >= WEAVER_IMPALE_SPIKE_COOLDOWN_MS &&
        !this.room?.isEnemyAffectedBy(weaver.id, 'freeze')
      ) {
        this.weaverCastImpaleSpike(weaver, resolved.player);
        return;
      }
    }

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
        return;
      }
    } else {
      // ── Summon Ghoul (30-second cooldown; max 1 active ghoul) ────────────
      const summonCooldown = 35000;
      const lastSummonTime = this.weaverSummonCooldown.get(weaver.id) || 0;
      const activeGhoulId  = this.weaverSummonedGhouls.get(weaver.id);
      const ghoulAlive     = activeGhoulId && this.room?.enemies.has(activeGhoulId) &&
                             !this.room?.enemies.get(activeGhoulId)?.isDying;

      if (!ghoulAlive && now - lastSummonTime >= summonCooldown) {
        this.weaverSummonCooldown.set(weaver.id, now);
        this.weaverCastSummon(weaver);
        return;
      }

      // ── Heal (5-second cooldown) ───────────────────────────────────────────
      const healCooldown   = 5000;
      const healRange      = 15.0;
      const lastHealTime   = this.weaverHealCooldown.get(weaver.id) || 0;

      if (now - lastHealTime >= healCooldown) {
        const healTarget = this.findLowestHpPercentEnemy(weaver, healRange);
        if (healTarget) {
          this.weaverHealCooldown.set(weaver.id, now);
          this.weaverCastHeal(weaver, healTarget);
          return;
        }
      }
    }

    const preferredRange = 8.0;
    if (distance > preferredRange) {
      this.moveEnemyTowardsTarget(weaver, moveTarget);
    }
  }

  clearWeaverImpaleSpikePendingTimeoutsForWeaver(weaverId) {
    const arr = this.weaverImpaleSpikePendingTimeouts.get(weaverId);
    if (arr) {
      arr.forEach((tid) => clearTimeout(tid));
      this.weaverImpaleSpikePendingTimeouts.delete(weaverId);
    }
  }

  removeWeaverImpaleSpikePendingTimeoutHandle(weaverId, handle) {
    const arr = this.weaverImpaleSpikePendingTimeouts.get(weaverId);
    if (!arr) return;
    const i = arr.indexOf(handle);
    if (i >= 0) arr.splice(i, 1);
    if (arr.length === 0) this.weaverImpaleSpikePendingTimeouts.delete(weaverId);
  }

  weaverCastImpaleSpike(weaver, targetPlayer) {
    const now = Date.now();
    const wid = weaver.id;
    const targetPlayerId = targetPlayer.id;
    const windupMs = WEAVER_IMPALE_SPIKE_CAST_ANIM_MS + WEAVER_IMPALE_SPIKE_POST_ANIM_DELAY_MS;

    const dx = targetPlayer.position.x - weaver.position.x;
    const dz = targetPlayer.position.z - weaver.position.z;
    weaver.rotation = Math.atan2(dx, dz);
    this._queueMove(weaver.id, weaver.position, weaver.rotation);

    this.weaverImpaleSpikeCooldown.set(wid, now);
    this.weaverCastLockUntil.set(
      wid,
      now + windupMs + BOSS_TECTONIC_SPIKE_WARN_MS + 300,
    );

    if (this.io) {
      this.io.to(this.roomId).emit('weaver-impale-spike-cast', {
        weaverId: wid,
        soulType: weaver.soulType === 'blue' ? 'blue' : 'green',
        timestamp: now,
      });
    }

    const telegraphHandle = setTimeout(() => {
      this.removeWeaverImpaleSpikePendingTimeoutHandle(wid, telegraphHandle);
      const w = this.room?.enemies?.get(wid);
      if (!w || w.isDying || w.health <= 0) return;

      const livePlayer = this.room?.players?.get(targetPlayerId);
      if (!livePlayer || livePlayer.health <= 0) return;

      const landX = livePlayer.position.x;
      const landZ = livePlayer.position.z;
      const tickNow = Date.now();
      const spikeId = `weaver-impale-spike-${wid}-${tickNow}`;

      if (this.io) {
        this.io.to(this.roomId).emit('weaver-impale-spike-telegraph', {
          weaverId: wid,
          spikeId,
          position: { x: landX, y: 0, z: landZ },
          warningMs: BOSS_TECTONIC_SPIKE_WARN_MS,
          soulType: weaver.soulType === 'blue' ? 'blue' : 'green',
          timestamp: tickNow,
        });
      }

      const hitHandle = setTimeout(() => {
        this.removeWeaverImpaleSpikePendingTimeoutHandle(wid, hitHandle);
        const liveWeaver = this.room?.enemies?.get(wid);
        if (!liveWeaver || liveWeaver.isDying || liveWeaver.health <= 0) return;
        if (this.room) {
          this.room.damagePlayersInHorizontalRing(
            { x: landX, y: 0, z: landZ },
            BOSS_TECTONIC_SHARD_RADIUS,
            WEAVER_IMPALE_SPIKE_DAMAGE,
            'weaver_impale_spike',
            { sourceEnemyId: wid },
          );
        }
        if (this.io) {
          this.io.to(this.roomId).emit('weaver-impale-spike-appear', {
            weaverId: wid,
            spikeId,
            position: { x: landX, y: 0, z: landZ },
            soulType: weaver.soulType === 'blue' ? 'blue' : 'green',
            timestamp: Date.now(),
          });
        }
      }, BOSS_TECTONIC_SPIKE_WARN_MS);

      if (!this.weaverImpaleSpikePendingTimeouts.has(wid)) {
        this.weaverImpaleSpikePendingTimeouts.set(wid, []);
      }
      this.weaverImpaleSpikePendingTimeouts.get(wid).push(hitHandle);
    }, windupMs);

    if (!this.weaverImpaleSpikePendingTimeouts.has(wid)) {
      this.weaverImpaleSpikePendingTimeouts.set(wid, []);
    }
    this.weaverImpaleSpikePendingTimeouts.get(wid).push(telegraphHandle);

    console.log(`🧵 Weaver ${wid} casting Impale Spike on player ${targetPlayerId}`);
  }

  weaverCastLightningOnZombie(weaver, zombie, now) {
    const CHARGE_MS = 1500;
    this.weaverCastLockUntil.set(weaver.id, now + CHARGE_MS);
    this._queueMove(weaver.id, weaver.position, weaver.rotation);
    const tx = zombie.position.x;
    const tz = zombie.position.z;
    if (this.io) {
      this.io.to(this.roomId).emit('weaver-lightning-telegraph', {
        weaverId: weaver.id,
        targetPosition: { x: tx, y: 0, z: tz },
        strikeAt: now + CHARGE_MS,
        damage: 45,
        radius: 2.99,
        theme: 'blue',
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
      this.room.tryDamageAlliedKnightInXZDisk({ x: tx, z: tz }, 2.99, 35, {
        sourceEnemyId: weaver.id,
        damageType: 'weaver_lightning',
      });
    }, CHARGE_MS);
    console.log(`🧵 Weaver ${weaver.id} lightning (zombie) at (${tx.toFixed(1)}, ${tz.toFixed(1)})`);
  }

  weaverCastLightningOnTrap(weaver, trap, now) {
    const CHARGE_MS = 1150;
    this.weaverCastLockUntil.set(weaver.id, now + CHARGE_MS);
    this._queueMove(weaver.id, weaver.position, weaver.rotation);
    const tx = trap.position.x;
    const tz = trap.position.z;
    if (this.io) {
      this.io.to(this.roomId).emit('weaver-lightning-telegraph', {
        weaverId: weaver.id,
        targetPosition: { x: tx, y: 0, z: tz },
        strikeAt: now + CHARGE_MS,
        damage: 45,
        radius: 2.99,
        theme: 'blue',
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
      this.room.tryDamageAlliedKnightInXZDisk({ x: tx, z: tz }, 2.99, 35, {
        sourceEnemyId: weaver.id,
        damageType: 'weaver_lightning',
      });
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
    const now = Date.now();
    // Face the heal target
    const dx = targetEnemy.position.x - weaver.position.x;
    const dz = targetEnemy.position.z - weaver.position.z;
    weaver.rotation = Math.atan2(dx, dz);
    this.weaverCastLockUntil.set(weaver.id, now + WEAVER_HEAL_CAST_LOCK_MS);
    this._queueMove(weaver.id, weaver.position, weaver.rotation);

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

      const healAmount    = 250;
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
    const CHARGE_MS = WEAVER_LIGHTNING_CAST_LOCK_MS;
    this.weaverCastLockUntil.set(weaver.id, now + CHARGE_MS);
    this._queueMove(weaver.id, weaver.position, weaver.rotation);
    if (this.io) {
      this.io.to(this.roomId).emit('weaver-lightning-telegraph', {
        weaverId: weaver.id,
        targetPosition: {
          x: targetPlayer.position.x,
          y: 0,
          z: targetPlayer.position.z
        },
        strikeAt: now + CHARGE_MS,
        damage: 57,
        radius: 2.99,
        theme: 'blue',
        timestamp: now
      });
    }
    console.log(`🧵 Weaver ${weaver.id} calling lightning at (${targetPlayer.position.x.toFixed(1)}, ${targetPlayer.position.z.toFixed(1)}) in ${CHARGE_MS}ms`);

    const strikeX = targetPlayer.position.x;
    const strikeZ = targetPlayer.position.z;
    const wid = weaver.id;
    setTimeout(() => {
      if (!this.room?.getGameStarted()) return;
      const w = this.room?.getEnemy(wid);
      if (!w || w.isDying) return;
      this.room.tryDamageAlliedKnightInXZDisk({ x: strikeX, z: strikeZ }, 2.99, 45, {
        sourceEnemyId: wid,
        damageType: 'weaver_lightning',
      });
    }, CHARGE_MS);
  }

  weaverCastSummon(weaver) {
    if (!this.room) return;

    const now = Date.now();
    this.weaverCastLockUntil.set(weaver.id, now + WEAVER_SUMMON_CAST_LOCK_MS);
    this._queueMove(weaver.id, weaver.position, weaver.rotation);

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

    const isBoss3Summon = weaver.type === 'boss3';

    // After the cast animation (~3s), spawn the ghoul
    setTimeout(() => {
      if (weaver.isDying || !this.room?.getGameStarted()) return;

      const ghoulId = `ghoul-${weaver.id}-${Date.now()}`;
      const damageMult = isBoss3Summon ? BOSS3_SUMMONED_GHOUL_DAMAGE_MULT : 1;
      const ghoulHp = isBoss3Summon ? BOSS3_SUMMONED_GHOUL_HP : GHOUL_SUMMON_HP;

      const ghoul = {
        id:        ghoulId,
        type:      'ghoul',
        position:  { ...ritualPosition },
        rotation:  rotationYTowardEntry(ritualPosition.x, ritualPosition.z),
        health:    ghoulHp,
        maxHealth: ghoulHp,
        isDying:   false,
        damage:    GHOUL_BASE_DAMAGE * damageMult,
        attackCooldown: 2000,
        moveSpeed: 0,   // Frozen during summon animation
        spawnedAt: Date.now(),
        summonerId: weaver.id,
        ...(isBoss3Summon ? {
          visualScale: BOSS3_SUMMONED_GHOUL_VISUAL_SCALE,
          leapDamage: GHOUL_LEAP_DAMAGE * damageMult,
          summonedByBoss3Id: weaver.id,
        } : {}),
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
      const speedMult = isBoss3Summon ? BOSS3_SUMMONED_GHOUL_SPEED_MULT : 1;
      setTimeout(() => {
        const spawnedGhoul = this.room?.getEnemy(ghoulId);
        if (spawnedGhoul && !spawnedGhoul.isDying) {
          spawnedGhoul.moveSpeed = GHOUL_BASE_MOVE_SPEED * speedMult;
          console.log(`💀 Ghoul ${ghoulId} summon animation complete — movement unlocked`);
        }
      }, 4500);
    }, 2000);
  }

  // ─── Ghoul AI ────────────────────────────────────────────────────────────────

  updateGhoulAI(ghoul, players) {
    if (this.tickGhoulLeapFlight(ghoul)) return;

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
    const attackRange = 2.5;
    const attackCooldown = ghoul.attackCooldown ?? 2000;

    const now = Date.now();
    const lockUntil = this.meleeLockUntil.get(ghoul.id) || 0;
    if (now < lockUntil) return;

    const meleePressDistance = attackRange - MELEE_CLOSE_INSET;

    if (
      resolved.kind === 'player' &&
      (this.room?.coopBossesDefeatedCount ?? 0) >= 1 &&
      distance > attackRange
    ) {
      const canLeap =
        (ghoul.spawnedAt == null || now - ghoul.spawnedAt >= GHOUL_LEAP_POST_SPAWN_DELAY_MS) &&
        (this.ghoulLeapCooldown.get(ghoul.id) == null ||
          now - (this.ghoulLeapCooldown.get(ghoul.id) || 0) >= GHOUL_LEAP_COOLDOWN_MS) &&
        !this.ghoulLeapEndAt.has(ghoul.id);
      if (canLeap) {
        this.ghoulStartLeap(ghoul, resolved.player);
        return;
      }
    }

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
              const damage = ghoul.damage || GHOUL_BASE_DAMAGE;
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
              const damage = ghoul.damage || GHOUL_BASE_DAMAGE;
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
            damage: MARTYR_DETONATION_PLAYER_DAMAGE,
            timestamp: Date.now(),
          });
        }
        const e = this.room?.enemies?.get(martyrId);
        if (e && !e.isDying && e.health > 0) {
          this.room.damageEnemy(martyrId, MARTYR_DETONATION_ENEMY_DAMAGE, null, null, { damageType: 'martyr_self' });
        }
        if (this.room?.getEnemies) {
          for (const other of this.room.getEnemies()) {
            if (!other || other.id === martyrId || other.isDying || other.health <= 0) continue;
            if (MARTYR_DETONATION_SPLASH_EXCLUDED_TYPES.has(other.type)) continue;
            if (this.calculateDistance(blastCenter, other.position) <= MARTYR_DETONATION_RADIUS) {
              this.room.damageEnemy(other.id, MARTYR_DETONATION_ENEMY_DAMAGE, null, null, { damageType: 'martyr_detonation' });
            }
          }
        }
      }, MARTYR_DETONATION_DELAY_MS);
      return;
    }

    this.moveEnemyTowardsTarget(martyr, moveTarget, { meleeSurroundAttackRange: attackRange });
  }

  // ─── Titan AI ────────────────────────────────────────────────────────────────

  _buildTitanPatrolWaypoints(spawnX, spawnZ) {
    const patrolRadius = this._arenaPatrolRadius();
    const waypoints = [];
    for (let i = 0; i < TITAN_PATROL_WAYPOINT_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / TITAN_PATROL_WAYPOINT_COUNT - Math.PI / 2;
      const rawX = Math.cos(angle) * patrolRadius;
      const rawZ = Math.sin(angle) * patrolRadius;
      const clamped = this.clampToArenaXZ(rawX, rawZ);
      waypoints.push({ x: clamped.x, z: clamped.z });
    }
    let startIndex = 0;
    let bestD = Infinity;
    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      const d = (wp.x - spawnX) ** 2 + (wp.z - spawnZ) ** 2;
      if (d < bestD) {
        bestD = d;
        startIndex = i;
      }
    }
    return { waypoints, startIndex };
  }

  _ensureTitanPatrolState(titan) {
    if (titan.patrolWaypoints && titan.patrolIndex != null) return;
    const { waypoints, startIndex } = this._buildTitanPatrolWaypoints(
      titan.position.x,
      titan.position.z,
    );
    titan.patrolWaypoints = waypoints;
    titan.patrolIndex = startIndex;
  }

  _moveTitanTowardsPatrolWaypoint(titan) {
    this._ensureTitanPatrolState(titan);
    const waypoints = titan.patrolWaypoints;
    if (!waypoints || waypoints.length === 0) return;

    let idx = titan.patrolIndex ?? 0;
    let wp = waypoints[idx];
    let dist = Math.hypot(wp.x - titan.position.x, wp.z - titan.position.z);

    while (dist < TITAN_PATROL_REACH && waypoints.length > 1) {
      idx = (idx + 1) % waypoints.length;
      wp = waypoints[idx];
      dist = Math.hypot(wp.x - titan.position.x, wp.z - titan.position.z);
    }
    titan.patrolIndex = idx;

    const savedSpeed = titan.moveSpeed;
    titan.moveSpeed = titan.patrolSpeed ?? (savedSpeed * 0.6);
    this.moveEnemyTowardsTarget(titan, { position: wp, id: 'titan-patrol' });
    titan.moveSpeed = savedSpeed;
  }

  updateTitanAI(titan, players) {
    this.titanMaybeStartBladestorm(titan);
    if (titan.bladestormPowerupActive) return;

    if (titan.bladestormActive) {
      this.tickTitanBladestorm(titan, this.updateInterval / 1000);
    }

    let aggroData = this.enemyAggro.get(titan.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(titan, players);
      if (!closestPlayer) return;
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 0,
        isAggroed: false,
        threatFromDamage: false,
        directPlayerDamageAggroed: false,
      };
      this.enemyAggro.set(titan.id, aggroData);
    }

    const now = Date.now();
    const lockUntil = this.meleeLockUntil.get(titan.id) || 0;
    if (now < lockUntil) return;

    const attackRange = TITAN_ATTACK_RANGE;
    const attackCooldown = titan.attackCooldown ?? 2500;
    const aggroRadius = TITAN_AGGRO_RADIUS;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);

    // Proximity aggro — low radius, requires line of sight.
    if (!aggroData.isAggroed) {
      for (const p of players) {
        if (!p || p.health <= 0) continue;
        const dist = this.calculateDistance(titan.position, p.position);
        if (dist <= aggroRadius && this.hasLineOfSight(titan.position, p.position)) {
          aggroData.isAggroed = true;
          aggroData.targetPlayerId = p.id;
          aggroData.targetZombieId = null;
          aggroData.targetTrapId = null;
          break;
        }
      }
    }

    if (!aggroData.isAggroed) {
      this._moveTitanTowardsPatrolWaypoint(titan);
      return;
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, titan, players);
    if (!resolved) {
      aggroData.isAggroed = false;
      this._moveTitanTowardsPatrolWaypoint(titan);
      return;
    }

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(titan.position, tpos);

    if (aggroData.isAggroed && distance > leashRadius && !aggroData.threatFromDamage && !aggroData.directPlayerDamageAggroed) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
      this._moveTitanTowardsPatrolWaypoint(titan);
      return;
    }

    if (distance <= attackRange) {
      if (!this.titanAttackCooldown.has(titan.id)) {
        this.titanAttackCooldown.set(titan.id, 0);
      }
      const lastAttackTime = this.titanAttackCooldown.get(titan.id);
      if (now - lastAttackTime >= attackCooldown) {
        this.titanAttackCooldown.set(titan.id, now);
        this.meleeLockUntil.set(titan.id, now + TITAN_SWING_LOCK_MS);

        if (resolved.kind === 'player') {
          this.telegraphTitanAttack(titan, resolved.player);
          const pid = resolved.player.id;
          setTimeout(() => {
            if (titan.isDying || !this.room?.getGameStarted()) return;
            if (this.room?.isEnemyAffectedBy(titan.id, 'stun')) return;
            const currentPlayers = this.room?.getPlayers();
            if (!currentPlayers) return;
            const currentTarget = currentPlayers.find(p => p.id === pid);
            if (!currentTarget || currentTarget.health <= 0) return;
            const currentDistance = this.calculateDistance(titan.position, currentTarget.position);
            if (currentDistance <= attackRange) {
              this.titanAttackPlayer(titan, currentTarget);
            }
          }, TITAN_HIT_DELAY_MS);
        } else if (resolved.kind === 'zombie') {
          const z = resolved.zombie;
          this.telegraphTitanAttack(titan, {
            id: z.ownerPlayerId || z.id,
            position: z.position,
          });
          const zid = z.id;
          setTimeout(() => {
            if (titan.isDying || !this.room?.getGameStarted()) return;
            if (this.room?.isEnemyAffectedBy(titan.id, 'stun')) return;
            const z = this.room?.getEnemy(zid);
            if (!z || z.isDying || z.health <= 0) return;
            const currentDistance = this.calculateDistance(titan.position, z.position);
            if (currentDistance <= attackRange) {
              const damage = titan.damage || 100;
              this.damagePlayerZombieFromMob(titan, z, damage, 'titan_melee');
            }
          }, TITAN_HIT_DELAY_MS);
        } else {
          const tr = resolved.trap;
          this.telegraphTitanAttack(titan, {
            id: tr.id,
            position: tr.position,
          });
          const trapId = tr.id;
          setTimeout(() => {
            if (titan.isDying || !this.room?.getGameStarted()) return;
            const liveT = this.room?.getEnemy(trapId);
            if (!liveT || liveT.isDying || liveT.health <= 0 || liveT.type !== 'tentacle-spine') return;
            const currentDistance = this.calculateDistance(titan.position, liveT.position);
            if (currentDistance <= attackRange) {
              const damage = titan.damage || 100;
              this.room.damageEnemy(trapId, damage, null, null, {
                sourceEnemyId: titan.id,
                damageType: 'titan_melee',
              });
            }
          }, TITAN_HIT_DELAY_MS);
        }
        return;
      }
    }

    const cannonUnlocked = (this.room?.coopBossesDefeatedCount ?? 0) >= TITAN_CANNON_UNLOCK_BOSS_COUNT;
    if (
      cannonUnlocked &&
      !titan.bladestormPowerupActive &&
      !titan.bladestormActive &&
      !this.titanCannonWindupTimeout.has(titan.id)
    ) {
      const soulType = titan.soulType || 'green';
      if (soulType === 'green') {
        const greenTarget = this._findStunnedOrFrozenTitanTarget(titan, now);
        const greenBaseline = this.titanCannonCooldown.get(titan.id) ?? titan.spawnedAt ?? 0;
        if (
          greenTarget &&
          now - greenBaseline >= TITAN_CANNON_GREEN_COOLDOWN_MS
        ) {
          this.titanStartCannon(titan, greenTarget);
          return;
        }
      } else if (
        resolved.kind === 'player' &&
        distance > TITAN_CANNON_MIN_RANGE &&
        distance <= TITAN_CANNON_RANGE &&
        this._titanCanFireCannon(titan, now)
      ) {
        this.titanStartCannon(titan, resolved.player);
        return;
      }
    }

    if (
      resolved.kind === 'player' &&
      distance > TITAN_STOMP_MIN_DISTANCE &&
      distance <= TITAN_STOMP_MAX_RANGE + 2 &&
      !titan.bladestormPowerupActive &&
      !titan.bladestormActive &&
      !this.titanStompWindupTimeout.has(titan.id) &&
      (this.titanStompCooldown.get(titan.id) == null ||
        now - (this.titanStompCooldown.get(titan.id) || 0) >= TITAN_STOMP_COOLDOWN_MS)
    ) {
      this.titanStartStomp(titan, resolved.player);
      return;
    }

    this.moveEnemyTowardsTarget(titan, moveTarget, { meleeSurroundAttackRange: attackRange });
  }

  titanMaybeStartBladestorm(titan) {
    if (!titan || titan.type !== 'titan') return;
    if (titan.bladestormPowerupActive || titan.bladestormActive) return;
    if (titan.isDying || titan.health <= 0) return;
    if (!titan.maxHealth || titan.health / titan.maxHealth > TITAN_BLADESTORM_HEALTH_PCT) return;
    if (this.titanBladestormPowerupTimeout.has(titan.id)) return;

    const now = Date.now();
    titan.bladestormPowerupActive = true;
    this.meleeLockUntil.set(titan.id, now + TITAN_BLADESTORM_POWERUP_MS);

    if (this.io) {
      this.io.to(this.roomId).emit('titan-bladestorm-powerup-start', {
        titanId: titan.id,
        soulType: titan.soulType || 'green',
        timestamp: now,
      });
    }

    const titanId = titan.id;
    const handle = setTimeout(() => {
      this.titanBladestormPowerupTimeout.delete(titanId);
      this.titanCompleteBladestormPowerup(titanId);
    }, TITAN_BLADESTORM_POWERUP_MS);
    this.titanBladestormPowerupTimeout.set(titan.id, handle);
    console.log(`🗿 Titan ${titan.id} powering up for Bladestorm at ${Math.round((titan.health / titan.maxHealth) * 100)}% HP.`);
  }

  titanCompleteBladestormPowerup(titanId) {
    const titan = this.room?.enemies?.get(titanId);
    if (!titan || titan.type !== 'titan' || titan.isDying || titan.health <= 0) return;

    titan.bladestormPowerupActive = false;
    const startTime = Date.now();
    titan.bladestormActive = true;
    titan.bladestormStartTime = startTime;
    titan.bladestormSpinAngle = 0;

    if (this.io) {
      this.io.to(this.roomId).emit('titan-bladestorm-start', {
        titanId: titan.id,
        startTime,
        soulType: titan.soulType || 'green',
        timestamp: startTime,
      });
    }
    console.log(`🗿 Titan ${titan.id} entered Bladestorm.`);
  }

  titanStartStomp(titan, targetPlayer) {
    const now = Date.now();
    this.titanStompCooldown.set(titan.id, now);
    this.meleeLockUntil.set(titan.id, now + TITAN_STOMP_WINDUP_MS);

    const dx = targetPlayer.position.x - titan.position.x;
    const dz = targetPlayer.position.z - titan.position.z;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    titan.rotation = Math.atan2(dx, dz);
    this._queueMove(titan.id, titan.position, titan.rotation);

    if (this.io) {
      this.io.to(this.roomId).emit('titan-stomp-start', {
        titanId: titan.id,
        targetPlayerId: targetPlayer.id,
        direction: { ux, uz },
        timestamp: now,
      });
    }

    const titanId = titan.id;
    const targetId = targetPlayer.id;
    const handle = setTimeout(() => {
      this.titanStompWindupTimeout.delete(titanId);
      this.titanReleaseStompShockwave(titanId, targetId, ux, uz);
    }, TITAN_STOMP_WINDUP_MS);
    this.titanStompWindupTimeout.set(titan.id, handle);
  }

  titanReleaseStompShockwave(titanId, targetPlayerId, dirUx, dirUz) {
    const titan = this.room?.enemies?.get(titanId);
    if (!titan || titan.type !== 'titan' || titan.isDying || titan.health <= 0) return;
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;

    const players = this.room?.getPlayers();
    const target = players?.find((p) => p.id === targetPlayerId);
    let ux = dirUx;
    let uz = dirUz;
    if (target && target.health > 0) {
      const dx = target.position.x - titan.position.x;
      const dz = target.position.z - titan.position.z;
      const len = Math.hypot(dx, dz) || 1;
      ux = dx / len;
      uz = dz / len;
      titan.rotation = Math.atan2(dx, dz);
    }

    const ox = titan.position.x;
    const oz = titan.position.z;
    const timestamp = Date.now();

    if (this.io) {
      this.io.to(this.roomId).emit('titan-stomp-shockwave', {
        titanId,
        soulType: titan.soulType || 'green',
        origin: { x: ox, y: 0, z: oz },
        direction: { ux, uz },
        maxRange: TITAN_STOMP_MAX_RANGE,
        travelMs: TITAN_STOMP_TRAVEL_MS,
        timestamp,
      });
    }

    const hitPlayerIds = new Set();
    const meta = { stunMs: TITAN_STOMP_STUN_MS, sourceEnemyId: titanId };
    const STEP_MS = Math.max(30, Math.floor(TITAN_STOMP_TRAVEL_MS / TITAN_STOMP_STEPS));
    let step = 0;

    const oldInterval = this.titanStompShockwaveInterval.get(titanId);
    if (oldInterval) clearInterval(oldInterval);

    const tick = () => {
      step += 1;
      const live = this.room?.enemies?.get(titanId);
      if (
        step > TITAN_STOMP_STEPS ||
        !this.room?.getGameStarted() ||
        !live ||
        live.isDying ||
        live.health <= 0
      ) {
        const intervalId = this.titanStompShockwaveInterval.get(titanId);
        if (intervalId) clearInterval(intervalId);
        this.titanStompShockwaveInterval.delete(titanId);
        return;
      }
      if (this.coopTransitionBlocksOutgoingPlayerHits()) return;

      const frac0 = (step - 1) / TITAN_STOMP_STEPS;
      const frac1 = step / TITAN_STOMP_STEPS;
      const ax = ox + ux * frac0 * TITAN_STOMP_MAX_RANGE;
      const az = oz + uz * frac0 * TITAN_STOMP_MAX_RANGE;
      const bx = ox + ux * frac1 * TITAN_STOMP_MAX_RANGE;
      const bz = oz + uz * frac1 * TITAN_STOMP_MAX_RANGE;

      const fracMid = (frac0 + frac1) / 2;
      const halfWidth =
        TITAN_STOMP_HALF_WIDTH_MIN +
        (TITAN_STOMP_HALF_WIDTH_MAX - TITAN_STOMP_HALF_WIDTH_MIN) * fracMid;

      this.room?.damagePlayersInLineSegmentFirstHit(
        ax,
        az,
        bx,
        bz,
        halfWidth,
        TITAN_STOMP_DAMAGE,
        'titan_stomp',
        hitPlayerIds,
        meta,
      );
    };

    const intervalId = setInterval(tick, STEP_MS);
    this.titanStompShockwaveInterval.set(titanId, intervalId);
    tick();
  }

  _titanRedSyncCharges(titan, now) {
    let state = this.titanRedCannonCharges.get(titan.id);
    if (!state) {
      state = { charges: TITAN_CANNON_RED_MAX_CHARGES, pending: [] };
      this.titanRedCannonCharges.set(titan.id, state);
    }
    state.pending = state.pending.filter((readyAt) => {
      if (now >= readyAt) {
        state.charges = Math.min(TITAN_CANNON_RED_MAX_CHARGES, state.charges + 1);
        return false;
      }
      return true;
    });
    return state;
  }

  _titanCanFireCannon(titan, now) {
    const soulType = titan.soulType || 'green';
    const healthPct = titan.maxHealth > 0 ? titan.health / titan.maxHealth : 1;
    const baseline = this.titanCannonCooldown.get(titan.id) ?? titan.spawnedAt ?? 0;

    if (soulType === 'blue') {
      return healthPct <= TITAN_CANNON_BLUE_HEALTH_PCT &&
        now - baseline >= TITAN_CANNON_BLUE_COOLDOWN_MS;
    }
    if (soulType === 'purple') {
      return now - baseline >= TITAN_CANNON_PURPLE_COOLDOWN_MS;
    }
    if (soulType === 'red') {
      if (healthPct > TITAN_CANNON_RED_HEALTH_PCT) return false;
      const state = this._titanRedSyncCharges(titan, now);
      const lastCast = this.titanRedCannonLastCastAt.get(titan.id) ?? 0;
      return state.charges > 0 && now - lastCast >= TITAN_CANNON_RED_CAST_GAP_MS;
    }
    return false;
  }

  _findStunnedOrFrozenTitanTarget(titan, now) {
    const players = this.room?.getPlayers();
    if (!players) return null;

    let best = null;
    let bestDist = Infinity;
    for (const p of players) {
      if (!p || p.health <= 0) continue;
      if (
        !this.room?.isPlayerAffectedBy(p.id, 'stun') &&
        !this.room?.isPlayerAffectedBy(p.id, 'freeze')
      ) {
        continue;
      }
      const d = this.calculateDistance(titan.position, p.position);
      if (d <= TITAN_CANNON_MIN_RANGE || d > TITAN_CANNON_RANGE) continue;
      if (!this.hasLineOfSight(titan.position, p.position)) continue;
      if (d < bestDist) {
        best = p;
        bestDist = d;
      }
    }
    return best;
  }

  titanStartCannon(titan, targetPlayer) {
    const now = Date.now();
    this.titanCannonCooldown.set(titan.id, now);
    if ((titan.soulType || 'green') === 'red') {
      const state = this._titanRedSyncCharges(titan, now);
      state.charges -= 1;
      state.pending.push(now + TITAN_CANNON_RED_CHARGE_MS);
      this.titanRedCannonLastCastAt.set(titan.id, now);
    }
    this.meleeLockUntil.set(titan.id, now + TITAN_CANNON_TOTAL_LOCK_MS);

    const dx = targetPlayer.position.x - titan.position.x;
    const dz = targetPlayer.position.z - titan.position.z;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    titan.rotation = Math.atan2(dx, dz);
    this._queueMove(titan.id, titan.position, titan.rotation);

    const ox = titan.position.x + ux * TITAN_CANNON_START_OFFSET;
    const oz = titan.position.z + uz * TITAN_CANNON_START_OFFSET;
    const strikeAt = now + TITAN_CANNON_WINDUP_MS;

    if (this.io) {
      this.io.to(this.roomId).emit('titan-cannon-windup', {
        titanId: titan.id,
        soulType: titan.soulType || 'green',
        origin: { x: ox, y: 0, z: oz },
        rotation: titan.rotation,
        range: TITAN_CANNON_RANGE,
        halfWidth: TITAN_CANNON_HALF_WIDTH,
        strikeAt,
        timestamp: now,
      });
    }

    const titanId = titan.id;
    const oldHandle = this.titanCannonWindupTimeout.get(titanId);
    if (oldHandle) clearTimeout(oldHandle);
    const handle = setTimeout(() => {
      this.titanCannonWindupTimeout.delete(titanId);
      this.titanFireCannon(titanId, ux, uz, ox, oz);
    }, TITAN_CANNON_WINDUP_MS);
    this.titanCannonWindupTimeout.set(titan.id, handle);
  }

  titanFireCannon(titanId, ux, uz, ox, oz) {
    const titan = this.room?.enemies?.get(titanId);
    if (!titan || titan.type !== 'titan' || titan.isDying || titan.health <= 0) return;
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;

    const bx = ox + ux * TITAN_CANNON_RANGE;
    const bz = oz + uz * TITAN_CANNON_RANGE;
    const damage = TITAN_CANNON_DAMAGE_BY_SOUL[titan.soulType] ?? TITAN_CANNON_DAMAGE_BY_SOUL.green;

    this.room?.damagePlayersInLineSegment(ox, oz, bx, bz, TITAN_CANNON_HALF_WIDTH, damage, 'titan_cannon', { sourceEnemyId: titanId });
  }

  tickTitanBladestorm(titan, dtSec) {
    if (!titan?.bladestormActive || titan.isDying || titan.health <= 0) return;

    const TAU = Math.PI * 2;
    const prevAngle = titan.bladestormSpinAngle || 0;
    const newAngle = prevAngle + dtSec * TITAN_BLADESTORM_SPIN_SPEED;
    titan.bladestormSpinAngle = newAngle;

    const prevFloor = Math.floor(prevAngle / TAU);
    const currFloor = Math.floor(newAngle / TAU);
    if (currFloor > prevFloor) {
      for (let f = prevFloor + 1; f <= currFloor; f++) {
        this.applyTitanBladestormDamage(titan);
      }
    }
  }

  applyTitanBladestormDamage(titan) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    if (!titan?.position) return;

    const center = titan.position;
    const radius = TITAN_BLADESTORM_HIT_RADIUS;
    const damage = TITAN_BLADESTORM_DAMAGE;
    const meta = { sourceEnemyId: titan.id, damageType: 'titan_bladestorm' };

    this.room?.damagePlayersInHorizontalRing(center, radius, damage, 'titan_bladestorm', meta);

    this.room?.tryDamageAlliedKnightInXZDisk(
      { x: center.x, z: center.z },
      radius,
      damage,
      meta,
    );

    const r2 = radius * radius;
    const enemies = this.room?.getEnemies?.() || [];
    for (const enemy of enemies) {
      if (!enemy || enemy.isDying || enemy.health <= 0) continue;
      if (enemy.type !== 'player-zombie') continue;
      const dx = (enemy.position?.x ?? 0) - center.x;
      const dz = (enemy.position?.z ?? 0) - center.z;
      if (dx * dx + dz * dz <= r2) {
        this.damagePlayerZombieFromMob(titan, enemy, damage, 'titan_bladestorm');
      }
    }
  }

  telegraphTitanAttack(titan, player) {
    if (this.io) {
      this.io.to(this.roomId).emit('titan-attack-telegraph', {
        titanId: titan.id,
        targetPlayerId: player.id,
        position: titan.position,
        timestamp: Date.now(),
      });
    }
    console.log(`🗿 Titan ${titan.id} telegraphing attack at target ${player.id}!`);
  }

  titanAttackPlayer(titan, player) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    const damage = titan.damage || 100;
    this.recordAlliedProtectionThreat(titan.id, player.id, damage);

    if (this.io) {
      this.io.to(this.roomId).emit('titan-attack', {
        titanId: titan.id,
        targetPlayerId: player.id,
        damage,
        position: titan.position,
        timestamp: Date.now(),
      });

      const dx = player.position.x - titan.position.x;
      const dz = player.position.z - titan.position.z;
      const len = Math.hypot(dx, dz) || 1;
      this.io.to(this.roomId).emit('player-knockback', {
        targetPlayerId: player.id,
        direction: { x: dx / len, y: 0, z: dz / len },
        distance: TITAN_KNOCKBACK_DISTANCE,
        duration: TITAN_KNOCKBACK_DURATION,
        timestamp: Date.now(),
      });
    }

    console.log(`🗿 Titan ${titan.id} attacked player ${player.id} for ${damage} damage + knockback!`);

    this.room?.tryDamageAlliedKnightInXZDisk(
      { x: titan.position.x, z: titan.position.z },
      TITAN_ATTACK_RANGE,
      damage,
      { sourceEnemyId: titan.id, damageType: 'titan_melee' },
    );
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
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    const damage = ghoul.damage || GHOUL_BASE_DAMAGE;
    this.recordAlliedProtectionThreat(ghoul.id, player.id, damage);

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

    const GHOUL_MELEE_ALLY_RADIUS = 2.4;
    this.room?.tryDamageAlliedKnightInXZDisk(
      { x: ghoul.position.x, z: ghoul.position.z },
      GHOUL_MELEE_ALLY_RADIUS,
      damage,
      { sourceEnemyId: ghoul.id, damageType: 'ghoul_melee' },
    );
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

  predictPlayerXZAtLeapLand(targetPlayer, durationMs) {
    const px = targetPlayer.position.x;
    const pz = targetPlayer.position.z;
    const md = targetPlayer.movementDirection;
    if (!md) return this.clampToArenaXZ(px, pz);

    const dt = durationMs / 1000;
    let dirX = 0;
    let dirZ = 0;
    let speed = 0;

    if (md.isDashing && md.dashDirection) {
      dirX = md.dashDirection.x;
      dirZ = md.dashDirection.z;
      const mag = Math.hypot(dirX, dirZ);
      if (mag > 0.01) {
        dirX /= mag;
        dirZ /= mag;
        speed = PLAYER_DASH_DISTANCE / PLAYER_DASH_DURATION_S;
      }
    } else {
      dirX = md.x;
      dirZ = md.z;
      const mag = Math.hypot(dirX, dirZ);
      if (mag > 0.01) {
        dirX /= mag;
        dirZ /= mag;
        speed = PLAYER_COOP_MAX_SPEED * (md.inputStrength ?? 1);
      }
    }

    if (speed <= 0) return this.clampToArenaXZ(px, pz);

    const offset = Math.min(speed * dt, MOB_LEAP_PREDICTION_MAX_OFFSET);
    return this.clampToArenaXZ(px + dirX * offset, pz + dirZ * offset);
  }

  computeMobLeapLandXZ(enemy, targetPlayer, maxTravel, standoffM, durationMs) {
    const predicted = this.predictPlayerXZAtLeapLand(targetPlayer, durationMs);
    const aimTarget = { position: { x: predicted.x, y: 0, z: predicted.z } };
    return this.computeLeapLandXZ(enemy, aimTarget, maxTravel, standoffM);
  }

  computeLeapLandXZ(enemy, targetPlayer, maxTravel, standoffM) {
    const bx = enemy.position.x;
    const bz = enemy.position.z;
    const tx = targetPlayer.position.x;
    const tz = targetPlayer.position.z;
    const dx = tx - bx;
    const dz = tz - bz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.01) return { x: bx, z: bz };
    const ndx = dx / dist;
    const ndz = dz / dist;
    const want = dist - standoffM;
    const travel = Math.max(0, Math.min(maxTravel, want));
    let lx = bx + ndx * travel;
    let lz = bz + ndz * travel;
    if (this.resolveEnemyWallCollisions) {
      const r = this.resolveEnemyWallCollisions(lx, lz);
      lx = r.x;
      lz = r.z;
    }
    return { x: lx, z: lz };
  }

  computeBossLeapLandXZ(boss, targetPlayer) {
    const leapCap =
      this.room && this.room.coopBossThroneArena ? BOSS_LEAP_MAX_TRAVEL_THRONE : BOSS_LEAP_MAX_TRAVEL;
    return this.computeLeapLandXZ(boss, targetPlayer, leapCap, BOSS_LEAP_LAND_STANDOFF_M);
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
    this._queueMove(boss.id, boss.position, boss.rotation);
  }

  bossStartLeap(boss, targetPlayer) {
    const tStart = Date.now();
    this.bossThrowLeapSharedCdUntil.set(boss.id, tStart + BOSS_THROW_LEAP_ICD_MS);
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
      this._queueMove(bossId, boss.position, boss.rotation);
    }
  }

  ghoulStartLeap(ghoul, targetPlayer) {
    const now = Date.now();
    if (
      ghoul.spawnedAt != null &&
      now - ghoul.spawnedAt < GHOUL_LEAP_POST_SPAWN_DELAY_MS
    ) {
      return;
    }

    const fromX = ghoul.position.x;
    const fromZ = ghoul.position.z;
    const { x: landX, z: landZ } = this.computeMobLeapLandXZ(
      ghoul,
      targetPlayer,
      GHOUL_LEAP_MAX_TRAVEL,
      GHOUL_LEAP_LAND_STANDOFF_M,
      GHOUL_LEAP_DURATION_MS,
    );
    const endAt = Date.now() + GHOUL_LEAP_DURATION_MS;
    this.ghoulLeapEndAt.set(ghoul.id, endAt);
    this.ghoulLeapLand.set(ghoul.id, { x: landX, z: landZ });
    this.ghoulLeapFrom.set(ghoul.id, { x: fromX, z: fromZ });
    this.meleeLockUntil.set(ghoul.id, endAt);
    if (this.io) {
      this.io.to(this.roomId).emit('ghoul-leap-start', {
        ghoulId: ghoul.id,
        startPosition: { x: ghoul.position.x, y: ghoul.position.y, z: ghoul.position.z },
        landPosition: { x: landX, y: 0, z: landZ },
        durationMs: GHOUL_LEAP_DURATION_MS,
        timestamp: Date.now(),
      });
    }
    const ghoulId = ghoul.id;
    const t = setTimeout(() => {
      this.ghoulCompleteLeap(ghoulId);
    }, GHOUL_LEAP_DURATION_MS);
    this.ghoulLeapTimeout.set(ghoul.id, t);
  }

  ghoulCompleteLeap(ghoulId) {
    this.ghoulLeapTimeout.delete(ghoulId);
    this.ghoulLeapEndAt.delete(ghoulId);
    const land = this.ghoulLeapLand.get(ghoulId);
    this.ghoulLeapLand.delete(ghoulId);
    this.ghoulLeapFrom.delete(ghoulId);
    const ghoul = this.room?.enemies?.get(ghoulId);
    if (!ghoul || ghoul.isDying || ghoul.health <= 0) return;
    if (land) {
      ghoul.position.x = land.x;
      ghoul.position.z = land.z;
    }
    this.ghoulLeapCooldown.set(ghoulId, Date.now());
    const leapDamage = ghoul.leapDamage ?? GHOUL_LEAP_DAMAGE;
    if (this.room) {
      this.room.damagePlayersInHorizontalRing(
        land,
        GHOUL_LEAP_LANDING_RADIUS,
        leapDamage,
        'ghoul_leap',
        { stunMs: GHOUL_LEAP_STUN_MS, sourceEnemyId: ghoulId },
      );
    }
    if (this.io) {
      this.io.to(this.roomId).emit('ghoul-leap-land', {
        ghoulId,
        landPosition: land ? { x: land.x, y: 0, z: land.z } : { x: ghoul.position.x, y: 0, z: ghoul.position.z },
        timestamp: Date.now(),
      });
      this._queueMove(ghoulId, ghoul.position, ghoul.rotation);
    }
  }

  templarStartLeap(templar, targetPlayer) {
    const fromX = templar.position.x;
    const fromZ = templar.position.z;
    const { x: landX, z: landZ } = this.computeMobLeapLandXZ(
      templar,
      targetPlayer,
      TEMPLAR_LEAP_MAX_TRAVEL,
      TEMPLAR_LEAP_LAND_STANDOFF_M,
      TEMPLAR_LEAP_DURATION_MS,
    );
    const endAt = Date.now() + TEMPLAR_LEAP_DURATION_MS;
    this.templarLeapEndAt.set(templar.id, endAt);
    this.templarLeapLand.set(templar.id, { x: landX, z: landZ });
    this.templarLeapFrom.set(templar.id, { x: fromX, z: fromZ });
    this.meleeLockUntil.set(templar.id, endAt);
    if (this.io) {
      this.io.to(this.roomId).emit('templar-leap-start', {
        templarId: templar.id,
        startPosition: { x: templar.position.x, y: templar.position.y, z: templar.position.z },
        landPosition: { x: landX, y: 0, z: landZ },
        durationMs: TEMPLAR_LEAP_DURATION_MS,
        timestamp: Date.now(),
      });
    }
    const templarId = templar.id;
    const t = setTimeout(() => {
      this.templarCompleteLeap(templarId);
    }, TEMPLAR_LEAP_DURATION_MS);
    this.templarLeapTimeout.set(templar.id, t);
  }

  templarCompleteLeap(templarId) {
    this.templarLeapTimeout.delete(templarId);
    this.templarLeapEndAt.delete(templarId);
    const land = this.templarLeapLand.get(templarId);
    this.templarLeapLand.delete(templarId);
    this.templarLeapFrom.delete(templarId);
    const templar = this.room?.enemies?.get(templarId);
    if (!templar || templar.isDying || templar.health <= 0) return;
    if (land) {
      templar.position.x = land.x;
      templar.position.z = land.z;
    }
    this.templarLeapCooldown.set(templarId, Date.now());
    if (this.room) {
      this.room.damagePlayersInHorizontalRing(
        land,
        TEMPLAR_LEAP_LANDING_RADIUS,
        TEMPLAR_LEAP_DAMAGE,
        'templar_leap',
        { sourceEnemyId: templarId },
      );
    }
    if (this.io) {
      this.io.to(this.roomId).emit('templar-leap-land', {
        templarId,
        landPosition: land ? { x: land.x, y: 0, z: land.z } : { x: templar.position.x, y: 0, z: templar.position.z },
        timestamp: Date.now(),
      });
      this._queueMove(templarId, templar.position, templar.rotation);
    }
  }

  tickGhoulLeapFlight(ghoul) {
    if (!this.ghoulLeapEndAt.has(ghoul.id)) return false;
    const now = Date.now();
    const end = this.ghoulLeapEndAt.get(ghoul.id);
    const land = this.ghoulLeapLand.get(ghoul.id);
    const from = this.ghoulLeapFrom.get(ghoul.id);
    if (now < end && land && from) {
      const startTime = end - GHOUL_LEAP_DURATION_MS;
      let u = (now - startTime) / GHOUL_LEAP_DURATION_MS;
      if (u < 0) u = 0;
      if (u > 1) u = 1;
      const su = u * u * (3 - 2 * u);
      ghoul.position.x = from.x + (land.x - from.x) * su;
      ghoul.position.z = from.z + (land.z - from.z) * su;
      ghoul.rotation = Math.atan2(land.x - from.x, land.z - from.z);
      this._queueMove(ghoul.id, ghoul.position, ghoul.rotation);
      return true;
    }
    if (now < end) return true;
    if (this.ghoulLeapLand.has(ghoul.id)) {
      this.ghoulCompleteLeap(ghoul.id);
    }
    return true;
  }

  tickTemplarLeapFlight(templar) {
    if (!this.templarLeapEndAt.has(templar.id)) return false;
    const now = Date.now();
    const end = this.templarLeapEndAt.get(templar.id);
    const land = this.templarLeapLand.get(templar.id);
    const from = this.templarLeapFrom.get(templar.id);
    if (now < end && land && from) {
      const startTime = end - TEMPLAR_LEAP_DURATION_MS;
      let u = (now - startTime) / TEMPLAR_LEAP_DURATION_MS;
      if (u < 0) u = 0;
      if (u > 1) u = 1;
      const su = u * u * (3 - 2 * u);
      templar.position.x = from.x + (land.x - from.x) * su;
      templar.position.z = from.z + (land.z - from.z) * su;
      templar.rotation = Math.atan2(land.x - from.x, land.z - from.z);
      this._queueMove(templar.id, templar.position, templar.rotation);
      return true;
    }
    if (now < end) return true;
    if (this.templarLeapLand.has(templar.id)) {
      this.templarCompleteLeap(templar.id);
    }
    return true;
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

    let lastSummon = this.boss2WarlockSummonLastAt.get(boss.id);
    if (lastSummon === undefined) {
      lastSummon = now;
      this.boss2WarlockSummonLastAt.set(boss.id, lastSummon);
    }
    if (now - lastSummon >= BOSS2_WARLOCK_SUMMON_INTERVAL_MS) {
      this.boss2WarlockSummonLastAt.set(boss.id, now);
      this.boss2SummonPurpleWarlock(boss);
    }

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

  addBoss2DeathGraspTimer(bossId, timer) {
    const timers = this.boss2DeathGraspTimeouts.get(bossId) || [];
    timers.push(timer);
    this.boss2DeathGraspTimeouts.set(bossId, timers);
  }

  clearBoss2DeathGraspTimers(bossId) {
    const timers = this.boss2DeathGraspTimeouts.get(bossId);
    if (timers) {
      timers.forEach((t) => clearTimeout(t));
    }
    this.boss2DeathGraspTimeouts.delete(bossId);
  }

  addBoss2FlamePillarTimeout(bossId, handle) {
    const arr = this.boss2FlamePillarTimeouts.get(bossId) || [];
    arr.push(handle);
    this.boss2FlamePillarTimeouts.set(bossId, arr);
  }

  clearBoss2FlamePillarTimers(bossId) {
    const arr = this.boss2FlamePillarTimeouts.get(bossId);
    if (arr) {
      arr.forEach((t) => clearTimeout(t));
    }
    this.boss2FlamePillarTimeouts.delete(bossId);
  }

  boss2SummonPurpleWarlock(boss) {
    if (!this.room || !boss || boss.type !== 'boss2') return;

    const ex = BOSS2_SUMMON_ARENA_EXTENT;
    const clampXZ = (x, z) => ({
      x: Math.max(-ex, Math.min(ex, x)),
      y: 0,
      z: Math.max(-ex, Math.min(ex, z)),
    });

    const bx = boss.position.x;
    const bz = boss.position.z;
    let pos = { ...clampXZ(bx + 5, bz), y: 0 };
    for (let attempt = 0; attempt < 48; attempt += 1) {
      const a = Math.random() * Math.PI * 2;
      const rad = 3.5 + Math.random() * (ex - 3.5);
      const rawX = Math.sin(a) * rad;
      const rawZ = Math.cos(a) * rad;
      const p = clampXZ(rawX, rawZ);
      if (Math.hypot(p.x - bx, p.z - bz) < 2.8) continue;
      const resolved = this.resolveEnemyWallCollisions(p.x, p.z);
      pos = { x: resolved.x, y: 0, z: resolved.z };
      break;
    }

    const warlockId = `warlock-boss2-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const warlock = {
      id: warlockId,
      type: 'warlock',
      position: { x: pos.x, y: 0, z: pos.z },
      rotation: rotationYTowardEntry(pos.x, pos.z),
      health: 800,
      maxHealth: 800,
      damage: 100,
      moveSpeed: 1.75,
      isDying: false,
      staggerBuildup: 0,
      soulType: 'purple',
      campType: 'purple',
      campIndex: 0,
      bossId: null,
      summonedByBoss2Id: boss.id,
      spawnedAt: Date.now(),
    };

    this.room.addEnemy(warlock);
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-spawned', {
        enemy: warlock,
        timestamp: Date.now(),
      });
    }
    console.log(`👹 Boss2 ${boss.id} summoned purple warlock ${warlockId} at (${pos.x.toFixed(2)}, ${pos.z.toFixed(2)})`);
  }

  boss2CastDeathGraspArc(boss, targetPlayer, onComplete) {
    if (!this.room || !boss || !targetPlayer) return;

    this.clearBoss2DeathGraspTimers(boss.id);

    const bossId = boss.id;
    const targetId = targetPlayer.id;
    const startedAt = Date.now();

    const dx = targetPlayer.position.x - boss.position.x;
    const dz = targetPlayer.position.z - boss.position.z;
    if (dx !== 0 || dz !== 0) {
      boss.rotation = Math.atan2(dx, dz);
    }

    this.boss2ArchonLightningLockUntil.set(
      bossId,
      startedAt + BOSS2_DEATH_GRASP_CAST_MS + BOSS2_DEATH_GRASP_TRAVEL_MS + 200,
    );

    if (this.io) {
      this._queueMove(bossId, boss.position, boss.rotation);
      this.io.to(this.roomId).emit('boss2-deathgrasp-telegraph', {
        bossId,
        targetPlayerId: targetId,
        castMs: BOSS2_DEATH_GRASP_CAST_MS,
        timestamp: startedAt,
      });
    }

    const launchTimer = setTimeout(() => {
      const liveBoss = this.room?.getEnemy(bossId);
      if (!this.room?.getGameStarted() || !liveBoss || liveBoss.isDying || liveBoss.health <= 0) return;

      const players = this.room?.getPlayers();
      if (!players || players.length === 0) return;

      const launchTarget = players.find((p) => p.id === targetId && p.health > 0) || this.getBossThreatTarget(liveBoss, players);
      if (!launchTarget || launchTarget.health <= 0) return;

      const sx = liveBoss.position.x;
      const sz = liveBoss.position.z;
      const startPosition = {
        x: sx,
        y: liveBoss.position.y + 1.5,
        z: sz,
      };
      const tdx = launchTarget.position.x - sx;
      const tdz = launchTarget.position.z - sz;
      const targetDistance = Math.min(BOSS2_DEATH_GRASP_RANGE, Math.hypot(tdx, tdz) || BOSS2_DEATH_GRASP_RANGE);
      const baseAngle = Math.atan2(tdx, tdz);
      const deltas = [-BOSS2_DEATH_GRASP_ARC_RADIANS, 0, BOSS2_DEATH_GRASP_ARC_RADIANS];
      const projectiles = deltas.map((delta) => {
        const angle = baseAngle + delta;
        return {
          startPosition,
          endPosition: {
            x: sx + Math.sin(angle) * targetDistance,
            y: launchTarget.position.y + 1.0,
            z: sz + Math.cos(angle) * targetDistance,
          },
        };
      });

      if (this.io) {
        this.io.to(this.roomId).emit('boss2-deathgrasp-projectiles', {
          bossId,
          projectiles,
          travelMs: BOSS2_DEATH_GRASP_TRAVEL_MS,
          timestamp: Date.now(),
        });
      }

      const resolveTimer = setTimeout(() => {
        const k = this.room?.getEnemy(bossId);
        const currentPlayers = this.room?.getPlayers();
        if (!this.room?.getGameStarted() || !k || k.isDying || k.health <= 0 || !currentPlayers) return;

        const hitPlayerIds = new Set();
        projectiles.forEach(({ endPosition }) => {
          currentPlayers.forEach((currentPlayer) => {
            if (!currentPlayer || currentPlayer.health <= 0 || hitPlayerIds.has(currentPlayer.id)) return;

            const pdx = currentPlayer.position.x - endPosition.x;
            const pdz = currentPlayer.position.z - endPosition.z;
            if (Math.hypot(pdx, pdz) > BOSS2_DEATH_GRASP_HIT_RADIUS) return;

            hitPlayerIds.add(currentPlayer.id);

            const bdx = currentPlayer.position.x - k.position.x;
            const bdz = currentPlayer.position.z - k.position.z;
            const bLen = Math.hypot(bdx, bdz) || 1;
            const newPosition = {
              x: k.position.x + (bdx / bLen) * BOSS2_DEATH_GRASP_STANDOFF,
              y: currentPlayer.position.y,
              z: k.position.z + (bdz / bLen) * BOSS2_DEATH_GRASP_STANDOFF,
            };
            const player = this.room.getPlayer(currentPlayer.id);
            if (!player) return;

            const rot = player.rotation || { x: 0, y: 0, z: 0 };
            this.room.updatePlayerPosition(
              currentPlayer.id,
              newPosition,
              rot,
              { x: 0, y: 0, z: 0 },
            );

            if (this.io) {
              this.io.to(this.roomId).emit('boss2-deathgrasp-pull', {
                bossId,
                targetPlayerId: currentPlayer.id,
                position: newPosition,
                rotation: rot,
                timestamp: Date.now(),
              });
            }
          });
        });

        this.clearBoss2DeathGraspTimers(bossId);

        if (onComplete) {
          onComplete();
        }
      }, BOSS2_DEATH_GRASP_TRAVEL_MS);
      this.addBoss2DeathGraspTimer(bossId, resolveTimer);
    }, BOSS2_DEATH_GRASP_CAST_MS);
    this.addBoss2DeathGraspTimer(bossId, launchTimer);
  }

  updateBoss3AI(boss, players) {
    if (!this.bossDamageTracking.has(boss.id)) {
      this.bossDamageTracking.set(boss.id, new Map());
    }
    if (!this.bossSpawnTime.has(boss.id)) {
      this.bossSpawnTime.set(boss.id, boss.spawnedAt || Date.now());
    }

    const now = Date.now();

    const beamEndStored = this.boss3GreenBeamEndAt.get(boss.id);
    if (beamEndStored !== undefined && now >= beamEndStored) {
      this.boss3GreenBeamEndAt.delete(boss.id);
      const iv = this.boss3GreenBeamDamageInterval.get(boss.id);
      if (iv) clearInterval(iv);
      this.boss3GreenBeamDamageInterval.delete(boss.id);
      if (this.io) {
        this.io.to(this.roomId).emit('boss3-green-beam-end', {
          bossId: boss.id,
          timestamp: Date.now(),
        });
      }
    }

    const beamActiveUntil = this.boss3GreenBeamEndAt.get(boss.id);
    if (beamActiveUntil !== undefined && now < beamActiveUntil) {
      const beamTarget = this.getBossThreatTarget(boss, players);
      if (beamTarget) {
        this.updateBoss3GreenBeamRotation(boss, beamTarget);
        this._queueMove(boss.id, boss.position, boss.rotation);
        boss.bossStationary = true;
        return;
      }
    }

    this.boss3MaybeTriggerGreenBeamStages(boss, now);

    this.boss3MaybeStartLightningPhase(boss);

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
      this._queueMove(boss.id, boss.position, boss.rotation);
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

    const activeGhoulId = this.weaverSummonedGhouls.get(boss.id);
    const ghoulAlive =
      activeGhoulId &&
      this.room?.enemies.has(activeGhoulId) &&
      !this.room?.enemies.get(activeGhoulId)?.isDying;

    const canSummon =
      charges > 0 &&
      !ghoulAlive &&
      !this.boss3IsNovaCasting(boss.id);

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
    const castingBlocked = this.boss3IsNovaCasting(boss.id);

    if (!castingBlocked && novaReady) {
      this.boss3StartNovaWindup(boss, targetPlayer, now);
    }
  }

  updateBoss3GreenBeamRotation(boss, targetPlayer) {
    if (!targetPlayer) return;

    const direction = {
      x: targetPlayer.position.x - boss.position.x,
      y: 0,
      z: targetPlayer.position.z - boss.position.z,
    };

    const magnitude = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    if (magnitude === 0) return;

    direction.x /= magnitude;
    direction.z /= magnitude;

    const targetRotation = Math.atan2(direction.x, direction.z);
    const currentRotation = boss.rotation || 0;

    let rotationDiff = targetRotation - currentRotation;
    while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

    const deltaTime = this.updateInterval / 1000;
    const rotationStep = rotationDiff * Math.min(1, BOSS3_GREEN_BEAM_ROT_SPEED * deltaTime);

    boss.rotation = currentRotation + rotationStep;

    while (boss.rotation > Math.PI) boss.rotation -= Math.PI * 2;
    while (boss.rotation < -Math.PI) boss.rotation += Math.PI * 2;

    this._queueMove(boss.id, boss.position, boss.rotation);
  }

  boss3MaybeTriggerGreenBeamStages(boss, now) {
    if (!boss || boss.type !== 'boss3' || boss.isDying || boss.health <= 0) return;
    const activeUntil = this.boss3GreenBeamEndAt.get(boss.id);
    if (activeUntil !== undefined && now < activeUntil) return;

    let stages = this.boss3GreenBeamStages.get(boss.id);
    if (!stages) {
      stages = { p75: false, p50: false, p25: false };
      this.boss3GreenBeamStages.set(boss.id, stages);
    }

    const hpFrac = boss.maxHealth > 0 ? boss.health / boss.maxHealth : 1;

    if (!stages.p75 && hpFrac <= 0.75) {
      stages.p75 = true;
      this.boss3StartGreenBeam(boss, now);
      return;
    }
    if (!stages.p50 && hpFrac <= 0.5) {
      stages.p50 = true;
      this.boss3StartGreenBeam(boss, now);
      return;
    }
    if (!stages.p25 && hpFrac <= 0.25) {
      stages.p25 = true;
      this.boss3StartGreenBeam(boss, now);
    }
  }

  boss3StartGreenBeam(boss, now) {
    if (!this.room || !boss || boss.type !== 'boss3') return;

    const bossId = boss.id;
    const oldIv = this.boss3GreenBeamDamageInterval.get(bossId);
    if (oldIv) clearInterval(oldIv);
    this.boss3GreenBeamDamageInterval.delete(bossId);

    const endAt = now + BOSS3_GREEN_BEAM_DURATION_MS;
    this.boss3GreenBeamEndAt.set(bossId, endAt);
    this.boss3LockUntil.set(bossId, endAt);

    if (this.io) {
      this.io.to(this.roomId).emit('boss3-green-beam-start', {
        bossId,
        durationMs: BOSS3_GREEN_BEAM_DURATION_MS,
        timestamp: now,
      });
    }

    const applyTick = () => {
      const live = this.room?.getEnemy(bossId);
      if (!this.room?.getGameStarted() || !live || live.isDying || live.health <= 0 || live.type !== 'boss3') {
        return;
      }
      const br = live.rotation || 0;
      const fx = Math.sin(br);
      const fz = Math.cos(br);
      const ax = live.position.x + fx * 0.65;
      const az = live.position.z + fz * 0.65;
      const bx = live.position.x + fx * BOSS3_GREEN_BEAM_RANGE;
      const bz = live.position.z + fz * BOSS3_GREEN_BEAM_RANGE;
      this.room.damagePlayersInLineSegment(
        ax,
        az,
        bx,
        bz,
        BOSS3_GREEN_BEAM_HALF_WIDTH,
        BOSS3_GREEN_BEAM_DPS,
        'boss3_green_beam',
      );
    };

    applyTick();
    const intervalId = setInterval(applyTick, BOSS3_GREEN_BEAM_TICK_MS);
    this.boss3GreenBeamDamageInterval.set(bossId, intervalId);

    console.log(`🕸 Boss3 ${bossId} green beam channel (${BOSS3_GREEN_BEAM_DURATION_MS}ms).`);
  }

  boss3MaybeStartLightningPhase(boss) {
    if (!boss || boss.type !== 'boss3') return;
    if (this.boss3LightningInterval.has(boss.id)) return;
    if (!boss.maxHealth || boss.health / boss.maxHealth > BOSS3_LIGHTNING_HEALTH_PCT) return;

    const castLightningGroup = () => {
      const live = this.room?.getEnemy(boss.id);
      const livePlayers = this.room?.getPlayers()?.filter((p) => p && p.health > 0) || [];
      if (
        !this.room?.getGameStarted() ||
        !live ||
        live.isDying ||
        live.health <= 0 ||
        live.type !== 'boss3' ||
        livePlayers.length === 0
      ) {
        const interval = this.boss3LightningInterval.get(boss.id);
        if (interval) clearInterval(interval);
        this.boss3LightningInterval.delete(boss.id);
        return;
      }

      const primaryTarget = this.getBossThreatTarget(live, livePlayers) || livePlayers[Math.floor(Math.random() * livePlayers.length)];
      const positions = this.boss3CreateLightningTargets(primaryTarget);
      const groupStartedAt = Date.now();

      positions.forEach((position, index) => {
        if (!this.io) return;
        this.io.to(this.roomId).emit('weaver-lightning-telegraph', {
          weaverId: live.id,
          targetPosition: position,
          strikeAt: groupStartedAt + BOSS3_LIGHTNING_CHARGE_MS + (index * BOSS3_LIGHTNING_STAGGER_MS),
          damage: BOSS3_LIGHTNING_DAMAGE,
          radius: BOSS3_LIGHTNING_RADIUS,
          theme: 'green',
          timestamp: groupStartedAt + index,
        });
      });

      console.log(`🕸 Boss3 ${live.id} 50% lightning phase — 3 staggered strikes.`);
    };

    castLightningGroup();
    const interval = setInterval(castLightningGroup, BOSS3_LIGHTNING_INTERVAL_MS);
    this.boss3LightningInterval.set(boss.id, interval);
    console.log(`🕸 Boss3 ${boss.id} entered persistent lightning phase at ${Math.round((boss.health / boss.maxHealth) * 100)}% HP.`);
  }

  boss3CreateLightningTargets(primaryTarget) {
    const clampXZ = (x, z) => ({ ...this.clampToArenaXZ(x, z), y: 0 });

    const x0 = primaryTarget?.position?.x || 0;
    const z0 = primaryTarget?.position?.z || 0;

    const offsetNearPrimary = () => {
      const r = BOSS3_LIGHTNING_OFFSET_MIN + Math.random() * (BOSS3_LIGHTNING_OFFSET_MAX - BOSS3_LIGHTNING_OFFSET_MIN);
      const a = Math.random() * Math.PI * 2;
      return clampXZ(x0 + Math.cos(a) * r, z0 + Math.sin(a) * r);
    };

    return [clampXZ(x0, z0), offsetNearPrimary(), offsetNearPrimary()];
  }

  boss3HasActiveNovaSweeps(bossId) {
    const set = this.boss3NovaSweepInterval.get(bossId);
    return !!(set && set.size > 0);
  }

  boss3IsNovaCasting(bossId) {
    const burstTimeouts = this.boss3NovaBurstTimeouts.get(bossId);
    return (
      this.boss3NovaWindupTimeout.has(bossId) ||
      this.boss3HasActiveNovaSweeps(bossId) ||
      !!(burstTimeouts && burstTimeouts.length > 0)
    );
  }

  boss3ClearNovaBurstTimeouts(bossId) {
    const timeouts = this.boss3NovaBurstTimeouts.get(bossId);
    if (timeouts) {
      timeouts.forEach((t) => clearTimeout(t));
    }
    this.boss3NovaBurstTimeouts.delete(bossId);
  }

  boss3ClearNovaSweepIntervals(bossId) {
    const set = this.boss3NovaSweepInterval.get(bossId);
    if (set) {
      set.forEach((iv) => clearInterval(iv));
    }
    this.boss3NovaSweepInterval.delete(bossId);
  }

  boss3AddNovaSweepInterval(bossId, intervalId) {
    let set = this.boss3NovaSweepInterval.get(bossId);
    if (!set) {
      set = new Set();
      this.boss3NovaSweepInterval.set(bossId, set);
    }
    set.add(intervalId);
  }

  boss3RemoveNovaSweepInterval(bossId, intervalId) {
    const set = this.boss3NovaSweepInterval.get(bossId);
    if (!set) return;
    clearInterval(intervalId);
    set.delete(intervalId);
    if (set.size === 0) {
      this.boss3NovaSweepInterval.delete(bossId);
    }
  }

  boss3ScheduleNovaBurstTimeout(bossId, fn, delayMs) {
    let timeouts = this.boss3NovaBurstTimeouts.get(bossId);
    if (!timeouts) {
      timeouts = [];
      this.boss3NovaBurstTimeouts.set(bossId, timeouts);
    }
    const t = setTimeout(() => {
      const arr = this.boss3NovaBurstTimeouts.get(bossId);
      if (arr) {
        const idx = arr.indexOf(t);
        if (idx >= 0) arr.splice(idx, 1);
        if (arr.length === 0) this.boss3NovaBurstTimeouts.delete(bossId);
      }
      fn();
    }, delayMs);
    timeouts.push(t);
    return t;
  }

  boss3GetNovaBurstRounds(hpFrac) {
    if (hpFrac <= BOSS3_NOVA_HP_TRIPLE_ROUND) return 3;
    if (hpFrac <= BOSS3_NOVA_HP_DOUBLE_ROUND) return 2;
    return 1;
  }

  boss3ReleaseNovaRound(bossId, targetPlayer, roundIndex = 0, burstRounds = 1) {
    if (!this.room) return false;

    const live = this.room.enemies?.get(bossId);
    const players = this.room.getPlayers();
    if (!live || live.isDying || live.health <= 0 || live.type !== 'boss3' || !players) {
      return false;
    }

    const threat = this.getBossThreatTarget(live, players) || targetPlayer;
    const tx = typeof threat?.position?.x === 'number' ? threat.position.x : live.position.x;
    const tz = typeof threat?.position?.z === 'number' ? threat.position.z : live.position.z;

    const ox = live.position.x;
    const oz = live.position.z;
    const rdx = tx - ox;
    const rdz = tz - oz;
    const baseAngle = Math.atan2(rdx, rdz);

    const dirs = [0, 1, 2].map((k) => ({
      ux: Math.sin(baseAngle + (k * Math.PI * 2) / 3),
      uz: Math.cos(baseAngle + (k * Math.PI * 2) / 3),
    }));

    const releasedAt = Date.now();
    if (roundIndex === 0) {
      this.boss3NovaLastRelease.set(live.id, releasedAt);
    }

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
        roundIndex,
        burstRounds,
      });
    }

    const hitSets = [new Set(), new Set(), new Set()];
    const STEP_MS = Math.max(30, Math.floor(BOSS3_NOVA_TRAVEL_MS / BOSS3_NOVA_STEPS));
    let step = 0;
    let intervalId;

    const tick = () => {
      const b = this.room?.enemies?.get(bossId);
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
        this.boss3RemoveNovaSweepInterval(bossId, intervalId);
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
        this.boss3RemoveNovaSweepInterval(bossId, intervalId);
      }
    };

    intervalId = setInterval(tick, STEP_MS);
    this.boss3AddNovaSweepInterval(bossId, intervalId);
    tick();

    console.log(`🕸 Boss3 ${live.id} arcane nova round ${roundIndex + 1}/${burstRounds} — 3 discs.`);
    return true;
  }

  boss3StartNovaWindup(boss, targetPlayer, startedAt) {
    if (!this.room) return;

    const oldT = this.boss3NovaWindupTimeout.get(boss.id);
    if (oldT) clearTimeout(oldT);
    this.boss3ClearNovaBurstTimeouts(boss.id);

    if (this.io) {
      this.io.to(this.roomId).emit('boss3-nova-start', {
        bossId: boss.id,
        timestamp: startedAt,
        windupMs: BOSS3_NOVA_WINDUP_MS,
      });
    }

    const hpFracAtWindup = boss.maxHealth > 0 ? boss.health / boss.maxHealth : 1;
    const burstRoundsAtWindup = this.boss3GetNovaBurstRounds(hpFracAtWindup);
    const burstSpanAtWindup =
      (burstRoundsAtWindup - 1) * BOSS3_NOVA_BURST_GAP_MS + BOSS3_NOVA_TRAVEL_MS;
    this.boss3LockUntil.set(boss.id, startedAt + BOSS3_NOVA_WINDUP_MS + burstSpanAtWindup);

    const windupTimer = setTimeout(() => {
      this.boss3NovaWindupTimeout.delete(boss.id);

      const live = this.room?.enemies?.get(boss.id);
      if (!live || live.isDying || live.health <= 0 || live.type !== 'boss3') {
        return;
      }

      const hpFrac = live.maxHealth > 0 ? live.health / live.maxHealth : 1;
      const burstRounds = this.boss3GetNovaBurstRounds(hpFrac);
      const burstSpan = (burstRounds - 1) * BOSS3_NOVA_BURST_GAP_MS + BOSS3_NOVA_TRAVEL_MS;
      this.boss3LockUntil.set(boss.id, startedAt + BOSS3_NOVA_WINDUP_MS + burstSpan);

      this.boss3ReleaseNovaRound(boss.id, targetPlayer, 0, burstRounds);

      for (let r = 1; r < burstRounds; r += 1) {
        this.boss3ScheduleNovaBurstTimeout(
          boss.id,
          () => this.boss3ReleaseNovaRound(boss.id, targetPlayer, r, burstRounds),
          r * BOSS3_NOVA_BURST_GAP_MS,
        );
      }

      console.log(
        `🕸 Boss3 ${boss.id} arcane nova burst (${burstRounds} round${burstRounds > 1 ? 's' : ''}).`,
      );
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
      this._queueMove(boss.id, boss.position, boss.rotation);
    }

    const bossId = boss.id;
    const r = boss.rotation;
    const fx = Math.sin(r);
    const fz = Math.cos(r);
    const py = boss.position.y;
    const pillar1 = {
      x: boss.position.x + fx * BOSS2_FLAME_PILLAR_FORWARD_1,
      y: py,
      z: boss.position.z + fz * BOSS2_FLAME_PILLAR_FORWARD_1,
    };
    const pillar2 = {
      x: boss.position.x + fx * BOSS2_FLAME_PILLAR_FORWARD_2,
      y: py,
      z: boss.position.z + fz * BOSS2_FLAME_PILLAR_FORWARD_2,
    };

    const erupt = (center) => {
      const live = this.room?.getEnemy(bossId);
      if (!this.room?.getGameStarted() || !live || live.isDying || live.health <= 0 || live.type !== 'boss2') return;
      if (this.io) {
        this.io.to(this.roomId).emit('boss2-flame-pillar', {
          bossId,
          position: { x: center.x, y: center.y, z: center.z },
          timestamp: Date.now(),
        });
      }
      this.room.damagePlayersInHorizontalRing(center, BOSS2_FLAME_PILLAR_RADIUS, BOSS2_FLAME_PILLAR_DAMAGE, 'boss2_flame_pillar');
    };

    const h1 = setTimeout(() => erupt(pillar1), BOSS2_FLAME_PILLAR_BLINK_DELAY_MS);
    const h2 = setTimeout(() => erupt(pillar2), BOSS2_FLAME_PILLAR_BLINK_DELAY_MS + BOSS2_FLAME_PILLAR_STAGGER_MS);
    this.addBoss2FlamePillarTimeout(bossId, h1);
    this.addBoss2FlamePillarTimeout(bossId, h2);
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

      if (comboPhase === 1) {
        const players = this.room?.getPlayers();
        const deathGraspTarget = players ? this.getBossThreatTarget(liveBoss, players) : null;
        if (!deathGraspTarget) return;

        this.boss2CastDeathGraspArc(liveBoss, deathGraspTarget, () => {
          const nextBoss = this.room?.getEnemy(boss.id);
          const nextPlayers = this.room?.getPlayers();
          if (!nextBoss || nextBoss.isDying || nextBoss.health <= 0 || !nextPlayers) return;

          const nextTarget = this.getBossThreatTarget(nextBoss, nextPlayers);
          if (!nextTarget) return;

          this.boss2StartArchonLightning(nextBoss, nextTarget);
        });
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

    const throwMoveUnlock = this.bossThrowEndAt.get(boss.id);
    if (throwMoveUnlock != null && now >= throwMoveUnlock) {
      this.bossThrowEndAt.delete(boss.id);
    }

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
          this._queueMove(boss.id, boss.position, boss.rotation);
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
        this._queueMove(boss.id, boss.position, boss.rotation);
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
      !this.bossThrowEndAt.has(boss.id) && // active throw move-lock (expired entries removed above)
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
      const mobilityCdUntil = this.bossThrowLeapSharedCdUntil.get(boss.id);
      const mobilityReady = mobilityCdUntil == null || now >= mobilityCdUntil;
      if (distance > BOSS_THROW_MIN_RANGE) {
        const lastThrow = this.bossThrowCooldown.get(boss.id);
        const combatStartedAt = this.bossCombatStartedMs.get(boss.id);
        const throwFightDelayReady =
          combatStartedAt != null &&
          now - combatStartedAt >= BOSS_THROW_FIGHT_START_DELAY_MS;
        if (
          throwFightDelayReady &&
          mobilityReady &&
          (lastThrow == null || now - lastThrow >= BOSS_THROW_COOLDOWN_MS)
        ) {
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
      if (canLeap && mobilityReady) {
        this.bossStartLeap(boss, targetPlayer);
        boss.bossStationary = false;
        return;
      }
      this.moveEnemyTowardsTarget(boss, targetPlayer);
    } else {
      const lastAttackTime = this.bossAttackCooldown.get(boss.id) || 0;
      if (
        now - lastAttackTime >= BOSS_MELEE_COOLDOWN_MS &&
        this.isBossFacingTarget(boss, targetPlayer)
      ) {
        this.bossAttackCooldown.set(boss.id, now);
        this.meleeLockUntil.set(boss.id, now + BOSS_MELEE_ATTACK_LOCK_MS);

        const idx = this.bossMeleePatternIndex.get(boss.id) || 0;
        const meleeIndex = idx % 2;
        this.bossMeleePatternIndex.set(boss.id, idx + 1);

        this.telegraphBossAttack(boss, targetPlayer, meleeIndex);

        const pid = targetPlayer.id;
        const bossId = boss.id;
        setTimeout(() => {
          if (!this.room?.getGameStarted()) return;
          const liveBoss = this.room?.enemies?.get(bossId);
          if (!liveBoss || liveBoss.isDying || liveBoss.health <= 0) return;
          if (this.room?.isEnemyAffectedBy(bossId, 'stun')) return;

          const currentPlayers = this.room?.getPlayers();
          if (!currentPlayers) return;

          const currentTarget = currentPlayers.find((p) => p.id === pid);
          if (!currentTarget || currentTarget.health <= 0) return;

          const currentDistance = this.calculateDistance(liveBoss.position, currentTarget.position);
          if (
            currentDistance <= BOSS_MELEE_RANGE &&
            this.isBossFacingTarget(liveBoss, currentTarget)
          ) {
            this.bossAttackPlayer(liveBoss, currentTarget, meleeIndex);
          }
        }, BOSS_MELEE_HIT_DELAY_MS);
      }
    }

    const movedN = lastPos
      ? Math.hypot(boss.position.x - lastPos.x, boss.position.z - lastPos.z) >= BOSS_STATIONARY_EPS
      : true;
    boss.bossStationary = !movedN;
  }

  telegraphBossAttack(boss, player, meleeIndex) {
    if (this.io) {
      this.io.to(this.roomId).emit('boss-attack-telegraph', {
        bossId: boss.id,
        targetPlayerId: player.id,
        position: boss.position,
        meleeIndex,
        timestamp: Date.now(),
      });
    }
    console.log(`🔥 Boss ${boss.id} telegraphing melee ${meleeIndex} at player ${player.id}!`);
  }

  bossAttackPlayer(boss, player, meleeIndex = 0) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
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
    console.log(`🔥 Boss ${boss.id} attacked player ${player.id} for ${damage} damage (melee ${meleeIndex})`);
  }

  bossStartThrow(boss, targetPlayer) {
    const tStart = Date.now();
    this.bossThrowLeapSharedCdUntil.set(boss.id, tStart + BOSS_THROW_LEAP_ICD_MS);
    const staleTarget = { x: targetPlayer.position.x, y: targetPlayer.position.y, z: targetPlayer.position.z };
    this.bossThrowTarget.set(boss.id, staleTarget);
    const endAt = tStart + BOSS_THROW_MOVE_LOCK_MS;
    this.bossThrowEndAt.set(boss.id, endAt);

    if (this.io) {
      this.io.to(this.roomId).emit('boss-throw-start', {
        bossId: boss.id,
        position: { ...boss.position },
        moveLockMs: BOSS_THROW_MOVE_LOCK_MS,
        spearReleaseMs: BOSS_THROW_SPEAR_RELEASE_MS,
        timestamp: tStart,
      });
    }

    const t = setTimeout(() => {
      this.bossCompleteThrow(boss.id);
    }, BOSS_THROW_SPEAR_RELEASE_MS);
    this.bossThrowTimeout.set(boss.id, t);
    console.log(`🗡️  Boss ${boss.id} starting throw at player ${targetPlayer.id}`);
  }

  bossCompleteThrow(bossId) {
    clearTimeout(this.bossThrowTimeout.get(bossId));
    this.bossThrowTimeout.delete(bossId);

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

    const boss = this.room?.enemies?.get?.(bossId);
    if (boss?.type === 'boss' && !this.bossCombatStartedMs.has(bossId)) {
      const startedAt = Date.now();
      this.bossCombatStartedMs.set(bossId, startedAt);
      if (this.io) {
        this.io.to(this.roomId).emit('boss-combat-started', {
          bossId,
          timestamp: startedAt,
        });
      }
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
    this._queueMove(boss.id, boss.position, boss.rotation);
  }

  getMeleeBodyRadius(type) {
    switch (type) {
      case 'knight':
      case 'allied-knight':
        return 0.85;
      case 'templar':
      case 'ghoul':
        return 0.95;
      case 'titan':
        return 1.2;
      case 'martyr': return 0.8;
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
   * Spatial bucket of melee-only enemies for O(1) nearby peer queries during separation.
   */
  _buildMeleePeerGrid(enemies) {
    const CELL = 2.5;
    const grid = new Map();
    for (const e of enemies) {
      if (!e || e.isDying || e.health <= 0) continue;
      if (!MELEE_SURROUND_TYPES.has(e.type)) continue;
      const cx = Math.floor(e.position.x / CELL);
      const cz = Math.floor(e.position.z / CELL);
      const key = `${cx},${cz}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(e);
    }
    return { grid, cellSize: CELL };
  }

  _getMeleePeersNear(x, z) {
    if (!this._meleePeerGrid) {
      return (this._tickEnemies || this.room.getEnemies()).filter(
        (e) => e && !e.isDying && e.health > 0 && MELEE_SURROUND_TYPES.has(e.type),
      );
    }
    const { grid, cellSize } = this._meleePeerGrid;
    const cx = Math.floor(x / cellSize);
    const cz = Math.floor(z / cellSize);
    const out = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const bucket = grid.get(`${cx + dx},${cz + dz}`);
        if (bucket) out.push(...bucket);
      }
    }
    return out;
  }

  _resetAStarBuffers(cellCount) {
    if (!this._astarGScore || this._astarGScore.length !== cellCount) {
      this._astarGScore = new Float32Array(cellCount);
      this._astarCameFrom = new Int32Array(cellCount);
      this._astarInOpen = new Uint8Array(cellCount);
    }
    this._astarGScore.fill(Infinity);
    this._astarCameFrom.fill(-1);
    this._astarInOpen.fill(0);
    return {
      gScore: this._astarGScore,
      cameFrom: this._astarCameFrom,
      inOpen: this._astarInOpen,
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
      for (const other of this._getMeleePeersNear(rx, rz)) {
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

    this._queueMove(enemy.id, enemy.position, enemy.rotation);
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

    // Entangle only prevents ordinary locomotion; attacks/casts/blinks are not gated on it.
    if (this.room.isEnemyAffectedBy(enemyId, 'entangle')) {
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
      case 'titan':   return 2.5;
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

  /** @returns {{ packHunter: boolean; berserkerStrain: boolean; juggernautStrain: boolean; exploderStrain: boolean; legion: boolean; hellfireVenom: boolean; critChance: number; critDamageMult: number }} */
  getCoopZombieBoons(ownerId) {
    const p = this.room?.players?.get(ownerId);
    const z = p?.coopZombieBoons;
    return {
      packHunter: !!z?.packHunter,
      berserkerStrain: !!z?.berserkerStrain,
      juggernautStrain: !!z?.juggernautStrain,
      exploderStrain: !!z?.exploderStrain,
      legion: !!z?.legion,
      hellfireVenom: !!z?.hellfireVenom,
      critChance: typeof z?.critChance === 'number' ? z.critChance : 0,
      critDamageMult: typeof z?.critDamageMult === 'number' ? z.critDamageMult : 2,
    };
  }

  /**
   * Aggregate allied knight boons across all players in the room.
   * Boolean flags are OR'd (any player with the boon activates it).
   * Numeric stats use the max value found across all players with the boon active.
   * @returns {{ tempestInitiate: boolean; necrosInitiate: boolean; infernalInitiate: boolean; abyssalInitiate: boolean; agility: number; strength: number; stamina: number }}
   */
  getCoopAlliedKnightBoons() {
    const result = {
      tempestInitiate: false,
      necrosInitiate: false,
      infernalInitiate: false,
      abyssalInitiate: false,
      agility: 0,
      strength: 0,
      stamina: 0,
    };
    if (!this.room?.players) return result;
    for (const player of this.room.players.values()) {
      const b = player.coopAlliedKnightBoons;
      if (!b) continue;
      if (b.tempestInitiate) {
        result.tempestInitiate = true;
        result.agility = Math.max(result.agility, typeof b.agility === 'number' ? b.agility : 0);
      }
      if (b.necrosInitiate) {
        result.necrosInitiate = true;
        result.stamina = Math.max(result.stamina, typeof b.stamina === 'number' ? b.stamina : 0);
      }
      if (b.infernalInitiate) {
        result.infernalInitiate = true;
        result.strength = Math.max(result.strength, typeof b.strength === 'number' ? b.strength : 0);
      }
      if (b.abyssalInitiate) {
        result.abyssalInitiate = true;
      }
    }
    return result;
  }

  /** Flat Pack Hunter bonus: +15 damage per living owned zombie (including self). */
  getPackHunterBonusDamage(ownerId) {
    if (!ownerId) return 0;
    const boons = this.getCoopZombieBoons(ownerId);
    if (!boons.packHunter) return 0;
    return PACK_HUNTER_DAMAGE_PER_ZOMBIE * this.countLivingPlayerZombies(ownerId);
  }

  isFriendlyCombatUnit(enemy) {
    return !!enemy && (enemy.type === 'player-zombie' || enemy.alliedUnit === true);
  }

  damageAlliedUnitsAlongSegmentXZ(startX, startZ, endX, endZ, radiusSq, damage, hitMeta) {
    if (!this.room?.getEnemies) return 0;
    let hitCount = 0;
    for (const ally of this.room.getEnemies()) {
      if (!ally?.alliedUnit || ally.isDying || ally.health <= 0) continue;
      const ax = ally.position?.x ?? 0;
      const az = ally.position?.z ?? 0;
      if (distPointSegmentSqXZ(ax, az, startX, startZ, endX, endZ) > radiusSq) continue;
      const hit = this.room.damageEnemy(ally.id, damage, null, null, hitMeta);
      if (hit) hitCount += 1;
    }
    return hitCount;
  }

  spawnAlliedKnight(position) {
    if (!this.room || !position) return null;
    const existing = this.room.getEnemy?.('allied-knight');
    if (existing && !existing.isDying && existing.health > 0) return existing;

    const ally = {
      id: 'allied-knight',
      type: 'allied-knight',
      position: { x: position.x, y: position.y ?? 0, z: position.z },
      rotation: rotationYTowardEntry(position.x, position.z),
      health: ALLIED_KNIGHT_MAX_HP,
      maxHealth: ALLIED_KNIGHT_MAX_HP,
      isDying: false,
      damage: ALLIED_KNIGHT_DAMAGE,
      attackCooldown: ALLIED_KNIGHT_ATTACK_COOLDOWN_MS,
      moveSpeed: ALLIED_KNIGHT_MOVE_SPEED,
      staggerBuildup: 0,
      alliedUnit: true,
      combatInitiated: false,
      alliedTargetEnemyId: null,
      alliedOrbSlots: Array(ALLIED_KNIGHT_ORB_COUNT).fill(true),
      alliedOrbRecoverAt: Array(ALLIED_KNIGHT_ORB_COUNT).fill(0),
      alliedSmiteCooldownUntil: 0,
    };

    this.room.addEnemy(ally);
    this.alliedProtectionThreat.set(ally.id, new Map());
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-spawned', {
        enemy: ally,
        timestamp: Date.now(),
      });
    }
    return ally;
  }

  spawnAlliedHealer(position) {
    if (!this.room || !position) return null;
    const existing = this.room.getEnemy?.(ALLIED_HEALER_ID);
    if (existing && !existing.isDying && existing.health > 0) return existing;

    const ally = {
      id: ALLIED_HEALER_ID,
      type: 'allied-healer',
      position: { x: position.x, y: position.y ?? 0, z: position.z },
      rotation: rotationYTowardEntry(position.x, position.z),
      health: ALLIED_HEALER_MAX_HP,
      maxHealth: ALLIED_HEALER_MAX_HP,
      isDying: false,
      damage: 0,
      attackCooldown: 0,
      moveSpeed: ALLIED_HEALER_MOVE_SPEED,
      staggerBuildup: 0,
      alliedUnit: true,
      combatInitiated: false,
      alliedGreaterHealCooldownUntil: 0,
      allyHealerAttackCooldownUntil: 0,
    };

    this.room.addEnemy(ally);
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-spawned', {
        enemy: ally,
        timestamp: Date.now(),
      });
    }
    return ally;
  }

  markAlliedCombatInitiated(enemyId = null) {
    if (!this.room) return;
    if (this.alliedCombatStarted) {
      if (enemyId) this.recordAlliedProtectionThreat(enemyId, null, 25);
      return;
    }
    this.alliedCombatStarted = true;
    const enemies = this._tickEnemies || this.room.getEnemies();
    for (const e of enemies) {
      if (!e || e.type !== 'allied-knight' || e.isDying || e.health <= 0) continue;
      e.combatInitiated = true;
      if (enemyId) {
        this.recordAlliedProtectionThreat(enemyId, null, 25);
      }
    }
  }

  _scheduleEnemyTimeout(enemyId, fn, ms) {
    const handle = setTimeout(fn, ms);
    if (!this.enemyPendingTimeouts.has(enemyId)) {
      this.enemyPendingTimeouts.set(enemyId, new Set());
    }
    this.enemyPendingTimeouts.get(enemyId).add(handle);
    return handle;
  }

  _clearEnemyTimeouts(enemyId) {
    const pending = this.enemyPendingTimeouts.get(enemyId);
    if (!pending) return;
    for (const handle of pending) clearTimeout(handle);
    this.enemyPendingTimeouts.delete(enemyId);
  }

  isValidAlliedKnightTarget(enemy) {
    return !!enemy && !enemy.isDying && enemy.health > 0 && !this.isFriendlyCombatUnit(enemy);
  }

  getAlliedKnightLockedTarget(ally) {
    if (!ally?.alliedTargetEnemyId || !this.room) return null;
    const target = this.room.getEnemy?.(ally.alliedTargetEnemyId);
    if (this.isValidAlliedKnightTarget(target)) return target;
    ally.alliedTargetEnemyId = null;
    return null;
  }

  recordAlliedProtectionThreat(sourceEnemyId, _targetPlayerId = null, damage = 0) {
    if (!this.room || !sourceEnemyId) return;
    const source = this.room.getEnemy?.(sourceEnemyId);
    if (!this.isValidAlliedKnightTarget(source)) return;

    const now = Date.now();
    const numericDamage = Number(damage) || 0;
    const shouldOverrideTarget = numericDamage > ALLIED_KNIGHT_PROTECTIVE_OVERRIDE_DAMAGE;
    for (const ally of this.room.getEnemies()) {
      if (!ally || ally.type !== 'allied-knight' || ally.isDying || ally.health <= 0) continue;
      ally.combatInitiated = true;
      const lockedTarget = this.getAlliedKnightLockedTarget(ally);
      if (!lockedTarget || shouldOverrideTarget) {
        ally.alliedTargetEnemyId = sourceEnemyId;
      }
      let chart = this.alliedProtectionThreat.get(ally.id);
      if (!chart) {
        chart = new Map();
        this.alliedProtectionThreat.set(ally.id, chart);
      }
      const prev = chart.get(sourceEnemyId);
      const score = (prev?.score || 0) + Math.max(10, numericDamage);
      chart.set(sourceEnemyId, { score, lastUpdate: now });
    }
  }

  pruneAlliedProtectionThreat(allyId) {
    const chart = this.alliedProtectionThreat.get(allyId);
    if (!chart) return;
    const now = Date.now();
    chart.forEach((entry, enemyId) => {
      if (now - entry.lastUpdate > ALLIED_KNIGHT_PROTECTIVE_THREAT_TTL_MS) {
        chart.delete(enemyId);
      }
    });
  }

  findAlliedKnightTarget(ally) {
    if (!this.room) return null;
    const lockedTarget = this.getAlliedKnightLockedTarget(ally);
    if (lockedTarget) return lockedTarget;

    this.pruneAlliedProtectionThreat(ally.id);
    const chart = this.alliedProtectionThreat.get(ally.id);
    const now = Date.now();
    let best = null;
    let bestScore = 0;
    if (chart) {
      chart.forEach((entry, enemyId) => {
        const enemy = this.room.getEnemy?.(enemyId);
        if (!enemy || enemy.isDying || enemy.health <= 0 || this.isFriendlyCombatUnit(enemy)) {
          chart.delete(enemyId);
          return;
        }
        const ageSec = Math.max(0, (now - entry.lastUpdate) / 1000);
        const score = entry.score * Math.pow(ALLIED_KNIGHT_PROTECTIVE_THREAT_DECAY_PER_SEC, ageSec);
        if (score > bestScore) {
          bestScore = score;
          best = enemy;
        }
      });
    }
    if (best) {
      ally.alliedTargetEnemyId = best.id;
      return best;
    }
    if (!ally.combatInitiated) return null;
    const nearest = this.findNearestHostileForZombie(ally);
    if (nearest) {
      ally.alliedTargetEnemyId = nearest.id;
    }
    return nearest;
  }

  ensureAlliedKnightOrbState(ally) {
    if (!Array.isArray(ally.alliedOrbSlots) || ally.alliedOrbSlots.length !== ALLIED_KNIGHT_ORB_COUNT) {
      ally.alliedOrbSlots = Array(ALLIED_KNIGHT_ORB_COUNT).fill(true);
    }
    if (!Array.isArray(ally.alliedOrbRecoverAt) || ally.alliedOrbRecoverAt.length !== ALLIED_KNIGHT_ORB_COUNT) {
      ally.alliedOrbRecoverAt = Array(ALLIED_KNIGHT_ORB_COUNT).fill(0);
    }
    if (typeof ally.alliedSmiteCooldownUntil !== 'number') {
      ally.alliedSmiteCooldownUntil = 0;
    }
  }

  emitAlliedKnightOrbsUpdated(ally) {
    if (!this.io || !ally) return;
    this.io.to(this.roomId).emit('allied-knight-orbs-updated', {
      knightId: ally.id,
      slots: [...ally.alliedOrbSlots],
      recoverAt: [...ally.alliedOrbRecoverAt],
      timestamp: Date.now(),
    });
  }

  updateAlliedKnightOrbRecharge(ally, now = Date.now()) {
    this.ensureAlliedKnightOrbState(ally);
    let changed = false;

    for (let i = 0; i < ALLIED_KNIGHT_ORB_COUNT; i++) {
      if (!ally.alliedOrbSlots[i] && ally.alliedOrbRecoverAt[i] > 0 && now >= ally.alliedOrbRecoverAt[i]) {
        ally.alliedOrbSlots[i] = true;
        ally.alliedOrbRecoverAt[i] = 0;
        changed = true;
      }
    }

    if (changed) this.emitAlliedKnightOrbsUpdated(ally);
  }

  countAlliedKnightReadyOrbs(ally) {
    this.ensureAlliedKnightOrbState(ally);
    return ally.alliedOrbSlots.reduce((count, ready) => count + (ready ? 1 : 0), 0);
  }

  consumeAlliedKnightOrbs(ally, now) {
    this.ensureAlliedKnightOrbState(ally);
    let consumed = 0;
    for (let i = 0; i < ALLIED_KNIGHT_ORB_COUNT && consumed < ALLIED_KNIGHT_SMITE_ORB_COST; i++) {
      if (!ally.alliedOrbSlots[i]) continue;
      ally.alliedOrbSlots[i] = false;
      ally.alliedOrbRecoverAt[i] = now + ALLIED_KNIGHT_ORB_RECHARGE_MS;
      consumed++;
    }
    if (consumed > 0) this.emitAlliedKnightOrbsUpdated(ally);
    return consumed === ALLIED_KNIGHT_SMITE_ORB_COST;
  }

  tryAlliedKnightSmite(ally, targetEnemy, distance, now = Date.now()) {
    if (!this.room || !this.isValidAlliedKnightTarget(targetEnemy)) return false;
    this.updateAlliedKnightOrbRecharge(ally, now);
    if (now < (ally.alliedSmiteCooldownUntil || 0)) return false;
    if (distance > ALLIED_KNIGHT_SMITE_CAST_RANGE) return false;
    if (this.countAlliedKnightReadyOrbs(ally) < ALLIED_KNIGHT_SMITE_ORB_COST) return false;
    if (!this.consumeAlliedKnightOrbs(ally, now)) return false;

    const knightBoons = this.getCoopAlliedKnightBoons();
    const smiteCooldown = knightBoons.tempestInitiate ? TEMPEST_INITIATE_SMITE_COOLDOWN_MS : ALLIED_KNIGHT_SMITE_COOLDOWN_MS;
    const smiteDamage = knightBoons.tempestInitiate
      ? ALLIED_KNIGHT_SMITE_DAMAGE + TEMPEST_INITIATE_SMITE_BASE_DAMAGE_BONUS + knightBoons.agility * TEMPEST_INITIATE_SMITE_DAMAGE_PER_AGILITY
      : ALLIED_KNIGHT_SMITE_DAMAGE;

    ally.alliedSmiteCooldownUntil = now + smiteCooldown;
    this.meleeLockUntil.set(ally.id, now + ALLIED_KNIGHT_SMITE_LOCK_MS);

    const dx = targetEnemy.position.x - ally.position.x;
    const dz = targetEnemy.position.z - ally.position.z;
    if (dx !== 0 || dz !== 0) {
      ally.rotation = Math.atan2(dx, dz);
    }

    if (this.io) {
      this.io.to(this.roomId).emit('knight-smite-telegraph', {
        knightId: ally.id,
        targetEnemyId: targetEnemy.id,
        position: ally.position,
        timestamp: now,
      });
      this._queueMove(ally.id, ally.position, ally.rotation);
    }

    const targetId = targetEnemy.id;
    setTimeout(() => {
      const liveAlly = this.room?.getEnemy(ally.id);
      if (!liveAlly || liveAlly.isDying || liveAlly.health <= 0 || !this.room?.getGameStarted()) return;
      if (this.room?.isEnemyAffectedBy(liveAlly.id, 'stun')) return;

      const liveTarget = this.room?.getEnemy(targetId);
      if (!this.isValidAlliedKnightTarget(liveTarget)) return;

      const strikePosition = {
        x: liveTarget.position.x,
        y: liveTarget.position.y ?? 0,
        z: liveTarget.position.z,
      };

      for (const enemy of this.room.getEnemies()) {
        if (!this.isValidAlliedKnightTarget(enemy)) continue;
        const ex = enemy.position.x - strikePosition.x;
        const ez = enemy.position.z - strikePosition.z;
        if (ex * ex + ez * ez > ALLIED_KNIGHT_SMITE_RADIUS * ALLIED_KNIGHT_SMITE_RADIUS) continue;
        this.room.damageEnemy(enemy.id, smiteDamage, null, null, {
          sourceAlliedUnitId: liveAlly.id,
          damageType: 'allied_knight_smite',
        });
      }

      if (this.io) {
        this.io.to(this.roomId).emit('allied-knight-smite-impact', {
          knightId: liveAlly.id,
          targetEnemyId: liveTarget.id,
          damage: smiteDamage,
          radius: ALLIED_KNIGHT_SMITE_RADIUS,
          position: strikePosition,
          timestamp: Date.now(),
        });
      }
    }, ALLIED_KNIGHT_SMITE_IMPACT_DELAY_MS);

    return true;
  }

  updateAlliedKnightAI(ally, players) {
    if (!this.room || ally.isDying || ally.health <= 0) return;
    const now = Date.now();
    this.updateAlliedKnightOrbRecharge(ally, now);
    const lockUntil = this.meleeLockUntil.get(ally.id) || 0;
    if (now < lockUntil) return;

    // Apply one-time allied knight boon stat upgrades when boons become active.
    const knightBoons = this.getCoopAlliedKnightBoons();
    if (knightBoons.necrosInitiate && !ally.necrosBoonApplied) {
      ally.necrosBoonApplied = true;
      const newMax = NECROS_INITIATE_KNIGHT_BASE_HP + knightBoons.stamina * NECROS_INITIATE_KNIGHT_HP_PER_STAMINA;
      const hpIncrease = Math.max(0, newMax - (ally.maxHealth || ALLIED_KNIGHT_MAX_HP));
      ally.maxHealth = newMax;
      ally.health = Math.min(newMax, (ally.health || 0) + hpIncrease);
    }
    if (knightBoons.abyssalInitiate && !ally.abyssalBoonApplied) {
      ally.abyssalBoonApplied = true;
      ally.moveSpeed = (ally.moveSpeed ?? ALLIED_KNIGHT_MOVE_SPEED) * 1.5;
      ally.attackCooldown = Math.round((ally.attackCooldown ?? ALLIED_KNIGHT_ATTACK_COOLDOWN_MS) / 1.5);
      if (this.io) {
        this.io.to(this.roomId).emit('allied-knight-boons-updated', {
          enemyId: ally.id,
          abyssalInitiate: true,
          timestamp: Date.now(),
        });
      }
    }

    const target = this.findAlliedKnightTarget(ally);
    const closestPlayer = this.findClosestPlayer(ally, players);
    if (!target) {
      if (closestPlayer) {
        const d = this.calculateDistance(ally.position, closestPlayer.position);
        if (d > ALLIED_KNIGHT_FOLLOW_DISTANCE) {
          this.moveEnemyTowardsTarget(ally, closestPlayer);
        }
      }
      return;
    }

    const distance = this.calculateDistance(ally.position, target.position);
    if (this.tryAlliedKnightSmite(ally, target, distance, now)) {
      return;
    }

    const meleePressDistance = ALLIED_KNIGHT_ATTACK_RANGE - MELEE_CLOSE_INSET;
    if (distance <= ALLIED_KNIGHT_ATTACK_RANGE) {
      if (!this.ghoulAttackCooldown.has(ally.id)) {
        this.ghoulAttackCooldown.set(ally.id, 0);
      }
      const lastAttackTime = this.ghoulAttackCooldown.get(ally.id);
      if (distance > meleePressDistance) {
        this.moveEnemyTowardsTarget(ally, { id: target.id, position: target.position }, { meleeSurroundAttackRange: ALLIED_KNIGHT_ATTACK_RANGE });
      } else if (now - lastAttackTime >= (ally.attackCooldown ?? ALLIED_KNIGHT_ATTACK_COOLDOWN_MS)) {
        this.ghoulAttackCooldown.set(ally.id, now);
        const SWING_LOCK_MS = 1200;
        this.meleeLockUntil.set(ally.id, now + SWING_LOCK_MS);
        const attackFocus = { ...target.position };
        this.scheduleKnightMeleeWindupStep(ally, attackFocus);
        this.telegraphAlliedKnightAttack(ally, target);
        const targetId = target.id;
        setTimeout(() => {
          if (ally.isDying || !this.room?.getGameStarted()) return;
          if (this.room?.isEnemyAffectedBy(ally.id, 'stun')) return;
          const attacker = this.room?.getEnemy(ally.id) || ally;
          const liveTarget = this.room?.getEnemy(targetId);
          if (!liveTarget || liveTarget.isDying || liveTarget.health <= 0) return;
          if (this.isFriendlyCombatUnit(liveTarget)) return;
          const currentDist = this.calculateDistance(attacker.position, liveTarget.position);
          if (currentDist <= ALLIED_KNIGHT_ATTACK_RANGE + 0.5) {
            const meleeBoons = this.getCoopAlliedKnightBoons();
            const meleeDamage = meleeBoons.infernalInitiate
              ? INFERNAL_INITIATE_KNIGHT_BASE_DAMAGE + meleeBoons.strength * INFERNAL_INITIATE_KNIGHT_DAMAGE_PER_STRENGTH
              : (attacker.damage || ALLIED_KNIGHT_DAMAGE);
            this.room.damageEnemy(liveTarget.id, meleeDamage, null, null, {
              sourceAlliedUnitId: attacker.id,
              damageType: 'allied_knight_melee',
            });
          }
        }, 700);
      }
    } else {
      this.moveEnemyTowardsTarget(ally, { id: target.id, position: target.position }, { meleeSurroundAttackRange: ALLIED_KNIGHT_ATTACK_RANGE });
    }
  }

  telegraphAlliedKnightAttack(ally, targetEnemy) {
    if (this.io) {
      this.io.to(this.roomId).emit('allied-knight-attack-telegraph', {
        knightId: ally.id,
        targetEnemyId: targetEnemy.id,
        position: ally.position,
        timestamp: Date.now(),
      });
    }
  }

  getAlliedHealerMissingHealth(entity) {
    if (!entity || entity.health <= 0 || !entity.maxHealth) return 0;
    return Math.max(0, entity.maxHealth - entity.health);
  }

  canAlliedHealerHeal(entity) {
    if (!entity || entity.health <= 0 || !entity.maxHealth) return false;
    if (entity.health >= entity.maxHealth) return false;
    return this.getAlliedHealerMissingHealth(entity) >= ALLIED_HEALER_MIN_MISSING_HEALTH;
  }

  getAlliedHealerCandidates(healer) {
    const candidates = [];

    const knight = this.room?.getEnemy?.('allied-knight');
    if (knight && !knight.isDying && this.canAlliedHealerHeal(knight)) {
      candidates.push({
        kind: 'ally',
        id: knight.id,
        entity: knight,
        position: knight.position,
        healthPercent: knight.health / knight.maxHealth,
      });
    }

    if (healer && !healer.isDying && this.canAlliedHealerHeal(healer)) {
      candidates.push({
        kind: 'ally',
        id: healer.id,
        entity: healer,
        position: healer.position,
        healthPercent: healer.health / healer.maxHealth,
      });
    }

    return candidates;
  }

  findAlliedHealerTarget(healer, players) {
    if (healer && !healer.isDying && this.canAlliedHealerHeal(healer)) {
      const healerHealthPercent = healer.health / healer.maxHealth;
      if (healerHealthPercent < 0.5) {
        return {
          kind: 'ally',
          id: healer.id,
          entity: healer,
          position: healer.position,
          healthPercent: healerHealthPercent,
        };
      }
    }

    const candidates = this.getAlliedHealerCandidates(healer);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      if (a.healthPercent !== b.healthPercent) return a.healthPercent - b.healthPercent;
      return this.calculateDistance(healer.position, a.position) - this.calculateDistance(healer.position, b.position);
    });
    return candidates[0];
  }

  getAlliedHealerFollowTarget(healer, players) {
    const healTarget = this.findAlliedHealerTarget(healer, players);
    if (healTarget) return { id: healTarget.id, position: healTarget.position };
    const closestPlayer = this.findClosestPlayer(healer, players);
    if (closestPlayer) return closestPlayer;
    const knight = this.room?.getEnemy?.('allied-knight');
    if (knight && !knight.isDying && knight.health > 0) return { id: knight.id, position: knight.position };
    return null;
  }

  getLiveAlliedHealerHealTarget(targetKind, targetId) {
    if (targetKind === 'player') {
      // Allied healer (Ally 2) only heals itself and Ally 1; never players.
      return null;
    }

    const ally = this.room?.getEnemy?.(targetId);
    if (!ally || !ally.alliedUnit || ally.isDying || !this.canAlliedHealerHeal(ally)) return null;
    return { entity: ally, position: ally.position };
  }

  applyAlliedHealerGreaterHealTarget(targetKind, targetId, healAmount, sourceHealerId) {
    const live = this.getLiveAlliedHealerHealTarget(targetKind, targetId);
    if (!live) return 0;

    const target = live.entity;
    const previousHealth = target.health;
    target.health = Math.min(target.maxHealth, target.health + healAmount);
    const actualHeal = target.health - previousHealth;
    if (actualHeal <= 0 || !this.io) return actualHeal;

    const position = {
      x: live.position.x,
      y: live.position.y ?? 0,
      z: live.position.z,
    };

    if (targetKind === 'player') {
      this.io.to(this.roomId).emit('player-health-updated', {
        playerId: targetId,
        health: target.health,
        maxHealth: target.maxHealth,
      });
      this.io.to(this.roomId).emit('player-healing', {
        sourcePlayerId: sourceHealerId,
        targetPlayerId: targetId,
        healingAmount: actualHeal,
        healingType: 'allied_healer_greater_heal',
        position,
        timestamp: Date.now(),
      });
    } else {
      this.io.to(this.roomId).emit('enemy-healed', {
        enemyId: targetId,
        healAmount: actualHeal,
        newHealth: target.health,
        maxHealth: target.maxHealth,
        timestamp: Date.now(),
      });
    }

    return actualHeal;
  }

  tryAlliedHealerGreaterHeal(healer, target, distance, now = Date.now()) {
    if (!this.room || !target) return false;
    if (now < (healer.alliedGreaterHealCooldownUntil || 0)) return false;
    if (distance > ALLIED_HEALER_GREATER_HEAL_RANGE) return false;
    const liveTarget = this.getLiveAlliedHealerHealTarget(target.kind, target.id);
    if (!liveTarget) return false;

    healer.alliedGreaterHealCooldownUntil = now + ALLIED_HEALER_GREATER_HEAL_COOLDOWN_MS;
    this.meleeLockUntil.set(healer.id, now + ALLIED_HEALER_GREATER_HEAL_IMPACT_DELAY_MS);

    const dx = liveTarget.position.x - healer.position.x;
    const dz = liveTarget.position.z - healer.position.z;
    if (dx !== 0 || dz !== 0) {
      healer.rotation = Math.atan2(dx, dz);
    }

    const targetPosition = {
      x: liveTarget.position.x,
      y: liveTarget.position.y ?? 0,
      z: liveTarget.position.z,
    };
    const impactAt = now + ALLIED_HEALER_GREATER_HEAL_IMPACT_DELAY_MS;

    if (this.io) {
      this.io.to(this.roomId).emit('allied-healer-greater-heal', {
        healerId: healer.id,
        targetKind: target.kind,
        targetId: target.id,
        healerPosition: { ...healer.position },
        targetPosition,
        healAmount: ALLIED_HEALER_GREATER_HEAL_AMOUNT,
        castStartedAt: now,
        castMs: ALLIED_HEALER_GREATER_HEAL_CAST_MS,
        healcastMs: ALLIED_HEALER_GREATER_HEAL_HEALCAST_MS,
        impactAt,
        timestamp: now,
      });
      this._queueMove(healer.id, healer.position, healer.rotation);
    }

    const targetKind = target.kind;
    const targetId = target.id;
    const healerId = healer.id;
    setTimeout(() => {
      const liveHealer = this.room?.getEnemy?.(healerId);
      if (!liveHealer || liveHealer.isDying || liveHealer.health <= 0 || !this.room?.getGameStarted()) return;
      if (this.room?.isEnemyAffectedBy(liveHealer.id, 'stun')) return;
      const healed = this.applyAlliedHealerGreaterHealTarget(
        targetKind,
        targetId,
        ALLIED_HEALER_GREATER_HEAL_AMOUNT,
        liveHealer.id,
      );
      if (healed > 0) {
        console.log(`✨ Allied healer ${liveHealer.id} healed ${targetKind}:${targetId} for ${healed} HP`);
      }
    }, ALLIED_HEALER_GREATER_HEAL_IMPACT_DELAY_MS);

    return true;
  }

  findAlliedHealerAttackTarget(healer) {
    if (!this.room) return null;
    const enemies = this.room.getEnemies?.();
    if (!enemies) return null;

    let bestTarget = null;
    let bestDist = Infinity;

    const each = (enemy) => {
      if (!enemy || enemy.alliedUnit || enemy.isDying || enemy.health <= 0) return;
      const dist = this.calculateDistance(healer.position, enemy.position);
      if (dist <= ALLIED_HEALER_ATTACK_RANGE && dist < bestDist) {
        bestDist = dist;
        bestTarget = enemy;
      }
    };

    if (typeof enemies.forEach === 'function') {
      enemies.forEach(each);
    } else if (typeof enemies === 'object') {
      Object.values(enemies).forEach(each);
    }

    return bestTarget;
  }

  tryAlliedHealerAttack(healer, targetEnemy, distance, now = Date.now()) {
    if (!this.room || !targetEnemy) return false;
    if (now < (healer.allyHealerAttackCooldownUntil || 0)) return false;
    if (distance > ALLIED_HEALER_ATTACK_RANGE) return false;
    if (targetEnemy.isDying || targetEnemy.health <= 0) return false;

    const totalLockMs = ALLIED_HEALER_ATTACK_CAST_MS + ALLIED_HEALER_ATTACK_TRAVEL_MS;
    healer.allyHealerAttackCooldownUntil = now + ALLIED_HEALER_ATTACK_COOLDOWN_MS;
    this.meleeLockUntil.set(healer.id, now + totalLockMs);

    const dx = targetEnemy.position.x - healer.position.x;
    const dz = targetEnemy.position.z - healer.position.z;
    if (dx !== 0 || dz !== 0) {
      healer.rotation = Math.atan2(dx, dz);
    }

    const impactPosition = {
      x: targetEnemy.position.x,
      y: targetEnemy.position.y ?? 0,
      z: targetEnemy.position.z,
    };

    if (this.io) {
      this.io.to(this.roomId).emit('allied-healer-attack', {
        healerId: healer.id,
        healerPosition: { ...healer.position },
        impactPosition,
        castMs: ALLIED_HEALER_ATTACK_CAST_MS,
        travelMs: ALLIED_HEALER_ATTACK_TRAVEL_MS,
        damage: ALLIED_HEALER_ATTACK_DAMAGE,
        timestamp: now,
      });
      this._queueMove(healer.id, healer.position, healer.rotation);
    }

    const targetId = targetEnemy.id;
    const healerId = healer.id;
    const impactDelay = ALLIED_HEALER_ATTACK_CAST_MS + ALLIED_HEALER_ATTACK_TRAVEL_MS;

    setTimeout(() => {
      const liveHealer = this.room?.getEnemy?.(healerId);
      if (!liveHealer || liveHealer.isDying || liveHealer.health <= 0 || !this.room?.getGameStarted()) return;
      if (this.room?.isEnemyAffectedBy(liveHealer.id, 'stun')) return;

      const enemies = this.room.getEnemies?.();
      if (!enemies) return;

      const hitEnemies = [];
      const each = (enemy) => {
        if (!enemy || enemy.alliedUnit || enemy.isDying || enemy.health <= 0) return;
        const dist = this.calculateDistance(impactPosition, enemy.position);
        if (dist <= ALLIED_HEALER_ATTACK_AOE_RADIUS) {
          hitEnemies.push(enemy);
        }
      };
      if (typeof enemies.forEach === 'function') {
        enemies.forEach(each);
      } else if (typeof enemies === 'object') {
        Object.values(enemies).forEach(each);
      }

      hitEnemies.forEach((enemy) => {
        this.room.damageEnemy(enemy.id, ALLIED_HEALER_ATTACK_DAMAGE, healerId, {
          damageType: 'allied_healer',
          timestamp: Date.now(),
        });
      });
    }, impactDelay);

    return true;
  }

  updateAlliedHealerAI(healer, players) {
    if (!this.room || healer.isDying || healer.health <= 0) return;
    const now = Date.now();
    const lockUntil = this.meleeLockUntil.get(healer.id) || 0;
    if (now < lockUntil) return;

    const healTarget = this.findAlliedHealerTarget(healer, players);
    if (healTarget) {
      const distance = this.calculateDistance(healer.position, healTarget.position);
      if (this.tryAlliedHealerGreaterHeal(healer, healTarget, distance, now)) {
        return;
      }
      if (distance > ALLIED_HEALER_GREATER_HEAL_RANGE) {
        this.moveEnemyTowardsTarget(healer, { id: healTarget.id, position: healTarget.position });
        return;
      }
    }

    const attackTarget = this.findAlliedHealerAttackTarget(healer);
    if (attackTarget) {
      const atkDist = this.calculateDistance(healer.position, attackTarget.position);
      if (this.tryAlliedHealerAttack(healer, attackTarget, atkDist, now)) {
        return;
      }
    }

    const followTarget = this.getAlliedHealerFollowTarget(healer, players);
    if (!followTarget) return;
    const followDistance = this.calculateDistance(healer.position, followTarget.position);
    if (followDistance > ALLIED_HEALER_FOLLOW_DISTANCE) {
      this.moveEnemyTowardsTarget(healer, followTarget);
    }
  }

  trySpawnInfestedZombie(ownerId, position) {
    if (!this.room || !ownerId) return;
    if (this.countLivingPlayerZombies(ownerId) >= 3) return;

    const boons = this.getCoopZombieBoons(ownerId);
    let maxHp = PLAYER_ZOMBIE_STANDARD_HP;
    let damage = PLAYER_ZOMBIE_STANDARD_DAMAGE;
    /** @type {'standard' | 'juggernaut'} */
    let zombieVariant = 'standard';

    if (
      boons.juggernautStrain &&
      Math.random() < JUGGERNAUT_STRAIN_ROLL_CHANCE
    ) {
      zombieVariant = 'juggernaut';
      maxHp = PLAYER_ZOMBIE_JUGGERNAUT_HP;
      damage = PLAYER_ZOMBIE_JUGGERNAUT_DAMAGE;
    }

    if (boons.berserkerStrain) {
      maxHp *= BERSERKER_STRAIN_HP_MULT;
    }

    const zombieId = `player-zombie-${ownerId}-${Date.now()}`;
    const now = Date.now();
    const summonLockMs = INFESTED_ZOMBIE_SUMMON_LOCK_MS;
    const zombie = {
      id: zombieId,
      type: 'player-zombie',
      ownerPlayerId: ownerId,
      position: { x: position.x, y: position.y, z: position.z },
      rotation: rotationYTowardEntry(position.x, position.z),
      health: maxHp,
      maxHealth: maxHp,
      isDying: false,
      damage,
      attackCooldown: 1000,
      moveSpeed: 0,
      expireAt: now + 30000,
      staggerBuildup: 0,
      summonUnlockAt: now + summonLockMs,
      zombieVariant,
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
        let moveSpeed = PLAYER_ZOMBIE_UNLOCK_MOVE_SPEED;
        const nowBoons = this.getCoopZombieBoons(ownerId);
        if (nowBoons.berserkerStrain) moveSpeed *= BERSERKER_STRAIN_MOVE_MULT;
        spawned.moveSpeed = moveSpeed;
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
      if (this.isFriendlyCombatUnit(e)) continue;
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

  triggerExploderStrainDetonation(zombie) {
    if (!this.room?.getGameStarted()) return;
    const live = this.room.getEnemy(zombie.id) || zombie;
    if (!live || live.isDying || live.exploderStrainDetonated) return;

    const ownerId = live.ownerPlayerId;
    if (!ownerId) return;
    const boons = this.getCoopZombieBoons(ownerId);
    if (!boons.exploderStrain) return;

    live.exploderStrainDetonated = true;

    const center = live.position;
    let explosionDamage = Math.round(live.maxHealth ?? PLAYER_ZOMBIE_STANDARD_HP);

    // LEGION (duo: red + green) — Exploder Strain detonation can crit using the owner's exact crit chance/damage.
    let isCritical = false;
    if (boons.legion && Math.random() < boons.critChance) {
      isCritical = true;
      explosionDamage = Math.round(explosionDamage * boons.critDamageMult);
    }

    if (this.io) {
      this.io.to(this.roomId).emit('player-zombie-explosion', {
        zombieId: live.id,
        position: { x: center.x, y: center.y, z: center.z },
        radius: EXPLODER_STRAIN_RADIUS,
        timestamp: Date.now(),
      });
    }

    for (const e of this.room.getEnemies()) {
      if (!e || e.id === live.id || e.isDying) continue;
      if (this.isFriendlyCombatUnit(e)) continue;
      if (e.type === 'training-dummy') continue;
      if (e.health <= 0) continue;
      if (this.calculateDistance(center, e.position) > EXPLODER_STRAIN_RADIUS) continue;
      this.room.damageEnemy(e.id, explosionDamage, ownerId, null, {
        damageType: 'zombie_explosion',
        exploderStrainZombie: true,
        isCritical,
      });
    }

    if (live.health > 0) {
      this.room.damageEnemy(live.id, live.health, null, null, { damageType: 'zombie_explosion_self' });
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
            const attacker = this.room?.getEnemy(zombie.id) || zombie;
            const liveHostile = this.room?.getEnemy(hostile.id);
            if (!liveHostile || liveHostile.isDying || liveHostile.health <= 0) return;
            const currentDist = this.calculateDistance(attacker.position, liveHostile.position);
            if (currentDist <= attackRange + 0.5) {
              let dmg = attacker.damage || PLAYER_ZOMBIE_STANDARD_DAMAGE;
              dmg += this.getPackHunterBonusDamage(attacker.ownerPlayerId);
              const boons = this.getCoopZombieBoons(attacker.ownerPlayerId);
              // LEGION (duo: red + green) — zombie melee can crit using the owner's exact crit chance/damage.
              let isCritical = false;
              if (boons.legion && Math.random() < boons.critChance) {
                isCritical = true;
                dmg *= boons.critDamageMult;
              }
              this.room.damageEnemy(liveHostile.id, Math.round(dmg), attacker.ownerPlayerId, null, {
                sourceZombieId: attacker.id,
                isCritical,
              });
              if (boons.hellfireVenom) {
                this.room._addConcentratedVenomStacks(liveHostile.id, 1, attacker.ownerPlayerId);
              }
              if (boons.exploderStrain && !attacker.exploderStrainDetonated) {
                this.triggerExploderStrainDetonation(attacker);
              }
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

  // ─── Greed — bonus wandering/fleeing enemy (10% chance per countable combat room wave) ────

  /** Steers `greed` directly away from the nearest living player, clamped to arena bounds via moveEnemyTowardsTarget. */
  fleeFromNearestPlayer(greed, players) {
    const nearest = this.findClosestPlayer(greed, players);
    if (!nearest) return;
    const dx = greed.position.x - nearest.position.x;
    const dz = greed.position.z - nearest.position.z;
    const mag = Math.hypot(dx, dz) || 1;
    const fleeTarget = {
      x: greed.position.x + (dx / mag) * GREED_FLEE_DISTANCE,
      z: greed.position.z + (dz / mag) * GREED_FLEE_DISTANCE,
    };
    this.moveEnemyTowardsTarget(greed, { id: 'greed-flee', position: fleeTarget });
  }

  /** Pick a fresh wander destination and shuffle toward it until reached or the repick timer elapses. */
  _wanderGreed(greed) {
    const now = Date.now();
    const target = greed.wanderTarget;
    const reachedTarget = target
      ? Math.hypot(target.x - greed.position.x, target.z - greed.position.z) <= GREED_WANDER_REACH
      : true;
    if (!target || reachedTarget || now >= (greed.nextWanderPickAt || 0)) {
      const isMixedRoom = this.room?.coopWaveSpawnPlan?.isMixed === true;
      const next = this.room?._generateScatteredPositions?.(1, isMixedRoom)?.[0];
      if (next) greed.wanderTarget = next;
      greed.nextWanderPickAt = now + GREED_WANDER_REPICK_MS;
    }
    if (greed.wanderTarget) {
      this.moveEnemyTowardsTarget(greed, { id: 'greed-wander', position: greed.wanderTarget });
    }
  }

  updateGreedAI(greed, players) {
    const now = Date.now();

    if (greed.expireAt && now >= greed.expireAt && !greed.isDying) {
      greed.isDying = true;
      const gid = greed.id;
      setTimeout(() => {
        if (!this.room?.getGameStarted()) return;
        if (this.room?.enemies.has(gid)) {
          this.room.enemies.delete(gid);
          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', { enemyId: gid, timestamp: Date.now() });
          }
        }
        this.removeEnemyAggro(gid);
      }, 400);
      return;
    }
    if (greed.isDying) return;

    let aggroData = this.enemyAggro.get(greed.id);
    if (!aggroData) {
      aggroData = {
        targetPlayerId: null,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: now,
        aggro: 0,
        isAggroed: false,
        threatFromDamage: false,
        directPlayerDamageAggroed: false,
      };
      this.enemyAggro.set(greed.id, aggroData);
    }

    // Proximity aggro — mirrors Titan's line-of-sight radius check. Damage-based aggro
    // (updateAggro / threatFromDamage) is already applied generically by damageEnemy().
    if (!aggroData.isAggroed) {
      for (const p of players) {
        if (!p || p.health <= 0) continue;
        const dist = this.calculateDistance(greed.position, p.position);
        if (dist <= GREED_AGGRO_RADIUS && this.hasLineOfSight(greed.position, p.position)) {
          aggroData.isAggroed = true;
          aggroData.targetPlayerId = p.id;
          break;
        }
      }
    }

    if (!aggroData.isAggroed) {
      this._wanderGreed(greed);
      return;
    }

    const lockUntil = this.meleeLockUntil.get(greed.id) || 0;
    if (now < lockUntil) return;

    const soulType = greed.soulType || 'green';

    if (soulType === 'green') {
      this.fleeFromNearestPlayer(greed, players);
      if (now >= (greed.nextHealAt || 0)) {
        this.greedCastSelfHeal(greed);
      }
      return;
    }

    if (soulType === 'blue') {
      this.fleeFromNearestPlayer(greed, players);
      if (now >= (greed.nextEmberAt || 0)) {
        this.greedSpawnEmberPatch(greed);
      }
      return;
    }

    const targetPlayer = this.findClosestPlayer(greed, players);
    if (!targetPlayer) {
      this._wanderGreed(greed);
      return;
    }
    const distance = this.calculateDistance(greed.position, targetPlayer.position);

    if (soulType === 'red') {
      const cooldownReady = now >= (greed.redAbilityCooldownUntil || 0);
      if (cooldownReady && distance <= GREED_RED_RANGE) {
        this.greedCastFireOrb(greed, targetPlayer);
      } else if (cooldownReady) {
        this.moveEnemyTowardsTarget(greed, targetPlayer);
      } else {
        this.fleeFromNearestPlayer(greed, players);
      }
      return;
    }

    // purple
    const cooldownReady = now >= (greed.purpleAbilityCooldownUntil || 0);
    if (cooldownReady && distance <= GREED_PURPLE_RANGE) {
      this.greedCastFrostRay(greed, targetPlayer);
    } else if (cooldownReady) {
      this.moveEnemyTowardsTarget(greed, targetPlayer);
    } else {
      this.fleeFromNearestPlayer(greed, players);
    }
  }

  /** Green — periodic self-heal; reuses the allied-healer greater-heal event/beam verbatim. */
  greedCastSelfHeal(greed) {
    const now = Date.now();
    greed.nextHealAt = now + GREED_GREEN_HEAL_INTERVAL_MS;
    this.meleeLockUntil.set(greed.id, now + GREED_GREEN_CAST_LOCK_MS);
    if (this.io) {
      this.io.to(this.roomId).emit('greed-ability-telegraph', {
        greedId: greed.id, ability: 'cast', durationMs: GREED_GREEN_CAST_LOCK_MS, timestamp: now,
      });
      this.io.to(this.roomId).emit('allied-healer-greater-heal', {
        healerId: greed.id, targetKind: 'ally', targetId: greed.id,
        healerPosition: { ...greed.position }, targetPosition: { ...greed.position },
        healAmount: GREED_GREEN_HEAL_AMOUNT, castMs: GREED_GREEN_CAST_LOCK_MS, healcastMs: 0,
        impactAt: now + GREED_GREEN_CAST_LOCK_MS, timestamp: now,
      });
    }
    setTimeout(() => {
      const live = this.room?.getEnemy(greed.id);
      if (!live || live.isDying) return;
      const before = live.health;
      live.health = Math.min(live.maxHealth, live.health + GREED_GREEN_HEAL_AMOUNT);
      const healed = live.health - before;
      if (healed > 0 && this.io) {
        this.io.to(this.roomId).emit('enemy-healed', {
          enemyId: greed.id, healAmount: healed, newHealth: live.health, maxHealth: live.maxHealth, timestamp: Date.now(),
        });
      }
    }, GREED_GREEN_CAST_LOCK_MS);
  }

  /**
   * Purple — frost ray, reusing Purple Knight's exact `knightCastFrost` mechanic verbatim
   * (it only touches knight.id/position/rotation and generic room getters), which also makes
   * the resulting freeze count for Green Titans' `_findStunnedOrFrozenTitanTarget` for free.
   */
  greedCastFrostRay(greed, targetPlayer) {
    const now = Date.now();
    greed.purpleAbilityCooldownUntil = now + GREED_PURPLE_COOLDOWN_MS;
    this.meleeLockUntil.set(greed.id, now + 2000); // matches knight cast lock
    if (this.io) {
      this.io.to(this.roomId).emit('greed-ability-telegraph', {
        greedId: greed.id, ability: 'healcast', durationMs: 2000, timestamp: now,
      });
    }
    this.knightCastFrost(greed, targetPlayer);
  }

  /** Red — non-homing fire comet: server-side straight-line sim with authoritative hit-test. */
  greedCastFireOrb(greed, targetPlayer) {
    const now = Date.now();
    greed.redAbilityCooldownUntil = now + GREED_RED_COOLDOWN_MS;
    this.meleeLockUntil.set(greed.id, now + 900); // brief stop to play Launch clip
    const dx = targetPlayer.position.x - greed.position.x;
    const dz = targetPlayer.position.z - greed.position.z;
    if (dx || dz) greed.rotation = Math.atan2(dx, dz);
    this._queueMove(greed.id, greed.position, greed.rotation);

    const start = { x: greed.position.x, y: greed.position.y + 1.4, z: greed.position.z };
    const target = { x: targetPlayer.position.x, y: targetPlayer.position.y + 1.0, z: targetPlayer.position.z };
    if (this.io) {
      this.io.to(this.roomId).emit('greed-ability-telegraph', {
        greedId: greed.id, ability: 'launch', durationMs: 900, timestamp: now,
      });
      this.io.to(this.roomId).emit('greed-launch-telegraph', {
        greedId: greed.id, startPosition: start, targetPosition: target, damage: GREED_RED_DAMAGE, timestamp: now,
      });
    }

    const dirLen = Math.hypot(target.x - start.x, target.z - start.z) || 1;
    const dir = { x: (target.x - start.x) / dirLen, z: (target.z - start.z) / dirLen };
    const pos = { x: start.x, z: start.z };
    const STEP_MS = 50;
    const maxSteps = Math.ceil((dirLen / GREED_FIREBALL_SPEED) * (1000 / STEP_MS)) + 4;
    let steps = 0;
    const intervalId = setInterval(() => {
      if (!this.room?.getGameStarted()) { clearInterval(intervalId); return; }
      steps++;
      pos.x += dir.x * GREED_FIREBALL_SPEED * (STEP_MS / 1000);
      pos.z += dir.z * GREED_FIREBALL_SPEED * (STEP_MS / 1000);
      const livePlayers = this.room?.getPlayers() || [];
      for (const p of livePlayers) {
        if (p.health <= 0) continue;
        const hdx = p.position.x - pos.x;
        const hdz = p.position.z - pos.z;
        if (hdx * hdx + hdz * hdz <= GREED_FIREBALL_HIT_RADIUS * GREED_FIREBALL_HIT_RADIUS) {
          clearInterval(intervalId);
          this.room.damagePlayersInHorizontalRing(
            { x: pos.x, z: pos.z }, GREED_FIREBALL_HIT_RADIUS, GREED_RED_DAMAGE, 'greed_fireball', { sourceEnemyId: greed.id },
          );
          this.io?.to(this.roomId).emit('greed-fireball-impact', {
            greedId: greed.id, position: pos, hit: true, timestamp: Date.now(),
          });
          return;
        }
      }
      if (steps >= maxSteps) {
        clearInterval(intervalId);
        this.io?.to(this.roomId).emit('greed-fireball-impact', {
          greedId: greed.id, position: pos, hit: false, timestamp: Date.now(),
        });
      }
    }, STEP_MS);
  }

  /** Blue — drops a stationary ground ember patch beneath itself that ticks damage for its duration. */
  greedSpawnEmberPatch(greed) {
    const now = Date.now();
    greed.nextEmberAt = now + GREED_BLUE_EMBER_INTERVAL_MS;
    const zoneId = `greed-ember-${greed.id}-${now}`;
    const position = { x: greed.position.x, z: greed.position.z };
    this.io?.to(this.roomId).emit('greed-ember-zone-spawned', {
      id: zoneId, position, radius: GREED_BLUE_EMBER_RADIUS, durationMs: GREED_BLUE_EMBER_DURATION_MS, timestamp: now,
    });
    let elapsed = 0;
    const intervalId = setInterval(() => {
      if (!this.room?.getGameStarted()) { clearInterval(intervalId); return; }
      elapsed += GREED_BLUE_EMBER_TICK_MS;
      this.room?.damagePlayersInHorizontalRing(position, GREED_BLUE_EMBER_RADIUS, GREED_BLUE_EMBER_DAMAGE, 'greed_blue_ember', { sourceEnemyId: greed.id });
      if (elapsed >= GREED_BLUE_EMBER_DURATION_MS) {
        clearInterval(intervalId);
        this.io?.to(this.roomId).emit('greed-ember-zone-expired', { id: zoneId, timestamp: Date.now() });
      }
    }, GREED_BLUE_EMBER_TICK_MS);
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
    const { gScore, cameFrom, inOpen } = this._resetAStarBuffers(cellCount);

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

    const thronePrep =
      this.room && this.room.gameMode === 'coop' && !this.room.combatArenaActive;
    const bossThroneArena =
      this.room && this.room.coopBossThroneArena;

    if (thronePrep) {
      const len = Math.hypot(rx, rz);
      const maxR = COOP_THRONE_ROOM_RADIUS - ENEMY_RADIUS;
      if (len > maxR && len > 1e-6) {
        const s = maxR / len;
        rx *= s;
        rz *= s;
      }
    } else if (bossThroneArena) {
      const len = Math.hypot(rx, rz);
      if (len > COOP_BOSS_THRONE_ARENA_CLAMP_R && len > 1e-6) {
        const s = COOP_BOSS_THRONE_ARENA_CLAMP_R / len;
        rx *= s;
        rz *= s;
      }
    } else {
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
      const clamped = this.clampToArenaXZ(rx, rz);
      rx = clamped.x;
      rz = clamped.z;
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
  /**
   * Pre-seed aggro for a freshly spawned enemy so it immediately starts marching toward
   * players without waiting to enter a short aggro-radius. Used for edge-spawned enemies
   * that start far from players.
   * @param {{ id: string, position: { x: number, z: number } }} enemy
   */
  forceAggroOnEnemy(enemy) {
    if (!enemy || !enemy.id) return;
    const players = this.room?.getPlayers?.() ?? [];
    if (!players.length) return;
    const closestPlayer = this.findClosestPlayer(enemy, players);
    if (!closestPlayer) return;
    this.enemyAggro.set(enemy.id, {
      targetPlayerId: closestPlayer.id,
      targetZombieId: null,
      targetTrapId: null,
      lastUpdate: Date.now(),
      aggro: 100,
      isAggroed: true,
      threatFromDamage: false,
      directPlayerDamageAggroed: false,
      // Keeps the leash radius at Infinity so the long north-to-south march
      // is never interrupted by the normal distance-based de-aggro check.
      forcedEdgeSpawn: true,
    });
  }

  removeEnemyAggro(enemyId) {
    this._clearEnemyTimeouts(enemyId);
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
    this.bossThrowCooldown.delete(enemyId);
    this.bossThrowEndAt.delete(enemyId);
    this.bossThrowTarget.delete(enemyId);
    const throwT = this.bossThrowTimeout.get(enemyId);
    if (throwT) clearTimeout(throwT);
    this.bossThrowTimeout.delete(enemyId);
    this.bossCombatStartedMs.delete(enemyId);
    this.bossThrowLeapSharedCdUntil.delete(enemyId);
    this.bossSkeletonSummonCooldown.delete(enemyId);
    this.bossSummonedSkeletons.delete(enemyId);
    this.boss2ArchonLightningCooldown.delete(enemyId);
    this.boss2ArchonLightningLockUntil.delete(enemyId);
    const archonT = this.boss2ArchonLightningTimeout.get(enemyId);
    if (archonT) clearTimeout(archonT);
    this.boss2ArchonLightningTimeout.delete(enemyId);
    this.boss2ArchonLightningComboPhase.delete(enemyId);
    this.boss2BlinkCooldown.delete(enemyId);
    this.clearBoss2DeathGraspTimers(enemyId);
    this.clearBoss2FlamePillarTimers(enemyId);
    this.boss2WarlockSummonLastAt.delete(enemyId);
    const b3gb = this.boss3GreenBeamDamageInterval.get(enemyId);
    if (b3gb) clearInterval(b3gb);
    this.boss3GreenBeamDamageInterval.delete(enemyId);
    this.boss3GreenBeamEndAt.delete(enemyId);
    this.boss3GreenBeamStages.delete(enemyId);
    const b3wup = this.boss3NovaWindupTimeout.get(enemyId);
    if (b3wup) clearTimeout(b3wup);
    this.boss3NovaWindupTimeout.delete(enemyId);
    this.boss3ClearNovaBurstTimeouts(enemyId);
    this.boss3ClearNovaSweepIntervals(enemyId);
    const b3Lightning = this.boss3LightningInterval.get(enemyId);
    if (b3Lightning) clearInterval(b3Lightning);
    this.boss3LightningInterval.delete(enemyId);
    this.boss3LockUntil.delete(enemyId);
    this.boss3NovaLastRelease.delete(enemyId);
    this.warlockBlinkCooldown.delete(enemyId);
    this.warlockLaunchCooldown.delete(enemyId);
    this.warlockBlinkLaunchSharedCooldownUntil.delete(enemyId);
    this.warlockMeteorCooldown.delete(enemyId);
    this.warlockLaunchMoveLockUntil.delete(enemyId);
    this.clearWarlockOrbIntervals(enemyId);
    this.warlockArchonShockCooldown.delete(enemyId);
    this.warlockArchonShockLockUntil.delete(enemyId);
    const warlockShockT = this.warlockArchonShockTimeout.get(enemyId);
    if (warlockShockT) clearTimeout(warlockShockT);
    this.warlockArchonShockTimeout.delete(enemyId);
    this.shadeBlinkCooldown.delete(enemyId);
    this.viperAttackCooldown.delete(enemyId);
    const viperFollowupT = this.viperFollowupTimeout.get(enemyId);
    if (viperFollowupT) clearTimeout(viperFollowupT);
    this.viperFollowupTimeout.delete(enemyId);
    this.weaverHealCooldown.delete(enemyId);
    this.weaverSummonCooldown.delete(enemyId);
    this.weaverLightningCooldown.delete(enemyId);
    this.weaverImpaleSpikeCooldown.delete(enemyId);
    this.weaverCastLockUntil.delete(enemyId);
    this.clearWeaverImpaleSpikePendingTimeoutsForWeaver(enemyId);
    this.weaverSummonedGhouls.delete(enemyId);
    this.ghoulAttackCooldown.delete(enemyId);
    this.titanAttackCooldown.delete(enemyId);
    const titanPowerupT = this.titanBladestormPowerupTimeout.get(enemyId);
    if (titanPowerupT) clearTimeout(titanPowerupT);
    this.titanBladestormPowerupTimeout.delete(enemyId);
    this.titanStompCooldown.delete(enemyId);
    const titanStompWindupT = this.titanStompWindupTimeout.get(enemyId);
    if (titanStompWindupT) clearTimeout(titanStompWindupT);
    this.titanStompWindupTimeout.delete(enemyId);
    const titanStompInterval = this.titanStompShockwaveInterval.get(enemyId);
    if (titanStompInterval) clearInterval(titanStompInterval);
    this.titanStompShockwaveInterval.delete(enemyId);
    this.titanCannonCooldown.delete(enemyId);
    const titanCannonWindupT = this.titanCannonWindupTimeout.get(enemyId);
    if (titanCannonWindupT) clearTimeout(titanCannonWindupT);
    this.titanCannonWindupTimeout.delete(enemyId);
    this.titanRedCannonCharges.delete(enemyId);
    this.titanRedCannonLastCastAt.delete(enemyId);
    this.ghoulLeapCooldown.delete(enemyId);
    this.ghoulLeapEndAt.delete(enemyId);
    this.ghoulLeapLand.delete(enemyId);
    this.ghoulLeapFrom.delete(enemyId);
    const ghoulLeapT = this.ghoulLeapTimeout.get(enemyId);
    if (ghoulLeapT) clearTimeout(ghoulLeapT);
    this.ghoulLeapTimeout.delete(enemyId);
    this.meleeLockUntil.delete(enemyId);
    this.knightAbilityCooldown.delete(enemyId);
    this.knightSmiteCooldown.delete(enemyId);
    this.knightDashCooldown.delete(enemyId);
    this.knightSpinCooldown.delete(enemyId);
    const stormLashHandles = this.knightStormLashTimeouts.get(enemyId);
    if (stormLashHandles) {
      for (const h of stormLashHandles) clearTimeout(h);
    }
    this.knightStormLashTimeouts.delete(enemyId);
    this.enemyPaths.delete(enemyId);
    this.templarBlinkSmiteNextAt.delete(enemyId);
    this.templarLeapCooldown.delete(enemyId);
    this.templarLeapEndAt.delete(enemyId);
    this.templarLeapLand.delete(enemyId);
    this.templarLeapFrom.delete(enemyId);
    const templarLeapT = this.templarLeapTimeout.get(enemyId);
    if (templarLeapT) clearTimeout(templarLeapT);
    this.templarLeapTimeout.delete(enemyId);

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
    // Edge-spawned enemies must march the full arena length without de-aggroing.
    if (aggroData.forcedEdgeSpawn) return Number.POSITIVE_INFINITY;
    const base = aggroRadius * 3;
    if (aggroData.directPlayerDamageAggroed) {
      return Number.POSITIVE_INFINITY;
    }
    if (aggroData.threatFromDamage) {
      return Math.max(base, DAMAGE_THREAT_LEASH);
    }
    return base;
  }

  /**
   * Clear the forced-edge-spawn flag once the enemy has reached normal aggro
   * proximity, so future de-aggro behaviour works as expected.
   */
  _maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius) {
    if (aggroData.forcedEdgeSpawn && distance <= aggroRadius) {
      aggroData.forcedEdgeSpawn = false;
    }
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
    if (!z || !this.isFriendlyCombatUnit(z) || z.isDying || z.health <= 0) return;

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

  applyAlliedUnitThreat(defenderEnemyId, allyId, aggroAmount = 50) {
    const ally = this.room?.enemies?.get?.(allyId);
    if (!ally || ally.type !== 'allied-knight' || ally.isDying || ally.health <= 0) return;
    this.applyZombieThreat(defenderEnemyId, allyId, Math.max(aggroAmount * 2, 100));
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
      this._queueMove(trap.id, trap.position, trap.rotation);
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
      { sourceEnemyId: trapId },
    );

    const hit = new Set();
    for (const e of this.room.getEnemies()) {
      if (!e || e.id === trapId || e.isDying || e.health <= 0) continue;
      if (e.type === 'tentacle-spine' || e.type === 'training-dummy') continue;
      if (e.type === 'boss' || e.type === 'boss2' || e.type === 'boss3' || e.type === 'boss-skeleton') continue;
      if (distPointSegmentSqXZ(e.position.x, e.position.z, ax, az, bx, bz) > hw2) continue;
      if (hit.has(e.id)) continue;
      hit.add(e.id);
      const damage = e.alliedUnit === true
        ? TENTACLE_SPINE_DMG_ALLIED_KNIGHT
        : TENTACLE_SPINE_DMG_MOB;
      this.room.damageEnemy(e.id, damage, null, null, {
        sourceTrapId: trapId,
        damageType: 'tentacle_spine',
      });
    }

    live.trapNextReadyAt = Date.now() + TENTACLE_SPINE_COOLDOWN_MS;
    if (this.io) {
      this._queueMove(trapId, live.position, live.rotation);
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
      if (z && this.isFriendlyCombatUnit(z) && !z.isDying && z.health > 0) {
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

  /** Purple shade: 3 daggers; blue shade: 2 longer/faster daggers. */
  getShadeDaggerDelays(shade) {
    return shade?.soulType === 'blue' ? SHADE_DAGGER_DELAYS_MS_BLUE : SHADE_DAGGER_DELAYS_MS;
  }

  /** Server-side player + allied-unit probe per dagger wave (shade throws toward aim xz). */
  scheduleAllyShadeDaggerChecks(shadeId, aimTx, aimTz, delaysMs = SHADE_DAGGER_DELAYS_MS) {
    const SHADE_DAGGER_PATH_RADIUS_SQ = 3.5 * 3.5;
    /** Match ShadeDaggerProjectile HIT_RADIUS / viper_arrow halfWidth. */
    const SHADE_DAGGER_HALF_WIDTH = 1.05;
    delaysMs.forEach((delayMs) => {
      setTimeout(() => {
        if (!this.room?.getGameStarted()) return;
        const sh = this.room?.getEnemy(shadeId);
        if (!sh || sh.isDying) return;
        if (this.room?.isEnemyAffectedBy(shadeId, 'stun')) return;
        const sx = sh.position.x;
        const sz = sh.position.z;
        const dx = aimTx - sx;
        const dz = aimTz - sz;
        const len = Math.hypot(dx, dz) || 1e-6;
        const endX = sx + (dx / len) * SHADE_DAGGER_MAX_RANGE;
        const endZ = sz + (dz / len) * SHADE_DAGGER_MAX_RANGE;
        const damage = sh.damage || 25;
        this.room?.damagePlayersInLineSegment?.(
          sx,
          sz,
          endX,
          endZ,
          SHADE_DAGGER_HALF_WIDTH,
          damage,
          'shade_dagger',
          { sourceEnemyId: shadeId },
        );
        this.damageAlliedUnitsAlongSegmentXZ(sx, sz, endX, endZ, SHADE_DAGGER_PATH_RADIUS_SQ, damage, {
          sourceEnemyId: shadeId,
          damageType: 'shade_dagger',
        });
      }, delayMs);
    });
  }

  damagePlayerZombieFromMob(mob, zombie, damage, damageType) {
    if (!this.room || !zombie || !this.isFriendlyCombatUnit(zombie)) return null;
    return this.room.damageEnemy(zombie.id, damage, null, null, { damageType, sourceEnemyId: mob?.id });
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
    this.markAlliedCombatInitiated(enemyId);
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