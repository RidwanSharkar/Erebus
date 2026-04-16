import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  AdditiveBlending,
  Points,
} from '@/utils/three-exports';

// ---------------------------------------------------------------------------
// Fire embers — GPU-animated floating sparks near camps and torch areas
// Single Points draw call, additive blending, all motion in vertex shader
// ---------------------------------------------------------------------------

const EMBER_VERT = `
  attribute float aIndex;
  attribute vec3 aOrigin;
  attribute float aSpeed;
  attribute float aSize;

  uniform float uTime;

  varying float vAlpha;
  varying vec3 vColor;

  // Fast LCG hash → [0, 1]
  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    float t = mod(uTime * aSpeed + aIndex * 1.618, 5.0); // 0→5 lifecycle
    float tNorm = t / 5.0; // 0→1 normalised

    // Spiral upward drift
    float angle = aIndex * 2.39996 + uTime * aSpeed * 0.4;
    float radius = 0.4 + hash(aIndex + 7.0) * 1.2;

    vec3 pos = aOrigin;
    pos.x += cos(angle) * radius * (1.0 - tNorm * 0.5);
    pos.z += sin(angle) * radius * (1.0 - tNorm * 0.5);
    pos.y += tNorm * (2.5 + hash(aIndex) * 2.5); // rise height

    // Micro flutter
    pos.x += sin(uTime * 3.1 + aIndex * 5.7) * 0.12;
    pos.z += cos(uTime * 2.7 + aIndex * 3.3) * 0.12;

    // Fade in quickly, hold, then fade out
    vAlpha = smoothstep(0.0, 0.15, tNorm) * (1.0 - smoothstep(0.65, 1.0, tNorm));

    // Color shifts orange → red → dark as it rises
    float heat = 1.0 - tNorm;
    vColor = mix(vec3(0.25, 0.02, 0.0), vec3(1.0, 0.55, 0.05), heat * heat);

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (1.5 - tNorm * 0.8) * (300.0 / -mvPos.z);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

const EMBER_FRAG = `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    // Soft circular point
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c) * 2.0;
    float soft = 1.0 - smoothstep(0.4, 1.0, r);
    gl_FragColor = vec4(vColor, vAlpha * soft * 0.9);
  }
`;

// Camp centers — embers rise from each
const CAMP_ORIGINS: [number, number, number][] = [
  [  0, 0, -22 ],
  [ 22, 0,   8 ],
  [-22, 0,   8 ],
];

const EMBERS_PER_CAMP = 20;
const TOTAL = EMBERS_PER_CAMP * CAMP_ORIGINS.length;

const InstancedEmbers: React.FC = () => {
  const pointsRef = useRef<Points>(null);

  const { geo, mat } = useMemo(() => {
    const indices   = new Float32Array(TOTAL);
    const origins   = new Float32Array(TOTAL * 3);
    const speeds    = new Float32Array(TOTAL);
    const sizes     = new Float32Array(TOTAL);
    // Dummy position — actual position computed fully in vertex shader
    const positions = new Float32Array(TOTAL * 3);

    let ptr = 0;
    CAMP_ORIGINS.forEach(([cx, cy, cz]) => {
      for (let i = 0; i < EMBERS_PER_CAMP; i++) {
        const idx = ptr;
        indices[idx]   = idx;
        // Spread origin within a small camp radius
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 3.5;
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

    const material = new ShaderMaterial({
      uniforms:       { uTime: { value: 0 } },
      vertexShader:   EMBER_VERT,
      fragmentShader: EMBER_FRAG,
      transparent:    true,
      depthWrite:     false,
      blending:       AdditiveBlending,
    });

    return { geo: geometry, mat: material };
  }, []);

  useFrame((_, delta) => {
    mat.uniforms.uTime.value += delta;
  });

  return (
    <points ref={pointsRef} geometry={geo} material={mat} frustumCulled={false} />
  );
};

export default React.memo(InstancedEmbers);
