'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import ZombieModel from './ZombieModel';
import EnemyMeleeAttackRangeRing, { GHOUL_MELEE_ATTACK_RANGE } from './EnemyMeleeAttackRangeRing';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef } from '@/utils/enemyLiveTransform';
import EnemyStaggerBar from './EnemyStaggerBar';

interface ZombieRendererProps {
  id: string;
  position: Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  staggerBuildup?: number;
  visualScale?: number;
}

const ATTACK_DURATION = 1000;
const SUMMON_DURATION = 2800;
const FADE_DURATION = 1.5;
const LERP_SPEED = 14;
const WALK_STOP_DELAY = 250;

function ZombieRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  staggerBuildup = 0,
  visualScale = 1,
}: ZombieRendererProps) {
  const { socket, enemyTransformsRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);

  const [isAttacking, setIsAttacking] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [isSummoning, setIsSummoning] = useState(true);
  const isSummoningRef = useRef(true);

  const targetPosition = useRef(position.clone());
  const targetRotation = useRef(rotation);
  const isAttackingRef = useRef(false);

  const walkStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setIsSummoning(false);
      isSummoningRef.current = false;
    }, SUMMON_DURATION);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const dist = targetPosition.current.distanceTo(position);
    targetPosition.current.copy(position);

    if (dist > 8.0 && groupRef.current) {
      groupRef.current.position.copy(position);
    }

    if (dist > 0.01 && !isAttackingRef.current && !isDying && !isSummoningRef.current) {
      if (!isWalking) setIsWalking(true);
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      walkStopTimer.current = setTimeout(() => setIsWalking(false), WALK_STOP_DELAY);
    }
  }, [position.x, position.y, position.z]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
    };
  }, []);

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useEffect(() => {
    if (!socket) return;

    const handleTelegraph = (data: { zombieId: string }) => {
      if (data.zombieId !== id) return;
      if (isSummoningRef.current) return;
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
      setIsAttacking(true);
      isAttackingRef.current = true;
      attackTimerRef.current = setTimeout(() => {
        setIsAttacking(false);
        isAttackingRef.current = false;
        attackTimerRef.current = null;
      }, ATTACK_DURATION);
    };

    socket.on('player-zombie-attack-telegraph', handleTelegraph);
    return () => {
      socket.off('player-zombie-attack-telegraph', handleTelegraph);
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
    };
  }, [id, socket]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);

    group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));

    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);

    if (isDying) {
      fadeTimer.current += delta;
      opacity.current = Math.max(0, 1 - fadeTimer.current / FADE_DURATION);

      if (!deathCacheBuilt.current) {
        const collected: any[] = [];
        group.traverse((child: any) => {
          if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((mat: any) => {
              mat.transparent = true;
              collected.push(mat);
            });
          }
        });
        cachedDeathMats.current = collected;
        deathCacheBuilt.current = true;
      }

      const op = opacity.current;
      for (let i = 0; i < cachedDeathMats.current.length; i++) {
        cachedDeathMats.current[i].opacity = op;
      }
    }
  });

  return (
    <group ref={setGroupRef} scale={[visualScale, visualScale, visualScale]} visible={!isDying || opacity.current > 0}>
      <ZombieModel
        isWalking={isWalking}
        isAttacking={isAttacking}
        isSummoning={isSummoning}
        isDying={isDying}
      />


      <Billboard position={[0, 2.8, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && !isSummoning && (
          <>
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[1.8, 0.22]} />
              <meshBasicMaterial color="#0a1a0a" opacity={0.9} transparent />
            </mesh>

            <mesh position={[-0.9 + (health / maxHealth) * 0.9, 0, 0.001]}>
              <planeGeometry args={[(health / maxHealth) * 1.8, 0.2]} />
              <meshBasicMaterial color="#33aa44" opacity={0.95} transparent />
            </mesh>

            <Text
              position={[0, 0, 0.002]}
              fontSize={0.16}
              color="#ccffcc"
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
            >
              {`🧟 ${Math.ceil(health)}/${maxHealth}`}
            </Text>
            <EnemyStaggerBar stagger={staggerBuildup} />
          </>
        )}
      </Billboard>
    </group>
  );
}

export default React.memo(ZombieRenderer);
