'use client';

import React, { useEffect, useMemo, useRef } from 'react';
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
  shot: DefenseTowerBoltShot;
  onComplete?: () => void;
}

function DefenseTowerBolt({ shot, onComplete }: DefenseTowerBoltProps) {
  const position = useMemo(() => shot.from.clone(), [shot.seq, shot.from]);
  const direction = useMemo(
    () => shot.to.clone().sub(shot.from).normalize(),
    [shot.seq, shot.from, shot.to],
  );
  const start = useMemo(() => shot.from.clone(), [shot.seq, shot.from]);
  const end = useMemo(() => shot.to.clone(), [shot.seq, shot.to]);
  const elapsed = useRef(0);
  const completed = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const duration = Math.max(0.11, Math.min(0.38, start.distanceTo(end) / 34));

  useEffect(() => {
    elapsed.current = 0;
    completed.current = false;
    position.copy(start);
    direction.copy(end).sub(start);
    if (direction.lengthSq() > 1e-8) direction.normalize();
    const audio = (window as unknown as { audioSystem?: { playEnemyEntropicBoltSound?: (p: Vector3) => void } })
      .audioSystem;
    audio?.playEnemyEntropicBoltSound?.(start.clone());
  }, [shot.seq, position, direction, start, end]);

  useFrame((_, delta) => {
    if (completed.current) return;
    elapsed.current += delta;
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
      id={shot.seq}
      position={position}
      direction={direction}
      ecsDriven={false}
      themeOverride={shot.theme}
    />
  );
}

export default React.memo(DefenseTowerBolt);
