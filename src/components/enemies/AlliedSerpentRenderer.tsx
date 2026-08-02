'use client';

import React from 'react';
import type { Position3 } from '@/utils/position3';
import SerpentRenderer from './SerpentRenderer';

interface AlliedSerpentRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  staggerBuildup?: number;
  visualScale?: number;
}

function AlliedSerpentRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  staggerBuildup = 0,
  visualScale = 0.5,
}: AlliedSerpentRendererProps) {
  return (
    <SerpentRenderer
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

export default React.memo(AlliedSerpentRenderer);
