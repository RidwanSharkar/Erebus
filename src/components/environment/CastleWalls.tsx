'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import {
  Matrix4,
  Vector3,
  Quaternion,
  Euler,
  InstancedMesh,
  BoxGeometry,
  ShaderMaterial,
} from '@/utils/three-exports';
import { MAIN_ARENA_HEX_RADIUS } from '@/utils/mapConstants';

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

export function createCastleWallShaderMaterial(): ShaderMaterial {
  return new ShaderMaterial({ vertexShader: WALL_VERTEX, fragmentShader: WALL_FRAGMENT });
}

// ─── Wall segment definitions ───────────────────────────────────────────────
// Each segment: center position, rotation, and full dimensions (sizeX, sizeY, sizeZ).
// Main arena uses a circular ring; inner faces sit on the playable disc edge.

export interface WallSegmentDef {
  center: [number, number, number];
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  rotationY?: number;
}

export const WALL_HEIGHT = 3.0;
export const WALL_THICKNESS = 0.6;

const t = WALL_THICKNESS;
/** Half wall thickness in XZ (for AABB helpers mirroring ECS boxes). */
export const CASTLE_WALL_HALF_THICKNESS = t / 2;
/** Legacy exports kept for systems that still allocate square helper boxes. */
export const CASTLE_WALL_X_OFFSET = MAIN_ARENA_HEX_RADIUS + t / 2;
export const CASTLE_WALL_Z_OFFSET = MAIN_ARENA_HEX_RADIUS + t / 2;

/** Short AABB blocks sampled around a circular arena perimeter (projectile / AI collision). */
export function buildCircularWallSegments(innerRadius: number, targetChordLength = 2.0): WallSegmentDef[] {
  const Rc = innerRadius + t / 2;
  const circumference = 2 * Math.PI * Rc;
  const n = Math.max(24, Math.round(circumference / targetChordLength));
  const segments: WallSegmentDef[] = [];
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

export const WALL_SEGMENTS: WallSegmentDef[] = buildCircularWallSegments(MAIN_ARENA_HEX_RADIUS);

// ─── Battlement (merlon) constants ──────────────────────────────────────────
const MERLON_SPACING    = 1.5;   // distance from one merlon center to the next
const MERLON_LONG_SIDE  = 0.75;  // width along the wall's long axis
const MERLON_SHORT_SIDE = WALL_THICKNESS - 0.05; // depth (flush with wall face)
const MERLON_HEIGHT     = 1.2;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildMatrix(
  px: number, py: number, pz: number,
  sx: number, sy: number, sz: number,
  rotationY = 0,
): Matrix4 {
  const m = new Matrix4();
  const q = new Quaternion();
  const e = new Euler(0, rotationY, 0);
  q.setFromEuler(e);
  m.compose(
    new Vector3(px, py, pz),
    q,
    new Vector3(sx, sy, sz),
  );
  return m;
}

function buildMerlonsForSegment(seg: WallSegmentDef): Matrix4[] {
  const wallLength   = seg.sizeX;
  const count        = Math.max(1, Math.floor(wallLength / MERLON_SPACING));
  const startOffset  = -((count - 1) * MERLON_SPACING) / 2;
  const merlonY      = seg.center[1] + seg.sizeY / 2 + MERLON_HEIGHT / 2;
  const rotY         = seg.rotationY ?? 0;
  const tangentX     = Math.cos(rotY);
  const tangentZ     = -Math.sin(rotY);

  const matrices: Matrix4[] = [];
  for (let i = 0; i < count; i++) {
    const offset = startOffset + i * MERLON_SPACING;
    const mx = seg.center[0] + tangentX * offset;
    const mz = seg.center[2] + tangentZ * offset;
    matrices.push(buildMatrix(mx, merlonY, mz, MERLON_LONG_SIDE, MERLON_HEIGHT, MERLON_SHORT_SIDE, rotY));
  }
  return matrices;
}

/** Outer ring of castle wall segments + merlons; inner face near `innerRadius` (playable disk edge). */
function buildThroneCircularCastleInstanceMatrices(innerRadius: number, targetChordLength = 2.0): Matrix4[] {
  const t = WALL_THICKNESS;
  const Rc = innerRadius + t / 2;
  const circumference = 2 * Math.PI * Rc;
  const n = Math.max(24, Math.round(circumference / targetChordLength));
  const all: Matrix4[] = [];
  const merlonCenterY = WALL_HEIGHT + MERLON_HEIGHT / 2;
  const q = new Quaternion();
  const e = new Euler();

  for (let i = 0; i < n; i++) {
    const theta = (i / n) * Math.PI * 2;
    const chord = 2 * Rc * Math.sin(Math.PI / n);
    const cx = Math.cos(theta) * Rc;
    const cz = Math.sin(theta) * Rc;
    const rotY = Math.PI / 2 - theta;

    e.set(0, rotY, 0);
    q.setFromEuler(e);
    const wall = new Matrix4();
    wall.compose(new Vector3(cx, WALL_HEIGHT / 2, cz), q, new Vector3(chord, WALL_HEIGHT, t));
    all.push(wall);

    const merlonCount = Math.max(1, Math.floor(chord / MERLON_SPACING));
    const start = -((merlonCount - 1) * MERLON_SPACING) / 2;
    const tx = -Math.sin(theta);
    const tz = Math.cos(theta);
    for (let m = 0; m < merlonCount; m++) {
      const off = start + m * MERLON_SPACING;
      const mx = cx + tx * off;
      const mz = cz + tz * off;
      const mm = new Matrix4();
      mm.compose(
        new Vector3(mx, merlonCenterY, mz),
        q,
        new Vector3(MERLON_LONG_SIDE, MERLON_HEIGHT, MERLON_SHORT_SIDE),
      );
      all.push(mm);
    }
  }
  return all;
}

export const ThroneCircularCastleWalls: React.FC<{ innerRadius: number }> = ({ innerRadius }) => {
  const meshRef = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const material = useMemo(() => createCastleWallShaderMaterial(), []);

  const { count, matrices } = useMemo(() => {
    const matrices = buildThroneCircularCastleInstanceMatrices(innerRadius);
    return { count: matrices.length, matrices };
  }, [innerRadius]);

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
      key={innerRadius}
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
      castShadow
      receiveShadow
    />
  );
};

// ─── Component ───────────────────────────────────────────────────────────────
const CastleWalls: React.FC = () => {
  const meshRef = useRef<InstancedMesh>(null);

  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const material = useMemo(() => createCastleWallShaderMaterial(), []);

  const { count, matrices } = useMemo(() => {
    const all: Matrix4[] = [];

    // Wall bodies
    for (const seg of WALL_SEGMENTS) {
      all.push(buildMatrix(
        seg.center[0], seg.center[1], seg.center[2],
        seg.sizeX, seg.sizeY, seg.sizeZ,
        seg.rotationY ?? 0,
      ));
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
