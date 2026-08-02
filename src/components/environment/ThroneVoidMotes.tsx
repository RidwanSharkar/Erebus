'use client';

import React, { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
} from '@/utils/three-exports';

/**
 * Warm gold-white motes rising from the void around the throne island.
 * GPU-only points — same pattern as ArenaFallingSnow, motion inverted (rise).
 */

const MOTES_VERT = /* glsl */ `
  attribute vec3  aOrigin;
  attribute float aRand;
  attribute float aSpeed;

  uniform float uTime;

  varying float vAlpha;
  varying vec3  vColor;

  void main() {
    float sp = 0.35 + aSpeed * 0.85;
    float t = uTime * sp + aRand * 50.0;
    // Rise from y=-20 toward y=+8 (span 28)
    float y = -20.0 + mod(t, 28.0);

    float xW = sin(uTime * 0.42 + aRand * 6.28) * 0.55;
    float zW = cos(uTime * 0.36 + aRand * 4.2) * 0.5;

    vec3 pos = vec3(aOrigin.x + xW, y, aOrigin.z + zW);

    float lowFade = smoothstep(-20.0, -16.0, y);
    float highFade = 1.0 - smoothstep(4.0, 8.0, y);
    vAlpha = 0.55 * lowFade * highFade * (0.45 + 0.55 * aRand);

    // Warm gold-white to match the throne rune band
    vec3 base = vec3(0.95, 0.88, 0.62);
    vec3 tip  = vec3(1.0, 0.97, 0.88);
    vColor = mix(base, tip, aRand);

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (1.1 + aRand * 1.4) * (160.0 / -mvPos.z);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

const MOTES_FRAG = /* glsl */ `
  varying float vAlpha;
  varying vec3  vColor;

  void main() {
    vec2  c   = gl_PointCoord - 0.5;
    float r   = length(c) * 2.0;
    float soft = 1.0 - smoothstep(0.25, 1.0, r);
    gl_FragColor = vec4(vColor, vAlpha * soft);
  }
`;

const DEFAULT_COUNT = 300;
const INNER_R = 14;
const OUTER_R = 34;

interface ThroneVoidMotesProps {
  count?: number;
  animateClouds?: boolean;
}

const ThroneVoidMotes: React.FC<ThroneVoidMotesProps> = ({
  count = DEFAULT_COUNT,
  animateClouds = true,
}) => {
  const { geometry: geo, material: mat } = useMemo(() => {
    const geometry = new BufferGeometry();
    const origins = new Float32Array(count * 3);
    const rands = new Float32Array(count);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = INNER_R + Math.sqrt(Math.random()) * (OUTER_R - INNER_R);
      origins[i * 3] = Math.cos(angle) * r;
      origins[i * 3 + 1] = 0;
      origins[i * 3 + 2] = Math.sin(angle) * r;
      rands[i] = Math.random();
      speeds[i] = 0.3 + Math.random() * 0.7;
    }

    geometry.setAttribute('aOrigin', new Float32BufferAttribute(origins, 3));
    geometry.setAttribute('aRand', new Float32BufferAttribute(rands, 1));
    geometry.setAttribute('aSpeed', new Float32BufferAttribute(speeds, 1));
    geometry.setAttribute('position', new Float32BufferAttribute(origins, 3));

    const material = new ShaderMaterial({
      vertexShader: MOTES_VERT,
      fragmentShader: MOTES_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
    });

    return { geometry, material };
  }, [count]);

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  useFrame((_, delta) => {
    if (!animateClouds) return;
    mat.uniforms.uTime.value += delta;
  });

  return (
    <points
      name="throne-void-motes"
      geometry={geo}
      material={mat}
      frustumCulled={false}
      renderOrder={2}
    />
  );
};

export default React.memo(ThroneVoidMotes);
