'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  Color,
  CylinderGeometry,
  FrontSide,
  InstancedMesh,
  Matrix4,
  OctahedronGeometry,
  ShaderMaterial,
  Vector3,
} from '@/utils/three-exports';

/** Matches StylizedGrass disc radius in ThroneRoom (COOP_THRONE_ROOM_RADIUS * 0.9375). */
export const THRONE_ISLAND_TOP_RADIUS = 4.0625;

const CONE_HEIGHT = 9;
const CONE_TIP_RADIUS = 1.2;
const CHUNK_COUNT = 10;

const ROCK_VERT = /* glsl */ `
  varying float vDepth;
  varying vec3 vNormalW;
  varying vec3 vPosW;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPosW = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    // 0 at rim (top), 1 at tip
    vDepth = 1.0 - (position.y / uHalfH + 0.5);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// Inject half-height via string replace so we avoid an extra uniform dance in vert
const ROCK_VERT_SRC = ROCK_VERT.replace(/uHalfH/g, String(CONE_HEIGHT * 0.5));

const ROCK_FRAG = /* glsl */ `
  uniform vec3 uRockTop;
  uniform vec3 uRockMid;
  uniform vec3 uRockTip;
  uniform vec3 uVein;
  uniform float uVeinStrength;

  varying float vDepth;
  varying vec3 vNormalW;
  varying vec3 vPosW;

  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  void main() {
    float d = clamp(vDepth, 0.0, 1.0);
    vec3 col = mix(uRockTop, uRockMid, smoothstep(0.0, 0.45, d));
    col = mix(col, uRockTip, smoothstep(0.4, 1.0, d));

    // Subtle gold vein accents (throne rune / prism palette)
    float vein = abs(sin(vPosW.x * 1.8 + vPosW.z * 1.1 + d * 4.0));
    vein = smoothstep(0.92, 0.99, vein) * (1.0 - d);
    col = mix(col, uVein, vein * uVeinStrength);

    // Soft lighting from above so the underside doesn't go pure black
    float upLit = max(0.0, dot(vNormalW, vec3(0.15, 0.9, 0.2))) * 0.35 + 0.65;
    col *= upLit;

    // Dissolve toward tip into the cloud sea
    float tipFade = 1.0 - smoothstep(0.78, 1.0, d);
    if (tipFade < 0.02) discard;

    gl_FragColor = vec4(col, tipFade);
  }
