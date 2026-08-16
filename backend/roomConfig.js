/** Shared room capacity — keep join, preview, and list-rooms in sync. */
const MAX_PLAYERS_PER_ROOM = 3;

/** How long an emptied room stays reserved under its code before being destroyed. */
const EMPTY_ROOM_GRACE_MS = 90000;

/**
 * Canonical room id: strip to [A-Za-z0-9_-], cap at 24 chars, uppercase.
 * Mirrors the client's sanitizeRoomCode so codes round-trip.
 */
function normalizeRoomId(raw) {
  const normalized = String(raw ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24).toUpperCase();
  return normalized || 'DEFAULT';
}

module.exports = { MAX_PLAYERS_PER_ROOM, EMPTY_ROOM_GRACE_MS, normalizeRoomId };
