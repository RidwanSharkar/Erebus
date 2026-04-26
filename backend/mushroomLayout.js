/**
 * Deterministic mushroom ring — same logic as `src/utils/mushroomLayout.ts` (MUSHROOM_LAYOUT_SEED).
 */
const MUSHROOM_COUNT = 20;
const MUSHROOM_INNER_RADIUS = 5;
const MUSHROOM_OUTER_RADIUS = 25;
const MUSHROOM_LAYOUT_SEED = 0x1a2b3c4d;

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
    const angle = rand() * Math.PI * 2;
    const r = MUSHROOM_INNER_RADIUS + rand() * (MUSHROOM_OUTER_RADIUS - MUSHROOM_INNER_RADIUS);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
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
