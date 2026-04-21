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
    stone = mix(stone, vec3(0.16, 0.26, 0.11), mossMask);

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
//   PATH       y=0.055, thickness 0.09 — the main north-south road (7 u wide)
//   CONNECTOR  y=0.057, thickness 0.09 — east/west branches to camps
//                (y is 2 mm above PATH so no depth-fight in thin overlap zone)
//   PLATFORM   y=0.06,  thickness 0.10 — cobbled combat pads per camp
//                (sits clearly above both PATH and CONNECTOR — no depth-fight)
//
// All tiles are axis-aligned (rotY = 0) and spaced with a 0.1-unit grout gap
// so coplanar faces never overlap — eliminating all z-fighting/jitter.
//
// Camp centres (backend/gameRoom.js CAMP_POSITIONS):
//   Camp 0 — North Fortress : (0, -22)   path runs directly through the camp
//   Camp 1 — East Bastion   : (22,  8)   east connector at z ≈ 8
//   Camp 2 — West Citadel   : (-22, 8)   west connector at z ≈ 8
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

// ─── Main path (N-S) ───────────────────────────────────────────────────────
// 21 rows · z = 26 → -24 · step 2.5 · single 7-wide slab per row · no rotation.
// Tile depth 2.4 → 0.1-unit gap between successive rows (no overlap possible).
const buildPath = (): SlabDef[] => {
  const slabs: SlabDef[] = [];
  for (let i = 0; i <= 20; i++) {
    slabs.push({
      position: [0, 0.055, 26 - i * 2.5],
      scale:    [7.0, 0.09, 2.4],
      rotY:     0,
    });
  }
  return slabs; // last tile centre z = -24
};

// ─── Camp 0 · North Fortress  (camp centre x=0, z=-22) ────────────────────
// The path already passes through this area; the platform sits 5 mm higher
// (y=0.06) so there is no depth-fight with path tiles (y=0.055).
// 4-col × 5-row grid · total footprint ≈ 14 × 18 units centred at (0, -23).
//   stepX=3.6 → tileW=3.5 + 0.1 gap  |  stepZ=3.6 → tileD=3.5 + 0.1 gap
const CAMP0_PLATFORM = makeGrid(0, -23, 4, 5, 3.6, 3.6, 3.5, 3.5, 0.06, 0.10);

// ─── Camp 1 · East Bastion  (camp centre x=22, z=8) ───────────────────────
// Connector: 5 tiles bridging from path edge (x≈3.5) to platform edge (x≈16).
//   Each tile: 2.4 wide (travel dir) × 7.0 deep (z).  Step 2.5 → 0.1 gap.
//   y=0.057 clears any depth-fight with path tiles (y=0.055) at x≈3.5.
const CAMP1_CONNECTOR: SlabDef[] = [
  { position: [ 4.7, 0.057, 8.0], scale: [2.4, 0.09, 7.0], rotY: 0 },
  { position: [ 7.2, 0.057, 8.0], scale: [2.4, 0.09, 7.0], rotY: 0 },
  { position: [ 9.7, 0.057, 8.0], scale: [2.4, 0.09, 7.0], rotY: 0 },
  { position: [12.2, 0.057, 8.0], scale: [2.4, 0.09, 7.0], rotY: 0 },
  { position: [14.7, 0.057, 8.0], scale: [2.4, 0.09, 7.0], rotY: 0 },
];
// Platform: 4×4 grid centred at (22, 8) · step 3.9+0.1=4.0 · tile 3.9×3.9
const CAMP1_PLATFORM = makeGrid(22, 8, 4, 4, 4.0, 4.0, 3.9, 3.9, 0.06, 0.10);

// ─── Camp 2 · West Citadel  (camp centre x=-22, z=8) ─────────────────────
// Mirror of Camp 1.
const CAMP2_CONNECTOR: SlabDef[] = [
  { position: [ -4.7, 0.057, 8.0], scale: [2.4, 0.09, 7.0], rotY: 0 },
  { position: [ -7.2, 0.057, 8.0], scale: [2.4, 0.09, 7.0], rotY: 0 },
  { position: [ -9.7, 0.057, 8.0], scale: [2.4, 0.09, 7.0], rotY: 0 },
  { position: [-12.2, 0.057, 8.0], scale: [2.4, 0.09, 7.0], rotY: 0 },
  { position: [-14.7, 0.057, 8.0], scale: [2.4, 0.09, 7.0], rotY: 0 },
];
const CAMP2_PLATFORM = makeGrid(-22, 8, 4, 4, 4.0, 4.0, 3.9, 3.9, 0.06, 0.10);

// ---------------------------------------------------------------------------
// Merge everything — one InstancedMesh, one draw call
// ---------------------------------------------------------------------------

// Slabs whose corners protrude beyond the playable circle are invisible in the
// darkness beyond the map boundary but can clip into view — clip them here.
const MAP_RADIUS = 28;
const isSlabInBounds = (slab: SlabDef): boolean => {
  const [cx, , cz] = slab.position;
  const hw = slab.scale[0] / 2;
  const hd = slab.scale[2] / 2;
  return (
    Math.hypot(cx + hw, cz + hd) <= MAP_RADIUS &&
    Math.hypot(cx + hw, cz - hd) <= MAP_RADIUS &&
    Math.hypot(cx - hw, cz + hd) <= MAP_RADIUS &&
    Math.hypot(cx - hw, cz - hd) <= MAP_RADIUS
  );
};

const ALL_SLABS: SlabDef[] = [
  ...buildPath(),        // 21 slabs — main N-S road (7 units wide)
  ...CAMP0_PLATFORM,     // 20 slabs — North Fortress platform (4×5)
  ...CAMP1_CONNECTOR,    //  5 slabs — East branch road
  ...CAMP1_PLATFORM,     // 16 slabs — East Bastion platform (4×4)
  ...CAMP2_CONNECTOR,    //  5 slabs — West branch road
  ...CAMP2_PLATFORM,     // 16 slabs — West Citadel platform (4×4)
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

// ---------------------------------------------------------------------------

type StoneGroundVariant = 'arena' | 'throne';

const StoneGround: React.FC<{ variant?: StoneGroundVariant }> = ({ variant = 'arena' }) => {
  const meshRef = useRef<InstancedMesh>(null);

  const slabs = variant === 'throne' ? THRONE_SLABS : ALL_SLABS;
  const slabCount = slabs.length;

  // Unit cube — scaled per-instance via the matrix; single allocation for all 64 slabs
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const material = useMemo(
    () => new ShaderMaterial({ vertexShader: STONE_VERTEX, fragmentShader: STONE_FRAGMENT }),
    [],
  );

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
