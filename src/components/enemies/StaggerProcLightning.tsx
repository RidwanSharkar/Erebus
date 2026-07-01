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

/** Magma Current (duo: red + blue) — deep fiery orange recolor of the stagger lightning bolt. */
const MAGMA_PALETTE: DirectionalProcLightningPalette = {
  core: '#fff1e0',
  glow: '#ff6b00',
  halo: '#ff4500',
  light: '#e01510',
};

/** Force of Nature (duo: blue + green) — verdant green recolor of the stagger lightning bolt. */
const FORCE_OF_NATURE_PALETTE: DirectionalProcLightningPalette = {
  core: '#f0fff0',
  glow: '#22c55e',
  halo: '#16a34a',
  light: '#86efac',
};

interface StaggerProcLightningProps {
  position: Vector3;
  onComplete: () => void;
  /** True when the proc that spawned this bolt has the Magma Current duo boon active. */
  magmaCurrent?: boolean;
  /** True when the proc that spawned this bolt has the Force of Nature duo boon active. */
  forceOfNature?: boolean;
}

export default function StaggerProcLightning({
  position,
  onComplete,
  magmaCurrent = false,
  forceOfNature = false,
}: StaggerProcLightningProps) {
  const from = useMemo(
    () => new Vector3(position.x, position.y + SKY_Y, position.z),
    [position.x, position.y, position.z],
  );

  const palette = magmaCurrent ? MAGMA_PALETTE : forceOfNature ? FORCE_OF_NATURE_PALETTE : BLUE_PALETTE;

  return (
    <DirectionalProcLightning
      from={from}
      to={position}
      palette={palette}
      onComplete={onComplete}
    />
  );
}
