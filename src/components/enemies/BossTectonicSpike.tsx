'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, MeshStandardMaterial } from 'three';
import type { TectonicSpikeTheme } from './BossTectonicSpikeTelegraph';
import {
  SPIKE_HEIGHT,
  createTectonicSpikeGeometry,
  createSpikeRiseMotion,
  hashSpikeSeed,
} from '@/utils/tectonicSpikeGeometry';

const RISE_MS = 520;
const HOLD_MS = 1600;
const TOTAL_MS = RISE_MS + HOLD_MS;

/**
 * Ridged mountain spike erupting from the ground with lateral wobble.
 */
export default function BossTectonicSpike({
  worldPosition,
  theme = 'earth',
  variantSeed,
  onComplete,
}: {
  worldPosition: Vector3;
  theme?: TectonicSpikeTheme;
  /** Stable key for per-spike sculpt + rise motion variation. */
  variantSeed?: string;
  onComplete: () => void;
}) {
  const root = useRef<Group>(null);
  const riseGroup = useRef<Group>(null);
  const t0 = useRef(performance.now());
  const done = useRef(false);

  const seedKey = variantSeed ?? `${worldPosition.x},${worldPosition.z}`;
  const numericSeed = useMemo(() => hashSpikeSeed(seedKey), [seedKey]);

  const geometry = useMemo(
    () => createTectonicSpikeGeometry(numericSeed, theme),
    [numericSeed, theme],
  );

  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.9,
        metalness: 0.1,
      }),
    [],
  );

  const riseMotion = useMemo(() => createSpikeRiseMotion(numericSeed), [numericSeed]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  const riseDepth = SPIKE_HEIGHT * 0.92;

  useFrame(() => {
    if (done.current) return;
    const e = performance.now() - t0.current;

    if (riseGroup.current) {
      if (e < RISE_MS) {
        const t = e / RISE_MS;
        const ease = 1 - (1 - t) * (1 - t);
        const yOff = -riseDepth * (1 - ease);
        const wobbleDecay = 1 - t;
        const { leanDir, leanAmt, wobbleFreqX, wobbleFreqZ, wobbleAmp, tiltX, tiltZ } = riseMotion;
        const xOff =
          Math.cos(leanDir) * leanAmt * ease +
          Math.sin(t * wobbleFreqX) * wobbleAmp * wobbleDecay;
        const zOff =
          Math.sin(leanDir) * leanAmt * ease +
          Math.cos(t * wobbleFreqZ) * wobbleAmp * wobbleDecay;
        riseGroup.current.position.set(xOff, yOff, zOff);
        riseGroup.current.rotation.set(tiltX * wobbleDecay, 0, tiltZ * wobbleDecay);
      } else {
        const { leanDir, leanAmt } = riseMotion;
        riseGroup.current.position.set(
          Math.cos(leanDir) * leanAmt,
          0,
          Math.sin(leanDir) * leanAmt,
        );
        riseGroup.current.rotation.set(0, 0, 0);
      }
    }

    if (e >= TOTAL_MS) {
      done.current = true;
      onComplete();
    }
  });

  return (
    <group ref={root} position={[worldPosition.x, 0, worldPosition.z]}>
      <group ref={riseGroup}>
        <mesh castShadow geometry={geometry} material={material} />
      </group>
    </group>
  );
}
