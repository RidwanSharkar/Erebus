/**
 * Fog of War utilities — camp positions, discovery radii, and enemy visibility.
 * Camp coordinates derived from CORNER_POSTS in CastleWalls.tsx.
 */

export interface CampData {
  id: number;
  name: string;
  x: number;
  z: number;
}

/** The four camp corner positions (matches CORNER_POSTS in CastleWalls.tsx). */
export const CAMP_DATA: CampData[] = [
  { id: 0, name: 'NE Ruins',      x:  17.5, z: -12.5 },
  { id: 1, name: 'East Outpost',  x:  22.5, z:  -2.0 },
  { id: 2, name: 'South Grove',   x:  10.5, z:  18.5 },
  { id: 3, name: 'West Crossing', x: -22.5, z:  -6.0 },
];

/** Player must enter within this distance of a camp corner to discover it. */
export const CAMP_DISCOVERY_RADIUS = 9;

/**
 * Enemies within this radius of a camp corner are considered part of that camp
 * and are hidden until the camp is discovered.
 */
export const CAMP_TERRITORY_RADIUS = 13;

/** Radius around the local player that always reveals enemies regardless of camp. */
export const PLAYER_REVEAL_RADIUS = 7;

/**
 * Returns 0-3 if the world position is within a camp's territory, or -1 for
 * open-world positions (which are always visible).
 */
export function getCampIndex(x: number, z: number): number {
  let closestCamp = -1;
  let closestDist = Infinity;

  for (const camp of CAMP_DATA) {
    const dx = x - camp.x;
    const dz = z - camp.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < CAMP_TERRITORY_RADIUS && dist < closestDist) {
      closestDist = dist;
      closestCamp = camp.id;
    }
  }

  return closestCamp;
}

/**
 * Returns true if an enemy should be rendered.
 *
 * - Enemies within PLAYER_REVEAL_RADIUS of the local player are always visible.
 * - Enemies in open-world positions (no camp) are always visible.
 * - Enemies in a camp are only visible when that camp has been discovered.
 */
export function isEnemyVisible(
  enemyX: number,
  enemyZ: number,
  playerX: number,
  playerZ: number,
  discoveredCamps: boolean[],
): boolean {
  const dx = enemyX - playerX;
  const dz = enemyZ - playerZ;
  if (dx * dx + dz * dz < PLAYER_REVEAL_RADIUS * PLAYER_REVEAL_RADIUS) return true;

  const campIndex = getCampIndex(enemyX, enemyZ);
  if (campIndex === -1) return true;

  return discoveredCamps[campIndex] ?? false;
}
