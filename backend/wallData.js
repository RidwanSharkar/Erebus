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

// Mirror: MAIN_MAP_RADIUS = 20, four-sided ring tangent to the play disc.
const R = 20;
const t = WALL_THICKNESS;
const wallCenterOffset = R + t / 2;
const longSpan = 2 * R;

const WALL_SEGMENTS = [
  { center: [0,  WALL_HEIGHT / 2,  wallCenterOffset], sizeX: longSpan,       sizeY: WALL_HEIGHT, sizeZ: t },
  { center: [0,  WALL_HEIGHT / 2, -wallCenterOffset], sizeX: longSpan,       sizeY: WALL_HEIGHT, sizeZ: t },
  { center: [ wallCenterOffset,  WALL_HEIGHT / 2, 0], sizeX: t, sizeY: WALL_HEIGHT, sizeZ: longSpan        },
  { center: [-wallCenterOffset,  WALL_HEIGHT / 2, 0], sizeX: t, sizeY: WALL_HEIGHT, sizeZ: longSpan        },
];

module.exports = { WALL_SEGMENTS };
