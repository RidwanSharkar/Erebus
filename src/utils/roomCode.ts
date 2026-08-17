/** Canonical room id fallback — matches backend/roomConfig.js `normalizeRoomId`. */
export const DEFAULT_ROOM_ID = 'DEFAULT';

/** Highest sequential fallback: DEFAULT9. Matches backend `DEFAULT_FALLBACK_MAX`. */
export const DEFAULT_FALLBACK_MAX = 9;

/**
 * Canonical room id: strip to [A-Za-z0-9_-], cap at 24 chars, uppercase.
 * Mirrors backend `normalizeRoomId` so codes round-trip with the URL and UI.
 */
export function sanitizeRoomCode(raw: string | null | undefined): string {
  return (raw ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24).toUpperCase();
}

export function defaultFamilyIdAt(index: number): string {
  if (!Number.isFinite(index) || index <= 0) return DEFAULT_ROOM_ID;
  return `${DEFAULT_ROOM_ID}${Math.min(DEFAULT_FALLBACK_MAX, Math.floor(index))}`;
}

export function isDefaultFamilyId(id: string | null | undefined): boolean {
  const n = sanitizeRoomCode(id);
  return n === DEFAULT_ROOM_ID || /^DEFAULT[1-9]$/.test(n);
}

/**
 * Next sequential DEFAULT / DEFAULT1…DEFAULT9 after `current`.
 * `unavailable` is a set of ids to skip (occupied or at capacity).
 */
export function nextDefaultFallbackId(
  current: string | null | undefined,
  unavailable: ReadonlySet<string> = new Set(),
): string | null {
  const ids: string[] = [];
  for (let i = 0; i <= DEFAULT_FALLBACK_MAX; i++) ids.push(defaultFamilyIdAt(i));
  const cur = sanitizeRoomCode(current) || DEFAULT_ROOM_ID;
  const startIdx = ids.indexOf(cur);
  const from = startIdx >= 0 ? startIdx + 1 : 0;
  for (let i = from; i < ids.length; i++) {
    if (!unavailable.has(ids[i])) return ids[i];
  }
  return null;
}

export function suggestedRoomIdFromError(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const raw = (err as { suggestedRoomId?: unknown }).suggestedRoomId;
  if (typeof raw !== 'string') return null;
  const id = sanitizeRoomCode(raw);
  return id || null;
}

export function createRoomJoinError(
  message: string,
  suggestedRoomId?: string | null,
): Error & { suggestedRoomId?: string } {
  const err = new Error(message) as Error & { suggestedRoomId?: string };
  const id = suggestedRoomId ? sanitizeRoomCode(suggestedRoomId) : '';
  if (id) err.suggestedRoomId = id;
  return err;
}
