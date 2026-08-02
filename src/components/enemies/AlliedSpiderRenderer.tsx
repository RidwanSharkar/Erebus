'use client';

import React from 'react';
import type { Position3 } from '@/utils/position3';
import BoneSpiderRenderer from './BoneSpiderRenderer';

interface AlliedSpiderRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  staggerBuildup?: number;
  visualScale?: number;
}

function AlliedSpiderRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  staggerBuildup = 0,
  visualScale = 0.33,
}: AlliedSpiderRendererProps) {
  return (
    <BoneSpiderRenderer
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

export default React.memo(AlliedSpiderRenderer);
