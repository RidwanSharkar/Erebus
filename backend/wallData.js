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

const WALL_SEGMENTS = [
  // Maze Wall 1 · NW Barrier (east-west)
  { center: [-14,  WALL_HEIGHT / 2, -18 ], sizeX: 12,             sizeY: WALL_HEIGHT, sizeZ: WALL_THICKNESS },
  // Maze Wall 2 · North Shard (north-south)
  { center: [  5,  WALL_HEIGHT / 2, -22 ], sizeX: WALL_THICKNESS, sizeY: WALL_HEIGHT, sizeZ: 10            },
  // Maze Wall 3 · East Spine (north-south)
  { center: [ 18,  WALL_HEIGHT / 2,  -8 ], sizeX: WALL_THICKNESS, sizeY: WALL_HEIGHT, sizeZ: 12            },
  // Maze Wall 4 · Center-East Divider (east-west)
  { center: [ 12,  WALL_HEIGHT / 2,   2 ], sizeX: 10,             sizeY: WALL_HEIGHT, sizeZ: WALL_THICKNESS },
  // Maze Wall 5 · Central Chokepoint (north-south)
  { center: [  0,  WALL_HEIGHT / 2,   8 ], sizeX: WALL_THICKNESS, sizeY: WALL_HEIGHT, sizeZ: 10            },
  // Maze Wall 6 · SE Corridor (east-west)
  { center: [ 14,  WALL_HEIGHT / 2,  18 ], sizeX: 12,             sizeY: WALL_HEIGHT, sizeZ: WALL_THICKNESS },
  // Maze Wall 7 · SW Channel (north-south)
  { center: [-16,  WALL_HEIGHT / 2,  15 ], sizeX: WALL_THICKNESS, sizeY: WALL_HEIGHT, sizeZ: 10            },
  // Maze Wall 8 · West Divider (east-west)
  { center: [-20,  WALL_HEIGHT / 2,   0 ], sizeX: 10,             sizeY: WALL_HEIGHT, sizeZ: WALL_THICKNESS },
  // Maze Wall 9 · NW-Center Rib (north-south)
  { center: [ -6,  WALL_HEIGHT / 2,  -8 ], sizeX: WALL_THICKNESS, sizeY: WALL_HEIGHT, sizeZ: 8             },
];

module.exports = { WALL_SEGMENTS };
