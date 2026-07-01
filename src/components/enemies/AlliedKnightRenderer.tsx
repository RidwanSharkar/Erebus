'use client';

import React, { useMemo } from 'react';
import { Vector3 } from 'three';
import KnightRenderer from './KnightRenderer';
import { DashChargeStatus } from '../dragon/ChargedOrbitals';

interface AlliedKnightRendererProps {
  id: string;
  position: Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  staggerBuildup?: number;
  alliedOrbSlots?: boolean[];
  /** Use fast walk animation when Abyssal Initiate is active. */
  fastWalk?: boolean;
}

export default function AlliedKnightRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  staggerBuildup = 0,
  alliedOrbSlots,
  fastWalk = false,
}: AlliedKnightRendererProps) {
  const orbitalCharges = useMemo<DashChargeStatus[]>(() => {
    const slots = alliedOrbSlots?.length === 3 ? alliedOrbSlots : [true, true, true];
    return slots.map(isAvailable => ({ isAvailable, cooldownRemaining: 0 }));
  }, [alliedOrbSlots]);

  return (
    <KnightRenderer
      id={id}
      position={position}
      rotation={rotation}
      health={health}
      maxHealth={maxHealth}
      isDying={isDying}
      campType="ally-green"
      showMeleeRangeRing={false}
      staggerBuildup={staggerBuildup}
      attackTelegraphEvent="allied-knight-attack-telegraph"
      attackVariantOneChance={0.7}
      showOrbitals
      orbitalCharges={orbitalCharges}
      orbitalActiveColor="#facc15"
      orbitalInactiveColor="#3a2a09"
      orbitalYOffset={2.1}
      forceFastWalk={fastWalk}
    />
  );
}
