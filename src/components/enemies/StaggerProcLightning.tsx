'use client';

import { useMemo } from 'react';
import { Vector3 } from '@/utils/three-exports';
import DirectionalProcLightning, { type DirectionalProcLightningPalette } from './DirectionalProcLightning';

const SKY_Y = 24;

const BLUE_PALETTE: DirectionalProcLightningPalette = {
  core: '#e0f2fe',
  glow: '#38bdf8',
  halo: '#7dd3fc',
  light: '#bae6fd',
};

interface StaggerProcLightningProps {
  position: Vector3;
  onComplete: () => void;
}

export default function StaggerProcLightning({ position, onComplete }: StaggerProcLightningProps) {
  const from = useMemo(
    () => new Vector3(position.x, position.y + SKY_Y, position.z),
    [position.x, position.y, position.z],
  );

  return <DirectionalProcLightning from={from} to={position} palette={BLUE_PALETTE} onComplete={onComplete} />;
}
