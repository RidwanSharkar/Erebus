/**
 * Castle wall segment definitions — backend mirror of CastleWalls.tsx.
 *
 * Each segment is an axis-aligned box described by its centre position and
 * full extents (sizeX, sizeY, sizeZ).  Only X and Z matter for the 2-D
 * collision and line-of-sight tests used by EnemyAI.
 *
 * Keep these values in sync with WALL_SEGMENTS in
 * src/components/environment/CastleWalls.tsx.
 */

const WALL_HEIGHT    = 3.0;
const WALL_THICKNESS = 0.6;

// Mirror: client MAIN_MAP_HALF_X/Z, inner wall faces at x = ±16 and z = ±35.
const MAIN_MAP_HALF_X = 16;
const MAIN_MAP_HALF_Z = 35;
const t = WALL_THICKNESS;
const wallXOffset = MAIN_MAP_HALF_X + t / 2;
const wallZOffset = MAIN_MAP_HALF_Z + t / 2;
const wallFullWidth = MAIN_MAP_HALF_X * 2 + t * 2;
const wallFullDepth = MAIN_MAP_HALF_Z * 2 + t * 2;

const WALL_SEGMENTS = [
  { center: [0,  WALL_HEIGHT / 2,  wallZOffset], sizeX: wallFullWidth, sizeY: WALL_HEIGHT, sizeZ: t },
  { center: [0,  WALL_HEIGHT / 2, -wallZOffset], sizeX: wallFullWidth, sizeY: WALL_HEIGHT, sizeZ: t },
  { center: [ wallXOffset,  WALL_HEIGHT / 2, 0], sizeX: t, sizeY: WALL_HEIGHT, sizeZ: wallFullDepth },
  { center: [-wallXOffset,  WALL_HEIGHT / 2, 0], sizeX: t, sizeY: WALL_HEIGHT, sizeZ: wallFullDepth },
];

module.exports = { WALL_SEGMENTS };
