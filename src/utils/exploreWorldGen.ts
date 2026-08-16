/**
 * Deterministic explore-mode worldgen. Same seed + chunk coords ⇒ identical output
 * on every client (no terrain netcode). Must stay in sync with `backend/exploreWorldGen.js`.
 *
 * Prop arrays are packed Float32Arrays (no per-blade/per-disc objects):
 *   grass stride 6: x, z, rotY, sx, sy, sz
 *   disc stride 5:  x, z, radius, scale, rotY
 */

import type { MushroomInstance } from './mushroomLayout';

export const EXPLORE_CHUNK_SIZE = 48;
export const EXPLORE_GRASS_PER_CHUNK = 1200;
export const EXPLORE_GRASS_STRIDE = 6;
export const EXPLORE_DISC_STRIDE = 5;
export const EXPLORE_MUSHROOM_VIEW_RADIUS = 26;
export const EXPLORE_MUSHROOM_SLOT_SPAN = 16;
export const EXPLORE_CHUNK_COORD_SPAN = 16384;
export const EXPLORE_CHUNK_COORD_BIAS = 8192;
export const EXPLORE_WILDERNESS_RING = 80;

export function exploreWildernessLevel(x: number, z: number): number {
  const r = Math.hypot(x || 0, z || 0);
  return r <= 0 ? 1 : Math.ceil(r / EXPLORE_WILDERNESS_RING);
}

export type ExploreBiome = 'meadow' | 'forest' | 'barren' | 'mist';

export type ExploreChunkData = {
  cx: number;
  cz: number;
  biome: ExploreBiome;
  groundTint: string;
  grassPalette: [number, number, number];
  grass: Float32Array;
  grassCount: number;
  trees: Float32Array;
  treeCount: number;
  rocks: Float32Array;
  rockCount: number;
  mushrooms: Float32Array;
  mushroomCount: number;
};

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function worldToChunk(x: number, z: number): { cx: number; cz: number } {
  return {
    cx: Math.floor(x / EXPLORE_CHUNK_SIZE),
    cz: Math.floor(z / EXPLORE_CHUNK_SIZE),
  };
}

export function chunkOrigin(cx: number, cz: number): { x: number; z: number } {
  return { x: cx * EXPLORE_CHUNK_SIZE, z: cz * EXPLORE_CHUNK_SIZE };
}

function hash2(seed: number, x: number, z: number): number {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function fade(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(seed: number, x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = x0 + 1;
  const z1 = z0 + 1;
  const tx = fade(x - x0);
  const tz = fade(z - z0);
  const n00 = hash2(seed, x0, z0) / 4294967296;
  const n10 = hash2(seed, x1, z0) / 4294967296;
  const n01 = hash2(seed, x0, z1) / 4294967296;
  const n11 = hash2(seed, x1, z1) / 4294967296;
  const nx0 = n00 + (n10 - n00) * tx;
  const nx1 = n01 + (n11 - n01) * tx;
  return nx0 + (nx1 - nx0) * tz;
}

function fbm(seed: number, x: number, z: number): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    sum += amp * valueNoise(seed + i * 101, x * freq, z * freq);
    amp *= 0.5;
    freq *= 2;
  }
  return sum;
}

function biomeAt(seed: number, wx: number, wz: number): ExploreBiome {
  const n = fbm(seed, wx * 0.012, wz * 0.012);
  const m = fbm(seed ^ 0x9e3779b9, wx * 0.007 + 40, wz * 0.007 - 18);
  if (n < 0.28) return 'mist';
  if (n > 0.72) return 'forest';
  if (m < 0.32) return 'barren';
  return 'meadow';
}

const BIOME_GROUND: Record<ExploreBiome, string> = {
  meadow: '#3d5c32',
  forest: '#2a4228',
  barren: '#5a4a38',
  mist: '#3a4a48',
};

const BIOME_GRASS: Record<ExploreBiome, [number, number, number]> = {
  meadow: [0.28, 0.52, 0.22],
  forest: [0.18, 0.38, 0.16],
  barren: [0.42, 0.36, 0.18],
  mist: [0.22, 0.38, 0.34],
};

function rejectNearPacked(
  data: number[],
  count: number,
  x: number,
  z: number,
  minDist: number,
): boolean {
  const min2 = minDist * minDist;
  for (let i = 0; i < count; i++) {
    const o = i * EXPLORE_DISC_STRIDE;
    const dx = data[o]! - x;
    const dz = data[o + 1]! - z;
    if (dx * dx + dz * dz < min2) return true;
  }
  return false;
}

