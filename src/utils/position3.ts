import { Vector3 } from 'three';

/** Plain {x,y,z} position — stable reference when passed from multiplayer roster objects. */
export type Position3 = { x: number; y: number; z: number };

/** Shared scratch vector for distance checks (module-level, no per-frame alloc). */
export const positionScratch = new Vector3();

/** Copy a Position3 into an existing Vector3 (no allocation). */
export function copyPosition3(target: Vector3, pos: Position3): Vector3 {
  return target.set(pos.x, pos.y, pos.z);
}

/** Allocate a new Vector3 from a Position3. */
export function vector3FromPosition3(pos: Position3): Vector3 {
  return new Vector3(pos.x, pos.y, pos.z);
}

/** Distance between a Vector3 and a Position3 without allocating. */
export function distanceToPosition3(from: Vector3, pos: Position3): number {
  positionScratch.set(pos.x, pos.y, pos.z);
  return from.distanceTo(positionScratch);
}
