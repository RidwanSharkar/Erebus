'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import {
  Matrix4,
  Vector3,
  Quaternion,
  InstancedMesh,
  BoxGeometry,
  ShaderMaterial,
} from '@/utils/three-exports';
import { MAIN_MAP_RADIUS } from '@/utils/mapConstants';

// Procedural stone (aligned with StoneGround.tsx) — avoids MeshStandardMaterial
// going fully black when scene lights don’t hit vertical faces (e.g. backlight).

const WALL_VERTEX = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const WALL_FRAGMENT = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    return noise(p) * 0.5 + noise(p * 2.1 + 1.7) * 0.25 + noise(p * 4.3 + 3.1) * 0.125;
  }

  void main() {
    vec2 wp = vWorldPos.xz * 0.55 + vWorldPos.y * 0.12;

    vec3 stone = vec3(0.35, 0.32, 0.28);

    float macro = fbm(wp * 0.7);
    stone += (macro - 0.5) * 0.18;
    stone += noise(wp * 5.5 + 1.3) * 0.06;

    float course = abs(sin(vWorldPos.y * 3.2 + noise(wp * 2.0) * 0.5));
    stone *= 0.72 + smoothstep(0.1, 0.0, course) * 0.28;

    float crackH = abs(sin(vUv.x * 9.0 + noise(wp * 2.0) * 3.0));
    float crackV = abs(sin(vUv.y * 9.0 + noise(wp * 2.0 + 5.5) * 3.0));
    stone *= 0.55 + smoothstep(0.04, 0.14, min(crackH, crackV)) * 0.45;

    float mossMask = smoothstep(0.52, 0.68, noise(wp * 0.9 + 7.0))
                   * noise(wp * 2.5 + 3.0) * 0.65;
    stone = mix(stone, vec3(0.16, 0.26, 0.11), mossMask * 0.85);

    float edgeU = 1.0 - smoothstep(0.0, 0.09, vUv.x) * smoothstep(0.0, 0.09, 1.0 - vUv.x);
    float edgeV = 1.0 - smoothstep(0.0, 0.09, vUv.y) * smoothstep(0.0, 0.09, 1.0 - vUv.y);
    stone *= 1.0 - max(edgeU, edgeV) * 0.45;

    float diff = max(dot(vNormal, normalize(vec3(0.5, 1.0, 0.3))), 0.0) * 0.35 + 0.65;
    stone *= diff;

    float topFace = smoothstep(0.6, 0.9, vNormal.y);
    stone = mix(stone * 0.55, stone, topFace);

    gl_FragColor = vec4(stone, 1.0);
  }
`;

// ─── Wall segment definitions ───────────────────────────────────────────────
// Each segment: center position and full dimensions (sizeX, sizeY, sizeZ). Four
// sides form a closed square, tangent to the circular playable disc (|XZ| = R),
// with wall thickness just outside the play radius.

export interface WallSegmentDef {
  center: [number, number, number];
  sizeX: number;
  sizeY: number;
  sizeZ: number;
}

const WALL_HEIGHT = 3.0;
const WALL_THICKNESS = 0.6;

const R = MAIN_MAP_RADIUS;
const t = WALL_THICKNESS;
/** Wall box centre offset from origin so the inner face lies on the play circle. */
export const CASTLE_WALL_DEPTH_OFFSET = R + t / 2;
const wallCenterOffset = CASTLE_WALL_DEPTH_OFFSET;
/** Half wall thickness in XZ (for AABB helpers mirroring ECS boxes). */
export const CASTLE_WALL_HALF_THICKNESS = t / 2;
const longSpan = 2 * R;

export const WALL_SEGMENTS: WallSegmentDef[] = [
  { center: [0,  WALL_HEIGHT / 2,  wallCenterOffset], sizeX: longSpan,       sizeY: WALL_HEIGHT, sizeZ: t },
  { center: [0,  WALL_HEIGHT / 2, -wallCenterOffset], sizeX: longSpan,       sizeY: WALL_HEIGHT, sizeZ: t },
  { center: [ wallCenterOffset,  WALL_HEIGHT / 2, 0], sizeX: t, sizeY: WALL_HEIGHT, sizeZ: longSpan        },
  { center: [-wallCenterOffset,  WALL_HEIGHT / 2, 0], sizeX: t, sizeY: WALL_HEIGHT, sizeZ: longSpan        },
];

const CORNER_POST_SIZE = 0.85;
const CORNER_POST_HEIGHT = WALL_HEIGHT + 1.0;
const c = wallCenterOffset;
const CORNER_POSTS: [number, number, number][] = [
  [ c,  CORNER_POST_HEIGHT / 2,  c],
  [ c,  CORNER_POST_HEIGHT / 2, -c],
  [-c,  CORNER_POST_HEIGHT / 2,  c],
  [-c,  CORNER_POST_HEIGHT / 2, -c],
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

  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const material = useMemo(
    () => new ShaderMaterial({ vertexShader: WALL_VERTEX, fragmentShader: WALL_FRAGMENT }),
    [],
  );

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
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [matrices, geometry, material]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
      castShadow
      receiveShadow
    />
  );
};

export default CastleWalls;
