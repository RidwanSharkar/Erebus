'use client';

import React from 'react';
import type { Position3 } from '@/utils/position3';
import BearRenderer from './BearRenderer';

interface AlliedBearRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  staggerBuildup?: number;
  visualScale?: number;
}

function AlliedBearRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  staggerBuildup = 0,
  visualScale = 1,
}: AlliedBearRendererProps) {
  return (
    <BearRenderer
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

export default React.memo(AlliedBearRenderer);
