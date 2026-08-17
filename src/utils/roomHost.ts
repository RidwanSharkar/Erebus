import { getBackendUrl } from './backendUrl';
import { DEFAULT_ROOM_ID, sanitizeRoomCode } from './roomCode';

export type RoomHostResult = {
  room: string;
  instance: string | null;
  exists: boolean;
  playerCount: number;
};

export type DefaultFallbackResult = {
  roomId: string;
  exists: boolean;
};

/** Ask any backend machine which Fly instance owns `code`. Returns null on failure. */
export async function resolveRoomHost(code: string): Promise<RoomHostResult | null> {
  const room = sanitizeRoomCode(code);
  if (!room) return null;
  try {
    const res = await fetch(
      `${getBackendUrl()}/room-host?room=${encodeURIComponent(room)}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      room: typeof data?.room === 'string' ? data.room : room,
      instance: typeof data?.instance === 'string' ? data.instance : null,
      exists: !!data?.exists,
      playerCount: typeof data?.playerCount === 'number' ? data.playerCount : 0,
    };
  } catch {
    return null;
  }
}

/** Next sequential DEFAULT / DEFAULT1… room that is missing or empty. */
export async function allocateDefaultFallback(
  from: string | null | undefined,
): Promise<DefaultFallbackResult | null> {
  const room = sanitizeRoomCode(from) || DEFAULT_ROOM_ID;
  try {
    const res = await fetch(
      `${getBackendUrl()}/default-fallback?from=${encodeURIComponent(room)}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const roomId = typeof data?.roomId === 'string' ? sanitizeRoomCode(data.roomId) : '';
    if (!roomId) return null;
    return { roomId, exists: !!data.exists };
  } catch {
    return null;
  }
}
