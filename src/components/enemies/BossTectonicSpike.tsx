'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import type { TectonicSpikeTheme } from './BossTectonicSpikeTelegraph';
import {
  SPIKE_HEIGHT,
  createSpikeRiseMotion,
  hashSpikeSeed,
} from '@/utils/tectonicSpikeGeometry';
import GroundSpikeModel from './GroundSpikeModel';
import HellfireCrystalSpikeModel, {
  FROST_SHATTER_SPIKE_HEIGHT,
} from './HellfireCrystalSpikeModel';

const RISE_MS = 520;
const HOLD_MS = 1080;
const RETRACT_MS = 520;
const TOTAL_MS = RISE_MS + HOLD_MS + RETRACT_MS;
const HOLD_END_MS = RISE_MS + HOLD_MS;

export type BossTectonicSpikeVariant = 'ground' | 'hellfireCrystal';

/**
 * Crystal ground spike erupting from the ground with lateral wobble, then retracting.
 */
export default function BossTectonicSpike({
  worldPosition,
  theme = 'earth',
  variant = 'ground',
  variantSeed,
  onComplete,
}: {
  worldPosition: Vector3;
  theme?: TectonicSpikeTheme;
  /** `ground` = Impale / boss tectonic; `hellfireCrystal` = Frost Affinity Shatter. */
  variant?: BossTectonicSpikeVariant;
  /** Stable key for per-spike rise motion variation. */
  variantSeed?: string;
  onComplete: () => void;
}) {
  const root = useRef<Group>(null);
  const riseGroup = useRef<Group>(null);
  const t0 = useRef(performance.now());
  const done = useRef(false);

  const seedKey = variantSeed ?? `${worldPosition.x},${worldPosition.z}`;
  const numericSeed = useMemo(() => hashSpikeSeed(seedKey), [seedKey]);
  const riseMotion = useMemo(() => createSpikeRiseMotion(numericSeed), [numericSeed]);

  const riseDepth =
    (variant === 'hellfireCrystal' ? FROST_SHATTER_SPIKE_HEIGHT : SPIKE_HEIGHT) *
    0.92;

  useFrame(() => {
    if (done.current) return;
    const e = performance.now() - t0.current;

    if (riseGroup.current) {
      const { emergenceYaw, leanDir, leanAmt, wobbleFreqX, wobbleFreqZ, wobbleAmp, tiltX, tiltZ } =
        riseMotion;
      const baseX = Math.cos(leanDir) * leanAmt;
      const baseZ = Math.sin(leanDir) * leanAmt;

      if (e < RISE_MS) {
        const t = e / RISE_MS;
        const ease = 1 - (1 - t) * (1 - t);
        const yOff = -riseDepth * (1 - ease);
        const wobbleDecay = 1 - t;
        const xOff =
          baseX * ease + Math.sin(t * wobbleFreqX) * wobbleAmp * wobbleDecay;
        const zOff =
          baseZ * ease + Math.cos(t * wobbleFreqZ) * wobbleAmp * wobbleDecay;
        riseGroup.current.position.set(xOff, yOff, zOff);
        riseGroup.current.rotation.set(
          tiltX * wobbleDecay,
          emergenceYaw,
          tiltZ * wobbleDecay,
        );
      } else if (e < HOLD_END_MS) {
        riseGroup.current.position.set(baseX, 0, baseZ);
        riseGroup.current.rotation.set(0, emergenceYaw, 0);
      } else if (e < TOTAL_MS) {
        const t = (e - HOLD_END_MS) / RETRACT_MS;
        const ease = t * t; // ease-in into the ground
        const yOff = -riseDepth * ease;
        riseGroup.current.position.set(baseX * (1 - ease), yOff, baseZ * (1 - ease));
        riseGroup.current.rotation.set(0, emergenceYaw, 0);
      } else {
        riseGroup.current.position.set(0, -riseDepth, 0);
        riseGroup.current.rotation.set(0, emergenceYaw, 0);
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
        {variant === 'hellfireCrystal' ? (
          <HellfireCrystalSpikeModel />
        ) : (
          <GroundSpikeModel theme={theme} />
        )}
      </group>
    </group>
  );
}
