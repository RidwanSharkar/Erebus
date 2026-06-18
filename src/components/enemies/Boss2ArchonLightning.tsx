'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import ViperShotTelegraphLine from './ViperShotTelegraphLine';
import DirectionalProcLightning, { type DirectionalProcLightningPalette } from './DirectionalProcLightning';
import { BOSS2_ARCHON_LIGHTNING_WINDUP_MS } from '@/utils/groundLineTelegraphShader';

export interface Boss2ArchonBeam {
  startPosition: Vector3;
  targetPosition: Vector3;
}

interface Boss2ArchonLightningProps {
  beams: Boss2ArchonBeam[];
  strikeAt: number;
  halfWidth: number;
  onComplete: () => void;
}

const BOLT_DURATION_MS = 600;

const ARCHON_RED_PALETTE: DirectionalProcLightningPalette = {
  core: '#ffefff',
  glow: '#ff3333',
  halo: '#ff6666',
  light: '#ff0000',
};

export default function Boss2ArchonLightning({
  beams,
  strikeAt,
  halfWidth,
  onComplete,
}: Boss2ArchonLightningProps) {
  const [phase, setPhase] = useState<'warning' | 'strike'>('warning');
  const completedRef = useRef(false);
  const finishedBoltsRef = useRef(0);

  const groundPairs = useMemo(
    () =>
      beams.map(({ startPosition, targetPosition }) => ({
        groundStart: new Vector3(startPosition.x, 0.08, startPosition.z),
        groundEnd: new Vector3(targetPosition.x, 0.08, targetPosition.z),
      })),
    [beams],
  );

  const handleBoltComplete = () => {
    finishedBoltsRef.current += 1;
    if (finishedBoltsRef.current >= beams.length && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  };

  useFrame(() => {
    if (phase === 'warning' && Date.now() >= strikeAt) {
      setPhase('strike');
    }
  });

  return (
    <>
      {phase === 'warning' &&
        groundPairs.map(({ groundStart, groundEnd }, beamIdx) => {
          const showStartCap = groundStart.distanceTo(groundEnd) > 2;
          return (
            <ViperShotTelegraphLine
              key={`warn-${beamIdx}`}
              start={groundStart}
              end={groundEnd}
              lineWidth={halfWidth * 2}
              color="#ff3333"
              variant="archon"
              endAt={strikeAt}
              startedAt={strikeAt - BOSS2_ARCHON_LIGHTNING_WINDUP_MS}
              showStartCap={showStartCap}
            />
          );
        })}

      {phase === 'strike' &&
        beams.map((beam, i) => (
          <DirectionalProcLightning
            key={`strike-${i}`}
            from={beam.startPosition}
            to={beam.targetPosition}
            palette={ARCHON_RED_PALETTE}
            durationMs={BOLT_DURATION_MS}
            onComplete={handleBoltComplete}
          />
        ))}
    </>
  );
}
