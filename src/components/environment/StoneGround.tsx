import React, { useRef, useMemo, useEffect } from 'react';
import {
  InstancedMesh,
  BoxGeometry,
  ShaderMaterial,
  Matrix4,
  Vector3,
  Euler,
  Quaternion,
} from '@/utils/three-exports';
import { MAIN_ARENA_HEX_RADIUS, MAIN_MAP_HALF_Z } from '@/utils/mapConstants';
import type { RoomBorderTheme } from './SimpleBorderEffects';

const THEME_ID: Record<RoomBorderTheme, number> = {
  green: 0,
  red: 1,
  blue: 2,
  purple: 3,
};

// ---------------------------------------------------------------------------
// Procedural stone shader — mossy cracked tiles, no textures needed
// ---------------------------------------------------------------------------

const STONE_VERTEX = `
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

const STONE_FRAGMENT = `
  uniform float uTheme;

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
    float topFace = smoothstep(0.6, 0.9, vNormal.y);
    vec2 wp = vWorldPos.xz;

    vec3 stone = vec3(0.35, 0.32, 0.28);

    float macro = fbm(wp * 0.7);
    stone += (macro - 0.5) * 0.18;
    stone += noise(wp * 5.5 + 1.3) * 0.06;

    float crackH = abs(sin(vUv.x * 9.0 + noise(wp * 2.0) * 3.0));
    float crackV = abs(sin(vUv.y * 9.0 + noise(wp * 2.0 + 5.5) * 3.0));
    stone *= 0.55 + smoothstep(0.04, 0.14, min(crackH, crackV)) * 0.45;

    float mossMask = smoothstep(0.52, 0.68, noise(wp * 0.9 + 7.0))
                   * noise(wp * 2.5 + 3.0) * 0.65;

    float mossK = 1.0;
    if (uTheme > 0.5 && uTheme < 1.5) mossK = 0.05;
    else if (uTheme > 1.5 && uTheme < 2.5) mossK = 0.1;
    else if (uTheme > 2.5) mossK = 0.07;
    stone = mix(stone, vec3(0.16, 0.26, 0.11), mossMask * mossK);

    if (uTheme > 0.5 && uTheme < 1.5) {
      stone *= vec3(1.1, 0.88, 0.72);
      stone += vec3(0.05, 0.015, 0.0);
    } else if (uTheme > 1.5 && uTheme < 2.5) {
      stone = mix(stone, stone * vec3(0.88, 0.92, 1.04) + vec3(0.04, 0.05, 0.1), 0.4);
    } else if (uTheme > 2.5) {
      stone *= vec3(0.86, 0.84, 0.9);
      stone += vec3(0.02, 0.015, 0.04);
    }

    float edgeU = 1.0 - smoothstep(0.0, 0.09, vUv.x) * smoothstep(0.0, 0.09, 1.0 - vUv.x);
    float edgeV = 1.0 - smoothstep(0.0, 0.09, vUv.y) * smoothstep(0.0, 0.09, 1.0 - vUv.y);
    stone *= 1.0 - max(edgeU, edgeV) * 0.45;

    float diff = max(dot(vNormal, normalize(vec3(0.5, 1.0, 0.3))), 0.0) * 0.35 + 0.65;
    stone *= diff;

    stone = mix(stone * 0.55, stone, topFace);

    gl_FragColor = vec4(stone, 1.0);
  }
