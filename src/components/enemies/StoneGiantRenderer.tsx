'use client';

import { type Position3 } from '@/utils/position3';
import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import StoneGiantModel from './StoneGiantModel';
import EnemyStaggerBar from './EnemyStaggerBar';
import EnemyMeleeAttackRangeRing, { TITAN_MELEE_ATTACK_RANGE } from './EnemyMeleeAttackRangeRing';
import { parseMeleeTelegraphPayload, meleeAttackDurationFromTelegraph, type MeleeTelegraphVisual } from '@/utils/meleeTelegraphVisual';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation, updateEnemyWalkStateFromMoveDist } from '@/utils/enemyLiveTransform';
import { applyDungeonFeetY } from '@/utils/dungeonLayout';
import { campHpTheme } from '@/utils/campHpTheme';
import {
  applyEnemyHealthBarFill,
  syncEnemyHealthBarFillFromRef,
  syncEnemyHealthBarNumericTextFromRef,
} from '@/utils/enemyHealthBar';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';
import { getEnemyDisplayName } from '@/utils/enemyDisplayNames';
import EnemyHpBarPlanes from './EnemyHpBarPlanes';

interface StoneGiantRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  staggerBuildup?: number;
}

const ATTACK_DURATION = 1740;
const HP_BAR_WIDTH = 4.2;
const LERP_SPEED = 8;
const WALK_STOP_DELAY = 300;

function StoneGiantRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  staggerBuildup = 0,
}: StoneGiantRendererProps) {
  const theme = campHpTheme(campType);
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [isAttacking, setIsAttacking] = useState(false);
  const [meleeTelegraph, setMeleeTelegraph] = useState<MeleeTelegraphVisual | null>(null);
  const [isWalking, setIsWalking] = useState(false);
  const [attackVariant, setAttackVariant] = useState<1 | 2>(1);

  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const isAttackingRef = useRef(false);
  const isWalkingRef = useRef(false);
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
    const handleTelegraph = (data: {
      stoneGiantId: string;
      attackVariant?: 1 | 2;
      hitDelayMs?: number;
      swingLockMs?: number;
      attackRange?: number;
      arcDeg?: number;
      facing?: number;
      weightClass?: string;
      timestamp?: number;
    }) => {
      if (data.stoneGiantId !== id) return;
      setAttackVariant(data.attackVariant === 2 ? 2 : 1);
      const visual = parseMeleeTelegraphPayload(data, TITAN_MELEE_ATTACK_RANGE, ATTACK_DURATION);
      setMeleeTelegraph(visual);
      setIsAttacking(true);
      isAttackingRef.current = true;
      isWalkingRef.current = false;
      setIsWalking(false);
      const duration = meleeAttackDurationFromTelegraph(visual, ATTACK_DURATION);
      trackTimeout(() => {
        setIsAttacking(false);
        setMeleeTelegraph(null);
        isAttackingRef.current = false;
        isWalkingRef.current = true;
        setIsWalking(true);
      }, duration);
    };

    const handleStoneGiantWhiff = (data: { stoneGiantId: string }) => {
      if (data.stoneGiantId !== id) return;
      setMeleeTelegraph((prev) => (prev ? { ...prev, whiffed: true } : prev));
    };
    socket.on('stone-giant-attack-telegraph', handleTelegraph);
    socket.on('stone-giant-attack-whiff', handleStoneGiantWhiff);
    return () => {
      socket.off('stone-giant-attack-telegraph', handleTelegraph);
      socket.off('stone-giant-attack-whiff', handleStoneGiantWhiff);
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
    applyDungeonFeetY(group.position);
    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);
    syncEnemyVisualRotation(id, enemyVisualRotationsRef, group.rotation.y);
  });

  return (
    <group ref={setGroupRef}>
      <StoneGiantModel
        isWalking={isWalking}
        isAttacking={isAttacking}
        attackVariant={attackVariant}
        isDying={isDying}
      />
      {isAttacking && (
        <EnemyMeleeAttackRangeRing
          radius={meleeTelegraph?.attackRange ?? TITAN_MELEE_ATTACK_RANGE}
          hitDelayMs={meleeTelegraph?.hitDelayMs}
          swingLockMs={meleeTelegraph?.swingLockMs}
          arcDeg={meleeTelegraph?.arcDeg}
          facing={meleeTelegraph?.facing}
          weightClass={meleeTelegraph?.weightClass}
          whiffed={meleeTelegraph?.whiffed}
          startedAtMs={meleeTelegraph?.startedAtMs}
          commitAtMs={meleeTelegraph?.commitAtMs}
        />
      )}
      <Billboard position={[0, 5.5, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            <EnemyHpBarPlanes
              fillRef={hpFillRef}
              backgroundColor={theme.background}
              fillColor={theme.fill}
            />
            <EnemyHealthBarTextLabel
              name={getEnemyDisplayName('stone-giant')}
              numericRef={hpTextRef}
              health={health}
              maxHealth={maxHealth}
              fontSize={0.18}
              color={theme.text}
            />
            <EnemyStaggerBar enemyId={id} stagger={staggerBuildup} width={HP_BAR_WIDTH * 1.2} />
          </>
        )}
      </Billboard>
    </group>
  );
}

export default React.memo(StoneGiantRenderer);
