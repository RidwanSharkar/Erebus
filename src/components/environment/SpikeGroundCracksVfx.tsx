'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, ShaderMaterial } from 'three';
import {
  acquireSpikeGroundCrackMaterial,
  createSpikeCrackPlaneGeometry,
  releaseSpikeGroundCrackMaterial,
  type SpikeCrackTheme,
} from './groundCracksShader';
import { hashSpikeSeed } from '@/utils/tectonicSpikeGeometry';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SpikeGroundCracksVfxProps {
  position: [number, number, number];
  radius: number;
  seed: string;
  /** Full opacity until this elapsed ms, then fade begins. */
  visibleMs: number;
  /** Fade-out duration after visibleMs. */
  fadeMs?: number;
  theme?: SpikeCrackTheme;
  onComplete?: () => void;
}

/**
 * Ephemeral ground-crack decal at a tectonic spike / impale landing site.
 * Holds at full opacity, then gently fades out and returns GPU resources to pools.
 */
export default function SpikeGroundCracksVfx({
  position,
  radius,
  seed,
  visibleMs,
  fadeMs = 600,
  theme = 'earth',
  onComplete,
}: SpikeGroundCracksVfxProps) {
  const meshRef = useRef<Mesh>(null);
  const done = useRef(false);
  const t0 = useRef(typeof performance !== 'undefined' ? performance.now() : 0);

  const { rotationZ, crackSeedX, crackSeedY } = useMemo(() => {
    const rand = mulberry32(hashSpikeSeed(seed) + 55103);
    return {
      rotationZ: rand() * Math.PI * 2,
      crackSeedX: rand() * 8.0,
      crackSeedY: rand() * 8.0,
    };
  }, [seed]);

  const { geometry, material } = useMemo(() => {
    const geo = createSpikeCrackPlaneGeometry(crackSeedX, crackSeedY);
    const mat = acquireSpikeGroundCrackMaterial(theme);
    return { geometry: geo, material: mat };
  }, [crackSeedX, crackSeedY, theme]);

  const totalMs = visibleMs + fadeMs;

  useEffect(() => {
    done.current = false;
    t0.current = performance.now();
    const mat = material as ShaderMaterial;
    if (mat.uniforms?.uOpacity) {
      mat.uniforms.uOpacity.value = 1.0;
    }
    const t = window.setTimeout(() => {
      if (done.current) return;
      done.current = true;
      onComplete?.();
    }, totalMs);
    return () => clearTimeout(t);
  }, [totalMs, onComplete, material]);

  useFrame(() => {
    if (done.current) return;
    const elapsed = performance.now() - t0.current;
    const mat = material as ShaderMaterial;
    if (!mat.uniforms?.uOpacity) return;

    if (elapsed <= visibleMs) {
      mat.uniforms.uOpacity.value = 1.0;
      return;
    }

    const fadeT = Math.min(1, (elapsed - visibleMs) / fadeMs);
    mat.uniforms.uOpacity.value = 1.0 - fadeT * fadeT;
  });

  useEffect(() => {
    return () => {
      geometry.dispose();
      releaseSpikeGroundCrackMaterial(theme, material);
    };
  }, [geometry, material, theme]);

  const scale = radius * 2;
  const [x, y, z] = position;

  return (
    <mesh
      ref={meshRef}
      position={[x, y + 0.5, z]}
      rotation={[-Math.PI / 2, 0, rotationZ]}
      scale={[scale * 1.75, scale * 1.75, 1 * 1.75]}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={2}
    />
  );
}
