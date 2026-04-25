/**
 * Co-op knight cast / Death Grasp timing — must stay in sync with `backend/enemyAI.js`
 * (knightCastFrost, tryKnightDeathGrasp, knightCastDeathGrasp).
 */
export const KNIGHT_CAST_ABILITY_LOCK_MS = 2000; // meleeLockUntil + Cast clip
export const KNIGHT_CAST_PROJECTILE_DELAY_MS = 1000; // release after cast start
export const KNIGHT_CAST_PROJECTILE_TRAVEL_MS = 420; // lerp time (frost + death grasp)
export const KNIGHT_PROJECTILE_HIT_RADIUS = 1.35; // server XZ dodge window

// Red / green Death Grasp (enemyAI: tryKnightDeathGrasp)
export const KNIGHT_DEATH_GRASP_MIN_RANGE = 5.0; // must be strictly beyond this
export const KNIGHT_DEATH_GRASP_MAX_RANGE = 13.0;
export const KNIGHT_DEATH_GRASP_COOLDOWN_MS = 15000;
export const KNIGHT_DEATH_GRASP_STANDOFF = 1.2; // server pull position from knight