`;

// ---------------------------------------------------------------------------
// Layout overview
//
// Everything is one InstancedMesh — one BoxGeometry, one ShaderMaterial, one
// draw call.  Three slab categories share the same unit-cube geometry:
//
//   PATH       y=0.055, thickness 0.09 — the main south-north road (7 u wide)
//   PLATFORM   y=0.06,  thickness 0.10 — cobbled pads and narrow side alcoves
//                (sits clearly above both PATH and CONNECTOR — no depth-fight)
//
// All tiles are axis-aligned (rotY = 0) and spaced with a 0.1-unit grout gap
// so coplanar faces never overlap — eliminating all z-fighting/jitter.
//
// Main arena footprint: regular hex; slabs whose corners protrude are culled.
// ---------------------------------------------------------------------------

interface SlabDef {
  position: [number, number, number];
  scale:    [number, number, number]; // [width, thickness, depth]
  rotY:     number;
}

// ─── Helper — axis-aligned grid with guaranteed 0.1-unit grout gap ─────────
const makeGrid = (
  cx: number, cz: number,
  cols: number, rows: number,
  stepX: number, stepZ: number,
  tileW: number, tileD: number,
  y: number,
  thickness: number,
): SlabDef[] => {
  const x0 = cx - ((cols - 1) * stepX) / 2;
  const z0 = cz - ((rows - 1) * stepZ) / 2;
  const slabs: SlabDef[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      slabs.push({
        position: [x0 + c * stepX, y, z0 + r * stepZ],
        scale:    [tileW, thickness, tileD],
        rotY:     0,
      });
    }
  }
  return slabs;
};

// ─── Main path (S-N) ───────────────────────────────────────────────────────
// Tile depth 2.4 → 0.1-unit gap between successive rows (no overlap possible).
const buildPath = (): SlabDef[] => {
  const slabs: SlabDef[] = [];
  const tileD = 2.4;
  const stepZ = 2.5;
  const startZ = -MAIN_MAP_HALF_Z + tileD / 2;
  const endZ = MAIN_MAP_HALF_Z - tileD / 2;
  const rows = Math.floor((endZ - startZ) / stepZ) + 1;
  for (let i = 0; i < rows; i++) {
    slabs.push({
      position: [0, 0.055, startZ + i * stepZ],
      scale:    [7.0, 0.09, tileD],
      rotY:     0,
    });
  }
  return slabs;
};

// ─── Far combat pad + narrow alcoves ──────────────────────────────────────
// The former side camps lived at x=±22. In the 15-wide corridor they become
// slim in-bounds alcoves while the main pad anchors the far end of the room.
const FAR_PLATFORM = makeGrid(0, 20.5, 4, 3, 1.8, 2.8, 1.7, 2.7, 0.06, 0.10);
const ENTRY_PLATFORM = makeGrid(0, -20.0, 3, 2, 1.8, 2.8, 1.7, 2.7, 0.06, 0.10);
const EAST_ALCOVE = makeGrid(5.55, 5.0, 2, 4, 1.8, 2.8, 1.7, 2.7, 0.06, 0.10);
const WEST_ALCOVE = makeGrid(-5.55, 5.0, 2, 4, 1.8, 2.8, 1.7, 2.7, 0.06, 0.10);

// ---------------------------------------------------------------------------
// Merge everything — one InstancedMesh, one draw call
// ---------------------------------------------------------------------------

// Slabs whose corners protrude outside the playable disc are culled.
const isSlabInBounds = (slab: SlabDef): boolean => {
  const [cx, , cz] = slab.position;
  const hw = slab.scale[0] / 2;
  const hd = slab.scale[2] / 2;
  const corners: [number, number][] = [
    [cx + hw, cz + hd],
    [cx + hw, cz - hd],
    [cx - hw, cz + hd],
    [cx - hw, cz - hd],
  ];
  const maxR = MAIN_ARENA_HEX_RADIUS - 0.4;
  return corners.every(([x, z]) => Math.hypot(x, z) <= maxR);
};

const ALL_SLABS: SlabDef[] = [
  ...buildPath(),
  ...ENTRY_PLATFORM,
  ...FAR_PLATFORM,
  ...EAST_ALCOVE,
  ...WEST_ALCOVE,
].filter(isSlabInBounds);

const THRONE_MAP_RADIUS = 12;
const isSlabInThrone = (slab: SlabDef): boolean => {
  const [cx, , cz] = slab.position;
  const hw = slab.scale[0] / 2;
  const hd = slab.scale[2] / 2;
  const corners = [
    Math.hypot(cx + hw, cz + hd),
    Math.hypot(cx + hw, cz - hd),
    Math.hypot(cx - hw, cz + hd),
    Math.hypot(cx - hw, cz - hd),
  ];
  return corners.every((d) => d <= THRONE_MAP_RADIUS - 0.2);
};

/** Compact cobble pad for the pre-arena throne room (radius ~10). */
const THRONE_SLABS: SlabDef[] = makeGrid(0, 0, 9, 9, 2.1, 2.1, 2.0, 2.0, 0.06, 0.10).filter(isSlabInThrone);

/** Tangential pavers around the grass rim — matches inner pad y/thickness. */
const THRONE_PERIM_GROUT = 0.1;
const THRONE_PERIM_TILE_W = 2.0;
const THRONE_PERIM_RADIAL_D = 2.0;
const THRONE_PERIM_Y = 0.06;
const THRONE_PERIM_THICK = 0.1;

function buildThronePerimeterSlabs(ringRadius: number): SlabDef[] {
  const step = THRONE_PERIM_TILE_W + THRONE_PERIM_GROUT;
  const n = Math.max(8, Math.round((2 * Math.PI * ringRadius) / step));
  const phase = 0.12;
  const slabs: SlabDef[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + phase;
    const x = Math.cos(angle) * ringRadius;
    const z = Math.sin(angle) * ringRadius;
    // Local +Z → radial outward; +X → tangential (same box convention as grid slabs).
    const rotY = Math.PI / 2 - angle;
    slabs.push({
      position: [x, THRONE_PERIM_Y, z],
      scale: [THRONE_PERIM_TILE_W, THRONE_PERIM_THICK, THRONE_PERIM_RADIAL_D],
      rotY,
    });
  }
  return slabs;
}

// ---------------------------------------------------------------------------

type StoneGroundVariant = 'arena' | 'throne';

const StoneGround: React.FC<{
  variant?: StoneGroundVariant;
  roomTheme?: RoomBorderTheme;
  /** When set with `variant="throne"`, adds circular ring(s) at these radii (tile centers). */
  thronePerimeterRingRadius?: number | readonly number[];
}> = ({ variant = 'arena', roomTheme = 'green', thronePerimeterRingRadius }) => {
  const meshRef = useRef<InstancedMesh>(null);

  const slabs = useMemo(() => {
    if (variant !== 'throne') return ALL_SLABS;
    if (thronePerimeterRingRadius == null) return THRONE_SLABS;
    const radii = Array.isArray(thronePerimeterRingRadius)
      ? thronePerimeterRingRadius
      : [thronePerimeterRingRadius];
    const rings = radii.flatMap((r) => buildThronePerimeterSlabs(r));
    return [...THRONE_SLABS, ...rings];
  }, [variant, thronePerimeterRingRadius]);

  const slabCount = slabs.length;

  // Unit cube — scaled per-instance via the matrix; single allocation for all 64 slabs
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const material = useMemo(() => {
    const tid = THEME_ID[roomTheme] ?? 0;
    return new ShaderMaterial({
      vertexShader: STONE_VERTEX,
      fragmentShader: STONE_FRAGMENT,
      uniforms: { uTheme: { value: tid } },
    });
  }, [roomTheme]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const mat4  = new Matrix4();
    const pos   = new Vector3();
    const quat  = new Quaternion();
    const scl   = new Vector3();
    const euler = new Euler();

    slabs.forEach((def, i) => {
      pos.set(...def.position);
      euler.set(0, def.rotY, 0);
      quat.setFromEuler(euler);
      scl.set(...def.scale);
      mat4.compose(pos, quat, scl);
      mesh.setMatrixAt(i, mat4);
    });

    mesh.instanceMatrix.needsUpdate = true;

    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material, slabs]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, slabCount]}
      frustumCulled={false}
    />
  );
};

export default React.memo(StoneGround);
