/**
 * Main co-op combat arena (not the throne prep room). Inner castle wall faces
 * sit at x = ±MAIN_MAP_HALF_X and z = ±MAIN_MAP_HALF_Z.
 * Arena footprint: 32 × 70. Choice portals sit at x = ±14 (2 units inside the wall).
 */
export const MAIN_MAP_HALF_X = 16;
export const MAIN_MAP_HALF_Z = 35;

/**
 * Legacy scalar extent for circular / symmetric systems. Prefer per-axis
 * bounds for main-arena gameplay and collision.
 */
export const MAIN_MAP_RADIUS = Math.max(MAIN_MAP_HALF_X, MAIN_MAP_HALF_Z);

/** Inset from wall lines for spawn / teleport feet (matches server `MAIN_ARENA_SPAWN_INSET`). */
export const MAIN_ARENA_SPAWN_INSET = 1.5;

export type MainArenaBounds = {
  halfX: number;
  halfZ: number;
};

export const MAIN_ARENA_BOUNDS: MainArenaBounds = {
  halfX: MAIN_MAP_HALF_X,
  halfZ: MAIN_MAP_HALF_Z,
};

function resolveMainArenaBounds(
  boundsOrHalfX: MainArenaBounds | number = MAIN_ARENA_BOUNDS,
  halfZ?: number,
): MainArenaBounds {
  if (typeof boundsOrHalfX === 'number') {
    return { halfX: boundsOrHalfX, halfZ: halfZ ?? boundsOrHalfX };
  }
  return boundsOrHalfX;
}

/** True if (x, z) lies inside the playable rectangle (axis-aligned, same bounds as wall inner faces). */
export function isInsideMainArenaXZ(
  x: number,
  z: number,
  boundsOrHalfX: MainArenaBounds | number = MAIN_ARENA_BOUNDS,
  halfZ?: number,
): boolean {
  const bounds = resolveMainArenaBounds(boundsOrHalfX, halfZ);
  return Math.abs(x) <= bounds.halfX && Math.abs(z) <= bounds.halfZ;
}

/** Clamp XZ to the safe combat spawn band inside the inner wall rectangle. */
export function clampToMainArenaXZ(
  x: number,
  z: number,
  boundsOrHalfX: MainArenaBounds | number = MAIN_ARENA_BOUNDS,
  inset: number = MAIN_ARENA_SPAWN_INSET,
): { x: number; z: number } {
  const bounds = resolveMainArenaBounds(boundsOrHalfX);
  const mx = bounds.halfX - inset;
  const mz = bounds.halfZ - inset;
  return {
    x: Math.max(-mx, Math.min(mx, x)),
    z: Math.max(-mz, Math.min(mz, z)),
  };
}
