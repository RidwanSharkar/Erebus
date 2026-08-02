'use client';

import React from 'react';
import type { Position3 } from '@/utils/position3';
import TigerRenderer from './TigerRenderer';

interface EnemyTigerRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  staggerBuildup?: number;
  campType?: string;
  soulType?: 'yellow' | 'green' | 'red' | 'blue' | 'purple' | 'orange';
  tigerLocomotion?: 'walk' | 'run';
  visualScale?: number;
}

function EnemyTigerRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  staggerBuildup = 0,
  campType,
  soulType,
  tigerLocomotion = 'walk',
  visualScale = 1,
}: EnemyTigerRendererProps) {
  return (
    <TigerRenderer
      id={id}
      position={position}
      rotation={rotation}
      health={health}
      maxHealth={maxHealth}
      isDying={isDying}
      staggerBuildup={staggerBuildup}
      campType={campType}
      soulType={soulType}
      tigerLocomotion={tigerLocomotion}
      visualScale={visualScale}
      variant="enemy"
    />
  );
}

export default React.memo(EnemyTigerRenderer);
