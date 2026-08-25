'use client';

import React from 'react';
import type { Position3 } from '@/utils/position3';
import WyvernRenderer from './WyvernRenderer';

interface AlliedSiegeWyrmRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
}

function AlliedSiegeWyrmRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
}: AlliedSiegeWyrmRendererProps) {
  return (
    <WyvernRenderer
      id={id}
      position={position}
      rotation={rotation}
      health={health}
      maxHealth={maxHealth}
      isDying={isDying}
      variant="ally"
      campType="ally-green"
    />
  );
}

export default React.memo(AlliedSiegeWyrmRenderer);
