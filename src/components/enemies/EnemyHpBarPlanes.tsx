'use client';

import React, { type RefObject } from 'react';
import type { Mesh } from 'three';
import { SharedMesh } from '@/utils/SharedMesh';
import {
  ENEMY_HP_BAR_BG_GEO,
  ENEMY_HP_BAR_FILL_GEO,
  ENEMY_HP_BAR_FILL_Z,
  ENEMY_HP_BAR_RENDER_ORDER_BG,
  ENEMY_HP_BAR_RENDER_ORDER_FILL,
  ENEMY_HP_BAR_WIDTH,
} from '@/utils/enemyHealthBar';
import { getSharedEnemyHpBarMaterial } from '@/utils/sharedEnemyUiGeometry';

export interface EnemyHpBarPlanesProps {
  fillRef: RefObject<Mesh | null>;
  backgroundColor: string;
  fillColor: string;
}

/** Shared HP bar bg/fill planes + shared materials (no per-enemy mat leak via dispose={null}). */
function EnemyHpBarPlanes({
  fillRef,
  backgroundColor,
  fillColor,
}: EnemyHpBarPlanesProps) {
  const bgMat = getSharedEnemyHpBarMaterial(backgroundColor, 'bg');
  const fillMat = getSharedEnemyHpBarMaterial(fillColor, 'fill');

  return (
    <>
      <SharedMesh
        position={[0, 0, 0]}
        geometry={ENEMY_HP_BAR_BG_GEO}
        material={bgMat}
        renderOrder={ENEMY_HP_BAR_RENDER_ORDER_BG}
      />

      <SharedMesh
        ref={fillRef}
        position={[-ENEMY_HP_BAR_WIDTH / 2, 0, ENEMY_HP_BAR_FILL_Z]}
        scale={[1, 1, 1]}
        geometry={ENEMY_HP_BAR_FILL_GEO}
        material={fillMat}
        renderOrder={ENEMY_HP_BAR_RENDER_ORDER_FILL}
      />
    </>
  );
}

export default React.memo(EnemyHpBarPlanes);
