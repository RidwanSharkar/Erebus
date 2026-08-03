'use client';

import { type Position3 } from '@/utils/position3';
import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import EternalOakModel from './EternalOakModel';
import EnemyStaggerBar from './EnemyStaggerBar';
import EnemyMeleeAttackRangeRing, { TITAN_MELEE_ATTACK_RANGE } from './EnemyMeleeAttackRangeRing';
import { parseMeleeTelegraphPayload, meleeAttackDurationFromTelegraph, type MeleeTelegraphVisual } from '@/utils/meleeTelegraphVisual';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation, updateEnemyWalkStateFromMoveDist } from '@/utils/enemyLiveTransform';
import { campHpTheme } from '@/utils/campHpTheme';
import {
  applyEnemyHealthBarFill,
  syncEnemyHealthBarFillFromRef,
  syncEnemyHealthBarNumericTextFromRef,
} from '@/utils/enemyHealthBar';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';
import { getEnemyDisplayName } from '@/utils/enemyDisplayNames';
import EnemyHpBarPlanes from './EnemyHpBarPlanes';

interface EternalOakRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  staggerBuildup?: number;
}

const ATTACK_DURATION = 1980;
const EARTHBREAKER_DURATION = 1100;
const HP_BAR_WIDTH = 4.2;
const LERP_SPEED = 8;
const WALK_STOP_DELAY = 300;

export default function EternalOakRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  staggerBuildup = 0,
}: EternalOakRendererProps) {
  const theme = campHpTheme(campType);
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [isAttacking, setIsAttacking] = useState(false);
  const [meleeTelegraph, setMeleeTelegraph] = useState<MeleeTelegraphVisual | null>(null);
  const [isEarthbreaking, setIsEarthbreaking] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [showEarthbreakerRing, setShowEarthbreakerRing] = useState(false);

  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const isAttackingRef = useRef(false);
  const isEarthbreakingRef = useRef(false);
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
      eternalOakId: string;
      hitDelayMs?: number;
      swingLockMs?: number;
      attackRange?: number;
      arcDeg?: number;
      facing?: number;
      weightClass?: string;
      timestamp?: number;
    }) => {
      if (data.eternalOakId !== id) return;
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

    const handleEternalOakWhiff = (data: { eternalOakId: string }) => {
      if (data.eternalOakId !== id) return;
      setMeleeTelegraph((prev) => (prev ? { ...prev, whiffed: true } : prev));
    };
    const handleEarthbreaker = (data: { eternalOakId: string }) => {
      if (data.eternalOakId !== id) return;
      setIsEarthbreaking(true);
      isEarthbreakingRef.current = true;
      isAttackingRef.current = false;
      setIsAttacking(false);
      setMeleeTelegraph(null);
      isWalkingRef.current = false;
      setIsWalking(false);
      setShowEarthbreakerRing(true);
      trackTimeout(() => {
        setIsEarthbreaking(false);
        isEarthbreakingRef.current = false;
        setShowEarthbreakerRing(false);
        isWalkingRef.current = true;
        setIsWalking(true);
      }, EARTHBREAKER_DURATION);
    };
    socket.on('eternal-oak-attack-telegraph', handleTelegraph);
    socket.on('eternal-oak-attack-whiff', handleEternalOakWhiff);
    socket.on('eternal-oak-earthbreaker-start', handleEarthbreaker);
    return () => {
      socket.off('eternal-oak-attack-telegraph', handleTelegraph);
      socket.off('eternal-oak-attack-whiff', handleEternalOakWhiff);
      socket.off('eternal-oak-earthbreaker-start', handleEarthbreaker);
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
      isAttackingRef.current || isEarthbreakingRef.current,
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
      <EternalOakModel
        isWalking={isWalking}
        isAttacking={isAttacking}
        isEarthbreaking={isEarthbreaking}
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
      {showEarthbreakerRing && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[5.7, 6.0, 48]} />
          <meshBasicMaterial color="#6b8f3a" transparent opacity={0.55} depthWrite={false} />
        </mesh>
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
              name={getEnemyDisplayName('eternal-oak')}
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
