/**
 * Main co-op combat arena (not the throne prep room). Half the inner square:
 * castle wall inner faces sit at x = ±MAIN_MAP_RADIUS and z = ±MAIN_MAP_RADIUS.
 */
export const MAIN_MAP_RADIUS = 20;

/** Inset from wall lines for spawn / teleport feet (matches server `MAIN_ARENA_SPAWN_INSET`). */
export const MAIN_ARENA_SPAWN_INSET = 1.5;

/** True if (x, z) lies inside the playable square (axis-aligned, same bounds as wall inner faces). */
export function isInsideMainArenaXZ(
  x: number,
  z: number,
  halfExtent: number = MAIN_MAP_RADIUS,
): boolean {
  return Math.abs(x) <= halfExtent && Math.abs(z) <= halfExtent;
}

/** Clamp XZ to the safe combat spawn band inside the inner wall square. */
export function clampToMainArenaXZ(
  x: number,
  z: number,
  halfExtent: number = MAIN_MAP_RADIUS,
  inset: number = MAIN_ARENA_SPAWN_INSET,
): { x: number; z: number } {
  const m = halfExtent - inset;
  return {
    x: Math.max(-m, Math.min(m, x)),
    z: Math.max(-m, Math.min(m, z)),
  };
}
