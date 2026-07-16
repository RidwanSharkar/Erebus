'use client';

import React from 'react';
import type { Position3 } from '@/utils/position3';
import ViperRenderer from './ViperRenderer';

interface AlliedHuntressRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  staggerBuildup?: number;
}

function AlliedHuntressRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  staggerBuildup = 0,
}: AlliedHuntressRendererProps) {
  return (
    <ViperRenderer
      id={id}
      position={position}
      rotation={rotation}
      health={health}
      maxHealth={maxHealth}
      isDying={isDying}
      campType="ally-yellow"
      staggerBuildup={staggerBuildup}
      soulColor="yellow"
    />
  );
}

export default React.memo(AlliedHuntressRenderer);
