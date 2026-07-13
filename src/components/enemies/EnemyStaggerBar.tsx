'use client';

import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import { STAGGER_MAX } from '@/utils/talents';
import { SharedMesh } from '@/utils/SharedMesh';
import { MeshBasicMaterial, PlaneGeometry } from 'three';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import {
  applyEnemyStaggerBarFill,
  syncEnemyStaggerBarFillFromRef,
} from '@/utils/enemyStaggerBar';

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
  enemyId: string;
  /** Spawn/fallback stagger when ref has no live value yet. */
  stagger: number;
  /** Proc threshold for full bar (default non-boss `STAGGER_MAX`). */
  staggerMax?: number;
  /** Local Y offset inside the parent Billboard (below HP). */
  y?: number;
  /** Total bar width in world units. */
  width?: number;
}

export default function EnemyStaggerBar({
  enemyId,
  stagger,
  staggerMax = STAGGER_MAX,
  y = -0.22,
  width = 1.6,
}: EnemyStaggerBarProps) {
  const { enemiesRef } = useMultiplayerActions();
  const fillRef = useRef<Mesh | null>(null);
  const h = 0.08;
  const fillH = 0.06;

  useLayoutEffect(() => {
    applyEnemyStaggerBarFill(fillRef.current, stagger, staggerMax, width);
  }, [stagger, staggerMax, width]);

  useFrame(() => {
    syncEnemyStaggerBarFillFromRef(
      fillRef,
      enemiesRef,
      enemyId,
      stagger,
      staggerMax,
      width,
    );
  });

  return (
    <>
      <SharedMesh position={[0, y, 0]} scale={[width, h, 1]}>
        <primitive object={STAGGER_BAR_GEO} attach="geometry" />
        <primitive object={STAGGER_BG_MAT} attach="material" />
      </SharedMesh>
      <SharedMesh
        ref={fillRef}
        position={[-width / 2, y, 0.001]}
        scale={[0, fillH, 1]}
      >
        <primitive object={STAGGER_BAR_GEO} attach="geometry" />
        <primitive object={STAGGER_FILL_MAT} attach="material" />
      </SharedMesh>
    </>
  );
}