`;

const STRATA_FRAG = /* glsl */ `
  uniform vec3 uDirt;
  uniform vec3 uStone;

  varying float vDepth;
  varying vec3 vNormalW;
  varying vec3 vPosW;

  void main() {
    float band = fract(vPosW.y * 3.2 + vPosW.x * 0.15);
    vec3 col = mix(uDirt, uStone, smoothstep(0.35, 0.65, band));
    float upLit = max(0.0, dot(vNormalW, vec3(0.1, 1.0, 0.15))) * 0.3 + 0.7;
    col *= upLit;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const STRATA_VERT = /* glsl */ `
  varying float vDepth;
  varying vec3 vNormalW;
  varying vec3 vPosW;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPosW = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vDepth = 0.0;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/** Deterministic 2D hash for CPU displacement (matches GLSL hash feel). */
function hash2(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Rock cone + rim strata + drifting chunks beneath the throne grass disc.
 */
const ThroneIslandUnderside: React.FC = () => {
  const chunkGroupRef = useRef<InstancedMesh>(null);
  const chunkSpinRef = useRef(0);

  const coneGeo = useMemo(() => {
    // Open-ended cylinder: top = island radius, bottom = tip
    const geo = new CylinderGeometry(
      THRONE_ISLAND_TOP_RADIUS,
      CONE_TIP_RADIUS,
      CONE_HEIGHT,
      48,
      3,
      true,
    );
    const pos = geo.attributes.position as BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      const ix = i * 3;
      const x = arr[ix]!;
      const y = arr[ix + 1]!;
      const z = arr[ix + 2]!;
      // Skip near-tip verts to keep the dissolve clean
      const depth = 1 - (y / (CONE_HEIGHT * 0.5) + 0.5);
      if (depth > 0.85) continue;
      const n = hash2(x * 0.35, z * 0.35);
      const n2 = hash2(x * 0.9 + 3.1, z * 0.9 - 1.7);
      const radial = Math.hypot(x, z) || 1;
      const push = (n * 0.55 + n2 * 0.35) * (0.35 + depth * 0.9);
      arr[ix] = x + (x / radial) * push;
      arr[ix + 2] = z + (z / radial) * push;
      arr[ix + 1] = y + (n2 - 0.5) * 0.25 * (1 - depth);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);

  const strataGeo = useMemo(
    () =>
      new CylinderGeometry(
        THRONE_ISLAND_TOP_RADIUS * 1.01,
        THRONE_ISLAND_TOP_RADIUS * 0.96,
        1.05,
        48,
        1,
        true,
      ),
    [],
  );

  const chunkGeo = useMemo(() => new OctahedronGeometry(0.5, 1), []);

  const coneMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: ROCK_VERT_SRC,
        fragmentShader: ROCK_FRAG,
        transparent: true,
        depthWrite: true,
        side: FrontSide,
        uniforms: {
          uRockTop: { value: new Color('#5a4a3a') },
          uRockMid: { value: new Color('#3a3028') },
          uRockTip: { value: new Color('#1a1814') },
          uVein: { value: new Color('#d4a84a') },
          uVeinStrength: { value: 0.45 },
        },
      }),
    [],
  );

  const strataMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: STRATA_VERT,
        fragmentShader: STRATA_FRAG,
        transparent: false,
        depthWrite: true,
        side: FrontSide,
        uniforms: {
          uDirt: { value: new Color('#4a3828') },
          uStone: { value: new Color('#6a5a48') },
        },
      }),
    [],
  );

  const chunkMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: STRATA_VERT,
        fragmentShader: /* glsl */ `
          varying float vDepth;
          varying vec3 vNormalW;
          varying vec3 vPosW;
          void main() {
            vec3 col = vec3(0.32, 0.28, 0.24);
            float upLit = max(0.0, dot(vNormalW, vec3(0.2, 0.9, 0.1))) * 0.4 + 0.55;
            gl_FragColor = vec4(col * upLit, 0.92);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: FrontSide,
      }),
    [],
  );

  // Place floating chunks in a ring under the rim
  useEffect(() => {
    const mesh = chunkGroupRef.current;
    if (!mesh) return;
    const m = new Matrix4();
    const p = new Vector3();
    const s = new Vector3();
    for (let i = 0; i < CHUNK_COUNT; i++) {
      const a = (i / CHUNK_COUNT) * Math.PI * 2 + hash2(i, 2) * 0.4;
      const r = THRONE_ISLAND_TOP_RADIUS * (0.55 + hash2(i, 5) * 0.35);
      const y = -1.8 - hash2(i, 9) * 4.5;
      p.set(Math.cos(a) * r, y, Math.sin(a) * r);
      const sc = 0.45 + hash2(i, 11) * 0.85;
      s.set(sc, sc * (0.7 + hash2(i, 13) * 0.5), sc);
      m.makeRotationY(hash2(i, 17) * Math.PI * 2);
      m.scale(s);
      m.setPosition(p);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useEffect(() => {
    return () => {
      coneGeo.dispose();
      strataGeo.dispose();
      chunkGeo.dispose();
      coneMat.dispose();
      strataMat.dispose();
      chunkMat.dispose();
    };
  }, [coneGeo, strataGeo, chunkGeo, coneMat, strataMat, chunkMat]);

  useFrame((_, delta) => {
    chunkSpinRef.current += delta * 0.08;
    const mesh = chunkGroupRef.current;
    if (mesh) {
      mesh.rotation.y = chunkSpinRef.current;
    }
  });

  return (
    <group name="throne-island-underside">
      {/* Cone hangs below y=0; cylinder is centered on origin so shift down by half height */}
      <mesh
        geometry={coneGeo}
        material={coneMat}
        position={[0, -CONE_HEIGHT * 0.5, 0]}
        frustumCulled={false}
      />
      {/* Strata band just under the grass rim — most visible at grazing camera angles */}
      <mesh
        geometry={strataGeo}
        material={strataMat}
        position={[0, -0.55, 0]}
        frustumCulled={false}
      />

    </group>
  );
};

export default React.memo(ThroneIslandUnderside);
