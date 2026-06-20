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

const SOUL_TYPES = ['green', 'red', 'blue', 'purple'] as const;
type SoulType = typeof SOUL_TYPES[number];

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

const ATTACK_DURATION   = 1500; // ms — matches backend meleeLockUntil
const FADE_DURATION     = 2.5;
const LERP_SPEED        = 8;
const WALK_STOP_DELAY   = 300;

const THEME = {
  background: '#1a1a1a',
  fill:       '#c8b89a',
  text:       '#ffffff',
};

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
  const { socket } = useMultiplayer();
  const groupRef = useRef<Group | null>(null);

  const [isAttacking, setIsAttacking] = useState(false);
  const [isWalking, setIsWalking] = useState(true); // titans default to walk anim

  const targetPosition = useRef(position.clone());
  const targetRotation = useRef(rotation);
  const isAttackingRef = useRef(false);

  const walkStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer     = useRef(0);
  const opacity       = useRef(1);

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

    if (dist > 0.01 && !isAttackingRef.current && !isDying) {
      if (!isWalking) setIsWalking(true);
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      walkStopTimer.current = setTimeout(() => {
        if (!isAttackingRef.current) setIsWalking(false);
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

    socket.on('titan-attack-telegraph', handleTitanTelegraph);
    return () => {
      socket.off('titan-attack-telegraph', handleTitanTelegraph);
    };
  }, [id, socket]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

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
        isWalking={!isAttacking && !isDying}
        isAttacking={isAttacking}
        isDying={isDying}
      />
      {!isDying && <TitanSoulEffect soulType={soulType} />}

      {bladestormActive && !isDying && bladestormStartTime != null && (
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
              <meshBasicMaterial color={THEME.background} opacity={0.9} transparent />
            </mesh>

            <mesh position={[-(HP_BAR_WIDTH / 2) * (1 - hpFraction), 0, 0.001]}>
              <planeGeometry args={[hpFraction * HP_BAR_WIDTH, 0.26]} />
              <meshBasicMaterial color={THEME.fill} opacity={0.95} transparent />
            </mesh>

            <Text
              position={[0, 0, 0.002]}
              fontSize={0.2}
              color={THEME.text}
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
            >
              {`🗿 TITAN  ${Math.ceil(health)} / ${maxHealth}`}
            </Text>
            <EnemyStaggerBar stagger={staggerBuildup} width={HP_BAR_WIDTH} y={-0.28} />
          </>
        )}
      </Billboard>
    </group>
  );
}
