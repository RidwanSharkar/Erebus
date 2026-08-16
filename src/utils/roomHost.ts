import { getBackendUrl } from './backendUrl';
import { sanitizeRoomCode } from './roomCode';

export type RoomHostResult = {
  room: string;
  instance: string | null;
  exists: boolean;
  playerCount: number;
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
