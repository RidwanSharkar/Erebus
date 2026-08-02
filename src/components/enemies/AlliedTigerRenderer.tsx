'use client';

import React from 'react';
import type { Position3 } from '@/utils/position3';
import TigerRenderer from './TigerRenderer';

interface AlliedTigerRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  staggerBuildup?: number;
  tigerLocomotion?: 'walk' | 'run';
}

function AlliedTigerRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  staggerBuildup = 0,
  tigerLocomotion = 'walk',
}: AlliedTigerRendererProps) {
  return (
    <TigerRenderer
      id={id}
      position={position}
      rotation={rotation}
      health={health}
      maxHealth={maxHealth}
      isDying={isDying}
      staggerBuildup={staggerBuildup}
      campType="ally-yellow"
      soulType="yellow"
      tigerLocomotion={tigerLocomotion}
    />
  );
}

export default React.memo(AlliedTigerRenderer);
