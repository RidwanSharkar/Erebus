'use client';

import React from 'react';
import type { Position3 } from '@/utils/position3';
import WolfRenderer from './WolfRenderer';

interface AlliedWolfRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  staggerBuildup?: number;
  visualScale?: number;
}

function AlliedWolfRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  staggerBuildup = 0,
  visualScale = 1,
}: AlliedWolfRendererProps) {
  return (
    <WolfRenderer
      id={id}
      position={position}
      rotation={rotation}
      health={health}
      maxHealth={maxHealth}
      isDying={isDying}
      staggerBuildup={staggerBuildup}
      visualScale={visualScale}
      campType="ally-yellow"
      variant="ally"
    />
  );
}

export default React.memo(AlliedWolfRenderer);
