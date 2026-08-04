'use client';

import React, { type RefObject } from 'react';
import type { Mesh } from 'three';
import { SharedMesh } from '@/utils/SharedMesh';
import {
  ENEMY_HP_BAR_BG_GEO,
  ENEMY_HP_BAR_FILL_GEO,
  ENEMY_HP_BAR_FILL_Z,
  ENEMY_HP_BAR_WIDTH,
} from '@/utils/enemyHealthBar';

export interface EnemyHpBarPlanesProps {
  fillRef: RefObject<Mesh | null>;
  backgroundColor: string;
  fillColor: string;
}

/** Shared HP bar bg/fill planes — uses module-level geometry; per-enemy materials. */
function EnemyHpBarPlanes({
  fillRef,
  backgroundColor,
  fillColor,
}: EnemyHpBarPlanesProps) {
  return (
    <>
      <SharedMesh position={[0, 0, 0]}>
        <primitive object={ENEMY_HP_BAR_BG_GEO} attach="geometry" />
        <meshBasicMaterial color={backgroundColor} opacity={0.9} transparent />
      </SharedMesh>

      <SharedMesh
        ref={fillRef}
        position={[-ENEMY_HP_BAR_WIDTH / 2, 0, ENEMY_HP_BAR_FILL_Z]}
        scale={[1, 1, 1]}
      >
        <primitive object={ENEMY_HP_BAR_FILL_GEO} attach="geometry" />
        <meshBasicMaterial color={fillColor} opacity={0.95} transparent />
      </SharedMesh>
    </>
  );
}

export default React.memo(EnemyHpBarPlanes);
