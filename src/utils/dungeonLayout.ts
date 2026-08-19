/** Keep in sync with `backend/gameRoom.js` dungeon AABB / spawn constants. */

import type { Intersection, Object3D } from 'three';
import { Raycaster, Vector3 } from '@/utils/three-exports';

/**
 * Onyxia lair (`lifesizeLAIR.glb`). Native AABB:
 * X −63.22..218.81, Y −96.45..49.56, Z −286.44..26.08.
 * EntranceTransition walkable floor ≈ native Y 1.065. Lift so that plane is world Y=0.
 * Scale 0.65 = 35% smaller than the authored life-size mesh.
 */
export const DUNGEON_NEXUS_MODEL_SCALE = 0.625;
const DUNGEON_NATIVE_FLOOR_Y = 1.065;
export const DUNGEON_NEXUS_MODEL_POSITION: [number, number, number] = [
  0,
  -DUNGEON_NATIVE_FLOOR_Y * DUNGEON_NEXUS_MODEL_SCALE,
  0,
];

/** Match `DungeonNexusMap` background; hide far overlapping cave shells. */
export const DUNGEON_FOG_COLOR = '#05070c';
export const DUNGEON_FOG_DENSITY = 0.006;
/** Playable Z span is ~203; clip shells beyond a corridor look. */
export const DUNGEON_CAMERA_FAR = 220;

export const DUNGEON_PLAYABLE_MIN_X = -41.09;
export const DUNGEON_PLAYABLE_MAX_X = 142.22;
export const DUNGEON_PLAYABLE_MIN_Z = -186.18;
export const DUNGEON_PLAYABLE_MAX_Z = 16.95;

/** EntranceTransition walkable stand point after scale + floor lift. */
export const DUNGEON_SPAWN = Object.freeze({ x: -17.63, y: 1, z: -20.1 });

/** RallyArea past the entrance stairs. Keep in sync with `backend/gameRoom.js`. */
/** y is RallyArea world floor height (native Y ≈ −25 × scale 0.625 + lift ≈ −15.5). */
export const DUNGEON_ENTRANCE_PACK = Object.freeze([
  Object.freeze({ type: 'knight', x: -21.5, y: -15.5, z: -92, campColor: 'red' }),
  Object.freeze({ type: 'knight', x: -14.0, y: -15.5, z: -90, campColor: 'blue' }),
  Object.freeze({ type: 'wyvern', x: -17.6, y: -15.5, z: -100, campColor: 'red' }),
]);

export type DungeonPlayableAabb = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export const DUNGEON_PLAYABLE_AABB: DungeonPlayableAabb = Object.freeze({
  minX: DUNGEON_PLAYABLE_MIN_X,
  maxX: DUNGEON_PLAYABLE_MAX_X,
  minZ: DUNGEON_PLAYABLE_MIN_Z,
  maxZ: DUNGEON_PLAYABLE_MAX_Z,
});

export function clampToDungeonAabb(x: number, z: number): { x: number; z: number } {
  return {
    x: Math.max(DUNGEON_PLAYABLE_MIN_X, Math.min(DUNGEON_PLAYABLE_MAX_X, x)),
    z: Math.max(DUNGEON_PLAYABLE_MIN_Z, Math.min(DUNGEON_PLAYABLE_MAX_Z, z)),
  };
}

let meshCollider: Object3D | null = null;
const colliderListeners = new Set<(collider: Object3D | null) => void>();

export function setDungeonMeshCollider(collider: Object3D | null): void {
  meshCollider = collider;
  for (const fn of colliderListeners) fn(collider);
}

export function getDungeonMeshCollider(): Object3D | null {
  return meshCollider;
}

export function subscribeDungeonMeshCollider(
  fn: (collider: Object3D | null) => void,
): () => void {
  colliderListeners.add(fn);
  fn(meshCollider);
  return () => {
    colliderListeners.delete(fn);
  };
}

