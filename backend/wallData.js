/**
 * Castle wall segment definitions — backend mirror of CastleWalls.tsx.
 *
 * Each segment is an axis-aligned box described by its centre position and
 * full extents (sizeX, sizeY, sizeZ). The visible client walls are rotated
 * circular arc samples; this backend mirror matches those segments for
 * EnemyAI collision and line-of-sight tests.
 *
 * Keep these values in sync with WALL_SEGMENTS in
 * src/components/environment/CastleWalls.tsx.
 */

const WALL_HEIGHT    = 3.0;
const WALL_THICKNESS = 0.6;

// Mirror: client MAIN_ARENA_HEX_RADIUS.
const MAIN_ARENA_HEX_RADIUS = 26;
const t = WALL_THICKNESS;
const targetChordLength = 2.0;

function buildCircularWallSegments(innerRadius) {
  const Rc = innerRadius + t / 2;
  const circumference = 2 * Math.PI * Rc;
  const n = Math.max(24, Math.round(circumference / targetChordLength));
  const segments = [];
  for (let i = 0; i < n; i++) {
    const theta = (i / n) * Math.PI * 2;
    const chord = 2 * Rc * Math.sin(Math.PI / n);
    segments.push({
      center: [Math.cos(theta) * Rc, WALL_HEIGHT / 2, Math.sin(theta) * Rc],
      sizeX: chord,
      sizeY: WALL_HEIGHT,
      sizeZ: t,
      rotationY: Math.PI / 2 - theta,
    });
  }
  return segments;
}

const WALL_SEGMENTS = [];
for (const seg of buildCircularWallSegments(MAIN_ARENA_HEX_RADIUS)) {
  const rotY = seg.rotationY ?? 0;
  const steps = rotY === 0 ? 1 : Math.max(1, Math.ceil(seg.sizeX / 1.0));
  const step = seg.sizeX / steps;
  const tangentX = Math.cos(rotY);
  const tangentZ = -Math.sin(rotY);
  const start = -seg.sizeX / 2 + step / 2;
  for (let i = 0; i < steps; i++) {
    const offset = rotY === 0 ? 0 : start + i * step;
    WALL_SEGMENTS.push({
      center: [seg.center[0] + tangentX * offset, seg.center[1], seg.center[2] + tangentZ * offset],
      sizeX: rotY === 0 ? seg.sizeX : step + 0.15,
      sizeY: seg.sizeY,
      sizeZ: seg.sizeZ + 0.35,
    });
  }
}

module.exports = { WALL_SEGMENTS };
