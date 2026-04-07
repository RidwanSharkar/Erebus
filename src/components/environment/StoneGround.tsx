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
//   PATH       y=0.055, thickness 0.09 — the main north-south road
//   CONNECTOR  y=0.055, thickness 0.09 — branches off the path to each group
//   PLATFORM   y=0.06,  thickness 0.10 — the elevated combat pads per group
//
// Knight spawn groups (backend/gameRoom.js KNIGHT_POSITIONS):
//   Group 1 — North Gate   : (0,-14), (-3,-11), (3,-11)  → on the main path
//   Group 2 — NE Ruins     : (13,-11),(16,-8), (10,-8)   → east branch z≈-9
//   Group 3 — East Outpost : (20,0),  (20,4),  (17,2)    → east branch z≈2
//   Group 4 — South Grove  : (5,16),  (2,13),  (8,13)    → east branch z≈14
//   Group 5 — West Crossing: (-18,0), (-15,4), (-15,-4)  → west branch z≈0
// ---------------------------------------------------------------------------

interface SlabDef {
  position: [number, number, number];
  scale:    [number, number, number]; // [width, thickness, depth]
  rotY:     number;                   // radians
}

// ─── Helper — builds the 21-row alternating-wide/split main path ───────────
const buildPath = (): SlabDef[] => {
  // Rows every 2.5 units, z=26 → -24.  Even rows: one wide slab.  Odd rows:
  // two flanking slabs.  Slight x-wobble and rotation for organic feel.
  const xWobble  = [ 0.1,-0.2, 0.2,-0.1, 0.1, 0.0,-0.2, 0.1,-0.1, 0.2, 0.0];
  const rotWide  = [ 0.03,-0.02, 0.04,-0.03, 0.02, 0.01,-0.02, 0.03,-0.04, 0.05,-0.01];
  const slabs: SlabDef[] = [];
  let wIdx = 0;
  for (let row = 0; row <= 20; row++) {
    const z = 26 - row * 2.5;
    if (row % 2 === 0) {
      // Wide row — single slab ~5 units wide
      const w = wIdx % xWobble.length;
      // Slightly wider plaza slab at the pedestal z≈1
      const isPlaza = Math.abs(z - 1) < 1.5;
      slabs.push({
        position: [xWobble[w], 0.055, z],
        scale:    [isPlaza ? 5.4 : 5.0, 0.09, isPlaza ? 2.5 : 2.3],
        rotY:     rotWide[w],
      });
      wIdx++;
    } else {
      // Split row — two flanking slabs
      const rotL = (row * 0.07 + 0.04) * (row % 4 < 2 ? 1 : -1);
      const rotR = -rotL * 0.7;
      slabs.push(
        { position: [-1.3, 0.055, z], scale: [2.3, 0.09, 2.1], rotY:  rotL },
        { position: [ 1.2, 0.055, z], scale: [2.2, 0.09, 2.0], rotY:  rotR },
      );
    }
  }
  return slabs;
};

// ─── Group 1 · North Gate ─────────────────────────────────────────────────
// The path already runs through here; add symmetric wing extensions so the
// road visually widens into a proper combat arena at z≈-11 to -14.
const GROUP1_WINGS: SlabDef[] = [
  { position: [-4.4, 0.06, -11.5], scale: [2.8, 0.10, 2.5], rotY:  0.07 },
  { position: [-4.4, 0.06, -14.0], scale: [2.8, 0.10, 2.5], rotY: -0.05 },
  { position: [ 4.4, 0.06, -11.5], scale: [2.8, 0.10, 2.5], rotY: -0.07 },
  { position: [ 4.4, 0.06, -14.0], scale: [2.8, 0.10, 2.5], rotY:  0.05 },
];

// ─── Group 2 · Northeast Ruins ────────────────────────────────────────────
// Connector departs the east edge of the path (x≈2.5) at z≈-9 and arrives
// at the platform.  Platform: 2×2 grid covering knights at (10,-8),(13,-11),(16,-8).
const GROUP2_CONNECTOR: SlabDef[] = [
  { position: [ 4.8, 0.055, -9.3], scale: [3.0, 0.09, 2.0], rotY:  0.04 },
  { position: [ 7.5, 0.055, -9.1], scale: [2.8, 0.09, 2.0], rotY: -0.03 },
  { position: [10.2, 0.055, -8.9], scale: [2.5, 0.09, 2.0], rotY:  0.04 },
];
const GROUP2_PLATFORM: SlabDef[] = [
  { position: [11.5, 0.06, -10.5], scale: [3.0, 0.10, 2.8], rotY:  0.07 },
  { position: [14.5, 0.06, -10.2], scale: [2.8, 0.10, 2.6], rotY: -0.05 },
  { position: [11.2, 0.06,  -7.8], scale: [3.0, 0.10, 2.8], rotY:  0.06 },
  { position: [15.0, 0.06,  -8.1], scale: [2.6, 0.10, 2.8], rotY: -0.07 },
];