/** Chest height above walkable mesh for dungeon projectiles. */
export const DUNGEON_PROJECTILE_CHEST_OFFSET = 1;
const DUNGEON_PROJECTILE_STEP = 2.5;
const DUNGEON_WALKABLE_MIN_NY = 0.55;

const _projRaycaster = new Raycaster();
const _projRayOrigin = new Vector3();
const _projRayDown = new Vector3(0, -1, 0);
const _projHitNormal = new Vector3();

function dungeonHitWalkableNy(hit: Intersection): number | null {
  if (!hit.face) return null;
  _projHitNormal.copy(hit.face.normal);
  if (hit.object) {
    _projHitNormal.transformDirection(hit.object.matrixWorld);
  }
  if (_projHitNormal.y <= DUNGEON_WALKABLE_MIN_NY) return null;
  return _projHitNormal.y;
}

/** Walkable mesh Y nearest `feetY` inside the step window. Null when no dungeon collider. */
export function probeDungeonWalkableGroundY(
  x: number,
  z: number,
  feetY: number,
  maxStepUp: number = DUNGEON_PROJECTILE_STEP,
  maxStepDown: number = DUNGEON_PROJECTILE_STEP,
): number | null {
  if (!meshCollider) return null;
  const originY = feetY + maxStepUp + 0.35;
  const far = maxStepUp + maxStepDown + 1.25;
  _projRaycaster.near = 0;
  _projRaycaster.far = Math.max(0.05, far);
  _projRaycaster.set(_projRayOrigin.set(x, originY, z), _projRayDown);
  const hits = _projRaycaster.intersectObject(meshCollider, true);
  let bestY: number | null = null;
  let bestDist = Infinity;
  const minY = feetY - maxStepDown;
  const maxY = feetY + maxStepUp;
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i]!;
    if (dungeonHitWalkableNy(hit) == null) continue;
    const gy = hit.point.y;
    if (gy < minY - 1e-3 || gy > maxY + 1e-3) continue;
    const d = Math.abs(gy - feetY);
    if (d < bestDist) {
      bestDist = d;
      bestY = gy;
    }
  }
  return bestY;
}

/**
 * Keep a projectile at local chest height over dungeon mesh.
 * No-ops (returns `currentY`) when the dungeon collider is unset.
 */
export function snapToDungeonChestY(
  x: number,
  z: number,
  currentY: number,
  chestOffset: number = DUNGEON_PROJECTILE_CHEST_OFFSET,
  stepWindow: number = DUNGEON_PROJECTILE_STEP,
): number {
  const gy = probeDungeonWalkableGroundY(
    x,
    z,
    currentY - chestOffset,
    stepWindow,
    stepWindow,
  );
  return gy == null ? currentY : gy + chestOffset;
}

export function applyDungeonChestY(
  position: Vector3,
  chestOffset: number = DUNGEON_PROJECTILE_CHEST_OFFSET,
): void {
  position.y = snapToDungeonChestY(position.x, position.z, position.y, chestOffset);
}

/**
 * Local floor snap for enemy feet. Window is large enough for lair slopes, small
 * enough not to jump to another cave shell (those sit ~30–45 units apart).
 * No-ops when the dungeon collider is unset or no hit is in range of server Y.
 */
const DUNGEON_ENEMY_STEP = 4;

export function applyDungeonFeetY(position: Vector3): void {
  const gy = probeDungeonWalkableGroundY(
    position.x,
    position.z,
    position.y,
    DUNGEON_ENEMY_STEP,
    DUNGEON_ENEMY_STEP,
  );
  if (gy != null) {
    position.y = gy;
  }
}

/** Player sphere center Y on dungeon mesh. Falls back to entrance spawn height when collider is unset. */
export function resolveDungeonPlayerCenterY(
  x: number,
  z: number,
  sphereRadius: number = 0.5,
  fallbackCenterY: number = DUNGEON_SPAWN.y,
): number {
  const feetY = fallbackCenterY - sphereRadius;
  const gy = probeDungeonWalkableGroundY(x, z, feetY, 6, 6);
  return gy != null ? gy + sphereRadius : fallbackCenterY;
}
