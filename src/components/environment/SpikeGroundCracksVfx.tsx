'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { BufferAttribute, Mesh } from 'three';
import { PlaneGeometry } from '@/utils/three-exports';
import { createGroundCrackMaterial } from './groundCracksShader';
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
  durationMs: number;
  onComplete?: () => void;
}

/**
 * Ephemeral ground-crack decal at a tectonic spike landing site.
 * Visible for the full telegraph + post-eruption hold, then unmounts and disposes GPU resources.
 */
export default function SpikeGroundCracksVfx({
  position,
  radius,
  seed,
  durationMs,
  onComplete,
}: SpikeGroundCracksVfxProps) {
  const meshRef = useRef<Mesh>(null);
  const done = useRef(false);

  const { rotationZ, crackSeedX, crackSeedY } = useMemo(() => {
    const rand = mulberry32(hashSpikeSeed(seed) + 55103);
    return {
      rotationZ: rand() * Math.PI * 2,
      crackSeedX: rand() * 8.0,
      crackSeedY: rand() * 8.0,
    };
  }, [seed]);

  const { geometry, material } = useMemo(() => {
    const geo = new PlaneGeometry(1, 1);
    geo.setAttribute('aCrackSeed', new BufferAttribute(new Float32Array([crackSeedX, crackSeedY]), 2));
    const mat = createGroundCrackMaterial(false);
    return { geometry: geo, material: mat };
  }, [crackSeedX, crackSeedY]);

  useEffect(() => {
    done.current = false;
    const t = window.setTimeout(() => {
      if (done.current) return;
      done.current = true;
      onComplete?.();
    }, durationMs);
    return () => clearTimeout(t);
  }, [durationMs, onComplete]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  const scale = radius * 2;
  const [x, y, z] = position;

  return (
    <mesh
      ref={meshRef}
      position={[x, y + 0.03, z]}
      rotation={[-Math.PI / 2, 0, rotationZ]}
      scale={[scale, scale, 1]}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={2}
    />
  );
}
