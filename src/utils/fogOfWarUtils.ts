/**
 * Fog of War utilities — grid-based exploration tracking and enemy visibility.
 *
 * The map is divided into a FOG_GRID_SIZE × FOG_GRID_SIZE grid. Each cell
 * starts unexplored (0) and becomes permanently revealed (255) once the local
 * player moves within PLAYER_VIEW_RADIUS world units of it. The fog shader
 * reads this grid via a DataTexture uploaded every frame.
 */

import { MAIN_MAP_RADIUS } from '@/utils/mapConstants';

/** Resolution of the exploration grid (cells per side). */
export const FOG_GRID_SIZE = 128;

/** Half-width of the square fog texture in world units; covers the rectangular arena's longest half-axis. */
export const MAP_HALF_SIZE = MAIN_MAP_RADIUS;

/** World-space radius the player always reveals, both in the shader and for enemy visibility. */
export const PLAYER_VIEW_RADIUS = 40;

// Derived
const MAP_FULL_SIZE    = MAP_HALF_SIZE * 2;
const CELLS_PER_UNIT   = FOG_GRID_SIZE / MAP_FULL_SIZE;

/**
 * Convert a world-space (x, z) to a linear index into the exploration grid.
 * Returns -1 for positions outside the mapped area.
 */
export function worldToGridIndex(wx: number, wz: number): number {
  const nx = (wx + MAP_HALF_SIZE) / MAP_FULL_SIZE;
  const nz = (wz + MAP_HALF_SIZE) / MAP_FULL_SIZE;
  if (nx < 0 || nx > 1 || nz < 0 || nz > 1) return -1;
  const gx = Math.floor(nx * FOG_GRID_SIZE);
  const gz = Math.floor(nz * FOG_GRID_SIZE);
  return gz * FOG_GRID_SIZE + gx;
}

/**
 * Mark every grid cell within `radius` world units of (wx, wz) as explored.
 * Returns true if at least one previously-unexplored cell was newly revealed,
 * which signals the caller to upload the updated texture to the GPU.
 */
export function markExplored(
  grid: Uint8Array,
  wx: number,
  wz: number,
  radius: number,
): boolean {
  const cellRadius = Math.ceil(radius * CELLS_PER_UNIT);
  const cx = Math.floor((wx + MAP_HALF_SIZE) * CELLS_PER_UNIT);
  const cz = Math.floor((wz + MAP_HALF_SIZE) * CELLS_PER_UNIT);
  const cr2 = cellRadius * cellRadius;

  let changed = false;
  for (let dz = -cellRadius; dz <= cellRadius; dz++) {
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      if (dx * dx + dz * dz > cr2) continue;
      const gx = cx + dx;
      const gz = cz + dz;
      if (gx < 0 || gx >= FOG_GRID_SIZE || gz < 0 || gz >= FOG_GRID_SIZE) continue;
      const idx = gz * FOG_GRID_SIZE + gx;
      if (grid[idx] === 0) {
        grid[idx] = 255;
        changed = true;
      }
    }
  }
  return changed;
}

/**
 * Returns true if the given world position has already been explored.
 */
export function isPositionExplored(grid: Uint8Array, wx: number, wz: number): boolean {
  const idx = worldToGridIndex(wx, wz);
  return idx !== -1 && grid[idx] > 0;
}

/**
 * Returns true if an enemy at (enemyX, enemyZ) should be rendered.
 *
 * Visibility rules:
 *  1. Always visible within PLAYER_VIEW_RADIUS of the local player.
 *  2. Visible if the enemy's position has previously been explored.
 *  3. Hidden otherwise (inside the fog).
 */
export function isEnemyVisible(
  enemyX: number,
  enemyZ: number,
  playerX: number,
  playerZ: number,
  exploredGrid: Uint8Array,
): boolean {
  const dx = enemyX - playerX;
  const dz = enemyZ - playerZ;
  if (dx * dx + dz * dz < PLAYER_VIEW_RADIUS * PLAYER_VIEW_RADIUS) return true;
  return isPositionExplored(exploredGrid, enemyX, enemyZ);
}
