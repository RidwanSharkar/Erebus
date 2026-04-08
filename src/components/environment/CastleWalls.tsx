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
  // ── Camp 0 · North Fortress ── 3-sided, open south ───────────────────────
  // Area: x ∈ [-7, 7], z ∈ [-28, -16]
  { center: [ 0,    WALL_HEIGHT / 2, -28  ], sizeX: 14.6, sizeY: WALL_HEIGHT, sizeZ: WALL_THICKNESS }, // north wall
  { center: [-7,    WALL_HEIGHT / 2, -22  ], sizeX: WALL_THICKNESS, sizeY: WALL_HEIGHT, sizeZ: 12   }, // west wall
  { center: [ 7,    WALL_HEIGHT / 2, -22  ], sizeX: WALL_THICKNESS, sizeY: WALL_HEIGHT, sizeZ: 12   }, // east wall

  // ── Camp 1 · East Bastion ── 3-sided, open west ───────────────────────────
  // Area: x ∈ [15, 29], z ∈ [2, 14]
  { center: [22,    WALL_HEIGHT / 2,  2   ], sizeX: 14,   sizeY: WALL_HEIGHT, sizeZ: WALL_THICKNESS }, // north wall
  { center: [22,    WALL_HEIGHT / 2, 14   ], sizeX: 14,   sizeY: WALL_HEIGHT, sizeZ: WALL_THICKNESS }, // south wall
  { center: [29,    WALL_HEIGHT / 2,  8   ], sizeX: WALL_THICKNESS, sizeY: WALL_HEIGHT, sizeZ: 12   }, // east wall

  // ── Camp 2 · West Citadel ── 3-sided, open east ───────────────────────────
  // Area: x ∈ [-29, -15], z ∈ [2, 14]
  { center: [-22,   WALL_HEIGHT / 2,  2   ], sizeX: 14,   sizeY: WALL_HEIGHT, sizeZ: WALL_THICKNESS }, // north wall
  { center: [-22,   WALL_HEIGHT / 2, 14   ], sizeX: 14,   sizeY: WALL_HEIGHT, sizeZ: WALL_THICKNESS }, // south wall
  { center: [-29,   WALL_HEIGHT / 2,  8   ], sizeX: WALL_THICKNESS, sizeY: WALL_HEIGHT, sizeZ: 12   }, // west wall
];

// Corner posts mark each wall junction — slightly taller than walls for definition
// 4 posts per camp (both closed corners + gate pillars at the open entrance)
const CORNER_POST_SIZE = 0.85;
const CORNER_POST_HEIGHT = WALL_HEIGHT + 1.0;
const CORNER_POSTS: [number, number, number][] = [
  // Camp 0 — North Fortress (open south)
  [ -7,  CORNER_POST_HEIGHT / 2, -28],  // NW closed corner
  [  7,  CORNER_POST_HEIGHT / 2, -28],  // NE closed corner
  [ -7,  CORNER_POST_HEIGHT / 2, -16],  // SW gate pillar
  [  7,  CORNER_POST_HEIGHT / 2, -16],  // SE gate pillar

  // Camp 1 — East Bastion (open west)
  [ 15,  CORNER_POST_HEIGHT / 2,  2],   // NW gate pillar
  [ 29,  CORNER_POST_HEIGHT / 2,  2],   // NE closed corner
  [ 15,  CORNER_POST_HEIGHT / 2, 14],   // SW gate pillar
  [ 29,  CORNER_POST_HEIGHT / 2, 14],   // SE closed corner

  // Camp 2 — West Citadel (open east)
  [-15,  CORNER_POST_HEIGHT / 2,  2],   // NE gate pillar
  [-29,  CORNER_POST_HEIGHT / 2,  2],   // NW closed corner
  [-15,  CORNER_POST_HEIGHT / 2, 14],   // SE gate pillar
  [-29,  CORNER_POST_HEIGHT / 2, 14],   // SW closed corner
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
