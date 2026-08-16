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

export type BossTectonicSpikeVariant = 'ground' | 'hellfireCrystal';

interface SpikeVariantTiming {
  riseMs: number;
  holdMs: number;
  retractMs: number;
  /** Back-ease overshoot amount; 0 keeps the original ease-out-quad rise. */
  overshoot: number;
}

const SPIKE_VARIANT_TIMING: Record<BossTectonicSpikeVariant, SpikeVariantTiming> = {
  ground: { riseMs: 520, holdMs: 1080, retractMs: 520, overshoot: 0 },
  hellfireCrystal: { riseMs: 190, holdMs: 1410, retractMs: 520, overshoot: 1.7 },
};

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

  const { riseMs, holdMs, retractMs, overshoot } = SPIKE_VARIANT_TIMING[variant];
  const holdEndMs = riseMs + holdMs;
  const totalMs = holdEndMs + retractMs;
  const wobbleScale = overshoot > 0 ? 1.5 : 1;

  useFrame(() => {
    if (done.current) return;
    const e = performance.now() - t0.current;

    if (riseGroup.current) {
      const { emergenceYaw, leanDir, leanAmt, wobbleFreqX, wobbleFreqZ, wobbleAmp, tiltX, tiltZ } =
        riseMotion;
      const baseX = Math.cos(leanDir) * leanAmt;
      const baseZ = Math.sin(leanDir) * leanAmt;
      const scaledWobbleAmp = wobbleAmp * wobbleScale;

      if (e < riseMs) {
        const t = e / riseMs;
        const ease = overshoot > 0
          ? 1 + (overshoot + 1) * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2)
          : 1 - (1 - t) * (1 - t);
        const yOff = -riseDepth * (1 - ease);
        const wobbleDecay = 1 - t;
        const xOff =
          baseX * ease + Math.sin(t * wobbleFreqX) * scaledWobbleAmp * wobbleDecay;
        const zOff =
          baseZ * ease + Math.cos(t * wobbleFreqZ) * scaledWobbleAmp * wobbleDecay;
        riseGroup.current.position.set(xOff, yOff, zOff);
        riseGroup.current.rotation.set(
          tiltX * wobbleDecay,
          emergenceYaw,
          tiltZ * wobbleDecay,
        );
      } else if (e < holdEndMs) {
        riseGroup.current.position.set(baseX, 0, baseZ);
        riseGroup.current.rotation.set(0, emergenceYaw, 0);
      } else if (e < totalMs) {
        const t = (e - holdEndMs) / retractMs;
        const ease = t * t; // ease-in into the ground
        const yOff = -riseDepth * ease;
        riseGroup.current.position.set(baseX * (1 - ease), yOff, baseZ * (1 - ease));
        riseGroup.current.rotation.set(0, emergenceYaw, 0);
      } else {
        riseGroup.current.position.set(0, -riseDepth, 0);
        riseGroup.current.rotation.set(0, emergenceYaw, 0);
      }
    }

    if (e >= totalMs) {
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