// ─── Group 3 · East Outpost ───────────────────────────────────────────────
// Connector departs the east edge of the path at z≈2, reaching the platform
// at x≈17–20. Platform covers knights at (20,0),(20,4),(17,2).
const GROUP3_CONNECTOR: SlabDef[] = [
  { position: [ 4.8, 0.055, 1.8], scale: [2.8, 0.09, 2.0], rotY:  0.03 },
  { position: [ 7.5, 0.055, 2.0], scale: [2.8, 0.09, 2.2], rotY: -0.04 },
  { position: [10.2, 0.055, 1.9], scale: [2.8, 0.09, 2.0], rotY:  0.05 },
  { position: [12.8, 0.055, 2.1], scale: [2.8, 0.09, 2.2], rotY: -0.03 },
  { position: [15.4, 0.055, 2.0], scale: [2.5, 0.09, 2.0], rotY:  0.04 },
];
const GROUP3_PLATFORM: SlabDef[] = [
  { position: [17.5, 0.06, 1.2], scale: [2.6, 0.10, 2.8], rotY: -0.06 },
  { position: [20.0, 0.06, 0.5], scale: [2.4, 0.10, 2.6], rotY:  0.08 },
  { position: [17.5, 0.06, 3.2], scale: [2.6, 0.10, 2.8], rotY:  0.07 },
  { position: [20.0, 0.06, 3.8], scale: [2.4, 0.10, 2.6], rotY: -0.05 },
];

// ─── Group 4 · South Grove ────────────────────────────────────────────────
// The path passes z≈13–16; the group sits east of it (x≈2–8). Short east
// connector leads to a tidy 2×2 platform.
const GROUP4_CONNECTOR: SlabDef[] = [
  { position: [4.2, 0.055, 13.4], scale: [2.8, 0.09, 2.0], rotY: 0.05 },
];
const GROUP4_PLATFORM: SlabDef[] = [
  { position: [4.5, 0.06, 15.5], scale: [2.8, 0.10, 2.6], rotY:  0.08 },
  { position: [7.5, 0.06, 13.5], scale: [2.6, 0.10, 2.8], rotY: -0.06 },
  { position: [4.5, 0.06, 13.0], scale: [2.8, 0.10, 2.6], rotY:  0.06 },
  { position: [7.2, 0.06, 15.8], scale: [2.4, 0.10, 2.4], rotY: -0.04 },
];

// ─── Group 5 · West Crossing ──────────────────────────────────────────────
// Connector departs the west edge of the path (x≈-2.5) at z≈0 and arrives
// at the platform. Platform covers knights at (-18,0),(-15,4),(-15,-4).
const GROUP5_CONNECTOR: SlabDef[] = [
  { position: [ -4.8, 0.055,  0.2], scale: [2.8, 0.09, 2.0], rotY: -0.03 },
  { position: [ -7.5, 0.055,  0.0], scale: [2.8, 0.09, 2.2], rotY:  0.04 },
  { position: [-10.2, 0.055,  0.1], scale: [2.8, 0.09, 2.0], rotY: -0.05 },
  { position: [-12.8, 0.055, -0.1], scale: [2.5, 0.09, 2.2], rotY:  0.03 },
];
const GROUP5_PLATFORM: SlabDef[] = [
  { position: [-15.5, 0.06,  0.5], scale: [2.8, 0.10, 2.8], rotY:  0.07 },
  { position: [-18.0, 0.06, -0.2], scale: [2.6, 0.10, 2.6], rotY: -0.06 },
  { position: [-15.5, 0.06,  3.5], scale: [2.6, 0.10, 2.8], rotY:  0.05 },
  { position: [-15.5, 0.06, -3.5], scale: [2.6, 0.10, 2.8], rotY: -0.05 },
];

// ---------------------------------------------------------------------------
// Merge everything into a single flat array — one InstancedMesh for the lot
// ---------------------------------------------------------------------------
const ALL_SLABS: SlabDef[] = [
  ...buildPath(),        // 31 slabs — main N-S road
  ...GROUP1_WINGS,       //  4 slabs — north gate arena widening
  ...GROUP2_CONNECTOR,   //  3 slabs — NE branch road
  ...GROUP2_PLATFORM,    //  4 slabs — NE platform
  ...GROUP3_CONNECTOR,   //  5 slabs — east branch road
  ...GROUP3_PLATFORM,    //  4 slabs — east platform
  ...GROUP4_CONNECTOR,   //  1 slab  — south-east stub
  ...GROUP4_PLATFORM,    //  4 slabs — south platform
  ...GROUP5_CONNECTOR,   //  4 slabs — west branch road
  ...GROUP5_PLATFORM,    //  4 slabs — west platform
  // Total: 64 slabs — 1 draw call
];

const SLAB_COUNT = ALL_SLABS.length;

// ---------------------------------------------------------------------------

const StoneGround: React.FC = () => {
  const meshRef = useRef<InstancedMesh>(null);

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

    ALL_SLABS.forEach((def, i) => {
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
  }, [geometry, material]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, SLAB_COUNT]}
      frustumCulled={false}
    />
  );
};

export default React.memo(StoneGround);
