'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';

const DEFAULT_MS = 750;

/** Keep in sync with `BOSS_TECTONIC_SHARD_RADIUS` in backend/enemyAI.js and spike `SPIKE_RADIUS` in BossTectonicSpike.tsx. */
export const TECTONIC_HIT_RADIUS = 2.75;
export const POST_SPIKE_CRACK_HOLD_MS = 2000;

const TELEGRAPH_THEMES = {
  earth: { inner: '#5c3d1e', outer: '#8b5a2a' },
  blue: { inner: '#3388dd', outer: '#44aaff' },
  green: { inner: '#00cc44', outer: '#00ff55' },
} as const;

export type TectonicSpikeTheme = keyof typeof TELEGRAPH_THEMES;

/**
 * Ground ring before tectonic earth spike; matches server damage disk (see TECTONIC_HIT_RADIUS).
 */
export default function BossTectonicSpikeTelegraph({
  durationMs = DEFAULT_MS,
  theme = 'earth',
  onEnd,
}: {
  durationMs?: number;
  theme?: TectonicSpikeTheme;
  onEnd?: () => void;
}) {
  const group = useRef<Group>(null);
  const t0 = useRef(typeof performance !== 'undefined' ? performance.now() : 0);
  const done = useRef(false);
  const colors = TELEGRAPH_THEMES[theme];

  useFrame(() => {
    if (done.current) return;
    if (performance.now() - t0.current >= durationMs) {
      done.current = true;
      onEnd?.();
    }
  });

  return (
    <group ref={group} position={[0, 0.25, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, TECTONIC_HIT_RADIUS, 64]} />
        <meshBasicMaterial color={colors.inner} transparent opacity={0.65} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[TECTONIC_HIT_RADIUS - 0.2, TECTONIC_HIT_RADIUS + 0.05, 64]} />
        <meshBasicMaterial color={colors.outer} transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  );
}
