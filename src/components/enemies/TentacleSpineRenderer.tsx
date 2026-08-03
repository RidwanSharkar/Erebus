'use client';

import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import type { Position3 } from '@/utils/position3';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from '@/utils/three-exports';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation } from '@/utils/enemyLiveTransform';
import {
  TENTACLE_SPINE_ATTACK_CLIP_MS,
  TENTACLE_SPINE_WINDUP_MS,
} from '@/utils/tentacleSpineClientConstants';
import TentacleSpineModel from './TentacleSpineModel';

export interface TentacleSpineRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  isDying: boolean;
  windSeq: number;
  slamSeq: number;
  windDirXZ: { x: number; z: number };
  windupAt?: number;
  slamAt?: number;
}

/** Resolve attack clock: catch up within windup window; never scrub into tip-over on remount. */
function resolveAttackStartedAt(windupAt: number | undefined): number {
  const now = Date.now();
  if (windupAt == null) return now;
  const lagMs = now - windupAt;
  if (lagMs >= 0 && lagMs <= TENTACLE_SPINE_WINDUP_MS) {
    return now - lagMs;
  }
  // Remount / huge lag / future timestamp — play Custom1 from t=0.
  return now;
}

/** Shared across tentacles — alternate swordMiss1 / swordMiss2 whooshes on each windup. */
let tentacleSpineMissVariant: 1 | 2 = 1;

function playTentacleSpineAttackMiss(pos: Vector3) {
  const soundId = tentacleSpineMissVariant === 1 ? 'sword_miss_1' : 'sword_miss_2';
  window.audioSystem?.playWeaponSound?.(soundId, pos, { volume: 0.75 });
  tentacleSpineMissVariant = tentacleSpineMissVariant === 1 ? 2 : 1;
}

const TentacleSpineRenderer: React.FC<TentacleSpineRendererProps> = ({
  id,
  position,
  rotation,
  isDying,
  windSeq,
  slamSeq,
  windupAt,
  slamAt,
}) => {
  const { enemyTransformsRef, enemyVisualRotationsRef } = useMultiplayerActions();
  const groupRef = useRef<Group>(null);
  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const isDyingRef = useRef(isDying);

  const lastWindSeq = useRef(0);
  const lastSlamSeq = useRef(0);

  const [isAttacking, setIsAttacking] = useState(false);
  const [attackStartedAt, setAttackStartedAt] = useState<number | null>(null);
  const [slamAtMs, setSlamAtMs] = useState<number | null>(null);

  useLayoutEffect(() => {
    isDyingRef.current = isDying;
  }, [isDying]);

  useLayoutEffect(() => {
    if (windSeq > lastWindSeq.current) {
      lastWindSeq.current = windSeq;
      setAttackStartedAt(resolveAttackStartedAt(windupAt));
      setSlamAtMs(null);
      setIsAttacking(true);
      if (!isDyingRef.current) {
        playTentacleSpineAttackMiss(targetPosition.current);
      }
    }
  }, [windSeq, windupAt]);

  useLayoutEffect(() => {
    if (slamSeq > lastSlamSeq.current) {
      lastSlamSeq.current = slamSeq;
      setSlamAtMs(slamAt ?? Date.now());
    }
  }, [slamSeq, slamAt]);

  useEffect(() => {
    if (isDying) setIsAttacking(false);
  }, [isDying]);

  // Clear attacking after full clip so model can return to idle.
  useEffect(() => {
    if (!isAttacking || attackStartedAt == null) return;
    const remaining = Math.max(0, attackStartedAt + TENTACLE_SPINE_ATTACK_CLIP_MS - Date.now() + 100);
    const tid = setTimeout(() => setIsAttacking(false), remaining);
    return () => clearTimeout(tid);
  }, [isAttacking, attackStartedAt, windSeq]);

  useLayoutEffect(() => {
    targetPosition.current.set(position.x, position.y, position.z);
  }, [position.x, position.y, position.z]);

  useLayoutEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useFrame(() => {
    if (!groupRef.current) return;
    syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);
    groupRef.current.position.copy(targetPosition.current);
    groupRef.current.rotation.y = targetRotation.current;
    syncEnemyVisualRotation(id, enemyVisualRotationsRef, groupRef.current.rotation.y);
  });

  return (
    <group ref={groupRef}>
      <TentacleSpineModel
        isAttacking={isAttacking && !isDying}
        attackStartedAt={attackStartedAt}
        slamAt={slamAtMs}
        isDying={isDying}
      />
    </group>
  );
};

export default React.memo(TentacleSpineRenderer);
