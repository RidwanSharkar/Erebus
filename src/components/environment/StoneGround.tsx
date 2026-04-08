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
//   CONNECTOR  y=0.055, thickness 0.09 — branches off the path to each camp
//   PLATFORM   y=0.06,  thickness 0.10 — large cobbled combat pads per camp
//
// 3 camp platforms (backend/gameRoom.js CAMP_POSITIONS):
//   Camp 0 — North Fortress : center (0,-22)  → path leads directly north here
//   Camp 1 — East Bastion   : center (22,8)   → east branch off path at z≈8
//   Camp 2 — West Citadel   : center (-22,8)  → west branch off path at z≈8
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

// ─── Camp 0 · North Fortress ──────────────────────────────────────────────
// Main path terminates at z≈-24, two bridge slabs span the gap into the camp.
// Large 3×3 platform covers the walled interior (x:-7 to 7, z:-28 to -17).
const CAMP0_CONNECTOR: SlabDef[] = [
  { position: [ 0.5, 0.055, -24.8], scale: [4.5, 0.09, 2.5], rotY:  0.03 },
  { position: [ 0.0, 0.055, -22.0], scale: [5.0, 0.09, 2.5], rotY: -0.02 },
];
const CAMP0_PLATFORM: SlabDef[] = [
  // back row  (z ≈ -27)
  { position: [-4.0, 0.06, -27.2], scale: [6.0, 0.10, 4.0], rotY:  0.04 },
  { position: [ 0.0, 0.06, -27.5], scale: [4.5, 0.10, 4.0], rotY: -0.03 },
  { position: [ 4.0, 0.06, -27.0], scale: [6.0, 0.10, 4.0], rotY:  0.05 },
  // mid row   (z ≈ -22)
  { position: [-4.0, 0.06, -22.5], scale: [6.0, 0.10, 5.0], rotY: -0.04 },
  { position: [ 0.0, 0.06, -22.0], scale: [4.5, 0.10, 5.5], rotY:  0.03 },
  { position: [ 4.0, 0.06, -22.5], scale: [6.0, 0.10, 5.0], rotY: -0.05 },
  // front row (z ≈ -18)
  { position: [-4.0, 0.06, -17.8], scale: [6.0, 0.10, 4.0], rotY:  0.05 },
  { position: [ 0.0, 0.06, -18.0], scale: [4.5, 0.10, 4.0], rotY: -0.04 },
  { position: [ 4.0, 0.06, -17.5], scale: [6.0, 0.10, 4.0], rotY:  0.03 },
];

// ─── Camp 1 · East Bastion ────────────────────────────────────────────────
// Connector branches east from the path spine (x≈0) at z≈8, arriving at the
// camp gate (x=15).  Large 3×3 platform covers x:15–29, z:2–14.
const CAMP1_CONNECTOR: SlabDef[] = [
  { position: [ 4.5, 0.055,  7.8], scale: [3.5, 0.09, 2.5], rotY:  0.04 },
  { position: [ 8.0, 0.055,  8.0], scale: [3.5, 0.09, 2.5], rotY: -0.03 },
  { position: [11.5, 0.055,  7.9], scale: [3.0, 0.09, 2.5], rotY:  0.05 },
  { position: [14.2, 0.055,  8.1], scale: [3.0, 0.09, 2.5], rotY: -0.04 },
];
const CAMP1_PLATFORM: SlabDef[] = [
  // west col  (x ≈ 17)
  { position: [17.0, 0.06,  3.5], scale: [5.0, 0.10, 5.0], rotY:  0.04 },
  { position: [17.0, 0.06,  8.0], scale: [5.0, 0.10, 5.5], rotY: -0.03 },
  { position: [17.0, 0.06, 12.5], scale: [5.0, 0.10, 4.5], rotY:  0.06 },
  // mid col   (x ≈ 22)
  { position: [22.0, 0.06,  3.0], scale: [5.0, 0.10, 4.5], rotY: -0.04 },
  { position: [22.0, 0.06,  8.0], scale: [5.5, 0.10, 5.5], rotY:  0.03 },
  { position: [22.0, 0.06, 13.0], scale: [5.0, 0.10, 4.5], rotY: -0.05 },
  // east col  (x ≈ 27)
  { position: [27.0, 0.06,  3.5], scale: [4.5, 0.10, 5.0], rotY:  0.05 },
  { position: [27.0, 0.06,  8.5], scale: [4.5, 0.10, 5.0], rotY: -0.04 },
  { position: [27.0, 0.06, 12.5], scale: [4.5, 0.10, 4.5], rotY:  0.03 },
];

// ─── Camp 2 · West Citadel ────────────────────────────────────────────────
// Mirror of Camp 1: branches west from path at z≈8, gate at x=-15.
// Large 3×3 platform covers x:-29 to -15, z:2–14.
const CAMP2_CONNECTOR: SlabDef[] = [
  { position: [ -4.5, 0.055,  7.8], scale: [3.5, 0.09, 2.5], rotY: -0.04 },
  { position: [ -8.0, 0.055,  8.0], scale: [3.5, 0.09, 2.5], rotY:  0.03 },
  { position: [-11.5, 0.055,  7.9], scale: [3.0, 0.09, 2.5], rotY: -0.05 },
  { position: [-14.2, 0.055,  8.1], scale: [3.0, 0.09, 2.5], rotY:  0.04 },
];
const CAMP2_PLATFORM: SlabDef[] = [
  // east col  (x ≈ -17)
  { position: [-17.0, 0.06,  3.5], scale: [5.0, 0.10, 5.0], rotY: -0.04 },
  { position: [-17.0, 0.06,  8.0], scale: [5.0, 0.10, 5.5], rotY:  0.03 },
  { position: [-17.0, 0.06, 12.5], scale: [5.0, 0.10, 4.5], rotY: -0.06 },
  // mid col   (x ≈ -22)
  { position: [-22.0, 0.06,  3.0], scale: [5.0, 0.10, 4.5], rotY:  0.04 },
  { position: [-22.0, 0.06,  8.0], scale: [5.5, 0.10, 5.5], rotY: -0.03 },
  { position: [-22.0, 0.06, 13.0], scale: [5.0, 0.10, 4.5], rotY:  0.05 },
  // west col  (x ≈ -27)
  { position: [-27.0, 0.06,  3.5], scale: [4.5, 0.10, 5.0], rotY: -0.05 },
  { position: [-27.0, 0.06,  8.5], scale: [4.5, 0.10, 5.0], rotY:  0.04 },
  { position: [-27.0, 0.06, 12.5], scale: [4.5, 0.10, 4.5], rotY: -0.03 },
];

// ---------------------------------------------------------------------------
// Merge everything into a single flat array — one InstancedMesh for the lot
// ---------------------------------------------------------------------------
const ALL_SLABS: SlabDef[] = [
  ...buildPath(),        // 31 slabs — main N-S road
  ...CAMP0_CONNECTOR,    //  2 slabs — north bridge to fortress
  ...CAMP0_PLATFORM,     //  9 slabs — north fortress platform
  ...CAMP1_CONNECTOR,    //  4 slabs — east branch road
  ...CAMP1_PLATFORM,     //  9 slabs — east bastion platform
  ...CAMP2_CONNECTOR,    //  4 slabs — west branch road
  ...CAMP2_PLATFORM,     //  9 slabs — west citadel platform
  // Total: 68 slabs — 1 draw call
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
