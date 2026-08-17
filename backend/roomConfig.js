/** Shared room capacity — keep join, preview, and list-rooms in sync. */
const MAX_PLAYERS_PER_ROOM = 3;

/** How long an emptied room stays reserved under its code before being destroyed. */
const EMPTY_ROOM_GRACE_MS = 90000;

/** Canonical empty-code fallback — mirrors client `DEFAULT_ROOM_ID`. */
const DEFAULT_ROOM_ID = 'DEFAULT';

/** Highest sequential fallback: DEFAULT9. */
const DEFAULT_FALLBACK_MAX = 9;

/**
 * Canonical room id: strip to [A-Za-z0-9_-], cap at 24 chars, uppercase.
 * Mirrors the client's sanitizeRoomCode so codes round-trip.
 */
function normalizeRoomId(raw) {
  const normalized = String(raw ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24).toUpperCase();
  return normalized || DEFAULT_ROOM_ID;
}

function defaultFamilyIdAt(index) {
  const i = Number(index);
  if (!Number.isFinite(i) || i <= 0) return DEFAULT_ROOM_ID;
  return `${DEFAULT_ROOM_ID}${Math.min(DEFAULT_FALLBACK_MAX, Math.floor(i))}`;
}

function isDefaultFamilyId(id) {
  const n = normalizeRoomId(id);
  return n === DEFAULT_ROOM_ID || /^DEFAULT[1-9]$/.test(n);
}

/**
 * Next sequential DEFAULT / DEFAULT1…DEFAULT9 after `current`.
 * `unavailable` is a set of ids to skip (occupied or at capacity).
 */
function nextDefaultFallbackId(current, unavailable) {
  const skip = unavailable instanceof Set ? unavailable : new Set(unavailable || []);
  const ids = [];
  for (let i = 0; i <= DEFAULT_FALLBACK_MAX; i++) ids.push(defaultFamilyIdAt(i));
  const cur = normalizeRoomId(current);
  const startIdx = ids.indexOf(cur);
  const from = startIdx >= 0 ? startIdx + 1 : 0;
  for (let i = from; i < ids.length; i++) {
    if (!skip.has(ids[i])) return ids[i];
  }
  return null;
}

module.exports = {
  MAX_PLAYERS_PER_ROOM,
  EMPTY_ROOM_GRACE_MS,
  DEFAULT_ROOM_ID,
  DEFAULT_FALLBACK_MAX,
  normalizeRoomId,
  defaultFamilyIdAt,
  isDefaultFamilyId,
  nextDefaultFallbackId,
};
