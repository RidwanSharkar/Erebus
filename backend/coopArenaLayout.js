/**
 * Co-op main combat arena layout — keep in sync with src/utils/coopArenaLayout.ts
 */
const COOP_MAIN_ENTRY_X = 0;
const COOP_MAIN_ENTRY_Z = -19;

/** Intro castle rooms — keep in sync with `CASTLE_ROOM_HALF_SIZE` in src/utils/mapConstants.ts */
const CASTLE_ROOM_HALF_SIZE = 14;
const CASTLE_ROOM_ENTRY_X = 0;
const CASTLE_ROOM_ENTRY_Z = -11;

/** Min distance from entry XZ for enemy spawns: ≥ max mob aggro (12) + player spawn ring (~1.25) + margin. */
const COOP_PLAYER_START_CLEAR_RADIUS = 16;

function rotationYTowardEntry(fromX, fromZ) {
  return Math.atan2(COOP_MAIN_ENTRY_X - fromX, COOP_MAIN_ENTRY_Z - fromZ);
}

/** Yaw (radians) to face the map center (0,0) on XZ from a world position. */
function rotationYTowardArenaCenter(fromX, fromZ) {
  return Math.atan2(-fromX, -fromZ);
}

module.exports = {
  COOP_MAIN_ENTRY_X,
  COOP_MAIN_ENTRY_Z,
  CASTLE_ROOM_HALF_SIZE,
  CASTLE_ROOM_ENTRY_X,
  CASTLE_ROOM_ENTRY_Z,
  COOP_PLAYER_START_CLEAR_RADIUS,
  rotationYTowardEntry,
  rotationYTowardArenaCenter,
  SUNKEN_TEMPLE_ENTRY_X: CASTLE_ROOM_ENTRY_X,
  SUNKEN_TEMPLE_ENTRY_Z: CASTLE_ROOM_ENTRY_Z,
  SUNKEN_TEMPLE_HALF_SIZE: CASTLE_ROOM_HALF_SIZE,
};
