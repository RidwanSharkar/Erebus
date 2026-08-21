/** Spatial cells so instanced explore props can frustum-cull off-screen. */

import { DynamicDrawUsage, InstancedMesh, Sphere } from '@/utils/three-exports';

export const EXPLORE_PROP_CHUNK_GRID = 3;
export const EXPLORE_PROP_CHUNK_COUNT = EXPLORE_PROP_CHUNK_GRID * EXPLORE_PROP_CHUNK_GRID;

/** Y-center / extra radius so tall trees stay inside the frustum sphere. */
export const EXPLORE_TREE_CHUNK_PAD_Y = 5;
export const EXPLORE_TREE_CHUNK_EXTRA_R = 10;
/** Rocks, roots, spines. */
export const EXPLORE_PROP_CHUNK_PAD_Y = 2;
export const EXPLORE_PROP_CHUNK_EXTRA_R = 4;

export function explorePropCellIndex(
  x: number,
  z: number,
  originX: number,
  originZ: number,
  cellSize: number,
  grid: number = EXPLORE_PROP_CHUNK_GRID,
): number {
  let gx = Math.floor((x - originX) / cellSize);
  let gz = Math.floor((z - originZ) / cellSize);
  if (gx < 0) gx = 0;
  else if (gx >= grid) gx = grid - 1;
  if (gz < 0) gz = 0;
  else if (gz >= grid) gz = grid - 1;
  return gz * grid + gx;
}

export function explorePropPoolPerChunk(pool: number, grid: number = EXPLORE_PROP_CHUNK_GRID): number {
  return Math.ceil((pool * 1.6) / (grid * grid));
}

/** Packed-index sequence equality for skipping live-disc publishes. */
export function samePackedMembership(
  a: readonly { index?: number }[],
  b: readonly { index?: number }[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if ((a[i]!.index ?? -1) !== (b[i]!.index ?? -1)) return false;
  }
  return true;
}

export type ExploreInstancedWrite<T> = (
  placements: readonly T[],
  originX: number,
  originZ: number,
  radius: number,
) => boolean;

export type ExploreInstancedWriteHandle<T> = {
  write: ExploreInstancedWrite<T>;
};

/** First attach only: zero count so identity instances never flash at origin. */
export function initExplorePropChunkMesh(mesh: InstancedMesh | null): void {
  if (!mesh) return;
  if (mesh.userData.exploreInit) return;
  mesh.userData.exploreInit = true;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = true;
  if (!mesh.boundingSphere) mesh.boundingSphere = new Sphere();
}

export function setExplorePropChunkSphere(
  mesh: InstancedMesh,
  cellIndex: number,
  originX: number,
  originZ: number,
  cellSize: number,
  padY: number,
  extraR: number,
  grid: number = EXPLORE_PROP_CHUNK_GRID,
): void {
  const gx = cellIndex % grid;
  const gz = Math.floor(cellIndex / grid);
  const cx = originX + (gx + 0.5) * cellSize;
  const cz = originZ + (gz + 0.5) * cellSize;
  if (!mesh.boundingSphere) mesh.boundingSphere = new Sphere();
  mesh.boundingSphere.center.set(cx, padY, cz);
  mesh.boundingSphere.radius = cellSize * Math.SQRT1_2 + extraR;
}
