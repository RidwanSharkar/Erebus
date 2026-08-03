'use client';

import React from 'react';
import type { Position3 } from '@/utils/position3';
import GhoulRenderer from './GhoulRenderer';

interface AlliedDemonRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  staggerBuildup?: number;
}

function AlliedDemonRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  staggerBuildup = 0,
}: AlliedDemonRendererProps) {
  return (
    <GhoulRenderer
      id={id}
      position={position}
      rotation={rotation}
      health={health}
      maxHealth={maxHealth}
      isDying={isDying}
      staggerBuildup={staggerBuildup}
      campType="ally-yellow"
      skipSummon
      soulType="yellow"
      showMeleeRangeRing={false}
    />
  );
}

export default React.memo(AlliedDemonRenderer);
