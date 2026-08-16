/**
 * Sparse chunk-keyed fog of war for Explore Mode.
 * 12×12 cells per 48-unit chunk (4 world units / cell).
 */

import { EXPLORE_CHUNK_SIZE, chunkKey, worldToChunk } from './exploreWorldGen';

export const EXPLORE_FOG_CELLS = 12;
export const EXPLORE_PLAYER_VIEW_RADIUS = 27;
export const EXPLORE_FOG_CELL_SIZE = EXPLORE_CHUNK_SIZE / EXPLORE_FOG_CELLS;

const CELLS_PER_CHUNK = EXPLORE_FOG_CELLS * EXPLORE_FOG_CELLS;

export type ExploreViewer = { x: number; z: number; yaw: number };

class ExploreFogOfWar {
  private chunks = new Map<string, Uint8Array>();
  private viewer: ExploreViewer = { x: 0, z: 0, yaw: 0 };
  private version = 0;
  private lastMarkX = Number.POSITIVE_INFINITY;
  private lastMarkZ = Number.POSITIVE_INFINITY;

  reset(): void {
    this.chunks.clear();
    this.viewer = { x: 0, z: 0, yaw: 0 };
    this.version += 1;
    this.lastMarkX = Number.POSITIVE_INFINITY;
    this.lastMarkZ = Number.POSITIVE_INFINITY;
  }

  getVersion(): number {
    return this.version;
  }

  setViewer(x: number, z: number, yaw: number): void {
    this.viewer.x = x;
    this.viewer.z = z;
    this.viewer.yaw = yaw;
  }

  getViewer(): ExploreViewer {
    return this.viewer;
  }

  getChunks(): ReadonlyMap<string, Uint8Array> {
    return this.chunks;
  }

  getChunkGrid(cx: number, cz: number): Uint8Array | undefined {
    return this.chunks.get(chunkKey(cx, cz));
  }

  private cellOf(wx: number, wz: number): { key: string; idx: number } | null {
    const { cx, cz } = worldToChunk(wx, wz);
    const originX = cx * EXPLORE_CHUNK_SIZE;
    const originZ = cz * EXPLORE_CHUNK_SIZE;
    const lx = Math.floor((wx - originX) / EXPLORE_FOG_CELL_SIZE);
    const lz = Math.floor((wz - originZ) / EXPLORE_FOG_CELL_SIZE);
    if (lx < 0 || lz < 0 || lx >= EXPLORE_FOG_CELLS || lz >= EXPLORE_FOG_CELLS) return null;
    return { key: chunkKey(cx, cz), idx: lz * EXPLORE_FOG_CELLS + lx };
  }

  markExplored(wx: number, wz: number, radius: number = EXPLORE_PLAYER_VIEW_RADIUS): boolean {
    this.setViewer(wx, wz, this.viewer.yaw);
    if (
      Math.abs(wx - this.lastMarkX) < EXPLORE_FOG_CELL_SIZE &&
      Math.abs(wz - this.lastMarkZ) < EXPLORE_FOG_CELL_SIZE
    ) {
      return false;
    }
    this.lastMarkX = wx;
    this.lastMarkZ = wz;

    const cellRadius = Math.ceil(radius / EXPLORE_FOG_CELL_SIZE);
    const cr2 = cellRadius * cellRadius;
    const centerGx = Math.floor(wx / EXPLORE_FOG_CELL_SIZE);
    const centerGz = Math.floor(wz / EXPLORE_FOG_CELL_SIZE);
    const minGx = centerGx - cellRadius;
    const maxGx = centerGx + cellRadius;
    const minGz = centerGz - cellRadius;
    const maxGz = centerGz + cellRadius;
    const minCx = Math.floor(minGx / EXPLORE_FOG_CELLS);
    const maxCx = Math.floor(maxGx / EXPLORE_FOG_CELLS);
    const minCz = Math.floor(minGz / EXPLORE_FOG_CELLS);
    const maxCz = Math.floor(maxGz / EXPLORE_FOG_CELLS);

    let changed = false;
    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const key = chunkKey(cx, cz);
        let grid = this.chunks.get(key);
        const originGx = cx * EXPLORE_FOG_CELLS;
        const originGz = cz * EXPLORE_FOG_CELLS;
        const lx0 = Math.max(0, minGx - originGx);
        const lx1 = Math.min(EXPLORE_FOG_CELLS - 1, maxGx - originGx);
        const lz0 = Math.max(0, minGz - originGz);
        const lz1 = Math.min(EXPLORE_FOG_CELLS - 1, maxGz - originGz);
        for (let lz = lz0; lz <= lz1; lz++) {
          const ddz = originGz + lz - centerGz;
          for (let lx = lx0; lx <= lx1; lx++) {
            const ddx = originGx + lx - centerGx;
            if (ddx * ddx + ddz * ddz > cr2) continue;
            if (!grid) {
              grid = new Uint8Array(CELLS_PER_CHUNK);
              this.chunks.set(key, grid);
            }
            const idx = lz * EXPLORE_FOG_CELLS + lx;
            if (grid[idx] === 0) {
              grid[idx] = 255;
              changed = true;
            }
          }
        }
      }
    }

    if (changed) this.version += 1;
    return changed;
  }

  isPositionExplored(wx: number, wz: number): boolean {
    const cell = this.cellOf(wx, wz);
    if (!cell) return false;
    const grid = this.chunks.get(cell.key);
    return !!grid && grid[cell.idx]! > 0;
  }

  isEnemyVisible(enemyX: number, enemyZ: number, playerX: number, playerZ: number): boolean {
    const dx = enemyX - playerX;
    const dz = enemyZ - playerZ;
    if (dx * dx + dz * dz < EXPLORE_PLAYER_VIEW_RADIUS * EXPLORE_PLAYER_VIEW_RADIUS) return true;
    return this.isPositionExplored(enemyX, enemyZ);
  }
}

export const exploreFog = new ExploreFogOfWar();
