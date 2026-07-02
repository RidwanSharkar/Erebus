/**
 * Co-op knight cast / Death Grasp timing — must stay in sync with `backend/enemyAI.js`
 * (knightCastFrost, tryKnightDeathGrasp, knightCastDeathGrasp).
 */
export const KNIGHT_CAST_ABILITY_LOCK_MS = 2000; // meleeLockUntil + Cast clip
export const KNIGHT_CAST_PROJECTILE_DELAY_MS = 1000; // release after cast start
export const KNIGHT_FROST_PROJECTILE_TRAVEL_MS = 550; // lerp time (blue frost)
export const KNIGHT_DEATH_GRASP_PROJECTILE_TRAVEL_MS = 520; // lerp time (red / green death grasp)
export const KNIGHT_CAST_PROJECTILE_TRAVEL_MS = KNIGHT_FROST_PROJECTILE_TRAVEL_MS; // legacy frost timing alias
export const KNIGHT_PROJECTILE_HIT_RADIUS = 1.35; // server XZ dodge window

// Red / green Death Grasp (enemyAI: tryKnightDeathGrasp)
export const KNIGHT_DEATH_GRASP_MIN_RANGE = 5.0; // must be strictly beyond this
export const KNIGHT_DEATH_GRASP_MAX_RANGE = 13.0;
export const KNIGHT_DEATH_GRASP_COOLDOWN_MS = 15000;
export const KNIGHT_DEATH_GRASP_STANDOFF = 1.2; // server pull position from knight

// Knight Smite (enemyAI: knightCastSmite, tryKnightSmiteUnlocked)
export const KNIGHT_SMITE_IMPACT_DELAY_MS = 900;
export const KNIGHT_SMITE_RADIUS_BASE = 2.8;
export const KNIGHT_SMITE_RADIUS_POST_BOSS2 = 3.75;

// Knight Block (enemyAI: tryKnightBlock, knightCastBlock)
export const KNIGHT_BLOCK_REACT_WINDOW_MS = 500;
export const KNIGHT_BLOCK_DURATION_MS: Record<'red' | 'blue' | 'purple' | 'green', number> = {
  red: 2000,
  blue: 3000,
  purple: 4000,
  green: 6000,
};
export const KNIGHT_BLOCK_COOLDOWN_MS: Record<'red' | 'blue' | 'purple' | 'green', number> = {
  red: 6000,
  blue: 8000,
  purple: 12000,
  green: 15000,
};
export const KNIGHT_ELITE_BLOCK_DURATION_MS = 10000;
export const KNIGHT_ELITE_BLOCK_HEALTH_THRESHOLDS = [0.9, 0.5, 0.2] as const;
export const KNIGHT_BLOCK_UNLOCK_BOSS_COUNT = 2;
