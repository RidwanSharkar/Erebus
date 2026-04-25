import { Vector3 } from '@/utils/three-exports';
import type { MountainData } from '@/utils/MountainGenerator';
import {
  MOUNTAIN_BASE_CONE_RADIUS,
  getMountainBaseMaxRadiusXZByVariantUnscaled,
  getMountainCombinedVerticalWorldBounds,
} from '@/utils/MountainGenerator';
import { MAIN_MAP_RADIUS } from '@/utils/mapConstants';

/** Kept for reference: nominal cone; collision uses jagged per-variant max from the generator. */
export const CORNER_MOUNTAIN_BASE_CONE_RADIUS = MOUNTAIN_BASE_CONE_RADIUS;

/**
 * Single scale for all four red-room corner mountains. Footprint = jagged max × this (per variant in discs).
 */
export const RED_CORNER_MOUNTAIN_SCALE = 0.575;

const INSET = -9;

const baseMaxRByVar = getMountainBaseMaxRadiusXZByVariantUnscaled();
const maxJaggedRUnscaled = Math.max(baseMaxRByVar[0], baseMaxRByVar[1], baseMaxRByVar[2]);
const baseWorldRadius = maxJaggedRUnscaled * RED_CORNER_MOUNTAIN_SCALE;
const c = MAIN_MAP_RADIUS - baseWorldRadius - INSET;

/** Aligned to base + snow peak; ECS cylinder center and height. */
export const RED_CORNER_MOUNTAIN_COLLISION_CYLINDER = getMountainCombinedVerticalWorldBounds(
  RED_CORNER_MOUNTAIN_SCALE,
);

/** @deprecated use `RED_CORNER_MOUNTAIN_COLLISION_CYLINDER.height` */
export const CORNER_MOUNTAIN_CYLINDER_HEIGHT = RED_CORNER_MOUNTAIN_COLLISION_CYLINDER.height;

function makeCornerMountains(): MountainData[] {
  const s = RED_CORNER_MOUNTAIN_SCALE;
  return [
    { position: new Vector3(c, 0, c), scale: s },
    { position: new Vector3(-c, 0, c), scale: s },
    { position: new Vector3(c, 0, -c), scale: s },
    { position: new Vector3(-c, 0, -c), scale: s },
  ];
}

/** Memoized once: four `MountainData` for red co-op arena corners only. */
export const RED_CORNER_MOUNTAINS: MountainData[] = makeCornerMountains();

/**
 * XZ discs for `PhysicsSystem` / `ControlSystem` (geometric: jagged base radius × scale per variant, no
 * player clearance — same radii as ECS `MountainBaseCollision` cylinders).
 */
export function getRedCornerMountainDiscs(): Array<{ x: number; z: number; radius: number }> {
  return RED_CORNER_MOUNTAINS.map((m, i) => ({
    x: m.position.x,
    z: m.position.z,
    radius: baseMaxRByVar[i % 3] * m.scale/2,
  }));
}
