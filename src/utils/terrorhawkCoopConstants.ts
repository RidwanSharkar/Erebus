/**
 * Terrorhawk co-op timings — must stay in sync with `backend/enemyAI.js`.
 */

/** Server-tracked hover altitude — keep in sync with `TERRORHAWK_HOVER_Y`. */
export const TERRORHAWK_HOVER_Y = 10.0;

export const TERRORHAWK_AGGRO_RADIUS = 12;
export const TERRORHAWK_MELEE_RANGE = 3.0;
export const TERRORHAWK_LANDING_RADIUS = 2.5;
/** Keep in sync with `TERRORHAWK_DIVE_SPEED` in `backend/enemyAI.js`. */
export const TERRORHAWK_DIVE_SPEED = 30.0;
export const TERRORHAWK_TAKEOFF_MS = 1800;
export const TERRORHAWK_JUMPEND_MS = 800;
export const TERRORHAWK_SWING_LOCK_MS = 1200;
export const TERRORHAWK_HIT_DELAY_MS = 550;
/** Server-authoritative: min ground dwell after landing before takeoff. */
export const TERRORHAWK_MIN_GROUND_MS = 2000;

export type TerrorhawkPhase =
  | 'takeoff'
  | 'hover'
  | 'approach'
  | 'dive'
  | 'land'
  | 'ground_melee';
