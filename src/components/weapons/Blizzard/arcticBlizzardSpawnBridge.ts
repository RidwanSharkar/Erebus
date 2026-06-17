import type { Vector3 } from '@/utils/three-exports';

export type ArcticGroundBlizzardSpawner = (position: Vector3) => void;

let arcticGroundBlizzardSpawner: ArcticGroundBlizzardSpawner | null = null;

export function setArcticGroundBlizzardSpawner(fn: ArcticGroundBlizzardSpawner | null): void {
  arcticGroundBlizzardSpawner = fn;
}

/** Invoked from ControlSystem when Arctic Shards or Glacial Storm should spawn React VFX. */
export function spawnArcticGroundBlizzardAtFromReact(position: Vector3): void {
  arcticGroundBlizzardSpawner?.(position.clone());
}
