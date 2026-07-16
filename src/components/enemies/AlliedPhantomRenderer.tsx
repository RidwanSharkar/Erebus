'use client';

import React from 'react';
import type { Position3 } from '@/utils/position3';
import ShadeRenderer from './ShadeRenderer';

interface AlliedPhantomRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  staggerBuildup?: number;
}

function AlliedPhantomRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  staggerBuildup = 0,
}: AlliedPhantomRendererProps) {
  return (
    <ShadeRenderer
      id={id}
      position={position}
      rotation={rotation}
      health={health}
      maxHealth={maxHealth}
      isDying={isDying}
      campType="ally-yellow"
      soulType="yellow"
      staggerBuildup={staggerBuildup}
    />
  );
}

export default React.memo(AlliedPhantomRenderer);
