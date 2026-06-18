'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';

const BOSS_LEAP_DEFAULT_MS = 1100;

export type LeapTelegraphTheme = 'boss' | 'templar';

const THEMES: Record<
  LeapTelegraphTheme,
  { inner: [number, number]; outer: [number, number]; innerColor: string; outerColor: string }
> = {
  boss: {
    inner: [0.2, 2.5],
    outer: [2.4, 2.6],
    innerColor: '#ff6a1a',
    outerColor: '#ffaa44',
  },
  templar: {
    inner: [0.15, 1.6],
    outer: [1.5, 1.7],
    innerColor: '#cc2222',
    outerColor: '#ff4444',
  },
};

/**
 * Co-op leap: flat ring at the server landing point while leap wind-up runs.
 */
export default function BossLeapTelegraph({
  durationMs = BOSS_LEAP_DEFAULT_MS,
  theme = 'boss',
  onEnd,
}: {
  durationMs?: number;
  theme?: LeapTelegraphTheme;
  onEnd?: () => void;
}) {
  const group = useRef<Group>(null);
  const t0 = useRef(typeof performance !== 'undefined' ? performance.now() : 0);
  const done = useRef(false);
  const preset = THEMES[theme];

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
        <ringGeometry args={[preset.inner[0], preset.inner[1], 64]} />
        <meshBasicMaterial
          color={preset.innerColor}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[preset.outer[0], preset.outer[1], 64]} />
        <meshBasicMaterial
          color={preset.outerColor}
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
