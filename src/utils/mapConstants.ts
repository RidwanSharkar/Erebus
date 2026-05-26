/**
 * Main co-op combat arena (not the throne prep room).
 * The colored enemy rooms use a regular hex footprint, slightly larger than
 * the stat/trial HexCombatArena radius (22).
 */
export const MAIN_ARENA_HEX_RADIUS = 26;
export const MAIN_ARENA_HEX_FLOOR_MARGIN = 1.4;
export const MAIN_ARENA_HEX_INNER_APOTHEM =
  MAIN_ARENA_HEX_RADIUS * Math.cos(Math.PI / 6) - MAIN_ARENA_HEX_FLOOR_MARGIN;

/** Bounding extents for systems that still allocate square textures/fields around the hex. */
export const MAIN_MAP_HALF_X = MAIN_ARENA_HEX_RADIUS;
export const MAIN_MAP_HALF_Z = MAIN_ARENA_HEX_RADIUS;

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

/** True if (x, z) lies inside a regular hex with the same orientation as HexCombatArena. */
export function isInsideHexArenaXZ(
  x: number,
  z: number,
  radius: number = MAIN_ARENA_HEX_RADIUS,
  inset: number = 0,
): boolean {
  const apothem = radius * Math.cos(Math.PI / 6) - inset;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    if (x * Math.cos(a) + z * Math.sin(a) > apothem) return false;
  }
  return true;
}

/** Clamp XZ to the nearest point inside the regular hex footprint. */
export function clampToHexArenaXZ(
  x: number,
  z: number,
  radius: number = MAIN_ARENA_HEX_RADIUS,
  inset: number = MAIN_ARENA_SPAWN_INSET,
): { x: number; z: number } {
  const apothem = radius * Math.cos(Math.PI / 6) - inset;
  let cx = x;
  let cz = z;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      const excess = cx * nx + cz * nz - apothem;
      if (excess > 0) {
        cx -= nx * excess;
        cz -= nz * excess;
      }
    }
  }
  return { x: cx, z: cz };
}

/** True if (x, z) lies inside the playable main arena. Explicit bounds keep legacy rectangle behavior. */
export function isInsideMainArenaXZ(
  x: number,
  z: number,
  boundsOrHalfX: MainArenaBounds | number = MAIN_ARENA_BOUNDS,
  halfZ?: number,
): boolean {
  if (boundsOrHalfX === MAIN_ARENA_BOUNDS && halfZ === undefined) {
    return isInsideHexArenaXZ(x, z);
  }
  if (typeof boundsOrHalfX === 'number' && halfZ === undefined) {
    return isInsideHexArenaXZ(x, z, boundsOrHalfX);
  }
  const bounds = resolveMainArenaBounds(boundsOrHalfX, halfZ);
  return Math.abs(x) <= bounds.halfX && Math.abs(z) <= bounds.halfZ;
}

/** Clamp XZ to the safe combat spawn band inside the main arena. */
export function clampToMainArenaXZ(
  x: number,
  z: number,
  boundsOrHalfX: MainArenaBounds | number = MAIN_ARENA_BOUNDS,
  inset: number = MAIN_ARENA_SPAWN_INSET,
): { x: number; z: number } {
  if (boundsOrHalfX === MAIN_ARENA_BOUNDS) {
    return clampToHexArenaXZ(x, z, MAIN_ARENA_HEX_RADIUS, inset);
  }
  if (typeof boundsOrHalfX === 'number') {
    return clampToHexArenaXZ(x, z, boundsOrHalfX, inset);
  }
  const bounds = resolveMainArenaBounds(boundsOrHalfX);
  const mx = bounds.halfX - inset;
  const mz = bounds.halfZ - inset;
  return {
    x: Math.max(-mx, Math.min(mx, x)),
    z: Math.max(-mz, Math.min(mz, z)),
  };
}