function packDiscs(data: number[], count: number): Float32Array {
  const out = new Float32Array(count * EXPLORE_DISC_STRIDE);
  for (let i = 0; i < count * EXPLORE_DISC_STRIDE; i++) out[i] = data[i]!;
  return out;
}

export function packExploreMushroomIndex(cx: number, cz: number, slot: number): number {
  return (
    ((cx + EXPLORE_CHUNK_COORD_BIAS) * EXPLORE_CHUNK_COORD_SPAN + (cz + EXPLORE_CHUNK_COORD_BIAS))
    * EXPLORE_MUSHROOM_SLOT_SPAN
    + (slot & (EXPLORE_MUSHROOM_SLOT_SPAN - 1))
  );
}

export function unpackExploreMushroomIndex(
  index: number,
): { cx: number; cz: number; slot: number } | null {
  if (!Number.isFinite(index) || index < 0 || !Number.isInteger(index)) return null;
  const slot = index % EXPLORE_MUSHROOM_SLOT_SPAN;
  const rest = Math.floor(index / EXPLORE_MUSHROOM_SLOT_SPAN);
  const cz = (rest % EXPLORE_CHUNK_COORD_SPAN) - EXPLORE_CHUNK_COORD_BIAS;
  const cx = Math.floor(rest / EXPLORE_CHUNK_COORD_SPAN) - EXPLORE_CHUNK_COORD_BIAS;
  if (!Number.isFinite(cx) || !Number.isFinite(cz)) return null;
  return { cx, cz, slot };
}

export function mushroomVisualFromScale(scale: number): { h: number; cr: number } {
  return { h: 0.14 + scale * 0.45, cr: 0.7 + scale * 0.9 };
}

export function exploreRockVariant(x: number, z: number): 0 | 1 {
  return (hash2(0x51ed, Math.round(x * 4), Math.round(z * 4)) & 1) as 0 | 1;
}

export function getExploreMushroom(seed: number, packedIndex: number): MushroomInstance | null {
  const unpacked = unpackExploreMushroomIndex(packedIndex);
  if (!unpacked) return null;
  const chunk = generateChunk(seed, unpacked.cx, unpacked.cz);
  if (unpacked.slot >= chunk.mushroomCount) return null;
  const o = unpacked.slot * EXPLORE_DISC_STRIDE;
  const x = chunk.mushrooms[o]!;
  const z = chunk.mushrooms[o + 1]!;
  const scale = chunk.mushrooms[o + 3]!;
  const vis = mushroomVisualFromScale(scale);
  return { index: packedIndex, x, z, h: vis.h, cr: vis.cr };
}

export function isExploreBlocked(seed: number, x: number, z: number, pad = 1.2): boolean {
  const { cx, cz } = worldToChunk(x, z);
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const chunk = generateChunk(seed, cx + dx, cz + dz);
      if (discHits(chunk.trees, chunk.treeCount, x, z, pad)) return true;
      if (discHits(chunk.rocks, chunk.rockCount, x, z, pad)) return true;
    }
  }
  return false;
}

