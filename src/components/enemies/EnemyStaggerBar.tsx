'use client';

import { STAGGER_MAX } from '@/utils/talents';
import { MeshBasicMaterial, PlaneGeometry } from 'three';

/** Shared across all stagger bars — fill driven via mesh.scale.x, not geometry args. */
const STAGGER_BAR_GEO = new PlaneGeometry(1, 1);
STAGGER_BAR_GEO.userData.shared = true;

const STAGGER_BG_MAT = new MeshBasicMaterial({
  color: '#0f172a',
  opacity: 0.88,
  transparent: true,
});
STAGGER_BG_MAT.userData.shared = true;

const STAGGER_FILL_MAT = new MeshBasicMaterial({
  color: '#38bdf8',
  opacity: 0.95,
  transparent: true,
});
STAGGER_FILL_MAT.userData.shared = true;

interface EnemyStaggerBarProps {
  stagger: number;
  /** Proc threshold for full bar (default non-boss `STAGGER_MAX`). */
  staggerMax?: number;
  /** Local Y offset inside the parent Billboard (below HP). */
  y?: number;
  /** Total bar width in world units. */
  width?: number;
}

export default function EnemyStaggerBar({
  stagger,
  staggerMax = STAGGER_MAX,
  y = -0.22,
  width = 1.6,
}: EnemyStaggerBarProps) {
  const cap = staggerMax > 0 ? staggerMax : STAGGER_MAX;
  const t = Math.min(1, Math.max(0, stagger / cap));
  const h = 0.08;
  const fillH = 0.06;
  const half = width / 2;

  return (
    <>
      <mesh position={[0, y, 0]} scale={[width, h, 1]}>
        <primitive object={STAGGER_BAR_GEO} attach="geometry" />
        <primitive object={STAGGER_BG_MAT} attach="material" />
      </mesh>
      <mesh
        position={[-half + (width * t) / 2, y, 0.001]}
        scale={[width * t, fillH, 1]}
      >
        <primitive object={STAGGER_BAR_GEO} attach="geometry" />
        <primitive object={STAGGER_FILL_MAT} attach="material" />
      </mesh>
    </>
  );
}
