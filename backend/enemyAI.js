const { WALL_SEGMENTS } = require('./wallData');
const { rotationYTowardEntry, FAE_REALM_HEX_RADIUS } = require('./coopArenaLayout');
const {
  getMeleeProfile,
  getMeleeHalfArcRad,
  getMeleeCommitAtMs,
  MELEE_CLOSE_INSET: SHARED_MELEE_CLOSE_INSET,
} = require('./meleeProfiles');

// Mirror client main arena constants (colored rooms use a circle at this radius).
const MAIN_ARENA_HEX_RADIUS = 16;
const MAIN_CIRCLE_INNER_RADIUS = MAIN_ARENA_HEX_RADIUS - 0.5;
/** Stat/trial hex combat arena — must match `HexCombatArena.tsx`. */
const HEX_ARENA_RADIUS = 17;
const HEX_FLOOR_MARGIN = 1.4;
const HEX_INNER_APOTHEM = HEX_ARENA_RADIUS * Math.cos(Math.PI / 6) - HEX_FLOOR_MARGIN;
/** Fae Realm hex — slightly smaller than Inner Sanctum. */
const FAE_REALM_INNER_APOTHEM = FAE_REALM_HEX_RADIUS * Math.cos(Math.PI / 6) - HEX_FLOOR_MARGIN;
/** Erebus Gate colosseum — must match `CASTLE_ROOM_HALF_SIZE` in mapConstants / coopArenaLayout. */
const EREBUS_GATE_RADIUS = 14;
const EREBUS_GATE_INNER_RADIUS = EREBUS_GATE_RADIUS - 0.5;
/** Match `backend/gameRoom.js` COOP_THRONE_ROOM_RADIUS — prep disc; wall resolve when combat not active. */
const COOP_THRONE_ROOM_RADIUS = 16;
/** Match `ThroneRoom.tsx` THRONE_RIM_INSET — inset from grass rim for portals / foot clearance. */
const THRONE_RIM_INSET = 1.25;
const ENEMY_WALL_COLLISION_RADIUS = 0.5;

function _enemyAiLog(...args) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
}

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
const NAV_RECOMPUTE_DIST = 0.75; // recompute path when target moves this far (was 0.5; fewer A* rebuilds)
/** Skip enemies-moved when displacement is at/under this (matches ~playerHandler scale). */
const ENEMY_MOVE_POS_EPS_SQ = 0.0001;
const ENEMY_MOVE_ROT_EPS = 0.01;
/** Cell size for all-enemy spatial buckets used by Spectre/Nemesis/Valkyrie targeting. */
const ENEMY_SPATIAL_CELL = 5;

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

/** Sunken temple pentagon — must match clampPositionToPentagonXZ / clampToPentagonArenaXZ. */
function clampToPentagonXZ(x, z, radius = EREBUS_GATE_RADIUS, inset = 0.5) {
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

// Melee units advance until this much *inside* max swing range so the damage
// check at swing end is harder to escape with a small back-step.
const MELEE_CLOSE_INSET = 0.35;
const KNIGHT_MELEE_WINDUP_STEP = 0.3;
const KNIGHT_MELEE_WINDUP_STEP_DELAY_MS = 450;
const KNIGHT_DASH_COOLDOWN_MS = 7000;
const KNIGHT_DASH_DISTANCE = 3.5;
const KNIGHT_DASH_DURATION_MS = 350;
const KNIGHT_DASH_MIN_DISTANCE = 3.25;
const KNIGHT_SPIN_COOLDOWN_MS = 7000;
const KNIGHT_SPIN_CAST_RANGE = 4.5;
const KNIGHT_SPIN_CHARGE_MS = 500;
const KNIGHT_SPIN_DISTANCE = 4.5;
const KNIGHT_SPIN_TRAVEL_MS = 400; // 31 frames at 30fps
const KNIGHT_SPIN_DAMAGE = 21;
const KNIGHT_SPIN_STRIP_HALF_WIDTH = 0.75;

// Assassin — hybrid spin / bow / evade (no basic melee).
const ASSASSIN_SPIN_COOLDOWN_MS = 6000;
const ASSASSIN_SPIN_CAST_RANGE = 5.0;
const ASSASSIN_SPIN_CHARGE_MS = 500;
const ASSASSIN_SPIN_DISTANCE = 5.0;
const ASSASSIN_SPIN_TRAVEL_MS = 400;
const ASSASSIN_SPIN_DAMAGE = 37;
const ASSASSIN_SPIN_STRIP_HALF_WIDTH = 0.75;
const ASSASSIN_BOW_MIN_RANGE = 5.0;
const ASSASSIN_BOW_COOLDOWN_MS = 5000;
const ASSASSIN_BOW_DAMAGE = 63;
/** Triple bow volley — delay matches VIPER_DRAWBOW_DURATION_MS (1s between shots). */
const ASSASSIN_TRIPLE_SHOT_COUNT = 3;
const ASSASSIN_TRIPLE_SHOT_FOLLOWUP_DELAY_MS = 1000;
const ASSASSIN_EVADE_COOLDOWN_MS = 5000;
const ASSASSIN_EVADE_DISTANCE = 6.75;
const ASSASSIN_EVADE_DURATION_MS = 900;
const ASSASSIN_DREAMSHROUD_COOLDOWN_MS = 8_000;
const ASSASSIN_DREAMSHROUD_DURATION_MS = 3_000;
const ASSASSIN_DREAMSHROUD_CAST_LOCK_MS = 400;
const ASSASSIN_DREAMSHROUD_CENTER_RADIUS = 6;

// Knight / templar / ghoul / martyr / titan: ring goals + peer separation (radii match client CoopGameScene hit spheres).
const MELEE_SURROUND_TYPES = new Set(['knight', 'templar', 'spectre', 'serpent', 'boss-serpent', 'wyvern', 'destiny', 'tiger', 'boss-tiger', 'wolf', 'boss-wolf', 'bear', 'boss-bear', 'skyray', 'terrorhawk', 'bone-spider', 'death-knight', 'shaman', 'assassin', 'ghoul', 'martyr', 'titan', 'nemesis', 'stone-giant', 'eternal-oak', 'colossus', 'allied-knight', 'allied-huntress', 'allied-demon', 'allied-tiger', 'allied-wolf', 'allied-bear', 'allied-serpent', 'allied-spider']);
const MELEE_PEER_SEP_PADDING = 0.05;
// ~0.75×attackRange (~1.95m for knights): inside attack range, outside body-radius overlap.
const MELEE_SURROUND_STANDOFF_FRAC = 0.75;
const MELEE_SURROUND_STANDOFF_MIN = 0.3;
const MELEE_SURROUND_STANDOFF_MARGIN = 0.08; 

// Leash to current non-player damage threat (arena ~64×64).
const DAMAGE_THREAT_LEASH = 90;

// Titan — heavy patrol melee unit (post boss-1 room spawn).
const TITAN_AGGRO_RADIUS = 6;
const TITAN_ATTACK_RANGE = 3.0;
const TITAN_SWING_LOCK_MS = 1500;
const TITAN_HIT_DELAY_MS = 700;
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
const TITAN_STOMP_WINDUP_MS = 1150;
const TITAN_STOMP_MIN_DISTANCE = 3;
const TITAN_STOMP_MAX_RANGE = 12;
const TITAN_STOMP_STUN_MS = 2100;
const TITAN_STOMP_HALF_WIDTH_MIN = 0.5;
const TITAN_STOMP_HALF_WIDTH_MAX = 2.0;
const TITAN_STOMP_DAMAGE = 15;
const TITAN_STOMP_TRAVEL_MS = 700;
const TITAN_STOMP_STEPS = 10;
const TITAN_CANNON_UNLOCK_BOSS_COUNT = 3;
const TITAN_CANNON_COOLDOWN_MS = 13_000;
const TITAN_CANNON_WINDUP_MS = 1000;
const TITAN_CANNON_TOTAL_LOCK_MS = 1500;
const TITAN_CANNON_RANGE = 20;
const TITAN_CANNON_HALF_WIDTH = 1.8;
// Above melee (3); overlaps stomp so cannon can fire in normal post-aggro fights.
const TITAN_CANNON_MIN_RANGE = 6;
const TITAN_CANNON_START_OFFSET = 0.65;
const TITAN_CANNON_DAMAGE_BY_SOUL = { green: 120, red: 150, purple: 130, blue: 140 };
const TITAN_CANNON_BLUE_COOLDOWN_MS = 5000;
const TITAN_CANNON_RED_HEALTH_PCT = 0.9;
const TITAN_CANNON_RED_MAX_CHARGES = 2;
const TITAN_CANNON_RED_CHARGE_MS = 20000;
const TITAN_CANNON_RED_CAST_GAP_MS = 1250;
const TITAN_CANNON_PURPLE_COOLDOWN_MS = 15000;
const TITAN_CANNON_GREEN_COOLDOWN_MS = TITAN_CANNON_COOLDOWN_MS;

// Eternity Palace heavies — Titan-style patrol melee (no bladestorm/cannon/stomp)
const PALACE_HEAVY_AGGRO_RADIUS = 6;
const PALACE_HEAVY_ATTACK_RANGE = 3.0;
const PALACE_HEAVY_KNOCKBACK_DISTANCE = 7;
const PALACE_HEAVY_KNOCKBACK_DURATION = 0.5;
const PALACE_HEAVY_TYPES = new Set(['stone-giant', 'eternal-oak', 'colossus']);
/** Palace heavies + assassin deal 3× damage to pet companions / allied units. */
const ALLY_TRIPLE_DAMAGE_TYPES = new Set(['stone-giant', 'eternal-oak', 'colossus', 'assassin']);
const ALLY_DAMAGE_MULTIPLIER = 3;
const PALACE_HEAVY_CONFIG = {
  'stone-giant': {
    swingLockMs: 1940,
    hitDelayMs: 800,
    eventPrefix: 'stone-giant',
    idField: 'stoneGiantId',
    damageType: 'stone_giant_melee',
  },
  'eternal-oak': {
    swingLockMs: 2240,
    hitDelayMs: 800,
    eventPrefix: 'eternal-oak',
    idField: 'eternalOakId',
    damageType: 'eternal_oak_melee',
    hasEarthbreaker: true,
  },
  'colossus': {
    swingLockMs: 1650,
    hitDelayMs: 735,
    eventPrefix: 'colossus',
    idField: 'colossusId',
    damageType: 'colossus_melee',
  },
};
const ETERNAL_OAK_EARTHBREAKER_CD_MS = 10_000;
const ETERNAL_OAK_EARTHBREAKER_CAST_MS = 1_100;
const ETERNAL_OAK_EARTHBREAKER_RADIUS = 7.5;
const ETERNAL_OAK_EARTHBREAKER_STUN_MS = 4_300;

/** Passive auras for Eternal Oak / Stone Giant / Colossus. */
const PALACE_AURA_RADIUS = 8;
const ETERNAL_OAK_HEAL_PER_SEC = 50;
const STONE_GIANT_DAMAGE_PER_ALLY = 30;
const STONE_GIANT_SPEED_PER_ALLY = 0.6;
const STONE_GIANT_MAX_BONUS_SPEED = 3.0;

// Spectre — templar-style two-handed melee (paladin GLBs)
const SPECTRE_MELEE_RANGE = 2.725;
const SPECTRE_AGGRO_RADIUS = 15;
const SPECTRE_SWING_LOCK_MS = 1200;
const SPECTRE_HIT_DELAY_MS = 1000;
const SPECTRE_WHIRLWIND_COOLDOWN_MS = 20000;
const SPECTRE_WHIRLWIND_DURATION_MS = 7000;
const SPECTRE_WHIRLWIND_TICK_MS = 500;
const SPECTRE_WHIRLWIND_RADIUS = 3;
const SPECTRE_WHIRLWIND_DAMAGE = 23;
const SPECTRE_WHIRLWIND_MOVE_SPEED_MULT = 1.225;
const SPECTRE_WHIRLWIND_CAST_RANGE = 3.5;

// Death Knight — spectre-style melee with Heartstrike cone ability
const DEATH_KNIGHT_MELEE_RANGE = 2.725;
const DEATH_KNIGHT_AGGRO_RADIUS = 15;
const DEATH_KNIGHT_SWING_LOCK_MS = 1000;
const DEATH_KNIGHT_HIT_DELAY_MS = 750;
const DEATH_KNIGHT_BASE_DAMAGE = 49;
const DEATH_KNIGHT_HEARTSTRIKE_COOLDOWN_MS = 9000;
const DEATH_KNIGHT_HEARTSTRIKE_DAMAGE = 59;
const DEATH_KNIGHT_HEARTSTRIKE_RANGE = DEATH_KNIGHT_MELEE_RANGE;
const DEATH_KNIGHT_HEARTSTRIKE_HALF_ANGLE_RAD = Math.PI / 4;
const DEATH_KNIGHT_HEARTSTRIKE_CAST_RANGE = 4.0;
const DEATH_KNIGHT_FROST_PILLARS_COOLDOWN_MS = 7000;
const DEATH_KNIGHT_FROST_PILLARS_CAST_MS = 1100;
const DEATH_KNIGHT_FROST_PILLARS_CAST_RANGE = 8.0;
const DEATH_KNIGHT_FROST_PILLARS_COUNT = 6;
const DEATH_KNIGHT_FROST_PILLARS_BASE_OFFSET = 2.0;
const DEATH_KNIGHT_FROST_PILLARS_STEP = 0.9;
const DEATH_KNIGHT_FROST_PILLARS_STAGGER_MS = 120;
const DEATH_KNIGHT_FROST_PILLARS_DAMAGE = 37;
const DEATH_KNIGHT_FROST_PILLARS_RADIUS = 2.0;

const SHAMAN_MELEE_RANGE = 2.725;
const SHAMAN_AGGRO_RADIUS = 15;
const SHAMAN_SWING_LOCK_MS = 1150;
const SHAMAN_HIT_DELAY_MS = 800;
const SHAMAN_BASE_DAMAGE = 32;
const SHAMAN_STORM_SHOCK_COOLDOWN_MS = 6000;
const SHAMAN_STORM_SHOCK_DAMAGE = 31;
const SHAMAN_STORM_SHOCK_RANGE = 7.0;
const SHAMAN_STORM_SHOCK_CAST_RANGE = 7.0;
const SHAMAN_STORM_SHOCK_HALF_WIDTH = 1.0;
const SHAMAN_STORM_SHOCK_CAST_LOCK_MS = 1200;
const SHAMAN_STORM_SHOCK_WINDUP_MS = 800;
const SHAMAN_SPIRIT_WOLVES_COOLDOWN_MS = 20_000;
const SHAMAN_SPIRIT_WOLVES_CAST_LOCK_MS = 1800;
const SHAMAN_SPIRIT_WOLVES_WINDUP_MS = 900;
const SHAMAN_SPIRIT_WOLVES_SIDE_OFFSET = 2.5;
const SHAMAN_SPIRIT_WOLVES_MAX_ACTIVE = 4;
const SHAMAN_SPIRIT_WOLF_HP = 700;
const SHAMAN_SPIRIT_WOLF_DAMAGE = 14;

// Serpent — basic melee (slither move, alternating attacks)
const SERPENT_MELEE_RANGE = 2.75;
const SERPENT_AGGRO_RADIUS = 25;
const SERPENT_SWING_LOCK_MS = 1650;
const SERPENT_HIT_DELAY_MS = 750;
const SERPENT_BASE_DAMAGE = 21;
const SERPENT_BASE_MOVE_SPEED = 2.5;

// Tiger — local wander melee + pounce leap (Inner Sanctum I)
const TIGER_MELEE_RANGE = 2.6;
const TIGER_AGGRO_RADIUS = 10;
const TIGER_WALK_SPEED = 1.45;
const TIGER_RUN_SPEED = 3.195;
const TIGER_SWING_LOCK_MS = 1450;
const TIGER_HIT_DELAY_MS = 750;
const TIGER_BASE_DAMAGE = 23;
const TIGER_WANDER_RADIUS = 7;
const TIGER_WANDER_REPICK_MS = 3500;
const TIGER_WANDER_REACH = 1.0;
const TIGER_POUNCE_MAX_TRAVEL = 5.875;
const TIGER_POUNCE_COOLDOWN_MS = 5_000;
const TIGER_POUNCE_DAMAGE = 19;
const TIGER_POUNCE_LANDING_RADIUS = 2.25;
const TIGER_POUNCE_LAND_STANDOFF_M = 0.1;
const TIGER_POUNCE_MIN_RANGE = 2.7;

// Wolf — Fae Realm I pack melee (howl intro, no pounce)
const WOLF_MELEE_RANGE = 2.6;
const WOLF_AGGRO_RADIUS = 17;
const WOLF_MOVE_SPEED = 3.25;
const WOLF_SWING_LOCK_MS = 1100;
const WOLF_HIT_DELAY_MS = 650;
const WOLF_BASE_DAMAGE = 14;
const WOLF_HOWL_STAGGER_MS = 320;
const WOLF_HOWL_DURATION_MS = 2000;

// Bear — Fae Realm III melee (alternating attacks, no howl)
const BEAR_MELEE_RANGE = 2.75;
const BEAR_AGGRO_RADIUS = 17;
const BEAR_MOVE_SPEED = 3.125;
const BEAR_SWING_LOCK_MS = 1500;
const BEAR_HIT_DELAY_MS = 750;
const BEAR_BASE_DAMAGE = 38;

// Bone Spider — Fae Realm III ensnaring caster + entangled melee
const BONE_SPIDER_MELEE_RANGE = 3.0;
const BONE_SPIDER_AGGRO_RADIUS = 20;
const BONE_SPIDER_MOVE_SPEED = 2.5;
const BONE_SPIDER_MELEE_DAMAGE = 53;
const BONE_SPIDER_MELEE_COOLDOWN_MS = 1850;
const BONE_SPIDER_SWING_LOCK_MS = 1100;
const BONE_SPIDER_HIT_DELAY_MS = 700;
const BONE_SPIDER_SHOT_RANGE = 14;
const BONE_SPIDER_SHOT_COOLDOWN_MS = 2150;
/** Keep in sync with CoopGameScene / BoneSpiderRenderer BONE_SPIDER_CAST_MS */
const BONE_SPIDER_CAST_MS = 1200;
const BONE_SPIDER_SHOT_SPEED = 15;
const BONE_SPIDER_SHOT_HIT_RADIUS = 1.25;
const BONE_SPIDER_ENTANGLE_DURATION_MS = 3000;

// Skyray — swim-wander melee (Inner Sanctum I)
const SKYRAY_MELEE_RANGE = 2.5;
const SKYRAY_AGGRO_RADIUS = 5;
const SKYRAY_SWING_LOCK_MS = 750;
const SKYRAY_HIT_DELAY_MS = 866;
const SKYRAY_BASE_DAMAGE = 27;
const SKYRAY_CHASE_SPEED = 2.6;
const SKYRAY_WANDER_SPEED = 1.0;
const SKYRAY_WANDER_REPICK_MS = 4000;
const SKYRAY_WANDER_REACH = 1.0;

// Wyvern — Serpent-style melee + breath weapon (Greed-style firebolt)
const WYVERN_MELEE_RANGE = 3.075;
const WYVERN_AGGRO_RADIUS = 20;
const WYVERN_SWING_LOCK_MS = 1250;
const WYVERN_HIT_DELAY_MS = 775;
const WYVERN_BASE_DAMAGE = 42;
const WYVERN_BASE_MOVE_SPEED = 2.95;
const WYVERN_BREATH_COOLDOWN_MS = 5000;
const WYVERN_BREATH_CAST_LOCK_MS = 1500;
const WYVERN_BREATH_ROAR_CAST_LOCK_MS = 2000; // +500ms over base cast (drake_roar)
const WYVERN_BREATH_LAUNCH_EARLY_MS = 400; // firebolts release before cast ends (animation sync)
// Simultaneous fan: far left (+36°), left (+18°), center, right (−18°), far right (−36°)
const WYVERN_BREATH_ROAR_FAN_ANGLES_RAD = [
  Math.PI / 5,
  Math.PI / 10,
  0,
  -Math.PI / 10,
  -Math.PI / 5,
];
const WYVERN_BREATH_DAMAGE = 36;
const WYVERN_BREATH_CAST_RANGE = 10;
const WYVERN_BREATH_MAX_RANGE = WYVERN_BREATH_CAST_RANGE; // bolt always travels full cast range

// Terrorhawk — fly / dive / ground-melee (Fae Realm II)
const TERRORHAWK_HOVER_Y = 9.0; // keep in sync with client terrorhawkCoopConstants
const TERRORHAWK_AGGRO_RADIUS = 12;
const TERRORHAWK_FLY_SPEED = 3.7;
const TERRORHAWK_MELEE_RANGE = 3.125;
const TERRORHAWK_LANDING_RADIUS = 2.0;
const TERRORHAWK_LANDING_DAMAGE = 21;
const TERRORHAWK_MELEE_DAMAGE = 26;
const TERRORHAWK_DIVE_XZ_THRESHOLD = 2.5;
const TERRORHAWK_DIVE_SPEED = 22.5;
/** Brief hold at hover Y after dive telegraph SFX before descending. */
const TERRORHAWK_DIVE_TELEGRAPH_MS = 300;
const TERRORHAWK_TAKEOFF_MS = 1250;
const TERRORHAWK_JUMPEND_MS = 725;
const TERRORHAWK_SWING_LOCK_MS = 3100;
const TERRORHAWK_HIT_DELAY_MS = 875;
const TERRORHAWK_APPROACH_STOP = 0.75;
/** Minimum time on the ground after landing before takeoff may begin. */
const TERRORHAWK_MIN_GROUND_MS = 2000;

// Destiny — dragon boss (Wyvern-style melee + roar breath + 70% fly phase)
const DESTINY_MELEE_RANGE = 3.875;
const DESTINY_AGGRO_RADIUS = 18;
const DESTINY_SWING_LOCK_MS = 1500;
const DESTINY_HIT_DELAY_MS = 750;
const DESTINY_BASE_DAMAGE = 71;
const DESTINY_BASE_MOVE_SPEED = 2.5;
const DESTINY_BREATH_COOLDOWN_MS = 9000;
const DESTINY_BREATH_ROAR_CAST_LOCK_MS = 3200;
const DESTINY_BREATH_LAUNCH_EARLY_MS = 400;
// Simultaneous fan: far left (+36°), left (+18°), center, right (−18°), far right (−36°)
const DESTINY_BREATH_ROAR_FAN_ANGLES_RAD = [
  Math.PI / 4,
  Math.PI / 8,
  0,
  -Math.PI / 8,
  -Math.PI / 4,
];
const DESTINY_BREATH_DAMAGE = 53;
const DESTINY_BREATH_CAST_RANGE = 12;
/** Prefer melee when this close; leave room for walk-in between roars. */
const DESTINY_BREATH_MIN_RANGE = 4.75;
const DESTINY_ATTACK_COOLDOWN_MS = 2000;
// Fly phase (one-shot at ≤70% HP) — keep in sync with src/utils/destinyCoopConstants.ts
const DESTINY_FLY_HEALTH_PCT = 0.70;
/** One-shot wyvern add summon at ≤30% HP — keep in sync with src/utils/destinyCoopConstants.ts */
const DESTINY_WYVERN_SUMMON_HEALTH_PCT = 0.30;
const DESTINY_WYVERN_SUMMON_COUNT = 2;
const DESTINY_HOVER_Y = 9.0;
const DESTINY_FLY_SPEED = 3.2;
const DESTINY_FLY_TAKEOFF_MS = 2000;
const DESTINY_FLY_LAND_MS = 2200;
const DESTINY_FLY_IDLE_HOLD_MS = 600;
const DESTINY_FLY_ATTACK_CAST_MS = 1800;
const DESTINY_FLY_ATTACK_LAUNCH_EARLY_MS = 875;
const DESTINY_FLY_ATTACK_COOLDOWN_MS = 3000;
const DESTINY_FLY_ATTACK_VOLLEYS = 5;
const DESTINY_FLY_APPROACH_STOP = 6.0;
const DESTINY_FLY_CENTER_HOLD = 1.5;
const DESTINY_FLY_ATTACK_RANGE = 18;
const DESTINY_FLY_MUZZLE_Y_OFFSET = 1.5;
/** Ember patches on combat target (air + post-land ground) — damage matches GREED_BLUE_EMBER_*. */
const DESTINY_AIR_EMBER_INTERVAL_MS = 1500;
const DESTINY_AIR_EMBER_DURATION_MS = 12000;
const DESTINY_AIR_EMBER_TICK_MS = 750;
const DESTINY_AIR_EMBER_DAMAGE = 20;
const DESTINY_AIR_EMBER_RADIUS = 2.0;
// Ground wing attack (bilateral fire-pillar streams) — keep in sync with src/utils/destinyCoopConstants.ts
const DESTINY_WING_COOLDOWN_MS = 8000;
const DESTINY_WING_CAST_LOCK_MS = 2000;
const DESTINY_WING_PILLAR_DAMAGE = 47;
const DESTINY_WING_PILLAR_RADIUS = 2.25;
const DESTINY_WING_PILLAR_COUNT = 5;
const DESTINY_WING_PILLAR_STAGGER_MS = 250;
const DESTINY_WING_PILLAR_FIRST_DELAY_MS = 500;
const DESTINY_WING_PILLAR_BASE_OFFSET = 2.0;
const DESTINY_WING_PILLAR_STEP = 1.0;
const DESTINY_WING_CAST_RANGE = 12;
/** Gap after a ground special ends before the other special may start (prevents roar→wing chaining). */
const DESTINY_GROUND_SPECIAL_GAP_MS = 2500;

/**
 * Flying units (terrorhawk / destiny hover at y=9) and Sabres Skyfall (~y≥6)
 * are unreachable for ground melee. Normal coop jumps apex ~0.8.
 */
const AIRBORNE_UNTARGETABLE_Y = 2.0;

/** Rotate a horizontal XZ direction around Y (same as Three.js makeRotationY). */
function rotateXZDir(x, z, angleRad) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return { x: x * cos + z * sin, z: -x * sin + z * cos };
}

// Nemesis — titan-style melee (Sunken Temple III)
const NEMESIS_AGGRO_RADIUS = 8;
const NEMESIS_ATTACK_RANGE = 3.0;
const NEMESIS_SWING_LOCK_MS = 1050;
const NEMESIS_HIT_DELAY_MS = 725;
const NEMESIS_KNOCKBACK_DISTANCE = 5;
const NEMESIS_KNOCKBACK_DURATION = 0.4;

// Valkyrie — slow levitating lunge chaser (Sunken Temple IV)
const VALKYRIE_AGGRO_RADIUS = 17;
const VALKYRIE_WALK_SPEED = 1.1;
const VALKYRIE_LUNGE_CAST_RANGE = 10;
const VALKYRIE_LUNGE_CHARGE_MS = 500;
const VALKYRIE_LUNGE_TRAVEL_MS = 725;
const VALKYRIE_LUNGE_STRIP_HALF_WIDTH = 0.75;
const VALKYRIE_LUNGE1_COOLDOWN_MS = 5000;
const VALKYRIE_LUNGE1_DAMAGE = 38;
const VALKYRIE_LUNGE1_DISTANCE = 8;
const VALKYRIE_LUNGE2_COOLDOWN_MS = 5000;
const VALKYRIE_LUNGE2_DAMAGE = 42;
const VALKYRIE_LUNGE2_DISTANCE = 6;
const VALKYRIE_JUDGMENT_COOLDOWN_MS = 5750;
const VALKYRIE_JUDGMENT_CAST_RANGE = 12;
const VALKYRIE_JUDGMENT_CAST_MS = 1500;
const VALKYRIE_JUDGMENT_HOVER_MS = 125;
const VALKYRIE_JUDGMENT_FALL_MS = 700;
const VALKYRIE_JUDGMENT_DAMAGE = 37;
const VALKYRIE_JUDGMENT_AOE_RADIUS = 1.75;
const VALKYRIE_JUDGMENT_CORRUPTED_MS = 5000;
const VALKYRIE_JUDGMENT_SKY_HEIGHT = 22;

// Sentinel — stand-and-cast (mirrors purple warlock movement; entangle primary)
const SENTINEL_WALK_SPEED = 2.025;
const SENTINEL_PREFERRED_STAND_RANGE = 8.25; // match WARLOCK_PREFERRED_STAND_RANGE
const SENTINEL_ENTANGLE_COOLDOWN_MS = 20000;
const SENTINEL_ENTANGLE_RANGE = 6;
const SENTINEL_ENTANGLE_DURATION_MS = 3000;
const SENTINEL_ENTANGLE_CAST_MS = 1000;
const SENTINEL_ENTANGLE_MOVE_LOCK_MS = 1000;
const SENTINEL_ENTANGLE_DELAY_MS = 500;
const SENTINEL_ORB_COOLDOWN_MS = 4000;
const SENTINEL_ORB_CAST_MS = 2000;
const SENTINEL_ORB_DAMAGE = 23;
const SENTINEL_ORB_SPEED = 12;
const SENTINEL_ORB_HIT_RADIUS = 1.1;
const SENTINEL_AGGRO_RADIUS = 15;

// Frost Queen — floating stationary caster (Inner Sanctum I)
const FROST_QUEEN_AGGRO_RADIUS = 15;
const FROST_QUEEN_PREFERRED_RANGE = 9.0;
const FROST_QUEEN_PREFERRED_BAND = 1.5;
const FROST_QUEEN_TELEPORT_RANGE = 14.0;
const FROST_QUEEN_TELEPORT_COOLDOWN_MS = 6000;
const FROST_QUEEN_TELEPORT_LOCK_MS = 1200;
const FROST_QUEEN_ICE_SHARDS_COOLDOWN_MS = 4000;
const FROST_QUEEN_ICE_SHARDS_CAST_RANGE = 12.0;
const FROST_QUEEN_ICE_SHARDS_CAST_LOCK_MS = 1500;
const FROST_QUEEN_ICE_SHARDS_LAUNCH_MS = 1000;
const FROST_QUEEN_ICE_SHARDS_TRAVEL_MS = 550;
const FROST_QUEEN_ICE_SHARDS_HIT_RADIUS = 1.35;
const FROST_QUEEN_ICE_SHARDS_DAMAGE = 24;
const FROST_QUEEN_ICE_SHARDS_ALLY_DAMAGE = 220;
const FROST_QUEEN_ICE_SHARDS_FREEZE_MS = 2000;
const FROST_QUEEN_ICE_SHARDS_LATERAL = 0.4;
const FROST_QUEEN_ICE_STORM_COOLDOWN_MS = 20000;
const FROST_QUEEN_ICE_STORM_CAST_RANGE = 14.0;
const FROST_QUEEN_ICE_STORM_CHANNEL_MS = 5000;
const FROST_QUEEN_ICE_STORM_TICK_MS = 500;
const FROST_QUEEN_ICE_STORM_DAMAGE = 9;

// Medusa — stationary caster (Sunken Temple IV)
const MEDUSA_AGGRO_RADIUS = 20;
const MEDUSA_CAST_RANGE = 16;
const MEDUSA_RAPIDFIRE_COOLDOWN_MS = 825;
const MEDUSA_RAPIDFIRE_CAST_LOCK_MS = 700;
const MEDUSA_VOIDWARP_COOLDOWN_MS = 20000;
const MEDUSA_VOIDWARP_DURATION_MS = 4000;
const MEDUSA_VOIDWARP_CAST_LOCK_MS = 4000;
/** Same purple-warlock meteor swarm; Medusa uses a shorter CD. */
const MEDUSA_METEOR_COOLDOWN_MS = 5000;
// Projectile — keep in sync with MedusaProjectile.tsx
const MEDUSA_PROJECTILE_DAMAGE = 18;
const MEDUSA_HOMING_DELAY_SEC = 0.55;
const MEDUSA_START_SPEED = 4;
const MEDUSA_MAX_SPEED = 14;
const MEDUSA_ACCEL_SEC = 2.0;
const MEDUSA_TURN_RATE = 2.2;
const MEDUSA_HIT_RADIUS = 0.75;
/** Homing barrage during VOIDWARP — first bolt at 300ms, then every 600ms (~6 bolts). */
const MEDUSA_VOIDWARP_BARRAGE_START_MS = 300;
const MEDUSA_VOIDWARP_BARRAGE_INTERVAL_MS = 600;
const MEDUSA_PROJECTILE_LAUNCH_Y = 1.6;

// Infested player-zombie summon lock — keep in sync with client ZombieRenderer SUMMON_DURATION
const INFESTED_ZOMBIE_SUMMON_LOCK_MS = 2800;

/** Necromancer Vengeful Spirit — keep in sync with `VENGEFUL_SPIRIT_*` in weaponAspects.ts */
const VENGEFUL_SPIRIT_BASE_DAMAGE = 50;
const VENGEFUL_SPIRIT_DAMAGE_PER_STAT_POINT = 1;
const VENGEFUL_SPIRIT_ATTACK_RANGE = 3.15;
const VENGEFUL_SPIRIT_ATTACK_COOLDOWN_MS = 1050;
const VENGEFUL_SPIRIT_DURATION_MS = 12000;
const VENGEFUL_SPIRIT_SUMMON_LOCK_MS = 2400;
const VENGEFUL_SPIRIT_EXPIRE_ANIM_MS = 2200;
const VENGEFUL_SPIRIT_MAX_ACTIVE = 4;
const VENGEFUL_SPIRIT_HIT_DELAY_MS = 400;
const VENGEFUL_SPIRIT_SWING_LOCK_MS = 900;
const VENGEFUL_SPIRIT_SPAWN_OFFSET = 1.2;

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

const ALLIED_KNIGHT_MAX_HP = 1500;
const ALLIED_KNIGHT_DAMAGE = 50;
const ALLIED_KNIGHT_ATTACK_COOLDOWN_MS = 1250;
const ALLIED_KNIGHT_MOVE_SPEED = 3.0;
const ALLIED_KNIGHT_ATTACK_RANGE = 2.6;
const ALLIED_KNIGHT_FOLLOW_DISTANCE = 3.0;
const ALLIED_KNIGHT_PROTECTIVE_THREAT_TTL_MS = 15000;
const ALLIED_TRAP_THREAT_TTL_MS = 15000;
const ALLIED_KNIGHT_PROTECTIVE_THREAT_DECAY_PER_SEC = 0.85;
const ALLIED_KNIGHT_PROTECTIVE_OVERRIDE_DAMAGE = 50;
const ALLIED_KNIGHT_ORB_COUNT = 3;
const ALLIED_KNIGHT_SMITE_ORB_COST = 2;
const ALLIED_KNIGHT_SMITE_COOLDOWN_MS = 5000;
const ALLIED_KNIGHT_ORB_RECHARGE_MS = 4000;
const ALLIED_KNIGHT_SMITE_LOCK_MS = 1200;
const ALLIED_KNIGHT_SMITE_IMPACT_DELAY_MS = 900;
const ALLIED_KNIGHT_SMITE_CAST_RANGE = 3.6;
const ALLIED_KNIGHT_SMITE_DAMAGE = 70;
const ALLIED_KNIGHT_SMITE_RADIUS = 1.85;
/** Max mobs that may simultaneously focus the allied knight via threat redirect. */
const ALLIED_KNIGHT_FOCUS_SOFT_CAP = 3;
const ALLIED_HUNTRESS_ATTACK_RANGE = 15;
const ALLIED_HUNTRESS_ARROW_PIERCE_HALF_WIDTH = 1.4;
const ALLIED_HUNTRESS_ARROW_PIERCE_RADIUS_SQ =
  ALLIED_HUNTRESS_ARROW_PIERCE_HALF_WIDTH * ALLIED_HUNTRESS_ARROW_PIERCE_HALF_WIDTH;
const ALLIED_HUNTRESS_DAMAGE_FALLBACK = 65;
const ALLIED_PHANTOM_ATTACK_RANGE = 11;
const ALLIED_PHANTOM_DAMAGE_FALLBACK = 40;
const ALLIED_PHANTOM_COMBO_COOLDOWN_MS = 4000;
const ALLIED_PHANTOM_DAGGER_HALF_WIDTH = 1.05;
const ALLIED_PHANTOM_DAGGER_HALF_WIDTH_SQ =
  ALLIED_PHANTOM_DAGGER_HALF_WIDTH * ALLIED_PHANTOM_DAGGER_HALF_WIDTH;
const ALLIED_DEMON_ATTACK_RANGE = 2.65;
const ALLIED_DEMON_DAMAGE_FALLBACK = 48;
/** Beastmaster tiger — keep in sync with BEASTMASTER_TIGER_* in weaponAspects.ts / gameRoom.js */
const BEASTMASTER_TIGER_AGGRO_RADIUS = 12;
const BEASTMASTER_TIGER_FOLLOW_DISTANCE = 3.0;
const BEASTMASTER_TIGER_ATTACK_RANGE = 2.6;
const BEASTMASTER_TIGER_WALK_SPEED = 2.25;
const BEASTMASTER_TIGER_RUN_SPEED = 3.9;
const BEASTMASTER_TIGER_ATTACK_COOLDOWN_MS = 1100;
const BEASTMASTER_TIGER_DAMAGE_FALLBACK = 29;
const BEASTMASTER_TIGER_SWING_LOCK_MS = 1000;
const BEASTMASTER_TIGER_HIT_DELAY_MS = 500;

/**
 * Allied beast companion configs — keep in sync with src/utils/faeBeastCompanion.ts
 * and FAE_BEAST_STATS in gameRoom.js.
 */
const ALLIED_BEAST_TYPES = new Set([
  'allied-tiger', 'allied-wolf', 'allied-bear', 'allied-serpent', 'allied-spider',
]);
const ALLIED_BEAST_CONFIGS = Object.freeze({
  'allied-tiger': {
    aggroRadius: BEASTMASTER_TIGER_AGGRO_RADIUS,
    followDistance: BEASTMASTER_TIGER_FOLLOW_DISTANCE,
    attackRange: BEASTMASTER_TIGER_ATTACK_RANGE,
    walkSpeed: BEASTMASTER_TIGER_WALK_SPEED,
    runSpeed: BEASTMASTER_TIGER_RUN_SPEED,
    attackCooldownMs: BEASTMASTER_TIGER_ATTACK_COOLDOWN_MS,
    swingLockMs: BEASTMASTER_TIGER_SWING_LOCK_MS,
    hitDelayMs: BEASTMASTER_TIGER_HIT_DELAY_MS,
    damageFallback: BEASTMASTER_TIGER_DAMAGE_FALLBACK,
    telegraphEvent: 'allied-tiger-attack-telegraph',
    telegraphIdKey: 'tigerId',
    damageType: 'allied_tiger_melee',
    bodyRadius: 0.9,
    hpRegenAmount: 15,
    hpRegenIntervalMs: 5000,
    showRegenHealNumber: false,
  },
  'allied-wolf': {
    aggroRadius: 15,
    followDistance: 3.0,
    attackRange: 2.4,
    walkSpeed: 3.0,
    runSpeed: 4.2,
    attackCooldownMs: 860,
    swingLockMs: 600,
    hitDelayMs: 350,
    damageFallback: 26,
    telegraphEvent: 'allied-wolf-attack-telegraph',
    telegraphIdKey: 'wolfId',
    damageType: 'allied_wolf_melee',
    bodyRadius: 0.58,
    hpRegenAmount: 30,
    hpRegenIntervalMs: 5000,
    showRegenHealNumber: true,
  },
  'allied-bear': {
    aggroRadius: 11,
    followDistance: 3.0,
    attackRange: 2.8,
    walkSpeed: 2.85,
    runSpeed: 4.2,
    attackCooldownMs: 1400,
    swingLockMs: 1500,
    hitDelayMs: 500,
    damageFallback: 44,
    telegraphEvent: 'allied-bear-attack-telegraph',
    telegraphIdKey: 'bearId',
    damageType: 'allied_bear_melee',
    bodyRadius: 1.0,
    hpRegenAmount: 40,
    hpRegenIntervalMs: 5000,
    showRegenHealNumber: false,
  },
  'allied-serpent': {
    aggroRadius: 10,
    followDistance: 3.0,
    attackRange: 2.6,
    walkSpeed: 2.0,
    runSpeed: 3.0,
    attackCooldownMs: 1250,
    swingLockMs: 1000,
    hitDelayMs: 400,
    damageFallback: 37,
    telegraphEvent: 'allied-serpent-attack-telegraph',
    telegraphIdKey: 'serpentId',
    damageType: 'allied_serpent_melee',
    bodyRadius: 0.7,
    hpRegenAmount: 15,
    hpRegenIntervalMs: 5000,
    showRegenHealNumber: false,
  },
  'allied-spider': {
    aggroRadius: 14,
    followDistance: 3.0,
    attackRange: 2.5,
    walkSpeed: 1.5,
    runSpeed: 1.5,
    attackCooldownMs: 1400,
    swingLockMs: 900,
    hitDelayMs: 500,
    damageFallback: 31,
    telegraphEvent: 'allied-spider-attack-telegraph',
    telegraphIdKey: 'spiderId',
    damageType: 'allied_spider_melee',
    bodyRadius: 0.55,
    hpRegenAmount: 15,
    hpRegenIntervalMs: 5000,
    showRegenHealNumber: false,
  },
});

function getAlliedBeastConfig(enemyType) {
  return ALLIED_BEAST_CONFIGS[enemyType] || null;
}

/** Eternity pet upgrades — keep in sync with src/utils/petCompanionUpgrades.ts / gameRoom.js */
const PET_UPGRADE_SIEGEBREAKER_TAUNT_RANGE = 8;
const PET_UPGRADE_SIEGEBREAKER_TAUNT_CD_MS = 6000;
const PET_UPGRADE_SIEGEBREAKER_TAUNT_DURATION_MS = 6000;
const PET_UPGRADE_APEX_KILLER_CRIT_CHANCE = 0.2;
const PET_UPGRADE_APEX_KILLER_CRIT_MULT = 2;
/** Hunter's Mark pendant — flat melee bonus for owner's beast companions. */
const HUNTERS_MARK_BEAST_MELEE_BONUS = 30;
const PET_UPGRADE_ENSNARING_THREADS_DAMAGE = 70;
const PET_UPGRADE_ENSNARING_THREADS_CD_MS = 2500;
const PET_UPGRADE_ENSNARING_THREADS_CAST_MS = 800;
const PET_UPGRADE_ENSNARING_THREADS_RANGE = 12;
const PET_UPGRADE_ENSNARING_THREADS_SPEED = 11;
const PET_UPGRADE_ENSNARING_THREADS_HIT_RADIUS = 0.9;
const ALLIED_DEMON_LEAP_DAMAGE = 56;
const ALLIED_DEMON_LEAP_STUN_MS = 2000;
const ALLIED_DEMON_LEAP_COOLDOWN_MS = 10_000;
const ALLIED_ENCHANTRESS_ATTACK_RANGE = 14;
const ALLIED_ENCHANTRESS_EARTH_SHOCK_DAMAGE = 105;
const ALLIED_ENCHANTRESS_EARTH_SHOCK_CHARGE_MS = 875;
const ALLIED_ENCHANTRESS_EARTH_SHOCK_COOLDOWN_MS = 6000;
const ALLIED_ENCHANTRESS_GRASPING_VINES_RANGE = 10;
const ALLIED_ENCHANTRESS_GRASPING_VINES_CHARGE_MS = 500;
const ALLIED_ENCHANTRESS_GRASPING_VINES_COOLDOWN_MS = 8500;
const ALLIED_ENCHANTRESS_GRASPING_VINES_MAX_TARGETS = 2;
/** Living players within this range take priority over allied-knight redirects (solo always). */
const PLAYER_PROXIMITY_AGGRO_OVERRIDE_RADIUS = 15;
const AGGRO_DEBUG_SNAPSHOT_DELAY_MS = 2000;
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
// ABYSSAL INITIATE boon constants (keep in sync with src/utils/talents.ts)
const ABYSSAL_INITIATE_HUNTRESS_COOLDOWN_REDUCTION_MS = 250;
const ABYSSAL_INITIATE_DEMON_COOLDOWN_REDUCTION_MS = 300;
const ABYSSAL_INITIATE_ENCHANTRESS_EARTH_SHOCK_COOLDOWN_REDUCTION_MS = 2000;
const ABYSSAL_INITIATE_PHANTOM_COMBO_COOLDOWN_REDUCTION_MS = 1500;
// INFERNAL INITIATE — non-Knight allies (keep in sync with src/utils/talents.ts)
const INFERNAL_INITIATE_HUNTRESS_BASE_DAMAGE = 85;
const INFERNAL_INITIATE_HUNTRESS_DAMAGE_PER_AGILITY = 3;
const INFERNAL_INITIATE_DEMON_BASE_DAMAGE = 64;
const INFERNAL_INITIATE_DEMON_DAMAGE_PER_STAMINA_OR_STRENGTH = 2;
const INFERNAL_INITIATE_ENCHANTRESS_EARTH_SHOCK_BASE_DAMAGE = 125;
const INFERNAL_INITIATE_ENCHANTRESS_EARTH_SHOCK_DAMAGE_PER_INTELLECT = 3;
const INFERNAL_INITIATE_PHANTOM_BASE_DAMAGE = 50;
const INFERNAL_INITIATE_PHANTOM_DAMAGE_PER_AGILITY = 2;
// TEMPEST INITIATE — non-Knight allies (keep in sync with src/utils/talents.ts)
const TEMPEST_INITIATE_DEMON_LEAP_COOLDOWN_MS = 5000;
const TEMPEST_INITIATE_DEMON_LEAP_BASE_DAMAGE = 76;
const TEMPEST_INITIATE_DEMON_LEAP_DAMAGE_PER_AGILITY = 4;
const ALLIED_HUNTRESS_ATTACK_COOLDOWN_MS = 1450;
const ALLIED_DEMON_ATTACK_COOLDOWN_MS = 900;
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
const viperArrowFlightMs = (from, to, maxRange = VIPER_ARROW_MAX_RANGE) => {
  const dx = (to?.x ?? from.x) - from.x;
  const dy = (to?.y ?? from.y) - from.y;
  const dz = (to?.z ?? from.z) - from.z;
  const maxFlightMs = Math.ceil((maxRange / VIPER_ARROW_PROJECTILE_SPEED) * 1000);
  const distance = Math.min(maxRange, Math.hypot(dx, dy, dz));
  return Math.min(maxFlightMs, Math.ceil((distance / VIPER_ARROW_PROJECTILE_SPEED) * 1000));
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
const SHADE_DAGGER_DELAYS_MS = [675, 975, 1225];       // default/purple — 3 daggers
const SHADE_DAGGER_DELAYS_MS_BLUE = [750, 950];         // blue — 2 daggers

// Templar Blink Smite: first cast 15s after aggro, then every 15s; windup 1s then AOE in front of templar
const TEMPLAR_BLINK_SMITE_INTERVAL_MS = 12000;
const TEMPLAR_BLINK_SMITE_CHARGE_MS = 500;
const TEMPLAR_BLINK_SMITE_STRIKE_DELAY_MS = 975;
const TEMPLAR_BLINK_SMITE_IMPACT_OFFSET = 2.75;
const TEMPLAR_BLINK_SMITE_DAMAGE = 75;
const TEMPLAR_BLINK_SMITE_RADIUS = 2.5;
const TEMPLAR_BLINK_SMITE_ABILITY_LOCK_MS = 2500; // no move/melee during windup + post-strike
const TELEPORT_BEHIND_DISTANCE = 2.2; // same as boss blink (templar blink smite; not used by main co-op boss)

// Wraith — stealth flank + buzzsaw cone
const WRAITH_STEALTH_DURATION_MS = 5000;
const WRAITH_STEALTH_COOLDOWN_MS = 5000;
const WRAITH_BUZZSAW_COOLDOWN_MS = 7000;
const WRAITH_BUZZSAW_DURATION_MS = 1024;
const WRAITH_BUZZSAW_DAMAGE = 14;
const WRAITH_BUZZSAW_TICK_MS = 333;
const WRAITH_BUZZSAW_RANGE = 4.0;
const WRAITH_BUZZSAW_HALF_ANGLE_RAD = Math.PI / 6;
const WRAITH_ENGAGE_RANGE = 3.5;
const WRAITH_AGGRO_RADIUS = 18;

// Co-op main boss (GLB): melee + leap + tectonic
const BOSS_MELEE_RANGE = 2.9;
const BOSS_MELEE_COOLDOWN_MS = 2750;
const BOSS_MELEE_DAMAGE = 41;
/** No translation during melee swing (matches knight `SWING_LOCK_MS`). */
const BOSS_MELEE_ATTACK_LOCK_MS = 1200;
/** Windup before melee damage lands (matches `TITAN_HIT_DELAY_MS`). */
const BOSS_MELEE_HIT_DELAY_MS = 875;
/** Leap only once at or below this health fraction (not at full HP). */
const BOSS_LEAP_MAX_HP_PCT = 0.97;
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
const BOSS_LEAP_DAMAGE = 27;
const BOSS_TECTONIC_COOLDOWN_MS = 25000;
const BOSS_TECTONIC_MAX_HP_PCT = 0.75;
const BOSS_TECTONIC_CENTER_DIST = 0.85;
const BOSS_TECTONIC_JUMP_INTERVAL_MS = 900;
const BOSS_TECTONIC_JUMP_COUNT = 10;
const BOSS_TECTONIC_SPIKE_WARN_MS = 750;
// Keep in sync with TECTONIC_HIT_RADIUS in src/components/enemies/BossTectonicSpikeTelegraph.tsx
const BOSS_TECTONIC_SHARD_RADIUS = 2.5;
const BOSS_TECTONIC_SHARD_DAMAGE = 34;
const BOSS_STATIONARY_EPS = 0.03;
const BOSS_TECTONIC_CENTER = { x: 0, y: 0, z: 0 };
// Boss throw-spear ability
const BOSS_THROW_MIN_RANGE     = 3;
const BOSS_THROW_MAX_RANGE     = 18;
const BOSS_THROW_DAMAGE        = 40;
const BOSS_THROW_COOLDOWN_MS   = 10_000;
/** When the spear projectile / `boss-throw-spear` fires during the throw animation. */
const BOSS_THROW_SPEAR_RELEASE_MS = 600;
/** Boss cannot move until this elapses after `boss-throw-start` (full throw clip). */
const BOSS_THROW_MOVE_LOCK_MS = 2_000;
/** Boss 1 cannot use spear throw as an opener. */
const BOSS_THROW_FIGHT_START_DELAY_MS = 6_000;
/** Minimum gap between starting a throw and starting a leap (either order). */
const BOSS_THROW_LEAP_ICD_MS = 2_000;

// Ghoul Leap (unlocked after first boss): mirrors boss leap + player stun (no HP gate)
/** Land near surround ring so leap closes gap without stacking on the target. */
const GHOUL_LEAP_LAND_STANDOFF_M = 1.85;
const GHOUL_LEAP_COOLDOWN_MS = 10_000;
const GHOUL_LEAP_POST_SPAWN_DELAY_MS = 5_000;
const VIPER_ATTACK_POST_SPAWN_DELAY_MS = 1_500;
const GHOUL_LEAP_MAX_TRAVEL = 14;
const GHOUL_LEAP_DURATION_MS = BOSS_LEAP_DURATION_MS;
const GHOUL_LEAP_LANDING_RADIUS = 3.5;
const GHOUL_LEAP_DAMAGE = 25;
const GHOUL_LEAP_STUN_MS = 2250;
/** Minimum gap between enemy ghoul leap starts in the same room (prevents synchronized Delirium spikes). */
const GHOUL_LEAP_ROOM_SLOT_MS = 750;
const GHOUL_BASE_DAMAGE = 29;
const GHOUL_BASE_MOVE_SPEED = 2.5;
const GHOUL_SUMMON_HP = 525;
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
const TEMPLAR_LEAP_LANDING_RADIUS = 2.25;
const TEMPLAR_LEAP_DAMAGE = 60;
/** Snappier than boss leap — tiger should close gap quickly. */
const TIGER_POUNCE_DURATION_MS = 850;

/** Co-op player locomotion (matches client Movement.maxSpeed / dash tuning). */
const PLAYER_COOP_MAX_SPEED = 3.575;
const PLAYER_COOP_SPRINT_MULTIPLIER = 1.5;
const PLAYER_DASH_DISTANCE = 4.125;
const WARPDRIVE_DASH_DISTANCES = [4.125, 5.125, 6.125, 7.125];
/** Keep in sync with `WARLORD_WARPDRIVE_DASH_DISTANCES` in weaponAspects.ts */
const WARLORD_WARPDRIVE_DASH_DISTANCES = [7.125, 8.125, 9.125, 10.125];

function getPlayerDashDistance(player) {
  const purchases = Math.max(0, Math.min(3, Number(player?.merchantWarpdrivePurchases) || 0));
  if (String(player?.weaponAspect || '').toUpperCase() === 'WARLORD') {
    return WARLORD_WARPDRIVE_DASH_DISTANCES[purchases] ?? WARLORD_WARPDRIVE_DASH_DISTANCES[0];
  }
  return WARPDRIVE_DASH_DISTANCES[purchases] ?? PLAYER_DASH_DISTANCE;
}
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
/** Beam origin height above caster — Boss2 uses scaled WarlockModel (1.65×). */
const BOSS2_ARCHON_LIGHTNING_SKY_Y_OFFSET = 3.0;
const BOSS2_BLINK_COOLDOWN_MS = 8_000;
const BOSS2_DEATH_GRASP_CAST_MS = 1_000;
const BOSS2_DEATH_GRASP_TRAVEL_MS = 670;
const BOSS2_DEATH_GRASP_HIT_RADIUS = 1.35;
const BOSS2_DEATH_GRASP_STANDOFF = 1.2;
const BOSS2_DEATH_GRASP_RANGE = 13;
const BOSS2_DEATH_GRASP_ARC_RADIANS = Math.PI / 9;
const BOSS2_FLAME_PILLAR_DAMAGE = 47;
const BOSS2_FLAME_PILLAR_RADIUS = 2.25;
/** Same as WarlockRenderer / CoopGameScene blink slide — pillars erupt after landing. */
const BOSS2_FLAME_PILLAR_BLINK_DELAY_MS = 800;
const BOSS2_FLAME_PILLAR_STAGGER_MS = 250;
const BOSS2_FLAME_PILLAR_FORWARD_1 = 1.82;
const BOSS2_FLAME_PILLAR_FORWARD_2 = 2.42;
const BOSS2_WARLOCK_SUMMON_INTERVAL_MS = 20_000;
const BOSS2_WARLOCK_SUMMON_MAX_LIVING = 3;
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
const BOSS3_GREEN_BEAM_TICK_MS = 333;
const BOSS3_GREEN_BEAM_DPS = 71;
const BOSS3_GREEN_BEAM_RANGE = 18;
/** Model-local cast-heal orb forward offset (matches Boss3GreenBeam.tsx). */
const BOSS3_GREEN_BEAM_START_OFFSET = 2.25;
const BOSS3_OUTER_SCALE = 1.75;
const BOSS3_GREEN_BEAM_WORLD_START_OFFSET = BOSS3_GREEN_BEAM_START_OFFSET * BOSS3_OUTER_SCALE;
const BOSS3_GREEN_BEAM_HALF_WIDTH = 0.52;
/** Radians/sec — slower than default boss snap so players can sidestep the beam. */
const BOSS3_GREEN_BEAM_ROT_SPEED = 1.15;

// Martyr: self-detonation (matches client AOE)
const MARTYR_MELEE_RANGE = 1.4;
const MARTYR_DETONATION_RADIUS = 5.5;
/** Damage to players in blast (clients apply via `martyr-detonation-impact`). */
const MARTYR_DETONATION_PLAYER_DAMAGE = 150;
/** Damage to detonating martyr and other mobs in blast (server-side). */
const MARTYR_DETONATION_ENEMY_DAMAGE = 200;
const MARTYR_DETONATION_DELAY_MS = 2160;
/** Main bosses are not hit by Martyr splash. */
const MARTYR_DETONATION_SPLASH_EXCLUDED_TYPES = new Set(['boss', 'boss2', 'boss3', 'destiny']);

// Tentacle-spine environmental trap (co-op wave)
// AttackUnarmed (ID 16 var 0) ≈ 1666ms; slam at 50%. Death from tentacle_death.glb ≈ 3434ms.
const TENTACLE_SPINE_TRIGGER_R = 7.25;
const TENTACLE_SPINE_LINE_LEN = 10;
const TENTACLE_SPINE_LINE_HALF_W = 0.85;
/** Half of AttackUnarmed clip (1666ms) — slam at strike midpoint */
const TENTACLE_SPINE_WINDUP_MS = 833;
const TENTACLE_SPINE_ATTACK_CLIP_MS = 1666;
const TENTACLE_SPINE_DEATH_CLIP_MS = 3434;
const TENTACLE_SPINE_COOLDOWN_MS = 3250;
const TENTACLE_SPINE_DMG_PLAYER = 40;
const TENTACLE_SPINE_DMG_MOB = 120;
const TENTACLE_SPINE_DMG_ALLIED_KNIGHT = 25;

/** Nemesis cross-faction combat — camp mobs and Nemesis may trade aggro/damage. */
const NEMESIS_CROSS_FACTION_EXCLUDED_PREY = new Set([
  'tentacle-spine', 'training-dummy', 'boss', 'boss2', 'boss3', 'destiny', 'boss-skeleton',
  'greed', 'player-zombie', 'vengeful-spirit', 'nemesis', 'martyr', 'wraith',
]);
const NEMESIS_CROSS_FACTION_EXCLUDED_ATTACKERS = new Set([
  'tentacle-spine', 'training-dummy', 'boss', 'boss2', 'boss3', 'destiny', 'boss-skeleton',
  'greed', 'player-zombie', 'vengeful-spirit', 'nemesis', 'martyr', 'wraith',
]);

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
const WARLOCK_ARCHON_SHOCK_UNLOCK_BOSS_COUNT = 1;
const WARLOCK_ARCHON_SHOCK_COOLDOWN_MS = 7500;
const WARLOCK_ARCHON_SHOCK_WINDUP_MS = 825;
const WARLOCK_ARCHON_SHOCK_DAMAGE = 47;
const WARLOCK_ARCHON_SHOCK_HALF_WIDTH = 1.0;
const WARLOCK_ARCHON_SHOCK_RANGE = 14;
/** Camp warlock beam origin — lower than Boss2 (see BOSS2_ARCHON_LIGHTNING_SKY_Y_OFFSET). */
const WARLOCK_ARCHON_SHOCK_SKY_Y_OFFSET = 1.85;

/** Post-boss-2 unlock: all knight colors gain themed Smite (Red Smite buffed). */
const KNIGHT_SMITE_UNLOCK_BOSS_COUNT = 2;
const KNIGHT_SMITE_COOLDOWN_MS = 7000;
const KNIGHT_SMITE_LOCK_MS = 1200;
const KNIGHT_STORM_LASH_COOLDOWN_MS = 14000;
const KNIGHT_STORM_LASH_RANGE = 6.0;
const KNIGHT_STORM_LASH_DURATION_MS = 4000;
const KNIGHT_STORM_LASH_ZAP_INTERVAL_MS = 750;
const KNIGHT_STORM_LASH_ZAP_DAMAGE = 15;
const KNIGHT_STORM_LASH_HALF_WIDTH = 1.0;
const KNIGHT_STORM_LASH_VFX_SCALE = 0.75;
const KNIGHT_SMITE_IMPACT_DELAY_MS = 900;
const KNIGHT_SMITE_RADIUS_BASE = 2.8;
const KNIGHT_SMITE_RADIUS_POST_BOSS2 = 3.0;
const KNIGHT_SMITE_DAMAGE_PRE_BOSS2 = { red: 48 };
const KNIGHT_SMITE_DAMAGE_POST_BOSS2 = {
  red: 96,
  blue: 82,
  green: 68,
  purple: 72,
};

/** Knight Block — reactive invuln after taking damage; elite Boss1 knights use HP thresholds. */
const KNIGHT_BLOCK_START_MS = 567; // sync with knightCoopAbilitiesConstants.ts (knight_startblock.glb)
const KNIGHT_BLOCK_REACT_WINDOW_MS = 500;
const KNIGHT_BLOCK_DURATION_MS = {
  red: 2000,
  blue: 3000,
  purple: 4000,
  green: 6000,
};
const KNIGHT_BLOCK_COOLDOWN_MS = {
  red: 6000,
  blue: 8000,
  purple: 12000,
  green: 15000,
};
const KNIGHT_ELITE_BLOCK_DURATION_MS = 6750;
const KNIGHT_ELITE_BLOCK_HEALTH_THRESHOLDS = [0.9, 0.5, 0.2];
const KNIGHT_BLOCK_UNLOCK_BOSS_COUNT = 2;
const KNIGHT_DEATH_GRASP_UNLOCK_BOSS_COUNT = 1;

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
const GREED_FLEE_DISTANCE = 7;
const GREED_WANDER_REPICK_MS = 4000;
const GREED_WANDER_REACH = 1.0;
const GREED_RED_RANGE = 8;
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
const GREED_FIREBALL_SPEED = 10;
const GREED_FIREBALL_HIT_RADIUS = 1.025;

class EnemyAI {
  constructor(roomId, io) {
    this.roomId = roomId;
    this.io = io;
    this.room = null; // Will be set by GameRoom
    this.aiTimer = null;
    this._aggroDebugSnapshotTimer = null;
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

    // Wraith stealth + buzzsaw cooldown tracking
    this.wraithStealthCooldown = new Map(); // enemyId -> lastStealthCastMs
    this.wraithBuzzsawCooldown = new Map(); // enemyId -> lastBuzzsawCastMs
    /** @type {Map<string, { stealthEndsAt: number, revealTimeout: ReturnType<typeof setTimeout> | null }>} */
    this.wraithStealthState = new Map();

    this.enemyLastQueuedMove = new Map(); // enemyId -> last { x, y, z, rotation } sent via _queueMove

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
    // Personal tentacle-spine threat: allyId -> trapId -> { lastUpdate }.
    this.alliedTrapThreat = new Map();

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
    /** Room-wide gate: next timestamp an enemy ghoul may begin a leap. */
    this.ghoulLeapRoomSlotUntil = 0;

    this.enchantressEarthShockCooldown = new Map();
    this.enchantressGraspingVinesCooldown = new Map();

    // Knight / Templar / Ghoul melee: timestamp until which the enemy is frozen mid-swing
    // so it cannot move until the swing animation and damage window both resolve.
    this.meleeLockUntil = new Map(); // enemyId -> lockExpiryTimestamp
    /** @type {Map<string, { commitAt: number, lockUntil: number, facingLocked: boolean, targetKind: string, targetId: string|null, profileType: string }>} */
    this.meleeSwingState = new Map();

    // Knight special ability cooldown tracking
    // Each soul type has one unique ability; all share this single cooldown map.
    this.knightAbilityCooldown = new Map(); // enemyId -> lastAbilityTime
    this.knightSmiteCooldown = new Map(); // enemyId -> lastSmiteTime (post-boss-2 blue/green/purple)
    this.knightDashCooldown = new Map(); // enemyId -> lastDashTime
    this.knightSpinCooldown = new Map(); // enemyId -> lastSpinTime

    // Assassin ability cooldowns
    this.assassinSpinCooldown = new Map();
    this.assassinBowCooldown = new Map();
    this.assassinFollowupTimeout = new Map(); // assassinId -> pending triple-shot follow-up timeout
    this.assassinEvadeCooldown = new Map();
    this.assassinDreamshroudCooldown = new Map(); // assassinId -> lastCastMs
    /** @type {Map<string, { stealthEndsAt: number, revealTimeout: ReturnType<typeof setTimeout> | null }>} */
    this.assassinDreamshroudState = new Map();

    // Sunken Temple enemy cooldown tracking
    this.nemesisAttackCooldown = new Map();
    this.valkyrieLunge1Cooldown = new Map();
    this.valkyrieLunge2Cooldown = new Map();
    this.valkyrieJudgmentCooldown = new Map();
    this.sentinelEntangleCooldown = new Map();
    this.sentinelEntangleMoveLockUntil = new Map();
    this.sentinelOrbCooldown = new Map();

    // Eternity Palace heavies
    this.palaceHeavyAttackCooldown = new Map();
    this.eternalOakEarthbreakerCooldown = new Map();
    this.eternalOakEarthbreakerTimeout = new Map();

    // Frost Queen — teleport / ice shards / ice storm
    this.frostQueenTeleportCooldown = new Map();
    this.frostQueenIceShardsCooldown = new Map();
    this.frostQueenIceStormCooldown = new Map();
    this.frostQueenIceStormTimeouts = new Map(); // enemyId -> handle[]
    this.frostQueenIceStormActiveUntil = new Map(); // enemyId -> channel expiry

    // Medusa — rapidfire bolts / VOIDWARP / meteor
    this.medusaRapidfireCooldown = new Map();
    this.medusaVoidWarpCooldown = new Map();
    this.medusaMeteorCooldown = new Map();
    this.medusaVoidWarpActiveUntil = new Map();
    this.medusaProjectileIntervals = new Map(); // medusaId -> Set of interval ids

    // Spectre whirlwind
    this.spectreWhirlwindCooldown = new Map();
    this.spectreWhirlwindEndTimeout = new Map();

    // Death Knight Heartstrike
    this.deathKnightHeartstrikeCooldown = new Map();
    this.deathKnightHeartstrikeEndTimeout = new Map();
    // Death Knight Frost Pillars
    this.deathKnightFrostPillarsCooldown = new Map();
    this.deathKnightFrostPillarsEndTimeout = new Map();
    this.deathKnightFrostPillarTimeouts = new Map(); // deathKnightId -> timeout[]

    // Shaman Storm Shock
    this.shamanStormShockCooldown = new Map();
    this.shamanStormShockEndTimeout = new Map();
    this.shamanStormShockZapTimeout = new Map();
    // Shaman Spirit Wolves
    this.shamanSpiritWolvesCooldown = new Map(); // shamanId -> lastCastMs
    this.shamanSummonedWolves = new Map(); // shamanId -> Set<wolfId>
    this.shamanSpiritWolvesSpawnTimeout = new Map(); // shamanId -> timeout

    // Wyvern Breath Weapon
    this.wyvernBreathCooldown = new Map();
    this.wyvernBreathEndTimeout = new Map();
    /** @type {Map<string, ReturnType<typeof setTimeout>[]>} */
    this.wyvernBreathLaunchTimeout = new Map(); // wyvernId -> scheduled launch handles

    // Destiny Breath Weapon
    this.destinyBreathCooldown = new Map();
    this.destinyBreathEndTimeout = new Map();
    /** @type {Map<string, ReturnType<typeof setTimeout>[]>} */
    this.destinyBreathLaunchTimeout = new Map();
    /** @type {Map<string, ReturnType<typeof setTimeout>[]>} */
    this.destinyFlyAttackLaunchTimeout = new Map();
    this.destinyFlyAttackEndTimeout = new Map();
    this.destinyFlyAttackCooldown = new Map();
    // Destiny ground wing attack (bilateral flame pillars)
    this.destinyWingCooldown = new Map();
    this.destinyWingEndTimeout = new Map();
    /** @type {Map<string, ReturnType<typeof setTimeout>[]>} */
    this.destinyWingPillarTimeouts = new Map();
    /** id -> timestamp when next ground special (breath/wing) may start */
    this.destinyGroundSpecialReadyAt = new Map();

    // Red / Green: Death Grasp (independent 15s CD from knightAbilityCooldown)
    this.knightDeathGraspCooldown = new Map(); // enemyId -> lastCastMs
    /** @type {Map<string, ReturnType<typeof setTimeout>[]>} */
    this.knightDeathGraspTimeouts = new Map(); // enemyId -> cast + travel handles

    // Blue: Storm Lash channeled lightning zaps (timeout handles cleared on death)
    this.knightStormLashTimeouts = new Map(); // enemyId -> handle[]
    this.knightStormLashActiveUntil = new Map(); // enemyId -> channel expiry timestamp

    // Knight Block — reactive invuln / elite HP-threshold blocks
    this.knightBlockCooldown = new Map(); // enemyId -> lastBlockTime (regular color-tier)
    this.knightBlockActiveUntil = new Map(); // enemyId -> invuln expiry timestamp
    this.knightBlockStages = new Map(); // enemyId -> { p90, p50, p20 } (elite only)

    // Navigation / pathfinding
    this.navGrid    = null;      // Uint8Array built once on first use
    this.enemyPaths = new Map(); // enemyId -> { waypoints, wpIndex, lastTargetPos }
    /** Per-tick cache — avoids repeated Array.from(getEnemies()) in hot paths. */
    this._tickEnemies = [];
    this._tickPlayers = [];
    this._movesFlushBuffer = [];
    this._meleePeerScratch = [];
    this._cachedAlliedKnightBoons = null;
    this._alliedKnightBoonsCachedAt = 0;
    this._meleePeerGrid = null;
    this._meleePeerBucketPool = [];
    /** All-enemy spatial buckets (aggro/targeting); rebuilt each AI tick. */
    this._enemySpatialGrid = null;
    this._enemySpatialBucketPool = [];
    this._enemySpatialScratch = [];
    /** Monotonic AI tick counter for closest-player cache TTL. */
    this._aiTickId = 0;
    /** enemyId -> { tick, player } — reuse closest-player for a few ticks. */
    this._closestPlayerCache = new Map();
    /** Pooled A* typed arrays (reused across path recomputes). */
    this._astarGScore = null;
    this._astarCameFrom = null;
    this._astarInOpen = null;
    /** Per-cell generation stamp — avoids full .fill(Infinity) each A* search. */
    this._astarVisitGen = null;
    this._astarSearchGen = 0;
    /** Skip repeated full scans once allied knights are combat-active. */
    this.alliedCombatStarted = false;
    /** Per-enemy pending timeout handles cleared on death. */
    this.enemyPendingTimeouts = new Map();
    /** All AI setTimeout handles — cleared on full AI teardown. */
    this._pendingTimeouts = new Set();
    /** Per-enemy hazard tick intervals (ember patches, fireballs, spin damage) cleared on death. */
    this.enemyHazardIntervals = new Map();

    // Templar Blink Smite: timestamp when next cast is allowed (per templar; initialized on first aggro)
    this.templarBlinkSmiteNextAt = new Map();
    this.templarLeapCooldown = new Map();
    this.templarLeapEndAt = new Map();
    this.templarLeapLand = new Map();
    this.templarLeapFrom = new Map();
    this.templarLeapTimeout = new Map();
    this.tigerPounceCooldown = new Map();
    this.tigerPounceEndAt = new Map();
    this.tigerPounceLand = new Map();
    this.tigerPounceFrom = new Map();
    this.tigerPounceTimeout = new Map();
    /** wolf id -> true once howl-start emitted */
    this.wolfHowlEmitted = new Map();
    /** beast id -> true once aggro SFX emitted for current aggro cycle */
    this.beastAggroSfxEmitted = new Set();
    /** bone-spider id -> last ensnaring shot timestamp */
    this.boneSpiderShotCooldown = new Map();

    /** tentacle-spine id -> windup slam setTimeout id */
    this.tentacleSlamTimeouts = new Map();

    /** Pending move updates collected within one AI tick; flushed as a single batch event. */
    this._pendingMoves = new Map(); // enemyId -> { position, rotation }
  }

  setRoom(room) {
    this.room = room;
  }

  _isHexCombatArena() {
    const kind = this.room?.currentCoopRoomKind;
    return kind === 'stat' || kind === 'trial' || kind === 'merchant' || kind === 'eden' || kind === 'false_eden' || kind === 'dream_layer' || kind === 'fae_realm' || kind === 'eternity_palace';
  }

  _hexInnerApothem() {
    if (this.room?.currentCoopRoomKind === 'fae_realm') return FAE_REALM_INNER_APOTHEM;
    // eternity_palace uses HEX_INNER_APOTHEM (same r=18 as HexCombatArena)
    return HEX_INNER_APOTHEM;
  }

  /** Castle / erebus gate / deep sanctum — must match CASTLE_ROOM_HALF_SIZE in mapConstants. */
  _isSmallCircleArena() {
    const kind = this.room?.currentCoopRoomKind;
    return (
      kind === 'erebus_gate' ||
      kind === 'intro' ||
      kind === 'deep_sanctum'
    );
  }

  /** Clamp enemy XZ to the active arena footprint (circle for colored rooms, hex for stat/trial/merchant). */
  clampToArenaXZ(x, z) {
    if (this.room?.currentCoopRoomKind === 'sunken_temple') {
      return clampToPentagonXZ(x, z);
    }
    if (this._isSmallCircleArena()) {
      return clampToCircleXZ(x, z, EREBUS_GATE_INNER_RADIUS);
    }
    if (this._isHexCombatArena()) {
      return clampToMainHexXZ(x, z, this._hexInnerApothem());
    }
    return clampToCircleXZ(x, z);
  }

  _arenaPatrolRadius() {
    if (this._isSmallCircleArena()) {
      return EREBUS_GATE_INNER_RADIUS * TITAN_PATROL_RADIUS_FRAC;
    }
    if (this._isHexCombatArena()) {
      return this._hexInnerApothem() * TITAN_PATROL_RADIUS_FRAC;
    }
    return MAIN_CIRCLE_INNER_RADIUS * TITAN_PATROL_RADIUS_FRAC;
  }

  /** Record a position update to be sent as a batch at end of the current AI tick. Always emits (teleports / force). */
  _queueMove(enemyId, position, rotation) {
    this._pendingMoves.set(enemyId, { position, rotation });
  }

  /** True when pose (and optional locomotion/phase extras) changed enough to network. */
  _enemyMoveExceedsEpsilon(last, position, rotation, extras) {
    if (!last) return true;
    const dx = last.x - position.x;
    const dy = last.y - position.y;
    const dz = last.z - position.z;
    if (dx * dx + dy * dy + dz * dz > ENEMY_MOVE_POS_EPS_SQ) return true;
    if (Math.abs(last.rotation - rotation) > ENEMY_MOVE_ROT_EPS) return true;
    if (extras) {
      if (extras.tigerLocomotion !== undefined && extras.tigerLocomotion !== last.tigerLocomotion) return true;
      if (extras.terrorhawkPhase !== undefined && extras.terrorhawkPhase !== last.terrorhawkPhase) return true;
      if (extras.destinyPhase !== undefined && extras.destinyPhase !== last.destinyPhase) return true;
    }
    return false;
  }

  /** Snapshot extras attached to enemies-moved for epsilon / last-emitted tracking. */
  _enemyMoveExtras(enemy) {
    if (!enemy) return null;
    if ((enemy.type === 'allied-tiger' || enemy.type === 'tiger' || enemy.type === 'boss-tiger'
      || enemy.type === 'allied-wolf' || enemy.type === 'allied-bear'
      || enemy.type === 'allied-serpent' || enemy.type === 'allied-spider')
      && enemy.tigerLocomotion) {
      return { tigerLocomotion: enemy.tigerLocomotion };
    }
    if (enemy.type === 'terrorhawk' && enemy.terrorhawkPhase) {
      return { terrorhawkPhase: enemy.terrorhawkPhase };
    }
    if (enemy.type === 'destiny' && enemy.destinyPhase) {
      return { destinyPhase: enemy.destinyPhase };
    }
    return null;
  }

  /** Skip redundant move batches when position/rotation unchanged (stationary casters / micro-steps). */
  _queueMoveIfChanged(enemyId, position, rotation) {
    const lastQueued = this.enemyLastQueuedMove.get(enemyId);
    const enemy = this.room?.getEnemy?.(enemyId);
    const extras = this._enemyMoveExtras(enemy);
    if (!this._enemyMoveExceedsEpsilon(lastQueued, position, rotation, extras)) {
      return;
    }
    this._queueMove(enemyId, position, rotation);
  }

  /** Emit all queued position updates as a single `enemies-moved` batch event. */
  _flushMoves() {
    if (!this.io || this._pendingMoves.size === 0) return;
    const moves = this._movesFlushBuffer;
    moves.length = 0;
    this._pendingMoves.forEach((m, id) => {
      const enemy = this.room?.getEnemy?.(id);
      const extras = this._enemyMoveExtras(enemy);
      const lastEmitted = this.enemyLastQueuedMove.get(id);
      // Delta filter (also covers force-_queueMove spam with unchanged pose).
      if (!this._enemyMoveExceedsEpsilon(lastEmitted, m.position, m.rotation, extras)) {
        return;
      }
      const entry = { enemyId: id, position: m.position, rotation: m.rotation };
      if (extras?.tigerLocomotion) entry.tigerLocomotion = extras.tigerLocomotion;
      if (extras?.terrorhawkPhase) entry.terrorhawkPhase = extras.terrorhawkPhase;
      if (extras?.destinyPhase) entry.destinyPhase = extras.destinyPhase;
      moves.push(entry);
      this.enemyLastQueuedMove.set(id, {
        x: m.position.x,
        y: m.position.y,
        z: m.position.z,
        rotation: m.rotation,
        tigerLocomotion: extras?.tigerLocomotion,
        terrorhawkPhase: extras?.terrorhawkPhase,
        destinyPhase: extras?.destinyPhase,
      });
    });
    if (moves.length > 0) {
      this.io.to(this.roomId).emit('enemies-moved', { moves, timestamp: Date.now() });
    }
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
    if (this._aggroDebugSnapshotTimer) {
      clearTimeout(this._aggroDebugSnapshotTimer);
      this._aggroDebugSnapshotTimer = null;
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
    this.knightDeathGraspTimeouts.forEach((timers) => {
      (timers || []).forEach((t) => clearTimeout(t));
    });
    this.knightDeathGraspTimeouts.clear();
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
    this.medusaProjectileIntervals.forEach((set) => set.forEach((iv) => clearInterval(iv)));
    this.medusaProjectileIntervals.clear();
    this.medusaRapidfireCooldown.clear();
    this.medusaVoidWarpCooldown.clear();
    this.medusaMeteorCooldown.clear();
    this.medusaVoidWarpActiveUntil.clear();
    this.warlockArchonShockTimeout.forEach((t) => clearTimeout(t));
    this.warlockArchonShockTimeout.clear();
    this.warlockArchonShockCooldown.clear();
    this.warlockArchonShockLockUntil.clear();
    this.shadeBlinkCooldown.clear();
    this.wraithStealthCooldown.clear();
    this.wraithBuzzsawCooldown.clear();
    for (const state of this.wraithStealthState.values()) {
      if (state?.revealTimeout) clearTimeout(state.revealTimeout);
    }
    this.wraithStealthState.clear();
    this.enemyLastQueuedMove.clear();
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
    this.palaceHeavyAttackCooldown.clear();
    this.eternalOakEarthbreakerCooldown.clear();
    this.eternalOakEarthbreakerTimeout.forEach((t) => clearTimeout(t));
    this.eternalOakEarthbreakerTimeout.clear();
    this.ghoulLeapCooldown.clear();
    this.ghoulLeapEndAt.clear();
    this.ghoulLeapLand.clear();
    this.ghoulLeapFrom.clear();
    this.ghoulLeapTimeout.forEach((t) => clearTimeout(t));
    this.ghoulLeapTimeout.clear();
    this.ghoulLeapRoomSlotUntil = 0;
    this.enchantressEarthShockCooldown.clear();
    this.enchantressGraspingVinesCooldown.clear();
    this.meleeLockUntil.clear();
    this.meleeSwingState.clear();
    this.knightAbilityCooldown.clear();
    this.knightSmiteCooldown.clear();
    this.knightDashCooldown.clear();
    this.knightSpinCooldown.clear();
    this.assassinSpinCooldown.clear();
    this.assassinBowCooldown.clear();
    this.assassinFollowupTimeout.forEach((t) => clearTimeout(t));
    this.assassinFollowupTimeout.clear();
    this.assassinEvadeCooldown.clear();
    this.assassinDreamshroudCooldown.clear();
    for (const state of this.assassinDreamshroudState.values()) {
      if (state?.revealTimeout) clearTimeout(state.revealTimeout);
    }
    this.assassinDreamshroudState.clear();
    if (this.room) this.room.assassinDreamshroudUntil = 0;
    this.knightDeathGraspCooldown.clear();
    this.spectreWhirlwindEndTimeout.forEach((t) => clearTimeout(t));
    this.spectreWhirlwindEndTimeout.clear();
    this.spectreWhirlwindCooldown.clear();
    this.deathKnightHeartstrikeEndTimeout.forEach((t) => clearTimeout(t));
    this.deathKnightHeartstrikeEndTimeout.clear();
    this.deathKnightHeartstrikeCooldown.clear();
    this.deathKnightFrostPillarsEndTimeout.forEach((t) => clearTimeout(t));
    this.deathKnightFrostPillarsEndTimeout.clear();
    this.deathKnightFrostPillarsCooldown.clear();
    this.deathKnightFrostPillarTimeouts.forEach((arr) => {
      for (const t of arr) clearTimeout(t);
    });
    this.deathKnightFrostPillarTimeouts.clear();
    this.shamanStormShockEndTimeout.forEach((t) => clearTimeout(t));
    this.shamanStormShockEndTimeout.clear();
    this.shamanStormShockZapTimeout.forEach((t) => clearTimeout(t));
    this.shamanStormShockZapTimeout.clear();
    this.shamanStormShockCooldown.clear();
    this.shamanSpiritWolvesSpawnTimeout.forEach((t) => clearTimeout(t));
    this.shamanSpiritWolvesSpawnTimeout.clear();
    this.shamanSpiritWolvesCooldown.clear();
    this.shamanSummonedWolves.clear();
    this.wyvernBreathEndTimeout.forEach((t) => clearTimeout(t));
    this.wyvernBreathEndTimeout.clear();
    this.wyvernBreathLaunchTimeout.forEach((handles) => {
      for (const t of handles) clearTimeout(t);
    });
    this.wyvernBreathLaunchTimeout.clear();
    this.wyvernBreathCooldown.clear();
    this.destinyBreathEndTimeout.forEach((t) => clearTimeout(t));
    this.destinyBreathEndTimeout.clear();
    this.destinyBreathLaunchTimeout.forEach((handles) => {
      for (const t of handles) clearTimeout(t);
    });
    this.destinyBreathLaunchTimeout.clear();
    this.destinyBreathCooldown.clear();
    this.destinyFlyAttackEndTimeout.forEach((t) => clearTimeout(t));
    this.destinyFlyAttackEndTimeout.clear();
    this.destinyFlyAttackLaunchTimeout.forEach((handles) => {
      for (const t of handles) clearTimeout(t);
    });
    this.destinyFlyAttackLaunchTimeout.clear();
    this.destinyFlyAttackCooldown.clear();
    this.destinyWingEndTimeout.forEach((t) => clearTimeout(t));
    this.destinyWingEndTimeout.clear();
    this.destinyWingPillarTimeouts.forEach((handles) => {
      for (const t of handles) clearTimeout(t);
    });
    this.destinyWingPillarTimeouts.clear();
    this.destinyWingCooldown.clear();
    this.destinyGroundSpecialReadyAt.clear();
    this.enemyPaths.clear();
    this.templarBlinkSmiteNextAt.clear();
    this.templarLeapCooldown.clear();
    this.templarLeapEndAt.clear();
    this.templarLeapLand.clear();
    this.templarLeapFrom.clear();
    this.templarLeapTimeout.forEach((t) => clearTimeout(t));
    this.templarLeapTimeout.clear();
    this.tigerPounceCooldown.clear();
    this.tigerPounceEndAt.clear();
    this.tigerPounceLand.clear();
    this.tigerPounceFrom.clear();
    this.tigerPounceTimeout.forEach((t) => clearTimeout(t));
    this.tigerPounceTimeout.clear();
    this.wolfHowlEmitted.clear();
    this.beastAggroSfxEmitted.clear();
    this.boneSpiderShotCooldown.clear();
    this.alliedCombatStarted = false;
    for (const pending of this.enemyPendingTimeouts.values()) {
      for (const handle of pending) clearTimeout(handle);
    }
    this.enemyPendingTimeouts.clear();
    for (const handle of this._pendingTimeouts) clearTimeout(handle);
    this._pendingTimeouts.clear();
    this._closestPlayerCache.clear();
    this.enemyHazardIntervals.forEach((set) => set.forEach((iv) => clearInterval(iv)));
    this.enemyHazardIntervals.clear();
  }

  /** Reuse scratch array instead of Array.from(this.room.getEnemies()) each tick. */
  _refreshTickEnemies() {
    const scratch = this._tickEnemies;
    scratch.length = 0;
    const enemyMap = this.room?.enemies;
    if (enemyMap) {
      for (const enemy of enemyMap.values()) {
        scratch.push(enemy);
      }
    }
    return scratch;
  }

  /** Reuse scratch array instead of getPlayers() allocation each tick. */
  _refreshTickPlayers() {
    const scratch = this._tickPlayers;
    scratch.length = 0;
    const playerMap = this.room?.players;
    if (playerMap) {
      for (const player of playerMap.values()) {
        scratch.push(player);
      }
    }
    return scratch;
  }

  updateAI() {
    if (!this.room || !this.room.getGameStarted()) return;
    if (this.room.isCoopCombatTransitionActive && this.room.isCoopCombatTransitionActive()) return;
    // Skip full AI during co-op throne prep (combat arena not yet active).
    if (this.room.gameMode === 'coop' && this.room.combatArenaActive === false) return;

    this._aiTickId = (this._aiTickId + 1) | 0;
    const enemies = this._refreshTickEnemies();
    const players = this._refreshTickPlayers();
    this._meleePeerGrid = this._buildMeleePeerGrid(enemies);
    this._enemySpatialGrid = this._buildEnemySpatialGrid(enemies);
    
    if (enemies.length === 0 || players.length === 0) {
      this._meleePeerGrid = null;
      this._enemySpatialGrid = null;
      if (this.aiTimer) {
        clearInterval(this.aiTimer);
        this.aiTimer = null;
        this._aiPausedForIdle = true;
      }
      return;
    }

    if (this._aiPausedForIdle) {
      this._aiPausedForIdle = false;
      this.startAI();
    }
    
    // Update each enemy's AI
    enemies.forEach(enemy => {
      if (enemy.isDying) return;
      
      this.updateEnemyAI(enemy, players);
    });

    this.tickPalaceHeavyAuras(Date.now());
    this.room?.tickPetCompanionProximityBuffs?.(Date.now());

    // Emit all position updates accumulated during this tick as a single batch
    this._flushMoves();
    this._meleePeerGrid = null;
    this._enemySpatialGrid = null;
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

    if (enemy.type === 'training-dummy' || enemy.throneTestEnemy) return;

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

    if (enemy.type === 'destiny') {
      this.updateDestinyAI(enemy, players);
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

    if (enemy.type === 'spectre') {
      this.updateSpectreAI(enemy, players);
      return;
    }

    if (enemy.type === 'death-knight') {
      this.updateDeathKnightAI(enemy, players);
      return;
    }

    if (enemy.type === 'shaman') {
      this.updateShamanAI(enemy, players);
      return;
    }

    if (enemy.type === 'assassin') {
      this.updateAssassinAI(enemy, players);
      return;
    }

    if (enemy.type === 'serpent' || enemy.type === 'boss-serpent') {
      this.updateSerpentAI(enemy, players);
      return;
    }

    if (enemy.type === 'tiger' || enemy.type === 'boss-tiger') {
      this.updateTigerAI(enemy, players);
      return;
    }

    if (enemy.type === 'wolf' || enemy.type === 'boss-wolf') {
      this.updateWolfAI(enemy, players);
      return;
    }

    if (enemy.type === 'bear' || enemy.type === 'boss-bear') {
      this.updateBearAI(enemy, players);
      return;
    }

    if (enemy.type === 'skyray') {
      this.updateSkyrayAI(enemy, players);
      return;
    }

    if (enemy.type === 'terrorhawk') {
      this.updateTerrorhawkAI(enemy, players);
      return;
    }

    if (enemy.type === 'frost-queen') {
      this.updateFrostQueenAI(enemy, players);
      return;
    }

    if (enemy.type === 'medusa') {
      this.updateMedusaAI(enemy, players);
      return;
    }

    if (enemy.type === 'wyvern') {
      this.updateWyvernAI(enemy, players);
      return;
    }

    if (enemy.type === 'bone-spider') {
      this.updateBoneSpiderAI(enemy, players);
      return;
    }

    if (enemy.type === 'sentinel') {
      this.updateSentinelAI(enemy, players);
      return;
    }

    if (enemy.type === 'nemesis') {
      this.updateNemesisAI(enemy, players);
      return;
    }

    if (PALACE_HEAVY_TYPES.has(enemy.type)) {
      this.updatePalaceHeavyAI(enemy, players);
      return;
    }

    if (enemy.type === 'valkyrie') {
      this.updateValkyrieAI(enemy, players);
      return;
    }

    if (enemy.type === 'allied-knight') {
      this.updateAlliedKnightAI(enemy, players);
      return;
    }

    if (enemy.type === 'allied-huntress') {
      this.updateAlliedHuntressAI(enemy, players);
      return;
    }

    if (enemy.type === 'allied-phantom') {
      this.updateAlliedPhantomAI(enemy, players);
      return;
    }

    if (enemy.type === 'allied-demon') {
      this.updateAlliedDemonAI(enemy, players);
      return;
    }

    if (enemy.type === 'allied-tiger'
      || enemy.type === 'allied-wolf'
      || enemy.type === 'allied-bear'
      || enemy.type === 'allied-serpent'
      || enemy.type === 'allied-spider') {
      this.updateAlliedBeastAI(enemy, players);
      return;
    }

    if (enemy.type === 'allied-enchantress') {
      this.updateAlliedEnchantressAI(enemy, players);
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

    // Necromancer Vengeful Spirits (stationary Crossentropy summons)
    if (enemy.type === 'vengeful-spirit') {
      this.updateVengefulSpiritAI(enemy, players);
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

    if (enemy.type === 'wraith') {
      this.updateWraithAI(enemy, players);
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
          const sid = skeleton.id;
          this._scheduleEnemyTimeout(sid, () => {
            if (skeleton.isDying || !this.room?.getGameStarted()) return;
            if (this.room?.isEnemyAffectedBy(sid, 'stun')) return;
            const currentPlayers = this.room?.getPlayers();
            if (!currentPlayers) return;
            const currentTarget = currentPlayers.find(p => p.id === pid);
            if (!currentTarget || currentTarget.health <= 0) return;
            const currentDistance = this.calculateDistance(skeleton.position, currentTarget.position);
            if (currentDistance <= attackRange) {
              this.bossSkeletonAttackPlayer(skeleton, currentTarget);
            } else {
              _enemyAiLog(`💀 Skeleton ${sid} attack missed - player ${currentTarget.id} dodged out of range!`);
            }
          }, telegraphDelay);
        } else if (resolved.kind === 'zombie') {
          const zid = resolved.zombie.id;
          this.telegraphSkeletonAttack(skeleton, {
            id: resolved.zombie.ownerPlayerId || zid,
            combatAllyId: zid,
            position: resolved.zombie.position,
          });
          const telegraphDelay = 250;
          const sid = skeleton.id;
          this._scheduleEnemyTimeout(sid, () => {
            if (skeleton.isDying || !this.room?.getGameStarted()) return;
            if (this.room?.isEnemyAffectedBy(sid, 'stun')) return;
            const z = this.room?.getEnemy(zid);
            if (!z || z.isDying || z.health <= 0) return;
            const currentDistance = this.calculateDistance(skeleton.position, z.position);
            if (currentDistance <= attackRange) {
              const damage = skeleton.damage || 17;
              this.damagePlayerZombieFromMob(skeleton, z, damage, 'boss_skeleton_melee');
            }
          }, telegraphDelay);
        } else if (resolved.kind === 'hostile') {
          const hostile = resolved.enemy;
          this.telegraphSkeletonAttack(skeleton, {
            id: hostile.id,
            position: hostile.position,
          });
          const telegraphDelay = 250;
          const hid = hostile.id;
          const sid = skeleton.id;
          this._scheduleEnemyTimeout(sid, () => {
            if (skeleton.isDying || !this.room?.getGameStarted()) return;
            if (this.room?.isEnemyAffectedBy(sid, 'stun')) return;
            const liveTarget = this.room?.getEnemy(hid);
            if (!liveTarget || liveTarget.isDying || liveTarget.health <= 0) return;
            const currentDistance = this.calculateDistance(skeleton.position, liveTarget.position);
            if (currentDistance <= attackRange) {
              const damage = skeleton.damage || 17;
              this.damageHostileMobFromMob(skeleton, liveTarget, damage, 'boss_skeleton_melee');
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
          const sid = skeleton.id;
          this._scheduleEnemyTimeout(sid, () => {
            if (skeleton.isDying || !this.room?.getGameStarted()) return;
            if (this.room?.isEnemyAffectedBy(sid, 'stun')) return;
            const t = this.room?.getEnemy(trapId);
            if (!t || t.isDying || t.health <= 0 || t.type !== 'tentacle-spine') return;
            const currentDistance = this.calculateDistance(skeleton.position, t.position);
            if (currentDistance <= attackRange) {
              const damage = skeleton.damage || 17;
              this.room.damageEnemy(trapId, damage, null, null, {
                sourceEnemyId: sid,
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


  /**
   * Melee telegraph targeting fields.
   * When swinging at a player combat ally (pet/zombie/knight), emit targetCombatAllyId
   * so clients do not schedule local-player MISS floaters for the owner.
   */
  _meleeTelegraphTargetFields(target) {
    if (target?.combatAllyId) {
      return { targetCombatAllyId: target.combatAllyId };
    }
    return { targetPlayerId: target?.id };
  }

  /** Horizontal XZ distance (ignores Y) — fair for flying / elevated units. */
  calculateHorizontalDistance(pos1, pos2) {
    const dx = (pos1?.x ?? 0) - (pos2?.x ?? 0);
    const dz = (pos1?.z ?? 0) - (pos2?.z ?? 0);
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * True if enemy is facing targetPos within halfArcRad of its forward (+Z locally via atan2(x,z)).
   * Generalizes isBossFacingTarget for all melee weight classes.
   */
  isEnemyFacingTarget(enemy, targetPos, halfArcRad = Math.PI / 3) {
    if (!enemy || !targetPos) return false;
    const dx = targetPos.x - enemy.position.x;
    const dz = targetPos.z - enemy.position.z;
    if (dx === 0 && dz === 0) return true;
    const targetAngle = Math.atan2(dx, dz);
    const enemyAngle = enemy.rotation || 0;
    let angleDiff = targetAngle - enemyAngle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    return Math.abs(angleDiff) <= halfArcRad;
  }

  /**
   * During meleeLockUntil windup: rotate toward the swing target at a reduced rate
   * until commitAt, then hard-lock facing. Call from AI update loops that early-return on lock.
   * @returns {boolean} true if this enemy is mid-swing (caller should not move)
   */
  tickMeleeSwingWindup(enemy, resolvedOrPos) {
    const now = Date.now();
    const lockUntil = this.meleeLockUntil.get(enemy.id) || 0;
    if (now >= lockUntil) {
      this.meleeSwingState.delete(enemy.id);
      return false;
    }

    const state = this.meleeSwingState.get(enemy.id);
    if (!state) return true;

    let targetPos = null;
    if (resolvedOrPos && typeof resolvedOrPos.x === 'number') {
      targetPos = resolvedOrPos;
    } else if (resolvedOrPos) {
      targetPos = this.combatTargetPosition(resolvedOrPos);
    } else if (state.targetId) {
      // Re-resolve from swing state when caller only has the lock (e.g. palace heavy)
      if (state.targetKind === 'player') {
        const p = this.room?.getPlayers?.()?.find((pl) => pl.id === state.targetId);
        if (p) targetPos = p.position;
      } else {
        const e = this.room?.getEnemy?.(state.targetId);
        if (e) targetPos = e.position;
      }
    }

    if (!state.facingLocked && now < state.commitAt && targetPos) {
      // Reduced turn rate during windup so strafing is a real dodge, not free whiffs.
      const dx = targetPos.x - enemy.position.x;
      const dz = targetPos.z - enemy.position.z;
      const magnitude = Math.hypot(dx, dz);
      if (magnitude > 1e-4) {
        const targetRotation = Math.atan2(dx, dz);
        const currentRotation = enemy.rotation || 0;
        let rotationDiff = targetRotation - currentRotation;
        while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
        while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
        const deltaTime = this.updateInterval / 1000;
        const rotationSpeed = 2.2; // ~half of normal chase turn rate
        const rotationStep = rotationDiff * Math.min(1, rotationSpeed * deltaTime);
        enemy.rotation = currentRotation + rotationStep;
        while (enemy.rotation > Math.PI) enemy.rotation -= Math.PI * 2;
        while (enemy.rotation < -Math.PI) enemy.rotation += Math.PI * 2;
        this._queueMoveIfChanged(enemy.id, enemy.position, enemy.rotation);
      }
    } else if (!state.facingLocked && now >= state.commitAt) {
      state.facingLocked = true;
    }

    return true;
  }

  _resolveMeleeTelegraphTarget(resolved) {
    if (!resolved) return null;
    if (resolved.kind === 'player') return resolved.player;
    if (resolved.kind === 'zombie') {
      const z = resolved.zombie;
      return {
        id: z.ownerPlayerId || z.id,
        combatAllyId: z.id,
        position: z.position,
      };
    }
    if (resolved.kind === 'hostile') {
      return { id: resolved.enemy.id, position: resolved.enemy.position };
    }
    if (resolved.kind === 'trap') {
      return { id: resolved.trap.id, position: resolved.trap.position };
    }
    return null;
  }

  _getMeleeCooldownMap(profile) {
    const key = profile.cooldownMapKey || 'bossAttackCooldown';
    if (!this[key]) {
      this[key] = new Map();
    }
    return this[key];
  }

  emitMeleeTelegraph(enemy, telegraphTarget, profile, extras = {}) {
    if (!this.io || !profile) return;
    const commitAtMs = getMeleeCommitAtMs(profile);
    const payload = {
      [profile.idField]: enemy.id,
      ...this._meleeTelegraphTargetFields(telegraphTarget),
      position: {
        x: enemy.position.x,
        y: enemy.position.y,
        z: enemy.position.z,
      },
      facing: enemy.rotation || 0,
      hitDelayMs: profile.hitDelayMs,
      swingLockMs: profile.swingLockMs,
      attackRange: profile.range,
      arcDeg: profile.arcDeg,
      commitAtMs,
      weightClass: profile.weightClass,
      timestamp: Date.now(),
    };
    if (extras.attackVariant != null) payload.attackVariant = extras.attackVariant;
    if (extras.meleeIndex != null) payload.meleeIndex = extras.meleeIndex;
    this.io.to(this.roomId).emit(`${profile.eventPrefix}-attack-telegraph`, payload);
  }

  emitMeleeHit(enemy, player, profile, extras = {}) {
    if (!this.io || !profile || !player) return;
    const damage = extras.damage ?? enemy.damage ?? profile.baseDamage ?? 20;
    const dx = player.position.x - enemy.position.x;
    const dz = player.position.z - enemy.position.z;
    const len = Math.hypot(dx, dz) || 1;
    const impactDirection = { x: dx / len, y: 0, z: dz / len };

    const payload = {
      [profile.idField]: enemy.id,
      targetPlayerId: player.id,
      damage,
      position: {
        x: enemy.position.x,
        y: enemy.position.y,
        z: enemy.position.z,
      },
      impactDirection,
      knockback: profile.knockback || null,
      hitStopMs: profile.hitStopMs || 0,
      weightClass: profile.weightClass,
      timestamp: Date.now(),
    };
    if (extras.attackVariant != null) payload.attackVariant = extras.attackVariant;
    if (extras.meleeIndex != null) payload.meleeIndex = extras.meleeIndex;

    this.io.to(this.roomId).emit(`${profile.eventPrefix}-attack`, payload);

    if (profile.knockback && profile.knockback.distance > 0) {
      this.io.to(this.roomId).emit('player-knockback', {
        targetPlayerId: player.id,
        direction: impactDirection,
        distance: profile.knockback.distance,
        duration: profile.knockback.duration ?? 0.35,
        coopRoomEntryToken: this.room?.getCoopRoomEntryToken?.() ?? 0,
        timestamp: Date.now(),
      });
    }
  }

  emitMeleeWhiff(enemy, telegraphTarget, profile, extras = {}) {
    if (!this.io || !profile) return;
    const payload = {
      [profile.idField]: enemy.id,
      ...this._meleeTelegraphTargetFields(telegraphTarget),
      position: {
        x: enemy.position.x,
        y: enemy.position.y,
        z: enemy.position.z,
      },
      facing: enemy.rotation || 0,
      weightClass: profile.weightClass,
      timestamp: Date.now(),
    };
    if (extras.attackVariant != null) payload.attackVariant = extras.attackVariant;
    if (extras.meleeIndex != null) payload.meleeIndex = extras.meleeIndex;
    this.io.to(this.roomId).emit(`${profile.eventPrefix}-attack-whiff`, payload);
  }

  scheduleMeleeLunge(enemy, focusPos, profile) {
    const lunge = profile?.lunge;
    if (!lunge || !(lunge.distance > 0)) return;
    const atMs = lunge.atMs ?? 400;
    const focusPosition = {
      x: focusPos.x,
      y: focusPos.y ?? 0,
      z: focusPos.z,
    };
    const minStandoff = profile.range * 0.75;

    this._scheduleTimeout(() => {
      if (enemy.isDying || !this.room?.getGameStarted()) return;
      if (this.room?.isEnemyAffectedBy(enemy.id, 'stun')) return;

      const dx = focusPosition.x - enemy.position.x;
      const dz = focusPosition.z - enemy.position.z;
      const mag = Math.sqrt(dx * dx + dz * dz);
      if (mag < 1e-4) return;

      const baseSpeed = enemy.moveSpeed ?? this.getEnemyMoveSpeed(enemy.type);
      const moveSpeed = this.room?.isEnemyAffectedBy(enemy.id, 'freeze')
        ? baseSpeed
        : this.getModifiedMovementSpeed(enemy.id, baseSpeed);
      if (moveSpeed === 0) return;

      const maxStep = Math.min(
        lunge.distance,
        moveSpeed * (atMs / 1000),
        Math.max(0, mag - minStandoff),
      );
      if (maxStep <= 0) return;

      const dirX = dx / mag;
      const dirZ = dz / mag;
      const rawX = enemy.position.x + dirX * maxStep;
      const rawZ = enemy.position.z + dirZ * maxStep;

      let resolved = this.resolveEnemyWallCollisions(rawX, rawZ);
      resolved = this.resolveMeleePeerSeparation(enemy, resolved.x, resolved.z);

      enemy.position.x = resolved.x;
      enemy.position.z = resolved.z;
      // Don't override facing after commit — only update if still tracking
      const state = this.meleeSwingState.get(enemy.id);
      if (!state?.facingLocked) {
        enemy.rotation = Math.atan2(dirX, dirZ);
      }

      if (this.io) {
        this._queueMove(enemy.id, enemy.position, enemy.rotation);
      }
    }, atMs);
  }

  /**
   * Shared melee swing: cooldown + lock + telegraph + windup tracking + delayed hit with arc check.
   * Handles player / zombie / hostile / trap target kinds from resolveAggroCombatTarget.
   * @returns {boolean} true if a swing was started
   */
  performMeleeSwing(enemy, resolved, profile, options = {}) {
    if (!enemy || !resolved || !profile) return false;
    if (enemy.isDying || !this.room?.getGameStarted()) return false;

    const now = options.now ?? Date.now();
    const cooldownMap = this._getMeleeCooldownMap(profile);
    const cooldownMs = enemy.attackCooldown ?? profile.cooldownMs;
    if (!cooldownMap.has(enemy.id)) cooldownMap.set(enemy.id, 0);
    const lastAttackTime = cooldownMap.get(enemy.id) || 0;
    if (now - lastAttackTime < cooldownMs) return false;

    const telegraphTarget = this._resolveMeleeTelegraphTarget(resolved);
    if (!telegraphTarget) return false;

    const halfArc = getMeleeHalfArcRad(profile);
    const startPos = this.combatTargetPosition(resolved);
    if (profile.requireFacingToStart && startPos) {
      if (!this.isEnemyFacingTarget(enemy, startPos, halfArc)) {
        // Still rotate toward target so next tick can fire
        this._smoothRotateEnemyTowardPoint(enemy, startPos);
        this._queueMoveIfChanged(enemy.id, enemy.position, enemy.rotation);
        return false;
      }
    }

    cooldownMap.set(enemy.id, now);
    this.meleeLockUntil.set(enemy.id, now + profile.swingLockMs);

    const commitAt = now + getMeleeCommitAtMs(profile);
    let targetKind = resolved.kind;
    let targetId = null;
    if (resolved.kind === 'player') targetId = resolved.player.id;
    else if (resolved.kind === 'zombie') targetId = resolved.zombie.id;
    else if (resolved.kind === 'hostile') targetId = resolved.enemy.id;
    else if (resolved.kind === 'trap') targetId = resolved.trap.id;

    this.meleeSwingState.set(enemy.id, {
      commitAt,
      lockUntil: now + profile.swingLockMs,
      facingLocked: false,
      targetKind,
      targetId,
      profileType: profile.type,
    });

    let attackVariant = null;
    let meleeIndex = null;
    if (profile.useMeleeIndex) {
      const idx = this.bossMeleePatternIndex.get(enemy.id) || 0;
      meleeIndex = idx % 2;
      this.bossMeleePatternIndex.set(enemy.id, idx + 1);
    } else if (profile.variants >= 2) {
      attackVariant = enemy.attackVariant === 2 ? 2 : 1;
      enemy.attackVariant = attackVariant === 1 ? 2 : 1;
    }

    if (enemy.type === 'boss') {
      enemy.bossStationary = true;
    }

    this.emitMeleeTelegraph(enemy, telegraphTarget, profile, { attackVariant, meleeIndex });
    if (startPos) {
      this.scheduleMeleeLunge(enemy, startPos, profile);
    }

    const enemyId = enemy.id;
    const hitDelay = profile.hitDelayMs;
    this._scheduleTimeout(() => {
      this._resolveMeleeSwingHit(enemyId, profile, {
        targetKind,
        targetId,
        attackVariant,
        meleeIndex,
        telegraphTargetSnapshot: telegraphTarget,
      });
    }, hitDelay);

    return true;
  }

  _resolveMeleeSwingHit(enemyId, profile, ctx) {
    if (!this.room?.getGameStarted()) return;
    const liveEnemy = this.room?.enemies?.get(enemyId) || this.room?.getEnemy?.(enemyId);
    if (!liveEnemy || liveEnemy.isDying || (liveEnemy.health != null && liveEnemy.health <= 0)) return;
    if (this.room?.isEnemyAffectedBy(enemyId, 'stun')) return;

    const halfArc = getMeleeHalfArcRad(profile);
    const bodyR = this.getMeleeBodyRadius(liveEnemy.type) * 0.15; // small forgiveness vs pure range
    const hitRange = profile.range + bodyR;

    const whiff = (targetPos) => {
      this.emitMeleeWhiff(liveEnemy, ctx.telegraphTargetSnapshot, profile, {
        attackVariant: ctx.attackVariant,
        meleeIndex: ctx.meleeIndex,
      });
    };

    const inArcAndRange = (targetPos) => {
      const dist = this.calculateHorizontalDistance(liveEnemy.position, targetPos);
      if (dist > hitRange) return false;
      return this.isEnemyFacingTarget(liveEnemy, targetPos, halfArc);
    };

    if (profile.aoeSwing) {
      this._resolveMeleeAoeSwingHit(liveEnemy, profile, ctx, { inArcAndRange, whiff });
      return;
    }

    if (ctx.targetKind === 'player') {
      const currentPlayers = this.room?.getPlayers();
      if (!currentPlayers) return;
      const currentTarget = currentPlayers.find((p) => p.id === ctx.targetId);
      if (!currentTarget || currentTarget.health <= 0) return;
      if (!inArcAndRange(currentTarget.position)) {
        whiff();
        return;
      }
      this._applyMeleePlayerHit(liveEnemy, currentTarget, profile, ctx);
      return;
    }

    if (ctx.targetKind === 'zombie') {
      const liveZ = this.room?.getEnemy(ctx.targetId);
      if (!liveZ || liveZ.isDying || liveZ.health <= 0) return;
      if (!inArcAndRange(liveZ.position)) {
        whiff();
        return;
      }
      const damage = liveEnemy.damage || profile.baseDamage;
      this.damagePlayerZombieFromMob(liveEnemy, liveZ, damage, profile.damageType);
      if (profile.emitBeastHitSfx) this.maybeEmitBeastMeleeHitSfx(liveEnemy);
      return;
    }

    if (ctx.targetKind === 'hostile') {
      const liveTarget = this.room?.getEnemy(ctx.targetId);
      if (!liveTarget || liveTarget.isDying || liveTarget.health <= 0) return;
      if (!inArcAndRange(liveTarget.position)) {
        whiff();
        return;
      }
      const damage = liveEnemy.damage || profile.baseDamage;
      this.damageHostileMobFromMob(liveEnemy, liveTarget, damage, profile.damageType);
      if (profile.emitBeastHitSfx) this.maybeEmitBeastMeleeHitSfx(liveEnemy);
      return;
    }

    if (ctx.targetKind === 'trap') {
      const liveT = this.room?.getEnemy(ctx.targetId);
      if (!liveT || liveT.isDying || liveT.health <= 0 || liveT.type !== 'tentacle-spine') return;
      if (!inArcAndRange(liveT.position)) {
        whiff();
        return;
      }
      const damage = liveEnemy.damage || profile.baseDamage;
      this.room.damageEnemy(ctx.targetId, damage, null, null, {
        sourceEnemyId: liveEnemy.id,
        damageType: profile.damageType,
      });
      if (profile.emitBeastHitSfx) this.maybeEmitBeastMeleeHitSfx(liveEnemy);
    }
  }

  /**
   * Giant / Destiny melee: damage every opposing combatant inside the
   * attack-range indicator arc (coop players, summoned zombies, vengeful
   * spirits, allied knight, spirit-animal companions). Hostile camp mobs
   * and tentacle-spine traps are only cleaved when that was the swing's
   * telegraph target kind (Nemesis duels / trap swings).
   */
  _resolveMeleeAoeSwingHit(liveEnemy, profile, ctx, { inArcAndRange, whiff }) {
    const damage = liveEnemy.damage || profile.baseDamage;
    const telegraphId = ctx.targetId;
    let telegraphHit = false;

    const players = this.room?.getPlayers?.() || [];
    for (const player of players) {
      if (!player || player.health <= 0) continue;
      if (this._isTargetAirborne(player)) continue;
      if (!inArcAndRange(player.position)) continue;
      this._applyMeleePlayerHit(liveEnemy, player, profile, {
        ...ctx,
        skipAlliedSplash: true,
      });
      if (player.id === telegraphId) telegraphHit = true;
    }

    const enemies = this.room?.getEnemies?.() || [];
    for (const other of enemies) {
      if (!other || other.id === liveEnemy.id) continue;
      if (other.isDying || (other.health != null && other.health <= 0)) continue;
      if (!inArcAndRange(other.position)) continue;

      if (this.isFriendlyCombatUnit(other)) {
        this.damagePlayerZombieFromMob(liveEnemy, other, damage, profile.damageType);
        if (other.id === telegraphId) telegraphHit = true;
        continue;
      }

      if (ctx.targetKind === 'hostile' && this.isValidHostileEnemyAggroTarget(liveEnemy, other)) {
        this.damageHostileMobFromMob(liveEnemy, other, damage, profile.damageType);
        if (other.id === telegraphId) telegraphHit = true;
        continue;
      }

      if (ctx.targetKind === 'trap' && other.type === 'tentacle-spine') {
        this.room.damageEnemy(other.id, damage, null, null, {
          sourceEnemyId: liveEnemy.id,
          damageType: profile.damageType,
        });
        if (other.id === telegraphId) telegraphHit = true;
      }
    }

    if (profile.emitBeastHitSfx) this.maybeEmitBeastMeleeHitSfx(liveEnemy);
    if (!telegraphHit) whiff();
  }

  _applyMeleePlayerHit(enemy, player, profile, ctx = {}) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    const damage = enemy.damage || profile.baseDamage;
    this.recordAlliedProtectionThreat(enemy.id, player.id, damage);
    this.emitMeleeHit(enemy, player, profile, {
      damage,
      attackVariant: ctx.attackVariant,
      meleeIndex: ctx.meleeIndex,
    });
    if (profile.emitBeastHitSfx) this.maybeEmitBeastMeleeHitSfx(enemy);
    if (!ctx.skipAlliedSplash) {
      this.room?.tryDamageAlliedKnightInXZDisk(
        { x: enemy.position.x, z: enemy.position.z },
        profile.alliedDiskRadius ?? profile.range,
        damage,
        { sourceEnemyId: enemy.id, damageType: profile.damageType },
      );
    }
  }

  /**
   * In-range attempt to swing; otherwise chase. Collapses the duplicated
   * player/zombie/hostile/trap engage blocks used by melee AI updates.
   * @returns {'swung'|'press'|'chase'|'idle'}
   */
  /** True when an entity's Y is high enough that ground melee cannot engage it. */
  _isTargetAirborne(entity) {
    return (entity?.position?.y ?? 0) > AIRBORNE_UNTARGETABLE_Y;
  }

  tryMeleeEngage(enemy, resolved, moveTarget, profile, options = {}) {
    if (!enemy || !resolved || !profile) return 'idle';
    const tpos = this.combatTargetPosition(resolved);
    // Skyfall / elevated players: hold idle (face target) instead of jitter-chasing underneath.
    if (resolved.kind === 'player' && this._isTargetAirborne(resolved.player)) {
      this._smoothRotateEnemyTowardPoint(enemy, tpos);
      this._queueMoveIfChanged(enemy.id, enemy.position, enemy.rotation);
      return 'idle';
    }
    const distance = options.distance ?? this.calculateHorizontalDistance(enemy.position, tpos);
    const attackRange = profile.range;
    const meleePressDistance = attackRange - (SHARED_MELEE_CLOSE_INSET || MELEE_CLOSE_INSET);
    const moveOpts = {
      meleeSurroundAttackRange: attackRange,
      ...(options.moveOptions || {}),
    };

    if (distance <= attackRange) {
      const swung = this.performMeleeSwing(enemy, resolved, profile, options);
      if (swung) return 'swung';
      if (distance > meleePressDistance) {
        this.moveEnemyTowardsTarget(enemy, moveTarget, moveOpts);
        return 'press';
      }
      // On cooldown and deep inside range: keep facing the target
      this._smoothRotateEnemyTowardPoint(enemy, tpos);
      this._queueMoveIfChanged(enemy.id, enemy.position, enemy.rotation);
      return 'idle';
    }

    this.moveEnemyTowardsTarget(enemy, moveTarget, moveOpts);
    return 'chase';
  }

  telegraphSkeletonAttack(skeleton, player) {
    // Broadcast the telegraph to all players so the attack animation starts
    if (this.io) {
      this.io.to(this.roomId).emit('boss-skeleton-attack-telegraph', {
        skeletonId: skeleton.id,
        ...this._meleeTelegraphTargetFields(player),
        position: skeleton.position,
        timestamp: Date.now()
      });
    }

    _enemyAiLog(`💀 Boss skeleton ${skeleton.id} telegraphing attack at player ${player.id}!`);
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

    _enemyAiLog(`💀 Boss skeleton ${skeleton.id} attacked player ${player.id} for ${damage} damage!`);
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
    const losOk = this.hasLineOfSight(knight.position, tpos);
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
    if (now < lockUntil) {
      const shouldTrackFacing =
        this.isKnightBlocking(knight.id) ||
        this.isKnightStormLashing(knight.id);

      if (shouldTrackFacing) {
        const tpos = this.combatTargetPosition(resolved);
        this._smoothRotateEnemyTowardPoint(knight, tpos);
        this._queueMoveIfChanged(knight.id, knight.position, knight.rotation);
      } else {
        this.tickMeleeSwingWindup(knight, resolved);
      }
      return;
    }

    if (this.tryKnightBlock(knight, now)) return;

    const knightProfile = getMeleeProfile('knight');

    if (resolved.kind === 'player') {
      const targetPlayer = resolved.player;
      if (this.tryKnightSpinAttack(knight, targetPlayer, now, distance)) return;
      if (this.tryKnightDash(knight, targetPlayer, now, distance)) return;

      const deathGraspFired = this.tryKnightDeathGrasp(knight, targetPlayer, now, distance);
      if (deathGraspFired) return;

      if (this.tryKnightSmiteUnlocked(knight, targetPlayer, now, distance, attackRange)) return;

      const abilityFired = this.tryKnightAbility(knight, targetPlayer, now, distance, attackRange);
      if (abilityFired) return;

      this.tryMeleeEngage(knight, resolved, moveTarget, knightProfile, { now, distance });
    } else if (resolved.kind === 'zombie') {
      const z = resolved.zombie;
      const fakeTarget = { id: z.ownerPlayerId || z.id, combatAllyId: z.id, position: z.position, health: z.health };
      if (this.tryKnightSpinAttack(knight, fakeTarget, now, distance)) return;
      if (this.tryKnightDash(knight, fakeTarget, now, distance)) return;

      if (z.type !== 'allied-knight') {
        const deathGraspFired = this.tryKnightDeathGrasp(knight, fakeTarget, now, distance);
        if (deathGraspFired) return;
      }

      if (this.tryKnightSmiteUnlocked(knight, fakeTarget, now, distance, attackRange)) return;

      const abilityFired = this.tryKnightAbility(knight, fakeTarget, now, distance, attackRange);
      if (abilityFired) return;

      this.tryMeleeEngage(knight, resolved, moveTarget, knightProfile, {
        now,
        distance,
        moveOptions: { combatTargetId: z.id },
      });
    } else if (resolved.kind === 'hostile') {
      const hostile = resolved.enemy;
      const fakeTarget = this.fakeTargetFromEnemy(hostile);
      if (this.tryKnightDash(knight, fakeTarget, now, distance)) return;

      const deathGraspFired = this.tryKnightDeathGrasp(knight, fakeTarget, now, distance);
      if (deathGraspFired) return;

      if (this.tryKnightSmiteUnlocked(knight, fakeTarget, now, distance, attackRange)) return;

      const abilityFired = this.tryKnightAbility(knight, fakeTarget, now, distance, attackRange);
      if (abilityFired) return;

      this.tryMeleeEngage(knight, resolved, moveTarget, knightProfile, {
        now,
        distance,
        moveOptions: { combatTargetId: hostile.id },
      });
    } else if (resolved.kind === 'trap') {
      const tr = resolved.trap;
      const fakeTarget = { id: tr.id, position: tr.position };
      if (this.tryKnightDash(knight, fakeTarget, now, distance)) return;

      this.tryMeleeEngage(knight, resolved, moveTarget, knightProfile, { now, distance });
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
    if (!targetPlayer?.position) return false;
    const liveAlly = this.room?.getEnemy?.(targetPlayer.id);
    const isCombatAllyTarget = this._isPlayerCombatAlly(liveAlly);
    const targetAlive = (targetPlayer.health ?? 0) > 0
      || (isCombatAllyTarget && !liveAlly.isDying && liveAlly.health > 0);
    if (!targetAlive) return false;
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
    const kid = knight.id;
    this._scheduleEnemyTimeout(kid, () => {
      if (knight.isDying || !this.room?.getGameStarted()) return;
      if (this.room?.isEnemyAffectedBy(kid, 'stun')) return;
      if (this.room?.isEnemyAffectedBy(kid, 'freeze')) return;

      const currentPlayers = this.room?.getPlayers?.() || [];
      const liveTarget = currentPlayers.find(p => p.id === originalTargetId && p.health > 0);
      const liveAllyTarget = !liveTarget ? this.room?.getEnemy?.(originalTargetId) : null;
      const aimPosition = liveTarget?.position
        || (this._isPlayerCombatAlly(liveAllyTarget) && !liveAllyTarget.isDying && liveAllyTarget.health > 0
          ? liveAllyTarget.position
          : originalAim);
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
          knightId: kid,
          targetPlayerId: originalTargetId,
          startPosition,
          endPosition,
          rotation: knight.rotation,
          distance: moved,
          durationMs: KNIGHT_SPIN_TRAVEL_MS,
          damage: KNIGHT_SPIN_DAMAGE,
          timestamp: Date.now(),
        });
        this._queueMove(kid, knight.position, knight.rotation);
      }

      this.scheduleKnightSpinPathDamage(knight, startPosition, endPosition);
    }, KNIGHT_SPIN_CHARGE_MS);

    return true;
  }

  scheduleKnightSpinPathDamage(knight, startPosition, endPosition) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;

    const hitPlayerIds = new Set();
    const hitAllyIds = new Set();
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

      this.damageAlliedUnitsAlongSpinStrip(
        sx,
        sz,
        segX,
        segZ,
        KNIGHT_SPIN_STRIP_HALF_WIDTH,
        KNIGHT_SPIN_DAMAGE,
        { sourceEnemyId: knight.id, damageType: 'knight_spin' },
        hitAllyIds,
      );

      return true;
    };

    const kid = knight.id;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(1, elapsed / KNIGHT_SPIN_TRAVEL_MS);
      const shouldContinue = applyHitsForProgress(progress);
      if (!shouldContinue || progress >= 1) {
        clearInterval(interval);
        this._removeEnemyHazardInterval(kid, interval);
      }
    }, sampleEveryMs);
    this._addEnemyHazardInterval(kid, interval);
  }

  scheduleKnightMeleeWindupStep(knight, attackFocus) {
    if (!attackFocus) return;

    const focusPosition = {
      x: attackFocus.x,
      y: attackFocus.y ?? 0,
      z: attackFocus.z,
    };
    // Hostile and allied knights both use 2.6 melee range; floor at surround ring.
    const minStandoff = ALLIED_KNIGHT_ATTACK_RANGE * MELEE_SURROUND_STANDOFF_FRAC;

    this._scheduleTimeout(() => {
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
        Math.max(0, mag - minStandoff),
      );
      if (maxStep <= 0) return;

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

  scheduleBossMeleeWindupStep(boss, targetPlayer) {
    if (!targetPlayer) return;

    const focusPosition = {
      x: targetPlayer.position.x,
      y: targetPlayer.position.y ?? 0,
      z: targetPlayer.position.z,
    };

    this._scheduleTimeout(() => {
      if (boss.isDying || !this.room?.getGameStarted()) return;
      if (this.room?.isEnemyAffectedBy(boss.id, 'stun')) return;

      const dx = focusPosition.x - boss.position.x;
      const dz = focusPosition.z - boss.position.z;
      const mag = Math.sqrt(dx * dx + dz * dz);
      if (mag < 1e-4) return;

      const baseSpeed = boss.moveSpeed ?? this.getEnemyMoveSpeed(boss.type);
      const moveSpeed = this.getModifiedMovementSpeed(boss.id, baseSpeed);
      if (moveSpeed === 0) return;

      const maxStep = Math.min(
        KNIGHT_MELEE_WINDUP_STEP,
        moveSpeed * (KNIGHT_MELEE_WINDUP_STEP_DELAY_MS / 1000),
        mag,
      );
      const dirX = dx / mag;
      const dirZ = dz / mag;
      const rawX = boss.position.x + dirX * maxStep;
      const rawZ = boss.position.z + dirZ * maxStep;

      const resolved = this.resolveEnemyWallCollisions(rawX, rawZ);

      boss.position.x = resolved.x;
      boss.position.z = resolved.z;
      boss.rotation = Math.atan2(dirX, dirZ);

      if (this.io) {
        this._queueMove(boss.id, boss.position, boss.rotation);
      }
    }, KNIGHT_MELEE_WINDUP_STEP_DELAY_MS);
  }

  telegraphKnightAttack(knight, player) {
    if (this.io) {
      this.io.to(this.roomId).emit('knight-attack-telegraph', {
        knightId: knight.id,
        ...this._meleeTelegraphTargetFields(player),
        position: knight.position,
        timestamp: Date.now()
      });
    }
    _enemyAiLog(`⚔️ Knight ${knight.id} telegraphing attack at player ${player.id}!`);
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

    _enemyAiLog(`⚔️ Knight ${knight.id} attacked player ${player.id} for ${damage} damage!`);

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
    if (
      !knight.isBoss1EliteKnight &&
      (this.room?.coopBossesDefeatedCount ?? 0) < KNIGHT_DEATH_GRASP_UNLOCK_BOSS_COUNT
    ) {
      return false;
    }
    if (this._isCoopPortalPositionWriteBlocked()) return false;

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
    _enemyAiLog(`💀 Knight ${knight.id} (${knight.soulType}) casting Death Grasp at player ${targetPlayer.id}!`);

    const targetId = targetPlayer.id;
    const knightId = knight.id;

    this.clearKnightDeathGraspTimers(knightId);

    const launchTimer = this._scheduleTimeout(() => {
      if (!this.room?.getGameStarted()) {
        this.clearKnightDeathGraspTimers(knightId);
        return;
      }
      const liveKnight = this.room?.getEnemy(knightId);
      if (!liveKnight || liveKnight.isDying) {
        this.clearKnightDeathGraspTimers(knightId);
        return;
      }
      if (this.room?.isEnemyAffectedBy(knightId, 'stun')) {
        this.clearKnightDeathGraspTimers(knightId);
        return;
      }

      const currentPlayers = this.room?.getPlayers();
      if (!currentPlayers) {
        this.clearKnightDeathGraspTimers(knightId);
        return;
      }
      const launchTarget = currentPlayers.find(p => p.id === targetId);
      if (!launchTarget || launchTarget.health <= 0) {
        this.clearKnightDeathGraspTimers(knightId);
        return;
      }

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

      const travelTimer = this._scheduleTimeout(() => {
        this.clearKnightDeathGraspTimers(knightId);
        if (!this.room?.getGameStarted()) return;
        if (this.room?.isEnemyAffectedBy(knightId, 'stun')) return;
        if (this._isCoopPortalPositionWriteBlocked()) return;
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
          _enemyAiLog(`💀 Knight ${knightId} Death Grasp missed — player dodged!`);
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
          { authoritative: true },
        );

        if (this.io) {
          this.io.to(this.roomId).emit('knight-deathgrasp-pull', {
            knightId: knightId,
            targetPlayerId: targetId,
            position: newPosition,
            rotation: rot,
            coopRoomEntryToken: this.room?.getCoopRoomEntryToken?.() ?? 0,
            timestamp: Date.now(),
          });
        }
        _enemyAiLog(`💀 Knight ${knightId} Death Grasp pulled player ${targetId} to standoff!`);
      }, PROJECTILE_TRAVEL_MS);
      this.addKnightDeathGraspTimer(knightId, travelTimer);
    }, CAST_LAUNCH_MS);
    this.addKnightDeathGraspTimer(knightId, launchTimer);
  }

  // ─── Knight Special Abilities ────────────────────────────────────────────────
  // Returns true if an ability was triggered (so the caller can skip basic attack).

  /** Reactive Block — invuln window after recent damage (regular) or HP thresholds (elite). */
  tryKnightBlock(knight, now) {
    if (this.room?.isAlliedUnitEnemy?.(knight)) return false;
    if (this.room?.isEnemyAffectedBy(knight.id, 'stun')) return false;
    if (this.room?.isEnemyAffectedBy(knight.id, 'freeze')) return false;

    if (knight.isBoss1EliteKnight) return this.tryKnightEliteBlock(knight, now);

    const lastDamageAt = knight.lastDamageAt || 0;
    if (now - lastDamageAt > KNIGHT_BLOCK_REACT_WINDOW_MS) return false;
    if ((this.room?.coopBossesDefeatedCount ?? 0) < KNIGHT_BLOCK_UNLOCK_BOSS_COUNT) return false;

    const soulType = knight.soulType || 'red';
    const cooldownMs = KNIGHT_BLOCK_COOLDOWN_MS[soulType] ?? KNIGHT_BLOCK_COOLDOWN_MS.red;
    const durationMs = KNIGHT_BLOCK_DURATION_MS[soulType] ?? KNIGHT_BLOCK_DURATION_MS.red;
    const last = this.knightBlockCooldown.get(knight.id) || 0;
    if (now - last < cooldownMs) return false;

    this.knightBlockCooldown.set(knight.id, now);
    this.knightCastBlock(knight, durationMs);
    return true;
  }

  tryKnightEliteBlock(knight, now) {
    if (!knight.maxHealth) return false;
    let stages = this.knightBlockStages.get(knight.id);
    if (!stages) {
      stages = { p90: false, p50: false, p20: false };
      this.knightBlockStages.set(knight.id, stages);
    }
    const hpFrac = knight.health / knight.maxHealth;
    const [t90, t50, t20] = KNIGHT_ELITE_BLOCK_HEALTH_THRESHOLDS;
    if (!stages.p90 && hpFrac <= t90) {
      stages.p90 = true;
    } else if (!stages.p50 && hpFrac <= t50) {
      stages.p50 = true;
    } else if (!stages.p20 && hpFrac <= t20) {
      stages.p20 = true;
    } else {
      return false;
    }

    this.knightCastBlock(knight, KNIGHT_ELITE_BLOCK_DURATION_MS);
    return true;
  }

  knightCastBlock(knight, durationMs) {
    const now = Date.now();
    const knightId = knight.id;
    this.meleeLockUntil.set(knightId, now + durationMs);
    this.knightBlockActiveUntil.set(knightId, now + durationMs);

    const aggroData = this.enemyAggro.get(knightId);
    if (aggroData) {
      const players = this.room?.getPlayers() || [];
      const resolved = this.resolveAggroCombatTarget(aggroData, knight, players);
      if (resolved) {
        const tpos = this.combatTargetPosition(resolved);
        this._smoothRotateEnemyTowardPoint(knight, tpos, { instant: true });
      }
    }

    this._queueMove(knightId, knight.position, knight.rotation);
    if (this.io) {
      this.io.to(this.roomId).emit('knight-block-telegraph', {
        knightId,
        durationMs,
        startBlockMs: KNIGHT_BLOCK_START_MS,
        timestamp: now,
      });
    }
    _enemyAiLog(`🛡️ Knight ${knightId} (${knight.soulType || 'elite'}) blocking for ${durationMs}ms.`);
  }

  isKnightBlocking(enemyId) {
    const until = this.knightBlockActiveUntil.get(enemyId);
    return !!until && Date.now() < until;
  }

  isKnightStormLashing(enemyId) {
    const until = this.knightStormLashActiveUntil.get(enemyId);
    return !!until && Date.now() < until;
  }

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
    _enemyAiLog(`⚡ ${soulType} Knight ${knightId} charging Smite at target ${targetId}!`);

    this._scheduleTimeout(() => {
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
          _enemyAiLog(`⚡ ${soulType} Knight ${knightId} SMITE hit player ${currentTarget.id} for ${damage} dmg!`);
        } else {
          _enemyAiLog(`⚡ ${soulType} Knight ${knightId} Smite missed — player dodged!`);
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
    _enemyAiLog(`🟢💚 Knight ${knight.id} (${knight.soulType}) casting Heal!`);

    // Apply the heal at the animation midpoint (~1 200 ms)
    this._scheduleTimeout(() => {
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
      _enemyAiLog(`🟢💚 Knight ${knight.id} healed for ${healed} HP (${prevHp} → ${liveKnight.health})`);
    }, 1200);
  }

  // Blue Knight — Frost Ray (17 dmg + freeze on hit) — now used by Purple Knight
  knightCastFrost(knight, targetPlayer) {
    const FROST_CAST_LAUNCH_MS = 1000; // half of 2 s cast; matches client FROST_DURATION
    const FROST_PROJECTILE_TRAVEL_MS = 550;
    const FROST_HIT_RADIUS = 1.35; // XZ — dash out of this to dodge
    const FROST_RAY_FREEZE_MS = 2000;

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
    _enemyAiLog(`🔵❄️ Knight ${knight.id} (${knight.soulType}) casting Frost Ray at player ${targetPlayer.id}!`);

    const targetId = targetPlayer.id;
    const knightId = knight.id;

    this._scheduleTimeout(() => {
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

      this._scheduleTimeout(() => {
        if (!this.room?.getGameStarted()) return;
        if (this.room?.isEnemyAffectedBy(knightId, 'stun')) return;
        const players = this.room?.getPlayers();
        const currentTarget = players?.find(p => p.id === targetId);

        if (currentTarget && currentTarget.health > 0) {
          const dx = currentTarget.position.x - snapX;
          const dz = currentTarget.position.z - snapZ;
          const distXZ = Math.sqrt(dx * dx + dz * dz);

          if (distXZ <= FROST_HIT_RADIUS) {
            this.room?.applyPlayerStatusEffect(currentTarget.id, 'freeze', FROST_RAY_FREEZE_MS);
            if (this.io) {
              this.io.to(this.roomId).emit('knight-frost', {
                knightId,
                targetPlayerId: currentTarget.id,
                damage: 17,
                slowDuration: FROST_RAY_FREEZE_MS,
                targetPosition: {
                  x: currentTarget.position.x,
                  y: currentTarget.position.y + 1.0,
                  z: currentTarget.position.z,
                },
                timestamp: Date.now(),
              });
            }
            _enemyAiLog(`🔵❄️ Knight ${knightId} Frost Ray hit player ${currentTarget.id} for 17 dmg + freeze!`);
          } else {
            _enemyAiLog(`🔵 Knight ${knightId} Frost Ray missed — player dodged!`);
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
    const now = Date.now();

    this.knightStormLashActiveUntil.set(knightId, now + KNIGHT_STORM_LASH_DURATION_MS);
    this._smoothRotateEnemyTowardPoint(knight, targetPlayer.position, { instant: true });

    if (this.io) {
      this._queueMove(knight.id, knight.position, knight.rotation);
      this.io.to(this.roomId).emit('knight-stormlash-telegraph', {
        knightId,
        targetPlayerId: targetId,
        timestamp: now,
      });
    }
    _enemyAiLog(`🔵⚡ Blue Knight ${knightId} channeling Storm Lash at player ${targetId}!`);

    const oldHandles = this.knightStormLashTimeouts.get(knightId);
    if (oldHandles) {
      for (const h of oldHandles) clearTimeout(h);
    }

    const handles = [];
    const zapCount = Math.floor(KNIGHT_STORM_LASH_DURATION_MS / KNIGHT_STORM_LASH_ZAP_INTERVAL_MS);

    for (let i = 1; i <= zapCount; i += 1) {
      const delayMs = i * KNIGHT_STORM_LASH_ZAP_INTERVAL_MS;
      const handle = this._scheduleTimeout(() => {
        if (!this.room?.getGameStarted()) return;
        const liveKnight = this.room?.getEnemy(knightId);
        if (!liveKnight || liveKnight.isDying) return;
        if (this.room?.isEnemyAffectedBy(knightId, 'stun')) return;

        const players = this.room?.getPlayers();
        const liveTarget = players?.find(p => p.id === targetId);
        const liveAlly = !liveTarget ? this.room?.getEnemy?.(targetId) : null;
        const aimEntity = liveTarget && liveTarget.health > 0
          ? liveTarget
          : (this._isPlayerCombatAlly(liveAlly) ? liveAlly : null);
        if (!aimEntity) return;

        this._smoothRotateEnemyTowardPoint(liveKnight, aimEntity.position, { instant: true });
        this._queueMove(liveKnight.id, liveKnight.position, liveKnight.rotation);
        this._flushMoves();

        const ax = liveKnight.position.x;
        const az = liveKnight.position.z;
        const dx = aimEntity.position.x - ax;
        const dz = aimEntity.position.z - az;
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
            vfxScale: KNIGHT_STORM_LASH_VFX_SCALE,
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
          { sourceEnemyId: knightId },
        );
        const stormLashHalfWidthSq = KNIGHT_STORM_LASH_HALF_WIDTH * KNIGHT_STORM_LASH_HALF_WIDTH;
        this.damageAlliedUnitsAlongSegmentXZ(
          ax,
          az,
          bx,
          bz,
          stormLashHalfWidthSq,
          KNIGHT_STORM_LASH_ZAP_DAMAGE,
          { sourceEnemyId: knightId, damageType: 'knight_storm_lash' },
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
    const attackRange = 10.0;
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
    const newRot = Math.atan2(dx, dz);
    shade.rotation = newRot;
    this._queueMoveIfChanged(shade.id, shade.position, shade.rotation);

    if (distance <= attackRange) {
      const blinkCooldown = 6250;
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
          const fakeTarget = { id: z.ownerPlayerId || z.id, combatAllyId: z.id, position: z.position };
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
            this._scheduleTimeout(() => {
              if (shade.isDying || !this.room?.getGameStarted()) return;
              if (this.room?.isEnemyAffectedBy(shadeId, 'stun')) return;
              const zz = this.room?.getEnemy(zid);
              if (!zz || zz.isDying || zz.health <= 0) return;
              if (this.calculateDistance(shade.position, zz.position) > attackRange + 1.5) return;
              this.damagePlayerZombieFromMob({ id: shadeId }, zz, shade.damage || 25, 'shade_dagger');
            }, delay);
          });
        } else if (resolved.kind === 'hostile') {
          const hostile = resolved.enemy;
          this.telegraphShadeAttack(shade, { id: hostile.id, position: hostile.position });
          this.scheduleAllyShadeDaggerChecks(
            shade.id,
            hostile.position.x,
            hostile.position.z,
            this.getShadeDaggerDelays(shade),
          );
          const hid = hostile.id;
          const shadeId = shade.id;
          this.getShadeDaggerDelays(shade).forEach((delay) => {
            this._scheduleTimeout(() => {
              if (shade.isDying || !this.room?.getGameStarted()) return;
              if (this.room?.isEnemyAffectedBy(shadeId, 'stun')) return;
              const liveTarget = this.room?.getEnemy(hid);
              if (!liveTarget || liveTarget.isDying || liveTarget.health <= 0) return;
              if (this.calculateDistance(shade.position, liveTarget.position) > attackRange + 1.5) return;
              this.damageHostileMobFromMob(shade, liveTarget, shade.damage || 25, 'shade_dagger');
            }, delay);
          });
        } else if (resolved.kind === 'trap') {
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
            this._scheduleTimeout(() => {
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
    this._scheduleTimeout(() => {
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
        this._scheduleTimeout(() => {
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

    this._queueMoveIfChanged(shade.id, shade.position, shade.rotation);

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
    if (process.env.NODE_ENV !== 'production') {
      _enemyAiLog(`👻 Shade ${shade.id} ${reason} blinked 5 units ${dirLabel} of target (θ=${(theta * 180 / Math.PI).toFixed(0)}°)`);
    }
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
        ...this._meleeTelegraphTargetFields(targetPlayer),
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
    if (process.env.NODE_ENV !== 'production') {
      _enemyAiLog(`👻 Shade ${shade.id} throwing daggers at player ${targetPlayer.id}!`);
    }
  }

  // ─── Wraith AI ─────────────────────────────────────────────────────────────

  isWraithInvisible(wraithId) {
    const state = this.wraithStealthState.get(wraithId);
    if (!state) return false;
    return Date.now() < state.stealthEndsAt;
  }

  revealWraithStealth(wraithId, reason = 'timeout') {
    const state = this.wraithStealthState.get(wraithId);
    if (!state) return;
    if (state.revealTimeout) clearTimeout(state.revealTimeout);
    this.wraithStealthState.delete(wraithId);

    const wraith = this.room?.getEnemy?.(wraithId);
    if (this.io && wraith) {
      this.io.to(this.roomId).emit('wraith-stealth-reveal', {
        wraithId,
        position: { ...wraith.position },
        reason,
        timestamp: Date.now(),
      });
    }
  }

  computeWraithFlankGoal(wraith, resolved, tpos) {
    if (resolved.kind === 'player') {
      const playerRotation = resolved.player.rotation?.y || 0;
      const facingX = Math.sin(playerRotation);
      const facingZ = Math.cos(playerRotation);
      return {
        position: {
          x: tpos.x - facingX * TELEPORT_BEHIND_DISTANCE,
          y: tpos.y ?? 0,
          z: tpos.z - facingZ * TELEPORT_BEHIND_DISTANCE,
        },
        id: resolved.player.id,
      };
    }
    return this.aggroTargetToMoveTarget(resolved);
  }

  castWraithStealth(wraith) {
    const now = Date.now();
    this.wraithStealthCooldown.set(wraith.id, now);
    const stealthEndsAt = now + WRAITH_STEALTH_DURATION_MS;
    const wraithId = wraith.id;
    const revealTimeout = this._scheduleTimeout(() => {
      this.revealWraithStealth(wraithId, 'timeout');
    }, WRAITH_STEALTH_DURATION_MS);
    this.wraithStealthState.set(wraithId, { stealthEndsAt, revealTimeout });

    if (this.io) {
      this.io.to(this.roomId).emit('wraith-stealth-cloak', {
        wraithId,
        position: { ...wraith.position },
        timestamp: now,
      });
    }
  }

  castWraithBuzzsaw(wraith) {
    const now = Date.now();
    if (this.isWraithInvisible(wraith.id)) {
      this.revealWraithStealth(wraith.id, 'buzzsaw');
    }

    this.wraithBuzzsawCooldown.set(wraith.id, now);
    this.meleeLockUntil.set(wraith.id, now + WRAITH_BUZZSAW_DURATION_MS);

    if (this.io) {
      this._queueMoveIfChanged(wraith.id, wraith.position, wraith.rotation);
      this.io.to(this.roomId).emit('wraith-buzzsaw-telegraph', {
        wraithId: wraith.id,
        position: { ...wraith.position },
        rotation: wraith.rotation,
        durationMs: WRAITH_BUZZSAW_DURATION_MS,
        timestamp: now,
      });
    }

    const wraithId = wraith.id;
    const ox = wraith.position.x;
    const oz = wraith.position.z;
    const facing = wraith.rotation;

    for (let tick = 0; tick < 3; tick++) {
      this._scheduleEnemyTimeout(wraithId, () => {
        if (!this.room?.getGameStarted()) return;
        const live = this.room?.getEnemy?.(wraithId);
        if (!live || live.isDying || live.type !== 'wraith') return;
        if (this.room?.isEnemyAffectedBy(wraithId, 'stun')) return;
        if (this.room?.isEnemyAffectedBy(wraithId, 'freeze')) return;
        this.room?.damagePlayersInCone?.(
          ox,
          oz,
          facing,
          WRAITH_BUZZSAW_RANGE,
          WRAITH_BUZZSAW_HALF_ANGLE_RAD,
          WRAITH_BUZZSAW_DAMAGE,
          'wraith_buzzsaw',
          { sourceEnemyId: wraithId },
        );
        this.room?.tryDamageAlliedUnitsInCone?.(
          ox,
          oz,
          facing,
          WRAITH_BUZZSAW_RANGE,
          WRAITH_BUZZSAW_HALF_ANGLE_RAD,
          WRAITH_BUZZSAW_DAMAGE,
          { sourceEnemyId: wraithId, damageType: 'wraith_buzzsaw' },
        );
      }, tick * WRAITH_BUZZSAW_TICK_MS);
    }
  }

  updateWraithAI(wraith, players) {
    let aggroData = this.enemyAggro.get(wraith.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(wraith, players);
      if (!closestPlayer) return;
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(wraith.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, wraith, players);
    if (!resolved) return;

    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(wraith.position, tpos);
    const aggroRadius = WRAITH_AGGRO_RADIUS;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);

    if (!aggroData.isAggroed && distance <= aggroRadius && this.hasLineOfSight(wraith.position, tpos)) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }
    this._maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius);

    if (!aggroData.isAggroed) return;

    const now = Date.now();
    const lockUntil = this.meleeLockUntil.get(wraith.id) || 0;
    if (now < lockUntil) return;

    const dx = tpos.x - wraith.position.x;
    const dz = tpos.z - wraith.position.z;
    if (Math.hypot(dx, dz) > 1e-4) {
      wraith.rotation = Math.atan2(dx, dz);
    }
    this._queueMoveIfChanged(wraith.id, wraith.position, wraith.rotation);

    const lastBuzzsaw = this.wraithBuzzsawCooldown.get(wraith.id) || 0;
    const buzzsawReady = now - lastBuzzsaw >= WRAITH_BUZZSAW_COOLDOWN_MS;

    if (distance <= WRAITH_ENGAGE_RANGE && buzzsawReady) {
      this.castWraithBuzzsaw(wraith);
      return;
    }

    const lastStealth = this.wraithStealthCooldown.get(wraith.id) || 0;
    const stealthReady = now - lastStealth >= WRAITH_STEALTH_COOLDOWN_MS;
    const isInvisible = this.isWraithInvisible(wraith.id);

    if (!isInvisible && stealthReady && distance > WRAITH_ENGAGE_RANGE) {
      this.castWraithStealth(wraith);
    }

    const moveTarget = this.computeWraithFlankGoal(wraith, resolved, tpos);
    this.moveEnemyTowardsTarget(wraith, moveTarget, { stopThreshold: 0.35 });
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
    this._queueMoveIfChanged(warlock.id, warlock.position, warlock.rotation);

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

    if (resolved.kind === 'hostile') {
      const hostile = resolved.enemy;
      const launchRange = 12.0;
      const launchCooldown = 7000;
      const lastLaunchTime = this.warlockLaunchCooldown.get(warlock.id) || 0;
      if (distance <= launchRange && now - lastLaunchTime >= launchCooldown) {
        this.warlockLaunchCooldown.set(warlock.id, now);
        this.damageHostileMobFromMob(warlock, hostile, 50, 'warlock_chaos_chip');
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
    const warlockSkyY = warlock.position.y + WARLOCK_ARCHON_SHOCK_SKY_Y_OFFSET;

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

    const handle = this._scheduleTimeout(() => {
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
        { sourceEnemyId: warlock.id },
      );
      const archonShockHalfWidthSq = WARLOCK_ARCHON_SHOCK_HALF_WIDTH * WARLOCK_ARCHON_SHOCK_HALF_WIDTH;
      this.damageAlliedUnitsAlongSegmentXZ(
        seg.ax,
        seg.az,
        seg.bx,
        seg.bz,
        archonShockHalfWidthSq,
        WARLOCK_ARCHON_SHOCK_DAMAGE,
        { sourceEnemyId: warlock.id, damageType: 'warlock_archon_shock' },
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

    _enemyAiLog(`🔮 Warlock ${warlock.id} blinked 5 units closer to player ${targetPlayer.id}`);

    const flameXZ = { x: endPosition.x, z: endPosition.z };
    const wid = warlock.id;
    this._scheduleTimeout(() => {
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

    _enemyAiLog(`🔮 Warlock ${warlock.id} launching chaotic orb at player ${targetPlayer.id}!`);

    const sx = warlock.position.x;
    const sy = warlock.position.y + 2.0;
    const sz = warlock.position.z;
    const wid = warlock.id;
    const targetId = targetPlayer.id;
    this._scheduleTimeout(() => {
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

    _enemyAiLog(`☄️ Warlock ${warlock.id} casting meteor swarm (${WARLOCK_METEOR_COUNT} impacts near player ${targetPlayer.id})`);

    const wid = warlock.id;
    targetPositions.forEach((pos, index) => {
      const start = startPositions[index];
      const dx = pos.x - start.x;
      const dy = WARLOCK_METEOR_IMPACT_Y - start.y;
      const dz = pos.z - start.z;
      const travelMs = (Math.hypot(dx, dy, dz) / WARLOCK_METEOR_FALL_SPEED) * 1000;
      const delayMs = WARLOCK_METEOR_WARNING_MS + travelMs + index * WARLOCK_METEOR_STAGGER_MS;
      this._scheduleEnemyTimeout(wid, () => {
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
      if (!this.room?.getGameStarted()) {
        clearInterval(intervalId);
        this._removeEnemyHazardInterval(warlockId, intervalId);
        return;
      }
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
        this._removeEnemyHazardInterval(warlockId, intervalId);
        this.io?.to(this.roomId).emit('warlock-meteor-ember-zone-expired', { id: zoneId, timestamp: Date.now() });
      }
    }, WARLOCK_METEOR_EMBER_TICK_MS);
    this._addEnemyHazardInterval(warlockId, intervalId);
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
            combatAllyId: z.id,
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
    if (now < lockUntil) {
      this.tickMeleeSwingWindup(templar, resolved);
      return;
    }

    const templarProfile = getMeleeProfile('templar');
    const attackRange = templarProfile?.range ?? 2.725;

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

    this.tryMeleeEngage(templar, resolved, moveTarget, templarProfile, { now, distance });
  }

  telegraphTemplarAttack(templar, player) {
    if (this.io) {
      this.io.to(this.roomId).emit('templar-attack-telegraph', {
        templarId: templar.id,
        ...this._meleeTelegraphTargetFields(player),
        position: templar.position,
        timestamp: Date.now()
      });
    }
    _enemyAiLog(`🛡️ Templar ${templar.id} telegraphing attack at player ${player.id}!`);
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

    _enemyAiLog(`🛡️ Templar ${templar.id} attacked player ${player.id} for ${damage} damage!`);

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

    this._scheduleTimeout(() => {
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
        this._flushMoves();
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

      this._scheduleTimeout(() => {
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

      _enemyAiLog(`🛡️ Templar ${e.id} Blink Smite — behind ${targetPlayerId}, strike in ${TEMPLAR_BLINK_SMITE_STRIKE_DELAY_MS}ms`);
    }, TEMPLAR_BLINK_SMITE_CHARGE_MS);
  }

  // ─── Assassin AI ─────────────────────────────────────────────────────────────

  isAssassinInvisible(assassinId) {
    const state = this.assassinDreamshroudState.get(assassinId);
    if (!state) return false;
    return Date.now() < state.stealthEndsAt;
  }

  /** Allies/pets must not target or hit an assassin while Dreamshroud is active. */
  isAssassinUntargetable(enemy) {
    return !!enemy && enemy.type === 'assassin' && this.isAssassinInvisible(enemy.id);
  }

  _shouldAlliesDisengageForDreamshroud() {
    const until = this.room?.assassinDreamshroudUntil || 0;
    return until > 0 && Date.now() < until;
  }

  _getArenaCenterMoveTarget() {
    const clamped = this.clampToArenaXZ(0, 0);
    return { id: 'arena-center', position: { x: clamped.x, y: 0, z: clamped.z } };
  }

  disengageAlliesOnDreamshroud() {
    if (!this.room) return;
    const players = this.room.getPlayers?.() || [];

    for (const ally of this.room.enemies.values()) {
      if (!ally || ally.isDying || ally.health <= 0) continue;
      const isAlly = this._isPlayerCombatAlly(ally) || ally.type === 'player-zombie';
      if (!isAlly) continue;
      ally.alliedTargetEnemyId = null;
      ally.combatInitiated = false;
      this.alliedProtectionThreat.delete(ally.id);
    }

    // Hostile mobs that were focusing allies/pets switch to a living player.
    for (const [enemyId, aggroData] of this.enemyAggro) {
      if (!aggroData) continue;
      const zid = aggroData.targetZombieId;
      if (!zid) continue;
      const targeted = this.room.getEnemy?.(zid);
      if (!targeted || !this.isFriendlyCombatUnit(targeted)) continue;
      aggroData.targetZombieId = null;
      const mover = this.room.getEnemy?.(enemyId);
      if (!mover) continue;
      const nearest = this.findClosestPlayer(mover, players);
      if (nearest) {
        aggroData.targetPlayerId = nearest.id;
        aggroData.isAggroed = true;
      }
    }
  }

  revealAssassinDreamshroud(assassinId, reason = 'timeout') {
    const state = this.assassinDreamshroudState.get(assassinId);
    if (!state) return;
    if (state.revealTimeout) clearTimeout(state.revealTimeout);
    this.assassinDreamshroudState.delete(assassinId);

    // Clear room-level disengage flag if no other assassin is still shrouded.
    let anyActive = false;
    for (const [id, s] of this.assassinDreamshroudState) {
      if (s && Date.now() < s.stealthEndsAt) {
        anyActive = true;
        break;
      }
    }
    if (!anyActive && this.room) {
      this.room.assassinDreamshroudUntil = 0;
    }

    const assassin = this.room?.getEnemy?.(assassinId);
    if (this.io && assassin) {
      this.io.to(this.roomId).emit('assassin-dreamshroud-reveal', {
        assassinId,
        position: { ...assassin.position },
        reason,
        timestamp: Date.now(),
      });
    }
  }

  castAssassinDreamshroud(assassin) {
    const now = Date.now();
    const assassinId = assassin.id;
    this.assassinDreamshroudCooldown.set(assassinId, now);
    this.meleeLockUntil.set(assassinId, now + ASSASSIN_DREAMSHROUD_CAST_LOCK_MS);
    this.enemyPaths.delete(assassinId);

    const stealthEndsAt = now + ASSASSIN_DREAMSHROUD_DURATION_MS;
    if (this.room) {
      this.room.assassinDreamshroudUntil = Math.max(
        this.room.assassinDreamshroudUntil || 0,
        stealthEndsAt,
      );
    }

    const prev = this.assassinDreamshroudState.get(assassinId);
    if (prev?.revealTimeout) clearTimeout(prev.revealTimeout);
    const revealTimeout = this._scheduleTimeout(() => {
      this.revealAssassinDreamshroud(assassinId, 'timeout');
    }, ASSASSIN_DREAMSHROUD_DURATION_MS);
    this.assassinDreamshroudState.set(assassinId, { stealthEndsAt, revealTimeout });

    this.disengageAlliesOnDreamshroud();

    if (this.io) {
      this.io.to(this.roomId).emit('assassin-dreamshroud-cloak', {
        assassinId,
        position: { ...assassin.position },
        durationMs: ASSASSIN_DREAMSHROUD_DURATION_MS,
        timestamp: now,
      });
    }
  }

  tryAssassinDreamshroud(assassin, now) {
    if (!assassin || assassin.isDying || assassin.health <= 0) return false;
    if (this.isAssassinInvisible(assassin.id)) return false;
    if (this.room?.isEnemyAffectedBy(assassin.id, 'freeze')) return false;
    if (this.room?.isEnemyAffectedBy(assassin.id, 'stun')) return false;

    const last = this.assassinDreamshroudCooldown.get(assassin.id) || 0;
    if (now - last < ASSASSIN_DREAMSHROUD_COOLDOWN_MS) return false;

    const centerDist = Math.hypot(assassin.position.x, assassin.position.z);
    if (centerDist <= ASSASSIN_DREAMSHROUD_CENTER_RADIUS) return false;

    this.castAssassinDreamshroud(assassin);
    return true;
  }

  _followOwnerDuringDreamshroud(ally, players) {
    if (!ally || ally.isDying || ally.health <= 0) return true;
    ally.alliedTargetEnemyId = null;
    ally.combatInitiated = false;
    const ownerId = ally.ownerPlayerId;
    let owner = ownerId && this.room?.players?.has(ownerId)
      ? this.room.players.get(ownerId)
      : null;
    if (!owner) owner = this.findClosestPlayer(ally, players);
    if (!owner) return true;
    const d = this.calculateDistance(ally.position, owner.position);
    if (d > 1.5) {
      this.moveEnemyTowardsTarget(ally, owner, { stopThreshold: 1.0 });
    } else {
      this._queueMoveIfChanged(ally.id, ally.position, ally.rotation);
    }
    return true;
  }

  updateAssassinAI(assassin, players) {
    let aggroData = this.enemyAggro.get(assassin.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(assassin, players);
      if (!closestPlayer) return;
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(assassin.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, assassin, players);
    if (!resolved) return;

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(assassin.position, tpos);
    const aggroRadius = 15;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);

    if (!aggroData.isAggroed && distance <= aggroRadius && this.hasLineOfSight(assassin.position, tpos)) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }
    this._maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius);

    if (!aggroData.isAggroed) return;

    const now = Date.now();
    const lockUntil = this.meleeLockUntil.get(assassin.id) || 0;
    if (now < lockUntil) {
      this._smoothRotateEnemyTowardPoint(assassin, tpos);
      this._queueMoveIfChanged(assassin.id, assassin.position, assassin.rotation);
      return;
    }

    // Dreamshroud: while invisible, offensive abilities may fire (and break stealth);
    // otherwise only reposition toward arena center — no chase.
    const isInvisible = this.isAssassinInvisible(assassin.id);

    if (!isInvisible) {
      const dx = tpos.x - assassin.position.x;
      const dz = tpos.z - assassin.position.z;
      assassin.rotation = Math.atan2(dx, dz);
      this._queueMoveIfChanged(assassin.id, assassin.position, assassin.rotation);
    }

    // 1) Spin when in cast range and off cooldown (reveals if shrouded)
    if (resolved.kind === 'player') {
      if (this.tryAssassinSpinAttack(assassin, resolved.player, now, distance)) return;
    } else if (resolved.kind === 'hostile' && this._isPlayerCombatAlly(resolved.enemy)) {
      if (this.tryAssassinSpinAttack(assassin, resolved.enemy, now, distance)) return;
    }

    // 1b) Dreamshroud — reposition when stuck near edges (blocked while already invisible)
    if (this.tryAssassinDreamshroud(assassin, now)) return;

    // 2) Bowshot when farther than 5 range (reveals if shrouded)
    if (distance > ASSASSIN_BOW_MIN_RANGE) {
      const lastBow = this.assassinBowCooldown.get(assassin.id) || 0;
      if (now - lastBow >= ASSASSIN_BOW_COOLDOWN_MS) {
        if (resolved.kind === 'player') {
          if (this.isAssassinInvisible(assassin.id)) {
            this.revealAssassinDreamshroud(assassin.id, 'attack');
          }
          this.assassinBowCooldown.set(assassin.id, now);
          this.meleeLockUntil.set(
            assassin.id,
            now + ASSASSIN_TRIPLE_SHOT_COUNT * VIPER_DRAWBOW_DURATION_MS,
          );
          this.enemyPaths.delete(assassin.id);
          const shotId = `assassin-shot-${assassin.id}-${now}`;
          this.scheduleAssassinBowShot(assassin, resolved.player, shotId);
          // Shots 2–3: chain follow-ups one draw-duration apart (Viper-style).
          this._scheduleAssassinFollowupShot(
            assassin.id,
            resolved.player.id,
            ASSASSIN_TRIPLE_SHOT_COUNT - 1,
          );
          return;
        }
        if (resolved.kind === 'zombie') {
          if (this.isAssassinInvisible(assassin.id)) {
            this.revealAssassinDreamshroud(assassin.id, 'attack');
          }
          this.assassinBowCooldown.set(assassin.id, now);
          this.meleeLockUntil.set(assassin.id, now + VIPER_DRAWBOW_DURATION_MS);
          this.enemyPaths.delete(assassin.id);
          const z = resolved.zombie;
          const shotId = `assassin-shot-${assassin.id}-${now}`;
          const impactDelayMs = VIPER_DRAWBOW_DURATION_MS + viperArrowFlightMs(
            { x: assassin.position.x, y: assassin.position.y + 1.5, z: assassin.position.z },
            { x: z.position.x, y: (z.position.y ?? 0) + 1.0, z: z.position.z },
          );
          this.telegraphViperAttack(assassin, {
            id: z.ownerPlayerId || z.id,
            combatAllyId: z.id,
            position: z.position,
          }, shotId, { damage: ASSASSIN_BOW_DAMAGE });
          const zid = z.id;
          const aid = assassin.id;
          this._scheduleTimeout(() => {
            if (assassin.isDying || !this.room?.getGameStarted()) return;
            const live = this.room?.getEnemy(aid);
            if (!live || live.isDying) return;
            if (this.isAssassinInvisible(aid)) return;
            const zz = this.room?.getEnemy(zid);
            if (!zz || zz.isDying || zz.health <= 0) {
              this.emitViperArrowOutcome(aid, shotId, false, live.position);
              return;
            }
            const zombieHit = this.damagePlayerZombieFromMob(live, zz, ASSASSIN_BOW_DAMAGE, 'viper_arrow');
            this.emitViperArrowOutcome(aid, shotId, !!zombieHit, zz.position);
          }, impactDelayMs);
          return;
        }
      }
    }

    // 3) Evade when spin is on cooldown and within spin range (not ideal bow range)
    const lastSpin = this.assassinSpinCooldown.get(assassin.id) || 0;
    const spinOnCooldown = now - lastSpin < ASSASSIN_SPIN_COOLDOWN_MS;
    if (spinOnCooldown && distance <= ASSASSIN_SPIN_CAST_RANGE) {
      if (this.tryAssassinEvade(assassin, tpos, now, distance)) return;
    }

    // While shrouded and not attacking: only reposition toward arena center.
    if (this.isAssassinInvisible(assassin.id)) {
      const centerTarget = this._getArenaCenterMoveTarget();
      const cdx = centerTarget.position.x - assassin.position.x;
      const cdz = centerTarget.position.z - assassin.position.z;
      if (Math.hypot(cdx, cdz) > 1e-4) {
        assassin.rotation = Math.atan2(cdx, cdz);
      }
      this._queueMoveIfChanged(assassin.id, assassin.position, assassin.rotation);
      this.moveEnemyTowardsTarget(assassin, centerTarget, { stopThreshold: 0.8 });
      return;
    }

    // Close in toward target (no basic melee)
    this.moveEnemyTowardsTarget(assassin, moveTarget, {
      meleeSurroundAttackRange: ASSASSIN_SPIN_CAST_RANGE,
    });
  }

  tryAssassinSpinAttack(assassin, target, now, distance) {
    if (this.room?.isEnemyAffectedBy(assassin.id, 'freeze')) return false;
    if (this.room?.isEnemyAffectedBy(assassin.id, 'stun')) return false;
    if (!target?.position) return false;
    const liveAlly = this.room?.getEnemy?.(target.id);
    const isCombatAllyTarget = this._isPlayerCombatAlly(liveAlly);
    const targetAlive = (target.health ?? 0) > 0
      || (isCombatAllyTarget && !liveAlly.isDying && liveAlly.health > 0);
    if (!targetAlive) return false;
    if (distance > ASSASSIN_SPIN_CAST_RANGE) return false;

    const lastSpin = this.assassinSpinCooldown.get(assassin.id) || 0;
    if (now - lastSpin < ASSASSIN_SPIN_COOLDOWN_MS) return false;

    // Attacking breaks Dreamshroud (wraith-style).
    if (this.isAssassinInvisible(assassin.id)) {
      this.revealAssassinDreamshroud(assassin.id, 'attack');
    }

    const dx = target.position.x - assassin.position.x;
    const dz = target.position.z - assassin.position.z;
    const mag = Math.sqrt(dx * dx + dz * dz);
    if (mag < 1e-4) return false;

    const dirX = dx / mag;
    const dirZ = dz / mag;
    assassin.rotation = Math.atan2(dirX, dirZ);

    this.assassinSpinCooldown.set(assassin.id, now);
    this.meleeLockUntil.set(assassin.id, now + ASSASSIN_SPIN_CHARGE_MS + ASSASSIN_SPIN_TRAVEL_MS);
    this.enemyPaths.delete(assassin.id);

    const chargePosition = { ...assassin.position };
    if (this.io) {
      this.io.to(this.roomId).emit('assassin-spin-charge', {
        assassinId: assassin.id,
        targetPlayerId: target.id,
        position: chargePosition,
        rotation: assassin.rotation,
        chargeMs: ASSASSIN_SPIN_CHARGE_MS,
        timestamp: Date.now(),
      });
      this._queueMove(assassin.id, assassin.position, assassin.rotation);
    }

    const originalTargetId = target.id;
    const originalAim = { ...target.position };
    const aid = assassin.id;
    this._scheduleEnemyTimeout(aid, () => {
      if (assassin.isDying || !this.room?.getGameStarted()) return;
      if (this.room?.isEnemyAffectedBy(aid, 'stun')) return;
      if (this.room?.isEnemyAffectedBy(aid, 'freeze')) return;
      if (this.isAssassinInvisible(aid)) return;

      const currentPlayers = this.room?.getPlayers?.() || [];
      const liveTarget = currentPlayers.find(p => p.id === originalTargetId && p.health > 0);
      const liveAllyTarget = !liveTarget ? this.room?.getEnemy?.(originalTargetId) : null;
      const aimPosition = liveTarget?.position
        || (this._isPlayerCombatAlly(liveAllyTarget) && !liveAllyTarget.isDying && liveAllyTarget.health > 0
          ? liveAllyTarget.position
          : originalAim);
      const aimDx = aimPosition.x - assassin.position.x;
      const aimDz = aimPosition.z - assassin.position.z;
      const aimMag = Math.sqrt(aimDx * aimDx + aimDz * aimDz);
      if (aimMag < 1e-4) return;

      const spinDirX = aimDx / aimMag;
      const spinDirZ = aimDz / aimMag;
      const startPosition = { ...assassin.position };
      const rawX = assassin.position.x + spinDirX * ASSASSIN_SPIN_DISTANCE;
      const rawZ = assassin.position.z + spinDirZ * ASSASSIN_SPIN_DISTANCE;

      let resolved = this.resolveEnemyWallCollisions(rawX, rawZ);
      resolved = this.resolveMeleePeerSeparation(assassin, resolved.x, resolved.z);

      const moved = Math.hypot(resolved.x - assassin.position.x, resolved.z - assassin.position.z);
      if (moved < 0.5) return;

      assassin.position.x = resolved.x;
      assassin.position.z = resolved.z;
      assassin.rotation = Math.atan2(spinDirX, spinDirZ);

      const endPosition = { ...assassin.position };
      if (this.io) {
        this.io.to(this.roomId).emit('assassin-spin-dash', {
          assassinId: aid,
          targetPlayerId: originalTargetId,
          startPosition,
          endPosition,
          rotation: assassin.rotation,
          distance: moved,
          durationMs: ASSASSIN_SPIN_TRAVEL_MS,
          damage: ASSASSIN_SPIN_DAMAGE,
          timestamp: Date.now(),
        });
        this._queueMove(aid, assassin.position, assassin.rotation);
      }

      this.scheduleAssassinSpinPathDamage(assassin, startPosition, endPosition);
    }, ASSASSIN_SPIN_CHARGE_MS);

    return true;
  }

  scheduleAssassinSpinPathDamage(assassin, startPosition, endPosition) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;

    const hitPlayerIds = new Set();
    const hitAllyIds = new Set();
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
      if (assassin.isDying || !this.room?.getGameStarted()) return false;
      if (this.isAssassinInvisible(assassin.id)) return false;

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
        if (perpendicular > ASSASSIN_SPIN_STRIP_HALF_WIDTH) continue;

        hitPlayerIds.add(player.id);
        this.recordAlliedProtectionThreat(assassin.id, player.id, ASSASSIN_SPIN_DAMAGE);
        if (this.io) {
          this.io.to(this.roomId).emit('assassin-spin-hit', {
            assassinId: assassin.id,
            targetPlayerId: player.id,
            damage: ASSASSIN_SPIN_DAMAGE,
            position: { x: closestX, y: startPosition.y ?? 0, z: closestZ },
            timestamp: Date.now(),
          });
        }
      }

      this.damageAlliedUnitsAlongSpinStrip(
        sx,
        sz,
        segX,
        segZ,
        ASSASSIN_SPIN_STRIP_HALF_WIDTH,
        ASSASSIN_SPIN_DAMAGE,
        { sourceEnemyId: assassin.id, damageType: 'assassin_spin' },
        hitAllyIds,
      );

      return true;
    };

    const aid = assassin.id;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(1, elapsed / ASSASSIN_SPIN_TRAVEL_MS);
      const shouldContinue = applyHitsForProgress(progress);
      if (!shouldContinue || progress >= 1) {
        clearInterval(interval);
        this._removeEnemyHazardInterval(aid, interval);
      }
    }, sampleEveryMs);
    this._addEnemyHazardInterval(aid, interval);
  }

  _trackAssassinFollowupTimeout(assassinId, timeoutId) {
    const prev = this.assassinFollowupTimeout.get(assassinId);
    if (prev) clearTimeout(prev);
    this.assassinFollowupTimeout.set(assassinId, timeoutId);
  }

  /**
   * Chain remaining Assassin bow follow-ups (one pending timeout at a time).
   * @param {string} assassinId
   * @param {string} playerId
   * @param {number} remainingShots shots still to fire after this delay
   */
  _scheduleAssassinFollowupShot(assassinId, playerId, remainingShots) {
    if (remainingShots <= 0) return;
    const t = this._scheduleTimeout(() => {
      this.assassinFollowupTimeout.delete(assassinId);
      if (!this.room?.getGameStarted()) return;
      const liveAssassin = this.room?.getEnemy(assassinId);
      if (!liveAssassin || liveAssassin.isDying) return;
      if (this.room?.isEnemyAffectedBy(assassinId, 'freeze')) return;
      if (this.room?.isEnemyAffectedBy(assassinId, 'stun')) return;
      const tp = this.room?.getPlayers()?.find(p => p.id === playerId);
      if (!tp || tp.health <= 0) return;

      const aimDx = tp.position.x - liveAssassin.position.x;
      const aimDz = tp.position.z - liveAssassin.position.z;
      liveAssassin.rotation = Math.atan2(aimDx, aimDz);
      this._queueMove(liveAssassin.id, liveAssassin.position, liveAssassin.rotation);

      const shotId = `assassin-shot-${assassinId}-${Date.now()}`;
      this.scheduleAssassinBowShot(liveAssassin, tp, shotId);
      this._scheduleAssassinFollowupShot(assassinId, playerId, remainingShots - 1);
    }, ASSASSIN_TRIPLE_SHOT_FOLLOWUP_DELAY_MS);

    this._trackAssassinFollowupTimeout(assassinId, t);
  }

  scheduleAssassinBowShot(assassin, player, shotId) {
    if (this.isAssassinInvisible(assassin.id)) {
      this.revealAssassinDreamshroud(assassin.id, 'attack');
    }
    this.telegraphViperAttack(assassin, player, shotId, {
      maxRange: VIPER_ARROW_MAX_RANGE,
      damage: ASSASSIN_BOW_DAMAGE,
    });
    const startX = assassin.position.x;
    const startZ = assassin.position.z;
    const tx = player.position.x;
    const tz = player.position.z;
    const dx = tx - startX;
    const dz = tz - startZ;
    const len = Math.hypot(dx, dz) || 1e-6;
    const endX = startX + (dx / len) * VIPER_ARROW_MAX_RANGE;
    const endZ = startZ + (dz / len) * VIPER_ARROW_MAX_RANGE;
    const impactDelayMs = VIPER_DRAWBOW_DURATION_MS + viperArrowFlightMs(
      { x: startX, y: assassin.position.y + 1.5, z: startZ },
      { x: tx, y: player.position.y + 1.0, z: tz },
    );
    const pid = player.id;
    const aid = assassin.id;
    this._scheduleTimeout(() => {
      if (assassin.isDying || !this.room?.getGameStarted()) return;
      const a = this.room?.getEnemy(aid);
      if (!a || a.isDying) return;
      if (this.isAssassinInvisible(aid)) {
        this.emitViperArrowOutcome(aid, shotId, false, a.position);
        return;
      }
      const players = this.room?.getPlayers();
      const tp = players?.find(p => p.id === pid);
      if (!tp) {
        this.emitViperArrowOutcome(aid, shotId, false, a.position);
        return;
      }
      const playerHits = this.room?.damagePlayersInLineSegment?.(
        startX,
        startZ,
        endX,
        endZ,
        1.05,
        ASSASSIN_BOW_DAMAGE,
        'viper_arrow',
        { sourceEnemyId: aid },
      ) || 0;
      let hitAny = playerHits > 0;
      const ALLY_PATH_R2 = 3.5 * 3.5;
      const allyHits = this.damageAlliedUnitsAlongSegmentXZ(
        startX, startZ, endX, endZ, ALLY_PATH_R2, ASSASSIN_BOW_DAMAGE, {
          sourceEnemyId: aid,
          damageType: 'viper_arrow',
        },
      );
      hitAny = hitAny || allyHits > 0;
      this.emitViperArrowOutcome(aid, shotId, hitAny, {
        x: hitAny ? tp.position.x : endX,
        y: tp.position.y,
        z: hitAny ? tp.position.z : endZ,
      });
    }, impactDelayMs);
  }

  tryAssassinEvade(assassin, targetPos, now, distance) {
    if (this.room?.isEnemyAffectedBy(assassin.id, 'freeze')) return false;
    if (this.room?.isEnemyAffectedBy(assassin.id, 'stun')) return false;
    if (!targetPos) return false;

    const lastEvade = this.assassinEvadeCooldown.get(assassin.id) || 0;
    if (now - lastEvade < ASSASSIN_EVADE_COOLDOWN_MS) return false;

    // Evade breaks Dreamshroud (wraith-style offensive ability).
    if (this.isAssassinInvisible(assassin.id)) {
      this.revealAssassinDreamshroud(assassin.id, 'attack');
    }

    const dx = targetPos.x - assassin.position.x;
    const dz = targetPos.z - assassin.position.z;
    const mag = Math.sqrt(dx * dx + dz * dz);
    if (mag < 1e-4) return false;

    // Face the target, then travel backward away from them
    const dirX = dx / mag;
    const dirZ = dz / mag;
    const backX = -dirX;
    const backZ = -dirZ;

    const startPosition = { ...assassin.position };
    const rawX = assassin.position.x + backX * ASSASSIN_EVADE_DISTANCE;
    const rawZ = assassin.position.z + backZ * ASSASSIN_EVADE_DISTANCE;

    let resolved = this.resolveEnemyWallCollisions(rawX, rawZ);
    resolved = this.resolveMeleePeerSeparation(assassin, resolved.x, resolved.z);

    const moved = Math.hypot(resolved.x - assassin.position.x, resolved.z - assassin.position.z);
    if (moved < 0.5) return false;

    assassin.position.x = resolved.x;
    assassin.position.z = resolved.z;
    assassin.rotation = Math.atan2(dirX, dirZ);

    this.assassinEvadeCooldown.set(assassin.id, now);
    this.meleeLockUntil.set(assassin.id, now + ASSASSIN_EVADE_DURATION_MS);
    this.enemyPaths.delete(assassin.id);

    const endPosition = { ...assassin.position };
    if (this.io) {
      this.io.to(this.roomId).emit('assassin-evade', {
        assassinId: assassin.id,
        startPosition,
        endPosition,
        rotation: assassin.rotation,
        distance: moved,
        durationMs: ASSASSIN_EVADE_DURATION_MS,
        timestamp: Date.now(),
      });
      this._queueMove(assassin.id, assassin.position, assassin.rotation);
    }

    return true;
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
    this._scheduleTimeout(() => {
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
    this._queueMoveIfChanged(viper.id, viper.position, viper.rotation);

    const attackCooldown = viper.attackCooldown ?? 5000;
    const lastAttackTime = this.viperAttackCooldown.get(viper.id) || 0;
    const now = Date.now();
    const postSpawnGraceActive =
      viper.spawnedAt != null &&
      now - viper.spawnedAt < VIPER_ATTACK_POST_SPAWN_DELAY_MS;

    if (distance <= attackRange && !postSpawnGraceActive) {
      if (now - lastAttackTime >= attackCooldown) {
        this.viperAttackCooldown.set(viper.id, now);
        const shotId = `viper-shot-${viper.id}-${now}`;
        if (resolved.kind === 'player') {
          this.scheduleViperPlayerShot(viper, resolved.player, shotId);

          if ((this.room?.coopBossesDefeatedCount ?? 0) >= VIPER_DOUBLE_SHOT_UNLOCK_BOSS_COUNT) {
            const vid = viper.id;
            const pid = resolved.player.id;
            const t = this._scheduleTimeout(() => {
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
            combatAllyId: z.id,
            position: z.position,
          }, shotId);
          const zid = z.id;
          this._scheduleTimeout(() => {
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
        } else if (resolved.kind === 'hostile') {
          const hostile = resolved.enemy;
          const targetPoint = {
            x: hostile.position.x,
            y: (hostile.position.y ?? 0) + 1.0,
            z: hostile.position.z,
          };
          const impactDelayMs = VIPER_DRAWBOW_DURATION_MS + viperArrowFlightMs(
            { x: viper.position.x, y: viper.position.y + 1.5, z: viper.position.z },
            targetPoint,
          );
          this.telegraphViperAttack(viper, {
            id: hostile.id,
            position: hostile.position,
          }, shotId);
          const hid = hostile.id;
          const vid = viper.id;
          this._scheduleTimeout(() => {
            if (viper.isDying || !this.room?.getGameStarted()) return;
            const liveViper = this.room?.getEnemy(vid);
            if (!liveViper || liveViper.isDying) return;
            const liveTarget = this.room?.getEnemy(hid);
            if (!liveTarget || liveTarget.isDying || liveTarget.health <= 0) {
              this.emitViperArrowOutcome(vid, shotId, false, liveViper.position);
              return;
            }
            if (this.calculateDistance(liveViper.position, liveTarget.position) > attackRange + 1) {
              this.emitViperArrowOutcome(vid, shotId, false, liveTarget.position);
              return;
            }
            const hostileHit = this.damageHostileMobFromMob(liveViper, liveTarget, 70, 'viper_arrow');
            this.emitViperArrowOutcome(vid, shotId, !!hostileHit, liveTarget.position);
          }, impactDelayMs);
        } else if (resolved.kind === 'trap') {
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
          this._scheduleTimeout(() => {
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

  telegraphViperAttack(viper, targetPlayer, shotId = `viper-shot-${viper.id}-${Date.now()}`, { maxRange = VIPER_ARROW_MAX_RANGE, damage = 50 } = {}) {
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
        ...this._meleeTelegraphTargetFields(targetPlayer),
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
        maxRange,
        endPosition: {
          x: startX + (dx / horizontalLen) * maxRange,
          y: startY + (dy / len) * maxRange,
          z: startZ + (dz / horizontalLen) * maxRange
        },
        damage,
        timestamp: Date.now()
      });
    }
    _enemyAiLog(`🐍 Viper ${viper.id} drawing bow at player ${targetPlayer.id}!`);
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
    this._queueMoveIfChanged(weaver.id, weaver.position, weaver.rotation);

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
        } else if (resolved.kind === 'hostile') {
          this.weaverCastLightningOnHostile(weaver, resolved.enemy, now);
        } else if (resolved.kind === 'trap') {
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
    this._queueMoveIfChanged(weaver.id, weaver.position, weaver.rotation);

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

    const telegraphHandle = this._scheduleTimeout(() => {
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

      const hitHandle = this._scheduleTimeout(() => {
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
          this.room.tryDamageAlliedKnightInXZDisk(
            { x: landX, z: landZ },
            BOSS_TECTONIC_SHARD_RADIUS,
            WEAVER_IMPALE_SPIKE_DAMAGE,
            { sourceEnemyId: wid, damageType: 'weaver_impale_spike' },
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

    _enemyAiLog(`🧵 Weaver ${wid} casting Impale Spike on player ${targetPlayerId}`);
  }

  weaverCastLightningOnZombie(weaver, zombie, now) {
    const CHARGE_MS = 1500;
    this.weaverCastLockUntil.set(weaver.id, now + CHARGE_MS);
    this._queueMoveIfChanged(weaver.id, weaver.position, weaver.rotation);
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
    this._scheduleTimeout(() => {
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
    _enemyAiLog(`🧵 Weaver ${weaver.id} lightning (zombie) at (${tx.toFixed(1)}, ${tz.toFixed(1)})`);
  }

  weaverCastLightningOnHostile(weaver, targetEnemy, now) {
    const CHARGE_MS = 1500;
    this.weaverCastLockUntil.set(weaver.id, now + CHARGE_MS);
    this._queueMoveIfChanged(weaver.id, weaver.position, weaver.rotation);
    const tx = targetEnemy.position.x;
    const tz = targetEnemy.position.z;
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
    const tid = targetEnemy.id;
    const wid = weaver.id;
    this._scheduleTimeout(() => {
      if (!this.room?.getGameStarted()) return;
      const liveWeaver = this.room?.getEnemy(wid);
      const liveTarget = this.room?.getEnemy(tid);
      if (!liveWeaver || liveWeaver.isDying || !liveTarget || liveTarget.isDying || liveTarget.health <= 0) return;
      const rdx = liveTarget.position.x - tx;
      const rdz = liveTarget.position.z - tz;
      if (Math.sqrt(rdx * rdx + rdz * rdz) <= 2.99) {
        this.damageHostileMobFromMob(liveWeaver, liveTarget, 35, 'weaver_lightning');
      }
      this.room.tryDamageAlliedKnightInXZDisk({ x: tx, z: tz }, 2.99, 35, {
        sourceEnemyId: wid,
        damageType: 'weaver_lightning',
      });
    }, CHARGE_MS);
    _enemyAiLog(`🧵 Weaver ${weaver.id} lightning (hostile) at (${tx.toFixed(1)}, ${tz.toFixed(1)})`);
  }

  weaverCastLightningOnTrap(weaver, trap, now) {
    const CHARGE_MS = 1150;
    this.weaverCastLockUntil.set(weaver.id, now + CHARGE_MS);
    this._queueMoveIfChanged(weaver.id, weaver.position, weaver.rotation);
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
    this._scheduleTimeout(() => {
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
    _enemyAiLog(`🧵 Weaver ${weaver.id} lightning (trap) at (${tx.toFixed(1)}, ${tz.toFixed(1)})`);
  }

  // Find the allied enemy (not a player) within healRange of the weaver that has
  // the lowest current HP percentage, skipping dying/dead enemies and the weaver itself.
  findLowestHpPercentEnemy(weaver, range) {
    if (!this.room) return null;

    let lowestPct  = Infinity;
    let bestTarget = null;

    for (const enemy of this.room.enemies.values()) {
      if (enemy.id === weaver.id) continue;
      if (this.isFriendlyCombatUnit(enemy)) continue;
      if (enemy.isDying || enemy.health <= 0) continue;
      if (enemy.type === 'tentacle-spine') continue;
      if (enemy.type === 'nemesis') continue;
      if (enemy.health >= enemy.maxHealth) continue; // Already full — no point healing

      const dist = this.calculateDistance(weaver.position, enemy.position);
      if (dist > range) continue;

      const pct = enemy.health / enemy.maxHealth;
      if (pct < lowestPct) {
        lowestPct  = pct;
        bestTarget = enemy;
      }
    }

    return bestTarget;
  }

  weaverCastHeal(weaver, targetEnemy) {
    if (this.isFriendlyCombatUnit(targetEnemy)) return;

    const now = Date.now();
    // Face the heal target
    const dx = targetEnemy.position.x - weaver.position.x;
    const dz = targetEnemy.position.z - weaver.position.z;
    weaver.rotation = Math.atan2(dx, dz);
    this.weaverCastLockUntil.set(weaver.id, now + WEAVER_HEAL_CAST_LOCK_MS);
    this._queueMoveIfChanged(weaver.id, weaver.position, weaver.rotation);

    if (this.io) {
      this.io.to(this.roomId).emit('weaver-heal-telegraph', {
        weaverId:       weaver.id,
        targetEnemyId:  targetEnemy.id,
        weaverPosition: { ...weaver.position },
        targetPosition: { ...targetEnemy.position },
        timestamp:      Date.now()
      });
    }
    _enemyAiLog(`🧵 Weaver ${weaver.id} casting Heal on ${targetEnemy.id} (HP: ${targetEnemy.health}/${targetEnemy.maxHealth})`);

    // After cast animation (~1.8s) apply the actual heal.
    this._scheduleTimeout(() => {
      if (weaver.isDying || !this.room?.getGameStarted()) return;

      const liveEnemy = this.room?.getEnemy(targetEnemy.id);
      if (!liveEnemy || liveEnemy.isDying || liveEnemy.health <= 0) return;
      if (this.isFriendlyCombatUnit(liveEnemy)) return;

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
      _enemyAiLog(`🧵 Weaver ${weaver.id} healed ${liveEnemy.id} for ${actualHeal} HP (${previousHp} -> ${liveEnemy.health})`);
    }, 1800);
  }

  weaverCastLightning(weaver, targetPlayer, now) {
    // Client shows a blue ground circle; after CHARGE_MS, same dodge/damage as meteor (local check).
    const CHARGE_MS = WEAVER_LIGHTNING_CAST_LOCK_MS;
    this.weaverCastLockUntil.set(weaver.id, now + CHARGE_MS);
    this._queueMoveIfChanged(weaver.id, weaver.position, weaver.rotation);
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
    _enemyAiLog(`🧵 Weaver ${weaver.id} calling lightning at (${targetPlayer.position.x.toFixed(1)}, ${targetPlayer.position.z.toFixed(1)}) in ${CHARGE_MS}ms`);

    const strikeX = targetPlayer.position.x;
    const strikeZ = targetPlayer.position.z;
    const wid = weaver.id;
    this._scheduleTimeout(() => {
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
    this._queueMoveIfChanged(weaver.id, weaver.position, weaver.rotation);

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
    _enemyAiLog(`🧵 Weaver ${weaver.id} beginning summon ritual…`);

    const isBoss3Summon = weaver.type === 'boss3';

    // After the cast animation (~3s), spawn the ghoul
    this._scheduleTimeout(() => {
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
      _enemyAiLog(`🧵 Weaver ${weaver.id} summoned ghoul ${ghoulId} at ritual circle!`);

      // Unlock movement once the summon animation finishes (~4500ms, extended to match ritual duration)
      const speedMult = isBoss3Summon ? BOSS3_SUMMONED_GHOUL_SPEED_MULT : 1;
      this._scheduleTimeout(() => {
        const spawnedGhoul = this.room?.getEnemy(ghoulId);
        if (spawnedGhoul && !spawnedGhoul.isDying) {
          spawnedGhoul.moveSpeed = GHOUL_BASE_MOVE_SPEED * speedMult;
          _enemyAiLog(`💀 Ghoul ${ghoulId} summon animation complete — movement unlocked`);
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
      const structure = this.room?.deliriumStructure;
      const wantsStructure = ghoul.deliriumGhoul && ghoul.targetStructure
        && structure && !structure.destroyed && structure.hp > 0;
      if (!closestPlayer && !wantsStructure) return;
      aggroData = {
        targetPlayerId: closestPlayer?.id ?? null,
        targetZombieId: null,
        targetTrapId: null,
        targetStructure: wantsStructure,
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
    const ghoulProfile = getMeleeProfile('ghoul');
    const attackRange = ghoulProfile?.range ?? 2.4;

    const now = Date.now();
    const lockUntil = this.meleeLockUntil.get(ghoul.id) || 0;
    if (now < lockUntil) {
      this.tickMeleeSwingWindup(ghoul, resolved);
      return;
    }

    if (
      resolved.kind === 'player' &&
      (this.room?.coopBossesDefeatedCount ?? 0) >= 1 &&
      distance > attackRange
    ) {
      const canLeap =
        now >= this.ghoulLeapRoomSlotUntil &&
        (ghoul.spawnedAt == null || now - ghoul.spawnedAt >= GHOUL_LEAP_POST_SPAWN_DELAY_MS) &&
        (this.ghoulLeapCooldown.get(ghoul.id) == null ||
          now - (this.ghoulLeapCooldown.get(ghoul.id) || 0) >= GHOUL_LEAP_COOLDOWN_MS) &&
        !this.ghoulLeapEndAt.has(ghoul.id);
      if (canLeap) {
        this.ghoulStartLeap(ghoul, resolved.player);
        return;
      }
    }

    // Structure targets aren't in the shared melee resolver yet — keep legacy path.
    if (resolved.kind === 'structure') {
      const meleePressDistance = attackRange - MELEE_CLOSE_INSET;
      const attackCooldown = ghoul.attackCooldown ?? 2000;
      if (distance <= attackRange) {
        if (!this.ghoulAttackCooldown.has(ghoul.id)) {
          this.ghoulAttackCooldown.set(ghoul.id, 0);
        }
        const lastAttackTime = this.ghoulAttackCooldown.get(ghoul.id);
        if (now - lastAttackTime >= attackCooldown) {
          this.ghoulAttackCooldown.set(ghoul.id, now);
          this.meleeLockUntil.set(ghoul.id, now + (ghoulProfile?.swingLockMs ?? 900));
          const structurePos = {
            x: resolved.structure.position.x,
            y: 0,
            z: resolved.structure.position.z,
          };
          this.telegraphGhoulAttack(ghoul, {
            id: 'delirium-structure',
            position: structurePos,
          });
          this._scheduleTimeout(() => {
            if (ghoul.isDying || !this.room?.getGameStarted()) return;
            const liveStructure = this.room?.deliriumStructure;
            if (!liveStructure || liveStructure.destroyed || liveStructure.hp <= 0) return;
            const currentDistance = this.calculateDistance(ghoul.position, structurePos);
            if (currentDistance <= attackRange) {
              const damage = ghoul.damage || GHOUL_BASE_DAMAGE;
              this.room.damageDeliriumStructure(damage, ghoul.id);
            }
          }, ghoulProfile?.hitDelayMs ?? 700);
        } else if (distance > meleePressDistance) {
          this.moveEnemyTowardsTarget(ghoul, moveTarget, { meleeSurroundAttackRange: attackRange });
        }
      } else {
        this.moveEnemyTowardsTarget(ghoul, moveTarget, { meleeSurroundAttackRange: attackRange });
      }
      return;
    }

    this.tryMeleeEngage(ghoul, resolved, moveTarget, ghoulProfile, { now, distance });
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
      this._scheduleTimeout(() => {
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
        if (this.room?.enemies) {
          for (const other of this.room.enemies.values()) {
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
    if (now < lockUntil) {
      this.tickMeleeSwingWindup(titan);
      return;
    }

    const titanProfile = getMeleeProfile('titan');
    const attackRange = titanProfile?.range ?? TITAN_ATTACK_RANGE;
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
      if (this.performMeleeSwing(titan, resolved, titanProfile, { now })) return;
    }

    const cannonUnlocked = titan.erebusForceCannon === true
      || (this.room?.coopBossesDefeatedCount ?? 0) >= TITAN_CANNON_UNLOCK_BOSS_COUNT;
    if (
      cannonUnlocked &&
      !titan.bladestormPowerupActive &&
      !titan.bladestormActive &&
      !this.titanCannonWindupTimeout.has(titan.id) &&
      resolved.kind === 'player' &&
      distance > TITAN_CANNON_MIN_RANGE &&
      distance <= TITAN_CANNON_RANGE &&
      this._titanCanFireCannon(titan, now)
    ) {
      this.titanStartCannon(titan, resolved.player);
      return;
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
    const handle = this._scheduleTimeout(() => {
      this.titanBladestormPowerupTimeout.delete(titanId);
      this.titanCompleteBladestormPowerup(titanId);
    }, TITAN_BLADESTORM_POWERUP_MS);
    this.titanBladestormPowerupTimeout.set(titan.id, handle);
    _enemyAiLog(`🗿 Titan ${titan.id} powering up for Bladestorm at ${Math.round((titan.health / titan.maxHealth) * 100)}% HP.`);
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
    _enemyAiLog(`🗿 Titan ${titan.id} entered Bladestorm.`);
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
    const handle = this._scheduleTimeout(() => {
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
      return now - baseline >= TITAN_CANNON_BLUE_COOLDOWN_MS;
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
    if (soulType === 'green') {
      return now - baseline >= TITAN_CANNON_GREEN_COOLDOWN_MS;
    }
    return false;
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
    const handle = this._scheduleTimeout(() => {
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
        ...this._meleeTelegraphTargetFields(player),
        position: titan.position,
        timestamp: Date.now(),
      });
    }
    _enemyAiLog(`🗿 Titan ${titan.id} telegraphing attack at target ${player.id}!`);
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
        coopRoomEntryToken: this.room?.getCoopRoomEntryToken?.() ?? 0,
        timestamp: Date.now(),
      });
    }

    _enemyAiLog(`🗿 Titan ${titan.id} attacked player ${player.id} for ${damage} damage + knockback!`);

    this.room?.tryDamageAlliedKnightInXZDisk(
      { x: titan.position.x, z: titan.position.z },
      TITAN_ATTACK_RANGE,
      damage,
      { sourceEnemyId: titan.id, damageType: 'titan_melee' },
    );
  }

  // ─── Eternity Palace Heavies (Stone Giant / Eternal Oak / Colossus) ─────────

  telegraphPalaceHeavyAttack(enemy, target, attackVariant, config) {
    if (!this.io || !config) return;
    this.io.to(this.roomId).emit(`${config.eventPrefix}-attack-telegraph`, {
      [config.idField]: enemy.id,
      ...this._meleeTelegraphTargetFields(target),
      attackVariant,
      position: enemy.position,
      timestamp: Date.now(),
    });
  }

  palaceHeavyAttackPlayer(enemy, player, config) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    if (!config) return;
    const damage = enemy.damage || 50;
    this.recordAlliedProtectionThreat(enemy.id, player.id, damage);

    if (this.io) {
      this.io.to(this.roomId).emit(`${config.eventPrefix}-attack`, {
        [config.idField]: enemy.id,
        targetPlayerId: player.id,
        damage,
        position: enemy.position,
        timestamp: Date.now(),
      });

      const dx = player.position.x - enemy.position.x;
      const dz = player.position.z - enemy.position.z;
      const len = Math.hypot(dx, dz) || 1;
      this.io.to(this.roomId).emit('player-knockback', {
        targetPlayerId: player.id,
        direction: { x: dx / len, y: 0, z: dz / len },
        distance: PALACE_HEAVY_KNOCKBACK_DISTANCE,
        duration: PALACE_HEAVY_KNOCKBACK_DURATION,
        coopRoomEntryToken: this.room?.getCoopRoomEntryToken?.() ?? 0,
        timestamp: Date.now(),
      });
    }

    this.room?.tryDamageAlliedKnightInXZDisk(
      { x: enemy.position.x, z: enemy.position.z },
      PALACE_HEAVY_ATTACK_RANGE,
      damage,
      { sourceEnemyId: enemy.id, damageType: config.damageType },
    );
  }

  _palaceHeavyHasEarthbreakerTarget(enemy, players) {
    const r2 = ETERNAL_OAK_EARTHBREAKER_RADIUS * ETERNAL_OAK_EARTHBREAKER_RADIUS;
    const ox = enemy.position.x;
    const oz = enemy.position.z;
    for (const p of players) {
      if (!p || p.health <= 0) continue;
      const dx = p.position.x - ox;
      const dz = p.position.z - oz;
      if (dx * dx + dz * dz <= r2) return true;
    }
    const enemies = this.room?.getEnemies?.() || [];
    for (const ally of enemies) {
      if (!ally || ally.isDying || ally.health <= 0) continue;
      if (!this.room?._isCoopPlayerAllyEnemy?.(ally)) continue;
      const dx = (ally.position?.x ?? 0) - ox;
      const dz = (ally.position?.z ?? 0) - oz;
      if (dx * dx + dz * dz <= r2) return true;
    }
    return false;
  }

  eternalOakStartEarthbreaker(oak) {
    const now = Date.now();
    this.eternalOakEarthbreakerCooldown.set(oak.id, now);
    this.meleeLockUntil.set(oak.id, now + ETERNAL_OAK_EARTHBREAKER_CAST_MS);

    if (this.io) {
      this.io.to(this.roomId).emit('eternal-oak-earthbreaker-start', {
        eternalOakId: oak.id,
        position: { x: oak.position.x, y: oak.position.y, z: oak.position.z },
        radius: ETERNAL_OAK_EARTHBREAKER_RADIUS,
        castMs: ETERNAL_OAK_EARTHBREAKER_CAST_MS,
        stunMs: ETERNAL_OAK_EARTHBREAKER_STUN_MS,
        timestamp: now,
      });
    }

    const oakId = oak.id;
    const old = this.eternalOakEarthbreakerTimeout.get(oakId);
    if (old) clearTimeout(old);
    const handle = this._scheduleTimeout(() => {
      this.eternalOakEarthbreakerTimeout.delete(oakId);
      this.eternalOakReleaseEarthbreaker(oakId);
    }, ETERNAL_OAK_EARTHBREAKER_CAST_MS);
    this.eternalOakEarthbreakerTimeout.set(oakId, handle);
  }

  eternalOakReleaseEarthbreaker(oakId) {
    const oak = this.room?.enemies?.get(oakId);
    if (!oak || oak.type !== 'eternal-oak' || oak.isDying || oak.health <= 0) return;
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;

    this.room?.stunCombatantsInHorizontalRing?.(
      { x: oak.position.x, z: oak.position.z },
      ETERNAL_OAK_EARTHBREAKER_RADIUS,
      ETERNAL_OAK_EARTHBREAKER_STUN_MS,
      oakId,
    );

    if (this.io) {
      this.io.to(this.roomId).emit('eternal-oak-earthbreaker-impact', {
        eternalOakId: oakId,
        position: { x: oak.position.x, y: oak.position.y, z: oak.position.z },
        radius: ETERNAL_OAK_EARTHBREAKER_RADIUS,
        stunMs: ETERNAL_OAK_EARTHBREAKER_STUN_MS,
        timestamp: Date.now(),
      });
    }
  }

  updatePalaceHeavyAI(enemy, players) {
    const config = PALACE_HEAVY_CONFIG[enemy.type];
    if (!config) return;

    let aggroData = this.enemyAggro.get(enemy.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(enemy, players);
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
      this.enemyAggro.set(enemy.id, aggroData);
    }

    const now = Date.now();
    const lockUntil = this.meleeLockUntil.get(enemy.id) || 0;
    if (now < lockUntil) {
      this.tickMeleeSwingWindup(enemy);
      return;
    }

    const attackRange = PALACE_HEAVY_ATTACK_RANGE;
    const attackCooldown = enemy.attackCooldown ?? 2500;
    const aggroRadius = PALACE_HEAVY_AGGRO_RADIUS;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);

    if (!aggroData.isAggroed) {
      for (const p of players) {
        if (!p || p.health <= 0) continue;
        const dist = this.calculateDistance(enemy.position, p.position);
        if (dist <= aggroRadius && this.hasLineOfSight(enemy.position, p.position)) {
          aggroData.isAggroed = true;
          aggroData.targetPlayerId = p.id;
          aggroData.targetZombieId = null;
          aggroData.targetTrapId = null;
          break;
        }
      }
    }

    if (!aggroData.isAggroed) {
      this._moveTitanTowardsPatrolWaypoint(enemy);
      return;
    }

    // Earthbreaker — when off CD and a player/ally is in radius
    if (
      config.hasEarthbreaker &&
      !this.eternalOakEarthbreakerTimeout.has(enemy.id) &&
      (this.eternalOakEarthbreakerCooldown.get(enemy.id) == null ||
        now - (this.eternalOakEarthbreakerCooldown.get(enemy.id) || 0) >= ETERNAL_OAK_EARTHBREAKER_CD_MS) &&
      this._palaceHeavyHasEarthbreakerTarget(enemy, players)
    ) {
      this.eternalOakStartEarthbreaker(enemy);
      return;
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, enemy, players);
    if (!resolved) {
      aggroData.isAggroed = false;
      this._moveTitanTowardsPatrolWaypoint(enemy);
      return;
    }

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(enemy.position, tpos);

    if (aggroData.isAggroed && distance > leashRadius && !aggroData.threatFromDamage && !aggroData.directPlayerDamageAggroed) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
      this._moveTitanTowardsPatrolWaypoint(enemy);
      return;
    }

    const profile = getMeleeProfile(enemy.type);
    if (profile) {
      this.tryMeleeEngage(enemy, resolved, moveTarget, profile, { now, distance });
    } else {
      this.moveEnemyTowardsTarget(enemy, moveTarget, { meleeSurroundAttackRange: attackRange });
    }
  }

  /**
   * Passive-tick passives for Eternal Oak (ally heal), Stone Giant (self buff).
   * Colossus resurrection is handled on death in gameRoom.
   */
  tickPalaceHeavyAuras(now = Date.now()) {
    if (!this.room?.enemies || !this.room?.getGameStarted?.()) return;
    const enemies = this._tickEnemies.length > 0 ? this._tickEnemies : this._refreshTickEnemies();
    if (!enemies || enemies.length === 0) return;

    for (const heavy of enemies) {
      if (!heavy || heavy.isDying || (heavy.health ?? 0) <= 0) continue;
      if (!PALACE_HEAVY_TYPES.has(heavy.type)) continue;

      if (heavy.type === 'eternal-oak') {
        this._tickEternalOakHealAura(heavy, enemies, now);
      } else if (heavy.type === 'stone-giant') {
        this._tickStoneGiantBuffAura(heavy, enemies);
      }
    }
  }

  _isPalaceAuraAlly(enemy, selfId) {
    if (!enemy || enemy.id === selfId) return false;
    if (enemy.isDying || (enemy.health ?? 0) <= 0) return false;
    if (this.isFriendlyCombatUnit(enemy)) return false;
    if (enemy.isTrap || enemy.type === 'tentacle-spine' || enemy.type === 'training-dummy') return false;
    if (
      enemy.type === 'boss'
      || enemy.type === 'boss2'
      || enemy.type === 'boss3'
      || enemy.type === 'destiny'
    ) {
      return false;
    }
    return true;
  }

  _tickEternalOakHealAura(oak, enemies, now) {
    const last = oak._eternalOakAuraHealAt || 0;
    if (now - last < 1000) return;
    oak._eternalOakAuraHealAt = now;

    const heals = [];
    const radiusSq = PALACE_AURA_RADIUS * PALACE_AURA_RADIUS;
    const ox = oak.position.x;
    const oz = oak.position.z;
    for (const ally of enemies) {
      if (!this._isPalaceAuraAlly(ally, oak.id)) continue;
      const dx = ox - (ally.position?.x ?? 0);
      const dz = oz - (ally.position?.z ?? 0);
      if (dx * dx + dz * dz > radiusSq) continue;
      const maxHp = ally.maxHealth ?? 0;
      if (maxHp <= 0 || ally.health >= maxHp) continue;
      const previousHealth = ally.health;
      ally.health = Math.min(maxHp, ally.health + ETERNAL_OAK_HEAL_PER_SEC);
      const actualHeal = ally.health - previousHealth;
      if (actualHeal <= 0) continue;
      heals.push({
        enemyId: ally.id,
        healAmount: actualHeal,
        newHealth: ally.health,
        maxHealth: maxHp,
        healingType: 'eternal_oak_aura',
        position: {
          x: ally.position?.x ?? 0,
          y: ally.position?.y ?? 0,
          z: ally.position?.z ?? 0,
        },
        timestamp: now,
      });
    }
    if (heals.length === 0 || !this.io) return;
    // Single socket event for the whole aura tick (clients accept `heals` array or legacy single).
    this.io.to(this.roomId).emit('enemy-healed', { heals, timestamp: now });
  }

  _tickStoneGiantBuffAura(giant, enemies) {
    if (giant._stoneGiantBaseDamage == null) {
      giant._stoneGiantBaseDamage = giant.damage ?? 54;
    }
    if (giant._stoneGiantBaseMoveSpeed == null) {
      giant._stoneGiantBaseMoveSpeed = giant.moveSpeed ?? 2.25;
    }

    let nearbyCount = 0;
    for (const ally of enemies) {
      if (!this._isPalaceAuraAlly(ally, giant.id)) continue;
      const dist = this.calculateDistance(giant.position, ally.position);
      if (dist <= PALACE_AURA_RADIUS) nearbyCount += 1;
    }

    const maxAllyStacks = Math.floor(STONE_GIANT_MAX_BONUS_SPEED / STONE_GIANT_SPEED_PER_ALLY);
    const bonusCount = Math.min(nearbyCount, maxAllyStacks);
    giant.damage = giant._stoneGiantBaseDamage + bonusCount * STONE_GIANT_DAMAGE_PER_ALLY;
    giant.moveSpeed = giant._stoneGiantBaseMoveSpeed + bonusCount * STONE_GIANT_SPEED_PER_ALLY;
  }

  telegraphGhoulAttack(ghoul, player) {
    if (this.io) {
      this.io.to(this.roomId).emit('ghoul-attack-telegraph', {
        ghoulId:       ghoul.id,
        ...this._meleeTelegraphTargetFields(player),
        position:       ghoul.position,
        timestamp:      Date.now()
      });
    }
    _enemyAiLog(`💀 Ghoul ${ghoul.id} telegraphing attack at player ${player.id}!`);
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
    _enemyAiLog(`💀 Ghoul ${ghoul.id} attacked player ${player.id} for ${damage} damage!`);

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
    const handle = this._scheduleTimeout(() => {
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
        speed = getPlayerDashDistance(targetPlayer) / PLAYER_DASH_DURATION_S;
      }
    } else {
      dirX = md.x;
      dirZ = md.z;
      const mag = Math.hypot(dirX, dirZ);
      if (mag > 0.01) {
        dirX /= mag;
        dirZ /= mag;
        speed = PLAYER_COOP_MAX_SPEED * (md.inputStrength ?? 1);
        if (md.isSprinting) {
          speed *= PLAYER_COOP_SPRINT_MULTIPLIER;
        }
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
    this._queueMoveIfChanged(boss.id, boss.position, boss.rotation);
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
    const t = this._scheduleTimeout(() => {
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
      this._queueMoveIfChanged(bossId, boss.position, boss.rotation);
    }
  }

  ghoulStartLeap(ghoul, targetPlayer) {
    const now = Date.now();
    if (now < this.ghoulLeapRoomSlotUntil) {
      return;
    }
    if (
      ghoul.spawnedAt != null &&
      now - ghoul.spawnedAt < GHOUL_LEAP_POST_SPAWN_DELAY_MS
    ) {
      return;
    }

    this.ghoulLeapRoomSlotUntil = now + GHOUL_LEAP_ROOM_SLOT_MS;

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
    const t = this._scheduleTimeout(() => {
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
      this.room.tryDamageAlliedKnightInXZDisk(
        land,
        GHOUL_LEAP_LANDING_RADIUS,
        leapDamage,
        { sourceEnemyId: ghoulId, damageType: 'ghoul_leap' },
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
    const t = this._scheduleTimeout(() => {
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
      this.room.tryDamageAlliedKnightInXZDisk(
        land,
        TEMPLAR_LEAP_LANDING_RADIUS,
        TEMPLAR_LEAP_DAMAGE,
        { sourceEnemyId: templarId, damageType: 'templar_leap' },
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

  tigerStartPounce(tiger, targetPlayer) {
    const fromX = tiger.position.x;
    const fromZ = tiger.position.z;
    const { x: landX, z: landZ } = this.computeMobLeapLandXZ(
      tiger,
      targetPlayer,
      TIGER_POUNCE_MAX_TRAVEL,
      TIGER_POUNCE_LAND_STANDOFF_M,
      TIGER_POUNCE_DURATION_MS,
    );
    const endAt = Date.now() + TIGER_POUNCE_DURATION_MS;
    this.tigerPounceEndAt.set(tiger.id, endAt);
    this.tigerPounceLand.set(tiger.id, { x: landX, z: landZ });
    this.tigerPounceFrom.set(tiger.id, { x: fromX, z: fromZ });
    this.meleeLockUntil.set(tiger.id, endAt);
    if (this.io) {
      this.io.to(this.roomId).emit('tiger-pounce-start', {
        tigerId: tiger.id,
        startPosition: { x: tiger.position.x, y: tiger.position.y, z: tiger.position.z },
        landPosition: { x: landX, y: 0, z: landZ },
        durationMs: TIGER_POUNCE_DURATION_MS,
        timestamp: Date.now(),
      });
    }
    const tigerId = tiger.id;
    const t = this._scheduleTimeout(() => {
      this.tigerCompletePounce(tigerId);
    }, TIGER_POUNCE_DURATION_MS);
    this.tigerPounceTimeout.set(tiger.id, t);
  }

  tigerCompletePounce(tigerId) {
    this.tigerPounceTimeout.delete(tigerId);
    this.tigerPounceEndAt.delete(tigerId);
    const land = this.tigerPounceLand.get(tigerId);
    this.tigerPounceLand.delete(tigerId);
    this.tigerPounceFrom.delete(tigerId);
    const tiger = this.room?.enemies?.get(tigerId);
    if (!tiger || tiger.isDying || tiger.health <= 0) return;
    if (land) {
      tiger.position.x = land.x;
      tiger.position.z = land.z;
    }
    this.tigerPounceCooldown.set(tigerId, Date.now());
    if (this.room) {
      const pounceDamage = tiger.pounceDamage ?? TIGER_POUNCE_DAMAGE;
      this.room.damagePlayersInHorizontalRing(
        land,
        TIGER_POUNCE_LANDING_RADIUS,
        pounceDamage,
        'tiger_pounce',
        { sourceEnemyId: tigerId },
      );
      this.room.tryDamageAlliedKnightInXZDisk(
        land,
        TIGER_POUNCE_LANDING_RADIUS,
        pounceDamage,
        { sourceEnemyId: tigerId, damageType: 'tiger_pounce' },
      );
    }
    if (this.io) {
      this.io.to(this.roomId).emit('tiger-pounce-land', {
        tigerId,
        landPosition: land
          ? { x: land.x, y: 0, z: land.z }
          : { x: tiger.position.x, y: 0, z: tiger.position.z },
        timestamp: Date.now(),
      });
      this._queueMove(tigerId, tiger.position, tiger.rotation);
    }
  }

  tickTigerPounceFlight(tiger) {
    if (!this.tigerPounceEndAt.has(tiger.id)) return false;
    const now = Date.now();
    const end = this.tigerPounceEndAt.get(tiger.id);
    const land = this.tigerPounceLand.get(tiger.id);
    const from = this.tigerPounceFrom.get(tiger.id);
    if (now < end && land && from) {
      const startTime = end - TIGER_POUNCE_DURATION_MS;
      let u = (now - startTime) / TIGER_POUNCE_DURATION_MS;
      if (u < 0) u = 0;
      if (u > 1) u = 1;
      const su = u * u * (3 - 2 * u);
      tiger.position.x = from.x + (land.x - from.x) * su;
      tiger.position.z = from.z + (land.z - from.z) * su;
      tiger.rotation = Math.atan2(land.x - from.x, land.z - from.z);
      this._queueMove(tiger.id, tiger.position, tiger.rotation);
      return true;
    }
    if (now < end) return true;
    if (this.tigerPounceLand.has(tiger.id)) {
      this.tigerCompletePounce(tiger.id);
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
      const livingAdds = [...(this.room?.enemies?.values?.() ?? [])].filter(
        (e) => e.summonedByBoss2Id === boss.id && !e.isDying && (e.health ?? 0) > 0,
      ).length;
      if (livingAdds < BOSS2_WARLOCK_SUMMON_MAX_LIVING) {
        this.boss2WarlockSummonLastAt.set(boss.id, now);
        this.boss2SummonPurpleWarlock(boss);
      } else {
        this.boss2WarlockSummonLastAt.set(boss.id, now);
      }
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

  addKnightDeathGraspTimer(knightId, timer) {
    const timers = this.knightDeathGraspTimeouts.get(knightId) || [];
    timers.push(timer);
    this.knightDeathGraspTimeouts.set(knightId, timers);
  }

  clearKnightDeathGraspTimers(knightId) {
    const timers = this.knightDeathGraspTimeouts.get(knightId);
    if (timers) {
      timers.forEach((t) => clearTimeout(t));
    }
    this.knightDeathGraspTimeouts.delete(knightId);
  }

  _isCoopPortalPositionWriteBlocked() {
    if (!this.room) return false;
    if (
      typeof this.room.isCoopCombatTransitionActive === 'function' &&
      this.room.isCoopCombatTransitionActive()
    ) {
      return true;
    }
    if (
      typeof this.room.isCoopPostTeleportPositionGuardActive === 'function' &&
      this.room.isCoopPostTeleportPositionGuardActive()
    ) {
      return true;
    }
    return false;
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

    if (this.room?.bannedEnemyTypes?.has('warlock')) {
      return;
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
    _enemyAiLog(`👹 Boss2 ${boss.id} summoned purple warlock ${warlockId} at (${pos.x.toFixed(2)}, ${pos.z.toFixed(2)})`);
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
      this._queueMoveIfChanged(bossId, boss.position, boss.rotation);
      this.io.to(this.roomId).emit('boss2-deathgrasp-telegraph', {
        bossId,
        targetPlayerId: targetId,
        castMs: BOSS2_DEATH_GRASP_CAST_MS,
        timestamp: startedAt,
      });
    }

    const launchTimer = this._scheduleTimeout(() => {
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

      const resolveTimer = this._scheduleTimeout(() => {
        const k = this.room?.getEnemy(bossId);
        const currentPlayers = this.room?.getPlayers();
        if (!this.room?.getGameStarted() || !k || k.isDying || k.health <= 0 || !currentPlayers) return;
        if (this._isCoopPortalPositionWriteBlocked()) return;

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
              { authoritative: true },
            );

            if (this.io) {
              this.io.to(this.roomId).emit('boss2-deathgrasp-pull', {
                bossId,
                targetPlayerId: currentPlayer.id,
                position: newPosition,
                rotation: rot,
                coopRoomEntryToken: this.room?.getCoopRoomEntryToken?.() ?? 0,
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
        this._queueMoveIfChanged(boss.id, boss.position, boss.rotation);
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
      this._queueMoveIfChanged(boss.id, boss.position, boss.rotation);
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
      _enemyAiLog(`🕸 Boss3 ${boss.id} summons ghoul (charges left ${boss.summonChargesLeft}).`);
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

    this._queueMoveIfChanged(boss.id, boss.position, boss.rotation);
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
      const ax = live.position.x + fx * BOSS3_GREEN_BEAM_WORLD_START_OFFSET;
      const az = live.position.z + fz * BOSS3_GREEN_BEAM_WORLD_START_OFFSET;
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

    _enemyAiLog(`🕸 Boss3 ${bossId} green beam channel (${BOSS3_GREEN_BEAM_DURATION_MS}ms).`);
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

      _enemyAiLog(`🕸 Boss3 ${live.id} 50% lightning phase — 3 staggered strikes.`);
    };

    castLightningGroup();
    const interval = setInterval(castLightningGroup, BOSS3_LIGHTNING_INTERVAL_MS);
    this.boss3LightningInterval.set(boss.id, interval);
    _enemyAiLog(`🕸 Boss3 ${boss.id} entered persistent lightning phase at ${Math.round((boss.health / boss.maxHealth) * 100)}% HP.`);
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
    const t = this._scheduleTimeout(() => {
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

    _enemyAiLog(`🕸 Boss3 ${live.id} arcane nova round ${roundIndex + 1}/${burstRounds} — 3 discs.`);
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

    const windupTimer = this._scheduleTimeout(() => {
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

      _enemyAiLog(
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
      this._queueMoveIfChanged(boss.id, boss.position, boss.rotation);
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

    const h1 = this._scheduleTimeout(() => erupt(pillar1), BOSS2_FLAME_PILLAR_BLINK_DELAY_MS);
    const h2 = this._scheduleTimeout(() => erupt(pillar2), BOSS2_FLAME_PILLAR_BLINK_DELAY_MS + BOSS2_FLAME_PILLAR_STAGGER_MS);
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
    const bossSkyY = boss.position.y + BOSS2_ARCHON_LIGHTNING_SKY_Y_OFFSET;

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

    const handle = this._scheduleTimeout(() => {
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
        if (this._isCoopPortalPositionWriteBlocked()) return;

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
          this._queueMoveIfChanged(boss.id, boss.position, boss.rotation);
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
      this.tickMeleeSwingWindup(boss);
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

    // Block all movement while the throw animation plays
    if (this.bossThrowEndAt.has(boss.id)) {
      this.updateBossRotation(boss, targetPlayer);
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
      this.moveEnemyTowardsTarget(boss, targetPlayer, { stopThreshold: 0.5 });
    } else {
      this.updateBossRotation(boss, targetPlayer);
      const bossProfile = getMeleeProfile('boss');
      this.performMeleeSwing(boss, { kind: 'player', player: targetPlayer }, bossProfile, { now });
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
        ...this._meleeTelegraphTargetFields(player),
        position: boss.position,
        meleeIndex,
        timestamp: Date.now(),
      });
    }
    _enemyAiLog(`🔥 Boss ${boss.id} telegraphing melee ${meleeIndex} at player ${player.id}!`);
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
    _enemyAiLog(`🔥 Boss ${boss.id} attacked player ${player.id} for ${damage} damage (melee ${meleeIndex})`);
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

    const t = this._scheduleTimeout(() => {
      this.bossCompleteThrow(boss.id);
    }, BOSS_THROW_SPEAR_RELEASE_MS);
    this.bossThrowTimeout.set(boss.id, t);
    _enemyAiLog(`🗡️  Boss ${boss.id} starting throw at player ${targetPlayer.id}`);
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
    _enemyAiLog(`🗡️  Boss ${bossId} launched spear toward (${staleTarget.x.toFixed(1)}, ${staleTarget.z.toFixed(1)})`);
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

    _enemyAiLog(`💀 Boss ${boss.id} summoned skeleton ${skeletonId} at position (${skeletonPosition.x.toFixed(2)}, ${skeletonPosition.z.toFixed(2)})`);
  }

  // Track when a boss skeleton is killed
  removeBossSkeleton(bossId, skeletonId) {
    const skeletons = this.bossSummonedSkeletons.get(bossId);
    if (skeletons) {
      skeletons.delete(skeletonId);
      _enemyAiLog(`💀 Skeleton ${skeletonId} removed from boss ${bossId}'s summons (${skeletons.size}/2 remaining)`);
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
      if (process.env.NODE_ENV !== 'production') {
        _enemyAiLog(`👤 Stealth aggro bonus: Player ${playerId} stealth attack (${damage} damage) -> ${effectiveDamage} effective aggro`);
      }
    }

    const currentDamage = damageMap.get(playerId) || 0;
    damageMap.set(playerId, currentDamage + effectiveDamage);

    if (process.env.NODE_ENV !== 'production') {
      _enemyAiLog(`📊 Boss aggro - Player ${playerId} has dealt ${currentDamage + effectiveDamage} total damage to boss ${bossId}${player?.isStealthing ? ' (STEALTH BONUS)' : ''}`);
    }
  }

  findClosestPlayer(enemy, players) {
    const enemyId = enemy?.id;
    const cache = this._closestPlayerCache;
    const tick = this._aiTickId | 0;
    if (enemyId != null && cache) {
      const cached = cache.get(enemyId);
      // Reuse for current tick and the previous one (~33–66ms) — same targeting intent.
      if (cached && tick - cached.tick <= 1 && cached.player && cached.player.health > 0) {
        return cached.player;
      }
    }

    let closestPlayer = null;
    let closestDistSq = Infinity;
    const ex = enemy.position.x;
    const ez = enemy.position.z;

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      // Skip dead players (health <= 0)
      if (player.health <= 0) continue;

      const dx = ex - player.position.x;
      const dz = ez - player.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closestPlayer = player;
      }
    }

    if (enemyId != null && cache) {
      cache.set(enemyId, { tick, player: closestPlayer });
    }

    return closestPlayer;
  }

  /** Smoothly (or instantly) rotate an enemy on the XZ plane to face a world point. */
  _smoothRotateEnemyTowardPoint(enemy, targetPos, options = {}) {
    const { instant = false } = options;
    if (!enemy || !targetPos) return false;

    const dx = targetPos.x - enemy.position.x;
    const dz = targetPos.z - enemy.position.z;
    const magnitude = Math.hypot(dx, dz);
    if (magnitude === 0) return false;

    const targetRotation = Math.atan2(dx, dz);
    const currentRotation = enemy.rotation || 0;

    let rotationDiff = targetRotation - currentRotation;
    while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

    if (instant) {
      enemy.rotation = targetRotation;
    } else {
      const deltaTime = this.updateInterval / 1000;
      const rotationSpeed = 4.0;
      const rotationStep = rotationDiff * Math.min(1, rotationSpeed * deltaTime);
      enemy.rotation = currentRotation + rotationStep;
    }

    while (enemy.rotation > Math.PI) enemy.rotation -= Math.PI * 2;
    while (enemy.rotation < -Math.PI) enemy.rotation += Math.PI * 2;

    return true;
  }

  // Update boss rotation to face target (called even when stationary)
  updateBossRotation(boss, targetPlayer) {
    if (!targetPlayer) return;
    if (this._smoothRotateEnemyTowardPoint(boss, targetPlayer.position)) {
      this._queueMoveIfChanged(boss.id, boss.position, boss.rotation);
    }
  }

  getMeleeBodyRadius(type) {
    switch (type) {
      case 'knight':
      case 'allied-knight':
        return 0.85;
      case 'allied-demon':
        return 0.85;
      case 'allied-tiger':
        return 0.9;
      case 'allied-wolf':
        return 0.58;
      case 'allied-bear':
        return 1.0;
      case 'allied-serpent':
        return 0.7;
      case 'allied-spider':
        return 0.55;
      case 'tiger':
        return 0.9;
      case 'boss-tiger':
        return 0.9 * 1.4;
      case 'wolf':
        return 0.65;
      case 'boss-wolf':
        return 0.65 * 2.0;
      case 'bear':
        return 1.0;
      case 'boss-bear':
        return 1.0 * 1.4;
      case 'allied-huntress':
        return 0.75;
      case 'templar':
      case 'ghoul':
      case 'serpent':
      case 'skyray':
        return 0.95;
      case 'terrorhawk':
        return 0.76;
      case 'boss-serpent':
        return 0.95 * 1.4;
      case 'wyvern':
        return 1.05;
      case 'destiny':
        return 1.8;
      case 'bone-spider':
        return 1.35;
      case 'spectre':
      case 'death-knight':
      case 'shaman':
      case 'assassin':
      case 'sentinel':
        return 0.9;
      case 'titan':
      case 'nemesis':
      case 'stone-giant':
      case 'eternal-oak':
      case 'colossus':
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
   * Reuses the grid Map and bucket arrays across ticks.
   */
  _buildMeleePeerGrid(enemies) {
    const CELL = 2.5;
    if (!this._meleePeerGrid) {
      this._meleePeerGrid = { grid: new Map(), cellSize: CELL };
    }
    const data = this._meleePeerGrid;
    const { grid } = data;
    for (const bucket of grid.values()) {
      bucket.length = 0;
      this._meleePeerBucketPool.push(bucket);
    }
    grid.clear();

    for (const e of enemies) {
      if (!e || e.isDying || e.health <= 0) continue;
      if (!MELEE_SURROUND_TYPES.has(e.type)) continue;
      const cx = Math.floor(e.position.x / CELL);
      const cz = Math.floor(e.position.z / CELL);
      const key = `${cx},${cz}`;
      let bucket = grid.get(key);
      if (!bucket) {
        bucket = this._meleePeerBucketPool.pop() || [];
        grid.set(key, bucket);
      }
      bucket.push(e);
    }
    return data;
  }

  _getMeleePeersNear(x, z) {
    if (!this._meleePeerGrid) {
      return this._tickEnemies.filter(
        (e) => e && !e.isDying && e.health > 0 && MELEE_SURROUND_TYPES.has(e.type),
      );
    }
    const { grid, cellSize } = this._meleePeerGrid;
    const cx = Math.floor(x / cellSize);
    const cz = Math.floor(z / cellSize);
    const out = this._meleePeerScratch;
    out.length = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const bucket = grid.get(`${cx + dx},${cz + dz}`);
        if (bucket) {
          for (let i = 0; i < bucket.length; i++) out.push(bucket[i]);
        }
      }
    }
    return out;
  }

  _resetAStarBuffers(cellCount) {
    if (!this._astarGScore || this._astarGScore.length !== cellCount) {
      this._astarGScore = new Float32Array(cellCount);
      this._astarCameFrom = new Int32Array(cellCount);
      this._astarInOpen = new Uint8Array(cellCount);
      this._astarVisitGen = new Uint32Array(cellCount);
      this._astarSearchGen = 0;
    }
    // Generation counter: stale cells are treated as unset (no full .fill each search).
    this._astarSearchGen = (this._astarSearchGen + 1) >>> 0;
    if (this._astarSearchGen === 0) {
      this._astarVisitGen.fill(0);
      this._astarSearchGen = 1;
    }
    return {
      gScore: this._astarGScore,
      cameFrom: this._astarCameFrom,
      inOpen: this._astarInOpen,
      visitGen: this._astarVisitGen,
      searchGen: this._astarSearchGen,
    };
  }

  /**
   * Spatial bucket of all living enemies for aggro/targeting queries (Spectre/Nemesis/Valkyrie).
   * Mirrors `_buildMeleePeerGrid` but includes every living unit.
   */
  _buildEnemySpatialGrid(enemies) {
    const CELL = ENEMY_SPATIAL_CELL;
    if (!this._enemySpatialGrid) {
      this._enemySpatialGrid = { grid: new Map(), cellSize: CELL };
    }
    const data = this._enemySpatialGrid;
    const { grid } = data;
    for (const bucket of grid.values()) {
      bucket.length = 0;
      this._enemySpatialBucketPool.push(bucket);
    }
    grid.clear();

    for (const e of enemies) {
      if (!e || e.isDying || e.health <= 0 || !e.position) continue;
      const cx = Math.floor(e.position.x / CELL);
      const cz = Math.floor(e.position.z / CELL);
      const key = `${cx},${cz}`;
      let bucket = grid.get(key);
      if (!bucket) {
        bucket = this._enemySpatialBucketPool.pop() || [];
        grid.set(key, bucket);
      }
      bucket.push(e);
    }
    return data;
  }

  /**
   * Nearby living enemies within `radius` (XZ broadphase via spatial grid).
   * Falls back to `_tickEnemies` when the grid is unavailable (e.g. async hazard callbacks).
   */
  _getEnemiesNear(x, z, radius) {
    const out = this._enemySpatialScratch;
    out.length = 0;
    if (!this._enemySpatialGrid) {
      const fallback = this._tickEnemies.length > 0 ? this._tickEnemies : null;
      if (fallback) {
        const r2 = radius * radius;
        for (let i = 0; i < fallback.length; i++) {
          const e = fallback[i];
          if (!e || e.isDying || e.health <= 0 || !e.position) continue;
          const dx = e.position.x - x;
          const dz = e.position.z - z;
          if (dx * dx + dz * dz <= r2) out.push(e);
        }
      } else if (this.room?.enemies) {
        const r2 = radius * radius;
        for (const e of this.room.enemies.values()) {
          if (!e || e.isDying || e.health <= 0 || !e.position) continue;
          const dx = e.position.x - x;
          const dz = e.position.z - z;
          if (dx * dx + dz * dz <= r2) out.push(e);
        }
      }
      return out;
    }
    const { grid, cellSize } = this._enemySpatialGrid;
    const cx = Math.floor(x / cellSize);
    const cz = Math.floor(z / cellSize);
    const cellR = Math.max(1, Math.ceil(radius / cellSize));
    const r2 = radius * radius;
    for (let dx = -cellR; dx <= cellR; dx++) {
      for (let dz = -cellR; dz <= cellR; dz++) {
        const bucket = grid.get(`${cx + dx},${cz + dz}`);
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const e = bucket[i];
          const ex = e.position.x - x;
          const ez = e.position.z - z;
          if (ex * ex + ez * ez <= r2) out.push(e);
        }
      }
    }
    return out;
  }

  /**
   * Push this enemy's proposed position away from other melee peers (2 passes).
   * @param {string|null} [excludeTargetId] Combat focus to skip so 1v1 closers aren't pushed apart.
   */
  resolveMeleePeerSeparation(selfEnemy, x, z, excludeTargetId = null) {
    if (!this.room || !MELEE_SURROUND_TYPES.has(selfEnemy.type)) {
      return { x, z };
    }
    const rSelf = this.getMeleeBodyRadius(selfEnemy.type);
    let rx = x;
    let rz = z;

    for (let iter = 0; iter < 2; iter++) {
      for (const other of this._getMeleePeersNear(rx, rz)) {
        if (!other || other.id === selfEnemy.id || other.isDying || other.health <= 0) continue;
        if (excludeTargetId && other.id === excludeTargetId) continue;
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
    const speedMultiplier = options?.speedMultiplier ?? 1;

    const stopThreshold = options?.stopThreshold ?? (useSurround ? 0.3 : 2.0);
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
    const moveDistance = moveSpeed * speedMultiplier * deltaTime;

    const rawX = enemy.position.x + dirX * moveDistance;
    const rawZ = enemy.position.z + dirZ * moveDistance;

    let resolved = this.resolveEnemyWallCollisions(rawX, rawZ);
    if (useSurround) {
      resolved = this.resolveMeleePeerSeparation(
        enemy,
        resolved.x,
        resolved.z,
        options.combatTargetId ?? targetPlayer.id ?? null,
      );
    }
    enemy.position.x = resolved.x;
    enemy.position.z = resolved.z;

    // Face the direction of travel
    enemy.rotation = Math.atan2(dirX, dirZ);

    this._queueMoveIfChanged(enemy.id, enemy.position, enemy.rotation);
  }

  // Get movement speed modified by status effects
  getModifiedMovementSpeed(enemyId, baseSpeed) {
    if (!this.room) return baseSpeed;
    
    let modifiedSpeed = baseSpeed;
    
    // Check for freeze effect - sets speed to 0
    if (this.room.isEnemyAffectedBy(enemyId, 'freeze')) {
      return 0;
    }

    if (this.room.isEnemyAffectedBy(enemyId, 'hostileFreeze')) {
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

    if (this.room.isEnemyAffectedBy(enemyId, 'hostileRoot')) {
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
      case 'destiny': return DESTINY_BASE_MOVE_SPEED;
      case 'boss-skeleton': return 1.75;
      case 'shade':   return 2.22;
      case 'warlock': return 0.0; // Stationary — moves only via blink
      case 'viper':   return 2.0;
      case 'templar': return 3.2;
      case 'weaver':  return 2.0;
      case 'ghoul':   return 2.22;
      case 'titan':   return 2.5;
      case 'stone-giant': return 2.25;
      case 'eternal-oak': return 2.0;
      case 'colossus': return 2.65;
      case 'martyr':  return 3.0;
      case 'wraith':  return 2.5;
      case 'spectre': return 2.75;
      case 'death-knight': return 2.5;
      case 'shaman': return 2.45;
      case 'assassin': return 2.25;
      case 'serpent': return SERPENT_BASE_MOVE_SPEED;
      case 'boss-serpent': return SERPENT_BASE_MOVE_SPEED;
      case 'tiger': return TIGER_WALK_SPEED;
      case 'boss-tiger': return TIGER_WALK_SPEED;
      case 'wolf': return WOLF_MOVE_SPEED;
      case 'boss-wolf': return WOLF_MOVE_SPEED;
      case 'bear': return BEAR_MOVE_SPEED;
      case 'boss-bear': return BEAR_MOVE_SPEED;
      case 'skyray': return SKYRAY_CHASE_SPEED;
      case 'terrorhawk': return 0;
      case 'frost-queen': return 0.0; // Stationary — moves only via teleport
      case 'medusa': return 0.0; // Stationary caster
      case 'wyvern': return WYVERN_BASE_MOVE_SPEED;
      case 'bone-spider': return BONE_SPIDER_MOVE_SPEED;
      case 'sentinel': return 2.0;
      case 'nemesis': return 2.5;
      case 'valkyrie': return VALKYRIE_WALK_SPEED;
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
   * @returns {{ tempestInitiate: boolean; necrosInitiate: boolean; infernalInitiate: boolean; abyssalInitiate: boolean; agility: number; strength: number; stamina: number; intellect: number }}
   */
  getCoopAlliedKnightBoons() {
    const now = Date.now();
    if (this._cachedAlliedKnightBoons && now - this._alliedKnightBoonsCachedAt < 1000) {
      return this._cachedAlliedKnightBoons;
    }
    const result = {
      tempestInitiate: false,
      necrosInitiate: false,
      infernalInitiate: false,
      abyssalInitiate: false,
      agility: 0,
      strength: 0,
      stamina: 0,
      intellect: 0,
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
        result.stamina = Math.max(result.stamina, typeof b.stamina === 'number' ? b.stamina : 0);
        result.intellect = Math.max(result.intellect, typeof b.intellect === 'number' ? b.intellect : 0);
        result.agility = Math.max(result.agility, typeof b.agility === 'number' ? b.agility : 0);
      }
      if (b.abyssalInitiate) {
        result.abyssalInitiate = true;
      }
    }
    this._cachedAlliedKnightBoons = result;
    this._alliedKnightBoonsCachedAt = now;
    return result;
  }

  applyNecrosInitiateIfNeeded(ally, boons) {
    if (!boons.necrosInitiate || ally.necrosBoonApplied) return;
    ally.necrosBoonApplied = true;
    const priorMax = ally.maxHealth || 0;
    const newMax = NECROS_INITIATE_KNIGHT_BASE_HP + boons.stamina * NECROS_INITIATE_KNIGHT_HP_PER_STAMINA;
    const hpIncrease = Math.max(0, newMax - priorMax);
    ally.maxHealth = newMax;
    ally.health = Math.min(newMax, (ally.health || 0) + hpIncrease);
  }

  getHuntressShotCooldownMs(boons) {
    let cooldown = ALLIED_HUNTRESS_ATTACK_COOLDOWN_MS;
    if (boons.abyssalInitiate) cooldown -= ABYSSAL_INITIATE_HUNTRESS_COOLDOWN_REDUCTION_MS;
    if (boons.tempestInitiate) cooldown -= ABYSSAL_INITIATE_HUNTRESS_COOLDOWN_REDUCTION_MS;
    return Math.max(0, cooldown);
  }

  getHuntressArrowDamage(ally, boons) {
    if (boons.infernalInitiate) {
      return INFERNAL_INITIATE_HUNTRESS_BASE_DAMAGE + boons.agility * INFERNAL_INITIATE_HUNTRESS_DAMAGE_PER_AGILITY;
    }
    return ally.damage || ALLIED_HUNTRESS_DAMAGE_FALLBACK;
  }

  getDemonMeleeCooldownMs(boons) {
    let cooldown = ALLIED_DEMON_ATTACK_COOLDOWN_MS;
    if (boons.abyssalInitiate) cooldown -= ABYSSAL_INITIATE_DEMON_COOLDOWN_REDUCTION_MS;
    return Math.max(0, cooldown);
  }

  getDemonMeleeDamage(ally, boons) {
    if (boons.infernalInitiate) {
      return INFERNAL_INITIATE_DEMON_BASE_DAMAGE
        + (boons.stamina + boons.strength) * INFERNAL_INITIATE_DEMON_DAMAGE_PER_STAMINA_OR_STRENGTH;
    }
    return ally.damage || ALLIED_DEMON_DAMAGE_FALLBACK;
  }

  getDemonLeapCooldownMs(boons) {
    return boons.tempestInitiate ? TEMPEST_INITIATE_DEMON_LEAP_COOLDOWN_MS : ALLIED_DEMON_LEAP_COOLDOWN_MS;
  }

  getDemonLeapDamage(boons) {
    if (boons.tempestInitiate) {
      return TEMPEST_INITIATE_DEMON_LEAP_BASE_DAMAGE + boons.agility * TEMPEST_INITIATE_DEMON_LEAP_DAMAGE_PER_AGILITY;
    }
    return ALLIED_DEMON_LEAP_DAMAGE;
  }

  getEnchantressEarthShockCooldownMs(boons) {
    let cooldown = ALLIED_ENCHANTRESS_EARTH_SHOCK_COOLDOWN_MS;
    if (boons.abyssalInitiate) cooldown -= ABYSSAL_INITIATE_ENCHANTRESS_EARTH_SHOCK_COOLDOWN_REDUCTION_MS;
    if (boons.tempestInitiate) cooldown -= ABYSSAL_INITIATE_ENCHANTRESS_EARTH_SHOCK_COOLDOWN_REDUCTION_MS;
    return Math.max(0, cooldown);
  }

  getEnchantressEarthShockDamage(boons) {
    if (boons.infernalInitiate) {
      return INFERNAL_INITIATE_ENCHANTRESS_EARTH_SHOCK_BASE_DAMAGE
        + boons.intellect * INFERNAL_INITIATE_ENCHANTRESS_EARTH_SHOCK_DAMAGE_PER_INTELLECT;
    }
    return ALLIED_ENCHANTRESS_EARTH_SHOCK_DAMAGE;
  }

  getPhantomComboCooldownMs(boons) {
    let cooldown = ALLIED_PHANTOM_COMBO_COOLDOWN_MS;
    if (boons.abyssalInitiate) cooldown -= ABYSSAL_INITIATE_PHANTOM_COMBO_COOLDOWN_REDUCTION_MS;
    if (boons.tempestInitiate) cooldown -= ABYSSAL_INITIATE_PHANTOM_COMBO_COOLDOWN_REDUCTION_MS;
    return Math.max(0, cooldown);
  }

  getPhantomDaggerDamage(ally, boons) {
    if (boons.infernalInitiate) {
      return INFERNAL_INITIATE_PHANTOM_BASE_DAMAGE + boons.agility * INFERNAL_INITIATE_PHANTOM_DAMAGE_PER_AGILITY;
    }
    return ally.damage || ALLIED_PHANTOM_DAMAGE_FALLBACK;
  }

  /** Flat Pack Hunter bonus: +15 damage per living owned zombie (including self). */
  getPackHunterBonusDamage(ownerId) {
    if (!ownerId) return 0;
    const boons = this.getCoopZombieBoons(ownerId);
    if (!boons.packHunter) return 0;
    return PACK_HUNTER_DAMAGE_PER_ZOMBIE * this.countLivingPlayerZombies(ownerId);
  }

  isFriendlyCombatUnit(enemy) {
    return !!enemy && (
      enemy.type === 'player-zombie'
      || enemy.type === 'vengeful-spirit'
      || enemy.alliedUnit === true
    );
  }

  /** Camp mobs Nemesis may attack. */
  isValidNemesisPrey(target) {
    if (!target || target.isDying || target.health <= 0) return false;
    if (this.isFriendlyCombatUnit(target)) return false;
    return !NEMESIS_CROSS_FACTION_EXCLUDED_PREY.has(target.type);
  }

  /** Camp mobs that may attack Nemesis when focused via hostile-enemy aggro. */
  isValidAttackerOnNemesis(attacker) {
    if (!attacker || attacker.isDying || attacker.health <= 0) return false;
    if (attacker.type === 'nemesis') return false;
    if (this.isFriendlyCombatUnit(attacker)) return false;
    return !NEMESIS_CROSS_FACTION_EXCLUDED_ATTACKERS.has(attacker.type);
  }

  isValidHostileEnemyAggroTarget(moverEnemy, target) {
    if (!target || target.isDying || target.health <= 0) return false;
    if (moverEnemy?.type === 'nemesis') return this.isValidNemesisPrey(target);
    if (target.type === 'nemesis') return this.isValidAttackerOnNemesis(moverEnemy);
    return false;
  }

  findClosestNemesisPrey(nemesis, maxRadius = NEMESIS_AGGRO_RADIUS) {
    if (!nemesis?.position) return null;
    let best = null;
    let bestDistSq = maxRadius * maxRadius;
    const ox = nemesis.position.x;
    const oy = nemesis.position.y ?? 0;
    const oz = nemesis.position.z;
    const candidates = this._getEnemiesNear(ox, oz, maxRadius);
    for (let i = 0; i < candidates.length; i++) {
      const enemy = candidates[i];
      if (enemy.id === nemesis.id) continue;
      if (!this.isValidNemesisPrey(enemy)) continue;
      const dx = enemy.position.x - ox;
      const dy = (enemy.position.y ?? 0) - oy;
      const dz = enemy.position.z - oz;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq >= bestDistSq) continue;
      if (!this.hasLineOfSight(nemesis.position, enemy.position)) continue;
      bestDistSq = distSq;
      best = enemy;
    }
    return best;
  }

  findClosestCombatantForNemesis(nemesis, players, maxRadius = NEMESIS_AGGRO_RADIUS) {
    let best = null;
    let bestDistSq = maxRadius * maxRadius;
    let bestKind = null;
    const ox = nemesis.position.x;
    const oy = nemesis.position.y ?? 0;
    const oz = nemesis.position.z;

    for (const p of players) {
      if (!p || p.health <= 0) continue;
      const dx = p.position.x - ox;
      const dy = (p.position.y ?? 0) - oy;
      const dz = p.position.z - oz;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq >= bestDistSq) continue;
      if (!this.hasLineOfSight(nemesis.position, p.position)) continue;
      bestDistSq = distSq;
      best = p;
      bestKind = 'player';
    }

    const prey = this.findClosestNemesisPrey(nemesis, maxRadius);
    if (prey) {
      const dx = prey.position.x - ox;
      const dy = (prey.position.y ?? 0) - oy;
      const dz = prey.position.z - oz;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < bestDistSq) {
        best = prey;
        bestKind = 'hostile';
      }
    }

    if (!best) return null;
    return bestKind === 'player'
      ? { kind: 'player', player: best }
      : { kind: 'hostile', enemy: best };
  }

  findClosestCombatantForSpectre(spectre, players, maxRadius = SPECTRE_AGGRO_RADIUS) {
    let best = null;
    let bestDistSq = maxRadius * maxRadius;
    let bestKind = null;
    const ox = spectre.position.x;
    const oy = spectre.position.y ?? 0;
    const oz = spectre.position.z;

    for (const p of players) {
      if (!p || p.health <= 0) continue;
      const dx = p.position.x - ox;
      const dy = (p.position.y ?? 0) - oy;
      const dz = p.position.z - oz;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq >= bestDistSq) continue;
      if (!this.hasLineOfSight(spectre.position, p.position)) continue;
      bestDistSq = distSq;
      best = p;
      bestKind = 'player';
    }

    const candidates = this._getEnemiesNear(ox, oz, maxRadius);
    for (let i = 0; i < candidates.length; i++) {
      const enemy = candidates[i];
      if (enemy.id === spectre.id) continue;
      if (!this.isValidHostileEnemyAggroTarget(spectre, enemy)) continue;
      const dx = enemy.position.x - ox;
      const dy = (enemy.position.y ?? 0) - oy;
      const dz = enemy.position.z - oz;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq >= bestDistSq) continue;
      if (!this.hasLineOfSight(spectre.position, enemy.position)) continue;
      bestDistSq = distSq;
      best = enemy;
      bestKind = 'hostile';
    }

    if (!best) return null;
    return bestKind === 'player'
      ? { kind: 'player', player: best }
      : { kind: 'hostile', enemy: best };
  }

  findClosestCombatantForValkyrie(valkyrie, players, maxRadius = VALKYRIE_AGGRO_RADIUS) {
    let best = null;
    let bestDistSq = maxRadius * maxRadius;
    let bestKind = null;
    const ox = valkyrie.position.x;
    const oy = valkyrie.position.y ?? 0;
    const oz = valkyrie.position.z;

    for (const p of players) {
      if (!p || p.health <= 0) continue;
      const dx = p.position.x - ox;
      const dy = (p.position.y ?? 0) - oy;
      const dz = p.position.z - oz;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq >= bestDistSq) continue;
      if (!this.hasLineOfSight(valkyrie.position, p.position)) continue;
      bestDistSq = distSq;
      best = p;
      bestKind = 'player';
    }

    const candidates = this._getEnemiesNear(ox, oz, maxRadius);
    for (let i = 0; i < candidates.length; i++) {
      const enemy = candidates[i];
      if (enemy.id === valkyrie.id) continue;
      if (!this.isValidHostileEnemyAggroTarget(valkyrie, enemy)) continue;
      const dx = enemy.position.x - ox;
      const dy = (enemy.position.y ?? 0) - oy;
      const dz = enemy.position.z - oz;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq >= bestDistSq) continue;
      if (!this.hasLineOfSight(valkyrie.position, enemy.position)) continue;
      bestDistSq = distSq;
      best = enemy;
      bestKind = 'hostile';
    }

    if (!best) return null;
    return bestKind === 'player'
      ? { kind: 'player', player: best }
      : { kind: 'hostile', enemy: best };
  }

  damageHostileMobFromMob(attacker, target, damage, damageType) {
    if (!this.isValidHostileEnemyAggroTarget(attacker, target)) return null;
    const result = this.room.damageEnemy(target.id, damage, null, null, {
      sourceEnemyId: attacker.id,
      damageType,
    });
    if (result) this.maybeEmitBeastMeleeHitSfx(attacker);
    return result;
  }

  fakeTargetFromEnemy(enemy) {
    return { id: enemy.id, position: enemy.position };
  }

  scheduleDelayedMeleeVsHostile(attacker, targetEnemy, attackRange, damage, damageType, delayMs) {
    const aid = attacker.id;
    const tid = targetEnemy.id;
    this._scheduleEnemyTimeout(aid, () => {
      if (attacker.isDying || !this.room?.getGameStarted()) return;
      if (this.room?.isEnemyAffectedBy(aid, 'stun')) return;
      const liveTarget = this.room?.getEnemy(tid);
      if (!liveTarget || liveTarget.isDying || liveTarget.health <= 0) return;
      if (!this.isValidHostileEnemyAggroTarget(attacker, liveTarget)) return;
      const currentDistance = this.calculateDistance(attacker.position, liveTarget.position);
      if (currentDistance <= attackRange) {
        this.damageHostileMobFromMob(attacker, liveTarget, damage, damageType);
      }
    }, delayMs);
  }

  damageAlliedUnitsAlongSegmentXZ(startX, startZ, endX, endZ, radiusSq, damage, hitMeta) {
    if (!this.room?.getEnemies) return 0;
    const src = hitMeta?.sourceEnemyId
      ? (this.room.getEnemy?.(hitMeta.sourceEnemyId) || this.room.enemies?.get?.(hitMeta.sourceEnemyId))
      : null;
    const scaled = this.scaleDamageVsAlly(src, damage);
    let hitCount = 0;
    for (const ally of this.room.enemies.values()) {
      if (!ally?.alliedUnit || ally.isDying || ally.health <= 0) continue;
      const ax = ally.position?.x ?? 0;
      const az = ally.position?.z ?? 0;
      if (distPointSegmentSqXZ(ax, az, startX, startZ, endX, endZ) > radiusSq) continue;
      const hit = this.room.damageEnemy(ally.id, scaled, null, null, hitMeta);
      if (hit) hitCount += 1;
    }
    return hitCount;
  }

  damageAlliedUnitsAlongSpinStrip(sx, sz, segX, segZ, stripHalfWidth, damage, hitMeta, hitAllyIds) {
    if (!this.room?.getEnemies) return 0;
    const segLenSq = segX * segX + segZ * segZ;
    if (segLenSq < 1e-4) return 0;

    const src = hitMeta?.sourceEnemyId
      ? (this.room.getEnemy?.(hitMeta.sourceEnemyId) || this.room.enemies?.get?.(hitMeta.sourceEnemyId))
      : null;
    const scaled = this.scaleDamageVsAlly(src, damage);

    let hitCount = 0;
    for (const ally of this.room.enemies.values()) {
      if (!ally?.alliedUnit || ally.isDying || ally.health <= 0) continue;
      if (hitAllyIds.has(ally.id)) continue;

      const px = (ally.position?.x ?? 0) - sx;
      const pz = (ally.position?.z ?? 0) - sz;
      const t = Math.max(0, Math.min(1, (px * segX + pz * segZ) / segLenSq));
      const closestX = sx + segX * t;
      const closestZ = sz + segZ * t;
      const perpendicular = Math.hypot((ally.position?.x ?? 0) - closestX, (ally.position?.z ?? 0) - closestZ);
      if (perpendicular > stripHalfWidth) continue;

      hitAllyIds.add(ally.id);
      const hit = this.room.damageEnemy(ally.id, scaled, null, null, hitMeta);
      if (hit) hitCount += 1;
    }
    return hitCount;
  }

  countHostileEnemiesAlongSegmentXZ(startX, startZ, endX, endZ, radiusSq, ally = null) {
    if (!this.room?.getEnemies) return 0;
    let count = 0;
    for (const enemy of this.room.enemies.values()) {
      if (!this.isValidAlliedKnightTarget(enemy, ally)) continue;
      const ex = enemy.position?.x ?? 0;
      const ez = enemy.position?.z ?? 0;
      if (distPointSegmentSqXZ(ex, ez, startX, startZ, endX, endZ) > radiusSq) continue;
      count += 1;
    }
    return count;
  }

  damageHostileEnemiesAlongSegmentXZ(startX, startZ, endX, endZ, radiusSq, damage, hitMeta, ally = null) {
    if (!this.room?.getEnemies) return 0;
    let hitCount = 0;
    for (const enemy of this.room.enemies.values()) {
      if (!this.isValidAlliedKnightTarget(enemy, ally)) continue;
      const ex = enemy.position?.x ?? 0;
      const ez = enemy.position?.z ?? 0;
      if (distPointSegmentSqXZ(ex, ez, startX, startZ, endX, endZ) > radiusSq) continue;
      const hit = this.room.damageEnemy(enemy.id, damage, null, null, hitMeta);
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
    const enemies = this._tickEnemies.length > 0 ? this._tickEnemies : this._refreshTickEnemies();
    for (const e of enemies) {
      if (!this._isPlayerCombatAlly(e) || e.isDying || e.health <= 0) continue;
      e.combatInitiated = true;
      if (enemyId) {
        this.recordAlliedProtectionThreat(enemyId, null, 25);
      }
    }
  }

  _scheduleTimeout(fn, ms) {
    const handle = setTimeout(() => {
      this._pendingTimeouts.delete(handle);
      fn();
    }, ms);
    this._pendingTimeouts.add(handle);
    return handle;
  }

  _scheduleEnemyTimeout(enemyId, fn, ms) {
    const handle = this._scheduleTimeout(fn, ms);
    if (!this.enemyPendingTimeouts.has(enemyId)) {
      this.enemyPendingTimeouts.set(enemyId, new Set());
    }
    this.enemyPendingTimeouts.get(enemyId).add(handle);
    return handle;
  }

  _clearEnemyTimeouts(enemyId) {
    const pending = this.enemyPendingTimeouts.get(enemyId);
    if (!pending) return;
    for (const handle of pending) {
      clearTimeout(handle);
      this._pendingTimeouts.delete(handle);
    }
    this.enemyPendingTimeouts.delete(enemyId);
  }

  _addEnemyHazardInterval(enemyId, intervalId) {
    if (!this.enemyHazardIntervals.has(enemyId)) {
      this.enemyHazardIntervals.set(enemyId, new Set());
    }
    this.enemyHazardIntervals.get(enemyId).add(intervalId);
  }

  _removeEnemyHazardInterval(enemyId, intervalId) {
    const set = this.enemyHazardIntervals.get(enemyId);
    if (!set) return;
    set.delete(intervalId);
    if (set.size === 0) this.enemyHazardIntervals.delete(enemyId);
  }

  _clearEnemyHazardIntervals(enemyId) {
    const set = this.enemyHazardIntervals.get(enemyId);
    if (set) {
      for (const iv of set) clearInterval(iv);
    }
    this.enemyHazardIntervals.delete(enemyId);
  }

  isValidAlliedKnightTarget(enemy, ally = null) {
    if (!enemy || enemy.isDying || enemy.health <= 0) return false;
    if (this.isFriendlyCombatUnit(enemy)) return false;
    if (this.isAssassinUntargetable(enemy)) return false;
    if (enemy.type === 'tentacle-spine' || enemy.isTrap) {
      return !!ally && this._allyHasPersonalTrapThreat(ally.id, enemy.id);
    }
    return true;
  }

  _allyHasPersonalTrapThreat(allyId, trapId) {
    const chart = this.alliedTrapThreat.get(allyId);
    if (!chart) return false;
    const entry = chart.get(trapId);
    if (!entry) return false;
    if (Date.now() - entry.lastUpdate > ALLIED_TRAP_THREAT_TTL_MS) {
      chart.delete(trapId);
      return false;
    }
    return true;
  }

  _recordAlliedTrapThreat(allyId, trapId) {
    const now = Date.now();
    let chart = this.alliedTrapThreat.get(allyId);
    if (!chart) {
      chart = new Map();
      this.alliedTrapThreat.set(allyId, chart);
    }
    chart.set(trapId, { lastUpdate: now });
  }

  pruneAlliedTrapThreat(allyId) {
    const chart = this.alliedTrapThreat.get(allyId);
    if (!chart) return;
    const now = Date.now();
    chart.forEach((entry, trapId) => {
      if (now - entry.lastUpdate > ALLIED_TRAP_THREAT_TTL_MS) {
        chart.delete(trapId);
      }
    });
  }

  _isPlayerCombatAlly(ally) {
    return !!ally
      && ally.alliedUnit === true
      && (
        ally.type === 'allied-knight'
        || ally.type === 'allied-huntress'
        || ally.type === 'allied-phantom'
        || ally.type === 'allied-demon'
        || ally.type === 'allied-enchantress'
        || ally.type === 'allied-tiger'
        || ally.type === 'allied-wolf'
        || ally.type === 'allied-bear'
        || ally.type === 'allied-serpent'
        || ally.type === 'allied-spider'
      );
  }

  getAlliedKnightLockedTarget(ally) {
    if (!ally?.alliedTargetEnemyId || !this.room) return null;
    this.pruneAlliedTrapThreat(ally.id);
    const target = this.room.getEnemy?.(ally.alliedTargetEnemyId);
    if (this.isValidAlliedKnightTarget(target, ally)) return target;
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
    for (const ally of this.room.enemies.values()) {
      if (!this._isPlayerCombatAlly(ally) || ally.isDying || ally.health <= 0) continue;
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
        return;
      }
      const enemy = this.room?.getEnemy?.(enemyId);
      if (this.isAssassinUntargetable(enemy)) {
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
        if (!this.isValidAlliedKnightTarget(enemy, ally)) {
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

  findAlliedHuntressTarget(huntress) {
    if (!this.room) return null;

    const attackRange = ALLIED_HUNTRESS_ATTACK_RANGE;
    let best = null;
    let bestPierceCount = 0;
    let bestDist = Infinity;

    for (const enemy of this.room.enemies.values()) {
      if (!this.isValidAlliedKnightTarget(enemy, huntress)) continue;
      const dist = this.calculateDistance(huntress.position, enemy.position);
      if (dist > attackRange) continue;
      if (!this.hasLineOfSight(huntress.position, enemy.position)) continue;

      const startX = huntress.position.x;
      const startZ = huntress.position.z;
      const tx = enemy.position.x;
      const tz = enemy.position.z;
      const ddx = tx - startX;
      const ddz = tz - startZ;
      const segLen = Math.hypot(ddx, ddz) || 1e-6;
      const endX = startX + (ddx / segLen) * attackRange;
      const endZ = startZ + (ddz / segLen) * attackRange;
      const pierceCount = this.countHostileEnemiesAlongSegmentXZ(
        startX,
        startZ,
        endX,
        endZ,
        ALLIED_HUNTRESS_ARROW_PIERCE_RADIUS_SQ,
        huntress,
      );

      if (pierceCount > bestPierceCount || (pierceCount === bestPierceCount && dist < bestDist)) {
        bestPierceCount = pierceCount;
        bestDist = dist;
        best = enemy;
      }
    }

    if (best) {
      huntress.combatInitiated = true;
      huntress.alliedTargetEnemyId = best.id;
      return best;
    }

    return this.findAlliedKnightTarget(huntress);
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
    if (!this.room || !this.isValidAlliedKnightTarget(targetEnemy, ally)) return false;
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
    this._scheduleTimeout(() => {
      const liveAlly = this.room?.getEnemy(ally.id);
      if (!liveAlly || liveAlly.isDying || liveAlly.health <= 0 || !this.room?.getGameStarted()) return;
      if (this.room?.isEnemyAffectedBy(liveAlly.id, 'stun')) return;
      if (this.room?.isEnemyAffectedBy(liveAlly.id, 'hostileFreeze')) return;

      const liveTarget = this.room?.getEnemy(targetId);
      if (!this.isValidAlliedKnightTarget(liveTarget, liveAlly)) return;

      const strikePosition = {
        x: liveTarget.position.x,
        y: liveTarget.position.y ?? 0,
        z: liveTarget.position.z,
      };

      for (const enemy of this.room.enemies.values()) {
        if (!this.isValidAlliedKnightTarget(enemy, liveAlly)) continue;
        const ex = enemy.position.x - strikePosition.x;
        const ez = enemy.position.z - strikePosition.z;
        if (ex * ex + ez * ez > ALLIED_KNIGHT_SMITE_RADIUS * ALLIED_KNIGHT_SMITE_RADIUS) continue;
        const isPrimaryTarget = enemy.id === targetId;
        this.room.damageEnemy(enemy.id, smiteDamage, null, null, {
          ...(isPrimaryTarget ? { sourceAlliedUnitId: liveAlly.id } : {}),
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
    if (this._shouldAlliesDisengageForDreamshroud()) {
      this._followOwnerDuringDreamshroud(ally, players);
      return;
    }
    if (this.room.isEnemyAffectedBy(ally.id, 'hostileFreeze')) return;
    const now = Date.now();
    this.updateAlliedKnightOrbRecharge(ally, now);
    const lockUntil = this.meleeLockUntil.get(ally.id) || 0;
    if (now < lockUntil) return;

    // Apply one-time allied knight boon stat upgrades when boons become active.
    const knightBoons = this.getCoopAlliedKnightBoons();
    this.applyNecrosInitiateIfNeeded(ally, knightBoons);
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
      if (now - lastAttackTime >= (ally.attackCooldown ?? ALLIED_KNIGHT_ATTACK_COOLDOWN_MS)) {
        this.ghoulAttackCooldown.set(ally.id, now);
        const SWING_LOCK_MS = 1200;
        this.meleeLockUntil.set(ally.id, now + SWING_LOCK_MS);
        const attackFocus = { ...target.position };
        this.scheduleKnightMeleeWindupStep(ally, attackFocus);
        this.telegraphAlliedKnightAttack(ally, target);
        const targetId = target.id;
        this._scheduleTimeout(() => {
          if (ally.isDying || !this.room?.getGameStarted()) return;
          if (this.room?.isEnemyAffectedBy(ally.id, 'stun')) return;
          if (this.room?.isEnemyAffectedBy(ally.id, 'hostileFreeze')) return;
          const attacker = this.room?.getEnemy(ally.id) || ally;
          const liveTarget = this.room?.getEnemy(targetId);
          if (!liveTarget || liveTarget.isDying || liveTarget.health <= 0) return;
          if (this.isFriendlyCombatUnit(liveTarget)) return;
          if (this.isAssassinUntargetable(liveTarget)) return;
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
      } else if (distance > meleePressDistance) {
        this.moveEnemyTowardsTarget(ally, { id: target.id, position: target.position }, {
          meleeSurroundAttackRange: ALLIED_KNIGHT_ATTACK_RANGE,
          combatTargetId: target.id,
        });
      }
    } else {
      this.moveEnemyTowardsTarget(ally, { id: target.id, position: target.position }, {
        meleeSurroundAttackRange: ALLIED_KNIGHT_ATTACK_RANGE,
        combatTargetId: target.id,
      });
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

  scheduleAllyHuntressShot(huntress, targetEnemy, shotId, { drawDurationMs = VIPER_DRAWBOW_DURATION_MS } = {}) {
    const maxRange = ALLIED_HUNTRESS_ATTACK_RANGE;
    const boons = this.getCoopAlliedKnightBoons();
    const damage = this.getHuntressArrowDamage(huntress, boons);
    this.telegraphViperAttack(huntress, {
      id: targetEnemy.id,
      position: targetEnemy.position,
    }, shotId, { maxRange, damage });
    const startX = huntress.position.x;
    const startZ = huntress.position.z;
    const startY = huntress.position.y + 1.5;
    const tx = targetEnemy.position.x;
    const tz = targetEnemy.position.z;
    const aimY = (targetEnemy.position.y ?? 0) + 1.0;
    const impactDelayMs = drawDurationMs + viperArrowFlightMs(
      { x: startX, y: startY, z: startZ },
      { x: tx, y: aimY, z: tz },
      maxRange,
    );
    const ddx = tx - startX;
    const ddz = tz - startZ;
    const segLen = Math.hypot(ddx, ddz) || 1e-6;
    const endX = startX + (ddx / segLen) * maxRange;
    const endZ = startZ + (ddz / segLen) * maxRange;
    const hid = huntress.id;
    this._scheduleTimeout(() => {
      if (huntress.isDying || !this.room?.getGameStarted()) return;
      const liveHuntress = this.room?.getEnemy(hid);
      if (!liveHuntress || liveHuntress.isDying) return;
      const liveBoons = this.getCoopAlliedKnightBoons();
      const liveDamage = this.getHuntressArrowDamage(liveHuntress, liveBoons);
      const hitCount = this.damageHostileEnemiesAlongSegmentXZ(
        startX,
        startZ,
        endX,
        endZ,
        ALLIED_HUNTRESS_ARROW_PIERCE_RADIUS_SQ,
        liveDamage,
        {
          sourceAlliedUnitId: liveHuntress.id,
          damageType: 'allied_huntress_arrow',
        },
        liveHuntress,
      );
      const outcomePosition = hitCount > 0
        ? { x: endX, y: liveHuntress.position.y, z: endZ }
        : liveHuntress.position;
      this.emitViperArrowOutcome(hid, shotId, hitCount > 0, outcomePosition);
    }, impactDelayMs);
  }

  updateAlliedHuntressAI(ally, players) {
    if (!this.room || ally.isDying || ally.health <= 0) return;
    if (this._shouldAlliesDisengageForDreamshroud()) {
      this._followOwnerDuringDreamshroud(ally, players);
      return;
    }
    const now = Date.now();
    const boons = this.getCoopAlliedKnightBoons();
    this.applyNecrosInitiateIfNeeded(ally, boons);

    const target = this.findAlliedHuntressTarget(ally);
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
    const attackRange = ALLIED_HUNTRESS_ATTACK_RANGE;
    const dx = target.position.x - ally.position.x;
    const dz = target.position.z - ally.position.z;
    ally.rotation = Math.atan2(dx, dz);
    this._queueMoveIfChanged(ally.id, ally.position, ally.rotation);

    const attackCooldown = this.getHuntressShotCooldownMs(boons);
    const lastAttackTime = this.viperAttackCooldown.get(ally.id) || 0;

    if (distance <= attackRange) {
      if (now - lastAttackTime >= attackCooldown) {
        this.viperAttackCooldown.set(ally.id, now);
        const shotId = `huntress-shot-${ally.id}-${now}`;
        this.scheduleAllyHuntressShot(ally, target, shotId);
      }
    } else {
      this.moveEnemyTowardsTarget(ally, { id: target.id, position: target.position });
    }
  }

  findAlliedPhantomTarget(phantom) {
    if (!this.room) return null;
    let best = null;
    let bestDist = Infinity;
    for (const enemy of this.room.enemies.values()) {
      if (!this.isValidAlliedKnightTarget(enemy, phantom)) continue;
      const dist = this.calculateDistance(phantom.position, enemy.position);
      if (dist > ALLIED_PHANTOM_ATTACK_RANGE) continue;
      if (dist < bestDist) {
        bestDist = dist;
        best = enemy;
      }
    }
    return best;
  }

  scheduleAlliedPhantomDaggerChecks(phantomId, aimTx, aimTz, delaysMs = SHADE_DAGGER_DELAYS_MS) {
    delaysMs.forEach((delayMs) => {
      this._scheduleTimeout(() => {
        if (!this.room?.getGameStarted()) return;
        const phantom = this.room?.getEnemy(phantomId);
        if (!phantom || phantom.isDying) return;
        if (this.room?.isEnemyAffectedBy(phantomId, 'stun')) return;
        const sx = phantom.position.x;
        const sz = phantom.position.z;
        const dx = aimTx - sx;
        const dz = aimTz - sz;
        const len = Math.hypot(dx, dz) || 1e-6;
        const endX = sx + (dx / len) * SHADE_DAGGER_MAX_RANGE;
        const endZ = sz + (dz / len) * SHADE_DAGGER_MAX_RANGE;
        const boons = this.getCoopAlliedKnightBoons();
        const damage = this.getPhantomDaggerDamage(phantom, boons);
        this.damageHostileEnemiesAlongSegmentXZ(
          sx,
          sz,
          endX,
          endZ,
          ALLIED_PHANTOM_DAGGER_HALF_WIDTH_SQ,
          damage,
          {
            sourceAlliedUnitId: phantomId,
            damageType: 'allied_phantom_dagger',
          },
          phantom,
        );
      }, delayMs);
    });
  }

  alliedPhantomCastBlinkAndAttack(phantom, targetEnemy) {
    const fakeTarget = { id: targetEnemy.id, position: targetEnemy.position };
    if (!this.shadeBlinkNearTarget(phantom, fakeTarget, 'allied-phantom')) return;

    const phantomId = phantom.id;
    const targetId = targetEnemy.id;
    this._scheduleTimeout(() => {
      if (!this.room?.getGameStarted()) return;
      const livePhantom = this.room?.getEnemy(phantomId);
      if (!livePhantom || livePhantom.isDying) return;
      if (this.room?.isEnemyAffectedBy(phantomId, 'stun')) return;
      const liveTarget = this.room?.getEnemy(targetId);
      if (!this.isValidAlliedKnightTarget(liveTarget, livePhantom)) return;
      const fake = { id: liveTarget.id, position: liveTarget.position };
      this.telegraphShadeAttack(livePhantom, fake);
      this.scheduleAlliedPhantomDaggerChecks(
        phantomId,
        liveTarget.position.x,
        liveTarget.position.z,
        SHADE_DAGGER_DELAYS_MS,
      );
    }, SHADE_BLINK_DURATION_MS);
  }

  updateAlliedPhantomAI(ally, players) {
    if (!this.room || ally.isDying || ally.health <= 0) return;
    if (this._shouldAlliesDisengageForDreamshroud()) {
      this._followOwnerDuringDreamshroud(ally, players);
      return;
    }
    const now = Date.now();
    const lockUntil = this.meleeLockUntil.get(ally.id) || 0;
    if (now < lockUntil) {
      // Hold position during blink+throw but keep facing the target (Storm Lash / Wyvern breath).
      const lockTarget = this.findAlliedPhantomTarget(ally);
      if (lockTarget) {
        this._smoothRotateEnemyTowardPoint(ally, lockTarget.position);
        this._queueMoveIfChanged(ally.id, ally.position, ally.rotation);
      }
      return;
    }
    const boons = this.getCoopAlliedKnightBoons();
    this.applyNecrosInitiateIfNeeded(ally, boons);

    const target = this.findAlliedPhantomTarget(ally);
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
    const attackRange = ALLIED_PHANTOM_ATTACK_RANGE;
    const dx = target.position.x - ally.position.x;
    const dz = target.position.z - ally.position.z;
    ally.rotation = Math.atan2(dx, dz);
    this._queueMoveIfChanged(ally.id, ally.position, ally.rotation);

    const comboCooldown = this.getPhantomComboCooldownMs(boons);
    const lastComboTime = this.shadeBlinkCooldown.get(ally.id) || 0;

    if (distance <= attackRange) {
      if (now - lastComboTime >= comboCooldown) {
        this.shadeBlinkCooldown.set(ally.id, now);
        this.meleeLockUntil.set(ally.id, now + SHADE_THROW_ANIMATION_MS);
        this.alliedPhantomCastBlinkAndAttack(ally, target);
      }
    } else {
      this.moveEnemyTowardsTarget(ally, { id: target.id, position: target.position });
    }
  }

  findAlliedDemonTarget(ally) {
    return this.findNearestHostileForZombie(ally);
  }

  alliedDemonStartLeap(demon, targetEnemy) {
    const now = Date.now();
    const fakeTarget = { id: targetEnemy.id, position: targetEnemy.position };
    const fromX = demon.position.x;
    const fromZ = demon.position.z;
    const { x: landX, z: landZ } = this.computeMobLeapLandXZ(
      demon,
      fakeTarget,
      GHOUL_LEAP_MAX_TRAVEL,
      GHOUL_LEAP_LAND_STANDOFF_M,
      GHOUL_LEAP_DURATION_MS,
    );
    const endAt = now + GHOUL_LEAP_DURATION_MS;
    this.ghoulLeapEndAt.set(demon.id, endAt);
    this.ghoulLeapLand.set(demon.id, { x: landX, z: landZ });
    this.ghoulLeapFrom.set(demon.id, { x: fromX, z: fromZ });
    this.meleeLockUntil.set(demon.id, endAt);
    if (this.io) {
      this.io.to(this.roomId).emit('ghoul-leap-start', {
        ghoulId: demon.id,
        startPosition: { x: demon.position.x, y: demon.position.y, z: demon.position.z },
        landPosition: { x: landX, y: 0, z: landZ },
        durationMs: GHOUL_LEAP_DURATION_MS,
        timestamp: now,
      });
    }
    const demonId = demon.id;
    const t = this._scheduleTimeout(() => {
      this.alliedDemonCompleteLeap(demonId);
    }, GHOUL_LEAP_DURATION_MS);
    this.ghoulLeapTimeout.set(demon.id, t);
  }

  alliedDemonCompleteLeap(demonId) {
    this.ghoulLeapTimeout.delete(demonId);
    this.ghoulLeapEndAt.delete(demonId);
    const land = this.ghoulLeapLand.get(demonId);
    this.ghoulLeapLand.delete(demonId);
    this.ghoulLeapFrom.delete(demonId);
    const demon = this.room?.enemies?.get(demonId);
    if (!demon || demon.isDying || demon.health <= 0) return;
    if (land) {
      demon.position.x = land.x;
      demon.position.z = land.z;
    }
    this.ghoulLeapCooldown.set(demonId, Date.now());
    if (this.room && land) {
      const cx = land.x;
      const cz = land.z;
      const r2 = GHOUL_LEAP_LANDING_RADIUS * GHOUL_LEAP_LANDING_RADIUS;
      const leapDamage = this.getDemonLeapDamage(this.getCoopAlliedKnightBoons());
      for (const enemy of this.room.enemies.values()) {
        if (!this.isValidAlliedKnightTarget(enemy, demon)) continue;
        const ex = enemy.position?.x ?? 0;
        const ez = enemy.position?.z ?? 0;
        const dx = ex - cx;
        const dz = ez - cz;
        if (dx * dx + dz * dz > r2) continue;
        this.room.damageEnemy(enemy.id, leapDamage, null, null, {
          sourceAlliedUnitId: demonId,
          damageType: 'allied_demon_leap',
        });
        this.room.applyStatusEffect(enemy.id, 'stun', ALLIED_DEMON_LEAP_STUN_MS);
      }
    }
    if (this.io) {
      this.io.to(this.roomId).emit('ghoul-leap-land', {
        ghoulId: demonId,
        landPosition: land ? { x: land.x, y: 0, z: land.z } : { x: demon.position.x, y: 0, z: demon.position.z },
        timestamp: Date.now(),
      });
      this._queueMove(demonId, demon.position, demon.rotation);
    }
  }

  telegraphAlliedDemonAttack(demon, targetEnemy) {
    if (this.io) {
      this.io.to(this.roomId).emit('ghoul-attack-telegraph', {
        ghoulId: demon.id,
        targetPlayerId: targetEnemy.id,
        position: demon.position,
        timestamp: Date.now(),
      });
    }
  }

  updateAlliedDemonAI(ally, players) {
    if (!this.room || ally.isDying || ally.health <= 0) return;
    if (this._shouldAlliesDisengageForDreamshroud()) {
      this._followOwnerDuringDreamshroud(ally, players);
      return;
    }
    if (this.tickGhoulLeapFlight(ally)) return;
    const now = Date.now();
    const lockUntil = this.meleeLockUntil.get(ally.id) || 0;
    if (now < lockUntil) return;
    const boons = this.getCoopAlliedKnightBoons();
    this.applyNecrosInitiateIfNeeded(ally, boons);

    const target = this.findAlliedDemonTarget(ally);
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
    const attackRange = ALLIED_DEMON_ATTACK_RANGE;
    const meleePressDistance = attackRange - MELEE_CLOSE_INSET;
    const dx = target.position.x - ally.position.x;
    const dz = target.position.z - ally.position.z;
    ally.rotation = Math.atan2(dx, dz);
    this._queueMoveIfChanged(ally.id, ally.position, ally.rotation);

    const lastLeapTime = this.ghoulLeapCooldown.get(ally.id) || 0;
    const leapCooldown = this.getDemonLeapCooldownMs(boons);
    if (
      distance > attackRange
      && now - lastLeapTime >= leapCooldown
      && !this.ghoulLeapEndAt.has(ally.id)
    ) {
      this.alliedDemonStartLeap(ally, target);
      return;
    }

    if (distance <= attackRange) {
      if (!this.ghoulAttackCooldown.has(ally.id)) {
        this.ghoulAttackCooldown.set(ally.id, 0);
      }
      const lastAttackTime = this.ghoulAttackCooldown.get(ally.id);
      if (now - lastAttackTime >= this.getDemonMeleeCooldownMs(boons)) {
        this.ghoulAttackCooldown.set(ally.id, now);
        const SWING_LOCK_MS = 1200;
        this.meleeLockUntil.set(ally.id, now + SWING_LOCK_MS);
        this.telegraphAlliedDemonAttack(ally, target);
        const targetId = target.id;
        const allyId = ally.id;
        this._scheduleTimeout(() => {
          if (!this.room?.getGameStarted()) return;
          const liveAlly = this.room?.getEnemy(allyId);
          if (!liveAlly || liveAlly.isDying || liveAlly.health <= 0) return;
          if (this.room?.isEnemyAffectedBy(allyId, 'stun')) return;
          const liveTarget = this.room?.getEnemy(targetId);
          if (!this.isValidAlliedKnightTarget(liveTarget, liveAlly)) return;
          const currentDist = this.calculateDistance(liveAlly.position, liveTarget.position);
          if (currentDist <= attackRange + 0.5) {
            const meleeBoons = this.getCoopAlliedKnightBoons();
            const damage = this.getDemonMeleeDamage(liveAlly, meleeBoons);
            this.room.damageEnemy(liveTarget.id, damage, null, null, {
              sourceAlliedUnitId: liveAlly.id,
              damageType: 'allied_demon_melee',
            });
          }
        }, 900);
      } else if (distance > meleePressDistance) {
        this.moveEnemyTowardsTarget(ally, { id: target.id, position: target.position }, {
          meleeSurroundAttackRange: attackRange,
          combatTargetId: target.id,
        });
      }
    } else {
      this.moveEnemyTowardsTarget(ally, { id: target.id, position: target.position }, {
        meleeSurroundAttackRange: attackRange,
        combatTargetId: target.id,
      });
    }
  }

  findAlliedBeastOwner(beast, players) {
    const ownerId = beast.ownerPlayerId;
    if (ownerId && this.room?.players?.has(ownerId)) {
      return this.room.players.get(ownerId);
    }
    return this.findClosestPlayer(beast, players);
  }

  findAlliedBeastTarget(beast, config) {
    if (!this.room) return null;
    let best = null;
    let bestDist = config.aggroRadius;
    for (const enemy of this.room.enemies.values()) {
      if (!this.isValidAlliedKnightTarget(enemy, beast)) continue;
      // Flying enemies (terrorhawk / destiny) are untargetable until they land.
      if (this._isTargetAirborne(enemy)) continue;
      const dist = this.calculateDistance(beast.position, enemy.position);
      if (dist > bestDist) continue;
      bestDist = dist;
      best = enemy;
    }
    if (best) {
      beast.alliedTargetEnemyId = best.id;
      beast.combatInitiated = true;
    } else {
      beast.alliedTargetEnemyId = null;
    }
    return best;
  }

  /**
   * Throne prep only: Beastmaster tiger may attack the training dummy when the owner
   * has recently hit it (see GameRoom.canBeastmasterTigerAttackThroneDummy).
   */
  findThroneTrainingDummyForBeast(beast, config) {
    if (!this.room?.isInCoopThronePrep?.()) return null;
    if (beast.type !== 'allied-tiger' || beast.companionSlot !== 'beastmaster') return null;
    const ownerId = beast.ownerPlayerId;
    if (!this.room.canBeastmasterTigerAttackThroneDummy?.(ownerId)) return null;

    let best = null;
    let bestDist = config.aggroRadius;
    for (const enemy of this.room.enemies.values()) {
      if (enemy.type !== 'training-dummy') continue;
      if (!this.isValidAlliedKnightTarget(enemy, beast)) continue;
      const dist = this.calculateDistance(beast.position, enemy.position);
      if (dist > bestDist) continue;
      bestDist = dist;
      best = enemy;
    }
    if (best) {
      beast.alliedTargetEnemyId = best.id;
      beast.combatInitiated = true;
    } else {
      beast.alliedTargetEnemyId = null;
    }
    return best;
  }

  telegraphAlliedBeastAttack(beast, target, attackVariant, config) {
    if (!this.io) return;
    const payload = {
      targetEnemyId: target.id,
      attackVariant,
      position: beast.position,
      timestamp: Date.now(),
    };
    payload[config.telegraphIdKey] = beast.id;
    // Tiger renderer still listens for tigerId; keep alias for all beasts.
    payload.tigerId = beast.id;
    payload.beastId = beast.id;
    this.io.to(this.roomId).emit(config.telegraphEvent, payload);
  }

  /**
   * Passive HP regen for fae / beastmaster companions (tick every hpRegenIntervalMs).
   * Emits enemy-healed; wolf also uses healingType beast_regen_wolf for client floaters.
   */
  tryAlliedBeastHpRegen(beast, config, now = Date.now()) {
    if (!beast || beast.isDying || (beast.health ?? 0) <= 0) return;
    const maxHp = beast.maxHealth ?? 0;
    if (maxHp <= 0 || beast.health >= maxHp) return;
    const amount = config?.hpRegenAmount ?? 0;
    const interval = config?.hpRegenIntervalMs ?? 5000;
    if (amount <= 0 || interval <= 0) return;

    const last = beast.lastHpRegenAt;
    if (last == null) {
      beast.lastHpRegenAt = now;
      return;
    }
    if (now - last < interval) return;

    beast.lastHpRegenAt = now;
    const previousHealth = beast.health;
    beast.health = Math.min(maxHp, beast.health + amount);
    const actualHeal = beast.health - previousHealth;
    if (actualHeal <= 0 || !this.io) return;

    this.io.to(this.roomId).emit('enemy-healed', {
      enemyId: beast.id,
      healAmount: actualHeal,
      newHealth: beast.health,
      maxHealth: maxHp,
      healingType: config.showRegenHealNumber ? 'beast_regen_wolf' : 'beast_regen',
      position: {
        x: beast.position?.x ?? 0,
        y: beast.position?.y ?? 0,
        z: beast.position?.z ?? 0,
      },
      timestamp: now,
    });
  }

  /**
   * Lightweight follow-only tick used when main combat AI is stopped
   * (throne prep / post-clear portal intermission).
   * Throne prep: Beastmaster tiger may engage the training dummy; vengeful spirits tick too.
   */
  updateCompanionAI() {
    if (!this.room || !this.room.getGameStarted()) return;
    const enemies = this._refreshTickEnemies();
    const players = this._refreshTickPlayers();
    if (players.length === 0) {
      this._flushMoves();
      return;
    }
    const inThronePrep = this.room.isInCoopThronePrep?.() ?? false;
    // Main combat AI is paused whenever arena is inactive (throne prep + portal intermission).
    const mainAiPaused = this.room.combatArenaActive === false;
    for (const enemy of enemies) {
      if (enemy.isDying || !ALLIED_BEAST_TYPES.has(enemy.type)) continue;
      if (
        inThronePrep &&
        enemy.type === 'allied-tiger' &&
        enemy.companionSlot === 'beastmaster'
      ) {
        this.updateAlliedBeastThroneDummyAI(enemy, players);
      } else {
        this.updateAlliedBeastFollowOnly(enemy, players);
      }
    }
    // Tick spirits while main AI is paused — include isExpiring so expireAt removal can fire.
    if (mainAiPaused) {
      for (const enemy of enemies) {
        if (enemy.type === 'vengeful-spirit' && !enemy.isDying) {
          this.updateVengefulSpiritAI(enemy, players);
        }
      }
    }
    this.room?.tickPetCompanionProximityBuffs?.(Date.now());
    this._flushMoves();
  }

  /**
   * Throne prep: Beastmaster tiger attacks training dummy only after owner hit it recently;
   * otherwise returns to owner flank.
   */
  updateAlliedBeastThroneDummyAI(ally, players) {
    if (!this.room || ally.isDying || ally.health <= 0) return;
    const config = getAlliedBeastConfig(ally.type);
    if (!config) return;
    const now = Date.now();
    this.tryAlliedBeastHpRegen(ally, config, now);
    const lockUntil = this.meleeLockUntil.get(ally.id) || 0;
    if (now < lockUntil) return;

    if (ally.beastCompanionPhase === 'entering') {
      this.updateAlliedBeastEntering(ally, players, config);
      return;
    }

    const target = this.findThroneTrainingDummyForBeast(ally, config);
    if (!target) {
      this.clearBeastAggroSfx(ally.id);
      ally.alliedTargetEnemyId = null;
      ally.combatInitiated = false;
      this.updateAlliedBeastFollowOnly(ally, players);
      return;
    }

    this._alliedBeastEngageMeleeTarget(ally, target, config, now);
  }

  /** Shared melee chase + attack for allied beasts (combat rooms + throne dummy). */
  _alliedBeastEngageMeleeTarget(ally, target, config, now = Date.now()) {
    this.emitBeastAggroSfx(ally);

    ally.tigerLocomotion = 'run';
    ally.moveSpeed = config.runSpeed;

    const distance = this.calculateDistance(ally.position, target.position);
    const attackRange = config.attackRange;
    const meleePressDistance = attackRange - MELEE_CLOSE_INSET;
    const dx = target.position.x - ally.position.x;
    const dz = target.position.z - ally.position.z;
    ally.rotation = Math.atan2(dx, dz);
    this._queueMoveIfChanged(ally.id, ally.position, ally.rotation);

    if (distance <= attackRange) {
      if (!this.ghoulAttackCooldown.has(ally.id)) {
        this.ghoulAttackCooldown.set(ally.id, 0);
      }
      const lastAttackTime = this.ghoulAttackCooldown.get(ally.id);
      const cooldown = ally.attackCooldown ?? config.attackCooldownMs;
      if (now - lastAttackTime >= cooldown) {
        this.ghoulAttackCooldown.set(ally.id, now);
        this.meleeLockUntil.set(ally.id, now + config.swingLockMs);
        const nextVariant = ally.attackVariant === 2 ? 1 : 2;
        ally.attackVariant = nextVariant;
        this.telegraphAlliedBeastAttack(ally, target, nextVariant, config);
        const targetId = target.id;
        const allyId = ally.id;
        const damageType = config.damageType;
        const hitDelay = config.hitDelayMs;
        const damageFallback = config.damageFallback;
        this._scheduleTimeout(() => {
          if (!this.room?.getGameStarted()) return;
          const liveAlly = this.room?.getEnemy(allyId);
          if (!liveAlly || liveAlly.isDying || liveAlly.health <= 0) return;
          if (this.room?.isEnemyAffectedBy(allyId, 'stun')) return;
          const liveTarget = this.room?.getEnemy(targetId);
          if (!this.isValidAlliedKnightTarget(liveTarget, liveAlly)) return;
          // Throne dummy: re-check owner still recently hit it (disengage after 5s idle).
          if (
            liveTarget.type === 'training-dummy' &&
            liveAlly.type === 'allied-tiger' &&
            liveAlly.companionSlot === 'beastmaster' &&
            !this.room.canBeastmasterTigerAttackThroneDummy?.(liveAlly.ownerPlayerId)
          ) {
            return;
          }
          const currentDist = this.calculateDistance(liveAlly.position, liveTarget.position);
          if (currentDist <= attackRange + 0.5) {
            let damage = liveAlly.damage || damageFallback;
            if (this.room?.playerHasHuntersMark?.(liveAlly.ownerPlayerId)) {
              damage += HUNTERS_MARK_BEAST_MELEE_BONUS;
            }
            let isCritical = false;
            if (liveAlly.petUpgradeApexKiller && Math.random() < PET_UPGRADE_APEX_KILLER_CRIT_CHANCE) {
              isCritical = true;
              damage = Math.round(damage * PET_UPGRADE_APEX_KILLER_CRIT_MULT);
            }
            const result = this.room.damageEnemy(liveTarget.id, damage, null, null, {
              sourceAlliedUnitId: liveAlly.id,
              damageType,
              isCritical,
            });
            if (liveAlly.petUpgradeNeurotoxin && liveAlly.ownerPlayerId) {
              this.room._addConcentratedVenomStacks(liveTarget.id, 1, liveAlly.ownerPlayerId);
            }
            if (result) this.maybeEmitBeastMeleeHitSfx(liveAlly);
          }
        }, hitDelay);
      } else if (distance > meleePressDistance) {
        this.moveEnemyTowardsTarget(ally, { id: target.id, position: target.position }, {
          meleeSurroundAttackRange: attackRange,
          combatTargetId: target.id,
        });
      }
    } else {
      this.moveEnemyTowardsTarget(ally, { id: target.id, position: target.position }, {
        meleeSurroundAttackRange: attackRange,
        combatTargetId: target.id,
      });
    }
  }

  updateAlliedBeastEntering(beast, players, config) {
    const owner = this.findAlliedBeastOwner(beast, players);
    if (!owner) return;
    const slot = beast.companionSlot === 'fae' ? 'fae' : 'beastmaster';
    const meetPos = this.room?.getCompanionFollowPosition?.(owner, slot)
      ?? { x: (owner.position?.x ?? 0) + (slot === 'fae' ? 2.2 : -2.2), y: 0, z: (owner.position?.z ?? 0) - 1.5 };
    const meet = { id: `meet-${owner.id}-${slot}`, position: meetPos };
    beast.tigerLocomotion = 'walk';
    beast.moveSpeed = config.walkSpeed;
    const d = this.calculateDistance(beast.position, meet.position);
    if (d <= 0.35) {
      beast.beastCompanionPhase = 'active';
      beast.position = { x: meetPos.x, y: 0, z: meetPos.z };
      this._queueMoveIfChanged(beast.id, beast.position, beast.rotation);
      return;
    }
    this.moveEnemyTowardsTarget(beast, meet, { stopThreshold: 0.35 });
  }

  /** Slot-based flank anchor so beastmaster + fae pets don't stack. */
  _getCompanionFollowAnchor(beast, owner) {
    const slot = beast.companionSlot === 'fae'
      ? 'fae'
      : (beast.companionSlot === 'fae_pack' ? 'fae_pack' : 'beastmaster');
    const followPos = this.room?.getCompanionFollowPosition?.(owner, slot)
      ?? {
        x: (owner.position?.x ?? 0) + (slot === 'fae' ? 2.2 : (slot === 'fae_pack' ? 0 : -2.2)),
        y: 0,
        z: (owner.position?.z ?? 0) + (slot === 'fae_pack' ? -2.8 : -1.5),
      };
    return {
      followPos,
      followTarget: { id: `follow-${owner.id}-${slot}`, position: followPos },
    };
  }

  updateAlliedBeastFollowOnly(beast, players) {
    if (!this.room || beast.isDying || beast.health <= 0) return;
    const config = getAlliedBeastConfig(beast.type);
    if (!config) return;
    const now = Date.now();
    this.tryAlliedBeastHpRegen(beast, config, now);
    const lockUntil = this.meleeLockUntil.get(beast.id) || 0;
    if (now < lockUntil) return;

    if (beast.beastCompanionPhase === 'entering') {
      this.updateAlliedBeastEntering(beast, players, config);
      return;
    }

    beast.tigerLocomotion = 'walk';
    beast.moveSpeed = config.walkSpeed;
    const owner = this.findAlliedBeastOwner(beast, players);
    if (!owner) return;
    const { followPos, followTarget } = this._getCompanionFollowAnchor(beast, owner);
    const d = this.calculateDistance(beast.position, followPos);
    // Stay on flank slot (small threshold) rather than clustering on the owner.
    if (d > 0.6) {
      this.moveEnemyTowardsTarget(beast, followTarget, { stopThreshold: 0.6 });
    } else {
      this._queueMoveIfChanged(beast.id, beast.position, beast.rotation);
    }
  }

  /**
   * Force hostiles to focus an allied unit (Bear Siegebreaker taunt).
   */
  tauntEnemyToAlliedUnit(enemyId, allyId, durationMs = 6000) {
    const ally = this.room?.enemies?.get?.(allyId);
    if (!ally || ally.isDying || (ally.health ?? 0) <= 0) return;
    this.applyAlliedUnitThreat(enemyId, allyId, 2000);
    // Soft player-style taunt timer so UI can show taunt FX keyed to ally owner.
    const ownerId = ally.ownerPlayerId;
    if (ownerId) {
      const tauntEndTime = Date.now() + durationMs;
      this.enemyTaunts.set(enemyId, {
        taunterPlayerId: ownerId,
        tauntEndTime,
        taunterAlliedUnitId: allyId,
      });
    }
  }

  alliedBearCastSiegebreakerTaunt(bear) {
    if (!bear || !bear.petUpgradeSiegebreaker) return false;
    const now = Date.now();
    const last = bear._siegebreakerTauntAt || 0;
    if (now - last < PET_UPGRADE_SIEGEBREAKER_TAUNT_CD_MS) return false;

    const hostiles = [];
    for (const enemy of this.room.enemies.values()) {
      if (!this.isValidAlliedKnightTarget(enemy, bear)) continue;
      const dist = this.calculateDistance(bear.position, enemy.position);
      if (dist > PET_UPGRADE_SIEGEBREAKER_TAUNT_RANGE) continue;
      hostiles.push(enemy);
    }
    if (hostiles.length === 0) return false;

    bear._siegebreakerTauntAt = now;
    this.meleeLockUntil.set(bear.id, now + 800);
    for (const enemy of hostiles) {
      this.tauntEnemyToAlliedUnit(enemy.id, bear.id, PET_UPGRADE_SIEGEBREAKER_TAUNT_DURATION_MS);
    }
    if (this.io) {
      this.io.to(this.roomId).emit('allied-bear-siegebreaker-taunt', {
        bearId: bear.id,
        beastId: bear.id,
        enemyIds: hostiles.map((e) => e.id),
        durationMs: PET_UPGRADE_SIEGEBREAKER_TAUNT_DURATION_MS,
        range: PET_UPGRADE_SIEGEBREAKER_TAUNT_RANGE,
        position: { ...bear.position },
        timestamp: now,
      });
    }
    return true;
  }

  findAlliedSpiderEnsnareTarget(spider) {
    let best = null;
    let bestScore = Infinity;
    for (const enemy of this.room.enemies.values()) {
      if (!this.isValidAlliedKnightTarget(enemy, spider)) continue;
      if (this._isTargetAirborne(enemy)) continue;
      const dist = this.calculateDistance(spider.position, enemy.position);
      if (dist > PET_UPGRADE_ENSNARING_THREADS_RANGE) continue;
      const entangled = this.room?.isEnemyAffectedBy?.(enemy.id, 'entangle') ? 1 : 0;
      // Prefer non-entangled, then nearest.
      const score = entangled * 1000 + dist;
      if (score < bestScore) {
        bestScore = score;
        best = enemy;
      }
    }
    return best;
  }

  alliedSpiderCastEnsnaringThreads(spider, targetEnemy, ownerPlayerId) {
    if (!spider?.petUpgradeEnsnaringThreads || !targetEnemy) return false;
    const now = Date.now();
    const last = spider._ensnaringThreadsAt || 0;
    if (now - last < PET_UPGRADE_ENSNARING_THREADS_CD_MS) return false;

    spider._ensnaringThreadsAt = now;
    this.meleeLockUntil.set(spider.id, now + PET_UPGRADE_ENSNARING_THREADS_CAST_MS);

    const dx = targetEnemy.position.x - spider.position.x;
    const dz = targetEnemy.position.z - spider.position.z;
    if (dx || dz) spider.rotation = Math.atan2(dx, dz);
    this._queueMove(spider.id, spider.position, spider.rotation);

    const shotId = `ensnare-threads-${spider.id}-${now}`;
    if (this.io) {
      this.io.to(this.roomId).emit('allied-spider-ensnaring-threads-cast', {
        spiderId: spider.id,
        beastId: spider.id,
        shotId,
        durationMs: PET_UPGRADE_ENSNARING_THREADS_CAST_MS,
        timestamp: now,
      });
    }

    const spiderId = spider.id;
    const targetId = targetEnemy.id;
    this._scheduleTimeout(() => {
      if (!this.room?.getGameStarted()) return;
      const liveSpider = this.room?.getEnemy(spiderId);
      if (!liveSpider || liveSpider.isDying || liveSpider.health <= 0) return;
      const liveTarget = this.room?.getEnemy(targetId);
      if (!this.isValidAlliedKnightTarget(liveTarget, liveSpider)) return;

      const start = {
        x: liveSpider.position.x,
        y: (liveSpider.position.y ?? 0) + 1.0,
        z: liveSpider.position.z,
      };
      const target = {
        x: liveTarget.position.x,
        y: (liveTarget.position.y ?? 0) + 1.0,
        z: liveTarget.position.z,
      };
      if (this.io) {
        this.io.to(this.roomId).emit('allied-spider-ensnaring-threads-telegraph', {
          spiderId,
          beastId: spiderId,
          shotId,
          startPosition: start,
          targetPosition: target,
          maxRange: PET_UPGRADE_ENSNARING_THREADS_RANGE,
          timestamp: Date.now(),
        });
      }

      const dirLen = Math.hypot(target.x - start.x, target.z - start.z) || 1;
      const travel = Math.min(PET_UPGRADE_ENSNARING_THREADS_RANGE, dirLen);
      const dir = { x: (target.x - start.x) / dirLen, z: (target.z - start.z) / dirLen };
      const pos = { x: start.x, z: start.z };
      const STEP_MS = 50;
      const maxSteps = Math.ceil((travel / PET_UPGRADE_ENSNARING_THREADS_SPEED) * (1000 / STEP_MS)) + 4;
      let steps = 0;
      const intervalId = setInterval(() => {
        if (!this.room?.getGameStarted()) {
          clearInterval(intervalId);
          this._removeEnemyHazardInterval(spiderId, intervalId);
          return;
        }
        steps++;
        pos.x += dir.x * PET_UPGRADE_ENSNARING_THREADS_SPEED * (STEP_MS / 1000);
        pos.z += dir.z * PET_UPGRADE_ENSNARING_THREADS_SPEED * (STEP_MS / 1000);
        const hitR2 = PET_UPGRADE_ENSNARING_THREADS_HIT_RADIUS * PET_UPGRADE_ENSNARING_THREADS_HIT_RADIUS;
        for (const enemy of this.room.enemies.values()) {
          if (!this.isValidAlliedKnightTarget(enemy, liveSpider)) continue;
          const hdx = enemy.position.x - pos.x;
          const hdz = enemy.position.z - pos.z;
          if (hdx * hdx + hdz * hdz <= hitR2) {
            clearInterval(intervalId);
            this._removeEnemyHazardInterval(spiderId, intervalId);
            this.room.damageEnemy(enemy.id, PET_UPGRADE_ENSNARING_THREADS_DAMAGE, ownerPlayerId, null, {
              sourceAlliedUnitId: spiderId,
              damageType: 'allied_spider_ensnaring_threads',
            });
            this.room.applyEntanglementOnHit(enemy.id, ownerPlayerId, null, {
              sourceAlliedUnitId: spiderId,
              entangleTheme: 'spider',
            });
            this.io?.to(this.roomId).emit('allied-spider-ensnaring-threads-impact', {
              spiderId,
              beastId: spiderId,
              shotId,
              hit: true,
              position: { x: pos.x, y: 0, z: pos.z },
              targetEnemyId: enemy.id,
              entangleTheme: 'spider',
              timestamp: Date.now(),
            });
            return;
          }
        }
        if (steps >= maxSteps) {
          clearInterval(intervalId);
          this._removeEnemyHazardInterval(spiderId, intervalId);
          this.io?.to(this.roomId).emit('allied-spider-ensnaring-threads-impact', {
            spiderId,
            beastId: spiderId,
            shotId,
            hit: false,
            position: { x: pos.x, y: 0, z: pos.z },
            timestamp: Date.now(),
          });
        }
      }, STEP_MS);
      this._addEnemyHazardInterval(spiderId, intervalId);
    }, PET_UPGRADE_ENSNARING_THREADS_CAST_MS);

    return true;
  }

  updateAlliedBeastAI(ally, players) {
    if (!this.room || ally.isDying || ally.health <= 0) return;
    if (this._shouldAlliesDisengageForDreamshroud()) {
      ally.alliedTargetEnemyId = null;
      ally.combatInitiated = false;
      this.updateAlliedBeastFollowOnly(ally, players);
      return;
    }
    if (this.room.isEnemyAffectedBy(ally.id, 'hostileFreeze')) return;
    const config = getAlliedBeastConfig(ally.type);
    if (!config) return;
    const now = Date.now();
    this.tryAlliedBeastHpRegen(ally, config, now);
    const lockUntil = this.meleeLockUntil.get(ally.id) || 0;
    if (now < lockUntil) return;

    if (ally.beastCompanionPhase === 'entering') {
      this.updateAlliedBeastEntering(ally, players, config);
      return;
    }

    // Outside combat rooms: follow only.
    if (this.room.combatArenaActive === false) {
      this.updateAlliedBeastFollowOnly(ally, players);
      return;
    }

    const owner = this.findAlliedBeastOwner(ally, players);

    // Spider Ensnaring Threads: prefer ranged web shots, spreading entangles.
    if (ally.petUpgradeEnsnaringThreads && ally.type === 'allied-spider') {
      const ensnareTarget = this.findAlliedSpiderEnsnareTarget(ally);
      if (ensnareTarget) {
        ally.alliedTargetEnemyId = ensnareTarget.id;
        ally.combatInitiated = true;
        this.emitBeastAggroSfx(ally);
        ally.tigerLocomotion = 'run';
        ally.moveSpeed = config.runSpeed;
        const dist = this.calculateDistance(ally.position, ensnareTarget.position);
        const dx = ensnareTarget.position.x - ally.position.x;
        const dz = ensnareTarget.position.z - ally.position.z;
        ally.rotation = Math.atan2(dx, dz);
        this._queueMoveIfChanged(ally.id, ally.position, ally.rotation);
        const lastShot = ally._ensnaringThreadsAt || 0;
        if (now - lastShot >= PET_UPGRADE_ENSNARING_THREADS_CD_MS) {
          if (this.alliedSpiderCastEnsnaringThreads(ally, ensnareTarget, owner?.id || ally.ownerPlayerId)) {
            return;
          }
        }
        // While on cooldown, stay at mid-range rather than closing for melee.
        if (dist > 6) {
          this.moveEnemyTowardsTarget(ally, { id: ensnareTarget.id, position: ensnareTarget.position }, {
            meleeSurroundAttackRange: 5.5,
            combatTargetId: ensnareTarget.id,
          });
          return;
        }
      }
    }

    // Bear Siegebreaker: periodic AOE taunt when hostiles are nearby.
    if (ally.petUpgradeSiegebreaker && ally.type === 'allied-bear') {
      this.alliedBearCastSiegebreakerTaunt(ally);
    }

    const target = this.findAlliedBeastTarget(ally, config);

    if (!target) {
      this.clearBeastAggroSfx(ally.id);
      ally.tigerLocomotion = 'walk';
      ally.moveSpeed = config.walkSpeed;
      if (owner) {
        const { followPos, followTarget } = this._getCompanionFollowAnchor(ally, owner);
        const d = this.calculateDistance(ally.position, followPos);
        if (d > 0.6) {
          this.moveEnemyTowardsTarget(ally, followTarget, { stopThreshold: 0.6 });
        } else {
          this._queueMoveIfChanged(ally.id, ally.position, ally.rotation);
        }
      }
      return;
    }

    this._alliedBeastEngageMeleeTarget(ally, target, config, now);
  }

  // Backward-compatible aliases for Beastmaster tiger call sites.
  findAlliedTigerOwner(tiger, players) {
    return this.findAlliedBeastOwner(tiger, players);
  }

  findAlliedTigerTarget(tiger) {
    return this.findAlliedBeastTarget(tiger, ALLIED_BEAST_CONFIGS['allied-tiger']);
  }

  telegraphAlliedTigerAttack(tiger, target, attackVariant) {
    this.telegraphAlliedBeastAttack(tiger, target, attackVariant, ALLIED_BEAST_CONFIGS['allied-tiger']);
  }

  updateAlliedTigerFollowOnly(tiger, players) {
    this.updateAlliedBeastFollowOnly(tiger, players);
  }

  updateAlliedTigerAI(ally, players) {
    this.updateAlliedBeastAI(ally, players);
  }

  findAlliedEnchantressHostilesInRange(enchantress, range) {
    if (!this.room) return [];
    const candidates = [];
    for (const enemy of this.room.enemies.values()) {
      if (!this.isValidAlliedKnightTarget(enemy, enchantress)) continue;
      const dist = this.calculateDistance(enchantress.position, enemy.position);
      if (dist > range) continue;
      candidates.push({ enemy, dist });
    }
    candidates.sort((a, b) => a.dist - b.dist);
    return candidates.map((c) => c.enemy);
  }

  alliedEnchantressCastEarthShock(enchantress, targetEnemy, ownerPlayerId, ownerPlayer) {
    const now = Date.now();
    const earthShockDamage = this.getEnchantressEarthShockDamage(this.getCoopAlliedKnightBoons());
    const dx = targetEnemy.position.x - enchantress.position.x;
    const dz = targetEnemy.position.z - enchantress.position.z;
    if (dx || dz) enchantress.rotation = Math.atan2(dx, dz);
    this._queueMove(enchantress.id, enchantress.position, enchantress.rotation);

    const lockMs = ALLIED_ENCHANTRESS_EARTH_SHOCK_CHARGE_MS;
    this.meleeLockUntil.set(enchantress.id, now + lockMs);
    if (this.io) {
      this.io.to(this.roomId).emit('greed-ability-telegraph', {
        greedId: enchantress.id,
        ability: 'cast',
        durationMs: lockMs,
        timestamp: now,
      });
    }

    const enchantressId = enchantress.id;
    const targetId = targetEnemy.id;
    this._scheduleTimeout(() => {
      if (!this.room?.getGameStarted()) return;
      const liveEnchantress = this.room?.getEnemy(enchantressId);
      if (!liveEnchantress || liveEnchantress.isDying || liveEnchantress.health <= 0) return;
      const liveTarget = this.room?.getEnemy(targetId);
      if (!this.isValidAlliedKnightTarget(liveTarget, liveEnchantress)) return;

      const start = {
        x: liveEnchantress.position.x,
        y: liveEnchantress.position.y + 1.4,
        z: liveEnchantress.position.z,
      };
      const target = {
        x: liveTarget.position.x,
        y: liveTarget.position.y + 1.0,
        z: liveTarget.position.z,
      };
      if (this.io) {
        this.io.to(this.roomId).emit('enchantress-earth-shock-telegraph', {
          enchantressId,
          startPosition: start,
          targetPosition: target,
          damage: earthShockDamage,
          timestamp: Date.now(),
        });
      }

      const dirLen = Math.hypot(target.x - start.x, target.z - start.z) || 1;
      const dir = { x: (target.x - start.x) / dirLen, z: (target.z - start.z) / dirLen };
      const pos = { x: start.x, z: start.z };
      const STEP_MS = 50;
      const maxSteps = Math.ceil((dirLen / GREED_FIREBALL_SPEED) * (1000 / STEP_MS)) + 4;
      let steps = 0;
      const intervalId = setInterval(() => {
        if (!this.room?.getGameStarted()) {
          clearInterval(intervalId);
          this._removeEnemyHazardInterval(enchantressId, intervalId);
          return;
        }
        steps++;
        pos.x += dir.x * GREED_FIREBALL_SPEED * (STEP_MS / 1000);
        pos.z += dir.z * GREED_FIREBALL_SPEED * (STEP_MS / 1000);
        for (const enemy of this.room.enemies.values()) {
          if (!this.isValidAlliedKnightTarget(enemy, liveEnchantress)) continue;
          const hdx = enemy.position.x - pos.x;
          const hdz = enemy.position.z - pos.z;
          if (hdx * hdx + hdz * hdz <= GREED_FIREBALL_HIT_RADIUS * GREED_FIREBALL_HIT_RADIUS) {
            clearInterval(intervalId);
            this._removeEnemyHazardInterval(enchantressId, intervalId);
            this.room.damageEnemy(enemy.id, earthShockDamage, ownerPlayerId, ownerPlayer, {
              sourceAlliedUnitId: enchantressId,
              damageType: 'enchantress_earth_shock',
            });
            this.io?.to(this.roomId).emit('enchantress-earth-shock-impact', {
              enchantressId,
              position: { x: pos.x, y: 0, z: pos.z },
              hit: true,
              timestamp: Date.now(),
            });
            return;
          }
        }
        if (steps >= maxSteps) {
          clearInterval(intervalId);
          this._removeEnemyHazardInterval(enchantressId, intervalId);
          this.io?.to(this.roomId).emit('enchantress-earth-shock-impact', {
            enchantressId,
            position: { x: pos.x, y: 0, z: pos.z },
            hit: false,
            timestamp: Date.now(),
          });
        }
      }, STEP_MS);
      this._addEnemyHazardInterval(enchantressId, intervalId);
    }, lockMs);
  }

  alliedEnchantressCastGraspingVines(enchantress, ownerPlayerId, ownerPlayer) {
    const now = Date.now();
    const hostiles = this.findAlliedEnchantressHostilesInRange(
      enchantress,
      ALLIED_ENCHANTRESS_GRASPING_VINES_RANGE,
    );
    if (hostiles.length === 0) return;

    const primary = hostiles[0];
    const dx = primary.position.x - enchantress.position.x;
    const dz = primary.position.z - enchantress.position.z;
    if (dx || dz) enchantress.rotation = Math.atan2(dx, dz);
    this._queueMove(enchantress.id, enchantress.position, enchantress.rotation);

    const lockMs = ALLIED_ENCHANTRESS_GRASPING_VINES_CHARGE_MS;
    this.meleeLockUntil.set(enchantress.id, now + lockMs);
    if (this.io) {
      this.io.to(this.roomId).emit('greed-ability-telegraph', {
        greedId: enchantress.id,
        ability: 'healcast',
        durationMs: lockMs,
        timestamp: now,
      });
    }

    const enchantressId = enchantress.id;
    this._scheduleTimeout(() => {
      if (!this.room?.getGameStarted()) return;
      const liveEnchantress = this.room?.getEnemy(enchantressId);
      if (!liveEnchantress || liveEnchantress.isDying || liveEnchantress.health <= 0) return;
      const targets = this.findAlliedEnchantressHostilesInRange(
        liveEnchantress,
        ALLIED_ENCHANTRESS_GRASPING_VINES_RANGE,
      ).slice(0, ALLIED_ENCHANTRESS_GRASPING_VINES_MAX_TARGETS);
      for (const enemy of targets) {
        this.room.applyEntanglementOnHit(enemy.id, ownerPlayerId, ownerPlayer, {
          sourceAlliedUnitId: liveEnchantress.id,
        });
      }
    }, lockMs);
  }

  updateAlliedEnchantressAI(ally, players) {
    if (!this.room || ally.isDying || ally.health <= 0) return;
    if (this._shouldAlliesDisengageForDreamshroud()) {
      this._followOwnerDuringDreamshroud(ally, players);
      return;
    }
    const now = Date.now();
    const lockUntil = this.meleeLockUntil.get(ally.id) || 0;
    if (now < lockUntil) return;
    const boons = this.getCoopAlliedKnightBoons();
    this.applyNecrosInitiateIfNeeded(ally, boons);

    const closestPlayer = this.findClosestPlayer(ally, players);
    const ownerPlayerId = closestPlayer?.id || null;
    const ownerPlayer = ownerPlayerId ? this.room.players.get(ownerPlayerId) : null;

    const lastEarthShock = this.enchantressEarthShockCooldown.get(ally.id) || 0;
    const lastVines = this.enchantressGraspingVinesCooldown.get(ally.id) || 0;
    const earthShockCooldown = this.getEnchantressEarthShockCooldownMs(boons);
    const earthShockReady = now - lastEarthShock >= earthShockCooldown;
    const vinesReady = now - lastVines >= ALLIED_ENCHANTRESS_GRASPING_VINES_COOLDOWN_MS;

    const vineTargets = vinesReady
      ? this.findAlliedEnchantressHostilesInRange(ally, ALLIED_ENCHANTRESS_GRASPING_VINES_RANGE)
      : [];
    const shockTargets = earthShockReady
      ? this.findAlliedEnchantressHostilesInRange(ally, ALLIED_ENCHANTRESS_ATTACK_RANGE)
      : [];

    if (vinesReady && vineTargets.length > 0 && ownerPlayerId) {
      this.enchantressGraspingVinesCooldown.set(ally.id, now);
      this.alliedEnchantressCastGraspingVines(ally, ownerPlayerId, ownerPlayer);
      return;
    }

    if (earthShockReady && shockTargets.length > 0 && ownerPlayerId) {
      this.enchantressEarthShockCooldown.set(ally.id, now);
      this.alliedEnchantressCastEarthShock(ally, shockTargets[0], ownerPlayerId, ownerPlayer);
      return;
    }

    if (closestPlayer) {
      const d = this.calculateDistance(ally.position, closestPlayer.position);
      if (d > ALLIED_KNIGHT_FOLLOW_DISTANCE) {
        this.moveEnemyTowardsTarget(ally, closestPlayer);
      }
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
    this._scheduleTimeout(() => {
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
        _enemyAiLog(`✨ Allied healer ${liveHealer.id} healed ${targetKind}:${targetId} for ${healed} HP`);
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
      if (this.isAssassinUntargetable(enemy)) return;
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

    this._scheduleTimeout(() => {
      const liveHealer = this.room?.getEnemy?.(healerId);
      if (!liveHealer || liveHealer.isDying || liveHealer.health <= 0 || !this.room?.getGameStarted()) return;
      if (this.room?.isEnemyAffectedBy(liveHealer.id, 'stun')) return;

      const enemies = this.room.getEnemies?.();
      if (!enemies) return;

      const hitEnemies = [];
      const each = (enemy) => {
        if (!enemy || enemy.alliedUnit || enemy.isDying || enemy.health <= 0) return;
        if (this.isAssassinUntargetable(enemy)) return;
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
    if (this._shouldAlliesDisengageForDreamshroud()) {
      this._followOwnerDuringDreamshroud(healer, players);
      return;
    }
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

    this._scheduleTimeout(() => {
      const spawned = this.room?.getEnemy(zombieId);
      if (spawned && !spawned.isDying && spawned.type === 'player-zombie') {
        let moveSpeed = PLAYER_ZOMBIE_UNLOCK_MOVE_SPEED;
        const nowBoons = this.getCoopZombieBoons(ownerId);
        if (nowBoons.berserkerStrain) moveSpeed *= BERSERKER_STRAIN_MOVE_MULT;
        spawned.moveSpeed = moveSpeed;
        spawned.summonUnlockAt = null;
      }
    }, summonLockMs);

    _enemyAiLog(`🧟 Infested zombie ${zombieId} raised for player ${ownerId}`);
  }

  countLivingVengefulSpirits() {
    if (!this.room) return 0;
    let count = 0;
    for (const e of this.room.enemies.values()) {
      if (
        e &&
        e.type === 'vengeful-spirit' &&
        !e.isDying &&
        (e.health ?? 0) > 0
      ) {
        count += 1;
      }
    }
    return count;
  }

  trySpawnVengefulSpirit(ownerId, player, position) {
    if (!this.room || !ownerId || !position) return;
    if (this.countLivingVengefulSpirits() >= VENGEFUL_SPIRIT_MAX_ACTIVE) return;

    const angle = Math.random() * Math.PI * 2;
    const ox = Math.cos(angle) * VENGEFUL_SPIRIT_SPAWN_OFFSET;
    const oz = Math.sin(angle) * VENGEFUL_SPIRIT_SPAWN_OFFSET;
    const spawnX = (position.x ?? 0) + ox;
    const spawnZ = (position.z ?? 0) + oz;
    const now = Date.now();
    const spiritId = `vengeful-spirit-${ownerId}-${now}`;
    const damage = this.room.getVengefulSpiritDamage
      ? this.room.getVengefulSpiritDamage(player)
      : VENGEFUL_SPIRIT_BASE_DAMAGE;

    const faceDx = (position.x ?? 0) - spawnX;
    const faceDz = (position.z ?? 0) - spawnZ;
    const spawnRotation =
      faceDx !== 0 || faceDz !== 0
        ? Math.atan2(faceDx, faceDz)
        : Math.random() * Math.PI * 2;

    const spirit = {
      id: spiritId,
      type: 'vengeful-spirit',
      ownerPlayerId: ownerId,
      position: { x: spawnX, y: position.y ?? 0, z: spawnZ },
      rotation: spawnRotation,
      health: 1,
      maxHealth: 1,
      isDying: false,
      damage,
      attackCooldown: VENGEFUL_SPIRIT_ATTACK_COOLDOWN_MS,
      moveSpeed: 0,
      attackVariant: 1,
      summonUnlockAt: now + VENGEFUL_SPIRIT_SUMMON_LOCK_MS,
      expireAt: now + VENGEFUL_SPIRIT_DURATION_MS,
      expireAnimAt: now + VENGEFUL_SPIRIT_DURATION_MS - VENGEFUL_SPIRIT_EXPIRE_ANIM_MS,
      isExpiring: false,
      staggerBuildup: 0,
    };

    this.room.addEnemy(spirit);

    if (this.io) {
      this.io.to(this.roomId).emit('enemy-spawned', {
        enemy: spirit,
        timestamp: Date.now(),
      });
    }

    // Main AI paused (throne / intermission): ensure companion tick runs for spirits.
    if (this.room.combatArenaActive === false) {
      this.room.startCompanionAI?.();
    }

    const expireAnimDelay = VENGEFUL_SPIRIT_DURATION_MS - VENGEFUL_SPIRIT_EXPIRE_ANIM_MS;
    this._scheduleTimeout(() => {
      const live = this.room?.getEnemy(spiritId);
      if (!live || live.isDying || live.type !== 'vengeful-spirit') return;
      if (live.isExpiring) return;
      live.isExpiring = true;
      if (this.io) {
        this.io.to(this.roomId).emit('vengeful-spirit-expire-telegraph', {
          spiritId,
          position: { x: live.position.x, y: live.position.y, z: live.position.z },
          timestamp: Date.now(),
        });
      }
    }, expireAnimDelay);

    // Guaranteed removal after full lifetime (works even if companion/main AI misses expireAt).
    this._scheduleTimeout(() => {
      const live = this.room?.getEnemy(spiritId);
      if (!live || live.type !== 'vengeful-spirit') return;
      if (live.isDying || live._vengefulRemovalScheduled) return;
      live.isDying = true;
      live._vengefulRemovalScheduled = true;
      this._scheduleTimeout(() => {
        if (!this.room?.getGameStarted()) return;
        if (this.room?.enemies.has(spiritId)) {
          this.room.enemies.delete(spiritId);
          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', {
              enemyId: spiritId,
              timestamp: Date.now(),
            });
          }
        }
        this.removeEnemyAggro(spiritId);
      }, VENGEFUL_SPIRIT_EXPIRE_ANIM_MS);
    }, VENGEFUL_SPIRIT_DURATION_MS);

    _enemyAiLog(`👻 Vengeful spirit ${spiritId} summoned for player ${ownerId}`);
  }

  telegraphVengefulSpiritAttack(spirit, targetEnemy, attackVariant) {
    if (this.io) {
      this.io.to(this.roomId).emit('vengeful-spirit-attack-telegraph', {
        spiritId: spirit.id,
        targetEnemyId: targetEnemy.id,
        attackVariant: attackVariant === 2 ? 2 : 1,
        position: spirit.position,
        timestamp: Date.now(),
      });
    }
  }

  updateVengefulSpiritAI(spirit, players) {
    const now = Date.now();
    if (spirit.expireAt && now >= spirit.expireAt && !spirit.isDying) {
      spirit.isDying = true;
      if (spirit._vengefulRemovalScheduled) return;
      spirit._vengefulRemovalScheduled = true;
      const sid = spirit.id;
      this._scheduleTimeout(() => {
        if (!this.room?.getGameStarted()) return;
        if (this.room?.enemies.has(sid)) {
          this.room.enemies.delete(sid);
          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', { enemyId: sid, timestamp: Date.now() });
          }
        }
        this.removeEnemyAggro(sid);
      }, VENGEFUL_SPIRIT_EXPIRE_ANIM_MS);
      return;
    }
    if (spirit.isDying || spirit.isExpiring) return;

    if (spirit.expireAnimAt && now >= spirit.expireAnimAt && !spirit.isExpiring) {
      spirit.isExpiring = true;
      if (this.io) {
        this.io.to(this.roomId).emit('vengeful-spirit-expire-telegraph', {
          spiritId: spirit.id,
          position: { x: spirit.position.x, y: spirit.position.y, z: spirit.position.z },
          timestamp: Date.now(),
        });
      }
      return;
    }

    if (spirit.summonUnlockAt && now < spirit.summonUnlockAt) return;

    if (this._shouldAlliesDisengageForDreamshroud()) {
      this._followOwnerDuringDreamshroud(spirit, players);
      return;
    }

    const hostile = this.findNearestHostileForZombie(spirit);
    const attackRange = VENGEFUL_SPIRIT_ATTACK_RANGE;
    const attackCooldown = spirit.attackCooldown ?? VENGEFUL_SPIRIT_ATTACK_COOLDOWN_MS;
    const lockUntil = this.meleeLockUntil.get(spirit.id) || 0;
    if (now < lockUntil) return;

    if (!hostile) {
      this._queueMoveIfChanged(spirit.id, spirit.position, spirit.rotation);
      return;
    }

    const distance = this.calculateDistance(spirit.position, hostile.position);
    const dx = hostile.position.x - spirit.position.x;
    const dz = hostile.position.z - spirit.position.z;
    spirit.rotation = Math.atan2(dx, dz);
    this._queueMoveIfChanged(spirit.id, spirit.position, spirit.rotation);

    if (distance > attackRange) return;

    if (!this.ghoulAttackCooldown.has(spirit.id)) {
      this.ghoulAttackCooldown.set(spirit.id, 0);
    }
    const lastAttackTime = this.ghoulAttackCooldown.get(spirit.id);
    if (now - lastAttackTime < attackCooldown) return;

    this.ghoulAttackCooldown.set(spirit.id, now);
    this.meleeLockUntil.set(spirit.id, now + VENGEFUL_SPIRIT_SWING_LOCK_MS);
    const nextVariant = spirit.attackVariant === 2 ? 1 : 2;
    spirit.attackVariant = nextVariant;
    this.telegraphVengefulSpiritAttack(spirit, hostile, nextVariant);

    const targetId = hostile.id;
    const spiritId = spirit.id;
    this._scheduleTimeout(() => {
      if (!this.room?.getGameStarted()) return;
      const liveSpirit = this.room?.getEnemy(spiritId);
      if (!liveSpirit || liveSpirit.isDying || liveSpirit.isExpiring || liveSpirit.health <= 0) return;
      const liveHostile = this.room?.getEnemy(targetId);
      if (!this.isValidAlliedKnightTarget(liveHostile, liveSpirit)) return;
      const currentDist = this.calculateDistance(liveSpirit.position, liveHostile.position);
      if (currentDist <= attackRange + 0.5) {
        const dmg = liveSpirit.damage || VENGEFUL_SPIRIT_BASE_DAMAGE;
        this.room.damageEnemy(liveHostile.id, Math.round(dmg), liveSpirit.ownerPlayerId, null, {
          sourceAlliedUnitId: liveSpirit.id,
          damageType: 'vengeful_spirit_melee',
        });
      }
    }, VENGEFUL_SPIRIT_HIT_DELAY_MS);
  }

  findNearestHostileForZombie(zombie) {
    if (!this.room) return null;
    const isPlayerCombatAlly = this._isPlayerCombatAlly(zombie);
    let best = null;
    let bestD = Infinity;
    for (const e of this.room.enemies.values()) {
      if (!e || e.id === zombie.id || e.isDying) continue;
      if (this.isFriendlyCombatUnit(e)) continue;
      if (this.isAssassinUntargetable(e)) continue;
      if (e.type === 'training-dummy') {
        // Necromancer spirits may hit the throne dummy during prep only.
        if (zombie.type !== 'vengeful-spirit') continue;
        if (!this.room?.isInCoopThronePrep?.()) continue;
      }
      if (e.health <= 0) continue;
      if (isPlayerCombatAlly && !this.isValidAlliedKnightTarget(e, zombie)) continue;
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

    for (const e of this.room.enemies.values()) {
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
      this._scheduleTimeout(() => {
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

    if (this._shouldAlliesDisengageForDreamshroud()) {
      const owner = players.find((p) => p.id === zombie.ownerPlayerId);
      if (owner && owner.health > 0) {
        this.moveEnemyTowardsTarget(zombie, owner);
      }
      return;
    }

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

          this._scheduleTimeout(() => {
            if (zombie.isDying || !this.room?.getGameStarted()) return;
            const attacker = this.room?.getEnemy(zombie.id) || zombie;
            const liveHostile = this.room?.getEnemy(hostile.id);
            if (!liveHostile || liveHostile.isDying || liveHostile.health <= 0) return;
            if (this.isAssassinUntargetable(liveHostile)) return;
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
      const useHexInterior = this._isHexCombatArena();
      const next = this.room?._generateScatteredPositions?.(1, useHexInterior)?.[0];
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
      this._scheduleTimeout(() => {
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
    this._scheduleTimeout(() => {
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
   * (it only touches knight.id/position/rotation and generic room getters).
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
    const gid = greed.id;
    const hitRadiusSq = GREED_FIREBALL_HIT_RADIUS * GREED_FIREBALL_HIT_RADIUS;
    const applyGreedFireballImpact = () => {
      this.room.damagePlayersInHorizontalRing(
        { x: pos.x, z: pos.z },
        GREED_FIREBALL_HIT_RADIUS,
        GREED_RED_DAMAGE,
        'greed_fireball',
        { sourceEnemyId: gid },
      );
      this.room.tryDamageAlliedKnightInXZDisk(
        { x: pos.x, z: pos.z },
        GREED_FIREBALL_HIT_RADIUS,
        GREED_RED_DAMAGE,
        { sourceEnemyId: gid, damageType: 'greed_fireball' },
      );
      this.io?.to(this.roomId).emit('greed-fireball-impact', {
        greedId: gid, position: pos, hit: true, timestamp: Date.now(),
      });
    };
    const intervalId = setInterval(() => {
      if (!this.room?.getGameStarted()) {
        clearInterval(intervalId);
        this._removeEnemyHazardInterval(gid, intervalId);
        return;
      }
      steps++;
      pos.x += dir.x * GREED_FIREBALL_SPEED * (STEP_MS / 1000);
      pos.z += dir.z * GREED_FIREBALL_SPEED * (STEP_MS / 1000);
      const playerMap = this.room?.players;
      if (playerMap) {
        for (const p of playerMap.values()) {
          if (!p || p.health <= 0) continue;
          const hdx = p.position.x - pos.x;
          const hdz = p.position.z - pos.z;
          if (hdx * hdx + hdz * hdz <= hitRadiusSq) {
            clearInterval(intervalId);
            this._removeEnemyHazardInterval(gid, intervalId);
            applyGreedFireballImpact();
            return;
          }
        }
      }
      const enemyMap = this.room?.enemies;
      if (enemyMap) {
        for (const ally of enemyMap.values()) {
          if (!ally?.alliedUnit || ally.isDying || ally.health <= 0) continue;
          const hdx = (ally.position?.x ?? 0) - pos.x;
          const hdz = (ally.position?.z ?? 0) - pos.z;
          if (hdx * hdx + hdz * hdz <= hitRadiusSq) {
            clearInterval(intervalId);
            this._removeEnemyHazardInterval(gid, intervalId);
            applyGreedFireballImpact();
            return;
          }
        }
      }
      if (steps >= maxSteps) {
        clearInterval(intervalId);
        this._removeEnemyHazardInterval(gid, intervalId);
        this.io?.to(this.roomId).emit('greed-fireball-impact', {
          greedId: gid, position: pos, hit: false, timestamp: Date.now(),
        });
      }
    }, STEP_MS);
    this._addEnemyHazardInterval(gid, intervalId);
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
    const gid = greed.id;
    const intervalId = setInterval(() => {
      if (!this.room?.getGameStarted()) {
        clearInterval(intervalId);
        this._removeEnemyHazardInterval(gid, intervalId);
        return;
      }
      elapsed += GREED_BLUE_EMBER_TICK_MS;
      this.room?.damagePlayersInHorizontalRing(position, GREED_BLUE_EMBER_RADIUS, GREED_BLUE_EMBER_DAMAGE, 'greed_blue_ember', { sourceEnemyId: gid });
      if (elapsed >= GREED_BLUE_EMBER_DURATION_MS) {
        clearInterval(intervalId);
        this._removeEnemyHazardInterval(gid, intervalId);
        this.io?.to(this.roomId).emit('greed-ember-zone-expired', { id: zoneId, timestamp: Date.now() });
      }
    }, GREED_BLUE_EMBER_TICK_MS);
    this._addEnemyHazardInterval(gid, intervalId);
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

  /** Grid-based LOS — walks nav cells along the segment instead of 166 wall AABB tests. */
  _hasLineOfSightGrid(posA, posB) {
    if (!this.navGrid) this.navGrid = this._buildNavGrid();
    const grid = this.navGrid;
    let { col: c0, row: r0 } = this._worldToGrid(posA.x, posA.z);
    let { col: c1, row: r1 } = this._worldToGrid(posB.x, posB.z);
    const dc = Math.abs(c1 - c0);
    const dr = Math.abs(r1 - r0);
    const sc = c0 < c1 ? 1 : -1;
    const sr = r0 < r1 ? 1 : -1;
    let err = dc - dr;
    for (;;) {
      if (grid[r0 * NAV_COLS + c0]) return false;
      if (c0 === c1 && r0 === r1) break;
      const e2 = 2 * err;
      if (e2 > -dr) {
        err -= dr;
        c0 += sc;
      }
      if (e2 < dc) {
        err += dc;
        r0 += sr;
      }
    }
    return true;
  }

  /** Push enemy out of blocked nav cells (replaces per-segment AABB loop in combat arenas). */
  _resolveEnemyWallCollisionsGrid(x, z) {
    if (!this.navGrid) this.navGrid = this._buildNavGrid();
    const grid = this.navGrid;
    let { col, row } = this._worldToGrid(x, z);
    if (col >= 0 && col < NAV_COLS && row >= 0 && row < NAV_ROWS && !grid[row * NAV_COLS + col]) {
      return { x, z };
    }
    let best = null;
    let bestDist = Infinity;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dc === 0 && dr === 0) continue;
        const nc = col + dc;
        const nr = row + dr;
        if (nc < 0 || nc >= NAV_COLS || nr < 0 || nr >= NAV_ROWS) continue;
        if (grid[nr * NAV_COLS + nc]) continue;
        const w = this._gridToWorld(nc, nr);
        const d = (w.x - x) ** 2 + (w.z - z) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = w;
        }
      }
    }
    return best ? { x: best.x, z: best.z } : { x, z };
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
    const { gScore, cameFrom, inOpen, visitGen, searchGen } = this._resetAStarBuffers(cellCount);

    const heuristic = (c, r) => Math.sqrt((c - gc) ** 2 + (r - gr) ** 2);
    const isVisited = (i) => visitGen[i] === searchGen;
    const markVisited = (i) => { visitGen[i] = searchGen; };

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
    markVisited(startIdx);
    gScore[startIdx] = 0;
    cameFrom[startIdx] = -1;
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
        const niG = isVisited(ni) ? gScore[ni] : Infinity;
        if (tentG < niG) {
          if (!isVisited(ni)) {
            markVisited(ni);
            inOpen[ni] = 0;
          }
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
      const prev = isVisited(cur) ? cameFrom[cur] : -1;
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
    if (!this.navGrid) this.navGrid = this._buildNavGrid();
    return this._hasLineOfSightGrid(posA, posB);
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
      const gridResolved = this._resolveEnemyWallCollisionsGrid(rx, rz);
      rx = gridResolved.x;
      rz = gridResolved.z;
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
    return this.isEnemyFacingTarget(boss, player.position, Math.PI / 3);
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

  // ─── Sunken Temple enemies ─────────────────────────────────────────────────

  seedSunkenTempleDuelAggro(nemesisId, opponentIds) {
    const nemesis = this.room?.enemies?.get?.(nemesisId);
    if (!nemesis || nemesis.type !== 'nemesis' || !Array.isArray(opponentIds)) return;

    const duelOpts = { skipPlayerFallback: true, duelAggroLocked: true };
    for (const opponentId of opponentIds) {
      this.applyHostileEnemyThreat(opponentId, nemesisId, 100, duelOpts);
    }

    let closestOpponentId = opponentIds[0] ?? null;
    let closestDist = Infinity;
    for (const opponentId of opponentIds) {
      const opponent = this.room?.enemies?.get?.(opponentId);
      if (!opponent) continue;
      const dist = this.calculateDistance(nemesis.position, opponent.position);
      if (dist < closestDist) {
        closestDist = dist;
        closestOpponentId = opponentId;
      }
    }
    if (closestOpponentId) {
      this.applyNemesisRetaliationThreat(nemesisId, closestOpponentId, 100, duelOpts);
    }
  }

  findAlliesAndZombiesInRange(center, range) {
    const results = [];
    const enemies = this.room?.getEnemies?.() || [];
    for (const e of enemies) {
      if (!e || e.isDying || e.health <= 0) continue;
      if (!this.room?._isCoopPlayerAllyEnemy?.(e)) continue;
      const d = this.calculateDistance(center, e.position);
      if (d <= range) results.push(e);
    }
    return results;
  }

  findPlayersInRange(center, range) {
    const results = [];
    const players = this.room?.getPlayers?.() || [];
    for (const p of players) {
      if (!p || p.health <= 0) continue;
      const d = this.calculateDistance(center, p.position);
      if (d <= range) results.push(p);
    }
    return results;
  }

  sentinelCastEntangle(sentinel) {
    const now = Date.now();
    this.sentinelEntangleCooldown.set(sentinel.id, now);
    this.meleeLockUntil.set(sentinel.id, now + SENTINEL_ENTANGLE_CAST_MS);
    this.sentinelEntangleMoveLockUntil.set(sentinel.id, now + SENTINEL_ENTANGLE_MOVE_LOCK_MS);
    if (this.io) {
      this.io.to(this.roomId).emit('sentinel-entangle-cast', {
        sentinelId: sentinel.id,
        durationMs: SENTINEL_ENTANGLE_CAST_MS,
        timestamp: now,
      });
    }
    const sid = sentinel.id;
    this._scheduleEnemyTimeout(sid, () => {
      const live = this.room?.getEnemy?.(sid);
      if (!live || live.isDying) return;
      const allies = this.findAlliesAndZombiesInRange(live.position, SENTINEL_ENTANGLE_RANGE);
      for (const t of allies) {
        this.room?.applyHostileRootOnAlly?.(t.id, SENTINEL_ENTANGLE_DURATION_MS);
      }
      const players = this.findPlayersInRange(live.position, SENTINEL_ENTANGLE_RANGE);
      for (const p of players) {
        this.room?.applyHostileRootOnPlayer?.(p.id, SENTINEL_ENTANGLE_DURATION_MS);
      }
    }, SENTINEL_ENTANGLE_DELAY_MS);
  }

  sentinelCastVoidOrb(sentinel, targetPlayer) {
    const now = Date.now();
    this.sentinelOrbCooldown.set(sentinel.id, now);
    this.meleeLockUntil.set(sentinel.id, now + SENTINEL_ORB_CAST_MS);
    const dx = targetPlayer.position.x - sentinel.position.x;
    const dz = targetPlayer.position.z - sentinel.position.z;
    if (dx || dz) sentinel.rotation = Math.atan2(dx, dz);
    this._queueMove(sentinel.id, sentinel.position, sentinel.rotation);

    if (this.io) {
      this.io.to(this.roomId).emit('sentinel-orb-cast', {
        sentinelId: sentinel.id,
        durationMs: SENTINEL_ORB_CAST_MS,
        timestamp: now,
      });
    }

    const sid = sentinel.id;
    const pid = targetPlayer.id;
    this._scheduleEnemyTimeout(sid, () => {
      const live = this.room?.getEnemy?.(sid);
      if (!live || live.isDying) return;
      const players = this.room?.getPlayers?.() || [];
      const target = players.find((p) => p.id === pid && p.health > 0) || targetPlayer;
      this.sentinelLaunchVoidOrb(live, target);
    }, SENTINEL_ORB_CAST_MS);
  }

  sentinelLaunchVoidOrb(sentinel, targetPlayer) {
    const start = { x: sentinel.position.x, y: (sentinel.position.y ?? 0) + 1.4, z: sentinel.position.z };
    const target = { x: targetPlayer.position.x, y: (targetPlayer.position.y ?? 0) + 1.0, z: targetPlayer.position.z };
    if (this.io) {
      this.io.to(this.roomId).emit('sentinel-orb-telegraph', {
        sentinelId: sentinel.id,
        startPosition: start,
        targetPosition: target,
        damage: SENTINEL_ORB_DAMAGE,
        timestamp: Date.now(),
      });
    }

    const dirLen = Math.hypot(target.x - start.x, target.z - start.z) || 1;
    const dir = { x: (target.x - start.x) / dirLen, z: (target.z - start.z) / dirLen };
    const pos = { x: start.x, z: start.z };
    const STEP_MS = 50;
    const maxSteps = Math.ceil((dirLen / SENTINEL_ORB_SPEED) * (1000 / STEP_MS)) + 4;
    let steps = 0;
    const sid = sentinel.id;
    const intervalId = setInterval(() => {
      if (!this.room?.getGameStarted()) {
        clearInterval(intervalId);
        this._removeEnemyHazardInterval(sid, intervalId);
        return;
      }
      steps++;
      pos.x += dir.x * SENTINEL_ORB_SPEED * (STEP_MS / 1000);
      pos.z += dir.z * SENTINEL_ORB_SPEED * (STEP_MS / 1000);
      const playerMap = this.room?.players;
      if (playerMap) {
        for (const p of playerMap.values()) {
          if (!p || p.health <= 0) continue;
          const hdx = p.position.x - pos.x;
          const hdz = p.position.z - pos.z;
          if (hdx * hdx + hdz * hdz <= SENTINEL_ORB_HIT_RADIUS * SENTINEL_ORB_HIT_RADIUS) {
            clearInterval(intervalId);
            this._removeEnemyHazardInterval(sid, intervalId);
            this.room.damagePlayersInHorizontalRing(
              { x: pos.x, z: pos.z }, SENTINEL_ORB_HIT_RADIUS, SENTINEL_ORB_DAMAGE, 'sentinel_void_orb', { sourceEnemyId: sid },
            );
            this.io?.to(this.roomId).emit('sentinel-orb-impact', {
              sentinelId: sid, position: pos, hit: true, timestamp: Date.now(),
            });
            return;
          }
        }
      }
      if (steps >= maxSteps) {
        clearInterval(intervalId);
        this._removeEnemyHazardInterval(sid, intervalId);
        this.io?.to(this.roomId).emit('sentinel-orb-impact', {
          sentinelId: sid, position: pos, hit: false, timestamp: Date.now(),
        });
      }
    }, STEP_MS);
    this._addEnemyHazardInterval(sid, intervalId);
  }

  updateSentinelAI(sentinel, players) {
    let aggroData = this.enemyAggro.get(sentinel.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(sentinel, players);
      if (!closestPlayer) return;
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
        isAggroed: false,
      };
      this.enemyAggro.set(sentinel.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, sentinel, players);
    if (!resolved) return;

    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(sentinel.position, tpos);
    const aggroRadius = SENTINEL_AGGRO_RADIUS;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);
    const losOk = this.hasLineOfSight(sentinel.position, tpos);

    if (!aggroData.isAggroed && distance <= aggroRadius && losOk) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }

    if (!aggroData.isAggroed) return;

    const now = Date.now();
    const lockUntil = this.meleeLockUntil.get(sentinel.id) || 0;
    if (now < lockUntil) return;

    const dx = tpos.x - sentinel.position.x;
    const dz = tpos.z - sentinel.position.z;
    sentinel.rotation = Math.atan2(dx, dz);
    this._queueMoveIfChanged(sentinel.id, sentinel.position, sentinel.rotation);

    const lastEntangle = this.sentinelEntangleCooldown.get(sentinel.id) || 0;
    const alliesInRange = this.findAlliesAndZombiesInRange(sentinel.position, SENTINEL_ENTANGLE_RANGE);
    const playersInRange = this.findPlayersInRange(sentinel.position, SENTINEL_ENTANGLE_RANGE);
    if (
      now - lastEntangle >= SENTINEL_ENTANGLE_COOLDOWN_MS
      && (alliesInRange.length > 0 || playersInRange.length > 0)
    ) {
      this.sentinelCastEntangle(sentinel);
      return;
    }

    if (resolved.kind === 'player') {
      const lastOrb = this.sentinelOrbCooldown.get(sentinel.id) || 0;
      if (
        now - lastOrb >= SENTINEL_ORB_COOLDOWN_MS
        && distance <= SENTINEL_PREFERRED_STAND_RANGE
      ) {
        this.sentinelCastVoidOrb(sentinel, resolved.player);
        return;
      }
    }

    const moveLockUntil = this.sentinelEntangleMoveLockUntil.get(sentinel.id) || 0;
    if (distance > SENTINEL_PREFERRED_STAND_RANGE && now >= moveLockUntil) {
      const moveTarget = this.aggroTargetToMoveTarget(resolved);
      sentinel.moveSpeed = SENTINEL_WALK_SPEED;
      this.moveEnemyTowardsTarget(sentinel, moveTarget);
    }
  }

  _isCombatTargetEntangled(resolved) {
    if (!resolved || !this.room) return false;
    if (resolved.kind === 'player') {
      return !!this.room.isPlayerAffectedBy?.(resolved.player.id, 'entangle');
    }
    if (resolved.kind === 'zombie' || resolved.kind === 'hostile') {
      const id = resolved.zombie?.id || resolved.enemy?.id;
      if (!id) return false;
      return !!this.room.isEnemyAffectedBy?.(id, 'hostileRoot');
    }
    return false;
  }

  updateBoneSpiderAI(spider, players) {
    let aggroData = this.enemyAggro.get(spider.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(spider, players);
      if (!closestPlayer) return;
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
        isAggroed: false,
      };
      this.enemyAggro.set(spider.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, spider, players);
    if (!resolved) return;

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(spider.position, tpos);
    const aggroRadius = BONE_SPIDER_AGGRO_RADIUS;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);
    const losOk = this.hasLineOfSight(spider.position, tpos);

    if (!aggroData.isAggroed && distance <= aggroRadius && losOk) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }
    this._maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius);

    if (!aggroData.isAggroed) return;

    const now = Date.now();
    const lockUntil = this.meleeLockUntil.get(spider.id) || 0;
    if (now < lockUntil) {
      this.tickMeleeSwingWindup(spider, resolved);
      return;
    }

    spider.moveSpeed = BONE_SPIDER_MOVE_SPEED;
    const entangled = this._isCombatTargetEntangled(resolved);

    if (entangled) {
      const profile = getMeleeProfile('bone-spider');
      this.tryMeleeEngage(spider, resolved, moveTarget, profile, { now, distance });
      return;
    }

    // Not entangled — stand and cast Ensnaring Shot when in range; otherwise chase
    if (distance <= BONE_SPIDER_SHOT_RANGE && losOk) {
      const lastShot = this.boneSpiderShotCooldown.get(spider.id) || 0;
      if (now - lastShot >= BONE_SPIDER_SHOT_COOLDOWN_MS) {
        this.boneSpiderCastEnsnaringShot(spider, resolved);
      }
      return;
    }

    this.moveEnemyTowardsTarget(spider, moveTarget);
  }

  boneSpiderCastEnsnaringShot(spider, resolved) {
    const now = Date.now();
    this.boneSpiderShotCooldown.set(spider.id, now);
    this.meleeLockUntil.set(spider.id, now + BONE_SPIDER_CAST_MS);

    const tpos = this.combatTargetPosition(resolved);
    const dx = tpos.x - spider.position.x;
    const dz = tpos.z - spider.position.z;
    if (dx || dz) spider.rotation = Math.atan2(dx, dz);
    this._queueMove(spider.id, spider.position, spider.rotation);

    const shotId = `ensnare-${spider.id}-${now}`;
    if (this.io) {
      this.io.to(this.roomId).emit('bone-spider-ensnaring-shot-cast', {
        spiderId: spider.id,
        shotId,
        durationMs: BONE_SPIDER_CAST_MS,
        timestamp: now,
      });
    }

    const sid = spider.id;
    const targetKind = resolved.kind;
    const targetId = resolved.kind === 'player'
      ? resolved.player.id
      : (resolved.zombie?.id || resolved.enemy?.id);

    this._scheduleEnemyTimeout(sid, () => {
      const live = this.room?.getEnemy?.(sid);
      if (!live || live.isDying) return;

      let aim = tpos;
      if (targetKind === 'player') {
        const players = this.room?.getPlayers?.() || [];
        const tp = players.find((p) => p.id === targetId && p.health > 0);
        if (tp) aim = tp.position;
      } else if (targetId) {
        const te = this.room?.getEnemy?.(targetId);
        if (te && !te.isDying && te.health > 0) aim = te.position;
      }

      const start = {
        x: live.position.x,
        y: (live.position.y ?? 0) + 1.2,
        z: live.position.z,
      };
      const aimDx = aim.x - start.x;
      const aimDz = aim.z - start.z;
      const aimLen = Math.hypot(aimDx, aimDz) || 1e-6;
      // Fly full post-cast aim distance (range is cast gate only; match Sentinel orbs)
      const travel = aimLen;
      const dir = { x: aimDx / aimLen, z: aimDz / aimLen };
      const target = {
        x: start.x + dir.x * travel,
        y: (aim.y ?? 0) + 1.0,
        z: start.z + dir.z * travel,
      };

      if (this.io) {
        this.io.to(this.roomId).emit('bone-spider-ensnaring-shot-telegraph', {
          spiderId: sid,
          shotId,
          startPosition: start,
          targetPosition: target,
          maxRange: BONE_SPIDER_SHOT_RANGE,
          timestamp: Date.now(),
        });
      }

      const pos = { x: start.x, z: start.z };
      const STEP_MS = 50;
      const maxSteps = Math.ceil((travel / BONE_SPIDER_SHOT_SPEED) * (1000 / STEP_MS)) + 4;
      let steps = 0;
      const intervalId = setInterval(() => {
        if (!this.room?.getGameStarted()) {
          clearInterval(intervalId);
          this._removeEnemyHazardInterval(sid, intervalId);
          return;
        }
        steps++;
        pos.x += dir.x * BONE_SPIDER_SHOT_SPEED * (STEP_MS / 1000);
        pos.z += dir.z * BONE_SPIDER_SHOT_SPEED * (STEP_MS / 1000);
        const hitR2 = BONE_SPIDER_SHOT_HIT_RADIUS * BONE_SPIDER_SHOT_HIT_RADIUS;

        const playerMap = this.room?.players;
        if (playerMap) {
          for (const p of playerMap.values()) {
            if (!p || p.health <= 0) continue;
            const hdx = p.position.x - pos.x;
            const hdz = p.position.z - pos.z;
            if (hdx * hdx + hdz * hdz <= hitR2) {
              clearInterval(intervalId);
              this._removeEnemyHazardInterval(sid, intervalId);
              this.room?.applyHostileRootOnPlayer?.(p.id, BONE_SPIDER_ENTANGLE_DURATION_MS);
              this.io?.to(this.roomId).emit('bone-spider-ensnaring-shot-outcome', {
                spiderId: sid,
                shotId,
                hit: true,
                position: { x: pos.x, y: 0, z: pos.z },
                timestamp: Date.now(),
              });
              return;
            }
          }
        }

        const allies = this.findAlliesAndZombiesInRange({ x: pos.x, y: 0, z: pos.z }, BONE_SPIDER_SHOT_HIT_RADIUS);
        if (allies.length > 0) {
          clearInterval(intervalId);
          this._removeEnemyHazardInterval(sid, intervalId);
          for (const ally of allies) {
            this.room?.applyHostileRootOnAlly?.(ally.id, BONE_SPIDER_ENTANGLE_DURATION_MS);
          }
          this.io?.to(this.roomId).emit('bone-spider-ensnaring-shot-outcome', {
            spiderId: sid,
            shotId,
            hit: true,
            position: { x: pos.x, y: 0, z: pos.z },
            timestamp: Date.now(),
          });
          return;
        }

        if (steps >= maxSteps) {
          clearInterval(intervalId);
          this._removeEnemyHazardInterval(sid, intervalId);
          this.io?.to(this.roomId).emit('bone-spider-ensnaring-shot-outcome', {
            spiderId: sid,
            shotId,
            hit: false,
            position: { x: pos.x, y: 0, z: pos.z },
            timestamp: Date.now(),
          });
        }
      }, STEP_MS);
      this._addEnemyHazardInterval(sid, intervalId);
    }, BONE_SPIDER_CAST_MS);
  }

  telegraphBoneSpiderAttack(spider, player, attackVariant = 1) {
    if (this.io) {
      this.io.to(this.roomId).emit('bone-spider-attack-telegraph', {
        spiderId: spider.id,
        ...this._meleeTelegraphTargetFields(player),
        attackVariant: attackVariant === 2 ? 2 : 1,
        position: spider.position,
        timestamp: Date.now(),
      });
    }
  }

  boneSpiderAttackPlayer(spider, player) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    const damage = spider.damage || BONE_SPIDER_MELEE_DAMAGE;
    this.recordAlliedProtectionThreat(spider.id, player.id, damage);

    if (this.io) {
      this.io.to(this.roomId).emit('bone-spider-attack', {
        spiderId: spider.id,
        targetPlayerId: player.id,
        damage,
        position: spider.position,
        timestamp: Date.now(),
      });
    }

    this.room?.tryDamageAlliedKnightInXZDisk(
      { x: spider.position.x, z: spider.position.z },
      2.8,
      damage,
      { sourceEnemyId: spider.id, damageType: 'bone_spider_melee' },
    );
  }

  // ─── Frost Queen AI ──────────────────────────────────────────────────────────

  isFrostQueenChannelingIceStorm(enemyId) {
    const until = this.frostQueenIceStormActiveUntil.get(enemyId) || 0;
    return Date.now() < until;
  }

  frostQueenInterruptIceStorm(frostQueenId) {
    const handles = this.frostQueenIceStormTimeouts.get(frostQueenId);
    if (handles) {
      for (const h of handles) clearTimeout(h);
    }
    this.frostQueenIceStormTimeouts.delete(frostQueenId);
    this.frostQueenIceStormActiveUntil.delete(frostQueenId);
    this.meleeLockUntil.set(frostQueenId, 0);
    if (this.io) {
      this.io.to(this.roomId).emit('frost-queen-ice-storm-end', {
        frostQueenId,
        interrupted: true,
        timestamp: Date.now(),
      });
    }
  }

  updateFrostQueenAI(frostQueen, players) {
    let aggroData = this.enemyAggro.get(frostQueen.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(frostQueen, players);
      if (!closestPlayer) return;
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
        isAggroed: false,
      };
      this.enemyAggro.set(frostQueen.id, aggroData);
    }

    // Stun interrupts ice storm channel only
    if (this.isFrostQueenChannelingIceStorm(frostQueen.id)) {
      if (this.room?.isEnemyAffectedBy(frostQueen.id, 'stun')) {
        this.frostQueenInterruptIceStorm(frostQueen.id);
        return;
      }
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, frostQueen, players);
    if (!resolved) return;

    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(frostQueen.position, tpos);
    const aggroRadius = FROST_QUEEN_AGGRO_RADIUS;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);
    const losOk = this.hasLineOfSight(frostQueen.position, tpos);

    if (!aggroData.isAggroed && distance <= aggroRadius && losOk) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }
    this._maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius);

    if (!aggroData.isAggroed) return;

    const now = Date.now();
    const lockUntil = this.meleeLockUntil.get(frostQueen.id) || 0;
    if (now < lockUntil) {
      // Keep facing target while locked in cast/channel
      const dx = tpos.x - frostQueen.position.x;
      const dz = tpos.z - frostQueen.position.z;
      if (dx !== 0 || dz !== 0) {
        frostQueen.rotation = Math.atan2(dx, dz);
        this._queueMoveIfChanged(frostQueen.id, frostQueen.position, frostQueen.rotation);
      }
      return;
    }

    const dx = tpos.x - frostQueen.position.x;
    const dz = tpos.z - frostQueen.position.z;
    if (dx !== 0 || dz !== 0) {
      frostQueen.rotation = Math.atan2(dx, dz);
    }
    this._queueMoveIfChanged(frostQueen.id, frostQueen.position, frostQueen.rotation);

    // Trap / hostile (non-ally) — keep lightweight chip; allies use full Ice Shards + Teleport.
    if (resolved.kind === 'trap' || resolved.kind === 'hostile') {
      if (distance <= FROST_QUEEN_ICE_SHARDS_CAST_RANGE) {
        const lastShards = this.frostQueenIceShardsCooldown.get(frostQueen.id) || 0;
        if (now - lastShards >= FROST_QUEEN_ICE_SHARDS_COOLDOWN_MS) {
          this.frostQueenIceShardsCooldown.set(frostQueen.id, now);
          if (resolved.kind === 'hostile') {
            this.damageHostileMobFromMob(frostQueen, resolved.enemy, FROST_QUEEN_ICE_SHARDS_DAMAGE, 'frost_queen_ice_shards');
          } else {
            this.room?.damageEnemy?.(resolved.trap.id, FROST_QUEEN_ICE_SHARDS_DAMAGE, null, null, {
              sourceEnemyId: frostQueen.id,
              damageType: 'frost_queen_ice_shards',
            });
          }
        }
      }
      return;
    }

    const castTarget = this._frostQueenCastTargetFromResolved(resolved);
    if (!castTarget) return;

    // Priority 1: Ice Storm (players only)
    if (!castTarget.isAlly) {
      const lastStorm = this.frostQueenIceStormCooldown.get(frostQueen.id) || 0;
      if (
        now - lastStorm >= FROST_QUEEN_ICE_STORM_COOLDOWN_MS
        && distance <= FROST_QUEEN_ICE_STORM_CAST_RANGE
        && !this.room?.isEnemyAffectedBy(frostQueen.id, 'stun')
      ) {
        this.frostQueenCastIceStorm(frostQueen, resolved.player);
        return;
      }
    }

    // Priority 2: Ice Shards (players + allies)
    const lastShards = this.frostQueenIceShardsCooldown.get(frostQueen.id) || 0;
    if (
      now - lastShards >= FROST_QUEEN_ICE_SHARDS_COOLDOWN_MS
      && distance <= FROST_QUEEN_ICE_SHARDS_CAST_RANGE
      && distance <= FROST_QUEEN_PREFERRED_RANGE + FROST_QUEEN_PREFERRED_BAND
      && !this.room?.isEnemyAffectedBy(frostQueen.id, 'stun')
    ) {
      this.frostQueenCastIceShards(frostQueen, castTarget);
      return;
    }

    // Priority 3: Teleport to maintain ideal range
    const lastTeleport = this.frostQueenTeleportCooldown.get(frostQueen.id) || 0;
    const tooClose = distance < FROST_QUEEN_PREFERRED_RANGE - FROST_QUEEN_PREFERRED_BAND;
    const tooFar = distance > FROST_QUEEN_PREFERRED_RANGE + FROST_QUEEN_PREFERRED_BAND;
    if (
      now - lastTeleport >= FROST_QUEEN_TELEPORT_COOLDOWN_MS
      && (tooClose || tooFar)
      && !this.room?.isEnemyAffectedBy(frostQueen.id, 'stun')
      && !this.room?.isEnemyAffectedBy(frostQueen.id, 'freeze')
    ) {
      this.frostQueenCastTeleport(frostQueen, castTarget.position);
    }
  }

  /** Build Ice Shards / Teleport cast target from resolveAggroCombatTarget result. */
  _frostQueenCastTargetFromResolved(resolved) {
    if (!resolved) return null;
    if (resolved.kind === 'player' && resolved.player) {
      return {
        id: resolved.player.id,
        position: resolved.player.position,
        isAlly: false,
      };
    }
    if (resolved.kind === 'zombie' && resolved.zombie) {
      return {
        id: resolved.zombie.id,
        position: resolved.zombie.position,
        isAlly: true,
      };
    }
    return null;
  }

  frostQueenCastTeleport(frostQueen, targetPos) {
    const now = Date.now();
    this.frostQueenTeleportCooldown.set(frostQueen.id, now);
    this.meleeLockUntil.set(frostQueen.id, now + FROST_QUEEN_TELEPORT_LOCK_MS);

    const startPosition = { ...frostQueen.position };
    const dx = targetPos.x - frostQueen.position.x;
    const dz = targetPos.z - frostQueen.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1e-4) return;

    const ux = dx / dist;
    const uz = dz / dist;
    // Positive stepToward = move closer to target; negative = move away
    const stepToward = Math.max(
      -FROST_QUEEN_TELEPORT_RANGE,
      Math.min(FROST_QUEEN_TELEPORT_RANGE, dist - FROST_QUEEN_PREFERRED_RANGE),
    );
    const endPosition = {
      x: frostQueen.position.x + ux * stepToward,
      y: frostQueen.position.y,
      z: frostQueen.position.z + uz * stepToward,
    };

    frostQueen.position.x = endPosition.x;
    frostQueen.position.y = endPosition.y;
    frostQueen.position.z = endPosition.z;

    const rotDx = targetPos.x - endPosition.x;
    const rotDz = targetPos.z - endPosition.z;
    frostQueen.rotation = Math.atan2(rotDx, rotDz);

    if (this.io) {
      this._queueMove(frostQueen.id, frostQueen.position, frostQueen.rotation);
      this.io.to(this.roomId).emit('frost-queen-teleport', {
        frostQueenId: frostQueen.id,
        startPosition,
        endPosition,
        rotation: frostQueen.rotation,
        timestamp: now,
      });
    }
    _enemyAiLog(`❄️ FrostQueen ${frostQueen.id} teleported toward ideal range`);
  }

  /**
   * Ice Shards / Frost Ray — players take 17 + freeze; aimed allies take 100 + hostileFreeze.
   * @param {{ id: string, position: {x:number,y:number,z:number}, isAlly: boolean }} castTarget
   */
  frostQueenCastIceShards(frostQueen, castTarget) {
    const now = Date.now();
    this.frostQueenIceShardsCooldown.set(frostQueen.id, now);
    this.meleeLockUntil.set(frostQueen.id, now + FROST_QUEEN_ICE_SHARDS_CAST_LOCK_MS);

    const fdx = castTarget.position.x - frostQueen.position.x;
    const fdz = castTarget.position.z - frostQueen.position.z;
    if (fdx !== 0 || fdz !== 0) {
      frostQueen.rotation = Math.atan2(fdx, fdz);
    }

    if (this.io) {
      this._queueMove(frostQueen.id, frostQueen.position, frostQueen.rotation);
      this.io.to(this.roomId).emit('frost-queen-ice-shards-telegraph', {
        frostQueenId: frostQueen.id,
        ...(castTarget.isAlly
          ? { targetCombatAllyId: castTarget.id }
          : { targetPlayerId: castTarget.id }),
        timestamp: now,
      });
    }
    _enemyAiLog(`❄️ FrostQueen ${frostQueen.id} casting Ice Shards at ${castTarget.id}`);

    const targetId = castTarget.id;
    const targetingAlly = !!castTarget.isAlly;
    const frostQueenId = frostQueen.id;
    const fallbackAim = { ...castTarget.position };

    this._scheduleTimeout(() => {
      if (!this.room?.getGameStarted()) return;
      const liveQueen = this.room?.getEnemy(frostQueenId);
      if (!liveQueen || liveQueen.isDying) return;
      if (this.room?.isEnemyAffectedBy(frostQueenId, 'stun')) return;

      let aimPos = fallbackAim;
      if (targetingAlly) {
        const liveAlly = this.room?.getEnemy?.(targetId);
        if (liveAlly && !liveAlly.isDying && liveAlly.health > 0) {
          aimPos = liveAlly.position;
        }
      } else {
        const currentPlayers = this.room?.getPlayers();
        const launchTarget = currentPlayers?.find((p) => p.id === targetId);
        if (launchTarget && launchTarget.health > 0) {
          aimPos = launchTarget.position;
        }
      }

      // Keep facing target at launch
      const ldx = aimPos.x - liveQueen.position.x;
      const ldz = aimPos.z - liveQueen.position.z;
      if (ldx !== 0 || ldz !== 0) {
        liveQueen.rotation = Math.atan2(ldx, ldz);
        this._queueMove(liveQueen.id, liveQueen.position, liveQueen.rotation);
      }

      const startPosition = {
        x: liveQueen.position.x,
        y: liveQueen.position.y + 1.0,
        z: liveQueen.position.z,
      };
      const centerEnd = {
        x: aimPos.x,
        y: (aimPos.y ?? 0) + 1.0,
        z: aimPos.z,
      };

      // Perpendicular lateral spread for dual shards
      const dirLen = Math.hypot(ldx, ldz) || 1;
      const px = -ldz / dirLen;
      const pz = ldx / dirLen;
      const laterals = [-FROST_QUEEN_ICE_SHARDS_LATERAL, FROST_QUEEN_ICE_SHARDS_LATERAL];

      for (let shardIndex = 0; shardIndex < laterals.length; shardIndex += 1) {
        const lateral = laterals[shardIndex];
        const endPosition = {
          x: centerEnd.x + px * lateral,
          y: centerEnd.y,
          z: centerEnd.z + pz * lateral,
        };
        const snapX = endPosition.x;
        const snapZ = endPosition.z;

        if (this.io) {
          this.io.to(this.roomId).emit('frost-queen-ice-shards-projectile', {
            frostQueenId,
            shardIndex,
            startPosition,
            endPosition,
            travelMs: FROST_QUEEN_ICE_SHARDS_TRAVEL_MS,
            timestamp: Date.now(),
          });
        }

        this._scheduleTimeout(() => {
          if (!this.room?.getGameStarted()) return;
          if (this.room?.isEnemyAffectedBy(frostQueenId, 'stun')) return;

          if (targetingAlly) {
            const liveAlly = this.room?.getEnemy?.(targetId);
            if (liveAlly && !liveAlly.isDying && liveAlly.health > 0) {
              const hdx = (liveAlly.position?.x ?? 0) - snapX;
              const hdz = (liveAlly.position?.z ?? 0) - snapZ;
              const distXZ = Math.sqrt(hdx * hdx + hdz * hdz);
              if (distXZ <= FROST_QUEEN_ICE_SHARDS_HIT_RADIUS) {
                this.damagePlayerZombieFromMob(
                  { id: frostQueenId },
                  liveAlly,
                  FROST_QUEEN_ICE_SHARDS_ALLY_DAMAGE,
                  'frost_queen_ice_shards',
                );
                this.room?.applyHostileFreezeOnAlly?.(liveAlly.id, FROST_QUEEN_ICE_SHARDS_FREEZE_MS);
                if (this.io) {
                  this.io.to(this.roomId).emit('frost-queen-ice-shards-hit', {
                    frostQueenId,
                    shardIndex,
                    targetCombatAllyId: liveAlly.id,
                    damage: FROST_QUEEN_ICE_SHARDS_ALLY_DAMAGE,
                    slowDuration: FROST_QUEEN_ICE_SHARDS_FREEZE_MS,
                    targetPosition: {
                      x: liveAlly.position.x,
                      y: (liveAlly.position.y ?? 0) + 1.0,
                      z: liveAlly.position.z,
                    },
                    timestamp: Date.now(),
                  });
                }
                _enemyAiLog(
                  `❄️ FrostQueen ${frostQueenId} Ice Shard ${shardIndex} hit ally ${liveAlly.id} for ${FROST_QUEEN_ICE_SHARDS_ALLY_DAMAGE}`,
                );
              }
            }
            // Collateral allies keep player-tier chip (17); primary ally already took 100 above.
            this.room?.tryDamageAlliedKnightInXZDisk?.(
              { x: snapX, z: snapZ },
              FROST_QUEEN_ICE_SHARDS_HIT_RADIUS,
              FROST_QUEEN_ICE_SHARDS_DAMAGE,
              {
                sourceEnemyId: frostQueenId,
                damageType: 'frost_queen_ice_shards',
                excludeEnemyId: targetId,
              },
            );
            return;
          }

          const players = this.room?.getPlayers();
          const currentTarget = players?.find((p) => p.id === targetId);

          if (currentTarget && currentTarget.health > 0) {
            const hdx = currentTarget.position.x - snapX;
            const hdz = currentTarget.position.z - snapZ;
            const distXZ = Math.sqrt(hdx * hdx + hdz * hdz);

            if (distXZ <= FROST_QUEEN_ICE_SHARDS_HIT_RADIUS) {
              this.room?.applyPlayerStatusEffect(currentTarget.id, 'freeze', FROST_QUEEN_ICE_SHARDS_FREEZE_MS);
              if (this.io) {
                this.io.to(this.roomId).emit('frost-queen-ice-shards-hit', {
                  frostQueenId,
                  shardIndex,
                  targetPlayerId: currentTarget.id,
                  damage: FROST_QUEEN_ICE_SHARDS_DAMAGE,
                  slowDuration: FROST_QUEEN_ICE_SHARDS_FREEZE_MS,
                  targetPosition: {
                    x: currentTarget.position.x,
                    y: currentTarget.position.y + 1.0,
                    z: currentTarget.position.z,
                  },
                  timestamp: Date.now(),
                });
              }
              _enemyAiLog(`❄️ FrostQueen ${frostQueenId} Ice Shard ${shardIndex} hit ${currentTarget.id}`);
            }
          }

          this.room?.tryDamageAlliedKnightInXZDisk(
            { x: snapX, z: snapZ },
            FROST_QUEEN_ICE_SHARDS_HIT_RADIUS,
            FROST_QUEEN_ICE_SHARDS_DAMAGE,
            { sourceEnemyId: frostQueenId, damageType: 'frost_queen_ice_shards' },
          );
        }, FROST_QUEEN_ICE_SHARDS_TRAVEL_MS);
      }
    }, FROST_QUEEN_ICE_SHARDS_LAUNCH_MS);
  }

  frostQueenCastIceStorm(frostQueen, targetPlayer) {
    const frostQueenId = frostQueen.id;
    const targetId = targetPlayer.id;
    const now = Date.now();

    this.frostQueenIceStormCooldown.set(frostQueenId, now);
    this.frostQueenIceStormActiveUntil.set(frostQueenId, now + FROST_QUEEN_ICE_STORM_CHANNEL_MS);
    this.meleeLockUntil.set(frostQueenId, now + FROST_QUEEN_ICE_STORM_CHANNEL_MS);

    const fdx = targetPlayer.position.x - frostQueen.position.x;
    const fdz = targetPlayer.position.z - frostQueen.position.z;
    if (fdx !== 0 || fdz !== 0) {
      frostQueen.rotation = Math.atan2(fdx, fdz);
    }

    if (this.io) {
      this._queueMove(frostQueen.id, frostQueen.position, frostQueen.rotation);
      this.io.to(this.roomId).emit('frost-queen-ice-storm-start', {
        frostQueenId,
        targetPlayerId: targetId,
        channelMs: FROST_QUEEN_ICE_STORM_CHANNEL_MS,
        tickMs: FROST_QUEEN_ICE_STORM_TICK_MS,
        damage: FROST_QUEEN_ICE_STORM_DAMAGE,
        timestamp: now,
      });
    }
    _enemyAiLog(`❄️ FrostQueen ${frostQueenId} channeling Ice Storm on ${targetId}`);

    const oldHandles = this.frostQueenIceStormTimeouts.get(frostQueenId);
    if (oldHandles) {
      for (const h of oldHandles) clearTimeout(h);
    }

    const handles = [];
    const tickCount = Math.floor(FROST_QUEEN_ICE_STORM_CHANNEL_MS / FROST_QUEEN_ICE_STORM_TICK_MS);

    for (let i = 1; i <= tickCount; i += 1) {
      const delayMs = i * FROST_QUEEN_ICE_STORM_TICK_MS;
      const handle = this._scheduleTimeout(() => {
        if (!this.room?.getGameStarted()) return;
        const liveQueen = this.room?.getEnemy(frostQueenId);
        if (!liveQueen || liveQueen.isDying) return;

        if (this.room?.isEnemyAffectedBy(frostQueenId, 'stun')) {
          this.frostQueenInterruptIceStorm(frostQueenId);
          return;
        }

        const players = this.room?.getPlayers();
        const liveTarget = players?.find((p) => p.id === targetId);
        if (!liveTarget || liveTarget.health <= 0) return;

        // Keep facing target during channel
        const rdx = liveTarget.position.x - liveQueen.position.x;
        const rdz = liveTarget.position.z - liveQueen.position.z;
        if (rdx !== 0 || rdz !== 0) {
          liveQueen.rotation = Math.atan2(rdx, rdz);
          this._queueMove(liveQueen.id, liveQueen.position, liveQueen.rotation);
        }

        const { newHealth, wasKilled, persephoneTriggered, dodged, negationType, appliedDamage } = this.room._applyCoopPlayerIncomingDamage(
          liveTarget,
          FROST_QUEEN_ICE_STORM_DAMAGE,
        );
        if (persephoneTriggered) {
          this.room._emitPersephoneTriggered(targetId, liveTarget);
        }
        if (dodged) {
          this.room._emitCoopIncomingDamageResult(targetId, liveTarget, {
            damage: 0,
            damageType: 'frost_queen_ice_storm',
            wasKilled: false,
            persephoneTriggered: false,
            dodged: true,
            negationType,
            meta: { sourceEnemyId: frostQueenId },
          });
          return;
        }
        this.recordAlliedProtectionThreat(frostQueenId, targetId, appliedDamage);
        this.room._emitPlayerDamagedWithHealth(targetId, liveTarget, {
          sourcePlayerId: null,
          targetPlayerId: targetId,
          damage: appliedDamage,
          damageType: 'frost_queen_ice_storm',
          isCritical: false,
          newHealth,
          maxHealth: liveTarget.maxHealth,
          wasKilled,
          persephoneTriggered,
          timestamp: Date.now(),
          sourceEnemyId: frostQueenId,
        });

        if (this.io) {
          this.io.to(this.roomId).emit('frost-queen-ice-storm-tick', {
            frostQueenId,
            targetPlayerId: targetId,
            damage: appliedDamage,
            targetPosition: {
              x: liveTarget.position.x,
              y: liveTarget.position.y,
              z: liveTarget.position.z,
            },
            timestamp: Date.now(),
          });
        }
      }, delayMs);
      handles.push(handle);
    }

    // Channel end
    const endHandle = this._scheduleTimeout(() => {
      this.frostQueenIceStormActiveUntil.delete(frostQueenId);
      this.frostQueenIceStormTimeouts.delete(frostQueenId);
      if (this.io) {
        this.io.to(this.roomId).emit('frost-queen-ice-storm-end', {
          frostQueenId,
          interrupted: false,
          timestamp: Date.now(),
        });
      }
    }, FROST_QUEEN_ICE_STORM_CHANNEL_MS);
    handles.push(endHandle);

    this.frostQueenIceStormTimeouts.set(frostQueenId, handles);
  }

  // ─── Medusa (Sunken Temple IV) ───────────────────────────────────────────

  isMedusaVoidWarping(enemyId) {
    const until = this.medusaVoidWarpActiveUntil.get(enemyId);
    return !!until && Date.now() < until;
  }

  clearMedusaProjectileIntervals(medusaId) {
    const set = this.medusaProjectileIntervals.get(medusaId);
    if (set) {
      set.forEach((iv) => clearInterval(iv));
    }
    this.medusaProjectileIntervals.delete(medusaId);
  }

  addMedusaProjectileInterval(medusaId, intervalId) {
    let set = this.medusaProjectileIntervals.get(medusaId);
    if (!set) {
      set = new Set();
      this.medusaProjectileIntervals.set(medusaId, set);
    }
    set.add(intervalId);
  }

  removeMedusaProjectileInterval(medusaId, intervalId) {
    const set = this.medusaProjectileIntervals.get(medusaId);
    if (set) {
      set.delete(intervalId);
      if (set.size === 0) this.medusaProjectileIntervals.delete(medusaId);
    }
  }

  updateMedusaAI(medusa, players) {
    let aggroData = this.enemyAggro.get(medusa.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(medusa, players);
      if (!closestPlayer) return;
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
        isAggroed: false,
      };
      this.enemyAggro.set(medusa.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, medusa, players);
    if (!resolved) return;

    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(medusa.position, tpos);
    const aggroRadius = MEDUSA_AGGRO_RADIUS;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);
    const losOk = this.hasLineOfSight(medusa.position, tpos);

    if (!aggroData.isAggroed && distance <= aggroRadius && losOk) {
      aggroData.isAggroed = true;
      // Start VOIDWARP CD on first aggro so opening invuln does not fire immediately
      if (!this.medusaVoidWarpCooldown.has(medusa.id)) {
        this.medusaVoidWarpCooldown.set(medusa.id, Date.now());
      }
      // Same for meteor — wait a full CD before first cast
      if (!this.medusaMeteorCooldown.has(medusa.id)) {
        this.medusaMeteorCooldown.set(medusa.id, Date.now());
      }
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }
    this._maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius);

    if (!aggroData.isAggroed) return;

    const now = Date.now();
    const lockUntil = this.meleeLockUntil.get(medusa.id) || 0;
    if (now < lockUntil) {
      const dx = tpos.x - medusa.position.x;
      const dz = tpos.z - medusa.position.z;
      if (dx !== 0 || dz !== 0) {
        medusa.rotation = Math.atan2(dx, dz);
        this._queueMoveIfChanged(medusa.id, medusa.position, medusa.rotation);
      }
      return;
    }

    const dx = tpos.x - medusa.position.x;
    const dz = tpos.z - medusa.position.z;
    if (dx !== 0 || dz !== 0) {
      medusa.rotation = Math.atan2(dx, dz);
    }
    this._queueMoveIfChanged(medusa.id, medusa.position, medusa.rotation);

    if (resolved.kind !== 'player') {
      if (distance <= MEDUSA_CAST_RANGE) {
        const lastCast = this.medusaRapidfireCooldown.get(medusa.id) || 0;
        if (now - lastCast >= MEDUSA_RAPIDFIRE_COOLDOWN_MS) {
          this.medusaRapidfireCooldown.set(medusa.id, now);
          if (resolved.kind === 'zombie') {
            this.damagePlayerZombieFromMob(medusa, resolved.zombie, MEDUSA_PROJECTILE_DAMAGE, 'medusa_projectile');
          } else if (resolved.kind === 'hostile') {
            this.damageHostileMobFromMob(medusa, resolved.enemy, MEDUSA_PROJECTILE_DAMAGE, 'medusa_projectile');
          } else if (resolved.kind === 'trap') {
            this.room?.damageEnemy?.(resolved.trap.id, MEDUSA_PROJECTILE_DAMAGE, null, null, {
              sourceEnemyId: medusa.id,
              damageType: 'medusa_projectile',
            });
          }
        }
      }
      return;
    }

    const targetPlayer = resolved.player;
    if (this.room?.isEnemyAffectedBy(medusa.id, 'stun')) return;

    // Priority 1: VOIDWARP
    const lastVoidwarp = this.medusaVoidWarpCooldown.get(medusa.id) || 0;
    if (now - lastVoidwarp >= MEDUSA_VOIDWARP_COOLDOWN_MS) {
      this.medusaCastVoidWarp(medusa);
      return;
    }

    // Priority 2: purple-warlock meteor swarm (5s CD; does not block rapidfire)
    const lastMeteor = this.medusaMeteorCooldown.get(medusa.id) || 0;
    if (now - lastMeteor >= MEDUSA_METEOR_COOLDOWN_MS) {
      this.medusaMeteorCooldown.set(medusa.id, now);
      this.warlockCastMeteor(medusa, targetPlayer);
    }

    // Priority 3: Rapidfire bolts
    const lastCast = this.medusaRapidfireCooldown.get(medusa.id) || 0;
    if (
      now - lastCast >= MEDUSA_RAPIDFIRE_COOLDOWN_MS
      && distance <= MEDUSA_CAST_RANGE
    ) {
      this.medusaCastRapidfire(medusa, targetPlayer);
    }
  }

  medusaCastVoidWarp(medusa) {
    const now = Date.now();
    const medusaId = medusa.id;
    this.medusaVoidWarpCooldown.set(medusaId, now);
    this.meleeLockUntil.set(medusaId, now + MEDUSA_VOIDWARP_CAST_LOCK_MS);
    this.medusaVoidWarpActiveUntil.set(medusaId, now + MEDUSA_VOIDWARP_DURATION_MS);

    const aggroData = this.enemyAggro.get(medusaId);
    if (aggroData) {
      const players = this.room?.getPlayers() || [];
      const resolved = this.resolveAggroCombatTarget(aggroData, medusa, players);
      if (resolved) {
        const tpos = this.combatTargetPosition(resolved);
        this._smoothRotateEnemyTowardPoint(medusa, tpos, { instant: true });
      }
    }

    this._queueMove(medusaId, medusa.position, medusa.rotation);
    if (this.io) {
      this.io.to(this.roomId).emit('medusa-voidwarp-telegraph', {
        medusaId,
        durationMs: MEDUSA_VOIDWARP_DURATION_MS,
        timestamp: now,
      });
    }

    // Homing barrage throughout VOIDWARP (AI is melee-locked so volley must be scheduled here).
    const barrageEnd = MEDUSA_VOIDWARP_DURATION_MS - 200;
    for (
      let delay = MEDUSA_VOIDWARP_BARRAGE_START_MS;
      delay <= barrageEnd;
      delay += MEDUSA_VOIDWARP_BARRAGE_INTERVAL_MS
    ) {
      this._scheduleEnemyTimeout(medusaId, () => {
        if (!this.room?.getGameStarted()) return;
        if (!this.isMedusaVoidWarping(medusaId)) return;
        const live = this.room?.getEnemy(medusaId);
        if (!live || live.isDying) return;

        const aggro = this.enemyAggro.get(medusaId);
        if (!aggro) return;
        const players = this.room?.getPlayers() || [];
        const resolved = this.resolveAggroCombatTarget(aggro, live, players);
        if (!resolved || resolved.kind !== 'player') return;
        const targetPlayer = resolved.player;
        if (!targetPlayer || targetPlayer.health <= 0) return;

        const startPosition = {
          x: live.position.x,
          y: (live.position.y || 0) + MEDUSA_PROJECTILE_LAUNCH_Y,
          z: live.position.z,
        };
        this.startMedusaProjectileFlight(medusaId, startPosition, targetPlayer.id);
      }, delay);
    }
  }

  medusaCastRapidfire(medusa, targetPlayer) {
    const now = Date.now();
    const medusaId = medusa.id;
    const castVariant = medusa.attackVariant === 2 ? 2 : 1;
    medusa.attackVariant = castVariant === 1 ? 2 : 1;

    this.medusaRapidfireCooldown.set(medusaId, now);
    this.meleeLockUntil.set(medusaId, now + MEDUSA_RAPIDFIRE_CAST_LOCK_MS);

    const startPosition = {
      x: medusa.position.x,
      y: (medusa.position.y || 0) + MEDUSA_PROJECTILE_LAUNCH_Y,
      z: medusa.position.z,
    };
    const targetPosition = {
      x: targetPlayer.position.x,
      y: (targetPlayer.position.y || 0) + 1.0,
      z: targetPlayer.position.z,
    };

    if (this.io) {
      this.io.to(this.roomId).emit('medusa-cast-telegraph', {
        medusaId,
        castVariant,
        targetPlayerId: targetPlayer.id,
        startPosition,
        targetPosition,
        timestamp: now,
      });
    }

    const targetId = targetPlayer.id;
    this._scheduleEnemyTimeout(medusaId, () => {
      if (!this.room?.getGameStarted()) return;
      const live = this.room?.getEnemy(medusaId);
      if (!live || live.isDying) return;
      this.startMedusaProjectileFlight(medusaId, startPosition, targetId);
    }, Math.min(MEDUSA_RAPIDFIRE_CAST_LOCK_MS, 350));
  }

  medusaOrbGetTargetPos(targetId) {
    const players = this.room?.getPlayers();
    const target = players?.find((p) => p.id === targetId);
    if (!target || target.health <= 0) return null;
    return {
      x: target.position.x,
      y: target.position.y + 1.0,
      z: target.position.z,
    };
  }

  createMedusaProjectileState(start, targetId) {
    const targetPos = this.medusaOrbGetTargetPos(targetId);
    if (!targetPos) return null;

    let dx = targetPos.x - start.x;
    let dy = targetPos.y - start.y;
    let dz = targetPos.z - start.z;
    const dLen = Math.hypot(dx, dy, dz) || 1e-6;
    dx /= dLen;
    dy /= dLen;
    dz /= dLen;

    const avgSpeed = (MEDUSA_START_SPEED + MEDUSA_MAX_SPEED) * 0.5;
    return {
      px: start.x,
      py: start.y,
      pz: start.z,
      spawnX: start.x,
      spawnZ: start.z,
      dx,
      dy,
      dz,
      speed: MEDUSA_START_SPEED,
      elapsed: 0,
      homingElapsed: 0,
      phase: 'coast',
      maxFlightSec: Math.max(4, (MEDUSA_CAST_RANGE / avgSpeed) * 2.5),
      targetId,
    };
  }

  stepMedusaProjectile(state, dt) {
    const HIT_RADIUS_SQ = MEDUSA_HIT_RADIUS * MEDUSA_HIT_RADIUS;
    const liveTarget = this.medusaOrbGetTargetPos(state.targetId);
    if (!liveTarget) {
      return {
        hit: false,
        impact: { x: state.px, y: state.py, z: state.pz },
        done: true,
      };
    }

    if (state.phase === 'coast' && state.elapsed >= MEDUSA_HOMING_DELAY_SEC) {
      state.phase = 'homing';
      state.homingElapsed = 0;
    }

    if (state.phase === 'homing') {
      state.homingElapsed += dt;
      let toX = liveTarget.x - state.px;
      let toY = (liveTarget.y - state.py) * 0.35;
      let toZ = liveTarget.z - state.pz;
      const toLen = Math.hypot(toX, toY, toZ);
      if (toLen > 1e-5) {
        toX /= toLen;
        toY /= toLen;
        toZ /= toLen;
        const lerpT = Math.min(1, MEDUSA_TURN_RATE * dt);
        state.dx += (toX - state.dx) * lerpT;
        state.dy += (toY - state.dy) * lerpT;
        state.dz += (toZ - state.dz) * lerpT;
        const dLen = Math.hypot(state.dx, state.dy, state.dz) || 1e-6;
        state.dx /= dLen;
        state.dy /= dLen;
        state.dz /= dLen;
      }
      const t = Math.min(1, Math.max(0, state.homingElapsed / MEDUSA_ACCEL_SEC));
      const smooth = t * t * (3 - 2 * t);
      state.speed = MEDUSA_START_SPEED + (MEDUSA_MAX_SPEED - MEDUSA_START_SPEED) * smooth;
    }

    state.px += state.dx * state.speed * dt;
    state.py += state.dy * state.speed * dt;
    state.pz += state.dz * state.speed * dt;
    state.elapsed += dt;

    const rangeFromSpawn = Math.hypot(state.px - state.spawnX, state.pz - state.spawnZ);
    if (rangeFromSpawn > MEDUSA_CAST_RANGE * 1.35) {
      return {
        hit: false,
        impact: { x: state.px, y: state.py, z: state.pz },
        done: true,
      };
    }

    const players = this.room?.getPlayers();
    if (players) {
      for (const p of players) {
        if (!p || p.health <= 0) continue;
        // Well-timed dash phases through the bolt
        if (p.movementDirection?.isDashing) continue;
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

  emitMedusaProjectileImpact(medusaId, position, hit) {
    if (!this.io) return;
    this.io.to(this.roomId).emit('medusa-projectile-impact', {
      medusaId,
      position: {
        x: position.x,
        y: position.y,
        z: position.z,
      },
      hit: !!hit,
      timestamp: Date.now(),
    });
  }

  startMedusaProjectileFlight(medusaId, start, targetId) {
    const state = this.createMedusaProjectileState(start, targetId);
    if (!state) return;

    if (this.io) {
      const targetPos = this.medusaOrbGetTargetPos(targetId);
      this.io.to(this.roomId).emit('medusa-projectile-telegraph', {
        medusaId,
        startPosition: { x: start.x, y: start.y, z: start.z },
        targetPosition: targetPos
          ? { x: targetPos.x, y: targetPos.y, z: targetPos.z }
          : { x: start.x, y: start.y, z: start.z + 1 },
        damage: MEDUSA_PROJECTILE_DAMAGE,
        targetPlayerId: targetId,
        timestamp: Date.now(),
      });
    }

    const STEP_MS = 50;
    const intervalId = setInterval(() => {
      if (!this.room?.getGameStarted()) {
        clearInterval(intervalId);
        this.removeMedusaProjectileInterval(medusaId, intervalId);
        return;
      }
      const liveMedusa = this.room?.getEnemy(medusaId);
      if (!liveMedusa || liveMedusa.isDying) {
        clearInterval(intervalId);
        this.removeMedusaProjectileInterval(medusaId, intervalId);
        return;
      }

      const remaining = state.maxFlightSec - state.elapsed;
      const dt = Math.min(STEP_MS / 1000, remaining > 0 ? remaining : STEP_MS / 1000);
      const { hit, impact, done } = this.stepMedusaProjectile(state, dt);

      if (hit && impact) {
        clearInterval(intervalId);
        this.removeMedusaProjectileInterval(medusaId, intervalId);
        this.room.damagePlayersInHorizontalRing(
          { x: impact.x, z: impact.z },
          MEDUSA_HIT_RADIUS,
          MEDUSA_PROJECTILE_DAMAGE,
          'medusa_projectile',
          { sourceEnemyId: medusaId },
        );
        this.room.tryDamageAlliedKnightInXZDisk(
          { x: impact.x, z: impact.z },
          MEDUSA_HIT_RADIUS,
          MEDUSA_PROJECTILE_DAMAGE,
          {
            sourceEnemyId: medusaId,
            damageType: 'medusa_projectile',
          },
        );
        this.emitMedusaProjectileImpact(medusaId, impact, true);
        return;
      }

      if (done && impact) {
        clearInterval(intervalId);
        this.removeMedusaProjectileInterval(medusaId, intervalId);
        this.emitMedusaProjectileImpact(medusaId, impact, false);
      }
    }, STEP_MS);

    this.addMedusaProjectileInterval(medusaId, intervalId);
  }

  scheduleGenericSpinPathDamage(enemy, startPosition, endPosition, damage, travelMs, stripHalfWidth, hitEventName, idFieldName, landEventConfig, hostileDamageType = null) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;

    const hitPlayerIds = new Set();
    const hitAllyIds = new Set();
    const hitHostileIds = new Set();
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

    const eid = enemy.id;
    const interval = setInterval(() => {
      if (enemy.isDying || !this.room?.getGameStarted()) {
        clearInterval(interval);
        this._removeEnemyHazardInterval(eid, interval);
        return;
      }
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(1, elapsed / travelMs);
      const currentX = sx + pathX * progress;
      const currentZ = sz + pathZ * progress;
      const segX = currentX - sx;
      const segZ = currentZ - sz;
      const segLenSq = segX * segX + segZ * segZ;
      if (segLenSq >= 1e-4) {
        // Iterate Maps directly — avoid getPlayers()/getEnemies() Array.from every 50ms.
        const playerMap = this.room?.players;
        if (playerMap) {
          for (const player of playerMap.values()) {
            if (!player || player.health <= 0 || hitPlayerIds.has(player.id)) continue;
            const px = player.position.x - sx;
            const pz = player.position.z - sz;
            const t = Math.max(0, Math.min(1, (px * segX + pz * segZ) / segLenSq));
            const closestX = sx + segX * t;
            const closestZ = sz + segZ * t;
            const perpendicular = Math.hypot(player.position.x - closestX, player.position.z - closestZ);
            if (perpendicular > stripHalfWidth) continue;
            hitPlayerIds.add(player.id);
            this.recordAlliedProtectionThreat(enemy.id, player.id, damage);
            if (this.io) {
              this.io.to(this.roomId).emit(hitEventName, {
                [idFieldName]: enemy.id,
                targetPlayerId: player.id,
                damage,
                position: { x: closestX, y: startPosition.y ?? 0, z: closestZ },
                timestamp: Date.now(),
              });
            }
          }
        }
        this.damageAlliedUnitsAlongSpinStrip(
          sx,
          sz,
          segX,
          segZ,
          stripHalfWidth,
          damage,
          { sourceEnemyId: enemy.id, damageType: hostileDamageType || 'enemy_spin' },
          hitAllyIds,
        );
      }
      if (hostileDamageType) {
        const enemyMap = this.room?.enemies;
        if (enemyMap) {
          for (const target of enemyMap.values()) {
            if (!target || target.id === enemy.id || target.isDying || target.health <= 0) continue;
            if (hitHostileIds.has(target.id)) continue;
            if (!this.isValidHostileEnemyAggroTarget(enemy, target)) continue;
            const tx = target.position.x - sx;
            const tz = target.position.z - sz;
            const t = Math.max(0, Math.min(1, (tx * segX + tz * segZ) / segLenSq));
            const closestX = sx + segX * t;
            const closestZ = sz + segZ * t;
            const perpendicular = Math.hypot(target.position.x - closestX, target.position.z - closestZ);
            if (perpendicular > stripHalfWidth) continue;
            hitHostileIds.add(target.id);
            this.damageHostileMobFromMob(enemy, target, damage, hostileDamageType);
          }
        }
      }
      if (progress >= 1) {
        clearInterval(interval);
        this._removeEnemyHazardInterval(eid, interval);
        if (landEventConfig?.event && this.io && !enemy.isDying) {
          const landPayload = {
            position: { x: ex, y: startPosition.y ?? 0, z: ez },
            rotation: enemy.rotation ?? 0,
            timestamp: Date.now(),
          };
          landPayload[landEventConfig.idField] = enemy.id;
          this.io.to(this.roomId).emit(landEventConfig.event, landPayload);
        }
      }
    }, sampleEveryMs);
    this._addEnemyHazardInterval(eid, interval);
  }

  tryEnemySpinLunge(enemy, targetPlayer, now, distance, config) {
    if (this.room?.isEnemyAffectedBy(enemy.id, 'freeze')) return false;
    if (this.room?.isEnemyAffectedBy(enemy.id, 'stun')) return false;
    if (!targetPlayer?.position) return false;
    const liveAlly = this.room?.getEnemy?.(targetPlayer.id);
    const isCombatAllyTarget = this._isPlayerCombatAlly(liveAlly);
    const targetAlive = (targetPlayer.health ?? 0) > 0
      || (isCombatAllyTarget && !liveAlly.isDying && liveAlly.health > 0);
    if (!targetAlive) return false;
    if (distance > config.castRange) return false;

    const last = config.cooldownMap.get(enemy.id) || 0;
    if (now - last < config.cooldownMs) return false;

    const dx = targetPlayer.position.x - enemy.position.x;
    const dz = targetPlayer.position.z - enemy.position.z;
    const mag = Math.sqrt(dx * dx + dz * dz);
    if (mag < 1e-4) return false;

    const dirX = dx / mag;
    const dirZ = dz / mag;
    enemy.rotation = Math.atan2(dirX, dirZ);

    config.cooldownMap.set(enemy.id, now);
    this.meleeLockUntil.set(enemy.id, now + config.chargeMs + config.travelMs);
    this.enemyPaths.delete(enemy.id);

    const chargePosition = { ...enemy.position };
    if (this.io) {
      const chargePayload = {
        position: chargePosition,
        rotation: enemy.rotation,
        chargeMs: config.chargeMs,
        timestamp: Date.now(),
        targetPlayerId: targetPlayer.id,
      };
      chargePayload[config.idField] = enemy.id;
      if (config.variant != null) chargePayload.variant = config.variant;
      this.io.to(this.roomId).emit(config.chargeEvent, chargePayload);
      this._queueMove(enemy.id, enemy.position, enemy.rotation);
    }

    const originalTargetId = targetPlayer.id;
    const originalAim = { ...targetPlayer.position };
    const eid = enemy.id;
    this._scheduleEnemyTimeout(eid, () => {
      if (enemy.isDying || !this.room?.getGameStarted()) return;
      if (this.room?.isEnemyAffectedBy(eid, 'stun')) return;
      if (this.room?.isEnemyAffectedBy(eid, 'freeze')) return;

      const currentPlayers = this.room?.getPlayers?.() || [];
      const liveTarget = currentPlayers.find((p) => p.id === originalTargetId && p.health > 0);
      const liveAllyTarget = !liveTarget ? this.room?.getEnemy?.(originalTargetId) : null;
      const aimPosition = liveTarget?.position
        || (this._isPlayerCombatAlly(liveAllyTarget) && !liveAllyTarget.isDying && liveAllyTarget.health > 0
          ? liveAllyTarget.position
          : originalAim);
      const aimDx = aimPosition.x - enemy.position.x;
      const aimDz = aimPosition.z - enemy.position.z;
      const aimMag = Math.sqrt(aimDx * aimDx + aimDz * aimDz);
      if (aimMag < 1e-4) return;

      const spinDirX = aimDx / aimMag;
      const spinDirZ = aimDz / aimMag;
      const startPosition = { ...enemy.position };
      const rawX = enemy.position.x + spinDirX * config.lungeDistance;
      const rawZ = enemy.position.z + spinDirZ * config.lungeDistance;

      let resolved = this.resolveEnemyWallCollisions(rawX, rawZ);
      resolved = this.resolveMeleePeerSeparation(enemy, resolved.x, resolved.z);
      const moved = Math.hypot(resolved.x - enemy.position.x, resolved.z - enemy.position.z);
      if (moved < 0.5) return;

      enemy.position.x = resolved.x;
      enemy.position.z = resolved.z;
      enemy.rotation = Math.atan2(spinDirX, spinDirZ);
      const endPosition = { ...enemy.position };

      if (this.io) {
        const dashPayload = {
          targetPlayerId: originalTargetId,
          startPosition,
          endPosition,
          rotation: enemy.rotation,
          distance: moved,
          durationMs: config.travelMs,
          damage: config.damage,
          timestamp: Date.now(),
        };
        dashPayload[config.idField] = enemy.id;
        if (config.variant != null) dashPayload.variant = config.variant;
        this.io.to(this.roomId).emit(config.dashEvent, dashPayload);
        this._queueMove(eid, enemy.position, enemy.rotation);
      }

      this.scheduleGenericSpinPathDamage(
        enemy, startPosition, endPosition, config.damage, config.travelMs,
        config.stripHalfWidth, config.hitEvent, config.idField,
        config.landEvent ? { event: config.landEvent, idField: config.idField } : null,
      );
    }, config.chargeMs);

    return true;
  }

  tryEnemySpinLungeVsHostile(enemy, targetEnemy, now, distance, config) {
    if (this.room?.isEnemyAffectedBy(enemy.id, 'freeze')) return false;
    if (this.room?.isEnemyAffectedBy(enemy.id, 'stun')) return false;
    if (!targetEnemy?.position || targetEnemy.isDying || targetEnemy.health <= 0) return false;
    if (!this.isValidHostileEnemyAggroTarget(enemy, targetEnemy)) return false;
    if (distance > config.castRange) return false;

    const last = config.cooldownMap.get(enemy.id) || 0;
    if (now - last < config.cooldownMs) return false;

    const dx = targetEnemy.position.x - enemy.position.x;
    const dz = targetEnemy.position.z - enemy.position.z;
    const mag = Math.sqrt(dx * dx + dz * dz);
    if (mag < 1e-4) return false;

    const dirX = dx / mag;
    const dirZ = dz / mag;
    enemy.rotation = Math.atan2(dirX, dirZ);

    config.cooldownMap.set(enemy.id, now);
    this.meleeLockUntil.set(enemy.id, now + config.chargeMs + config.travelMs);
    this.enemyPaths.delete(enemy.id);

    const chargePosition = { ...enemy.position };
    if (this.io) {
      const chargePayload = {
        position: chargePosition,
        rotation: enemy.rotation,
        chargeMs: config.chargeMs,
        timestamp: Date.now(),
        targetHostileEnemyId: targetEnemy.id,
      };
      chargePayload[config.idField] = enemy.id;
      if (config.variant != null) chargePayload.variant = config.variant;
      this.io.to(this.roomId).emit(config.chargeEvent, chargePayload);
      this._queueMove(enemy.id, enemy.position, enemy.rotation);
    }

    const originalTargetId = targetEnemy.id;
    const originalAim = { ...targetEnemy.position };
    const eid = enemy.id;
    this._scheduleEnemyTimeout(eid, () => {
      if (enemy.isDying || !this.room?.getGameStarted()) return;
      if (this.room?.isEnemyAffectedBy(eid, 'stun')) return;
      if (this.room?.isEnemyAffectedBy(eid, 'freeze')) return;

      const liveTarget = this.room?.getEnemy?.(originalTargetId);
      const aimPosition = (liveTarget && !liveTarget.isDying && liveTarget.health > 0)
        ? liveTarget.position
        : originalAim;
      const aimDx = aimPosition.x - enemy.position.x;
      const aimDz = aimPosition.z - enemy.position.z;
      const aimMag = Math.sqrt(aimDx * aimDx + aimDz * aimDz);
      if (aimMag < 1e-4) return;

      const spinDirX = aimDx / aimMag;
      const spinDirZ = aimDz / aimMag;
      const startPosition = { ...enemy.position };
      const rawX = enemy.position.x + spinDirX * config.lungeDistance;
      const rawZ = enemy.position.z + spinDirZ * config.lungeDistance;

      let resolved = this.resolveEnemyWallCollisions(rawX, rawZ);
      resolved = this.resolveMeleePeerSeparation(enemy, resolved.x, resolved.z);
      const moved = Math.hypot(resolved.x - enemy.position.x, resolved.z - enemy.position.z);
      if (moved < 0.5) return;

      enemy.position.x = resolved.x;
      enemy.position.z = resolved.z;
      enemy.rotation = Math.atan2(spinDirX, spinDirZ);
      const endPosition = { ...enemy.position };

      if (this.io) {
        const dashPayload = {
          targetHostileEnemyId: originalTargetId,
          startPosition,
          endPosition,
          rotation: enemy.rotation,
          distance: moved,
          durationMs: config.travelMs,
          damage: config.damage,
          timestamp: Date.now(),
        };
        dashPayload[config.idField] = enemy.id;
        if (config.variant != null) dashPayload.variant = config.variant;
        this.io.to(this.roomId).emit(config.dashEvent, dashPayload);
        this._queueMove(eid, enemy.position, enemy.rotation);
      }

      this.scheduleGenericSpinPathDamage(
        enemy, startPosition, endPosition, config.damage, config.travelMs,
        config.stripHalfWidth, config.hitEvent, config.idField,
        config.landEvent ? { event: config.landEvent, idField: config.idField } : null,
        config.hostileDamageType || null,
      );
    }, config.chargeMs);

    return true;
  }

  updateSpectreAI(spectre, players) {
    let aggroData = this.enemyAggro.get(spectre.id);
    if (!aggroData) {
      const closest = this.findClosestCombatantForSpectre(spectre, players);
      if (!closest) return;
      aggroData = {
        targetPlayerId: closest.kind === 'player' ? closest.player.id : null,
        targetZombieId: null,
        targetTrapId: null,
        targetHostileEnemyId: closest.kind === 'hostile' ? closest.enemy.id : null,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(spectre.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, spectre, players);
    if (!resolved) return;

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(spectre.position, tpos);
    const attackRange = SPECTRE_MELEE_RANGE;
    const aggroRadius = SPECTRE_AGGRO_RADIUS;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);
    const losOk = this.hasLineOfSight(spectre.position, tpos);

    if (!aggroData.isAggroed && distance <= aggroRadius && losOk) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }
    this._maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius);

    if (!aggroData.isAggroed) return;

    const now = Date.now();

    // While whirlwinding: chase at reduced speed, no melee swings.
    if (spectre.whirlwindActive) {
      this.moveEnemyTowardsTarget(spectre, moveTarget, {
        meleeSurroundAttackRange: attackRange,
        speedMultiplier: SPECTRE_WHIRLWIND_MOVE_SPEED_MULT,
      });
      return;
    }

    if (this.trySpectreWhirlwind(spectre, resolved, distance, now)) return;

    const lockUntil = this.meleeLockUntil.get(spectre.id) || 0;
    if (now < lockUntil) {
      this.tickMeleeSwingWindup(spectre, resolved);
      return;
    }

    const profile = getMeleeProfile('spectre');
    this.tryMeleeEngage(spectre, resolved, moveTarget, profile, { now, distance });
  }

  updateSerpentAI(serpent, players) {
    let aggroData = this.enemyAggro.get(serpent.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(serpent, players);
      if (!closestPlayer) return;
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(serpent.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, serpent, players);
    if (!resolved) return;

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(serpent.position, tpos);
    const aggroRadius = SERPENT_AGGRO_RADIUS;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);
    const losOk = this.hasLineOfSight(serpent.position, tpos);

    if (!aggroData.isAggroed && distance <= aggroRadius && losOk) {
      aggroData.isAggroed = true;
      this.emitBeastAggroSfx(serpent);
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
      this.clearBeastAggroSfx(serpent.id);
    }
    this._maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius);

    if (!aggroData.isAggroed) return;

    const now = Date.now();
    const lockUntil = this.meleeLockUntil.get(serpent.id) || 0;
    if (now < lockUntil) {
      this.tickMeleeSwingWindup(serpent, resolved);
      return;
    }

    const profile = getMeleeProfile(serpent.type === 'boss-serpent' ? 'boss-serpent' : 'serpent');
    this.tryMeleeEngage(serpent, resolved, moveTarget, profile, { now, distance });
  }

  updateWolfAI(wolf, players) {
    const now = Date.now();
    const skipHowl = wolf.type === 'boss-wolf';
    if (!skipHowl) {
      const howlStartsAt = wolf.howlStartsAt ?? (wolf.spawnedAt ?? 0);
      const howlEndsAt = wolf.howlEndsAt ?? (howlStartsAt + WOLF_HOWL_DURATION_MS);

      if (now < howlEndsAt) {
        if (now >= howlStartsAt && !this.wolfHowlEmitted.get(wolf.id)) {
          this.wolfHowlEmitted.set(wolf.id, true);
          this.meleeLockUntil.set(wolf.id, howlEndsAt);
          if (this.io) {
            this.io.to(this.roomId).emit('wolf-howl-start', {
              wolfId: wolf.id,
              durationMs: Math.max(0, howlEndsAt - now),
              timestamp: now,
            });
          }
        }
        return;
      }
    }

    let aggroData = this.enemyAggro.get(wolf.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(wolf, players);
      if (!closestPlayer) return;
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(wolf.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, wolf, players);
    if (!resolved) return;

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(wolf.position, tpos);
    const aggroRadius = WOLF_AGGRO_RADIUS;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);
    const losOk = this.hasLineOfSight(wolf.position, tpos);

    if (!aggroData.isAggroed && distance <= aggroRadius && losOk) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }
    this._maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius);

    if (!aggroData.isAggroed) return;

    const lockUntil = this.meleeLockUntil.get(wolf.id) || 0;
    if (now < lockUntil) {
      this.tickMeleeSwingWindup(wolf, resolved);
      return;
    }

    wolf.moveSpeed = WOLF_MOVE_SPEED;

    const profile = getMeleeProfile(wolf.type === 'boss-wolf' ? 'boss-wolf' : 'wolf');
    this.tryMeleeEngage(wolf, resolved, moveTarget, profile, { now, distance });
  }

  updateBearAI(bear, players) {
    const now = Date.now();

    let aggroData = this.enemyAggro.get(bear.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(bear, players);
      if (!closestPlayer) return;
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(bear.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, bear, players);
    if (!resolved) return;

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(bear.position, tpos);
    const aggroRadius = BEAR_AGGRO_RADIUS;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);
    const losOk = this.hasLineOfSight(bear.position, tpos);

    if (!aggroData.isAggroed && distance <= aggroRadius && losOk) {
      aggroData.isAggroed = true;
      this.emitBeastAggroSfx(bear);
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
      this.clearBeastAggroSfx(bear.id);
    }
    this._maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius);

    if (!aggroData.isAggroed) return;

    const lockUntil = this.meleeLockUntil.get(bear.id) || 0;
    if (now < lockUntil) {
      this.tickMeleeSwingWindup(bear, resolved);
      return;
    }

    bear.moveSpeed = BEAR_MOVE_SPEED;

    const profile = getMeleeProfile(bear.type === 'boss-bear' ? 'boss-bear' : 'bear');
    this.tryMeleeEngage(bear, resolved, moveTarget, profile, { now, distance });
  }

  _pickLocalWanderTarget(anchorX, anchorZ, radius) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * radius;
    const rawX = anchorX + Math.cos(angle) * dist;
    const rawZ = anchorZ + Math.sin(angle) * dist;
    return this.clampToArenaXZ(rawX, rawZ);
  }

  _wanderTigerLocally(tiger) {
    const now = Date.now();
    const anchor = tiger.wanderAnchor || { x: tiger.position.x, z: tiger.position.z };
    if (!tiger.wanderAnchor) tiger.wanderAnchor = { x: anchor.x, z: anchor.z };
    const target = tiger.wanderTarget;
    const reachedTarget = target
      ? Math.hypot(target.x - tiger.position.x, target.z - tiger.position.z) <= TIGER_WANDER_REACH
      : true;
    if (!target || reachedTarget || now >= (tiger.nextWanderPickAt || 0)) {
      tiger.wanderTarget = this._pickLocalWanderTarget(anchor.x, anchor.z, TIGER_WANDER_RADIUS);
      tiger.nextWanderPickAt = now + TIGER_WANDER_REPICK_MS;
    }
    tiger.tigerLocomotion = 'walk';
    tiger.moveSpeed = TIGER_WALK_SPEED;
    if (tiger.wanderTarget) {
      this.moveEnemyTowardsTarget(tiger, { id: 'tiger-wander', position: tiger.wanderTarget });
    }
  }

  _wanderSkyray(skyray) {
    const now = Date.now();
    const target = skyray.wanderTarget;
    const reachedTarget = target
      ? Math.hypot(target.x - skyray.position.x, target.z - skyray.position.z) <= SKYRAY_WANDER_REACH
      : true;
    if (!target || reachedTarget || now >= (skyray.nextWanderPickAt || 0)) {
      const useHexInterior = this._isHexCombatArena();
      const next = this.room?._generateScatteredPositions?.(1, useHexInterior)?.[0];
      if (next) skyray.wanderTarget = next;
      skyray.nextWanderPickAt = now + SKYRAY_WANDER_REPICK_MS;
    }
    skyray.moveSpeed = SKYRAY_WANDER_SPEED;
    if (skyray.wanderTarget) {
      this.moveEnemyTowardsTarget(skyray, { id: 'skyray-wander', position: skyray.wanderTarget });
    }
  }

  updateTigerAI(tiger, players) {
    if (this.tickTigerPounceFlight(tiger)) return;

    let aggroData = this.enemyAggro.get(tiger.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(tiger, players);
      if (!closestPlayer) {
        this._wanderTigerLocally(tiger);
        return;
      }
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(tiger.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, tiger, players);
    if (!resolved) {
      this._wanderTigerLocally(tiger);
      return;
    }

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(tiger.position, tpos);
    const attackRange = TIGER_MELEE_RANGE;
    const attackCooldown = tiger.attackCooldown ?? 850;
    const aggroRadius = TIGER_AGGRO_RADIUS;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);
    const losOk = this.hasLineOfSight(tiger.position, tpos);

    if (!aggroData.isAggroed && distance <= aggroRadius && losOk) {
      aggroData.isAggroed = true;
      this.emitBeastAggroSfx(tiger);
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
      this.clearBeastAggroSfx(tiger.id);
    }
    this._maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius);

    if (!aggroData.isAggroed) {
      this._wanderTigerLocally(tiger);
      return;
    }

    const now = Date.now();
    const lockUntil = this.meleeLockUntil.get(tiger.id) || 0;
    if (now < lockUntil) {
      this.tickMeleeSwingWindup(tiger, resolved);
      return;
    }

    // Airborne player (Skyfall): hold calm idle — no run/pounce chase underneath.
    if (resolved.kind === 'player' && this._isTargetAirborne(resolved.player)) {
      tiger.tigerLocomotion = 'walk';
      tiger.moveSpeed = 0;
      const profile = getMeleeProfile(tiger.type === 'boss-tiger' ? 'boss-tiger' : 'tiger');
      this.tryMeleeEngage(tiger, resolved, moveTarget, profile, { now, distance });
      return;
    }

    tiger.tigerLocomotion = 'run';
    tiger.moveSpeed = TIGER_RUN_SPEED;

    if (
      resolved.kind === 'player' &&
      distance > attackRange &&
      distance <= TIGER_POUNCE_MAX_TRAVEL
    ) {
      const canPounce =
        distance >= TIGER_POUNCE_MIN_RANGE &&
        (this.tigerPounceCooldown.get(tiger.id) == null ||
          now - (this.tigerPounceCooldown.get(tiger.id) || 0) >= TIGER_POUNCE_COOLDOWN_MS) &&
        !this.tigerPounceEndAt.has(tiger.id);
      if (canPounce) {
        this.tigerStartPounce(tiger, resolved.player);
        return;
      }
    }

    const profile = getMeleeProfile(tiger.type === 'boss-tiger' ? 'boss-tiger' : 'tiger');
    this.tryMeleeEngage(tiger, resolved, moveTarget, profile, { now, distance });
  }

  updateSkyrayAI(skyray, players) {
    let aggroData = this.enemyAggro.get(skyray.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(skyray, players);
      if (!closestPlayer) {
        this._wanderSkyray(skyray);
        return;
      }
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(skyray.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, skyray, players);
    if (!resolved) {
      this._wanderSkyray(skyray);
      return;
    }

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(skyray.position, tpos);
    const aggroRadius = SKYRAY_AGGRO_RADIUS;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);
    const losOk = this.hasLineOfSight(skyray.position, tpos);

    if (!aggroData.isAggroed && distance <= aggroRadius && losOk) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }
    this._maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius);

    if (!aggroData.isAggroed) {
      this._wanderSkyray(skyray);
      return;
    }

    const now = Date.now();
    const lockUntil = this.meleeLockUntil.get(skyray.id) || 0;
    if (now < lockUntil) {
      this.tickMeleeSwingWindup(skyray, resolved);
      return;
    }

    skyray.moveSpeed = SKYRAY_CHASE_SPEED;

    const profile = getMeleeProfile('skyray');
    this.tryMeleeEngage(skyray, resolved, moveTarget, profile, { now, distance });
  }

  updateWyvernAI(wyvern, players) {
    let aggroData = this.enemyAggro.get(wyvern.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(wyvern, players);
      if (!closestPlayer) return;
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(wyvern.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, wyvern, players);
    if (!resolved) return;

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(wyvern.position, tpos);
    const aggroRadius = WYVERN_AGGRO_RADIUS;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);
    const losOk = this.hasLineOfSight(wyvern.position, tpos);

    if (!aggroData.isAggroed && distance <= aggroRadius && losOk) {
      aggroData.isAggroed = true;
      this.emitBeastAggroSfx(wyvern);
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
      this.clearBeastAggroSfx(wyvern.id);
    }
    this._maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius);

    if (!aggroData.isAggroed) return;

    const now = Date.now();

    // While breath weapon is active: hold position but track target facing.
    if (wyvern.breathActive) {
      if (tpos) {
        this._smoothRotateEnemyTowardPoint(wyvern, tpos);
        this._queueMoveIfChanged(wyvern.id, wyvern.position, wyvern.rotation);
      }
      return;
    }

    if (this.tryWyvernBreath(wyvern, resolved, distance, now)) return;

    const lockUntil = this.meleeLockUntil.get(wyvern.id) || 0;
    if (now < lockUntil) {
      this.tickMeleeSwingWindup(wyvern, resolved);
      return;
    }

    const profile = getMeleeProfile('wyvern');
    this.tryMeleeEngage(wyvern, resolved, moveTarget, profile, { now, distance });
  }

  _terrorhawkHorizontalDistance(a, b) {
    const dx = (a?.x ?? 0) - (b?.x ?? 0);
    const dz = (a?.z ?? 0) - (b?.z ?? 0);
    return Math.hypot(dx, dz);
  }

  _terrorhawkCannotFlyUp(hawk) {
    if (!hawk?.id || !this.room?.isEnemyAffectedBy) return false;
    return this.room.isEnemyAffectedBy(hawk.id, 'freeze')
      || this.room.isEnemyAffectedBy(hawk.id, 'entangle');
  }

  _terrorhawkBeginTakeoff(hawk) {
    if (!hawk || hawk.isDying) return;
    if (this._terrorhawkCannotFlyUp(hawk)) return;
    const now = Date.now();
    const onGround = hawk.terrorhawkPhase === 'land'
      || hawk.terrorhawkPhase === 'ground_melee'
      || (hawk.position?.y ?? 0) <= 0.05;
    if (onGround && hawk.groundMinUntil && now < hawk.groundMinUntil) return;
    hawk.terrorhawkPhase = 'takeoff';
    hawk.moveSpeed = 0;
    hawk.takeoffStartedAt = now;
    hawk.takeoffEndsAt = now + TERRORHAWK_TAKEOFF_MS;
    hawk.diveLandX = null;
    hawk.diveLandZ = null;
    hawk.diveDescendAt = null;
    hawk.groundMinUntil = null;
    if (hawk.position.y == null || hawk.position.y < 0) hawk.position.y = 0;
    this.meleeLockUntil.set(hawk.id, hawk.takeoffEndsAt);
    if (this.io) {
      this.io.to(this.roomId).emit('terrorhawk-takeoff-start', {
        terrorhawkId: hawk.id,
        durationMs: TERRORHAWK_TAKEOFF_MS,
        position: { ...hawk.position },
        timestamp: now,
      });
      this._queueMove(hawk.id, hawk.position, hawk.rotation);
    }
  }

  _terrorhawkBeginDive(hawk, landX, landZ) {
    if (!hawk || hawk.isDying) return;
    const now = Date.now();
    hawk.terrorhawkPhase = 'dive';
    hawk.moveSpeed = 0;
    hawk.diveLandX = landX;
    hawk.diveLandZ = landZ;
    hawk.diveDescendAt = now + TERRORHAWK_DIVE_TELEGRAPH_MS;
    hawk.position.x = landX;
    hawk.position.z = landZ;
    hawk.position.y = TERRORHAWK_HOVER_Y;
    this.meleeLockUntil.set(hawk.id, now + 5000);
    if (this.io) {
      this.io.to(this.roomId).emit('terrorhawk-dive-start', {
        terrorhawkId: hawk.id,
        landPosition: { x: landX, y: 0, z: landZ },
        position: { ...hawk.position },
        timestamp: now,
      });
      // Telegraph SFX right before the dive descends.
      this.io.to(this.roomId).emit('beast-attack-sfx', {
        soundId: 'beast_wyvern_attack',
        beastId: hawk.id,
        position: hawk.position,
        timestamp: now,
      });
      this._queueMove(hawk.id, hawk.position, hawk.rotation);
    }
  }

  _terrorhawkCompleteLanding(hawk) {
    if (!hawk || hawk.isDying) return;
    const now = Date.now();
    hawk.position.y = 0;
    if (hawk.diveLandX != null) hawk.position.x = hawk.diveLandX;
    if (hawk.diveLandZ != null) hawk.position.z = hawk.diveLandZ;
    hawk.terrorhawkPhase = 'land';
    hawk.moveSpeed = 0;
    hawk.diveDescendAt = null;
    hawk.landEndsAt = now + TERRORHAWK_JUMPEND_MS;
    hawk.groundMinUntil = now + TERRORHAWK_MIN_GROUND_MS;
    this.meleeLockUntil.set(hawk.id, hawk.landEndsAt);

    const land = { x: hawk.position.x, y: 0, z: hawk.position.z };
    if (this.room) {
      this.room.damagePlayersInHorizontalRing(
        land,
        TERRORHAWK_LANDING_RADIUS,
        TERRORHAWK_LANDING_DAMAGE,
        'terrorhawk_land',
        { sourceEnemyId: hawk.id },
      );
      this.room.tryDamageAlliedKnightInXZDisk(
        land,
        TERRORHAWK_LANDING_RADIUS,
        TERRORHAWK_LANDING_DAMAGE,
        { sourceEnemyId: hawk.id, damageType: 'terrorhawk_land' },
      );
      // Also hit player zombies / hostile allies in the landing disk.
      const r2 = TERRORHAWK_LANDING_RADIUS * TERRORHAWK_LANDING_RADIUS;
      for (const enemy of this.room.getEnemies?.() || []) {
        if (!enemy || enemy.isDying || enemy.health <= 0 || enemy.id === hawk.id) continue;
        if (enemy.type !== 'player-zombie' && !enemy.alliedUnit) continue;
        if (enemy.type === 'allied-knight') continue; // already handled above
        const dx = (enemy.position?.x ?? 0) - land.x;
        const dz = (enemy.position?.z ?? 0) - land.z;
        if (dx * dx + dz * dz > r2) continue;
        if (enemy.type === 'player-zombie') {
          this.damagePlayerZombieFromMob(hawk, enemy, TERRORHAWK_LANDING_DAMAGE, 'terrorhawk_land');
        }
      }
    }

    if (this.io) {
      this.io.to(this.roomId).emit('terrorhawk-land', {
        terrorhawkId: hawk.id,
        landPosition: land,
        timestamp: now,
      });
      this._queueMove(hawk.id, hawk.position, hawk.rotation);
    }
  }

  _terrorhawkMoveApproach(hawk, moveTarget) {
    if (!moveTarget?.position) return;
    hawk.moveSpeed = TERRORHAWK_FLY_SPEED;
    hawk.position.y = TERRORHAWK_HOVER_Y;

    const goal = moveTarget.position;
    const horiz = this._terrorhawkHorizontalDistance(hawk.position, goal);
    if (horiz < TERRORHAWK_APPROACH_STOP) return;

    const waypoint = this._getPathWaypoint(hawk, moveTarget);
    const dx = waypoint.x - hawk.position.x;
    const dz = waypoint.z - hawk.position.z;
    const mag = Math.hypot(dx, dz);
    if (mag < 1e-6) return;

    const dirX = dx / mag;
    const dirZ = dz / mag;
    const deltaTime = this.updateInterval / 1000;
    const moveDistance = this.getModifiedMovementSpeed(hawk.id, TERRORHAWK_FLY_SPEED) * deltaTime;
    if (moveDistance <= 0) return;

    const rawX = hawk.position.x + dirX * moveDistance;
    const rawZ = hawk.position.z + dirZ * moveDistance;
    const resolved = this.resolveEnemyWallCollisions(rawX, rawZ);
    hawk.position.x = resolved.x;
    hawk.position.z = resolved.z;
    hawk.position.y = TERRORHAWK_HOVER_Y;
    hawk.rotation = Math.atan2(dirX, dirZ);
    this._queueMove(hawk.id, hawk.position, hawk.rotation);
  }

  updateTerrorhawkAI(hawk, players) {
    if (!hawk || hawk.isDying || hawk.health <= 0) return;

    // Ensure first tick starts takeoff from spawn (phase may already be 'takeoff').
    if (!hawk.terrorhawkPhase || (hawk.terrorhawkPhase === 'takeoff' && !hawk.takeoffStartedAt)) {
      this._terrorhawkBeginTakeoff(hawk);
      return;
    }

    const now = Date.now();
    const deltaTime = this.updateInterval / 1000;
    const phase = hawk.terrorhawkPhase;

    // --- Takeoff: rise 0 → hover Y over takeoff duration ---
    if (phase === 'takeoff') {
      hawk.moveSpeed = 0;
      if (this._terrorhawkCannotFlyUp(hawk)) {
        const tickMs = this.updateInterval || 0;
        if (hawk.takeoffStartedAt != null) hawk.takeoffStartedAt += tickMs;
        if (hawk.takeoffEndsAt != null) hawk.takeoffEndsAt += tickMs;
        this._queueMove(hawk.id, hawk.position, hawk.rotation);
        return;
      }
      const started = hawk.takeoffStartedAt || now;
      const ends = hawk.takeoffEndsAt || (started + TERRORHAWK_TAKEOFF_MS);
      const t = Math.min(1, (now - started) / Math.max(1, ends - started));
      hawk.position.y = TERRORHAWK_HOVER_Y * t;
      this._queueMove(hawk.id, hawk.position, hawk.rotation);
      if (now >= ends || hawk.position.y >= TERRORHAWK_HOVER_Y - 0.05) {
        hawk.position.y = TERRORHAWK_HOVER_Y;
        hawk.terrorhawkPhase = 'hover';
        this._queueMove(hawk.id, hawk.position, hawk.rotation);
      }
      return;
    }
    // --- Dive: hold briefly for telegraph SFX, then rapid descent (XZ frozen) ---
    if (phase === 'dive') {
      hawk.moveSpeed = 0;
      if (hawk.diveLandX != null) hawk.position.x = hawk.diveLandX;
      if (hawk.diveLandZ != null) hawk.position.z = hawk.diveLandZ;
      if (hawk.diveDescendAt && now < hawk.diveDescendAt) {
        hawk.position.y = TERRORHAWK_HOVER_Y;
        this._queueMove(hawk.id, hawk.position, hawk.rotation);
        return;
      }
      hawk.position.y = Math.max(0, hawk.position.y - TERRORHAWK_DIVE_SPEED * deltaTime);
      this._queueMove(hawk.id, hawk.position, hawk.rotation);
      if (hawk.position.y <= 0.05) {
        this._terrorhawkCompleteLanding(hawk);
      }
      return;
    }

    // --- Land: jumpEnd lock, then ground melee ---
    if (phase === 'land') {
      hawk.moveSpeed = 0;
      hawk.position.y = 0;
      if (now >= (hawk.landEndsAt || 0)) {
        hawk.terrorhawkPhase = 'ground_melee';
        this._queueMove(hawk.id, hawk.position, hawk.rotation);
      }
      return;
    }

    // Resolve aggro (shared for hover / approach / ground_melee)
    let aggroData = this.enemyAggro.get(hawk.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(hawk, players);
      if (!closestPlayer) {
        if (phase === 'ground_melee') {
          this._terrorhawkBeginTakeoff(hawk);
        }
        return;
      }
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(hawk.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, hawk, players);

    // --- Hover: wait for aggro within 12 ---
    if (phase === 'hover') {
      hawk.moveSpeed = 0;
      hawk.position.y = TERRORHAWK_HOVER_Y;
      if (!resolved) return;
      const tpos = this.combatTargetPosition(resolved);
      const distance = this._terrorhawkHorizontalDistance(hawk.position, tpos);
      const losOk = this.hasLineOfSight(hawk.position, tpos);
      if (!aggroData.isAggroed && distance <= TERRORHAWK_AGGRO_RADIUS && losOk) {
        aggroData.isAggroed = true;
      } else if (aggroData.isAggroed && distance > this.getCombatLeashRadius(aggroData, TERRORHAWK_AGGRO_RADIUS)) {
        aggroData.isAggroed = false;
        aggroData.threatFromDamage = false;
      }
      this._maybeClearForcedEdgeSpawn(aggroData, distance, TERRORHAWK_AGGRO_RADIUS);
      if (aggroData.isAggroed) {
        hawk.terrorhawkPhase = 'approach';
        this._queueMove(hawk.id, hawk.position, hawk.rotation);
      }
      return;
    }

    // --- Approach: fly at hover Y toward target ---
    if (phase === 'approach') {
      hawk.position.y = TERRORHAWK_HOVER_Y;
      if (!resolved) {
        hawk.terrorhawkPhase = 'hover';
        hawk.moveSpeed = 0;
        return;
      }
      const moveTarget = this.aggroTargetToMoveTarget(resolved);
      const tpos = this.combatTargetPosition(resolved);
      const distance = this._terrorhawkHorizontalDistance(hawk.position, tpos);
      const losOk = this.hasLineOfSight(hawk.position, tpos);
      if (!aggroData.isAggroed && distance <= TERRORHAWK_AGGRO_RADIUS && losOk) {
        aggroData.isAggroed = true;
      } else if (aggroData.isAggroed && distance > this.getCombatLeashRadius(aggroData, TERRORHAWK_AGGRO_RADIUS)) {
        aggroData.isAggroed = false;
        aggroData.threatFromDamage = false;
        hawk.terrorhawkPhase = 'hover';
        hawk.moveSpeed = 0;
        return;
      }
      this._maybeClearForcedEdgeSpawn(aggroData, distance, TERRORHAWK_AGGRO_RADIUS);
      if (!aggroData.isAggroed) {
        hawk.terrorhawkPhase = 'hover';
        hawk.moveSpeed = 0;
        return;
      }

      if (distance <= TERRORHAWK_DIVE_XZ_THRESHOLD) {
        this._terrorhawkBeginDive(hawk, tpos.x, tpos.z);
        return;
      }

      // Face target while flying
      if (tpos) this._smoothRotateEnemyTowardPoint(hawk, tpos);
      this._terrorhawkMoveApproach(hawk, moveTarget);
      return;
    }

    // --- Ground melee: bite if in range, else takeoff again ---
    if (phase === 'ground_melee') {
      hawk.moveSpeed = 0;
      hawk.position.y = 0;

      if (!resolved) {
        this._terrorhawkBeginTakeoff(hawk);
        return;
      }

      const moveTarget = this.aggroTargetToMoveTarget(resolved);
      const tpos = this.combatTargetPosition(resolved);
      const distance = this._terrorhawkHorizontalDistance(hawk.position, tpos);
      const profile = getMeleeProfile('terrorhawk');
      const attackRange = profile?.range ?? TERRORHAWK_MELEE_RANGE;

      if (distance > attackRange) {
        this._terrorhawkBeginTakeoff(hawk);
        return;
      }

      const lockUntil = this.meleeLockUntil.get(hawk.id) || 0;
      if (now < lockUntil) {
        this.tickMeleeSwingWindup(hawk, resolved);
        return;
      }

      if (tpos) this._smoothRotateEnemyTowardPoint(hawk, tpos, { instant: true });

      if (profile) {
        this.tryMeleeEngage(hawk, resolved, moveTarget, profile, { now, distance });
      }
      return;
    }
  }

  tryWyvernBreath(wyvern, resolved, distance, now) {
    if (!wyvern || wyvern.isDying || wyvern.health <= 0) return false;
    if (wyvern.breathActive) return false;
    if (this.room?.isEnemyAffectedBy(wyvern.id, 'freeze')) return false;
    if (this.room?.isEnemyAffectedBy(wyvern.id, 'stun')) return false;
    if (distance > WYVERN_BREATH_CAST_RANGE) return false;

    const last = this.wyvernBreathCooldown.get(wyvern.id) || 0;
    if (now - last < WYVERN_BREATH_COOLDOWN_MS) return false;

    this.startWyvernBreath(wyvern, resolved);
    return true;
  }

  startWyvernBreath(wyvern, resolved) {
    const now = Date.now();
    const wid = wyvern.id;
    if (wyvern.breathActive) return;

    // Clear any stale scheduled launches/end from a prior interrupted cast.
    const staleEnd = this.wyvernBreathEndTimeout.get(wid);
    if (staleEnd) clearTimeout(staleEnd);
    const staleLaunches = this.wyvernBreathLaunchTimeout.get(wid);
    if (staleLaunches) {
      for (const h of staleLaunches) clearTimeout(h);
      this.wyvernBreathLaunchTimeout.delete(wid);
    }

    wyvern.breathActive = true;
    this.wyvernBreathCooldown.set(wid, now);

    const breathVariant = wyvern.breathVariant === 2 ? 2 : 1;
    wyvern.breathVariant = breathVariant === 1 ? 2 : 1;
    const castLockMs = breathVariant === 2
      ? WYVERN_BREATH_ROAR_CAST_LOCK_MS
      : WYVERN_BREATH_CAST_LOCK_MS;
    this.meleeLockUntil.set(wid, now + castLockMs);

    const aimPos = this.combatTargetPosition(resolved);
    if (aimPos) {
      this._smoothRotateEnemyTowardPoint(wyvern, aimPos, { instant: true });
      if (this.io) this._queueMove(wyvern.id, wyvern.position, wyvern.rotation);
    }

    if (this.io) {
      this.io.to(this.roomId).emit('wyvern-breath-telegraph', {
        wyvernId: wid,
        breathVariant,
        durationMs: castLockMs,
        position: wyvern.position,
        timestamp: now,
      });
    }

    // Schedule firebolt launch early to sync with animation release point.
    // Capture breathVariant in closure — wyvern.breathVariant is already toggled for next cast.
    const launchAtMs = Math.max(0, castLockMs - WYVERN_BREATH_LAUNCH_EARLY_MS);
    const launchHandles = [];
    const roarVolleyId = now;
    wyvern.breathRoarVolleyId = roarVolleyId;

    if (breathVariant === 2) {
      const handle = this._scheduleTimeout(() => {
        if (!this.room?.getGameStarted()) return;
        const live = this.room?.getEnemy?.(wid);
        if (!live || live.isDying || live.health <= 0 || !live.breathActive) return;
        if (live.breathRoarVolleyId !== roarVolleyId) return;
        this.wyvernLaunchRoarFanVolley(live, resolved);
      }, launchAtMs);
      launchHandles.push(handle);
    } else {
      const handle = this._scheduleTimeout(() => {
        if (!this.room?.getGameStarted()) return;
        const live = this.room?.getEnemy?.(wid);
        if (live && !live.isDying && live.health > 0 && live.breathActive) {
          this.wyvernLaunchBreathFirebolt(live, resolved);
        }
      }, launchAtMs);
      launchHandles.push(handle);
    }
    this.wyvernBreathLaunchTimeout.set(wid, launchHandles);

    // After full cast lock: clear breath state for clients (movement unlock).
    const endHandle = this._scheduleTimeout(() => {
      this.wyvernBreathEndTimeout.delete(wid);
      this.endWyvernBreath(wid);
    }, castLockMs);
    this.wyvernBreathEndTimeout.set(wid, endHandle);

    _enemyAiLog(`🐉 Wyvern ${wid} casting breath weapon (variant ${breathVariant}, ${castLockMs}ms).`);
  }

  endWyvernBreath(wyvernId) {
    const endHandle = this.wyvernBreathEndTimeout.get(wyvernId);
    if (endHandle) {
      clearTimeout(endHandle);
      this.wyvernBreathEndTimeout.delete(wyvernId);
    }
    const launchHandles = this.wyvernBreathLaunchTimeout.get(wyvernId);
    if (launchHandles) {
      for (const h of launchHandles) clearTimeout(h);
      this.wyvernBreathLaunchTimeout.delete(wyvernId);
    }

    const wyvern = this.room?.getEnemy?.(wyvernId);
    if (wyvern) {
      wyvern.breathActive = false;
      wyvern.breathRoarVolleyId = null;
    }

    if (this.io) {
      this.io.to(this.roomId).emit('wyvern-breath-end', {
        wyvernId,
        timestamp: Date.now(),
      });
    }
  }

  /** Resolve live aim + muzzle start for a breath firebolt. Returns null if blocked/no target.
   *  When `maxRange` is set, endpoint is always start + dir * maxRange (not truncated to target). */
  _resolveBreathFireboltAim(enemy, resolved, muzzleYOffset, maxRange = null) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return null;
    if (!enemy?.position) return null;

    let targetPos = null;
    if (resolved.kind === 'player') {
      const players = this.room?.getPlayers();
      const liveTarget = players?.find(p => p.id === resolved.player.id);
      if (liveTarget && liveTarget.health > 0) targetPos = liveTarget.position;
    } else if (resolved.kind === 'zombie') {
      const liveZ = this.room?.getEnemy(resolved.zombie.id);
      if (liveZ && !liveZ.isDying && liveZ.health > 0) targetPos = liveZ.position;
    } else if (resolved.kind === 'hostile') {
      const liveH = this.room?.getEnemy(resolved.enemy.id);
      if (liveH && !liveH.isDying && liveH.health > 0) targetPos = liveH.position;
    } else if (resolved.kind === 'trap') {
      const liveT = this.room?.getEnemy(resolved.trap.id);
      if (liveT && !liveT.isDying && liveT.health > 0) targetPos = liveT.position;
    }
    if (!targetPos) targetPos = this.combatTargetPosition(resolved);
    if (!targetPos) return null;

    const dx = targetPos.x - enemy.position.x;
    const dz = targetPos.z - enemy.position.z;
    if (dx || dz) enemy.rotation = Math.atan2(dx, dz);
    this._queueMove(enemy.id, enemy.position, enemy.rotation);

    const start = { x: enemy.position.x, y: enemy.position.y + muzzleYOffset, z: enemy.position.z };
    const aimY = (targetPos.y ?? 0) + 1.0;
    const aimDx = targetPos.x - start.x;
    const aimDz = targetPos.z - start.z;
    const aimLen = Math.hypot(aimDx, aimDz) || 1;
    const baseDir = { x: aimDx / aimLen, z: aimDz / aimLen };
    const dirLen = maxRange != null && maxRange > 0 ? maxRange : aimLen;
    const target = {
      x: start.x + baseDir.x * dirLen,
      y: aimY,
      z: start.z + baseDir.z * dirLen,
    };
    return { start, target, dirLen, baseDir };
  }

  /** Fire all roar fan bolts in one tick (no stagger). Shares hit registry across bolts. */
  _launchRoarFanVolley(enemy, resolved, fanAngles, muzzleYOffset, onBolt, maxRange = null) {
    const aim = this._resolveBreathFireboltAim(enemy, resolved, muzzleYOffset, maxRange);
    if (!aim) return;
    const { start, target, dirLen, baseDir } = aim;
    const volleyTs = Date.now();
    // One hit per target across the entire fan (prevents multi-bolt stacking).
    const volleyHits = {
      players: new Set(),
      allies: new Set(),
      zombies: new Set(),
    };
    for (let fanIndex = 0; fanIndex < fanAngles.length; fanIndex++) {
      const fanDir = rotateXZDir(baseDir.x, baseDir.z, fanAngles[fanIndex]);
      const fanTarget = {
        x: start.x + fanDir.x * dirLen,
        y: target.y,
        z: start.z + fanDir.z * dirLen,
      };
      onBolt(enemy.id, start, fanTarget, fanIndex, volleyTs, volleyHits);
    }
  }

  /** Variant 2 (drake_roar): simultaneous 5-bolt fan. */
  wyvernLaunchRoarFanVolley(wyvern, resolved) {
    this._launchRoarFanVolley(
      wyvern,
      resolved,
      WYVERN_BREATH_ROAR_FAN_ANGLES_RAD,
      1.4,
      (wid, start, fanTarget, fanIndex, volleyTs, volleyHits) => {
        this._simulateWyvernBreathFirebolt(
          wid, start, fanTarget, `${wid}-roar-${fanIndex}-${volleyTs}`, 2, volleyHits,
        );
      },
      WYVERN_BREATH_MAX_RANGE,
    );
    _enemyAiLog(`🐉 Wyvern ${wyvern.id} roar fan volley (${WYVERN_BREATH_ROAR_FAN_ANGLES_RAD.length} bolts)`);
  }

  /** Variant 1 (drake_attack2): single non-homing firebolt — full max-range pierce. */
  wyvernLaunchBreathFirebolt(wyvern, resolved) {
    const aim = this._resolveBreathFireboltAim(wyvern, resolved, 1.4, WYVERN_BREATH_MAX_RANGE);
    if (!aim) return;
    this._simulateWyvernBreathFirebolt(
      wyvern.id, aim.start, aim.target, `${wyvern.id}-breath-${Date.now()}`, 1,
    );
  }

  /** Emit VFX + run authoritative straight-line pierce sim for one breath firebolt. */
  _simulateWyvernBreathFirebolt(wid, start, target, fireboltId, breathVariant = 1, volleyHits = null) {
    if (this.io) {
      this.io.to(this.roomId).emit('wyvern-breath-firebolt', {
        wyvernId: wid,
        fireboltId,
        breathVariant: breathVariant === 2 ? 2 : 1,
        startPosition: start,
        targetPosition: target,
        damage: WYVERN_BREATH_DAMAGE,
        timestamp: Date.now(),
      });
    }

    const dirLen = Math.hypot(target.x - start.x, target.z - start.z) || 1;
    const dir = { x: (target.x - start.x) / dirLen, z: (target.z - start.z) / dirLen };
    const pos = { x: start.x, z: start.z };
    const STEP_MS = 50;
    const maxSteps = Math.ceil((dirLen / GREED_FIREBALL_SPEED) * (1000 / STEP_MS)) + 4;
    let steps = 0;
    const hitRadiusSq = GREED_FIREBALL_HIT_RADIUS * GREED_FIREBALL_HIT_RADIUS;
    // Prefer shared volley registry so fan bolts don't multi-hit the same target.
    const hitPlayerIds = volleyHits?.players ?? new Set();
    const hitAllyIds = volleyHits?.allies ?? new Set();
    const hitZombieIds = volleyHits?.zombies ?? new Set();
    const hitMeta = { sourceEnemyId: wid, damageType: 'wyvern_breath' };
    const sx = start.x;
    const sz = start.z;

    const intervalId = setInterval(() => {
      if (!this.room?.getGameStarted()) {
        clearInterval(intervalId);
        this._removeEnemyHazardInterval(wid, intervalId);
        return;
      }
      steps++;
      pos.x += dir.x * GREED_FIREBALL_SPEED * (STEP_MS / 1000);
      pos.z += dir.z * GREED_FIREBALL_SPEED * (STEP_MS / 1000);

      const playerMap = this.room?.players;
      if (playerMap) {
        for (const p of playerMap.values()) {
          if (!p || p.health <= 0 || hitPlayerIds.has(p.id)) continue;
          const hdx = p.position.x - pos.x;
          const hdz = p.position.z - pos.z;
          if (hdx * hdx + hdz * hdz > hitRadiusSq) continue;
          hitPlayerIds.add(p.id);
          if (this.room?.isCoopCombatTransitionActive?.()) continue;
          const { wasKilled, persephoneTriggered, dodged, negationType, appliedDamage } =
            this.room._applyCoopPlayerIncomingDamage(p, WYVERN_BREATH_DAMAGE);
          if (persephoneTriggered) this.room._emitPersephoneTriggered(p.id, p);
          this.room._emitCoopIncomingDamageResult(p.id, p, {
            damage: appliedDamage,
            damageType: 'wyvern_breath',
            wasKilled,
            persephoneTriggered,
            dodged,
            negationType,
            meta: { sourceEnemyId: wid },
          });
          this.room._tryEmitCoopRoomWhisper?.();
        }
      }

      const segX = pos.x - sx;
      const segZ = pos.z - sz;
      this.damageAlliedUnitsAlongSpinStrip(
        sx,
        sz,
        segX,
        segZ,
        GREED_FIREBALL_HIT_RADIUS,
        WYVERN_BREATH_DAMAGE,
        hitMeta,
        hitAllyIds,
      );

      const enemyMap = this.room?.enemies;
      if (enemyMap) {
        for (const enemy of enemyMap.values()) {
          if (!enemy || enemy.isDying || enemy.health <= 0) continue;
          if (enemy.type !== 'player-zombie') continue;
          if (hitZombieIds.has(enemy.id)) continue;
          const hdx = (enemy.position?.x ?? 0) - pos.x;
          const hdz = (enemy.position?.z ?? 0) - pos.z;
          if (hdx * hdx + hdz * hdz > hitRadiusSq) continue;
          hitZombieIds.add(enemy.id);
          this.damagePlayerZombieFromMob(
            { id: wid }, enemy, WYVERN_BREATH_DAMAGE, 'wyvern_breath',
          );
        }
      }

      if (steps >= maxSteps) {
        clearInterval(intervalId);
        this._removeEnemyHazardInterval(wid, intervalId);
        const hitAny =
          hitPlayerIds.size > 0 || hitAllyIds.size > 0 || hitZombieIds.size > 0;
        this.io?.to(this.roomId).emit('wyvern-breath-impact', {
          wyvernId: wid,
          fireboltId,
          position: pos,
          hit: hitAny,
          timestamp: Date.now(),
        });
      }
    }, STEP_MS);
    this._addEnemyHazardInterval(wid, intervalId);
  }

  trySpectreWhirlwind(spectre, resolved, distance, now) {
    if (!spectre || spectre.isDying || spectre.health <= 0) return false;
    if (spectre.whirlwindActive) return false;
    if (this.room?.isEnemyAffectedBy(spectre.id, 'freeze')) return false;
    if (this.room?.isEnemyAffectedBy(spectre.id, 'stun')) return false;
    if (distance > SPECTRE_WHIRLWIND_CAST_RANGE) return false;

    const last = this.spectreWhirlwindCooldown.get(spectre.id) || 0;
    if (now - last < SPECTRE_WHIRLWIND_COOLDOWN_MS) return false;

    this.startSpectreWhirlwind(spectre);
    return true;
  }

  startSpectreWhirlwind(spectre) {
    const now = Date.now();
    const sid = spectre.id;
    spectre.whirlwindActive = true;
    this.spectreWhirlwindCooldown.set(sid, now);

    if (this.io) {
      this.io.to(this.roomId).emit('spectre-whirlwind-start', {
        spectreId: sid,
        position: spectre.position,
        durationMs: SPECTRE_WHIRLWIND_DURATION_MS,
        radius: SPECTRE_WHIRLWIND_RADIUS,
        timestamp: now,
      });
    }

    // Immediate first tick, then every 0.5s for the remaining window.
    this.applySpectreWhirlwindDamage(spectre);

    const intervalId = setInterval(() => {
      if (!this.room?.getGameStarted()) {
        clearInterval(intervalId);
        this._removeEnemyHazardInterval(sid, intervalId);
        return;
      }
      const live = this.room?.getEnemy?.(sid);
      if (!live || live.isDying || live.health <= 0 || !live.whirlwindActive) {
        clearInterval(intervalId);
        this._removeEnemyHazardInterval(sid, intervalId);
        return;
      }
      this.applySpectreWhirlwindDamage(live);
    }, SPECTRE_WHIRLWIND_TICK_MS);
    this._addEnemyHazardInterval(sid, intervalId);

    const endHandle = this._scheduleTimeout(() => {
      this.spectreWhirlwindEndTimeout.delete(sid);
      this.endSpectreWhirlwind(sid);
    }, SPECTRE_WHIRLWIND_DURATION_MS);
    this.spectreWhirlwindEndTimeout.set(sid, endHandle);

    _enemyAiLog(`👻 Spectre ${sid} entered Whirlwind.`);
  }

  applySpectreWhirlwindDamage(spectre) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    if (!spectre?.position) return;

    const center = spectre.position;
    const radius = SPECTRE_WHIRLWIND_RADIUS;
    const damage = SPECTRE_WHIRLWIND_DAMAGE;
    const meta = { sourceEnemyId: spectre.id, damageType: 'spectre_whirlwind' };

    this.room?.damagePlayersInHorizontalRing(center, radius, damage, 'spectre_whirlwind', meta);

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
        this.damagePlayerZombieFromMob(spectre, enemy, damage, 'spectre_whirlwind');
      }
    }
  }

  endSpectreWhirlwind(spectreId) {
    const endHandle = this.spectreWhirlwindEndTimeout.get(spectreId);
    if (endHandle) {
      clearTimeout(endHandle);
      this.spectreWhirlwindEndTimeout.delete(spectreId);
    }
    this._clearEnemyHazardIntervals(spectreId);

    const spectre = this.room?.getEnemy?.(spectreId);
    if (spectre) {
      spectre.whirlwindActive = false;
    }

    if (this.io) {
      this.io.to(this.roomId).emit('spectre-whirlwind-end', {
        spectreId,
        timestamp: Date.now(),
      });
    }
  }

  telegraphSpectreAttack(spectre, player, attackVariant = 1) {
    if (this.io) {
      this.io.to(this.roomId).emit('spectre-attack-telegraph', {
        spectreId: spectre.id,
        ...this._meleeTelegraphTargetFields(player),
        attackVariant: attackVariant === 2 ? 2 : 1,
        position: spectre.position,
        timestamp: Date.now(),
      });
    }
    _enemyAiLog(`👻 Spectre ${spectre.id} telegraphing attack at ${player.id}!`);
  }

  spectreAttackPlayer(spectre, player) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    const damage = spectre.damage || 45;
    this.recordAlliedProtectionThreat(spectre.id, player.id, damage);

    if (this.io) {
      this.io.to(this.roomId).emit('spectre-attack', {
        spectreId: spectre.id,
        targetPlayerId: player.id,
        damage,
        position: spectre.position,
        timestamp: Date.now(),
      });
    }

    _enemyAiLog(`👻 Spectre ${spectre.id} attacked player ${player.id} for ${damage} damage!`);

    this.room?.tryDamageAlliedKnightInXZDisk(
      { x: spectre.position.x, z: spectre.position.z },
      2.6,
      damage,
      { sourceEnemyId: spectre.id, damageType: 'spectre_melee' },
    );
  }

  updateDeathKnightAI(deathKnight, players) {
    let aggroData = this.enemyAggro.get(deathKnight.id);
    if (!aggroData) {
      const closest = this.findClosestCombatantForSpectre(deathKnight, players, DEATH_KNIGHT_AGGRO_RADIUS);
      if (!closest) return;
      aggroData = {
        targetPlayerId: closest.kind === 'player' ? closest.player.id : null,
        targetZombieId: null,
        targetTrapId: null,
        targetHostileEnemyId: closest.kind === 'hostile' ? closest.enemy.id : null,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(deathKnight.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, deathKnight, players);
    if (!resolved) return;

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(deathKnight.position, tpos);
    const aggroRadius = DEATH_KNIGHT_AGGRO_RADIUS;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);
    const losOk = this.hasLineOfSight(deathKnight.position, tpos);

    if (!aggroData.isAggroed && distance <= aggroRadius && losOk) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }
    this._maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius);

    if (!aggroData.isAggroed) return;

    const now = Date.now();

    // While Frost Pillars cast is active: hold position.
    if (deathKnight.frostPillarsActive) return;

    // While Heartstrike is active: hold position (single swing, not a channel).
    if (deathKnight.heartstrikeActive) return;

    if (this.tryDeathKnightFrostPillars(deathKnight, resolved, distance, now)) return;

    if (this.tryDeathKnightHeartstrike(deathKnight, resolved, distance, now)) return;

    const lockUntil = this.meleeLockUntil.get(deathKnight.id) || 0;
    if (now < lockUntil) {
      this.tickMeleeSwingWindup(deathKnight, resolved);
      return;
    }

    const profile = getMeleeProfile('death-knight');
    this.tryMeleeEngage(deathKnight, resolved, moveTarget, profile, { now, distance });
  }

  tryDeathKnightFrostPillars(deathKnight, resolved, distance, now) {
    if (!deathKnight || deathKnight.isDying || deathKnight.health <= 0) return false;
    if (deathKnight.frostPillarsActive || deathKnight.heartstrikeActive) return false;
    if (this.room?.isEnemyAffectedBy(deathKnight.id, 'freeze')) return false;
    if (this.room?.isEnemyAffectedBy(deathKnight.id, 'stun')) return false;
    if (distance > DEATH_KNIGHT_FROST_PILLARS_CAST_RANGE) return false;

    const last = this.deathKnightFrostPillarsCooldown.get(deathKnight.id) || 0;
    if (now - last < DEATH_KNIGHT_FROST_PILLARS_COOLDOWN_MS) return false;

    this.startDeathKnightFrostPillars(deathKnight, resolved);
    return true;
  }

  clearDeathKnightFrostPillarTimers(deathKnightId) {
    const arr = this.deathKnightFrostPillarTimeouts.get(deathKnightId);
    if (arr) {
      for (const h of arr) clearTimeout(h);
    }
    this.deathKnightFrostPillarTimeouts.delete(deathKnightId);
  }

  addDeathKnightFrostPillarTimeout(deathKnightId, handle) {
    const arr = this.deathKnightFrostPillarTimeouts.get(deathKnightId) || [];
    arr.push(handle);
    this.deathKnightFrostPillarTimeouts.set(deathKnightId, arr);
  }

  startDeathKnightFrostPillars(deathKnight, resolved) {
    const now = Date.now();
    const sid = deathKnight.id;
    if (deathKnight.frostPillarsActive) return;

    const staleEnd = this.deathKnightFrostPillarsEndTimeout.get(sid);
    if (staleEnd) clearTimeout(staleEnd);
    this.clearDeathKnightFrostPillarTimers(sid);

    deathKnight.frostPillarsActive = true;
    this.deathKnightFrostPillarsCooldown.set(sid, now);
    this.meleeLockUntil.set(sid, now + DEATH_KNIGHT_FROST_PILLARS_CAST_MS);

    const aimPos = this.combatTargetPosition(resolved);
    if (aimPos) {
      this._smoothRotateEnemyTowardPoint(deathKnight, aimPos, { instant: true });
      if (this.io) this._queueMove(deathKnight.id, deathKnight.position, deathKnight.rotation);
    }

    if (this.io) {
      this.io.to(this.roomId).emit('death-knight-frost-pillars-telegraph', {
        deathKnightId: sid,
        durationMs: DEATH_KNIGHT_FROST_PILLARS_CAST_MS,
        position: deathKnight.position,
        timestamp: now,
      });
    }

    const r = deathKnight.rotation || 0;
    const fx = Math.sin(r);
    const fz = Math.cos(r);
    const py = deathKnight.position.y ?? 0;
    const ox = deathKnight.position.x;
    const oz = deathKnight.position.z;
    const frostCastId = now;
    deathKnight.frostPillarsCastId = frostCastId;

    const erupt = (center) => {
      const live = this.room?.getEnemy?.(sid);
      if (!this.room?.getGameStarted() || !live || live.isDying || live.health <= 0) return;
      if (live.type !== 'death-knight' || live.frostPillarsCastId !== frostCastId) return;
      if (this.io) {
        this.io.to(this.roomId).emit('death-knight-frost-pillar', {
          deathKnightId: sid,
          position: { x: center.x, y: center.y, z: center.z },
          timestamp: Date.now(),
        });
      }
      this.room.damagePlayersInHorizontalRing(
        center,
        DEATH_KNIGHT_FROST_PILLARS_RADIUS,
        DEATH_KNIGHT_FROST_PILLARS_DAMAGE,
        'death_knight_frost_pillar',
      );
    };

    for (let i = 0; i < DEATH_KNIGHT_FROST_PILLARS_COUNT; i++) {
      const dist = DEATH_KNIGHT_FROST_PILLARS_BASE_OFFSET + i * DEATH_KNIGHT_FROST_PILLARS_STEP;
      const delay = DEATH_KNIGHT_FROST_PILLARS_CAST_MS + i * DEATH_KNIGHT_FROST_PILLARS_STAGGER_MS;
      const center = {
        x: ox + fx * dist,
        y: py,
        z: oz + fz * dist,
      };
      const h = this._scheduleTimeout(() => erupt(center), delay);
      this.addDeathKnightFrostPillarTimeout(sid, h);
    }

    const endHandle = this._scheduleTimeout(() => {
      this.deathKnightFrostPillarsEndTimeout.delete(sid);
      this.endDeathKnightFrostPillars(sid);
    }, DEATH_KNIGHT_FROST_PILLARS_CAST_MS);
    this.deathKnightFrostPillarsEndTimeout.set(sid, endHandle);

    _enemyAiLog(`❄️ Death Knight ${sid} cast Frost Pillars.`);
  }

  endDeathKnightFrostPillars(deathKnightId) {
    const live = this.room?.getEnemy?.(deathKnightId);
    if (live) live.frostPillarsActive = false;
    if (this.io) {
      this.io.to(this.roomId).emit('death-knight-frost-pillars-end', {
        deathKnightId,
        timestamp: Date.now(),
      });
    }
  }

  tryDeathKnightHeartstrike(deathKnight, resolved, distance, now) {
    if (!deathKnight || deathKnight.isDying || deathKnight.health <= 0) return false;
    if (deathKnight.heartstrikeActive) return false;
    if (this.room?.isEnemyAffectedBy(deathKnight.id, 'freeze')) return false;
    if (this.room?.isEnemyAffectedBy(deathKnight.id, 'stun')) return false;
    if (distance > DEATH_KNIGHT_HEARTSTRIKE_CAST_RANGE) return false;

    const last = this.deathKnightHeartstrikeCooldown.get(deathKnight.id) || 0;
    if (now - last < DEATH_KNIGHT_HEARTSTRIKE_COOLDOWN_MS) return false;

    this.startDeathKnightHeartstrike(deathKnight);
    return true;
  }

  startDeathKnightHeartstrike(deathKnight) {
    const now = Date.now();
    const sid = deathKnight.id;
    deathKnight.heartstrikeActive = true;
    this.deathKnightHeartstrikeCooldown.set(sid, now);
    this.meleeLockUntil.set(sid, now + DEATH_KNIGHT_SWING_LOCK_MS);

    const heartstrikeVariant = deathKnight.heartstrikeVariant === 2 ? 2 : 1;
    deathKnight.heartstrikeVariant = heartstrikeVariant === 1 ? 2 : 1;

    if (this.io) {
      this.io.to(this.roomId).emit('death-knight-heartstrike-telegraph', {
        deathKnightId: sid,
        heartstrikeVariant,
        position: deathKnight.position,
        timestamp: now,
      });
    }

    this._scheduleTimeout(() => {
      if (!this.room?.getGameStarted()) return;
      const live = this.room?.getEnemy?.(sid);
      if (!live || live.isDying || live.health <= 0 || !live.heartstrikeActive) return;
      this.applyDeathKnightHeartstrikeDamage(live);
    }, DEATH_KNIGHT_HIT_DELAY_MS);

    const endHandle = this._scheduleTimeout(() => {
      this.deathKnightHeartstrikeEndTimeout.delete(sid);
      this.endDeathKnightHeartstrike(sid);
    }, DEATH_KNIGHT_SWING_LOCK_MS);
    this.deathKnightHeartstrikeEndTimeout.set(sid, endHandle);

    _enemyAiLog(`💀 Death Knight ${sid} cast Heartstrike (variant ${heartstrikeVariant}).`);
  }

  applyDeathKnightHeartstrikeDamage(deathKnight) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    if (!deathKnight?.position) return;

    const ox = deathKnight.position.x;
    const oz = deathKnight.position.z;
    const facing = deathKnight.rotation ?? 0;
    const range = DEATH_KNIGHT_HEARTSTRIKE_RANGE;
    const halfAngle = DEATH_KNIGHT_HEARTSTRIKE_HALF_ANGLE_RAD;
    const damage = DEATH_KNIGHT_HEARTSTRIKE_DAMAGE;
    const meta = { sourceEnemyId: deathKnight.id, damageType: 'death_knight_heartstrike' };

    this.room?.damagePlayersInCone?.(
      ox, oz, facing, range, halfAngle, damage, 'death_knight_heartstrike', meta,
    );

    this.room?.tryDamageAlliedUnitsInCone?.(
      ox, oz, facing, range, halfAngle, damage, meta,
    );

    // Player-zombies in the same frontal cone
    const fwdX = Math.sin(facing);
    const fwdZ = Math.cos(facing);
    const cosHalf = Math.cos(halfAngle);
    const enemies = this.room?.getEnemies?.() || [];
    for (const enemy of enemies) {
      if (!enemy || enemy.isDying || enemy.health <= 0) continue;
      if (enemy.type !== 'player-zombie') continue;
      const dx = (enemy.position?.x ?? 0) - ox;
      const dz = (enemy.position?.z ?? 0) - oz;
      const dist = Math.hypot(dx, dz);
      if (dist <= 0 || dist > range) continue;
      const dot = (dx * fwdX + dz * fwdZ) / dist;
      if (dot < cosHalf) continue;
      this.damagePlayerZombieFromMob(deathKnight, enemy, damage, 'death_knight_heartstrike');
    }
  }

  endDeathKnightHeartstrike(deathKnightId) {
    const endHandle = this.deathKnightHeartstrikeEndTimeout.get(deathKnightId);
    if (endHandle) {
      clearTimeout(endHandle);
      this.deathKnightHeartstrikeEndTimeout.delete(deathKnightId);
    }

    const deathKnight = this.room?.getEnemy?.(deathKnightId);
    if (deathKnight) {
      deathKnight.heartstrikeActive = false;
    }

    if (this.io) {
      this.io.to(this.roomId).emit('death-knight-heartstrike-end', {
        deathKnightId,
        timestamp: Date.now(),
      });
    }
  }

  telegraphDeathKnightAttack(deathKnight, player, attackVariant = 1) {
    if (this.io) {
      this.io.to(this.roomId).emit('death-knight-attack-telegraph', {
        deathKnightId: deathKnight.id,
        ...this._meleeTelegraphTargetFields(player),
        attackVariant: attackVariant === 2 ? 2 : 1,
        position: deathKnight.position,
        timestamp: Date.now(),
      });
    }
    _enemyAiLog(`💀 Death Knight ${deathKnight.id} telegraphing attack at ${player.id}!`);
  }

  deathKnightAttackPlayer(deathKnight, player) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    const damage = deathKnight.damage || DEATH_KNIGHT_BASE_DAMAGE;
    this.recordAlliedProtectionThreat(deathKnight.id, player.id, damage);

    if (this.io) {
      this.io.to(this.roomId).emit('death-knight-attack', {
        deathKnightId: deathKnight.id,
        targetPlayerId: player.id,
        damage,
        position: deathKnight.position,
        timestamp: Date.now(),
      });
    }

    _enemyAiLog(`💀 Death Knight ${deathKnight.id} attacked player ${player.id} for ${damage} damage!`);

    this.room?.tryDamageAlliedKnightInXZDisk(
      { x: deathKnight.position.x, z: deathKnight.position.z },
      2.6,
      damage,
      { sourceEnemyId: deathKnight.id, damageType: 'death_knight_melee' },
    );
  }

  updateShamanAI(shaman, players) {
    let aggroData = this.enemyAggro.get(shaman.id);
    if (!aggroData) {
      const closest = this.findClosestCombatantForSpectre(shaman, players, SHAMAN_AGGRO_RADIUS);
      if (!closest) return;
      aggroData = {
        targetPlayerId: closest.kind === 'player' ? closest.player.id : null,
        targetZombieId: null,
        targetTrapId: null,
        targetHostileEnemyId: closest.kind === 'hostile' ? closest.enemy.id : null,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(shaman.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, shaman, players);
    if (!resolved) return;

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(shaman.position, tpos);
    const aggroRadius = SHAMAN_AGGRO_RADIUS;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);
    const losOk = this.hasLineOfSight(shaman.position, tpos);

    if (!aggroData.isAggroed && distance <= aggroRadius && losOk) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }
    this._maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius);

    if (!aggroData.isAggroed) return;

    const now = Date.now();

    // While Storm Shock is active: hold position (single cast, not a channel).
    if (shaman.stormShockActive) return;

    if (this.tryShamanStormShock(shaman, resolved, distance, now)) return;
    if (this.tryShamanSpiritWolves(shaman, now)) return;

    const lockUntil = this.meleeLockUntil.get(shaman.id) || 0;
    if (now < lockUntil) {
      this.tickMeleeSwingWindup(shaman, resolved);
      return;
    }

    const profile = getMeleeProfile('shaman');
    this.tryMeleeEngage(shaman, resolved, moveTarget, profile, { now, distance });
  }

  tryShamanStormShock(shaman, resolved, distance, now) {
    if (!shaman || shaman.isDying || shaman.health <= 0) return false;
    if (shaman.stormShockActive) return false;
    if (this.room?.isEnemyAffectedBy(shaman.id, 'freeze')) return false;
    if (this.room?.isEnemyAffectedBy(shaman.id, 'stun')) return false;
    if (distance > SHAMAN_STORM_SHOCK_CAST_RANGE) return false;

    const last = this.shamanStormShockCooldown.get(shaman.id) || 0;
    if (now - last < SHAMAN_STORM_SHOCK_COOLDOWN_MS) return false;

    this.startShamanStormShock(shaman, resolved);
    return true;
  }

  getShamanActiveWolfCount(shamanId) {
    let set = this.shamanSummonedWolves.get(shamanId);
    if (!set) {
      set = new Set();
      this.shamanSummonedWolves.set(shamanId, set);
      return 0;
    }
    for (const wolfId of [...set]) {
      const wolf = this.room?.getEnemy?.(wolfId);
      if (!wolf || wolf.isDying || wolf.health <= 0 || wolf.type !== 'wolf') {
        set.delete(wolfId);
      }
    }
    return set.size;
  }

  tryShamanSpiritWolves(shaman, now) {
    if (!shaman || shaman.isDying || shaman.health <= 0) return false;
    if (shaman.stormShockActive) return false;
    if (this.room?.isEnemyAffectedBy(shaman.id, 'freeze')) return false;
    if (this.room?.isEnemyAffectedBy(shaman.id, 'stun')) return false;

    const active = this.getShamanActiveWolfCount(shaman.id);
    if (active >= SHAMAN_SPIRIT_WOLVES_MAX_ACTIVE) return false;

    const last = this.shamanSpiritWolvesCooldown.get(shaman.id) || 0;
    if (now - last < SHAMAN_SPIRIT_WOLVES_COOLDOWN_MS) return false;

    this.castShamanSpiritWolves(shaman);
    return true;
  }

  castShamanSpiritWolves(shaman) {
    if (!this.room || !shaman) return;

    const now = Date.now();
    const sid = shaman.id;
    this.shamanSpiritWolvesCooldown.set(sid, now);
    this.meleeLockUntil.set(sid, now + SHAMAN_SPIRIT_WOLVES_CAST_LOCK_MS);
    this.enemyPaths.delete(sid);

    if (this.io) {
      this._queueMoveIfChanged(sid, shaman.position, shaman.rotation);
      this.io.to(this.roomId).emit('shaman-spirit-wolves-cast', {
        shamanId: sid,
        position: { ...shaman.position },
        durationMs: SHAMAN_SPIRIT_WOLVES_CAST_LOCK_MS,
        timestamp: now,
      });
    }
    _enemyAiLog(`🐺 Shaman ${sid} casting Spirit Wolves…`);

    const prevSpawn = this.shamanSpiritWolvesSpawnTimeout.get(sid);
    if (prevSpawn) clearTimeout(prevSpawn);

    const spawnHandle = this._scheduleTimeout(() => {
      this.shamanSpiritWolvesSpawnTimeout.delete(sid);
      if (!this.room?.getGameStarted()) return;
      const live = this.room?.getEnemy?.(sid);
      if (!live || live.isDying || live.health <= 0 || live.type !== 'shaman') return;

      const active = this.getShamanActiveWolfCount(sid);
      const slots = Math.min(2, SHAMAN_SPIRIT_WOLVES_MAX_ACTIVE - active);
      if (slots <= 0) return;

      const rot = live.rotation || 0;
      // Perpendicular flanks relative to facing (sin/cos convention used elsewhere).
      const rightX = Math.cos(rot);
      const rightZ = -Math.sin(rot);
      const sides = slots === 1
        ? [1]
        : [-1, 1];

      let set = this.shamanSummonedWolves.get(sid);
      if (!set) {
        set = new Set();
        this.shamanSummonedWolves.set(sid, set);
      }

      for (let i = 0; i < sides.length; i++) {
        const sign = sides[i];
        const rawX = live.position.x + rightX * SHAMAN_SPIRIT_WOLVES_SIDE_OFFSET * sign;
        const rawZ = live.position.z + rightZ * SHAMAN_SPIRIT_WOLVES_SIDE_OFFSET * sign;
        const clamped = this.clampToArenaXZ(rawX, rawZ);
        const resolved = this.resolveEnemyWallCollisions(clamped.x, clamped.z);
        const spawnPos = { x: resolved.x, y: 0, z: resolved.z };
        const wolfId = `spirit-wolf-${sid}-${Date.now()}-${i}`;
        const wolf = {
          id: wolfId,
          type: 'wolf',
          position: { ...spawnPos },
          rotation: rotationYTowardEntry(spawnPos.x, spawnPos.z),
          health: SHAMAN_SPIRIT_WOLF_HP,
          maxHealth: SHAMAN_SPIRIT_WOLF_HP,
          isDying: false,
          damage: SHAMAN_SPIRIT_WOLF_DAMAGE,
          attackCooldown: 850,
          moveSpeed: WOLF_MOVE_SPEED,
          soulType: live.soulType || null,
          campType: live.campType || null,
          attackVariant: 1,
          staggerBuildup: 0,
          howlStartsAt: Date.now(),
          howlEndsAt: Date.now(), // skip intro howl — combat ready immediately
          spawnedAt: Date.now(),
          summonerId: sid,
        };

        set.add(wolfId);
        this.room.addEnemy(wolf);
        if (this.io) {
          this.io.to(this.roomId).emit('enemy-spawned', {
            enemy: wolf,
            timestamp: Date.now(),
          });
        }
        this.room._emitEnemySummonVfx?.(wolf);
        _enemyAiLog(`🐺 Shaman ${sid} summoned spirit wolf ${wolfId}`);
      }
    }, SHAMAN_SPIRIT_WOLVES_WINDUP_MS);
    this.shamanSpiritWolvesSpawnTimeout.set(sid, spawnHandle);
  }

  startShamanStormShock(shaman, resolved) {
    const now = Date.now();
    const sid = shaman.id;
    shaman.stormShockActive = true;
    this.shamanStormShockCooldown.set(sid, now);
    this.meleeLockUntil.set(sid, now + SHAMAN_STORM_SHOCK_CAST_LOCK_MS);

    const aimPos = this.combatTargetPosition(resolved);
    if (aimPos) {
      this._smoothRotateEnemyTowardPoint(shaman, aimPos, { instant: true });
      if (this.io) this._queueMove(shaman.id, shaman.position, shaman.rotation);
    }

    const targetId = resolved.kind === 'player'
      ? resolved.player.id
      : resolved.kind === 'zombie'
        ? (resolved.zombie.ownerPlayerId || resolved.zombie.id)
        : resolved.kind === 'hostile'
          ? resolved.enemy.id
          : resolved.trap?.id;

    if (this.io) {
      this.io.to(this.roomId).emit('shaman-storm-shock-telegraph', {
        shamanId: sid,
        targetPlayerId: targetId,
        position: shaman.position,
        durationMs: SHAMAN_STORM_SHOCK_CAST_LOCK_MS,
        timestamp: now,
      });
    }

    const zapHandle = this._scheduleTimeout(() => {
      this.shamanStormShockZapTimeout.delete(sid);
      if (!this.room?.getGameStarted()) return;
      const live = this.room?.getEnemy?.(sid);
      if (!live || live.isDying || live.health <= 0 || !live.stormShockActive) return;
      this.applyShamanStormShock(live, resolved);
    }, SHAMAN_STORM_SHOCK_WINDUP_MS);
    this.shamanStormShockZapTimeout.set(sid, zapHandle);

    const endHandle = this._scheduleTimeout(() => {
      this.shamanStormShockEndTimeout.delete(sid);
      this.endShamanStormShock(sid);
    }, SHAMAN_STORM_SHOCK_CAST_LOCK_MS);
    this.shamanStormShockEndTimeout.set(sid, endHandle);

    _enemyAiLog(`⚡ Shaman ${sid} cast Storm Shock.`);
  }

  applyShamanStormShock(shaman, resolved) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    if (!shaman?.position) return;

    // Re-resolve aim toward live target when possible
    let aimPos = null;
    if (resolved.kind === 'player') {
      const players = this.room?.getPlayers();
      const liveTarget = players?.find(p => p.id === resolved.player.id);
      if (liveTarget && liveTarget.health > 0) aimPos = liveTarget.position;
    } else if (resolved.kind === 'zombie') {
      const liveZ = this.room?.getEnemy(resolved.zombie.id);
      if (liveZ && !liveZ.isDying && liveZ.health > 0) aimPos = liveZ.position;
    } else if (resolved.kind === 'hostile') {
      const liveH = this.room?.getEnemy(resolved.enemy.id);
      if (liveH && !liveH.isDying && liveH.health > 0) aimPos = liveH.position;
    } else if (resolved.kind === 'trap') {
      const liveT = this.room?.getEnemy(resolved.trap.id);
      if (liveT && !liveT.isDying && liveT.health > 0) aimPos = liveT.position;
    }
    if (!aimPos) aimPos = this.combatTargetPosition(resolved);
    if (!aimPos) return;

    this._smoothRotateEnemyTowardPoint(shaman, aimPos, { instant: true });
    if (this.io) {
      this._queueMove(shaman.id, shaman.position, shaman.rotation);
      this._flushMoves();
    }

    const ax = shaman.position.x;
    const az = shaman.position.z;
    const dx = aimPos.x - ax;
    const dz = aimPos.z - az;
    const dist = Math.hypot(dx, dz) || 1;
    const ux = dx / dist;
    const uz = dz / dist;
    const reach = Math.min(dist, SHAMAN_STORM_SHOCK_RANGE);
    const bx = ax + ux * reach;
    const bz = az + uz * reach;
    const BEAM_Y = shaman.position.y + 1.1;
    const strikeAt = Date.now();
    const beams = [
      {
        startPosition: { x: ax, y: BEAM_Y, z: az },
        targetPosition: { x: bx, y: BEAM_Y, z: bz },
      },
    ];

    if (this.io) {
      this.io.to(this.roomId).emit('shaman-storm-shock-zap', {
        shamanId: shaman.id,
        beams,
        strikeAt,
        halfWidth: SHAMAN_STORM_SHOCK_HALF_WIDTH,
        damage: SHAMAN_STORM_SHOCK_DAMAGE,
        timestamp: strikeAt,
      });
    }

    this.room?.damagePlayersInLineSegment(
      ax,
      az,
      bx,
      bz,
      SHAMAN_STORM_SHOCK_HALF_WIDTH,
      SHAMAN_STORM_SHOCK_DAMAGE,
      'shaman_storm_shock',
      { sourceEnemyId: shaman.id },
    );
    const halfWidthSq = SHAMAN_STORM_SHOCK_HALF_WIDTH * SHAMAN_STORM_SHOCK_HALF_WIDTH;
    this.damageAlliedUnitsAlongSegmentXZ(
      ax,
      az,
      bx,
      bz,
      halfWidthSq,
      SHAMAN_STORM_SHOCK_DAMAGE,
      { sourceEnemyId: shaman.id, damageType: 'shaman_storm_shock' },
    );

    // Player-zombies along the same horizontal segment
    const enemies = this.room?.getEnemies?.() || [];
    for (const enemy of enemies) {
      if (!enemy || enemy.isDying || enemy.health <= 0) continue;
      if (enemy.type !== 'player-zombie') continue;
      const ex = enemy.position?.x ?? 0;
      const ez = enemy.position?.z ?? 0;
      if (distPointSegmentSqXZ(ex, ez, ax, az, bx, bz) > halfWidthSq) continue;
      this.damagePlayerZombieFromMob(shaman, enemy, SHAMAN_STORM_SHOCK_DAMAGE, 'shaman_storm_shock');
    }
  }

  endShamanStormShock(shamanId) {
    const endHandle = this.shamanStormShockEndTimeout.get(shamanId);
    if (endHandle) {
      clearTimeout(endHandle);
      this.shamanStormShockEndTimeout.delete(shamanId);
    }
    const zapHandle = this.shamanStormShockZapTimeout.get(shamanId);
    if (zapHandle) {
      clearTimeout(zapHandle);
      this.shamanStormShockZapTimeout.delete(shamanId);
    }

    const shaman = this.room?.getEnemy?.(shamanId);
    if (shaman) {
      shaman.stormShockActive = false;
    }

    if (this.io) {
      this.io.to(this.roomId).emit('shaman-storm-shock-end', {
        shamanId,
        timestamp: Date.now(),
      });
    }
  }

  telegraphShamanAttack(shaman, player) {
    if (this.io) {
      this.io.to(this.roomId).emit('shaman-attack-telegraph', {
        shamanId: shaman.id,
        ...this._meleeTelegraphTargetFields(player),
        attackVariant: 1,
        position: shaman.position,
        timestamp: Date.now(),
      });
    }
    _enemyAiLog(`⚡ Shaman ${shaman.id} telegraphing attack at ${player.id}!`);
  }

  shamanAttackPlayer(shaman, player) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    const damage = shaman.damage || SHAMAN_BASE_DAMAGE;
    this.recordAlliedProtectionThreat(shaman.id, player.id, damage);

    if (this.io) {
      this.io.to(this.roomId).emit('shaman-attack', {
        shamanId: shaman.id,
        targetPlayerId: player.id,
        damage,
        position: shaman.position,
        timestamp: Date.now(),
      });
    }

    _enemyAiLog(`⚡ Shaman ${shaman.id} attacked player ${player.id} for ${damage} damage!`);

    this.room?.tryDamageAlliedKnightInXZDisk(
      { x: shaman.position.x, z: shaman.position.z },
      2.6,
      damage,
      { sourceEnemyId: shaman.id, damageType: 'shaman_melee' },
    );
  }

  telegraphSerpentAttack(serpent, player, attackVariant = 1) {
    if (this.io) {
      this.io.to(this.roomId).emit('serpent-attack-telegraph', {
        serpentId: serpent.id,
        ...this._meleeTelegraphTargetFields(player),
        attackVariant: attackVariant === 2 ? 2 : 1,
        position: serpent.position,
        timestamp: Date.now(),
      });
    }
    _enemyAiLog(`🐍 Serpent ${serpent.id} telegraphing attack at ${player.id}!`);
  }

  serpentAttackPlayer(serpent, player) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    const damage = serpent.damage || SERPENT_BASE_DAMAGE;
    this.recordAlliedProtectionThreat(serpent.id, player.id, damage);

    if (this.io) {
      this.io.to(this.roomId).emit('serpent-attack', {
        serpentId: serpent.id,
        targetPlayerId: player.id,
        damage,
        position: serpent.position,
        timestamp: Date.now(),
      });
    }
    this.maybeEmitBeastMeleeHitSfx(serpent);

    _enemyAiLog(`🐍 Serpent ${serpent.id} attacked player ${player.id} for ${damage} damage!`);

    this.room?.tryDamageAlliedKnightInXZDisk(
      { x: serpent.position.x, z: serpent.position.z },
      2.4,
      damage,
      { sourceEnemyId: serpent.id, damageType: 'serpent_melee' },
    );
  }

  telegraphWolfAttack(wolf, player, attackVariant = 1) {
    if (this.io) {
      this.io.to(this.roomId).emit('wolf-attack-telegraph', {
        wolfId: wolf.id,
        ...this._meleeTelegraphTargetFields(player),
        attackVariant: attackVariant === 2 ? 2 : 1,
        position: wolf.position,
        timestamp: Date.now(),
      });
    }
  }

  wolfAttackPlayer(wolf, player) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    const damage = wolf.damage || WOLF_BASE_DAMAGE;
    this.recordAlliedProtectionThreat(wolf.id, player.id, damage);

    if (this.io) {
      this.io.to(this.roomId).emit('wolf-attack', {
        wolfId: wolf.id,
        targetPlayerId: player.id,
        damage,
        position: wolf.position,
        timestamp: Date.now(),
      });
    }
    this.maybeEmitBeastMeleeHitSfx(wolf);

    this.room?.tryDamageAlliedKnightInXZDisk(
      { x: wolf.position.x, z: wolf.position.z },
      2.4,
      damage,
      { sourceEnemyId: wolf.id, damageType: 'wolf_melee' },
    );
  }

  telegraphBearAttack(bear, player, attackVariant = 1) {
    if (this.io) {
      this.io.to(this.roomId).emit('bear-attack-telegraph', {
        bearId: bear.id,
        ...this._meleeTelegraphTargetFields(player),
        attackVariant: attackVariant === 2 ? 2 : 1,
        position: bear.position,
        timestamp: Date.now(),
      });
    }
  }

  bearAttackPlayer(bear, player) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    const damage = bear.damage || BEAR_BASE_DAMAGE;
    this.recordAlliedProtectionThreat(bear.id, player.id, damage);

    if (this.io) {
      this.io.to(this.roomId).emit('bear-attack', {
        bearId: bear.id,
        targetPlayerId: player.id,
        damage,
        position: bear.position,
        timestamp: Date.now(),
      });
    }
    this.maybeEmitBeastMeleeHitSfx(bear);

    this.room?.tryDamageAlliedKnightInXZDisk(
      { x: bear.position.x, z: bear.position.z },
      2.6,
      damage,
      { sourceEnemyId: bear.id, damageType: 'bear_melee' },
    );
  }

  telegraphTigerAttack(tiger, player, attackVariant = 1) {
    if (this.io) {
      this.io.to(this.roomId).emit('tiger-attack-telegraph', {
        tigerId: tiger.id,
        ...this._meleeTelegraphTargetFields(player),
        attackVariant: attackVariant === 2 ? 2 : 1,
        position: tiger.position,
        timestamp: Date.now(),
      });
    }
  }

  tigerAttackPlayer(tiger, player) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    const damage = tiger.damage || TIGER_BASE_DAMAGE;
    this.recordAlliedProtectionThreat(tiger.id, player.id, damage);

    if (this.io) {
      this.io.to(this.roomId).emit('tiger-attack', {
        tigerId: tiger.id,
        targetPlayerId: player.id,
        damage,
        position: tiger.position,
        timestamp: Date.now(),
      });
    }
    this.maybeEmitBeastMeleeHitSfx(tiger);

    this.room?.tryDamageAlliedKnightInXZDisk(
      { x: tiger.position.x, z: tiger.position.z },
      2.5,
      damage,
      { sourceEnemyId: tiger.id, damageType: 'tiger_melee' },
    );
  }

  telegraphSkyrayAttack(skyray, player, attackVariant = 1) {
    if (this.io) {
      this.io.to(this.roomId).emit('skyray-attack-telegraph', {
        skyrayId: skyray.id,
        ...this._meleeTelegraphTargetFields(player),
        attackVariant: attackVariant === 2 ? 2 : 1,
        position: skyray.position,
        timestamp: Date.now(),
      });
    }
  }

  skyrayAttackPlayer(skyray, player) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    const damage = skyray.damage || SKYRAY_BASE_DAMAGE;
    this.recordAlliedProtectionThreat(skyray.id, player.id, damage);

    if (this.io) {
      this.io.to(this.roomId).emit('skyray-attack', {
        skyrayId: skyray.id,
        targetPlayerId: player.id,
        damage,
        position: skyray.position,
        timestamp: Date.now(),
      });
    }

    this.room?.tryDamageAlliedKnightInXZDisk(
      { x: skyray.position.x, z: skyray.position.z },
      2.4,
      damage,
      { sourceEnemyId: skyray.id, damageType: 'skyray_melee' },
    );
  }

  telegraphWyvernAttack(wyvern, player) {
    if (this.io) {
      this.io.to(this.roomId).emit('wyvern-attack-telegraph', {
        wyvernId: wyvern.id,
        ...this._meleeTelegraphTargetFields(player),
        position: wyvern.position,
        timestamp: Date.now(),
      });
    }
    _enemyAiLog(`🐉 Wyvern ${wyvern.id} telegraphing attack at ${player.id}!`);
  }

  wyvernAttackPlayer(wyvern, player) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    const damage = wyvern.damage || WYVERN_BASE_DAMAGE;
    this.recordAlliedProtectionThreat(wyvern.id, player.id, damage);

    if (this.io) {
      this.io.to(this.roomId).emit('wyvern-attack', {
        wyvernId: wyvern.id,
        targetPlayerId: player.id,
        damage,
        position: wyvern.position,
        timestamp: Date.now(),
      });
    }

    _enemyAiLog(`🐉 Wyvern ${wyvern.id} attacked player ${player.id} for ${damage} damage!`);

    this.room?.tryDamageAlliedKnightInXZDisk(
      { x: wyvern.position.x, z: wyvern.position.z },
      2.6,
      damage,
      { sourceEnemyId: wyvern.id, damageType: 'wyvern_melee' },
    );
  }

  telegraphTerrorhawkAttack(hawk, player) {
    if (this.io) {
      this.io.to(this.roomId).emit('terrorhawk-attack-telegraph', {
        terrorhawkId: hawk.id,
        ...this._meleeTelegraphTargetFields(player),
        position: hawk.position,
        timestamp: Date.now(),
      });
    }
  }

  terrorhawkAttackPlayer(hawk, player) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    const damage = hawk.damage || TERRORHAWK_MELEE_DAMAGE;
    this.recordAlliedProtectionThreat(hawk.id, player.id, damage);

    if (this.io) {
      this.io.to(this.roomId).emit('terrorhawk-attack', {
        terrorhawkId: hawk.id,
        targetPlayerId: player.id,
        damage,
        position: hawk.position,
        timestamp: Date.now(),
      });
    }

    this.room?.tryDamageAlliedKnightInXZDisk(
      { x: hawk.position.x, z: hawk.position.z },
      2.8,
      damage,
      { sourceEnemyId: hawk.id, damageType: 'terrorhawk_melee' },
    );
  }

  // ── Destiny (dragon boss) ───────────────────────────────────────────────────

  _destinyHorizontalDistance(a, b) {
    const dx = (a?.x ?? 0) - (b?.x ?? 0);
    const dz = (a?.z ?? 0) - (b?.z ?? 0);
    return Math.hypot(dx, dz);
  }

  _destinyBeginTakeoff(destiny) {
    if (!destiny || destiny.isDying) return;
    const now = Date.now();
    // Cancel any in-progress ground breath / wing attack.
    if (destiny.breathActive) {
      this.endDestinyBreath(destiny.id);
    }
    if (destiny.wingActive) {
      this.clearDestinyWingPillarTimers(destiny.id);
      this.endDestinyWingAttack(destiny.id);
      destiny.wingCastId = null;
    }
    destiny.destinyPhase = 'takeoff';
    destiny.moveSpeed = 0;
    destiny.flyAttackVolleysFired = 0;
    destiny.takeoffStartedAt = now;
    destiny.takeoffEndsAt = now + DESTINY_FLY_TAKEOFF_MS;
    destiny.nextAirEmberAt = now + DESTINY_AIR_EMBER_INTERVAL_MS;
    destiny.flyIdleUntil = null;
    destiny.flyAttackEndsAt = null;
    destiny.landEndsAt = null;
    destiny.flyRepositionTarget = null;
    if (destiny.position.y == null || destiny.position.y < 0) destiny.position.y = 0;
    this.meleeLockUntil.set(destiny.id, destiny.takeoffEndsAt);
    if (this.io) {
      this.io.to(this.roomId).emit('destiny-takeoff-start', {
        destinyId: destiny.id,
        durationMs: DESTINY_FLY_TAKEOFF_MS,
        position: { ...destiny.position },
        timestamp: now,
      });
      this._queueMove(destiny.id, destiny.position, destiny.rotation);
    }
    _enemyAiLog(`🐉 Destiny ${destiny.id} beginning takeoff (fly phase).`);
  }

  _destinyBeginLand(destiny) {
    if (!destiny || destiny.isDying) return;
    const now = Date.now();
    destiny.destinyPhase = 'land';
    destiny.moveSpeed = 0;
    destiny.landStartedAt = now;
    destiny.landEndsAt = now + DESTINY_FLY_LAND_MS;
    destiny.position.x = 0;
    destiny.position.z = 0;
    destiny.position.y = DESTINY_HOVER_Y;
    this.meleeLockUntil.set(destiny.id, destiny.landEndsAt);
    if (this.io) {
      this.io.to(this.roomId).emit('destiny-land-start', {
        destinyId: destiny.id,
        durationMs: DESTINY_FLY_LAND_MS,
        landPosition: { x: 0, y: 0, z: 0 },
        position: { ...destiny.position },
        timestamp: now,
      });
      this._queueMove(destiny.id, destiny.position, destiny.rotation);
    }
    _enemyAiLog(`🐉 Destiny ${destiny.id} beginning land at center.`);
  }

  _destinyCompleteLanding(destiny) {
    if (!destiny || destiny.isDying) return;
    destiny.position.x = 0;
    destiny.position.z = 0;
    destiny.position.y = 0;
    destiny.destinyPhase = 'ground';
    destiny.flyPhaseCompleted = true;
    destiny.flyAttackVolleysFired = 0;
    destiny.moveSpeed = DESTINY_BASE_MOVE_SPEED;
    destiny.takeoffStartedAt = null;
    destiny.takeoffEndsAt = null;
    destiny.flyIdleUntil = null;
    destiny.flyAttackEndsAt = null;
    destiny.landStartedAt = null;
    destiny.landEndsAt = null;
    destiny.flyRepositionTarget = null;
    destiny.nextAirEmberAt = 0;
    this._queueMove(destiny.id, destiny.position, destiny.rotation);
    _enemyAiLog(`🐉 Destiny ${destiny.id} landed — resuming ground combat.`);
  }

  _destinyMoveFlyApproach(destiny, moveTarget) {
    if (!moveTarget?.position) return;
    destiny.moveSpeed = DESTINY_FLY_SPEED;
    destiny.position.y = DESTINY_HOVER_Y;

    // Optional orbit offset for post-attack reposition (forces flight between volleys)
    const goal = destiny.flyRepositionTarget
      ? destiny.flyRepositionTarget
      : moveTarget.position;
    const horiz = this._destinyHorizontalDistance(destiny.position, goal);
    if (horiz < DESTINY_FLY_APPROACH_STOP * 0.5 && destiny.flyRepositionTarget) {
      destiny.flyRepositionTarget = null;
      return;
    }
    if (horiz < DESTINY_FLY_APPROACH_STOP && !destiny.flyRepositionTarget) return;

    const waypoint = destiny.flyRepositionTarget
      ? destiny.flyRepositionTarget
      : this._getPathWaypoint(destiny, moveTarget);
    const dx = waypoint.x - destiny.position.x;
    const dz = waypoint.z - destiny.position.z;
    const mag = Math.hypot(dx, dz);
    if (mag < 1e-6) return;

    const dirX = dx / mag;
    const dirZ = dz / mag;
    const deltaTime = this.updateInterval / 1000;
    const moveDistance = this.getModifiedMovementSpeed(destiny.id, DESTINY_FLY_SPEED) * deltaTime;
    if (moveDistance <= 0) return;

    const rawX = destiny.position.x + dirX * moveDistance;
    const rawZ = destiny.position.z + dirZ * moveDistance;
    const resolved = this.resolveEnemyWallCollisions(rawX, rawZ);
    destiny.position.x = resolved.x;
    destiny.position.z = resolved.z;
    destiny.position.y = DESTINY_HOVER_Y;
    destiny.rotation = Math.atan2(dirX, dirZ);
    this._queueMove(destiny.id, destiny.position, destiny.rotation);
  }

  /** Pick a nearby orbit point so the dragon always flies between air volleys. */
  _destinyPickFlyReposition(destiny, resolved) {
    const tpos = this.combatTargetPosition(resolved) || { x: 0, z: 0 };
    const angle = Math.random() * Math.PI * 2;
    const radius = DESTINY_FLY_APPROACH_STOP + 4 + Math.random() * 5;
    const rawX = tpos.x + Math.cos(angle) * radius;
    const rawZ = tpos.z + Math.sin(angle) * radius;
    const resolvedPos = this.resolveEnemyWallCollisions(rawX, rawZ);
    destiny.flyRepositionTarget = { x: resolvedPos.x, y: DESTINY_HOVER_Y, z: resolvedPos.z };
  }

  _destinyMoveFlyReturn(destiny) {
    destiny.moveSpeed = DESTINY_FLY_SPEED;
    destiny.position.y = DESTINY_HOVER_Y;
    const center = { x: 0, y: 0, z: 0 };
    const horiz = this._destinyHorizontalDistance(destiny.position, center);
    if (horiz < DESTINY_FLY_CENTER_HOLD) return true;

    const dx = -destiny.position.x;
    const dz = -destiny.position.z;
    const mag = Math.hypot(dx, dz);
    if (mag < 1e-6) return true;

    const dirX = dx / mag;
    const dirZ = dz / mag;
    const deltaTime = this.updateInterval / 1000;
    const moveDistance = this.getModifiedMovementSpeed(destiny.id, DESTINY_FLY_SPEED) * deltaTime;
    if (moveDistance <= 0) return false;

    const step = Math.min(moveDistance, horiz);
    destiny.position.x += dirX * step;
    destiny.position.z += dirZ * step;
    destiny.position.y = DESTINY_HOVER_Y;
    destiny.rotation = Math.atan2(dirX, dirZ);
    this._queueMove(destiny.id, destiny.position, destiny.rotation);
    return this._destinyHorizontalDistance(destiny.position, center) < DESTINY_FLY_CENTER_HOLD;
  }

  _destinyClearFlyAttackTimers(did) {
    const endHandle = this.destinyFlyAttackEndTimeout.get(did);
    if (endHandle) {
      clearTimeout(endHandle);
      this.destinyFlyAttackEndTimeout.delete(did);
    }
    const launchHandles = this.destinyFlyAttackLaunchTimeout.get(did);
    if (launchHandles) {
      for (const h of launchHandles) clearTimeout(h);
      this.destinyFlyAttackLaunchTimeout.delete(did);
    }
  }

  _destinyBeginFlyAttack(destiny, resolved) {
    const now = Date.now();
    const did = destiny.id;
    if (!destiny || destiny.isDying) return;

    this._destinyClearFlyAttackTimers(did);

    destiny.destinyPhase = 'fly_attack';
    destiny.moveSpeed = 0;
    destiny.position.y = DESTINY_HOVER_Y;
    destiny.flyRepositionTarget = null;
    destiny.flyAttackEndsAt = now + DESTINY_FLY_ATTACK_CAST_MS;
    this.meleeLockUntil.set(did, destiny.flyAttackEndsAt);
    this.destinyFlyAttackCooldown.set(did, now);

    const aimPos = this.combatTargetPosition(resolved);
    if (aimPos) {
      this._smoothRotateEnemyTowardPoint(destiny, aimPos, { instant: true });
      if (this.io) this._queueMove(destiny.id, destiny.position, destiny.rotation);
    }

    if (this.io) {
      this.io.to(this.roomId).emit('destiny-fly-attack-telegraph', {
        destinyId: did,
        durationMs: DESTINY_FLY_ATTACK_CAST_MS,
        position: { ...destiny.position },
        timestamp: now,
      });
      this.io.to(this.roomId).emit('beast-attack-sfx', {
        soundId: 'beast_wyvern_roar',
        beastId: did,
        position: destiny.position,
        timestamp: now,
      });
      this._queueMove(destiny.id, destiny.position, destiny.rotation);
    }

    const roarVolleyId = now;
    destiny.breathRoarVolleyId = roarVolleyId;
    const launchAtMs = Math.max(0, DESTINY_FLY_ATTACK_CAST_MS - DESTINY_FLY_ATTACK_LAUNCH_EARLY_MS);
    const launchHandles = [];
    const handle = this._scheduleTimeout(() => {
      if (!this.room?.getGameStarted()) return;
      const live = this.room?.getEnemy?.(did);
      if (!live || live.isDying || live.health <= 0) return;
      if (live.destinyPhase !== 'fly_attack') return;
      if (live.breathRoarVolleyId !== roarVolleyId) return;
      this.destinyLaunchAirRoarFanVolley(live, resolved);
      live.flyAttackVolleysFired = (live.flyAttackVolleysFired || 0) + 1;
    }, launchAtMs);
    launchHandles.push(handle);
    this.destinyFlyAttackLaunchTimeout.set(did, launchHandles);

    const endHandle = this._scheduleTimeout(() => {
      this.destinyFlyAttackEndTimeout.delete(did);
      const live = this.room?.getEnemy?.(did);
      if (!live || live.isDying) return;
      if (live.destinyPhase !== 'fly_attack') return;
      live.breathRoarVolleyId = null;
      if ((live.flyAttackVolleysFired || 0) >= DESTINY_FLY_ATTACK_VOLLEYS) {
        live.flyRepositionTarget = null;
        live.destinyPhase = 'fly_return';
        live.moveSpeed = DESTINY_FLY_SPEED;
        this._queueMove(live.id, live.position, live.rotation);
        _enemyAiLog(`🐉 Destiny ${did} fly volleys complete — returning to center.`);
      } else {
        // Force a brief reposition flight before the next volley
        const aggro = this.enemyAggro.get(did);
        const players = this.room?.getPlayers?.() || [];
        const resolvedAfter = aggro
          ? this.resolveAggroCombatTarget(aggro, live, players)
          : null;
        if (resolvedAfter) this._destinyPickFlyReposition(live, resolvedAfter);
        live.destinyPhase = 'fly_approach';
        live.moveSpeed = DESTINY_FLY_SPEED;
        this._queueMove(live.id, live.position, live.rotation);
      }
    }, DESTINY_FLY_ATTACK_CAST_MS);
    this.destinyFlyAttackEndTimeout.set(did, endHandle);

    _enemyAiLog(`🐉 Destiny ${did} fly attack cast (${DESTINY_FLY_ATTACK_CAST_MS}ms).`);
  }

  /** Air roar: same 5-bolt fan, fired from hover altitude toward ground. */
  destinyLaunchAirRoarFanVolley(destiny, resolved) {
    this._launchRoarFanVolley(
      destiny,
      resolved,
      DESTINY_BREATH_ROAR_FAN_ANGLES_RAD,
      DESTINY_FLY_MUZZLE_Y_OFFSET,
      (did, start, fanTarget, fanIndex, volleyTs, volleyHits) => {
        this._simulateDestinyBreathFirebolt(
          did, start, fanTarget, `${did}-air-roar-${fanIndex}-${volleyTs}`, true, volleyHits,
        );
      },
    );
    _enemyAiLog(`🐉 Destiny ${destiny.id} air roar fan volley (${DESTINY_BREATH_ROAR_FAN_ANGLES_RAD.length} bolts)`);
  }

  /** Ember patch at combat-target XZ; ticks player damage for its duration (air + post-land). */
  destinySpawnAirEmberPatch(destiny, position) {
    const now = Date.now();
    const did = destiny.id;
    const zoneId = `destiny-ember-${did}-${now}`;
    const pos = { x: position.x, z: position.z };
    this.io?.to(this.roomId).emit('destiny-ember-zone-spawned', {
      id: zoneId,
      position: pos,
      radius: DESTINY_AIR_EMBER_RADIUS,
      durationMs: DESTINY_AIR_EMBER_DURATION_MS,
      timestamp: now,
    });
    let elapsed = 0;
    const intervalId = setInterval(() => {
      if (!this.room?.getGameStarted()) {
        clearInterval(intervalId);
        this._removeEnemyHazardInterval(did, intervalId);
        return;
      }
      elapsed += DESTINY_AIR_EMBER_TICK_MS;
      this.room?.damagePlayersInHorizontalRing(
        pos,
        DESTINY_AIR_EMBER_RADIUS,
        DESTINY_AIR_EMBER_DAMAGE,
        'destiny_air_ember',
        { sourceEnemyId: did },
      );
      if (elapsed >= DESTINY_AIR_EMBER_DURATION_MS) {
        clearInterval(intervalId);
        this._removeEnemyHazardInterval(did, intervalId);
        this.io?.to(this.roomId).emit('destiny-ember-zone-expired', { id: zoneId, timestamp: Date.now() });
      }
    }, DESTINY_AIR_EMBER_TICK_MS);
    this._addEnemyHazardInterval(did, intervalId);
  }

  /** Drop an ember patch on the combat target every DESTINY_AIR_EMBER_INTERVAL_MS (air + post-land ground). */
  destinyMaybeSpawnAirEmber(destiny, players) {
    if (!destiny || destiny.isDying || destiny.health <= 0) return;
    const now = Date.now();
    if (now < (destiny.nextAirEmberAt || 0)) return;

    let aggroData = this.enemyAggro.get(destiny.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(destiny, players);
      if (!closestPlayer) return;
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
        isAggroed: true,
      };
      this.enemyAggro.set(destiny.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, destiny, players);
    if (!resolved) return;

    const tpos = this.combatTargetPosition(resolved);
    if (!tpos) return;

    destiny.nextAirEmberAt = now + DESTINY_AIR_EMBER_INTERVAL_MS;
    this.destinySpawnAirEmberPatch(destiny, tpos);
  }

  updateDestinyFlyAI(destiny, players) {
    if (!destiny || destiny.isDying || destiny.health <= 0) return;

    this.destinyMaybeSpawnAirEmber(destiny, players);

    const now = Date.now();
    const phase = destiny.destinyPhase;

    // --- Takeoff: rise 0 → hover Y ---
    if (phase === 'takeoff') {
      destiny.moveSpeed = 0;
      const started = destiny.takeoffStartedAt || now;
      const ends = destiny.takeoffEndsAt || (started + DESTINY_FLY_TAKEOFF_MS);
      const t = Math.min(1, (now - started) / Math.max(1, ends - started));
      destiny.position.y = DESTINY_HOVER_Y * t;
      this._queueMove(destiny.id, destiny.position, destiny.rotation);
      if (now >= ends || destiny.position.y >= DESTINY_HOVER_Y - 0.05) {
        destiny.position.y = DESTINY_HOVER_Y;
        destiny.destinyPhase = 'fly_idle';
        destiny.flyIdleUntil = now + DESTINY_FLY_IDLE_HOLD_MS;
        this._queueMove(destiny.id, destiny.position, destiny.rotation);
      }
      return;
    }

    // --- Land: descend hover Y → 0 at center ---
    if (phase === 'land') {
      destiny.moveSpeed = 0;
      destiny.position.x = 0;
      destiny.position.z = 0;
      const started = destiny.landStartedAt || now;
      const ends = destiny.landEndsAt || (started + DESTINY_FLY_LAND_MS);
      const t = Math.min(1, (now - started) / Math.max(1, ends - started));
      destiny.position.y = DESTINY_HOVER_Y * (1 - t);
      this._queueMove(destiny.id, destiny.position, destiny.rotation);
      if (now >= ends || destiny.position.y <= 0.05) {
        this._destinyCompleteLanding(destiny);
      }
      return;
    }

    // --- Fly idle: brief hold after takeoff ---
    if (phase === 'fly_idle') {
      destiny.moveSpeed = 0;
      destiny.position.y = DESTINY_HOVER_Y;
      this._queueMove(destiny.id, destiny.position, destiny.rotation);
      if (now >= (destiny.flyIdleUntil || 0)) {
        destiny.destinyPhase = 'fly_approach';
      }
      return;
    }

    // --- Fly attack: hold still while cast runs (timers drive volley + next phase) ---
    if (phase === 'fly_attack') {
      destiny.moveSpeed = 0;
      destiny.position.y = DESTINY_HOVER_Y;
      this._queueMove(destiny.id, destiny.position, destiny.rotation);
      return;
    }

    // Resolve aggro for approach / return
    let aggroData = this.enemyAggro.get(destiny.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(destiny, players);
      if (!closestPlayer) {
        if (phase === 'fly_return') {
          const arrived = this._destinyMoveFlyReturn(destiny);
          if (arrived) this._destinyBeginLand(destiny);
        }
        return;
      }
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
        isAggroed: true,
      };
      this.enemyAggro.set(destiny.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, destiny, players);

    // --- Fly return: go to arena center then land ---
    if (phase === 'fly_return') {
      const arrived = this._destinyMoveFlyReturn(destiny);
      if (arrived) this._destinyBeginLand(destiny);
      return;
    }

    // --- Fly approach: reposition toward target, then stop to attack ---
    if (phase === 'fly_approach') {
      if (!resolved) {
        destiny.position.y = DESTINY_HOVER_Y;
        this._queueMove(destiny.id, destiny.position, destiny.rotation);
        return;
      }

      const lastAttack = this.destinyFlyAttackCooldown.get(destiny.id) || 0;
      const onCooldown =
        now - lastAttack < DESTINY_FLY_ATTACK_COOLDOWN_MS &&
        (destiny.flyAttackVolleysFired || 0) > 0;

      // While on cooldown or still traveling to a reposition point, keep flying
      if (onCooldown || destiny.flyRepositionTarget) {
        const moveTarget = this.aggroTargetToMoveTarget(resolved);
        this._destinyMoveFlyApproach(destiny, moveTarget);
        return;
      }

      const tpos = this.combatTargetPosition(resolved);
      const horiz = this._destinyHorizontalDistance(destiny.position, tpos);
      if (horiz <= DESTINY_FLY_APPROACH_STOP) {
        this._destinyBeginFlyAttack(destiny, resolved);
        return;
      }

      const moveTarget = this.aggroTargetToMoveTarget(resolved);
      this._destinyMoveFlyApproach(destiny, moveTarget);

      const horizAfter = this._destinyHorizontalDistance(destiny.position, tpos);
      if (horizAfter <= DESTINY_FLY_APPROACH_STOP) {
        this._destinyBeginFlyAttack(destiny, resolved);
      }
      return;
    }
  }

  destinyMaybeSummonWyverns(destiny) {
    if (!destiny || destiny.type !== 'destiny' || destiny.isDying || destiny.health <= 0) return;
    if (destiny.wyvernSummonTriggered) return;
    const maxHp = destiny.maxHealth || 1;
    const hpPct = (destiny.health || 0) / maxHp;
    if (hpPct > DESTINY_WYVERN_SUMMON_HEALTH_PCT) return;
    destiny.wyvernSummonTriggered = true;
    this.destinySummonWyverns(destiny);
  }

  destinySummonWyverns(destiny) {
    if (!this.room || !destiny || destiny.type !== 'destiny') return;
    if (this.room?.bannedEnemyTypes?.has('wyvern')) return;

    const ex = BOSS2_SUMMON_ARENA_EXTENT;
    const clampXZ = (x, z) => ({
      x: Math.max(-ex, Math.min(ex, x)),
      y: 0,
      z: Math.max(-ex, Math.min(ex, z)),
    });

    const bx = destiny.position.x;
    const bz = destiny.position.z;
    // Prefer left/right flanks (±6 on X); fall back to random arena spots if needed.
    const preferredOffsets = [
      { dx: -6, dz: 0 },
      { dx: 6, dz: 0 },
    ];
    const used = [];

    for (let i = 0; i < DESTINY_WYVERN_SUMMON_COUNT; i += 1) {
      let pos = null;
      const pref = preferredOffsets[i];
      if (pref) {
        const raw = clampXZ(bx + pref.dx, bz + pref.dz);
        const resolved = this.resolveEnemyWallCollisions(raw.x, raw.z);
        pos = { x: resolved.x, y: 0, z: resolved.z };
      }
      if (!pos) {
        pos = { ...clampXZ(bx + 5, bz), y: 0 };
        for (let attempt = 0; attempt < 48; attempt += 1) {
          const a = Math.random() * Math.PI * 2;
          const rad = 3.5 + Math.random() * (ex - 3.5);
          const rawX = Math.sin(a) * rad;
          const rawZ = Math.cos(a) * rad;
          const p = clampXZ(rawX, rawZ);
          if (Math.hypot(p.x - bx, p.z - bz) < 2.8) continue;
          if (used.some((u) => Math.hypot(u.x - p.x, u.z - p.z) < 2.5)) continue;
          const resolved = this.resolveEnemyWallCollisions(p.x, p.z);
          pos = { x: resolved.x, y: 0, z: resolved.z };
          break;
        }
      }
      used.push(pos);

      const wyvernId = `wyvern-destiny-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;
      const wyvern = {
        id: wyvernId,
        type: 'wyvern',
        position: { x: pos.x, y: 0, z: pos.z },
        rotation: rotationYTowardEntry(pos.x, pos.z),
        health: 4900,
        maxHealth: 4900,
        damage: 42,
        attackCooldown: 1700,
        moveSpeed: 2.85,
        isDying: false,
        staggerBuildup: 0,
        attackVariant: 1,
        breathVariant: 1,
        summonedByDestinyId: destiny.id,
        spawnedAt: Date.now(),
      };

      this.room.addEnemy(wyvern);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-spawned', {
          enemy: wyvern,
          timestamp: Date.now(),
        });
      }
      _enemyAiLog(
        `🐉 Destiny ${destiny.id} summoned wyvern ${wyvernId} at (${pos.x.toFixed(2)}, ${pos.z.toFixed(2)})`
      );
    }
  }

  updateDestinyAI(destiny, players) {
    if (!destiny || destiny.isDying || destiny.health <= 0) return;

    // One-shot 30% HP wyvern adds — check before fly early-return so it still fires mid-air.
    this.destinyMaybeSummonWyverns(destiny);

    if (!destiny.destinyPhase) destiny.destinyPhase = 'ground';

    // Non-ground phases: fly FSM only
    if (destiny.destinyPhase !== 'ground') {
      this.updateDestinyFlyAI(destiny, players);
      return;
    }

    let aggroData = this.enemyAggro.get(destiny.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(destiny, players);
      if (!closestPlayer) return;
      aggroData = {
        targetPlayerId: closestPlayer.id,
        targetZombieId: null,
        targetTrapId: null,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(destiny.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, destiny, players);
    if (!resolved) return;

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(destiny.position, tpos);
    const aggroRadius = DESTINY_AGGRO_RADIUS;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);
    const losOk = this.hasLineOfSight(destiny.position, tpos);

    if (!aggroData.isAggroed && distance <= aggroRadius && losOk) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }
    this._maybeClearForcedEdgeSpawn(aggroData, distance, aggroRadius);

    if (!aggroData.isAggroed) return;

    const now = Date.now();

    // One-time 70% HP fly phase trigger
    const maxHp = destiny.maxHealth || 1;
    const hpPct = (destiny.health || 0) / maxHp;
    if (!destiny.flyPhaseCompleted && hpPct <= DESTINY_FLY_HEALTH_PCT) {
      this._destinyBeginTakeoff(destiny);
      return;
    }

    // Post-land (phase 3): continue ember patches on the ground. Phase 1 is blocked by !flyPhaseCompleted.
    if (destiny.flyPhaseCompleted) {
      this.destinyMaybeSpawnAirEmber(destiny, players);
    }

    if (destiny.breathActive || destiny.wingActive) return;

    const breathOk = this.canDestinyBreath(destiny, distance, now);
    const wingOk = this.canDestinyWingAttack(destiny, distance, now);
    if (breathOk && wingOk) {
      if (Math.random() < 0.5) {
        this.startDestinyWingAttack(destiny, resolved);
      } else {
        this.startDestinyBreath(destiny, resolved);
      }
      return;
    }
    if (breathOk) {
      this.startDestinyBreath(destiny, resolved);
      return;
    }
    if (wingOk) {
      this.startDestinyWingAttack(destiny, resolved);
      return;
    }

    const lockUntil = this.meleeLockUntil.get(destiny.id) || 0;
    if (now < lockUntil) {
      this.tickMeleeSwingWindup(destiny, resolved);
      return;
    }

    const profile = getMeleeProfile('destiny');
    this.tryMeleeEngage(destiny, resolved, moveTarget, profile, { now, distance });
  }

  canDestinyBreath(destiny, distance, now) {
    if (!destiny || destiny.isDying || destiny.health <= 0) return false;
    if (destiny.destinyPhase && destiny.destinyPhase !== 'ground') return false;
    if (destiny.breathActive || destiny.wingActive) return false;
    if (this.room?.isEnemyAffectedBy(destiny.id, 'freeze')) return false;
    if (this.room?.isEnemyAffectedBy(destiny.id, 'stun')) return false;
    if (distance > DESTINY_BREATH_CAST_RANGE) return false;
    if (distance <= DESTINY_BREATH_MIN_RANGE) return false;
    const readyAt = this.destinyGroundSpecialReadyAt.get(destiny.id) || 0;
    if (now < readyAt) return false;
    const last = this.destinyBreathCooldown.get(destiny.id) || 0;
    if (now - last < DESTINY_BREATH_COOLDOWN_MS) return false;
    return true;
  }

  tryDestinyBreath(destiny, resolved, distance, now) {
    if (!this.canDestinyBreath(destiny, distance, now)) return false;
    this.startDestinyBreath(destiny, resolved);
    return true;
  }

  startDestinyBreath(destiny, resolved) {
    const now = Date.now();
    const did = destiny.id;
    if (destiny.breathActive) return;

    const staleEnd = this.destinyBreathEndTimeout.get(did);
    if (staleEnd) clearTimeout(staleEnd);
    const staleLaunches = this.destinyBreathLaunchTimeout.get(did);
    if (staleLaunches) {
      for (const h of staleLaunches) clearTimeout(h);
      this.destinyBreathLaunchTimeout.delete(did);
    }

    destiny.breathActive = true;
    this.destinyBreathCooldown.set(did, now);

    const castLockMs = DESTINY_BREATH_ROAR_CAST_LOCK_MS;
    this.meleeLockUntil.set(did, now + castLockMs);
    this.destinyGroundSpecialReadyAt.set(did, now + castLockMs + DESTINY_GROUND_SPECIAL_GAP_MS);

    const aimPos = this.combatTargetPosition(resolved);
    if (aimPos) {
      this._smoothRotateEnemyTowardPoint(destiny, aimPos, { instant: true });
      if (this.io) this._queueMove(destiny.id, destiny.position, destiny.rotation);
    }

    if (this.io) {
      this.io.to(this.roomId).emit('destiny-breath-telegraph', {
        destinyId: did,
        breathVariant: 1,
        durationMs: castLockMs,
        position: destiny.position,
        timestamp: now,
      });
      this.io.to(this.roomId).emit('beast-attack-sfx', {
        soundId: 'beast_wyvern_roar',
        beastId: did,
        position: destiny.position,
        timestamp: now,
      });
    }

    const launchAtMs = Math.max(0, castLockMs - DESTINY_BREATH_LAUNCH_EARLY_MS);
    const launchHandles = [];
    const roarVolleyId = now;
    destiny.breathRoarVolleyId = roarVolleyId;

    const handle = this._scheduleTimeout(() => {
      if (!this.room?.getGameStarted()) return;
      const live = this.room?.getEnemy?.(did);
      if (!live || live.isDying || live.health <= 0 || !live.breathActive) return;
      if (live.breathRoarVolleyId !== roarVolleyId) return;
      this.destinyLaunchRoarFanVolley(live, resolved);
    }, launchAtMs);
    launchHandles.push(handle);
    this.destinyBreathLaunchTimeout.set(did, launchHandles);

    const endHandle = this._scheduleTimeout(() => {
      this.destinyBreathEndTimeout.delete(did);
      this.endDestinyBreath(did);
    }, castLockMs);
    this.destinyBreathEndTimeout.set(did, endHandle);

    _enemyAiLog(`🐉 Destiny ${did} casting roar breath (${castLockMs}ms).`);
  }

  endDestinyBreath(destinyId) {
    const endHandle = this.destinyBreathEndTimeout.get(destinyId);
    if (endHandle) {
      clearTimeout(endHandle);
      this.destinyBreathEndTimeout.delete(destinyId);
    }
    const launchHandles = this.destinyBreathLaunchTimeout.get(destinyId);
    if (launchHandles) {
      for (const h of launchHandles) clearTimeout(h);
      this.destinyBreathLaunchTimeout.delete(destinyId);
    }

    const destiny = this.room?.getEnemy?.(destinyId);
    if (destiny) {
      destiny.breathActive = false;
      destiny.breathRoarVolleyId = null;
    }

    if (this.io) {
      this.io.to(this.roomId).emit('destiny-breath-end', {
        destinyId,
        timestamp: Date.now(),
      });
    }
  }

  canDestinyWingAttack(destiny, distance, now) {
    if (!destiny || destiny.isDying || destiny.health <= 0) return false;
    if (destiny.destinyPhase && destiny.destinyPhase !== 'ground') return false;
    if (destiny.breathActive || destiny.wingActive) return false;
    if (this.room?.isEnemyAffectedBy(destiny.id, 'freeze')) return false;
    if (this.room?.isEnemyAffectedBy(destiny.id, 'stun')) return false;
    if (distance > DESTINY_WING_CAST_RANGE) return false;
    const readyAt = this.destinyGroundSpecialReadyAt.get(destiny.id) || 0;
    if (now < readyAt) return false;
    const last = this.destinyWingCooldown.get(destiny.id) || 0;
    if (now - last < DESTINY_WING_COOLDOWN_MS) return false;
    return true;
  }

  tryDestinyWingAttack(destiny, resolved, distance, now) {
    if (!this.canDestinyWingAttack(destiny, distance, now)) return false;
    this.startDestinyWingAttack(destiny, resolved);
    return true;
  }

  clearDestinyWingPillarTimers(destinyId) {
    const arr = this.destinyWingPillarTimeouts.get(destinyId);
    if (arr) {
      for (const h of arr) clearTimeout(h);
    }
    this.destinyWingPillarTimeouts.delete(destinyId);
  }

  addDestinyWingPillarTimeout(destinyId, handle) {
    const arr = this.destinyWingPillarTimeouts.get(destinyId) || [];
    arr.push(handle);
    this.destinyWingPillarTimeouts.set(destinyId, arr);
  }

  startDestinyWingAttack(destiny, resolved) {
    const now = Date.now();
    const did = destiny.id;
    if (destiny.wingActive) return;

    const staleEnd = this.destinyWingEndTimeout.get(did);
    if (staleEnd) clearTimeout(staleEnd);
    this.clearDestinyWingPillarTimers(did);

    destiny.wingActive = true;
    this.destinyWingCooldown.set(did, now);

    const castLockMs = DESTINY_WING_CAST_LOCK_MS;
    this.meleeLockUntil.set(did, now + castLockMs);
    this.destinyGroundSpecialReadyAt.set(did, now + castLockMs + DESTINY_GROUND_SPECIAL_GAP_MS);

    const aimPos = this.combatTargetPosition(resolved);
    if (aimPos) {
      this._smoothRotateEnemyTowardPoint(destiny, aimPos, { instant: true });
      if (this.io) this._queueMove(destiny.id, destiny.position, destiny.rotation);
    }

    if (this.io) {
      this.io.to(this.roomId).emit('destiny-wing-telegraph', {
        destinyId: did,
        durationMs: castLockMs,
        position: destiny.position,
        timestamp: now,
      });
    }

    const r = destiny.rotation || 0;
    const lx = Math.cos(r);
    const lz = -Math.sin(r);
    const py = destiny.position.y ?? 0;
    const ox = destiny.position.x;
    const oz = destiny.position.z;
    const wingCastId = now;
    destiny.wingCastId = wingCastId;

    const erupt = (center) => {
      const live = this.room?.getEnemy?.(did);
      if (!this.room?.getGameStarted() || !live || live.isDying || live.health <= 0) return;
      if (live.type !== 'destiny' || live.wingCastId !== wingCastId) return;
      if (live.destinyPhase && live.destinyPhase !== 'ground') return;
      if (this.io) {
        this.io.to(this.roomId).emit('destiny-wing-pillar', {
          destinyId: did,
          position: { x: center.x, y: center.y, z: center.z },
          timestamp: Date.now(),
        });
      }
      this.room.damagePlayersInHorizontalRing(
        center,
        DESTINY_WING_PILLAR_RADIUS,
        DESTINY_WING_PILLAR_DAMAGE,
        'destiny_wing_pillar',
      );
    };

    for (let i = 0; i < DESTINY_WING_PILLAR_COUNT; i++) {
      const dist = DESTINY_WING_PILLAR_BASE_OFFSET + i * DESTINY_WING_PILLAR_STEP;
      const delay = DESTINY_WING_PILLAR_FIRST_DELAY_MS + i * DESTINY_WING_PILLAR_STAGGER_MS;
      for (const side of [-1, 1]) {
        const center = {
          x: ox + lx * side * dist,
          y: py,
          z: oz + lz * side * dist,
        };
        const h = this._scheduleTimeout(() => erupt(center), delay);
        this.addDestinyWingPillarTimeout(did, h);
      }
    }

    const endHandle = this._scheduleTimeout(() => {
      this.destinyWingEndTimeout.delete(did);
      this.endDestinyWingAttack(did);
    }, castLockMs);
    this.destinyWingEndTimeout.set(did, endHandle);

    _enemyAiLog(`🐉 Destiny ${did} casting wing attack (${castLockMs}ms).`);
  }

  endDestinyWingAttack(destinyId) {
    const endHandle = this.destinyWingEndTimeout.get(destinyId);
    if (endHandle) {
      clearTimeout(endHandle);
      this.destinyWingEndTimeout.delete(destinyId);
    }
    // Do not clear pillar timers here — waves may still be in flight; takeoff/death clears them.

    const destiny = this.room?.getEnemy?.(destinyId);
    if (destiny) {
      destiny.wingActive = false;
    }

    if (this.io) {
      this.io.to(this.roomId).emit('destiny-wing-end', {
        destinyId,
        timestamp: Date.now(),
      });
    }
  }

  /** Destiny roar: simultaneous 5-bolt fan. */
  destinyLaunchRoarFanVolley(destiny, resolved) {
    this._launchRoarFanVolley(
      destiny,
      resolved,
      DESTINY_BREATH_ROAR_FAN_ANGLES_RAD,
      2.2,
      (did, start, fanTarget, fanIndex, volleyTs, volleyHits) => {
        this._simulateDestinyBreathFirebolt(
          did, start, fanTarget, `${did}-roar-${fanIndex}-${volleyTs}`, false, volleyHits,
        );
      },
    );
    _enemyAiLog(`🐉 Destiny ${destiny.id} roar fan volley (${DESTINY_BREATH_ROAR_FAN_ANGLES_RAD.length} bolts)`);
  }

  _simulateDestinyBreathFirebolt(did, start, target, fireboltId, fromAir = false, volleyHits = null) {
    if (this.io) {
      this.io.to(this.roomId).emit('destiny-breath-firebolt', {
        destinyId: did,
        fireboltId,
        startPosition: start,
        targetPosition: target,
        damage: DESTINY_BREATH_DAMAGE,
        fromAir: !!fromAir,
        timestamp: Date.now(),
      });
    }

    const dirLen = Math.hypot(target.x - start.x, target.z - start.z) || 1;
    const dir = { x: (target.x - start.x) / dirLen, z: (target.z - start.z) / dirLen };
    const pos = { x: start.x, z: start.z };
    const STEP_MS = 50;
    const maxSteps = Math.ceil((dirLen / GREED_FIREBALL_SPEED) * (1000 / STEP_MS)) + 4;
    let steps = 0;
    const hitRadiusSq = GREED_FIREBALL_HIT_RADIUS * GREED_FIREBALL_HIT_RADIUS;
    // Prefer shared volley registry so fan bolts don't multi-hit the same target.
    const hitPlayerIds = volleyHits?.players ?? new Set();
    const hitAllyIds = volleyHits?.allies ?? new Set();

    const applyBreathImpact = () => {
      const playerMap = this.room?.players;
      if (playerMap) {
        for (const p of playerMap.values()) {
          if (!p || p.health <= 0 || hitPlayerIds.has(p.id)) continue;
          const hdx = p.position.x - pos.x;
          const hdz = p.position.z - pos.z;
          if (hdx * hdx + hdz * hdz > hitRadiusSq) continue;
          hitPlayerIds.add(p.id);
          if (this.room?.isCoopCombatTransitionActive?.()) continue;
          const { wasKilled, persephoneTriggered, dodged, negationType, appliedDamage } =
            this.room._applyCoopPlayerIncomingDamage(p, DESTINY_BREATH_DAMAGE);
          if (persephoneTriggered) this.room._emitPersephoneTriggered(p.id, p);
          this.room._emitCoopIncomingDamageResult(p.id, p, {
            damage: appliedDamage,
            damageType: 'destiny_breath',
            wasKilled,
            persephoneTriggered,
            dodged,
            negationType,
            meta: { sourceEnemyId: did },
          });
          this.room._tryEmitCoopRoomWhisper?.();
        }
      }
      // Allied units: disk damage once per volley (mark all currently-in-range allies).
      let anyUnhitAllyInDisk = false;
      const enemyMap = this.room?.enemies;
      if (enemyMap) {
        for (const ally of enemyMap.values()) {
          if (!ally?.alliedUnit || ally.isDying || ally.health <= 0) continue;
          const hdx = (ally.position?.x ?? 0) - pos.x;
          const hdz = (ally.position?.z ?? 0) - pos.z;
          if (hdx * hdx + hdz * hdz > hitRadiusSq) continue;
          if (hitAllyIds.has(ally.id)) continue;
          hitAllyIds.add(ally.id);
          anyUnhitAllyInDisk = true;
        }
      }
      if (anyUnhitAllyInDisk) {
        this.room.tryDamageAlliedKnightInXZDisk(
          { x: pos.x, z: pos.z },
          GREED_FIREBALL_HIT_RADIUS,
          DESTINY_BREATH_DAMAGE,
          { sourceEnemyId: did, damageType: 'destiny_breath' },
        );
      }
      this.io?.to(this.roomId).emit('destiny-breath-impact', {
        destinyId: did, fireboltId, position: pos, hit: true, timestamp: Date.now(),
      });
    };
    const intervalId = setInterval(() => {
      if (!this.room?.getGameStarted()) {
        clearInterval(intervalId);
        this._removeEnemyHazardInterval(did, intervalId);
        return;
      }
      steps++;
      pos.x += dir.x * GREED_FIREBALL_SPEED * (STEP_MS / 1000);
      pos.z += dir.z * GREED_FIREBALL_SPEED * (STEP_MS / 1000);
      const playerMap = this.room?.players;
      if (playerMap) {
        for (const p of playerMap.values()) {
          if (!p || p.health <= 0 || hitPlayerIds.has(p.id)) continue;
          const hdx = p.position.x - pos.x;
          const hdz = p.position.z - pos.z;
          if (hdx * hdx + hdz * hdz <= hitRadiusSq) {
            clearInterval(intervalId);
            this._removeEnemyHazardInterval(did, intervalId);
            applyBreathImpact();
            return;
          }
        }
      }
      const enemyMap = this.room?.enemies;
      if (enemyMap) {
        for (const ally of enemyMap.values()) {
          if (!ally?.alliedUnit || ally.isDying || ally.health <= 0) continue;
          if (hitAllyIds.has(ally.id)) continue;
          const hdx = (ally.position?.x ?? 0) - pos.x;
          const hdz = (ally.position?.z ?? 0) - pos.z;
          if (hdx * hdx + hdz * hdz <= hitRadiusSq) {
            clearInterval(intervalId);
            this._removeEnemyHazardInterval(did, intervalId);
            applyBreathImpact();
            return;
          }
        }
      }
      if (steps >= maxSteps) {
        clearInterval(intervalId);
        this._removeEnemyHazardInterval(did, intervalId);
        this.io?.to(this.roomId).emit('destiny-breath-impact', {
          destinyId: did, fireboltId, position: pos, hit: false, timestamp: Date.now(),
        });
      }
    }, STEP_MS);
    this._addEnemyHazardInterval(did, intervalId);
  }

  telegraphDestinyAttack(destiny, player) {
    const swipeVariant = destiny.attackVariant === 2 ? 2 : 1;
    destiny.attackVariant = swipeVariant === 1 ? 2 : 1;
    if (this.io) {
      this.io.to(this.roomId).emit('destiny-attack-telegraph', {
        destinyId: destiny.id,
        swipeVariant,
        ...this._meleeTelegraphTargetFields(player),
        position: destiny.position,
        timestamp: Date.now(),
      });
    }
    _enemyAiLog(`🐉 Destiny ${destiny.id} telegraphing swipe ${swipeVariant} at ${player.id}!`);
  }

  destinyAttackPlayer(destiny, player) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    const damage = destiny.damage || DESTINY_BASE_DAMAGE;
    this.recordAlliedProtectionThreat(destiny.id, player.id, damage);

    if (this.io) {
      this.io.to(this.roomId).emit('destiny-attack', {
        destinyId: destiny.id,
        targetPlayerId: player.id,
        damage,
        position: destiny.position,
        timestamp: Date.now(),
      });
    }

    _enemyAiLog(`🐉 Destiny ${destiny.id} attacked player ${player.id} for ${damage} damage!`);

    this.room?.tryDamageAlliedKnightInXZDisk(
      { x: destiny.position.x, z: destiny.position.z },
      3.2,
      damage,
      { sourceEnemyId: destiny.id, damageType: 'destiny_melee' },
    );
  }

  valkyrieCastJudgment(valkyrie, target, applyCorrupted = true) {
    const now = Date.now();
    if (this.room?.isEnemyAffectedBy(valkyrie.id, 'freeze')) return false;
    if (this.room?.isEnemyAffectedBy(valkyrie.id, 'stun')) return false;
    if (!target?.position) return false;

    const last = this.valkyrieJudgmentCooldown.get(valkyrie.id) || 0;
    if (now - last < VALKYRIE_JUDGMENT_COOLDOWN_MS) return false;

    const distance = this.calculateDistance(valkyrie.position, target.position);
    if (distance > VALKYRIE_JUDGMENT_CAST_RANGE) return false;

    const dx = target.position.x - valkyrie.position.x;
    const dz = target.position.z - valkyrie.position.z;
    if (dx || dz) valkyrie.rotation = Math.atan2(dx, dz);

    this.valkyrieJudgmentCooldown.set(valkyrie.id, now);
    this.meleeLockUntil.set(valkyrie.id, now + VALKYRIE_JUDGMENT_CAST_MS);
    this.enemyPaths.delete(valkyrie.id);

    const targetId = target.id;
    const vid = valkyrie.id;

    if (this.io) {
      this.io.to(this.roomId).emit('valkyrie-judgment-cast', {
        valkyrieId: valkyrie.id,
        rotation: valkyrie.rotation,
        castMs: VALKYRIE_JUDGMENT_CAST_MS,
        timestamp: now,
      });
      this._queueMove(valkyrie.id, valkyrie.position, valkyrie.rotation);
    }

    this._scheduleEnemyTimeout(vid, () => {
      const liveValkyrie = this.room?.getEnemy?.(vid);
      if (!liveValkyrie || liveValkyrie.isDying) return;

      let liveTarget = this.room?.getPlayers?.()?.find((p) => p.id === targetId && p.health > 0) || null;
      if (!liveTarget) {
        const liveEnemy = this.room?.getEnemy?.(targetId);
        if (liveEnemy && !liveEnemy.isDying && liveEnemy.health > 0) {
          liveTarget = liveEnemy;
        }
      }
      if (!liveTarget?.position) {
        liveTarget = target;
      }
      if (!liveTarget?.position) return;

      const fallStartNow = Date.now();
      const strikePosition = {
        x: liveTarget.position.x,
        y: liveTarget.position.y ?? 0,
        z: liveTarget.position.z,
      };
      const strikeAt = fallStartNow + VALKYRIE_JUDGMENT_HOVER_MS + VALKYRIE_JUDGMENT_FALL_MS;

      if (this.io) {
        this.io.to(this.roomId).emit('valkyrie-judgment-cast', {
          valkyrieId: vid,
          targetPlayerId: targetId,
          targetPosition: strikePosition,
          rotation: liveValkyrie.rotation,
          castMs: VALKYRIE_JUDGMENT_CAST_MS,
          hoverMs: VALKYRIE_JUDGMENT_HOVER_MS,
          fallMs: VALKYRIE_JUDGMENT_FALL_MS,
          strikeAt,
          skyHeight: VALKYRIE_JUDGMENT_SKY_HEIGHT,
          aoeRadius: VALKYRIE_JUDGMENT_AOE_RADIUS,
          timestamp: fallStartNow,
        });
      }

      this._scheduleEnemyTimeout(vid, () => {
        const live = this.room?.getEnemy?.(vid);
        if (!live || live.isDying) return;
        if (applyCorrupted) {
          this.room?.damagePlayersInHorizontalRing(
            strikePosition,
            VALKYRIE_JUDGMENT_AOE_RADIUS,
            VALKYRIE_JUDGMENT_DAMAGE,
            'valkyrie_judgment',
            { sourceEnemyId: vid },
          );
          const players = this.findPlayersInRange(strikePosition, VALKYRIE_JUDGMENT_AOE_RADIUS);
          for (const p of players) {
            this.room?.applyHostileCorruptedOnPlayer?.(p.id, VALKYRIE_JUDGMENT_CORRUPTED_MS, {
              source: 'valkyrie_judgment',
            });
          }
        } else {
          this.room?.damageEnemiesInHorizontalRing(
            strikePosition,
            VALKYRIE_JUDGMENT_AOE_RADIUS,
            VALKYRIE_JUDGMENT_DAMAGE,
            'valkyrie_judgment',
            { sourceEnemyId: vid },
          );
        }
      }, VALKYRIE_JUDGMENT_HOVER_MS + VALKYRIE_JUDGMENT_FALL_MS);
    }, VALKYRIE_JUDGMENT_CAST_MS);

    return true;
  }

  updateValkyrieAI(valkyrie, players) {
    let aggroData = this.enemyAggro.get(valkyrie.id);
    if (!aggroData) {
      const closest = this.findClosestCombatantForValkyrie(valkyrie, players);
      if (!closest) return;
      aggroData = {
        targetPlayerId: closest.kind === 'player' ? closest.player.id : null,
        targetZombieId: null,
        targetTrapId: null,
        targetHostileEnemyId: closest.kind === 'hostile' ? closest.enemy.id : null,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(valkyrie.id, aggroData);
    }

    const resolved = this.resolveAggroCombatTarget(aggroData, valkyrie, players);
    if (!resolved) return;

    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(valkyrie.position, tpos);
    const aggroRadius = VALKYRIE_AGGRO_RADIUS;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);
    const losOk = this.hasLineOfSight(valkyrie.position, tpos);

    if (!aggroData.isAggroed && distance <= aggroRadius && losOk) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
    }

    if (!aggroData.isAggroed) return;

    const now = Date.now();
    const lockUntil = this.meleeLockUntil.get(valkyrie.id) || 0;
    if (now < lockUntil) return;

    if (resolved.kind === 'player') {
      const targetPlayer = resolved.player;
      this._smoothRotateEnemyTowardPoint(valkyrie, targetPlayer.position);
      this._queueMoveIfChanged(valkyrie.id, valkyrie.position, valkyrie.rotation);

      const lastJudgment = this.valkyrieJudgmentCooldown.get(valkyrie.id) || 0;
      const judgmentReady = now - lastJudgment >= VALKYRIE_JUDGMENT_COOLDOWN_MS;
      if (judgmentReady && distance <= VALKYRIE_JUDGMENT_CAST_RANGE) {
        if (this.valkyrieCastJudgment(valkyrie, targetPlayer, true)) return;
      }

      const last1 = this.valkyrieLunge1Cooldown.get(valkyrie.id) || 0;
      const last2 = this.valkyrieLunge2Cooldown.get(valkyrie.id) || 0;
      const lunge1Ready = now - last1 >= VALKYRIE_LUNGE1_COOLDOWN_MS;
      const lunge2Ready = now - last2 >= VALKYRIE_LUNGE2_COOLDOWN_MS;

      if (lunge1Ready && distance <= VALKYRIE_LUNGE_CAST_RANGE) {
        if (this.tryEnemySpinLunge(valkyrie, targetPlayer, now, distance, {
          cooldownMap: this.valkyrieLunge1Cooldown,
          cooldownMs: VALKYRIE_LUNGE1_COOLDOWN_MS,
          castRange: VALKYRIE_LUNGE_CAST_RANGE,
          chargeMs: VALKYRIE_LUNGE_CHARGE_MS,
          travelMs: VALKYRIE_LUNGE_TRAVEL_MS,
          lungeDistance: VALKYRIE_LUNGE1_DISTANCE,
          damage: VALKYRIE_LUNGE1_DAMAGE,
          stripHalfWidth: VALKYRIE_LUNGE_STRIP_HALF_WIDTH,
          chargeEvent: 'valkyrie-lunge-charge',
          dashEvent: 'valkyrie-lunge-dash',
          hitEvent: 'valkyrie-lunge-hit',
          idField: 'valkyrieId',
          variant: 1,
        })) return;
      }

      if (lunge2Ready && distance <= VALKYRIE_LUNGE_CAST_RANGE) {
        if (this.tryEnemySpinLunge(valkyrie, targetPlayer, now, distance, {
          cooldownMap: this.valkyrieLunge2Cooldown,
          cooldownMs: VALKYRIE_LUNGE2_COOLDOWN_MS,
          castRange: VALKYRIE_LUNGE_CAST_RANGE,
          chargeMs: VALKYRIE_LUNGE_CHARGE_MS,
          travelMs: VALKYRIE_LUNGE_TRAVEL_MS,
          lungeDistance: VALKYRIE_LUNGE2_DISTANCE,
          damage: VALKYRIE_LUNGE2_DAMAGE,
          stripHalfWidth: VALKYRIE_LUNGE_STRIP_HALF_WIDTH,
          chargeEvent: 'valkyrie-lunge-charge',
          dashEvent: 'valkyrie-lunge-dash',
          hitEvent: 'valkyrie-lunge-hit',
          idField: 'valkyrieId',
          variant: 2,
        })) return;
      }
    } else if (resolved.kind === 'zombie') {
      const z = resolved.zombie;
      const fakeTarget = { id: z.id, position: z.position, health: z.health };
      this._smoothRotateEnemyTowardPoint(valkyrie, z.position);
      this._queueMoveIfChanged(valkyrie.id, valkyrie.position, valkyrie.rotation);

      const lastJudgment = this.valkyrieJudgmentCooldown.get(valkyrie.id) || 0;
      const judgmentReady = now - lastJudgment >= VALKYRIE_JUDGMENT_COOLDOWN_MS;
      if (judgmentReady && distance <= VALKYRIE_JUDGMENT_CAST_RANGE) {
        if (this.valkyrieCastJudgment(valkyrie, fakeTarget, false)) return;
      }

      const last1 = this.valkyrieLunge1Cooldown.get(valkyrie.id) || 0;
      const last2 = this.valkyrieLunge2Cooldown.get(valkyrie.id) || 0;
      const lunge1Ready = now - last1 >= VALKYRIE_LUNGE1_COOLDOWN_MS;
      const lunge2Ready = now - last2 >= VALKYRIE_LUNGE2_COOLDOWN_MS;

      if (lunge1Ready && distance <= VALKYRIE_LUNGE_CAST_RANGE) {
        if (this.tryEnemySpinLunge(valkyrie, fakeTarget, now, distance, {
          cooldownMap: this.valkyrieLunge1Cooldown,
          cooldownMs: VALKYRIE_LUNGE1_COOLDOWN_MS,
          castRange: VALKYRIE_LUNGE_CAST_RANGE,
          chargeMs: VALKYRIE_LUNGE_CHARGE_MS,
          travelMs: VALKYRIE_LUNGE_TRAVEL_MS,
          lungeDistance: VALKYRIE_LUNGE1_DISTANCE,
          damage: VALKYRIE_LUNGE1_DAMAGE,
          stripHalfWidth: VALKYRIE_LUNGE_STRIP_HALF_WIDTH,
          chargeEvent: 'valkyrie-lunge-charge',
          dashEvent: 'valkyrie-lunge-dash',
          hitEvent: 'valkyrie-lunge-hit',
          idField: 'valkyrieId',
          variant: 1,
        })) return;
      }

      if (lunge2Ready && distance <= VALKYRIE_LUNGE_CAST_RANGE) {
        if (this.tryEnemySpinLunge(valkyrie, fakeTarget, now, distance, {
          cooldownMap: this.valkyrieLunge2Cooldown,
          cooldownMs: VALKYRIE_LUNGE2_COOLDOWN_MS,
          castRange: VALKYRIE_LUNGE_CAST_RANGE,
          chargeMs: VALKYRIE_LUNGE_CHARGE_MS,
          travelMs: VALKYRIE_LUNGE_TRAVEL_MS,
          lungeDistance: VALKYRIE_LUNGE2_DISTANCE,
          damage: VALKYRIE_LUNGE2_DAMAGE,
          stripHalfWidth: VALKYRIE_LUNGE_STRIP_HALF_WIDTH,
          chargeEvent: 'valkyrie-lunge-charge',
          dashEvent: 'valkyrie-lunge-dash',
          hitEvent: 'valkyrie-lunge-hit',
          idField: 'valkyrieId',
          variant: 2,
        })) return;
      }
    } else if (resolved.kind === 'hostile') {
      const targetEnemy = resolved.enemy;
      this._smoothRotateEnemyTowardPoint(valkyrie, targetEnemy.position);
      this._queueMoveIfChanged(valkyrie.id, valkyrie.position, valkyrie.rotation);

      const lastJudgment = this.valkyrieJudgmentCooldown.get(valkyrie.id) || 0;
      const judgmentReady = now - lastJudgment >= VALKYRIE_JUDGMENT_COOLDOWN_MS;
      if (judgmentReady && distance <= VALKYRIE_JUDGMENT_CAST_RANGE) {
        if (this.valkyrieCastJudgment(valkyrie, this.fakeTargetFromEnemy(targetEnemy), false)) return;
      }

      const last1 = this.valkyrieLunge1Cooldown.get(valkyrie.id) || 0;
      const last2 = this.valkyrieLunge2Cooldown.get(valkyrie.id) || 0;
      const lunge1Ready = now - last1 >= VALKYRIE_LUNGE1_COOLDOWN_MS;
      const lunge2Ready = now - last2 >= VALKYRIE_LUNGE2_COOLDOWN_MS;

      if (lunge1Ready && distance <= VALKYRIE_LUNGE_CAST_RANGE) {
        if (this.tryEnemySpinLungeVsHostile(valkyrie, targetEnemy, now, distance, {
          cooldownMap: this.valkyrieLunge1Cooldown,
          cooldownMs: VALKYRIE_LUNGE1_COOLDOWN_MS,
          castRange: VALKYRIE_LUNGE_CAST_RANGE,
          chargeMs: VALKYRIE_LUNGE_CHARGE_MS,
          travelMs: VALKYRIE_LUNGE_TRAVEL_MS,
          lungeDistance: VALKYRIE_LUNGE1_DISTANCE,
          damage: VALKYRIE_LUNGE1_DAMAGE,
          stripHalfWidth: VALKYRIE_LUNGE_STRIP_HALF_WIDTH,
          chargeEvent: 'valkyrie-lunge-charge',
          dashEvent: 'valkyrie-lunge-dash',
          hitEvent: 'valkyrie-lunge-hit',
          idField: 'valkyrieId',
          variant: 1,
          hostileDamageType: 'valkyrie_lunge',
        })) return;
      }

      if (lunge2Ready && distance <= VALKYRIE_LUNGE_CAST_RANGE) {
        if (this.tryEnemySpinLungeVsHostile(valkyrie, targetEnemy, now, distance, {
          cooldownMap: this.valkyrieLunge2Cooldown,
          cooldownMs: VALKYRIE_LUNGE2_COOLDOWN_MS,
          castRange: VALKYRIE_LUNGE_CAST_RANGE,
          chargeMs: VALKYRIE_LUNGE_CHARGE_MS,
          travelMs: VALKYRIE_LUNGE_TRAVEL_MS,
          lungeDistance: VALKYRIE_LUNGE2_DISTANCE,
          damage: VALKYRIE_LUNGE2_DAMAGE,
          stripHalfWidth: VALKYRIE_LUNGE_STRIP_HALF_WIDTH,
          chargeEvent: 'valkyrie-lunge-charge',
          dashEvent: 'valkyrie-lunge-dash',
          hitEvent: 'valkyrie-lunge-hit',
          idField: 'valkyrieId',
          variant: 2,
          hostileDamageType: 'valkyrie_lunge',
        })) return;
      }
    }

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    valkyrie.moveSpeed = VALKYRIE_WALK_SPEED;
    this.moveEnemyTowardsTarget(valkyrie, moveTarget, { meleeSurroundAttackRange: VALKYRIE_JUDGMENT_CAST_RANGE });
  }

  telegraphNemesisAttack(nemesis, target, attackVariant) {
    if (this.io) {
      this.io.to(this.roomId).emit('nemesis-attack-telegraph', {
        nemesisId: nemesis.id,
        ...this._meleeTelegraphTargetFields(target),
        attackVariant,
        position: nemesis.position,
        timestamp: Date.now(),
      });
    }
  }

  nemesisAttackHostileEnemy(nemesis, targetEnemy) {
    const damage = nemesis.damage || 72;
    this.damageHostileMobFromMob(nemesis, targetEnemy, damage, 'nemesis_melee');
  }

  nemesisAttackPlayer(nemesis, player) {
    if (this.coopTransitionBlocksOutgoingPlayerHits()) return;
    const damage = nemesis.damage || 72;
    this.recordAlliedProtectionThreat(nemesis.id, player.id, damage);
    if (this.io) {
      this.io.to(this.roomId).emit('nemesis-attack', {
        nemesisId: nemesis.id,
        targetPlayerId: player.id,
        damage,
        position: nemesis.position,
        timestamp: Date.now(),
      });
      const dx = player.position.x - nemesis.position.x;
      const dz = player.position.z - nemesis.position.z;
      const len = Math.hypot(dx, dz) || 1;
      this.io.to(this.roomId).emit('player-knockback', {
        targetPlayerId: player.id,
        direction: { x: dx / len, y: 0, z: dz / len },
        distance: NEMESIS_KNOCKBACK_DISTANCE,
        duration: NEMESIS_KNOCKBACK_DURATION,
        coopRoomEntryToken: this.room?.getCoopRoomEntryToken?.() ?? 0,
        timestamp: Date.now(),
      });
    }
    this.room?.tryDamageAlliedKnightInXZDisk(
      { x: nemesis.position.x, z: nemesis.position.z },
      NEMESIS_ATTACK_RANGE,
      damage,
      { sourceEnemyId: nemesis.id, damageType: 'nemesis_melee' },
    );
  }

  updateNemesisAI(nemesis, players) {
    let aggroData = this.enemyAggro.get(nemesis.id);
    if (!aggroData) {
      const closest = this.findClosestCombatantForNemesis(nemesis, players);
      if (!closest) return;
      aggroData = {
        targetPlayerId: closest.kind === 'player' ? closest.player.id : null,
        targetZombieId: null,
        targetTrapId: null,
        targetHostileEnemyId: closest.kind === 'hostile' ? closest.enemy.id : null,
        lastUpdate: Date.now(),
        aggro: 0,
        isAggroed: false,
        threatFromDamage: false,
        directPlayerDamageAggroed: false,
      };
      this.enemyAggro.set(nemesis.id, aggroData);
    }

    const now = Date.now();
    const lockUntil = this.meleeLockUntil.get(nemesis.id) || 0;
    if (now < lockUntil) {
      this.tickMeleeSwingWindup(nemesis);
      return;
    }

    const nemesisProfile = getMeleeProfile('nemesis');
    const attackRange = nemesisProfile?.range ?? NEMESIS_ATTACK_RANGE;
    const aggroRadius = NEMESIS_AGGRO_RADIUS;
    const leashRadius = this.getCombatLeashRadius(aggroData, aggroRadius);

    if (!aggroData.isAggroed) {
      const closest = this.findClosestCombatantForNemesis(nemesis, players);
      if (closest) {
        aggroData.isAggroed = true;
        aggroData.targetZombieId = null;
        aggroData.targetTrapId = null;
        if (closest.kind === 'player') {
          aggroData.targetPlayerId = closest.player.id;
          aggroData.targetHostileEnemyId = null;
        } else {
          aggroData.targetHostileEnemyId = closest.enemy.id;
        }
      }
    }

    if (!aggroData.isAggroed) return;

    const resolved = this.resolveAggroCombatTarget(aggroData, nemesis, players);
    if (!resolved) {
      aggroData.isAggroed = false;
      return;
    }

    const moveTarget = this.aggroTargetToMoveTarget(resolved);
    const tpos = this.combatTargetPosition(resolved);
    const distance = this.calculateDistance(nemesis.position, tpos);

    if (aggroData.isAggroed && distance > leashRadius && !aggroData.threatFromDamage && !aggroData.directPlayerDamageAggroed) {
      aggroData.isAggroed = false;
      aggroData.threatFromDamage = false;
      return;
    }

    this.tryMeleeEngage(nemesis, resolved, moveTarget, nemesisProfile, { now, distance });
  }

  removeEnemyAggro(enemyId) {
    this.clearHostileEnemyAsAggroTarget(enemyId);
    this._clearEnemyTimeouts(enemyId);
    this._clearEnemyHazardIntervals(enemyId);
    this._closestPlayerCache.delete(enemyId);
    this.wolfHowlEmitted.delete(enemyId);
    this.boneSpiderShotCooldown.delete(enemyId);
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
    const hadBoss3GreenBeam =
      this.boss3GreenBeamDamageInterval.has(enemyId) || this.boss3GreenBeamEndAt.has(enemyId);
    const b3gb = this.boss3GreenBeamDamageInterval.get(enemyId);
    if (b3gb) clearInterval(b3gb);
    this.boss3GreenBeamDamageInterval.delete(enemyId);
    this.boss3GreenBeamEndAt.delete(enemyId);
    this.boss3GreenBeamStages.delete(enemyId);
    if (hadBoss3GreenBeam && this.io) {
      this.io.to(this.roomId).emit('boss3-green-beam-end', {
        bossId: enemyId,
        timestamp: Date.now(),
      });
    }
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
    this.wraithStealthCooldown.delete(enemyId);
    this.wraithBuzzsawCooldown.delete(enemyId);
    const wraithStealth = this.wraithStealthState.get(enemyId);
    if (wraithStealth?.revealTimeout) clearTimeout(wraithStealth.revealTimeout);
    this.wraithStealthState.delete(enemyId);
    this.enemyLastQueuedMove.delete(enemyId);
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
    this.enchantressEarthShockCooldown.delete(enemyId);
    this.enchantressGraspingVinesCooldown.delete(enemyId);
    this.meleeLockUntil.delete(enemyId);
    this.knightAbilityCooldown.delete(enemyId);
    this.knightSmiteCooldown.delete(enemyId);
    this.knightDashCooldown.delete(enemyId);
    this.knightSpinCooldown.delete(enemyId);
    this.assassinSpinCooldown.delete(enemyId);
    this.assassinBowCooldown.delete(enemyId);
    const assassinFollowupT = this.assassinFollowupTimeout.get(enemyId);
    if (assassinFollowupT) clearTimeout(assassinFollowupT);
    this.assassinFollowupTimeout.delete(enemyId);
    this.assassinEvadeCooldown.delete(enemyId);
    this.assassinDreamshroudCooldown.delete(enemyId);
    if (this.assassinDreamshroudState.has(enemyId)) {
      this.revealAssassinDreamshroud(enemyId, 'death');
    }
    this.nemesisAttackCooldown.delete(enemyId);
    this.valkyrieLunge1Cooldown.delete(enemyId);
    this.valkyrieLunge2Cooldown.delete(enemyId);
    this.valkyrieJudgmentCooldown.delete(enemyId);
    this.sentinelEntangleCooldown.delete(enemyId);
    this.sentinelEntangleMoveLockUntil.delete(enemyId);
    this.sentinelOrbCooldown.delete(enemyId);
    this.palaceHeavyAttackCooldown.delete(enemyId);
    this.eternalOakEarthbreakerCooldown.delete(enemyId);
    const eternalOakEbT = this.eternalOakEarthbreakerTimeout.get(enemyId);
    if (eternalOakEbT) clearTimeout(eternalOakEbT);
    this.eternalOakEarthbreakerTimeout.delete(enemyId);
    const spectreWhirlwindEndT = this.spectreWhirlwindEndTimeout.get(enemyId);
    if (spectreWhirlwindEndT) {
      clearTimeout(spectreWhirlwindEndT);
      this.spectreWhirlwindEndTimeout.delete(enemyId);
      if (this.io) {
        this.io.to(this.roomId).emit('spectre-whirlwind-end', {
          spectreId: enemyId,
          timestamp: Date.now(),
        });
      }
    }
    this.spectreWhirlwindCooldown.delete(enemyId);
    const deathKnightHeartstrikeEndT = this.deathKnightHeartstrikeEndTimeout.get(enemyId);
    if (deathKnightHeartstrikeEndT) {
      clearTimeout(deathKnightHeartstrikeEndT);
      this.deathKnightHeartstrikeEndTimeout.delete(enemyId);
      if (this.io) {
        this.io.to(this.roomId).emit('death-knight-heartstrike-end', {
          deathKnightId: enemyId,
          timestamp: Date.now(),
        });
      }
    }
    this.deathKnightHeartstrikeCooldown.delete(enemyId);
    const deathKnightFrostPillarsEndT = this.deathKnightFrostPillarsEndTimeout.get(enemyId);
    if (deathKnightFrostPillarsEndT) {
      clearTimeout(deathKnightFrostPillarsEndT);
      this.deathKnightFrostPillarsEndTimeout.delete(enemyId);
      if (this.io) {
        this.io.to(this.roomId).emit('death-knight-frost-pillars-end', {
          deathKnightId: enemyId,
          timestamp: Date.now(),
        });
      }
    }
    this.clearDeathKnightFrostPillarTimers(enemyId);
    this.deathKnightFrostPillarsCooldown.delete(enemyId);
    const shamanStormShockEndT = this.shamanStormShockEndTimeout.get(enemyId);
    if (shamanStormShockEndT) {
      clearTimeout(shamanStormShockEndT);
      this.shamanStormShockEndTimeout.delete(enemyId);
      if (this.io) {
        this.io.to(this.roomId).emit('shaman-storm-shock-end', {
          shamanId: enemyId,
          timestamp: Date.now(),
        });
      }
    }
    const shamanStormShockZapT = this.shamanStormShockZapTimeout.get(enemyId);
    if (shamanStormShockZapT) {
      clearTimeout(shamanStormShockZapT);
      this.shamanStormShockZapTimeout.delete(enemyId);
    }
    this.shamanStormShockCooldown.delete(enemyId);
    this.shamanSpiritWolvesCooldown.delete(enemyId);
    const spiritWolvesSpawnT = this.shamanSpiritWolvesSpawnTimeout.get(enemyId);
    if (spiritWolvesSpawnT) {
      clearTimeout(spiritWolvesSpawnT);
      this.shamanSpiritWolvesSpawnTimeout.delete(enemyId);
    }
    this.shamanSummonedWolves.delete(enemyId);
    // If a spirit wolf dies, free its slot so the shaman can resummon.
    this.shamanSummonedWolves.forEach((wolfSet, shamanId) => {
      if (wolfSet && wolfSet.has(enemyId)) {
        wolfSet.delete(enemyId);
        _enemyAiLog(`🐺 Shaman ${shamanId} spirit wolf ${enemyId} died — slot freed`);
      }
    });
    const wyvernBreathEndT = this.wyvernBreathEndTimeout.get(enemyId);
    if (wyvernBreathEndT) {
      clearTimeout(wyvernBreathEndT);
      this.wyvernBreathEndTimeout.delete(enemyId);
      if (this.io) {
        this.io.to(this.roomId).emit('wyvern-breath-end', {
          wyvernId: enemyId,
          timestamp: Date.now(),
        });
      }
    }
    const wyvernBreathLaunchTs = this.wyvernBreathLaunchTimeout.get(enemyId);
    if (wyvernBreathLaunchTs) {
      for (const h of wyvernBreathLaunchTs) clearTimeout(h);
      this.wyvernBreathLaunchTimeout.delete(enemyId);
    }
    this.wyvernBreathCooldown.delete(enemyId);
    const destinyBreathEndT = this.destinyBreathEndTimeout.get(enemyId);
    if (destinyBreathEndT) {
      clearTimeout(destinyBreathEndT);
      this.destinyBreathEndTimeout.delete(enemyId);
      if (this.io) {
        this.io.to(this.roomId).emit('destiny-breath-end', {
          destinyId: enemyId,
          timestamp: Date.now(),
        });
      }
    }
    const destinyBreathLaunchTs = this.destinyBreathLaunchTimeout.get(enemyId);
    if (destinyBreathLaunchTs) {
      for (const h of destinyBreathLaunchTs) clearTimeout(h);
      this.destinyBreathLaunchTimeout.delete(enemyId);
    }
    this.destinyBreathCooldown.delete(enemyId);
    const destinyWingEndT = this.destinyWingEndTimeout.get(enemyId);
    if (destinyWingEndT) {
      clearTimeout(destinyWingEndT);
      this.destinyWingEndTimeout.delete(enemyId);
      if (this.io) {
        this.io.to(this.roomId).emit('destiny-wing-end', {
          destinyId: enemyId,
          timestamp: Date.now(),
        });
      }
    }
    this.clearDestinyWingPillarTimers(enemyId);
    this.destinyWingCooldown.delete(enemyId);
    this.destinyGroundSpecialReadyAt.delete(enemyId);
    const dyingDestiny = this.room?.getEnemy?.(enemyId);
    if (dyingDestiny) {
      dyingDestiny.wingActive = false;
      dyingDestiny.wingCastId = null;
    }
    const destinyFlyAttackEndT = this.destinyFlyAttackEndTimeout.get(enemyId);
    if (destinyFlyAttackEndT) {
      clearTimeout(destinyFlyAttackEndT);
      this.destinyFlyAttackEndTimeout.delete(enemyId);
    }
    const destinyFlyAttackLaunchTs = this.destinyFlyAttackLaunchTimeout.get(enemyId);
    if (destinyFlyAttackLaunchTs) {
      for (const h of destinyFlyAttackLaunchTs) clearTimeout(h);
      this.destinyFlyAttackLaunchTimeout.delete(enemyId);
    }
    this.destinyFlyAttackCooldown.delete(enemyId);
    const stormLashHandles = this.knightStormLashTimeouts.get(enemyId);
    if (stormLashHandles) {
      for (const h of stormLashHandles) clearTimeout(h);
    }
    this.knightStormLashTimeouts.delete(enemyId);
    this.knightStormLashActiveUntil.delete(enemyId);
    const frostStormHandles = this.frostQueenIceStormTimeouts.get(enemyId);
    const hadFrostStorm =
      !!frostStormHandles || this.frostQueenIceStormActiveUntil.has(enemyId);
    if (frostStormHandles) {
      for (const h of frostStormHandles) clearTimeout(h);
    }
    this.frostQueenIceStormTimeouts.delete(enemyId);
    this.frostQueenIceStormActiveUntil.delete(enemyId);
    if (hadFrostStorm && this.io) {
      this.io.to(this.roomId).emit('frost-queen-ice-storm-end', {
        frostQueenId: enemyId,
        interrupted: true,
        timestamp: Date.now(),
      });
    }
    this.frostQueenTeleportCooldown.delete(enemyId);
    this.frostQueenIceShardsCooldown.delete(enemyId);
    this.frostQueenIceStormCooldown.delete(enemyId);
    this.clearMedusaProjectileIntervals(enemyId);
    this.medusaRapidfireCooldown.delete(enemyId);
    this.medusaVoidWarpCooldown.delete(enemyId);
    this.medusaMeteorCooldown.delete(enemyId);
    this.medusaVoidWarpActiveUntil.delete(enemyId);
    this.clearKnightDeathGraspTimers(enemyId);
    this.knightBlockCooldown.delete(enemyId);
    this.knightBlockActiveUntil.delete(enemyId);
    this.knightBlockStages.delete(enemyId);
    this.enemyPaths.delete(enemyId);
    this.templarBlinkSmiteNextAt.delete(enemyId);
    this.templarLeapCooldown.delete(enemyId);
    this.templarLeapEndAt.delete(enemyId);
    this.templarLeapLand.delete(enemyId);
    this.templarLeapFrom.delete(enemyId);
    const templarLeapT = this.templarLeapTimeout.get(enemyId);
    if (templarLeapT) clearTimeout(templarLeapT);
    this.templarLeapTimeout.delete(enemyId);
    this.tigerPounceCooldown.delete(enemyId);
    this.tigerPounceEndAt.delete(enemyId);
    this.tigerPounceLand.delete(enemyId);
    this.tigerPounceFrom.delete(enemyId);
    const tigerPounceT = this.tigerPounceTimeout.get(enemyId);
    if (tigerPounceT) clearTimeout(tigerPounceT);
    this.tigerPounceTimeout.delete(enemyId);

    // If a ghoul dies, clear it from its summoner's slot so the weaver can resummon
    this.weaverSummonedGhouls.forEach((ghoulId, weaverId) => {
      if (ghoulId === enemyId) {
        this.weaverSummonedGhouls.set(weaverId, null);
        _enemyAiLog(`🧵 Weaver ${weaverId} ghoul ${enemyId} died — resummon available`);
      }
    });

    this.enemyTaunts.delete(enemyId);
    this.alliedProtectionThreat.delete(enemyId);
    this.alliedProtectionThreat.forEach((chart) => {
      if (chart) chart.delete(enemyId);
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
    if (enemy && (enemy.type === 'boss' || enemy.type === 'boss2' || enemy.type === 'boss3' || enemy.type === 'destiny')) {
      // Initialize damage tracking if does not exist
      if (!this.bossDamageTracking.has(enemyId)) {
        this.bossDamageTracking.set(enemyId, new Map());
      }
      const damageMap = this.bossDamageTracking.get(enemyId);
      const currentDamage = damageMap.get(taunterPlayerId) || 0;
      damageMap.set(taunterPlayerId, currentDamage + 1000); // Large damage bonus for taunt
      _enemyAiLog(`🎯 Boss ${enemyId} taunted by player ${taunterPlayerId} for ${duration/1000} seconds (damage bonus: +1000)`);
    } else {
      // For regular enemies, use regular aggro system
      this.updateAggro(enemyId, taunterPlayerId, 1000); // Large aggro bonus
      _enemyAiLog(`🎯 Enemy ${enemyId} taunted by player ${taunterPlayerId} for ${duration/1000} seconds (aggro priority)`);
    }
  }

  /**
   * Player Death Grasp — snap enemy to standoff in front of caster and notify clients for lerp VFX.
   */
  playerDeathGraspPull(enemyId, casterId, pullPosition, durationMs = 600) {
    const enemy = this.room?.enemies?.get(enemyId);
    if (!enemy || enemy.isDying || (enemy.health ?? 0) <= 0) return false;
    if (!pullPosition) return false;

    enemy.position = {
      x: pullPosition.x,
      y: pullPosition.y ?? enemy.position.y,
      z: pullPosition.z,
    };

    // Face caster after pull
    const caster = this.room?.players?.get(casterId);
    if (caster?.position) {
      const dx = caster.position.x - enemy.position.x;
      const dz = caster.position.z - enemy.position.z;
      if (dx !== 0 || dz !== 0) {
        enemy.rotation = Math.atan2(dx, dz);
      }
    }

    // Brief AI lock so they don't immediately walk away mid-return VFX
    this.meleeLockUntil.set(enemyId, Date.now() + durationMs);

    this._queueMove(enemyId, enemy.position, enemy.rotation ?? 0);

    if (this.io) {
      this.io.to(this.roomId).emit('player-deathgrasp-pull', {
        enemyId,
        casterId,
        pullPosition: { ...enemy.position },
        durationMs,
        timestamp: Date.now(),
      });
    }
    _enemyAiLog(`💀 Player ${casterId} Death Grasp pulled enemy ${enemyId}`);
    return true;
  }

  // Check if enemy is currently taunted
  isEnemyTaunted(enemyId) {
    const tauntData = this.enemyTaunts.get(enemyId);
    if (!tauntData) return false;

    // Check if taunt has expired
    if (Date.now() > tauntData.tauntEndTime) {
      _enemyAiLog(`⏰ Taunt expired for enemy ${enemyId}`);
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

  clearHostileEnemyAsAggroTarget(hostileEnemyId) {
    this.enemyAggro.forEach((data) => {
      if (data.targetHostileEnemyId === hostileEnemyId) {
        data.targetHostileEnemyId = null;
        data.duelAggroLocked = false;
      }
    });
  }

  /**
   * Threat from Nemesis ↔ camp mob combat — mob focuses the hostile enemy.
   * @param {{ skipPlayerFallback?: boolean, duelAggroLocked?: boolean }} [options]
   */
  applyHostileEnemyThreat(defenderEnemyId, attackerId, aggroAmount = 50, options = null) {
    const attacker = this.room?.enemies?.get?.(attackerId);
    const defender = this.room?.enemies?.get?.(defenderEnemyId);
    if (!attacker || !defender) return;
    if (!this.isValidHostileEnemyAggroTarget(defender, attacker)) return;

    const skipPlayerFallback = !!options?.skipPlayerFallback;
    const duelAggroLocked = !!options?.duelAggroLocked;

    let fallbackPlayerId = null;
    if (!skipPlayerFallback) {
      const players = this.room?.getPlayers?.();
      if (players && defender) {
        const closest = this.findClosestPlayer(defender, players);
        if (closest) fallbackPlayerId = closest.id;
      }
    }

    let aggroData = this.enemyAggro.get(defenderEnemyId);
    if (!aggroData) {
      aggroData = {
        targetPlayerId: fallbackPlayerId,
        targetZombieId: null,
        targetTrapId: null,
        targetHostileEnemyId: attackerId,
        lastUpdate: Date.now(),
        aggro: 100,
      };
      this.enemyAggro.set(defenderEnemyId, aggroData);
    }

    aggroData.targetHostileEnemyId = attackerId;
    aggroData.targetZombieId = null;
    aggroData.targetTrapId = null;
    if (skipPlayerFallback) {
      aggroData.targetPlayerId = null;
    } else if (fallbackPlayerId) {
      aggroData.targetPlayerId = fallbackPlayerId;
    }
    aggroData.aggro += aggroAmount;
    aggroData.lastUpdate = Date.now();
    aggroData.isAggroed = true;
    aggroData.threatFromDamage = true;
    aggroData.directPlayerDamageAggroed = false;
    if (duelAggroLocked) aggroData.duelAggroLocked = true;
  }

  /**
   * @param {{ skipPlayerFallback?: boolean, duelAggroLocked?: boolean }} [options]
   */
  applyNemesisRetaliationThreat(nemesisId, attackerId, aggroAmount = 50, options = null) {
    const nemesis = this.room?.enemies?.get?.(nemesisId);
    const attacker = this.room?.enemies?.get?.(attackerId);
    if (!nemesis || nemesis.type !== 'nemesis' || !this.isValidAttackerOnNemesis(attacker)) return;

    const skipPlayerFallback = !!options?.skipPlayerFallback;
    const duelAggroLocked = !!options?.duelAggroLocked;

    let aggroData = this.enemyAggro.get(nemesisId);
    if (!aggroData) {
      let closestPlayerId = null;
      if (!skipPlayerFallback) {
        const players = this.room?.getPlayers?.() || [];
        const closestPlayer = this.findClosestPlayer(nemesis, players);
        closestPlayerId = closestPlayer?.id ?? null;
      }
      aggroData = {
        targetPlayerId: closestPlayerId,
        targetZombieId: null,
        targetTrapId: null,
        targetHostileEnemyId: attackerId,
        lastUpdate: Date.now(),
        aggro: 0,
        isAggroed: false,
        threatFromDamage: false,
        directPlayerDamageAggroed: false,
      };
      this.enemyAggro.set(nemesisId, aggroData);
    }

    aggroData.targetHostileEnemyId = attackerId;
    aggroData.targetZombieId = null;
    aggroData.targetTrapId = null;
    if (skipPlayerFallback) aggroData.targetPlayerId = null;
    aggroData.aggro += aggroAmount;
    aggroData.lastUpdate = Date.now();
    aggroData.isAggroed = true;
    aggroData.threatFromDamage = true;
    aggroData.directPlayerDamageAggroed = false;
    if (duelAggroLocked) aggroData.duelAggroLocked = true;
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
    aggroData.targetHostileEnemyId = null;
    if (fallbackPlayerId) aggroData.targetPlayerId = fallbackPlayerId;
    aggroData.aggro += aggroAmount;
    aggroData.lastUpdate = Date.now();
    aggroData.isAggroed = true;
    aggroData.threatFromDamage = true;
    aggroData.directPlayerDamageAggroed = false;
  }

  _countEnemiesTargetingUnit(unitId) {
    if (!unitId) return 0;
    let count = 0;
    this.enemyAggro.forEach((data) => {
      if (data.targetZombieId === unitId || data.targetTrapId === unitId || data.targetHostileEnemyId === unitId) count += 1;
    });
    return count;
  }

  /** Solo or direct player damage: prefer player over allied-knight redirect when close. */
  _shouldPreferPlayerOverAlly(moverEnemy, players) {
    if (!players?.length || !moverEnemy?.position) return false;
    const closest = this.findClosestPlayer(moverEnemy, players);
    if (!closest?.position || closest.health <= 0) return false;
    const dist = this.calculateDistance(moverEnemy.position, closest.position);
    if (dist > PLAYER_PROXIMITY_AGGRO_OVERRIDE_RADIUS) return false;
    return players.length === 1;
  }

  /** Clear trap/zombie focus so a fresh room starts player-targeted until threat is earned. */
  clearNonPlayerAggroTargets() {
    this.enemyAggro.forEach((data) => {
      data.targetZombieId = null;
      data.targetTrapId = null;
      data.targetHostileEnemyId = null;
      data.duelAggroLocked = false;
    });
  }

  /** Dev-only: dump aggro target breakdown shortly after portal wave spawn. */
  scheduleAggroDebugSnapshot(label = 'room-entry') {
    if (process.env.NODE_ENV === 'production') return;
    if (this._aggroDebugSnapshotTimer) {
      clearTimeout(this._aggroDebugSnapshotTimer);
    }
    this._aggroDebugSnapshotTimer = this._scheduleTimeout(() => {
      this._aggroDebugSnapshotTimer = null;
      const rows = [];
      this.enemyAggro.forEach((data, enemyId) => {
        let focus = 'player';
        if (data.targetTrapId) focus = `trap:${data.targetTrapId}`;
        else if (data.targetHostileEnemyId) focus = `hostile:${data.targetHostileEnemyId}`;
        else if (data.targetZombieId) focus = `ally:${data.targetZombieId}`;
        rows.push({
          enemyId,
          focus,
          isAggroed: !!data.isAggroed,
          targetPlayerId: data.targetPlayerId ?? null,
        });
      });
      _enemyAiLog(`📊 Aggro snapshot (${label}):`, rows);
    }, AGGRO_DEBUG_SNAPSHOT_DELAY_MS);
  }

  applyAlliedUnitThreat(defenderEnemyId, allyId, aggroAmount = 50) {
    const ally = this.room?.enemies?.get?.(allyId);
    // Vengeful Spirits are untargetable — redirect threat to their owner instead.
    if (ally?.type === 'vengeful-spirit') {
      const ownerId = ally.ownerPlayerId;
      if (ownerId) this.updateAggro(defenderEnemyId, ownerId, aggroAmount);
      return;
    }
    if (!this._isPlayerCombatAlly(ally) || ally.isDying || ally.health <= 0) return;

    const existing = this.enemyAggro.get(defenderEnemyId);
    const alreadyOnKnight = existing?.targetZombieId === allyId;
    const knightFocusCount = this._countEnemiesTargetingUnit(allyId);
    if (!alreadyOnKnight && knightFocusCount >= ALLIED_KNIGHT_FOCUS_SOFT_CAP) {
      if (existing) {
        existing.aggro += Math.max(aggroAmount, 50);
        existing.lastUpdate = Date.now();
        existing.isAggroed = true;
      }
      _enemyAiLog(
        `🛡️ Allied-knight threat soft-capped for ${defenderEnemyId} (${knightFocusCount}/${ALLIED_KNIGHT_FOCUS_SOFT_CAP} on ${allyId})`,
      );
      return;
    }

    this.applyZombieThreat(defenderEnemyId, allyId, Math.max(aggroAmount * 2, 100));
    _enemyAiLog(`🛡️ Allied-knight threat: ${defenderEnemyId} → ${allyId} (focus ${knightFocusCount + 1})`);
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

    const selfEnemy = this.room?.enemies?.get?.(defenderEnemyId);
    if (selfEnemy && this._isPlayerCombatAlly(selfEnemy)) {
      this._recordAlliedTrapThreat(defenderEnemyId, trapId);
      selfEnemy.combatInitiated = true;
      selfEnemy.alliedTargetEnemyId = trapId;
      return;
    }

    const players = this.room?.getPlayers?.();
    let fallbackPlayerId = null;
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
    aggroData.targetHostileEnemyId = null;
    if (fallbackPlayerId) aggroData.targetPlayerId = fallbackPlayerId;
    aggroData.aggro += aggroAmount;
    aggroData.lastUpdate = Date.now();
    _enemyAiLog(`🦴 Trap threat: ${defenderEnemyId} → ${trapId}`);
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

    for (const e of this.room.enemies.values()) {
      if (!e || e.id === trap.id || e.isDying || e.health <= 0) continue;
      if (e.type === 'tentacle-spine' || e.type === 'training-dummy') continue;
      if (e.type === 'boss' || e.type === 'boss2' || e.type === 'boss3' || e.type === 'destiny' || e.type === 'boss-skeleton') continue;
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
    const tid = this._scheduleTimeout(() => {
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
    for (const e of this.room.enemies.values()) {
      if (!e || e.id === trapId || e.isDying || e.health <= 0) continue;
      if (e.type === 'tentacle-spine' || e.type === 'training-dummy') continue;
      if (e.type === 'boss' || e.type === 'boss2' || e.type === 'boss3' || e.type === 'destiny' || e.type === 'boss-skeleton') continue;
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
   * Prefer structure → trap → hostile enemy → zombie → player.
   * @returns {{ kind: 'player', player: object } | { kind: 'zombie', zombie: object } | { kind: 'trap', trap: object } | { kind: 'hostile', enemy: object } | { kind: 'structure', structure: object } | null}
   */
  resolveAggroCombatTarget(aggroData, moverEnemy, players) {
    if (!aggroData || !moverEnemy || !players) return null;

    const zid = aggroData.targetZombieId;
    const targetedAlly = zid ? this.room?.enemies?.get(zid) : null;
    const isCombatAllyFocus = this._isPlayerCombatAlly(targetedAlly)
      && !targetedAlly.isDying
      && targetedAlly.health > 0;

    if (
      moverEnemy.deliriumGhoul
      && moverEnemy.targetStructure
      && aggroData.targetStructure
    ) {
      const structure = this.room?.deliriumStructure;
      if (structure && !structure.destroyed && structure.hp > 0) {
        return { kind: 'structure', structure };
      }
    }

    // Sunken Temple III duel lock: honor hostile focus before player proximity override.
    if (aggroData.duelAggroLocked && aggroData.targetHostileEnemyId) {
      const duelHostile = this.room?.enemies?.get(aggroData.targetHostileEnemyId);
      if (this.isValidHostileEnemyAggroTarget(moverEnemy, duelHostile)) {
        return { kind: 'hostile', enemy: duelHostile };
      }
      aggroData.targetHostileEnemyId = null;
      aggroData.duelAggroLocked = false;
    }

    const preferPlayerOverAlly =
      aggroData.directPlayerDamageAggroed
      || (!isCombatAllyFocus && this._shouldPreferPlayerOverAlly(moverEnemy, players));

    if (aggroData.targetStructure && !preferPlayerOverAlly) {
      const structure = this.room?.deliriumStructure;
      if (structure && !structure.destroyed && structure.hp > 0) {
        return { kind: 'structure', structure };
      }
      aggroData.targetStructure = false;
      if (moverEnemy.targetStructure) moverEnemy.targetStructure = false;
    }

    const tid = aggroData.targetTrapId;
    if (tid && !preferPlayerOverAlly) {
      const tr = this.room?.enemies?.get(tid);
      if (tr && tr.type === 'tentacle-spine' && !tr.isDying && tr.health > 0) {
        return { kind: 'trap', trap: tr };
      }
      aggroData.targetTrapId = null;
    }

    const hid = aggroData.targetHostileEnemyId;
    if (hid && !preferPlayerOverAlly) {
      const hostile = this.room?.enemies?.get(hid);
      if (this.isValidHostileEnemyAggroTarget(moverEnemy, hostile)) {
        return { kind: 'hostile', enemy: hostile };
      }
      aggroData.targetHostileEnemyId = null;
      aggroData.duelAggroLocked = false;
    }

    if (zid && !preferPlayerOverAlly) {
      const z = this.room?.enemies?.get(zid);
      if (z && this.isFriendlyCombatUnit(z) && !z.isDying && z.health > 0) {
        return { kind: 'zombie', zombie: z };
      }
      aggroData.targetZombieId = null;
    }

    let targetPlayer = aggroData.targetPlayerId
      ? players.find((p) => p.id === aggroData.targetPlayerId)
      : null;
    if (!targetPlayer || targetPlayer.health <= 0) {
      const newTarget = this.findClosestPlayer(moverEnemy, players);
      if (newTarget) {
        aggroData.targetPlayerId = newTarget.id;
        targetPlayer = newTarget;
      } else if (!aggroData.targetHostileEnemyId) {
        return null;
      }
    }
    if (targetPlayer && targetPlayer.health > 0) {
      return { kind: 'player', player: targetPlayer };
    }
    return null;
  }

  aggroTargetToMoveTarget(resolved) {
    if (!resolved) return null;
    if (resolved.kind === 'player') return resolved.player;
    if (resolved.kind === 'structure') {
      return {
        id: 'delirium-structure',
        position: {
          x: resolved.structure.position.x,
          y: 0,
          z: resolved.structure.position.z,
        },
      };
    }
    if (resolved.kind === 'trap') return { id: resolved.trap.id, position: resolved.trap.position };
    if (resolved.kind === 'hostile') return { id: resolved.enemy.id, position: resolved.enemy.position };
    return { id: resolved.zombie.id, position: resolved.zombie.position };
  }

  combatTargetPosition(resolved) {
    if (!resolved) return null;
    if (resolved.kind === 'player') return resolved.player.position;
    if (resolved.kind === 'structure') {
      return {
        x: resolved.structure.position.x,
        y: 0,
        z: resolved.structure.position.z,
      };
    }
    if (resolved.kind === 'trap') return resolved.trap.position;
    if (resolved.kind === 'hostile') return resolved.enemy.position;
    return resolved.zombie.position;
  }

  setDeliriumGhoulAggro(ghoulId) {
    const ghoul = this.room?.getEnemy(ghoulId);
    if (!ghoul) return;
    const players = this.room?.getPlayers() || [];
    const closestPlayer = players.length ? this.findClosestPlayer(ghoul, players) : null;
    this.enemyAggro.set(ghoulId, {
      targetPlayerId: closestPlayer?.id ?? null,
      targetZombieId: null,
      targetTrapId: null,
      targetStructure: true,
      lastUpdate: Date.now(),
      aggro: 100,
      isAggroed: true,
    });
  }

  clearDeliriumStructureAggro(enemyId) {
    const aggro = this.enemyAggro.get(enemyId);
    if (!aggro) return;
    aggro.targetStructure = false;
    const enemy = this.room?.getEnemy(enemyId);
    const players = this.room?.getPlayers() || [];
    if (enemy && players.length) {
      const closest = this.findClosestPlayer(enemy, players);
      if (closest) aggro.targetPlayerId = closest.id;
    }
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
      this._scheduleTimeout(() => {
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

  /**
   * Palace heavies + assassin deal 3× damage to pets / allied units.
   * @param {object|string|null} attackerOrType
   * @param {number} damage
   */
  scaleDamageVsAlly(attackerOrType, damage) {
    const type = typeof attackerOrType === 'string'
      ? attackerOrType
      : attackerOrType?.type;
    if (type && ALLY_TRIPLE_DAMAGE_TYPES.has(type)) {
      return damage * ALLY_DAMAGE_MULTIPLIER;
    }
    return damage;
  }

  damagePlayerZombieFromMob(mob, zombie, damage, damageType) {
    if (!this.room || !zombie || !this.isFriendlyCombatUnit(zombie)) return null;
    const scaled = this.scaleDamageVsAlly(mob, damage);
    const result = this.room.damageEnemy(zombie.id, scaled, null, null, { damageType, sourceEnemyId: mob?.id });
    if (result) this.maybeEmitBeastMeleeHitSfx(mob);
    return result;
  }

  /** Map enemy type → beast-aggro kind (tiger / serpent / wyvern / bear). */
  _beastAggroKind(type) {
    if (type === 'tiger' || type === 'boss-tiger' || type === 'allied-tiger') return 'tiger';
    if (type === 'serpent' || type === 'boss-serpent' || type === 'allied-serpent') return 'serpent';
    if (type === 'wyvern') return 'wyvern';
    if (type === 'bear' || type === 'boss-bear' || type === 'allied-bear') return 'bear';
    return null;
  }

  /** Emit beast-aggro once per aggro cycle for tiger / serpent / wyvern / bear (enemy or allied). */
  emitBeastAggroSfx(enemy) {
    if (!enemy?.id || !this.io) return;
    const kind = this._beastAggroKind(enemy.type);
    if (!kind) return;
    if (this.beastAggroSfxEmitted.has(enemy.id)) return;
    this.beastAggroSfxEmitted.add(enemy.id);
    this.io.to(this.roomId).emit('beast-aggro', {
      beastKind: kind,
      beastId: enemy.id,
      position: enemy.position,
      timestamp: Date.now(),
    });
  }

  clearBeastAggroSfx(enemyId) {
    if (enemyId) this.beastAggroSfxEmitted.delete(enemyId);
  }

  /** Server-authoritative chance roll for tiger / wolf / serpent / bear melee hit SFX. */
  maybeEmitBeastMeleeHitSfx(enemy) {
    if (!enemy?.id || !this.io) return;
    const type = enemy.type;
    let soundId = null;
    if (type === 'tiger' || type === 'boss-tiger' || type === 'allied-tiger') {
      if (Math.random() >= 0.11) return;
      soundId = 'beast_tiger_attack';
    } else if (type === 'wolf' || type === 'boss-wolf' || type === 'allied-wolf') {
      if (Math.random() >= 0.11) return;
      soundId = Math.random() < 0.5 ? 'beast_wolf_attack1' : 'beast_wolf_attack2';
    } else if (type === 'serpent' || type === 'boss-serpent' || type === 'allied-serpent') {
      if (Math.random() >= 0.2) return;
      soundId = 'beast_serpent_attack';
    } else if (type === 'bear' || type === 'boss-bear' || type === 'allied-bear') {
      if (Math.random() >= 0.3) return;
      soundId = 'beast_bear_attack1';
    } else {
      return;
    }
    this.io.to(this.roomId).emit('beast-attack-sfx', {
      soundId,
      beastId: enemy.id,
      position: enemy.position,
      isAlliedPet:
        type === 'allied-tiger' ||
        type === 'allied-wolf' ||
        type === 'allied-bear' ||
        type === 'allied-serpent',
      timestamp: Date.now(),
    });
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
    aggroData.targetHostileEnemyId = null;
    aggroData.aggro += aggroAmount;
    aggroData.lastUpdate = Date.now();
    aggroData.isAggroed = true;
    aggroData.threatFromDamage = true;
    aggroData.directPlayerDamageAggroed = true;
    this.markAlliedCombatInitiated(enemyId);
    const liveEnemy = this.room?.getEnemy?.(enemyId) || this.room?.enemies?.get?.(enemyId);
    if (liveEnemy) this.emitBeastAggroSfx(liveEnemy);
    _enemyAiLog(`🎯 Player aggro: ${enemyId} → ${playerId} (cleared ally/trap focus)`);
  }

  // Remove player from all aggro charts when they die
  removePlayerFromAllAggro(deadPlayerId) {
    if (process.env.NODE_ENV !== 'production') {
      _enemyAiLog(`💀 Removing dead player ${deadPlayerId} from all aggro charts`);
    }

    // Remove from all boss damage tracking
    this.bossDamageTracking.forEach((damageMap, bossId) => {
      if (damageMap.has(deadPlayerId)) {
        damageMap.delete(deadPlayerId);
        if (process.env.NODE_ENV !== 'production') {
          _enemyAiLog(`  - Removed ${deadPlayerId} from boss ${bossId} damage tracking`);
        }
      }
    });

    // Remove from all enemy aggro (regular enemies, skeletons, etc.)
    this.enemyAggro.forEach((aggroData, enemyId) => {
      if (aggroData.targetPlayerId === deadPlayerId) {
        // Clear the target for this enemy - it will find a new target on next update
        aggroData.targetPlayerId = null;
        aggroData.targetZombieId = null;
        aggroData.targetTrapId = null;
        aggroData.targetHostileEnemyId = null;
        aggroData.aggro = 0;
        aggroData.isAggroed = false;
        aggroData.threatFromDamage = false;
        aggroData.directPlayerDamageAggroed = false;
        if (process.env.NODE_ENV !== 'production') {
          _enemyAiLog(`  - Cleared ${deadPlayerId} as target for enemy ${enemyId}`);
        }
      }
    });

    const ownedZombieIds = this.playerZombiesByOwner.get(deadPlayerId);
    if (ownedZombieIds) {
      for (const zid of [...ownedZombieIds]) {
        const z = this.room?.getEnemy(zid);
        if (z && !z.isDying && z.health > 0) {
          this.room.damageEnemy(zid, z.health, null, null, { damageType: 'owner_disconnect' });
        }
      }
      this.playerZombiesByOwner.delete(deadPlayerId);
    }
  }
}

module.exports = EnemyAI;