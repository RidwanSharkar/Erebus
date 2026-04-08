'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { Matrix4, Vector3, Quaternion, InstancedMesh, Color } from '@/utils/three-exports';

// ─── Wall Segment Definitions ─────────────────────────────────────────────────
// Each segment: center position and full dimensions (sizeX, sizeY, sizeZ)
// Two wall segments per camp form an L-shape; corner posts cap each junction.

export interface WallSegmentDef {
  center: [number, number, number];
  sizeX: number;
  sizeY: number;
  sizeZ: number;
}

const WALL_HEIGHT = 3.0;
const WALL_THICKNESS = 0.6;

export const WALL_SEGMENTS: WallSegmentDef[] = [
  // ── Camp 1 · NE Ruins ──── L opens west, corner at (17.5, -12.5) ──────────
  { center: [13.25, WALL_HEIGHT / 2, -12.5], sizeX: 8.5, sizeY: WALL_HEIGHT, sizeZ: WALL_THICKNESS },
  { center: [17.5,  WALL_HEIGHT / 2, -9.5 ], sizeX: WALL_THICKNESS, sizeY: WALL_HEIGHT, sizeZ: 6.0  },

  // ── Camp 2 · East Outpost ─ L opens west, corner at (22.5, -2.0) ──────────
  { center: [19.25, WALL_HEIGHT / 2, -2.0 ], sizeX: 6.5, sizeY: WALL_HEIGHT, sizeZ: WALL_THICKNESS },
  { center: [22.5,  WALL_HEIGHT / 2,  2.0 ], sizeX: WALL_THICKNESS, sizeY: WALL_HEIGHT, sizeZ: 8.0  },

  // ── Camp 3 · South Grove ── L opens NW,   corner at (10.5, 18.5) ──────────
  { center: [6.0,   WALL_HEIGHT / 2, 18.5 ], sizeX: 9.0, sizeY: WALL_HEIGHT, sizeZ: WALL_THICKNESS },
  { center: [10.5,  WALL_HEIGHT / 2, 15.25], sizeX: WALL_THICKNESS, sizeY: WALL_HEIGHT, sizeZ: 6.5  },

  // ── Camp 4 · West Crossing  L opens east, corner at (-22.5, -6.0) ─────────
  { center: [-22.5, WALL_HEIGHT / 2, -0.25], sizeX: WALL_THICKNESS, sizeY: WALL_HEIGHT, sizeZ: 11.5 },
  { center: [-17.75,WALL_HEIGHT / 2, -6.0 ], sizeX: 9.5, sizeY: WALL_HEIGHT, sizeZ: WALL_THICKNESS },
];

// Corner posts cap each L junction — slightly taller than walls for definition
const CORNER_POST_SIZE = 0.85;
const CORNER_POST_HEIGHT = WALL_HEIGHT + 1.0;
const CORNER_POSTS: [number, number, number][] = [
  [ 17.5,  CORNER_POST_HEIGHT / 2, -12.5],  // Camp 1
  [ 22.5,  CORNER_POST_HEIGHT / 2,  -2.0],  // Camp 2
  [ 10.5,  CORNER_POST_HEIGHT / 2,  18.5],  // Camp 3
  [-22.5,  CORNER_POST_HEIGHT / 2,  -6.0],  // Camp 4
];

// ─── Battlement (merlon) constants ───────────────────────────────────────────
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
