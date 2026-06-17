/**
 * Kept in sync with backend/enemyAI.js tentacle-spine constants
 * (TENTACLE_SPINE_WINDUP_MS, TENTACLE_SPINE_LINE_HALF_W, etc.)
 */
export const TENTACLE_SPINE_WINDUP_MS = 1000;
/** Show strip for the entire windup so players have the full second to react */
export const TENTACLE_GROUND_TELEGRAPH_LEAD_MS = 1000;
/** 2 * server TENTACLE_SPINE_LINE_HALF_W (0.85) — width of the danger strip */
export const TENTACLE_SPINE_TELEGRAPH_STRIP_WIDTH = 1.7;
export const TENTACLE_SPINE_TELEGRAPH_COLOR = '#c94a3a';
