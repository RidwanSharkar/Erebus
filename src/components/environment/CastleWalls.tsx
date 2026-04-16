'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { Matrix4, Vector3, Quaternion, InstancedMesh, Color } from '@/utils/three-exports';

// ─── Wall Segment Definitions ─────────────────────────────────────────────────
// Each segment: center position and full dimensions (sizeX, sizeY, sizeZ)
// Three wall segments per camp form a U-shaped enclosure; 4 corner posts per camp.

export interface WallSegmentDef {
  center: [number, number, number];
  sizeX: number;
  sizeY: number;
  sizeZ: number;
}

const WALL_HEIGHT = 3.0;
const WALL_THICKNESS = 0.6;

export const WALL_SEGMENTS: WallSegmentDef[] = [
  // ── Maze Wall 1 · NW Barrier (east-west) ─────────────────────────────────
  { center: [-14,   WALL_HEIGHT / 2, -18  ], sizeX: 12,            sizeY: WALL_HEIGHT, sizeZ: WALL_THICKNESS },
  // ── Maze Wall 2 · North Shard (north-south) ───────────────────────────────
  { center: [  5,   WALL_HEIGHT / 2, -22  ], sizeX: WALL_THICKNESS, sizeY: WALL_HEIGHT, sizeZ: 10            },
  // ── Maze Wall 3 · East Spine (north-south) ────────────────────────────────
  { center: [ 18,   WALL_HEIGHT / 2,  -8  ], sizeX: WALL_THICKNESS, sizeY: WALL_HEIGHT, sizeZ: 12            },
  // ── Maze Wall 4 · Center-East Divider (east-west) ─────────────────────────
  { center: [ 12,   WALL_HEIGHT / 2,   2  ], sizeX: 10,            sizeY: WALL_HEIGHT, sizeZ: WALL_THICKNESS },
  // ── Maze Wall 5 · Central Chokepoint (north-south) ────────────────────────
  { center: [  0,   WALL_HEIGHT / 2,   8  ], sizeX: WALL_THICKNESS, sizeY: WALL_HEIGHT, sizeZ: 10            },
  // ── Maze Wall 6 · SE Corridor (east-west) ─────────────────────────────────
  { center: [ 14,   WALL_HEIGHT / 2,  18  ], sizeX: 12,            sizeY: WALL_HEIGHT, sizeZ: WALL_THICKNESS },
  // ── Maze Wall 7 · SW Channel (north-south) ────────────────────────────────
  { center: [-16,   WALL_HEIGHT / 2,  15  ], sizeX: WALL_THICKNESS, sizeY: WALL_HEIGHT, sizeZ: 10            },
  // ── Maze Wall 8 · West Divider (east-west) ────────────────────────────────
  { center: [-20,   WALL_HEIGHT / 2,   0  ], sizeX: 10,            sizeY: WALL_HEIGHT, sizeZ: WALL_THICKNESS },
  // ── Maze Wall 9 · NW-Center Rib (north-south) ─────────────────────────────
  { center: [ -6,   WALL_HEIGHT / 2,  -8  ], sizeX: WALL_THICKNESS, sizeY: WALL_HEIGHT, sizeZ: 8             },
];

