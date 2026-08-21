'use client';

import React, { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import EntropicBolt from '@/components/projectiles/EntropicBolt';
import type { DefenseTowerBoltTheme } from '@/utils/defenseLayout';

export type DefenseTowerBoltShot = {
  seq: number;
  from: Vector3;
  to: Vector3;
  theme: DefenseTowerBoltTheme;
};

interface DefenseTowerBoltProps {
  shot: DefenseTowerBoltShot | null;
  onComplete?: () => void;
}

const TOWER_TRAIL_POINTS = 24;

function DefenseTowerBolt({ shot, onComplete }: DefenseTowerBoltProps) {
  const position = useRef(new Vector3()).current;
  const direction = useRef(new Vector3(0, 1, 0)).current;
  const start = useRef(new Vector3()).current;
  const end = useRef(new Vector3()).current;
  const elapsed = useRef(0);
  const completed = useRef(true);
  const durationRef = useRef(0.2);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const theme = shot?.theme;

  useEffect(() => {
    if (!shot) {
      completed.current = true;
      return;
    }
    elapsed.current = 0;
    completed.current = false;
    start.copy(shot.from);
    end.copy(shot.to);
    position.copy(start);
    direction.copy(end).sub(start);
    if (direction.lengthSq() > 1e-8) direction.normalize();
    else direction.set(0, 1, 0);
    durationRef.current = Math.max(0.11, Math.min(0.38, start.distanceTo(end) / 34));
    const audio = (window as unknown as { audioSystem?: { playEnemyEntropicBoltSound?: (p: Vector3) => void } })
      .audioSystem;
    audio?.playEnemyEntropicBoltSound?.(start.clone());
  }, [shot]);

  useFrame((_, delta) => {
    if (!shot || completed.current) return;
    elapsed.current += delta;
    const duration = durationRef.current;
    const t = Math.min(1, elapsed.current / duration);
    position.lerpVectors(start, end, t);
    direction.copy(end).sub(start);
    if (direction.lengthSq() > 1e-8) direction.normalize();
    if (t >= 1 && elapsed.current >= duration + 0.12) {
      completed.current = true;
      onCompleteRef.current?.();
    }
  });

  return (
    <EntropicBolt
      id={shot?.seq ?? 0}
      position={position}
      direction={direction}
      ecsDriven={false}
      themeOverride={theme}
      active={!!shot}
      trailPointCount={TOWER_TRAIL_POINTS}
      trailResetSeq={shot?.seq ?? 0}
    />
  );
}

export default React.memo(DefenseTowerBolt);