function discHits(
  data: Float32Array,
  count: number,
  x: number,
  z: number,
  pad: number,
): boolean {
  for (let i = 0; i < count; i++) {
    const o = i * EXPLORE_DISC_STRIDE;
    const dx = data[o]! - x;
    const dz = data[o + 1]! - z;
    const r = data[o + 2]! + pad;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

export function generateChunk(seed: number, cx: number, cz: number): ExploreChunkData {
  const origin = chunkOrigin(cx, cz);
  const centerX = origin.x + EXPLORE_CHUNK_SIZE * 0.5;
  const centerZ = origin.z + EXPLORE_CHUNK_SIZE * 0.5;
  const biome = biomeAt(seed, centerX, centerZ);
  const rand = mulberry32(hash2(seed, cx, cz));

  const grassDensity =
    biome === 'forest' ? 0.85 : biome === 'barren' ? 0.45 : biome === 'mist' ? 0.65 : 1;
  const nGrass = Math.max(80, Math.floor(EXPLORE_GRASS_PER_CHUNK * grassDensity));
  const grass = new Float32Array(nGrass * EXPLORE_GRASS_STRIDE);
  for (let i = 0; i < nGrass; i++) {
    const o = i * EXPLORE_GRASS_STRIDE;
    const x = origin.x + rand() * EXPLORE_CHUNK_SIZE;
    const z = origin.z + rand() * EXPLORE_CHUNK_SIZE;
    const clump = Math.sin(x * 0.3 + 0.7) * Math.cos(z * 0.5 + 1.2) * 0.4 + 0.6;
    grass[o] = x;
    grass[o + 1] = z;
    grass[o + 2] = rand() * Math.PI * 2;
    grass[o + 3] = 0.8 + rand() * 0.5;
    grass[o + 4] = 0.42 * (0.3 + rand() * 1.4) * clump;
    grass[o + 5] = 0.8 + rand() * 0.5;
  }

  const treeTarget = biome === 'forest' ? 14 : biome === 'meadow' ? 5 : biome === 'mist' ? 4 : 2;
  const treeScratch: number[] = [];
  let treeCount = 0;
  for (let i = 0; i < treeTarget * 4 && treeCount < treeTarget; i++) {
    const x = origin.x + 2 + rand() * (EXPLORE_CHUNK_SIZE - 4);
    const z = origin.z + 2 + rand() * (EXPLORE_CHUNK_SIZE - 4);
    if (rejectNearPacked(treeScratch, treeCount, x, z, 4.5)) continue;
    const scale = 0.85 + rand() * 0.55;
    const o = treeCount * EXPLORE_DISC_STRIDE;
    treeScratch[o] = x;
    treeScratch[o + 1] = z;
    treeScratch[o + 2] = 0.55 * scale;
    treeScratch[o + 3] = scale;
    treeScratch[o + 4] = rand() * Math.PI * 2;
    treeCount++;
  }

  const rockTarget = biome === 'barren' ? 10 : biome === 'mist' ? 5 : 3;
  const rockScratch: number[] = [];
  let rockCount = 0;
  for (let i = 0; i < rockTarget * 4 && rockCount < rockTarget; i++) {
    const x = origin.x + 1.5 + rand() * (EXPLORE_CHUNK_SIZE - 3);
    const z = origin.z + 1.5 + rand() * (EXPLORE_CHUNK_SIZE - 3);
    if (
      rejectNearPacked(rockScratch, rockCount, x, z, 2.2) ||
      rejectNearPacked(treeScratch, treeCount, x, z, 2.5)
    ) {
      continue;
    }
    const scale = (0.5 + rand() * 0.9) * 2;
    const o = rockCount * EXPLORE_DISC_STRIDE;
    rockScratch[o] = x;
    rockScratch[o + 1] = z;
    rockScratch[o + 2] = 0.7 * scale;
    rockScratch[o + 3] = scale;
    rockScratch[o + 4] = rand() * Math.PI * 2;
    rockCount++;
  }

  const mushTarget = biome === 'forest' ? 8 : biome === 'meadow' ? 4 : 1;
  const mushScratch: number[] = [];
  let mushroomCount = 0;
  for (let i = 0; i < mushTarget * 4 && mushroomCount < mushTarget; i++) {
    const x = origin.x + 1 + rand() * (EXPLORE_CHUNK_SIZE - 2);
    const z = origin.z + 1 + rand() * (EXPLORE_CHUNK_SIZE - 2);
    if (
      rejectNearPacked(treeScratch, treeCount, x, z, 1.6) ||
      rejectNearPacked(rockScratch, rockCount, x, z, 1.4)
    ) {
      continue;
    }
    const scale = 0.6 + rand() * 0.6;
    const o = mushroomCount * EXPLORE_DISC_STRIDE;
    mushScratch[o] = x;
    mushScratch[o + 1] = z;
    mushScratch[o + 2] = 0.25 * scale;
    mushScratch[o + 3] = scale;
    mushScratch[o + 4] = rand() * Math.PI * 2;
    mushroomCount++;
  }

  return {
    cx,
    cz,
    biome,
    groundTint: BIOME_GROUND[biome],
    grassPalette: BIOME_GRASS[biome],
    grass,
    grassCount: nGrass,
    trees: packDiscs(treeScratch, treeCount),
    treeCount,
    rocks: packDiscs(rockScratch, rockCount),
    rockCount,
    mushrooms: packDiscs(mushScratch, mushroomCount),
    mushroomCount,
  };
}
