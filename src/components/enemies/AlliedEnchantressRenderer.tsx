'use client';

import React from 'react';
import type { Position3 } from '@/utils/position3';
import GreedRenderer from './GreedRenderer';

interface AlliedEnchantressRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  staggerBuildup?: number;
}

function AlliedEnchantressRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  staggerBuildup = 0,
}: AlliedEnchantressRendererProps) {
  return (
    <GreedRenderer
      id={id}
      position={position}
      rotation={rotation}
      health={health}
      maxHealth={maxHealth}
      isDying={isDying}
      staggerBuildup={staggerBuildup}
      soulType="green"
      campType="ally-green"
    />
  );
}

export default React.memo(AlliedEnchantressRenderer);
