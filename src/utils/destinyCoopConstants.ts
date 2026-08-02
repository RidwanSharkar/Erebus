/**
 * Destiny (Azugeros dragon) co-op timings — must stay in sync with `backend/enemyAI.js`.
 */

/** Server-tracked hover altitude — keep in sync with `DESTINY_HOVER_Y`. */
export const DESTINY_HOVER_Y = 9.0;

export const DESTINY_FLY_HEALTH_PCT = 0.70;
/** One-shot wyvern add summon at ≤30% HP — keep in sync with `DESTINY_WYVERN_SUMMON_HEALTH_PCT`. */
export const DESTINY_WYVERN_SUMMON_HEALTH_PCT = 0.30;
export const DESTINY_FLY_SPEED = 3.2;
export const DESTINY_FLY_TAKEOFF_MS = 2000;
export const DESTINY_FLY_LAND_MS = 2200;
export const DESTINY_FLY_IDLE_HOLD_MS = 600;
export const DESTINY_FLY_ATTACK_CAST_MS = 1800;
export const DESTINY_FLY_ATTACK_COOLDOWN_MS = 3000;
export const DESTINY_FLY_ATTACK_VOLLEYS = 5;
export const DESTINY_FLY_APPROACH_STOP = 6.0;
export const DESTINY_FLY_CENTER_HOLD = 1.5;
export const DESTINY_FLY_ATTACK_RANGE = 18;

export type DestinyPhase =
  | 'ground'
  | 'takeoff'
  | 'fly_idle'
  | 'fly_approach'
  | 'fly_attack'
  | 'fly_return'
  | 'land';

export function isDestinyAirPhase(phase: DestinyPhase): boolean {
  return (
    phase === 'takeoff' ||
    phase === 'fly_idle' ||
    phase === 'fly_approach' ||
    phase === 'fly_attack' ||
    phase === 'fly_return' ||
    phase === 'land'
  );
}
