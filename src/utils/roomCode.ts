/** Canonical room id fallback — matches backend/roomConfig.js `normalizeRoomId`. */
export const DEFAULT_ROOM_ID = 'DEFAULT';

/**
 * Canonical room id: strip to [A-Za-z0-9_-], cap at 24 chars, uppercase.
 * Mirrors backend `normalizeRoomId` so codes round-trip with the URL and UI.
 */
export function sanitizeRoomCode(raw: string | null | undefined): string {
  return (raw ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24).toUpperCase();
}
