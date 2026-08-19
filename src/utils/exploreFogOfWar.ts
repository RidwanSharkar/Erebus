/**
 * Sparse chunk-keyed fog of war for Explore Mode.
 * 12×12 cells per 48-unit chunk (4 world units / cell).
 */

import { EXPLORE_CHUNK_SIZE, chunkKey, worldToChunk } from './exploreWorldGen';

export const EXPLORE_FOG_CELLS = 12;
export const EXPLORE_PLAYER_VIEW_RADIUS = 27;
export const EXPLORE_FOG_CELL_SIZE = EXPLORE_CHUNK_SIZE / EXPLORE_FOG_CELLS;
export const EXPLORE_FOG_CHUNK_BYTES = EXPLORE_FOG_CELLS * EXPLORE_FOG_CELLS;
export const EXPLORE_FOG_MAX_CHUNKS = 1024;

const CELLS_PER_CHUNK = EXPLORE_FOG_CHUNK_BYTES;
const FOG_KEY_RE = /^-?\d{1,6},-?\d{1,6}$/;

export type ExploreViewer = { x: number; z: number; yaw: number };

/** Wire format: chunk key `"cx,cz"` + base64 of 144 explored-cell bytes. */
export type ExploreFogChunkDTO = { k: string; d: string };

function bytesToB64(bytes: Uint8Array): string {
  if (typeof globalThis.btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
    return globalThis.btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

function b64ToBytes(raw: string): Uint8Array | null {
  try {
    if (typeof globalThis.atob === 'function') {
      const binary = globalThis.atob(raw);
      const out = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(raw, 'base64'));
  } catch {
    return null;
  }
}

function encodeChunk(key: string, grid: Uint8Array): ExploreFogChunkDTO {
  return { k: key, d: bytesToB64(grid) };
}

export function decodeExploreFogChunks(raw: unknown): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  if (!Array.isArray(raw)) return out;
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const k = (entry as { k?: unknown }).k;
    const d = (entry as { d?: unknown }).d;
    if (typeof k !== 'string' || !FOG_KEY_RE.test(k)) continue;
    if (typeof d !== 'string' || d.length > 400) continue;
    const bytes = b64ToBytes(d);
    if (!bytes || bytes.length !== CELLS_PER_CHUNK) continue;
    if (out.size >= EXPLORE_FOG_MAX_CHUNKS) break;
    out.set(k, bytes);
  }
  return out;
}

function mergeGrid(dst: Uint8Array, src: Uint8Array): boolean {
  let changed = false;
  const n = Math.min(dst.length, src.length);
  for (let i = 0; i < n; i++) {
    const v = dst[i]! | src[i]!;
    if (v !== dst[i]) {
      dst[i] = v;
      changed = true;
    }
  }
  return changed;
}

class ExploreFogOfWar {
  private chunks = new Map<string, Uint8Array>();
  private dirtyKeys = new Set<string>();
  private viewer: ExploreViewer = { x: 0, z: 0, yaw: 0 };
  private version = 0;
  private lastMarkX = Number.POSITIVE_INFINITY;
  private lastMarkZ = Number.POSITIVE_INFINITY;

  reset(): void {
    this.chunks.clear();
    this.dirtyKeys.clear();
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

  serializeAll(): ExploreFogChunkDTO[] {
    const out: ExploreFogChunkDTO[] = [];
    for (const [key, grid] of this.chunks) {
      out.push(encodeChunk(key, grid));
    }
    return out;
  }

  consumeDirtyChunks(): ExploreFogChunkDTO[] {
    if (this.dirtyKeys.size === 0) return [];
    const out: ExploreFogChunkDTO[] = [];
    for (const key of this.dirtyKeys) {
      const grid = this.chunks.get(key);
      if (grid) out.push(encodeChunk(key, grid));
    }
    this.dirtyKeys.clear();
    return out;
  }

  hydrate(raw: unknown, opts?: { replace?: boolean }): void {
    const incoming = decodeExploreFogChunks(raw);
    const replace = opts?.replace !== false;
    if (replace) {
      this.chunks.clear();
      this.lastMarkX = Number.POSITIVE_INFINITY;
      this.lastMarkZ = Number.POSITIVE_INFINITY;
    }
    let changed = replace;
    for (const [key, grid] of incoming) {
      if (replace) {
        this.chunks.set(key, grid);
        continue;
      }
      const existing = this.chunks.get(key);
      if (!existing) {
        if (this.chunks.size >= EXPLORE_FOG_MAX_CHUNKS) continue;
        this.chunks.set(key, grid);
        changed = true;
        continue;
      }
      if (mergeGrid(existing, grid)) changed = true;
    }
    this.dirtyKeys.clear();
    if (changed) this.version += 1;
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
              if (this.chunks.size >= EXPLORE_FOG_MAX_CHUNKS) continue;
              grid = new Uint8Array(CELLS_PER_CHUNK);
              this.chunks.set(key, grid);
            }
            const idx = lz * EXPLORE_FOG_CELLS + lx;
            if (grid[idx] === 0) {
              grid[idx] = 255;
              changed = true;
              this.dirtyKeys.add(key);
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
