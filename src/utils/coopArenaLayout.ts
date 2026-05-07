/**
 * Co-op main combat arena layout — keep in sync with backend/coopArenaLayout.js
 */
export const COOP_MAIN_ENTRY_X = 0;
export const COOP_MAIN_ENTRY_Z = -30;

/** Min distance from entry XZ for enemy spawns — keep in sync with backend/coopArenaLayout.js */
export const COOP_PLAYER_START_CLEAR_RADIUS = 16;

export function rotationYTowardEntry(fromX: number, fromZ: number): number {
  return Math.atan2(COOP_MAIN_ENTRY_X - fromX, COOP_MAIN_ENTRY_Z - fromZ);
}

/** Yaw to face the map center (0,0) on XZ from a world position. */
export function rotationYTowardArenaCenter(fromX: number, fromZ: number): number {
  return Math.atan2(-fromX, -fromZ);
}
