/**
 * Co-op main combat arena layout — keep in sync with backend/coopArenaLayout.js
 */
export const COOP_MAIN_ENTRY_X = 0;
export const COOP_MAIN_ENTRY_Z = -17;

/** Min distance from entry XZ for enemy spawns — keep in sync with backend/coopArenaLayout.js */
export const COOP_PLAYER_START_CLEAR_RADIUS = 16;

/**
 * Main colored combat room (+Z): reward pedestal and flanking choice portals.
 * Inset from the north rim — mirrors castle rooms (z=6 @ r=14) scaled to r=16.
 */
export const COOP_MAIN_COMBAT_PEDESTAL_X = 0;
export const COOP_MAIN_COMBAT_PEDESTAL_Z = 8;
export const COOP_MAIN_COMBAT_PORTAL_HALF_SPACING_X = 4;
/** Keep wave spawns off the pedestal + dual portal cluster during intermission. */
export const COOP_MAIN_COMBAT_INTERMISSION_CLEAR_RADIUS = 5.5;

export function rotationYTowardEntry(fromX: number, fromZ: number): number {
  return Math.atan2(COOP_MAIN_ENTRY_X - fromX, COOP_MAIN_ENTRY_Z - fromZ);
}

/** Yaw to face the map center (0,0) on XZ from a world position. */
export function rotationYTowardArenaCenter(fromX: number, fromZ: number): number {
  return Math.atan2(-fromX, -fromZ);
}

/** Eternity's Palace hex — keep in sync with backend/coopArenaLayout.js */
export const ETERNITY_PALACE_HEX_RADIUS = 18;
export const ETERNITY_PALACE_ENTRY_X = 0;
export const ETERNITY_PALACE_ENTRY_Z = -15;
