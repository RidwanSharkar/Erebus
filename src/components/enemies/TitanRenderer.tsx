'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import TitanModel from './TitanModel';
import TitanSoulEffect from './TitanSoulEffect';
import TitanBladestorm from './TitanBladestorm';
import EnemyStaggerBar from './EnemyStaggerBar';
import EnemyMeleeAttackRangeRing, { TITAN_MELEE_ATTACK_RANGE } from './EnemyMeleeAttackRangeRing';
import { useMultiplayer } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef } from '@/utils/enemyLiveTransform';
import { campHpTheme } from '@/utils/campHpTheme';

const SOUL_TYPES = ['green', 'red', 'blue', 'purple'] as const;
type SoulType = typeof SOUL_TYPES[number];

const TITAN_DISPLAY_NAMES: Record<SoulType, string> = {
  blue:   'STORM TITAN',
  purple: 'TITAN OF MERCY',
  red:    'TITAN OF WRATH',
  green:  'PLAGUE TITAN',
};

interface TitanRendererProps {
  id: string;
  position: Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  soulType?: SoulType;
  isDying?: boolean;
  staggerBuildup?: number;
  bladestormActive?: boolean;
  bladestormStartTime?: number;
}

const ATTACK_DURATION        = 1500; // ms — matches backend meleeLockUntil
const POWERUP_DURATION       = 1500; // ms — bladestorm windup
const STOMP_DURATION         = 1000; // ms — stomp windup
const FADE_DURATION          = 2.5;
const LERP_SPEED             = 8;
const WALK_STOP_DELAY        = 300;

const HP_BAR_WIDTH = 3.0;

export default function TitanRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  soulType = 'green',
  isDying = false,
  staggerBuildup = 0,
  bladestormActive = false,
  bladestormStartTime,
}: TitanRendererProps) {
  const theme = campHpTheme(soulType);
  const { socket, enemyTransformsRef } = useMultiplayer();
  const groupRef = useRef<Group | null>(null);

  const [isAttacking, setIsAttacking] = useState(false);
  const [isPoweringUp, setIsPoweringUp] = useState(false);
  const [isStomping, setIsStomping] = useState(false);
  const [isWalking, setIsWalking] = useState(true);

  const targetPosition = useRef(position.clone());
  const targetRotation = useRef(rotation);
  const isAttackingRef = useRef(false);
  const isPoweringUpRef = useRef(false);
  const isStompingRef = useRef(false);

  const walkStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer     = useRef(0);
  const opacity       = useRef(1);

  const isAnimLocked = () =>
    isAttackingRef.current || isPoweringUpRef.current || isStompingRef.current;

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const dist = targetPosition.current.distanceTo(position);
    targetPosition.current.copy(position);

    if (dist > 15.0 && groupRef.current) {
      groupRef.current.position.copy(position);
    }

    if (dist > 0.01 && !isAnimLocked() && !isDying) {
      if (!isWalking) setIsWalking(true);
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      walkStopTimer.current = setTimeout(() => {
        if (!isAnimLocked()) setIsWalking(false);
      }, WALK_STOP_DELAY);
    }
  }, [position.x, position.y, position.z]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (walkStopTimer.current) clearTimeout(walkStopTimer.current); };
  }, []);

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  // Titan melee attack telegraph from server.
  useEffect(() => {
    if (!socket) return;

    const handleTitanTelegraph = (data: { titanId: string }) => {
      if (data.titanId !== id) return;
      setIsAttacking(true);
      isAttackingRef.current = true;
      setIsWalking(false);
      setTimeout(() => {
        setIsAttacking(false);
        isAttackingRef.current = false;
        setIsWalking(true);
      }, ATTACK_DURATION);
    };

    const handleBladestormPowerup = (data: { titanId: string }) => {
      if (data.titanId !== id) return;
      setIsPoweringUp(true);
      isPoweringUpRef.current = true;
      setIsWalking(false);
      setTimeout(() => {
        setIsPoweringUp(false);
        isPoweringUpRef.current = false;
        if (!isAnimLocked()) setIsWalking(true);
      }, POWERUP_DURATION);
    };

    const handleStompStart = (data: { titanId: string }) => {
      if (data.titanId !== id) return;
      setIsStomping(true);
      isStompingRef.current = true;
      setIsWalking(false);
      setTimeout(() => {
        setIsStomping(false);
        isStompingRef.current = false;
        if (!isAnimLocked()) setIsWalking(true);
      }, STOMP_DURATION);
    };

    socket.on('titan-attack-telegraph', handleTitanTelegraph);
    socket.on('titan-bladestorm-powerup-start', handleBladestormPowerup);
    socket.on('titan-stomp-start', handleStompStart);
    return () => {
      socket.off('titan-attack-telegraph', handleTitanTelegraph);
      socket.off('titan-bladestorm-powerup-start', handleBladestormPowerup);
      socket.off('titan-stomp-start', handleStompStart);
    };
  }, [id, socket]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);

    group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));

    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle >  Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);

    if (isDying) {
      fadeTimer.current += delta;
      opacity.current = Math.max(0, 1 - fadeTimer.current / FADE_DURATION);
      group.traverse((child: any) => {
        if (child.isMesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat: any) => {
            mat.transparent = true;
            mat.opacity = opacity.current;
          });
        }
      });
    }
  });

  const hpFraction = health / maxHealth;

  return (
    <group ref={setGroupRef} visible={!isDying || opacity.current > 0}>
      <TitanModel
        isWalking={!isAttacking && !isPoweringUp && !isStomping && !isDying}
        isAttacking={isAttacking}
        isPoweringUp={isPoweringUp}
        isStomping={isStomping}
        isDying={isDying}
      />
      {!isDying && <TitanSoulEffect soulType={soulType} />}

      {bladestormActive && !isDying && !isPoweringUp && bladestormStartTime != null && (
        <TitanBladestorm soulType={soulType} startTime={bladestormStartTime} />
      )}

      {isAttacking && (
        <EnemyMeleeAttackRangeRing radius={TITAN_MELEE_ATTACK_RANGE} />
      )}

      <Billboard position={[0, 6.25, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[HP_BAR_WIDTH, 0.28]} />
              <meshBasicMaterial color={theme.background} opacity={0.9} transparent />
            </mesh>

            <mesh position={[-(HP_BAR_WIDTH / 2) * (1 - hpFraction), 0, 0.001]}>
              <planeGeometry args={[hpFraction * HP_BAR_WIDTH, 0.26]} />
              <meshBasicMaterial color={theme.fill} opacity={0.95} transparent />
            </mesh>

            <Text
              position={[0, 0, 0.002]}
              fontSize={0.2}
              color={theme.text}
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
            >
              {`${TITAN_DISPLAY_NAMES[soulType]}  ${Math.ceil(health)} / ${maxHealth}`}
            </Text>
            <EnemyStaggerBar stagger={staggerBuildup} width={HP_BAR_WIDTH} y={-0.28} />
          </>
        )}
      </Billboard>
    </group>
  );
}
