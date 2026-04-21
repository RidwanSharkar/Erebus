'use client';

import { STAGGER_MAX } from '@/utils/talents';

interface EnemyStaggerBarProps {
  stagger: number;
  /** Local Y offset inside the parent Billboard (below HP). */
  y?: number;
  /** Total bar width in world units. */
  width?: number;
}

export default function EnemyStaggerBar({ stagger, y = -0.22, width = 1.6 }: EnemyStaggerBarProps) {
  const t = Math.min(1, Math.max(0, stagger / STAGGER_MAX));
  const h = 0.08;
  const fillH = 0.06;
  const half = width / 2;
  return (
    <>
      <mesh position={[0, y, 0]}>
        <planeGeometry args={[width, h]} />
        <meshBasicMaterial color="#0f172a" opacity={0.88} transparent />
      </mesh>
      <mesh position={[-half + half * t, y, 0.001]}>
        <planeGeometry args={[width * t, fillH]} />
        <meshBasicMaterial color="#38bdf8" opacity={0.95} transparent />
      </mesh>
    </>
  );
}
