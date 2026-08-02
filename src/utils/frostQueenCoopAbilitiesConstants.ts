/**
 * Frost Queen co-op ability timings — must stay in sync with `backend/enemyAI.js`
 * (frostQueenCastTeleport, frostQueenCastIceShards, frostQueenCastIceStorm).
 */

export const FROST_QUEEN_TELEPORT_LOCK_MS = 1200;
export const FROST_QUEEN_ICE_SHARDS_CAST_LOCK_MS = 2000;
export const FROST_QUEEN_ICE_SHARDS_LAUNCH_MS = 1000;
export const FROST_QUEEN_ICE_SHARDS_TRAVEL_MS = 550;
export const FROST_QUEEN_ICE_SHARDS_FREEZE_MS = 2000;
export const FROST_QUEEN_ICE_STORM_CHANNEL_MS = 5000;
export const FROST_QUEEN_ICE_STORM_TICK_MS = 500;
export const FROST_QUEEN_ICE_STORM_DAMAGE = 9;
