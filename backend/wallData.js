/**
 * Castle wall segment definitions — backend mirror of CastleWalls.tsx.
 *
 * Each segment is an axis-aligned box described by its centre position and
 * full extents (sizeX, sizeY, sizeZ). The visible client walls are rotated
 * hex sides; this backend mirror samples those sides into short AABB blocks
 * for the existing EnemyAI collision and line-of-sight tests.
 *
 * Keep these values in sync with WALL_SEGMENTS in
 * src/components/environment/CastleWalls.tsx.
 */

const WALL_HEIGHT    = 3.0;
const WALL_THICKNESS = 0.6;

// Mirror: client MAIN_ARENA_HEX_RADIUS.
const MAIN_ARENA_HEX_RADIUS = 26;
const t = WALL_THICKNESS;
const hexApothem = MAIN_ARENA_HEX_RADIUS * Math.cos(Math.PI / 6);
const sampleSpacing = 1.0;

const WALL_SEGMENTS = [];
for (let side = 0; side < 6; side++) {
  const angle = (Math.PI / 3) * side;
  const cx = Math.cos(angle) * (hexApothem + t / 2);
  const cz = Math.sin(angle) * (hexApothem + t / 2);
  const rotY = Math.PI / 2 - angle;
  const tangentX = Math.cos(rotY);
  const tangentZ = -Math.sin(rotY);
  const steps = Math.max(1, Math.ceil(MAIN_ARENA_HEX_RADIUS / sampleSpacing));
  const step = MAIN_ARENA_HEX_RADIUS / steps;
  const start = -MAIN_ARENA_HEX_RADIUS / 2 + step / 2;
  for (let i = 0; i < steps; i++) {
    const offset = start + i * step;
    WALL_SEGMENTS.push({
      center: [cx + tangentX * offset, WALL_HEIGHT / 2, cz + tangentZ * offset],
      sizeX: step + 0.15,
      sizeY: WALL_HEIGHT,
      sizeZ: t + 0.35,
    });
  }
}

module.exports = { WALL_SEGMENTS };
