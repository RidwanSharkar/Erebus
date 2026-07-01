'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  AdditiveBlending,
  Points,
  Vector3,
} from '@/utils/three-exports';

/**
 * Small stationary hazard patch dropped by Blue Greed — a reduced-scale, single-cluster
 * variant of `InstancedEmbers`' shader (same vertex/fragment shape, blue flame palette).
 */

const EMBER_VERT = `
  attribute float aIndex;
  attribute vec3  aOrigin;
  attribute float aSpeed;
  attribute float aSize;

  uniform float uTime;
  uniform vec3  uColorDim;
  uniform vec3  uColorBright;

  varying float vAlpha;
  varying vec3  vColor;

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    float t     = mod(uTime * aSpeed + aIndex * 1.618, 3.0);
    float tNorm = t / 3.0;

    float angle  = aIndex * 2.39996 + uTime * aSpeed * 0.5;
    float radius = 0.25 + hash(aIndex + 7.0) * 0.65;

    vec3 pos = aOrigin;
    pos.x += cos(angle) * radius * (1.0 - tNorm * 0.5);
    pos.z += sin(angle) * radius * (1.0 - tNorm * 0.5);
    pos.y += tNorm * (1.1 + hash(aIndex) * 1.2);

    pos.x += sin(uTime * 3.4 + aIndex * 5.7) * 0.08;
    pos.z += cos(uTime * 2.9 + aIndex * 3.3) * 0.08;

    vAlpha = smoothstep(0.0, 0.15, tNorm) * (1.0 - smoothstep(0.65, 1.0, tNorm));

    float heat = 1.0 - tNorm;
    vColor = mix(uColorDim, uColorBright, heat * heat);

    vec4 mvPos   = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (1.5 - tNorm * 0.8) * (300.0 / -mvPos.z);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

const EMBER_FRAG = `
  varying float vAlpha;
  varying vec3  vColor;
  uniform float uGlobalOpacity;

  void main() {
    vec2  c    = gl_PointCoord - 0.5;
    float r    = length(c) * 2.0;
    float soft = 1.0 - smoothstep(0.4, 1.0, r);
    gl_FragColor = vec4(vColor, vAlpha * soft * 0.9 * uGlobalOpacity);
  }
`;

const BLUE_DIM: [number, number, number] = [0.00, 0.04, 0.22];
const BLUE_BRIGHT: [number, number, number] = [0.03, 0.75, 1.00];
const PURPLE_DIM: [number, number, number] = [0.12, 0.02, 0.18];
const PURPLE_BRIGHT: [number, number, number] = [0.73, 0.33, 0.83];

const VARIANT_PRESETS = {
  blue: { dim: BLUE_DIM, bright: BLUE_BRIGHT, ringColor: '#38bdf8' },
  purple: { dim: PURPLE_DIM, bright: PURPLE_BRIGHT, ringColor: '#BA55D3' },
} as const;

const PARTICLE_COUNT = 22;

export interface GreedEmberPatchProps {
  position: Vector3;
  radius: number;
  durationMs: number;
  onComplete: () => void;
  variant?: keyof typeof VARIANT_PRESETS;
}

export default function GreedEmberPatch({
  position,
  radius,
  durationMs,
  onComplete,
  variant = 'blue',
}: GreedEmberPatchProps) {
  const preset = VARIANT_PRESETS[variant];
  const pointsRef = useRef<Points>(null);
  const elapsedRef = useRef(0);
  const doneRef = useRef(false);

  const { geo, mat } = useMemo(() => {
    const indices = new Float32Array(PARTICLE_COUNT);
    const origins = new Float32Array(PARTICLE_COUNT * 3);
    const speeds = new Float32Array(PARTICLE_COUNT);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const positions = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      indices[i] = i;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      origins[i * 3] = Math.cos(a) * r;
      origins[i * 3 + 1] = 0;
      origins[i * 3 + 2] = Math.sin(a) * r;
      speeds[i] = 0.5 + Math.random() * 0.9;
      sizes[i] = 1.6 + Math.random() * 3.0;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aIndex', new Float32BufferAttribute(indices, 1));
    geometry.setAttribute('aOrigin', new Float32BufferAttribute(origins, 3));
    geometry.setAttribute('aSpeed', new Float32BufferAttribute(speeds, 1));
    geometry.setAttribute('aSize', new Float32BufferAttribute(sizes, 1));

    const material = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorDim: { value: new Vector3(...preset.dim) },
        uColorBright: { value: new Vector3(...preset.bright) },
        uGlobalOpacity: { value: 1 },
      },
      vertexShader: EMBER_VERT,
      fragmentShader: EMBER_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    return { geo: geometry, mat: material };
  }, [radius, preset.dim, preset.bright]);

  React.useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  useFrame((_, delta) => {
    mat.uniforms.uTime.value += delta;

    if (doneRef.current) return;
    elapsedRef.current += delta * 1000;

    const fadeStart = durationMs * 0.8;
    if (elapsedRef.current >= fadeStart) {
      const u = Math.min(1, (elapsedRef.current - fadeStart) / Math.max(1, durationMs - fadeStart));
      mat.uniforms.uGlobalOpacity.value = 1 - u;
    }

    if (elapsedRef.current >= durationMs) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group position={[position.x, 0, position.z]}>
      <points ref={pointsRef} geometry={geo} material={mat} frustumCulled={false} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[radius * 0.55, radius, 24]} />
        <meshBasicMaterial
          color={preset.ringColor}
          transparent
          opacity={0.28}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
