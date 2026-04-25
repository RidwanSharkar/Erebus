import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  AdditiveBlending,
  Points,
  Vector3,
} from '@/utils/three-exports';

// ---------------------------------------------------------------------------
// Fire embers — GPU-animated floating sparks near camps and torch areas
// Single Points draw call, additive blending, all motion in vertex shader.
//
// Color design: embers use the room theme (aCampIdx = 0) from uniform arrays
// uColorDim[1] / uColorBright[1].  When campTypes[0] arrives from the server,
// useEffect patches those 6 uniforms in-place — no geometry rebuild needed.
// ---------------------------------------------------------------------------

const EMBER_VERT = `
  attribute float aIndex;
  attribute vec3  aOrigin;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aCampIdx;   // 0 — room theme palette index

  uniform float uTime;
  uniform vec3  uColorDim[1];     // cool / fading — room theme
  uniform vec3  uColorBright[1];  // hot / core — room theme

  varying float vAlpha;
  varying vec3  vColor;

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    float t     = mod(uTime * aSpeed + aIndex * 1.618, 5.0);
    float tNorm = t / 5.0;

    // Spiral upward drift
    float angle  = aIndex * 2.39996 + uTime * aSpeed * 0.4;
    float radius = 0.4 + hash(aIndex + 7.0) * 1.2;

    vec3 pos = aOrigin;
    pos.x += cos(angle) * radius * (1.0 - tNorm * 0.5);
    pos.z += sin(angle) * radius * (1.0 - tNorm * 0.5);
    pos.y += tNorm * (2.5 + hash(aIndex) * 2.5);

    // Micro flutter
    pos.x += sin(uTime * 3.1 + aIndex * 5.7) * 0.12;
    pos.z += cos(uTime * 2.7 + aIndex * 3.3) * 0.12;

    vAlpha = smoothstep(0.0, 0.15, tNorm) * (1.0 - smoothstep(0.65, 1.0, tNorm));

    // Pick this camp's palette then blend hot → dim as ember rises
    int   ci     = int(aCampIdx);
    float heat   = 1.0 - tNorm;
    vColor = mix(uColorDim[ci], uColorBright[ci], heat * heat);

    vec4 mvPos   = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (1.5 - tNorm * 0.8) * (300.0 / -mvPos.z);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

const EMBER_FRAG = `
  varying float vAlpha;
  varying vec3  vColor;

  void main() {
    vec2  c    = gl_PointCoord - 0.5;
    float r    = length(c) * 2.0;
    float soft = 1.0 - smoothstep(0.4, 1.0, r);
    gl_FragColor = vec4(vColor, vAlpha * soft * 0.9);
  }
`;

// ---------------------------------------------------------------------------
// Centre beacon only — color uses campTypes[0] (same room theme as the map)
// ---------------------------------------------------------------------------
const CAMP_ORIGINS: [number, number, number][] = [
  [0, 0, 8], // North Fortress
];

// Per-theme palettes: [dim (cool / fading), bright (hot core)]
// With additive blending even modest values glow vividly.
const FLAME_PALETTES: Record<string, [[number,number,number],[number,number,number]]> = {
  red:    [[0.25, 0.02, 0.00], [1.00, 0.55, 0.05]],  // ember-orange → deep red
  green:  [[0.01, 0.18, 0.00], [0.08, 1.00, 0.04]],  // neon green
  blue:   [[0.00, 0.04, 0.22], [0.03, 0.75, 1.00]],  // frost / ice-blue
  purple: [[0.12, 0.00, 0.18], [0.72, 0.04, 1.00]],  // void purple
};
const DEFAULT_PALETTE = FLAME_PALETTES.red;

const EMBERS_PER_CAMP = 35;
const TOTAL = EMBERS_PER_CAMP * CAMP_ORIGINS.length;

// Build the two uniform Vector3[] arrays for a given campTypes list.
const buildColorUniforms = (campTypes: string[]) => ({
  dim:    CAMP_ORIGINS.map((_, i) => {
    const [d] = FLAME_PALETTES[campTypes[i]] ?? DEFAULT_PALETTE;
    return new Vector3(d[0], d[1], d[2]);
  }),
  bright: CAMP_ORIGINS.map((_, i) => {
    const [, b] = FLAME_PALETTES[campTypes[i]] ?? DEFAULT_PALETTE;
    return new Vector3(b[0], b[1], b[2]);
  }),
});

// ---------------------------------------------------------------------------

interface InstancedEmbersProps {
  campTypes?: string[]; // e.g. ['red','green','blue'] — arrives from socket
}

const InstancedEmbers: React.FC<InstancedEmbersProps> = ({ campTypes = [] }) => {
  const pointsRef = useRef<Points>(null);

  // Geometry and material are built ONCE — colors live in uniforms, not buffers.
  const { geo, mat } = useMemo(() => {
    const indices  = new Float32Array(TOTAL);
    const origins  = new Float32Array(TOTAL * 3);
    const speeds   = new Float32Array(TOTAL);
    const sizes    = new Float32Array(TOTAL);
    const campIdxs = new Float32Array(TOTAL);
    const positions = new Float32Array(TOTAL * 3); // placeholder; shader ignores it

    let ptr = 0;
    CAMP_ORIGINS.forEach(([cx, cy, cz], campIdx) => {
      for (let i = 0; i < EMBERS_PER_CAMP; i++) {
        const idx = ptr;
        indices[idx]  = idx;
        campIdxs[idx] = campIdx;

        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 1.25;
        origins[idx * 3    ] = cx + Math.cos(a) * r;
        origins[idx * 3 + 1] = cy;
        origins[idx * 3 + 2] = cz + Math.sin(a) * r;

        speeds[idx] = 0.4 + Math.random() * 0.8;
        sizes[idx]  = 2.0 + Math.random() * 4.0;
        ptr++;
      }
    });

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aIndex',   new Float32BufferAttribute(indices,   1));
    geometry.setAttribute('aOrigin',  new Float32BufferAttribute(origins,   3));
    geometry.setAttribute('aSpeed',   new Float32BufferAttribute(speeds,    1));
    geometry.setAttribute('aSize',    new Float32BufferAttribute(sizes,     1));
    geometry.setAttribute('aCampIdx', new Float32BufferAttribute(campIdxs,  1));

    // Defaults to 'red' for all camps until campTypes arrives via socket.
    const { dim, bright } = buildColorUniforms([]);
    const material = new ShaderMaterial({
      uniforms: {
        uTime:        { value: 0 },
        uColorDim:    { value: dim },
        uColorBright: { value: bright },
      },
      vertexShader:   EMBER_VERT,
      fragmentShader: EMBER_FRAG,
      transparent:    true,
      depthWrite:     false,
      blending:       AdditiveBlending,
    });

    return { geo: geometry, mat: material };
  }, []); // geometry/material never rebuilt — only uniforms change

  // When campTypes arrives (or changes), patch the color uniforms in-place.
  // This is instant — no geometry rebuild, no R3F prop dance needed.
  useEffect(() => {
    if (!campTypes.length) return;
    const { dim, bright } = buildColorUniforms(campTypes);
    mat.uniforms.uColorDim.value    = dim;
    mat.uniforms.uColorBright.value = bright;
    // Three.js ShaderMaterial re-uploads all uniforms on the next draw call,
    // so no needsUpdate flag is required.
  }, [campTypes, mat]);

  useFrame((_, delta) => {
    mat.uniforms.uTime.value += delta;
  });

  return (
    <points ref={pointsRef} geometry={geo} material={mat} frustumCulled={false} />
  );
};

export default React.memo(InstancedEmbers);
