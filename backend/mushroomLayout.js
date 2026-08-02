/**
 * Deterministic mushroom ring — must stay in sync with `src/utils/mushroomLayout.ts` (MUSHROOM_LAYOUT_SEED).
 */
const MAIN_ARENA_HEX_RADIUS = 16;
const MAIN_MAP_HALF_X = MAIN_ARENA_HEX_RADIUS;
const MAIN_MAP_HALF_Z = MAIN_ARENA_HEX_RADIUS;

const MUSHROOM_COUNT = 17;
const MUSHROOM_INNER_RADIUS = 3;
const MUSHROOM_OUTER_RADIUS = MAIN_MAP_HALF_Z - 10;
const MUSHROOM_LAYOUT_SEED = 0x1a2b3c4d;
const MUSHROOM_HALF_X = MAIN_MAP_HALF_X - 1.0;
const MUSHROOM_HALF_Z = MAIN_MAP_HALF_Z - 2.0;

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let _cached = null;
function getInstances() {
  if (_cached) return _cached;
  const rand = mulberry32(MUSHROOM_LAYOUT_SEED);
  const out = [];
  for (let i = 0; i < MUSHROOM_COUNT; i++) {
    let x = 0;
    let z = 0;
    for (let attempt = 0; attempt < 64; attempt++) {
      x = (rand() * 2 - 1) * MUSHROOM_HALF_X;
      z = (rand() * 2 - 1) * MUSHROOM_HALF_Z;
      if (Math.hypot(x, z) >= MUSHROOM_INNER_RADIUS && Math.hypot(x, z) <= MAIN_MAP_HALF_X - 1.0) break;
    }
    const h = 0.14 + rand() * 0.55;
    const cr = 0.7 + rand() * 1.4;
    out.push({ index: i, x, z, h, cr });
  }
  _cached = out;
  return out;
}

function getEruptionPosition(index) {
  const inst = getInstances()[index];
  if (!inst) return null;
  return { x: inst.x, y: 0.1, z: inst.z };
}

module.exports = {
  MUSHROOM_COUNT,
  getInstances,
  getEruptionPosition,
};
