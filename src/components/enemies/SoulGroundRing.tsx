'use client';

import React from 'react';
import {
  SOUL_ORB_RING_GEO,
  SOUL_TYPE_MATERIALS,
  type SharedSoulType,
} from '@/utils/sharedEnemyUiGeometry';
import { SharedMesh } from '@/utils/SharedMesh';

interface SoulGroundRingProps {
  soulType: SharedSoulType;
  /** World-relative Y when parent is at y=0 (default sits just above ground). */
  y?: number;
  scale?: number;
}

function SoulGroundRing({ soulType, y = 0.12, scale = 1 }: SoulGroundRingProps) {
  const mats = SOUL_TYPE_MATERIALS[soulType] ?? SOUL_TYPE_MATERIALS.green;

  return (
    <SharedMesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, y, 0]}
      geometry={SOUL_ORB_RING_GEO}
      material={mats.ring}
      scale={[scale, scale, scale]}
    />
  );
}

export default React.memo(SoulGroundRing);
