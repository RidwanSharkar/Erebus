'use client';

import React from 'react';
import { Vector3 } from '../../utils/three-exports';
import ArcaneRitualCircle from '../environment/ArcaneRitualCircle';

interface GhoulSummonRitualProps {
  position: Vector3;
  onComplete: () => void;
}

export default function GhoulSummonRitual({ position, onComplete }: GhoulSummonRitualProps) {
  return (
    <ArcaneRitualCircle
      position={[position.x, 0.25, position.z]}
      baseColor="#166534"
      glowColor="#86efac"
      onComplete={onComplete}
    />
  );
}
