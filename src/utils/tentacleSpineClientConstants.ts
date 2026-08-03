/**
 * Kept in sync with backend/enemyAI.js tentacle-spine constants
 * (TENTACLE_SPINE_WINDUP_MS, TENTACLE_SPINE_LINE_HALF_W, etc.)
 *
 * Idle clip: Stand (ID 0) from tentacle_idle.glb ≈ 2.333s.
 * Attack clip: AttackUnarmed (ID 16 var 0) ≈ 1.666s; slam lands at 50%.
 * Death clip: Death (ID 1) from tentacle_death.glb ≈ 3.434s.
 */
export const TENTACLE_SPINE_IDLE_CLIP_MS = 2333;
export const TENTACLE_SPINE_ATTACK_CLIP_MS = 1666;
/** Half of AttackUnarmed — server windup timeout and telegraph fill duration */
export const TENTACLE_SPINE_WINDUP_MS = 833;
export const TENTACLE_SPINE_DEATH_CLIP_MS = 3434;
/** Show strip for the entire windup so players have the full window to react */
export const TENTACLE_GROUND_TELEGRAPH_LEAD_MS = TENTACLE_SPINE_WINDUP_MS;
/** Brief impact flash after slam */
export const TENTACLE_SPINE_IMPACT_TELEGRAPH_MS = 180;
/** 2 * server TENTACLE_SPINE_LINE_HALF_W (0.85) — width of the danger strip */
export const TENTACLE_SPINE_TELEGRAPH_STRIP_WIDTH = 1.7;
export const TENTACLE_SPINE_TELEGRAPH_COLOR = '#c94a3a';
