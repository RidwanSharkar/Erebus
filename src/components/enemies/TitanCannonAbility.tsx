'use client';

import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import ViperShotTelegraphLine from './ViperShotTelegraphLine';
import TitanCannonBeam from './TitanCannonBeam';

type SoulType = 'green' | 'red' | 'blue' | 'purple';

const SOUL_LINE_COLORS: Record<SoulType, string> = {
  green:  '#00ff88',
  red:    '#ff3344',
  blue:   '#44aaff',
  purple: '#cc44ff',
};

export interface TitanCannonAbilityProps {
  soulType: SoulType;
  /** World-space origin of the beam (at TITAN_CANNON_START_OFFSET from titan centre). */
  origin: Vector3;
  /** Titan's Y rotation (radians) — determines beam direction. */
  rotation: number;
  range: number;
  halfWidth: number;
  /** Unix ms when the beam fires (end of the 1s ground telegraph). */
  strikeAt: number;
  onComplete: () => void;
}

export default function TitanCannonAbility({
  soulType,
  origin,
  rotation,
  range,
  halfWidth,
  strikeAt,
  onComplete,
}: TitanCannonAbilityProps) {
  const [phase, setPhase] = useState<'telegraph' | 'beam'>('telegraph');
  const transitionedRef = useRef(false);

  // Compute ground strip end from origin + direction derived from rotation
  const ux = Math.sin(rotation);
  const uz = Math.cos(rotation);
  const [groundStart, groundEnd] = useMemo(
    () => [
      new Vector3(origin.x, 0.08, origin.z),
      new Vector3(origin.x + ux * range, 0.08, origin.z + uz * range),
    ],
    [origin.x, origin.z, ux, uz, range],
  );

  useFrame(() => {
    if (phase === 'telegraph' && !transitionedRef.current && Date.now() >= strikeAt) {
      transitionedRef.current = true;
      setPhase('beam');
    }
  });

  // The beam needs the titan group's XZ position (not the offset origin) so it can apply the
  // same pitch transform as Boss3GreenBeam. We back-calculate titan centre from origin.
  const titanPos = useMemo(
    () => new Vector3(origin.x - ux * 0.65, 0, origin.z - uz * 0.65),
    [origin.x, origin.z, ux, uz],
  );

  return (
    <>
      {phase === 'telegraph' && (
        <ViperShotTelegraphLine
          start={groundStart}
          end={groundEnd}
          lineWidth={halfWidth * 2}
          color={SOUL_LINE_COLORS[soulType]}
          variant="archon"
          endAt={strikeAt}
          startedAt={strikeAt - 1000}
          showStartCap
        />
      )}

      {phase === 'beam' && (
        <TitanCannonBeam
          position={titanPos}
          rotation={rotation}
          soulType={soulType}
          onComplete={onComplete}
        />
      )}
    </>
  );
}
