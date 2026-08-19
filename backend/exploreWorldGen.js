/**
 * Deterministic explore-mode worldgen. Must stay in sync with `src/utils/exploreWorldGen.ts`.
 * Grass blades are not stored — RNG is consumed in the same order so mushroom/rock/tree
 * (and root/spine) positions match the client.
 */

const EXPLORE_CHUNK_SIZE = 48;
// Must match `EXPLORE_GRASS_PER_CHUNK` in src/utils/exploreWorldGen.ts so tree/rock/mushroom RNG stays in lockstep.
const EXPLORE_GRASS_PER_CHUNK = 1200;
const EXPLORE_DISC_STRIDE = 5;
const EXPLORE_MUSHROOM_SLOT_SPAN = 16;
const EXPLORE_CHUNK_COORD_SPAN = 16384;
const EXPLORE_CHUNK_COORD_BIAS = 8192;
const CHUNK_CACHE_MAX = 48;

function hash2(seed, x, z) {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function fade(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(seed, x, z) {
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

function fbm(seed, x, z) {
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

function biomeAt(seed, wx, wz) {
  const n = fbm(seed, wx * 0.012, wz * 0.012);
  const m = fbm(seed ^ 0x9e3779b9, wx * 0.007 + 40, wz * 0.007 - 18);
  if (n < 0.28) return 'mist';
  if (n > 0.72) return 'forest';
  if (m < 0.32) return 'barren';
  return 'meadow';
}

function worldToChunk(x, z) {
  return {
    cx: Math.floor(x / EXPLORE_CHUNK_SIZE),
    cz: Math.floor(z / EXPLORE_CHUNK_SIZE),
  };
}

function chunkOrigin(cx, cz) {
  return { x: cx * EXPLORE_CHUNK_SIZE, z: cz * EXPLORE_CHUNK_SIZE };
}

function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

function rejectNearPacked(data, count, x, z, minDist) {
  const min2 = minDist * minDist;
  for (let i = 0; i < count; i++) {
    const o = i * EXPLORE_DISC_STRIDE;
    const dx = data[o] - x;
    const dz = data[o + 1] - z;
    if (dx * dx + dz * dz < min2) return true;
  }
  return false;
}

function packDiscs(data, count) {
  const out = new Array(count * EXPLORE_DISC_STRIDE);
  for (let i = 0; i < count * EXPLORE_DISC_STRIDE; i++) out[i] = data[i];
  return out;
}

function generateChunkUncached(seed, cx, cz) {
  const origin = chunkOrigin(cx, cz);
  const centerX = origin.x + EXPLORE_CHUNK_SIZE * 0.5;
  const centerZ = origin.z + EXPLORE_CHUNK_SIZE * 0.5;
  const biome = biomeAt(seed, centerX, centerZ);
  const rand = mulberry32(hash2(seed, cx, cz));

  const grassDensity =
    biome === 'forest' ? 0.85 : biome === 'barren' ? 0.45 : biome === 'mist' ? 0.65 : 1;
  const nGrass = Math.max(80, Math.floor(EXPLORE_GRASS_PER_CHUNK * grassDensity));
  for (let i = 0; i < nGrass; i++) {
    const x = origin.x + rand() * EXPLORE_CHUNK_SIZE;
    const z = origin.z + rand() * EXPLORE_CHUNK_SIZE;
    rand();
    rand();
    rand();
    rand();
    void x;
    void z;
  }

  const treeTarget = biome === 'forest' ? 14 : biome === 'meadow' ? 5 : biome === 'mist' ? 4 : 2;
  const treeScratch = [];
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
  const rockScratch = [];
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
  const mushScratch = [];
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

  const rootTarget = Math.round(treeTarget * 0.5);
  const rootScratch = [];
  let rootCount = 0;
  for (let i = 0; i < rootTarget * 4 && rootCount < rootTarget; i++) {
    const x = origin.x + 1.5 + rand() * (EXPLORE_CHUNK_SIZE - 3);
    const z = origin.z + 1.5 + rand() * (EXPLORE_CHUNK_SIZE - 3);
    if (
      rejectNearPacked(rootScratch, rootCount, x, z, 2.2) ||
      rejectNearPacked(treeScratch, treeCount, x, z, 2.5) ||
      rejectNearPacked(rockScratch, rockCount, x, z, 2.2) ||
      rejectNearPacked(mushScratch, mushroomCount, x, z, 1.4)
    ) {
      continue;
    }
    const scale = 0.85 + rand() * 0.55;
    const o = rootCount * EXPLORE_DISC_STRIDE;
    rootScratch[o] = x;
    rootScratch[o + 1] = z;
    rootScratch[o + 2] = 0.55 * scale;
    rootScratch[o + 3] = scale;
    rootScratch[o + 4] = rand() * Math.PI * 2;
    rootCount++;
  }

  const spineTarget = Math.max(0, Math.round(treeTarget / 8));
  const spineScratch = [];
  let spineCount = 0;
  for (let i = 0; i < spineTarget * 4 && spineCount < spineTarget; i++) {
    const x = origin.x + 2 + rand() * (EXPLORE_CHUNK_SIZE - 4);
    const z = origin.z + 2 + rand() * (EXPLORE_CHUNK_SIZE - 4);
    if (
      rejectNearPacked(spineScratch, spineCount, x, z, 5) ||
      rejectNearPacked(treeScratch, treeCount, x, z, 3.5) ||
      rejectNearPacked(rockScratch, rockCount, x, z, 2.5) ||
      rejectNearPacked(mushScratch, mushroomCount, x, z, 1.6) ||
      rejectNearPacked(rootScratch, rootCount, x, z, 2.5)
    ) {
      continue;
    }
    const scale = 0.7 + rand() * 1.1;
    const o = spineCount * EXPLORE_DISC_STRIDE;
    spineScratch[o] = x;
    spineScratch[o + 1] = z;
    spineScratch[o + 2] = 0.9 * scale;
    spineScratch[o + 3] = scale;
    spineScratch[o + 4] = rand() * Math.PI * 2;
    spineCount++;
  }

  return {
    cx,
    cz,
    trees: packDiscs(treeScratch, treeCount),
    treeCount,
    rocks: packDiscs(rockScratch, rockCount),
    rockCount,
    mushrooms: packDiscs(mushScratch, mushroomCount),
    mushroomCount,
    roots: packDiscs(rootScratch, rootCount),
    rootCount,
    spines: packDiscs(spineScratch, spineCount),
    spineCount,
  };
}

const chunkCache = new Map();

function generateChunk(seed, cx, cz) {
  const key = `${seed >>> 0}:${chunkKey(cx, cz)}`;
  const cached = chunkCache.get(key);
  if (cached) {
    chunkCache.delete(key);
    chunkCache.set(key, cached);
    return cached;
  }
  const data = generateChunkUncached(seed, cx, cz);
  chunkCache.set(key, data);
  while (chunkCache.size > CHUNK_CACHE_MAX) {
    const oldest = chunkCache.keys().next().value;
    if (oldest === undefined) break;
    chunkCache.delete(oldest);
  }
  return data;
}

function unpackExploreMushroomIndex(index) {
  if (typeof index !== 'number' || !Number.isFinite(index) || index < 0 || !Number.isInteger(index)) {
    return null;
  }
  const slot = index % EXPLORE_MUSHROOM_SLOT_SPAN;
  const rest = Math.floor(index / EXPLORE_MUSHROOM_SLOT_SPAN);
  const cz = (rest % EXPLORE_CHUNK_COORD_SPAN) - EXPLORE_CHUNK_COORD_BIAS;
  const cx = Math.floor(rest / EXPLORE_CHUNK_COORD_SPAN) - EXPLORE_CHUNK_COORD_BIAS;
  if (!Number.isFinite(cx) || !Number.isFinite(cz)) return null;
  return { cx, cz, slot };
}

function packExploreMushroomIndex(cx, cz, slot) {
  return (
    ((cx + EXPLORE_CHUNK_COORD_BIAS) * EXPLORE_CHUNK_COORD_SPAN + (cz + EXPLORE_CHUNK_COORD_BIAS))
    * EXPLORE_MUSHROOM_SLOT_SPAN
    + (slot & (EXPLORE_MUSHROOM_SLOT_SPAN - 1))
  );
}

function exploreTreeVariant(x, z) {
  let h = (0x7e31 ^ Math.imul(Math.round(x * 4), 374761393) ^ Math.imul(Math.round(z * 4), 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) % 4;
}

function exploreRockVariant(x, z) {
  let h = (0x51ed ^ Math.imul(Math.round(x * 4), 374761393) ^ Math.imul(Math.round(z * 4), 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) & 1;
}

function mushroomVisualFromScale(scale) {
  return { h: 0.14 + scale * 0.45, cr: 0.7 + scale * 0.9 };
}

function getExploreMushroom(seed, packedIndex) {
  const unpacked = unpackExploreMushroomIndex(packedIndex);
  if (!unpacked) return null;
  const chunk = generateChunk(seed, unpacked.cx, unpacked.cz);
  if (unpacked.slot >= chunk.mushroomCount) return null;
  const o = unpacked.slot * EXPLORE_DISC_STRIDE;
  const x = chunk.mushrooms[o];
  const z = chunk.mushrooms[o + 1];
  const scale = chunk.mushrooms[o + 3];
  const vis = mushroomVisualFromScale(scale);
  return { index: packedIndex, x, z, h: vis.h, cr: vis.cr };
}

function getExploreTree(seed, packedIndex) {
  const unpacked = unpackExploreMushroomIndex(packedIndex);
  if (!unpacked) return null;
  const chunk = generateChunk(seed, unpacked.cx, unpacked.cz);
  if (unpacked.slot >= chunk.treeCount) return null;
  const o = unpacked.slot * EXPLORE_DISC_STRIDE;
  const x = chunk.trees[o];
  const z = chunk.trees[o + 1];
  const radius = chunk.trees[o + 2];
  const scale = chunk.trees[o + 3];
  return {
    index: packedIndex,
    x,
    z,
    radius,
    scale,
    variant: exploreTreeVariant(x, z),
  };
}

function getExploreRoot(seed, packedIndex) {
  const unpacked = unpackExploreMushroomIndex(packedIndex);
  if (!unpacked) return null;
  const chunk = generateChunk(seed, unpacked.cx, unpacked.cz);
  if (unpacked.slot >= chunk.rootCount) return null;
  const o = unpacked.slot * EXPLORE_DISC_STRIDE;
  const x = chunk.roots[o];
  const z = chunk.roots[o + 1];
  const radius = chunk.roots[o + 2];
  const scale = chunk.roots[o + 3];
  return {
    index: packedIndex,
    x,
    z,
    radius,
    scale,
  };
}

function getExploreRock(seed, packedIndex) {
  const unpacked = unpackExploreMushroomIndex(packedIndex);
  if (!unpacked) return null;
  const chunk = generateChunk(seed, unpacked.cx, unpacked.cz);
  if (unpacked.slot >= chunk.rockCount) return null;
  const o = unpacked.slot * EXPLORE_DISC_STRIDE;
  const x = chunk.rocks[o];
  const z = chunk.rocks[o + 1];
  const radius = chunk.rocks[o + 2];
  const scale = chunk.rocks[o + 3];
  return {
    index: packedIndex,
    x,
    z,
    radius,
    scale,
    variant: exploreRockVariant(x, z),
  };
}

function getExploreSpine(seed, packedIndex) {
  const unpacked = unpackExploreMushroomIndex(packedIndex);
  if (!unpacked) return null;
  const chunk = generateChunk(seed, unpacked.cx, unpacked.cz);
  if (unpacked.slot >= chunk.spineCount) return null;
  const o = unpacked.slot * EXPLORE_DISC_STRIDE;
  const x = chunk.spines[o];
  const z = chunk.spines[o + 1];
  const radius = chunk.spines[o + 2];
  const scale = chunk.spines[o + 3];
  return {
    index: packedIndex,
    x,
    z,
    radius,
    scale,
  };
}

function discHits(data, count, x, z, pad) {
  for (let i = 0; i < count; i++) {
    const o = i * EXPLORE_DISC_STRIDE;
    const dx = data[o] - x;
    const dz = data[o + 1] - z;
    const r = data[o + 2] + pad;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

function treeDiscHits(chunk, x, z, pad, destroyedTreeHealth) {
  const data = chunk.trees;
  for (let i = 0; i < chunk.treeCount; i++) {
    if (destroyedTreeHealth) {
      const packed = packExploreMushroomIndex(chunk.cx, chunk.cz, i);
      const hp = destroyedTreeHealth.get(packed);
      if (hp !== undefined && hp <= 0) continue;
    }
    const o = i * EXPLORE_DISC_STRIDE;
    const dx = data[o] - x;
    const dz = data[o + 1] - z;
    const r = data[o + 2] + pad;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

function rootDiscHits(chunk, x, z, pad, destroyedRootHealth) {
  const data = chunk.roots;
  for (let i = 0; i < chunk.rootCount; i++) {
    if (destroyedRootHealth) {
      const packed = packExploreMushroomIndex(chunk.cx, chunk.cz, i);
      const hp = destroyedRootHealth.get(packed);
      if (hp !== undefined && hp <= 0) continue;
    }
    const o = i * EXPLORE_DISC_STRIDE;
    const dx = data[o] - x;
    const dz = data[o + 1] - z;
    const r = data[o + 2] + pad;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

function rockDiscHits(chunk, x, z, pad, destroyedRockHealth) {
  const data = chunk.rocks;
  for (let i = 0; i < chunk.rockCount; i++) {
    if (destroyedRockHealth) {
      const packed = packExploreMushroomIndex(chunk.cx, chunk.cz, i);
      const hp = destroyedRockHealth.get(packed);
      if (hp !== undefined && hp <= 0) continue;
    }
    const o = i * EXPLORE_DISC_STRIDE;
    const dx = data[o] - x;
    const dz = data[o + 1] - z;
    const r = data[o + 2] + pad;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

function spineDiscHits(chunk, x, z, pad, destroyedSpineHealth) {
  const data = chunk.spines;
  for (let i = 0; i < chunk.spineCount; i++) {
    if (destroyedSpineHealth) {
      const packed = packExploreMushroomIndex(chunk.cx, chunk.cz, i);
      const hp = destroyedSpineHealth.get(packed);
      if (hp !== undefined && hp <= 0) continue;
    }
    const o = i * EXPLORE_DISC_STRIDE;
    const dx = data[o] - x;
    const dz = data[o + 1] - z;
    const r = data[o + 2] + pad;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

function isExploreBlocked(
  seed,
  x,
  z,
  pad = 1.2,
  destroyedTreeHealth = null,
  destroyedRootHealth = null,
  destroyedRockHealth = null,
  destroyedSpineHealth = null,
) {
  const { cx, cz } = worldToChunk(x, z);
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const chunk = generateChunk(seed, cx + dx, cz + dz);
      if (treeDiscHits(chunk, x, z, pad, destroyedTreeHealth)) return true;
      if (rockDiscHits(chunk, x, z, pad, destroyedRockHealth)) return true;
      if (rootDiscHits(chunk, x, z, pad, destroyedRootHealth)) return true;
      if (spineDiscHits(chunk, x, z, pad, destroyedSpineHealth)) return true;
    }
  }
  return false;
}

function clearExploreWorldGenCache() {
  chunkCache.clear();
}

module.exports = {
  EXPLORE_CHUNK_SIZE,
  EXPLORE_MUSHROOM_SLOT_SPAN,
  generateChunk,
  getExploreMushroom,
  getExploreTree,
  getExploreRoot,
  getExploreRock,
  getExploreSpine,
  isExploreBlocked,
  unpackExploreMushroomIndex,
  packExploreMushroomIndex,
  worldToChunk,
  clearExploreWorldGenCache,
};
