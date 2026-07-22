'use client';

import { positionScratch, type Position3 } from '@/utils/position3';
import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import NemesisModel from './NemesisModel';
import EnemyStaggerBar from './EnemyStaggerBar';
import EnemyMeleeAttackRangeRing, { NEMESIS_MELEE_ATTACK_RANGE } from './EnemyMeleeAttackRangeRing';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation, updateEnemyWalkStateFromMoveDist } from '@/utils/enemyLiveTransform';
import { campHpTheme } from '@/utils/campHpTheme';
import {
  ENEMY_HP_BAR_WIDTH,
  applyEnemyHealthBarFill,
  syncEnemyHealthBarFillFromRef,
  syncEnemyHealthBarNumericTextFromRef,
} from '@/utils/enemyHealthBar';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';
import EnemyHpBarPlanes from './EnemyHpBarPlanes';

interface NemesisRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  staggerBuildup?: number;
}

const ATTACK_DURATION = 750;
const LERP_SPEED = 8;
const WALK_STOP_DELAY = 300;

export default function NemesisRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  staggerBuildup = 0,
}: NemesisRendererProps) {
  const theme = campHpTheme(campType);
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [isAttacking, setIsAttacking] = useState(false);
  const [isWalking, setIsWalking] = useState(true);
  const [attackVariant, setAttackVariant] = useState<1 | 2>(1);

  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const isAttackingRef = useRef(false);
  const isWalkingRef = useRef(true);
  const lastMoveTimeRef = useRef(0);
  const pendingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const trackTimeout = useCallback((fn: () => void, ms: number) => {
    const tid = setTimeout(() => {
      pendingTimersRef.current = pendingTimersRef.current.filter((t) => t !== tid);
      fn();
    }, ms);
    pendingTimersRef.current.push(tid);
    return tid;
  }, []);

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []);

  useEffect(() => {
    targetPosition.current.set(position.x, position.y, position.z);
  }, [position.x, position.y, position.z]);

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useEffect(() => () => pendingTimersRef.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (!socket) return;
    const handleTelegraph = (data: { nemesisId: string; attackVariant?: 1 | 2 }) => {
      if (data.nemesisId !== id) return;
      setAttackVariant(data.attackVariant === 2 ? 2 : 1);
      setIsAttacking(true);
      isAttackingRef.current = true;
      isWalkingRef.current = false;
      setIsWalking(false);
      trackTimeout(() => {
        setIsAttacking(false);
        isAttackingRef.current = false;
        isWalkingRef.current = true;
        setIsWalking(true);
      }, ATTACK_DURATION);
    };
    socket.on('nemesis-attack-telegraph', handleTelegraph);
    return () => {
      socket.off('nemesis-attack-telegraph', handleTelegraph);
    };
  }, [id, socket, trackTimeout]);

  useLayoutEffect(() => {
    applyEnemyHealthBarFill(hpFillRef.current, health, maxHealth);
  }, [health, maxHealth]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;
    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

    const dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);
    updateEnemyWalkStateFromMoveDist(
      dist,
      isAttackingRef.current,
      isDying,
      WALK_STOP_DELAY,
      lastMoveTimeRef,
      isWalkingRef,
      setIsWalking,
    );

    group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));
    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);
    syncEnemyVisualRotation(id, enemyVisualRotationsRef, group.rotation.y);
  });

  return (
    <group ref={setGroupRef}>
      <NemesisModel
        isWalking={isWalking}
        isAttacking={isAttacking}
        attackVariant={attackVariant}
        isDying={isDying}
      />
      {isAttacking && <EnemyMeleeAttackRangeRing radius={NEMESIS_MELEE_ATTACK_RANGE} />}
      <Billboard position={[0, 2.8, 0]}>
        {health > 0 && !isDying && (
          <>
            <EnemyHpBarPlanes fillRef={hpFillRef} backgroundColor={theme.background} fillColor={theme.fill} />
            <EnemyHealthBarTextLabel
              leading="HP"
              numericRef={hpTextRef}
              health={health}
              maxHealth={maxHealth}
              fontSize={0.16}
              color={theme.text}
            />
            <EnemyStaggerBar enemyId={id} stagger={staggerBuildup} width={ENEMY_HP_BAR_WIDTH * 1.2} />
          </>
        )}
      </Billboard>
    </group>
  );
}