// Corner posts mark each wall junction — slightly taller than walls for definition
// 4 posts per camp (both closed corners + gate pillars at the open entrance)
const CORNER_POST_SIZE = 0.85;
const CORNER_POST_HEIGHT = WALL_HEIGHT + 1.0;
const CORNER_POSTS: [number, number, number][] = [
  // Wall 1 ends — NW Barrier (x: -14±6 @ z=-18)
  [-20,  CORNER_POST_HEIGHT / 2, -18],
  [ -8,  CORNER_POST_HEIGHT / 2, -18],
  // Wall 2 ends — North Shard (z: -22±5 @ x=5)
  [  5,  CORNER_POST_HEIGHT / 2, -27],
  [  5,  CORNER_POST_HEIGHT / 2, -17],
  // Wall 3 ends — East Spine (z: -8±6 @ x=18)
  [ 18,  CORNER_POST_HEIGHT / 2, -14],
  [ 18,  CORNER_POST_HEIGHT / 2,  -2],
  // Wall 4 ends — Center-East Divider (x: 12±5 @ z=2)
  [  7,  CORNER_POST_HEIGHT / 2,   2],
  [ 17,  CORNER_POST_HEIGHT / 2,   2],
  // Wall 5 ends — Central Chokepoint (z: 8±5 @ x=0)
  [  0,  CORNER_POST_HEIGHT / 2,   3],
  [  0,  CORNER_POST_HEIGHT / 2,  13],
  // Wall 6 ends — SE Corridor (x: 14±6 @ z=18)
  [  8,  CORNER_POST_HEIGHT / 2,  18],
  [ 20,  CORNER_POST_HEIGHT / 2,  18],
  // Wall 7 ends — SW Channel (z: 15±5 @ x=-16)
  [-16,  CORNER_POST_HEIGHT / 2,  10],
  [-16,  CORNER_POST_HEIGHT / 2,  20],
  // Wall 8 ends — West Divider (x: -20±5 @ z=0)
  [-25,  CORNER_POST_HEIGHT / 2,   0],
  [-15,  CORNER_POST_HEIGHT / 2,   0],
  // Wall 9 ends — NW-Center Rib (z: -8±4 @ x=-6)
  [ -6,  CORNER_POST_HEIGHT / 2, -12],
  [ -6,  CORNER_POST_HEIGHT / 2,  -4],
];

// ─── Battlement (merlon) constants ──────────────────────────────────────────
const MERLON_SPACING    = 1.5;   // distance from one merlon center to the next
const MERLON_LONG_SIDE  = 0.75;  // width along the wall's long axis
const MERLON_SHORT_SIDE = WALL_THICKNESS - 0.05; // depth (flush with wall face)
const MERLON_HEIGHT     = 1.2;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildMatrix(
  px: number, py: number, pz: number,
  sx: number, sy: number, sz: number,
): Matrix4 {
  const m = new Matrix4();
  m.compose(
    new Vector3(px, py, pz),
    new Quaternion(),
    new Vector3(sx, sy, sz),
  );
  return m;
}

function buildMerlonsForSegment(seg: WallSegmentDef): Matrix4[] {
  const isHorizontal = seg.sizeX > seg.sizeZ;
  const wallLength   = isHorizontal ? seg.sizeX : seg.sizeZ;
  const count        = Math.max(1, Math.floor(wallLength / MERLON_SPACING));
  const startOffset  = -((count - 1) * MERLON_SPACING) / 2;
  const merlonY      = seg.center[1] + seg.sizeY / 2 + MERLON_HEIGHT / 2;

  const matrices: Matrix4[] = [];
  for (let i = 0; i < count; i++) {
    const offset = startOffset + i * MERLON_SPACING;
    const mx = isHorizontal ? seg.center[0] + offset : seg.center[0];
    const mz = isHorizontal ? seg.center[2]           : seg.center[2] + offset;
    const mSX = isHorizontal ? MERLON_LONG_SIDE  : MERLON_SHORT_SIDE;
    const mSZ = isHorizontal ? MERLON_SHORT_SIDE : MERLON_LONG_SIDE;
    matrices.push(buildMatrix(mx, merlonY, mz, mSX, MERLON_HEIGHT, mSZ));
  }
  return matrices;
}

// ─── Component ───────────────────────────────────────────────────────────────
const CastleWalls: React.FC = () => {
  const meshRef = useRef<InstancedMesh>(null);

  const { count, matrices } = useMemo(() => {
    const all: Matrix4[] = [];

    // Wall bodies
    for (const seg of WALL_SEGMENTS) {
      all.push(buildMatrix(
        seg.center[0], seg.center[1], seg.center[2],
        seg.sizeX, seg.sizeY, seg.sizeZ,
      ));
    }

    // Corner posts
    for (const [px, py, pz] of CORNER_POSTS) {
      all.push(buildMatrix(px, py, pz, CORNER_POST_SIZE, CORNER_POST_HEIGHT, CORNER_POST_SIZE));
    }

    // Battlements on every segment
    for (const seg of WALL_SEGMENTS) {
      all.push(...buildMerlonsForSegment(seg));
    }

    return { count: all.length, matrices: all };
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    // Single colour across all instances — no per-instance colour needed
  }, [matrices]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={new Color(0x4a4340)}
        roughness={0.92}
        metalness={0.04}
      />
    </instancedMesh>
  );
};

export default CastleWalls;
