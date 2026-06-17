'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';

const BOSS_LEAP_DEFAULT_MS = 1100;

/**
 * Co-op boss leap: flat ring at the server landing point while leap wind-up runs.
 */
export default function BossLeapTelegraph({ durationMs = BOSS_LEAP_DEFAULT_MS, onEnd }: { durationMs?: number; onEnd?: () => void }) {
  const group = useRef<Group>(null);
  const t0 = useRef(typeof performance !== 'undefined' ? performance.now() : 0);
  const done = useRef(false);

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
        <ringGeometry args={[0.2, 2.5, 64]} />
        <meshBasicMaterial
          color="#ff6a1a"
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.4, 2.6, 64]} />
        <meshBasicMaterial
          color="#ffaa44"
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
