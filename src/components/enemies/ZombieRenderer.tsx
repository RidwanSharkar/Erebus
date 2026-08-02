'use client';
import { positionScratch, type Position3 } from '@/utils/position3';

import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import ZombieModel from './ZombieModel';
import EnemyMeleeAttackRangeRing, { GHOUL_MELEE_ATTACK_RANGE } from './EnemyMeleeAttackRangeRing';
import { parseMeleeTelegraphPayload, meleeAttackDurationFromTelegraph, type MeleeTelegraphVisual } from '@/utils/meleeTelegraphVisual';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation, updateEnemyWalkStateFromMoveDist } from '@/utils/enemyLiveTransform';
import {
  ENEMY_HP_BAR_FILL_HEIGHT,
  ENEMY_HP_BAR_FILL_Z,
  applyEnemyHealthBarFill,
  syncEnemyHealthBarFillFromRef,
  syncEnemyHealthBarNumericTextFromRef,
} from '@/utils/enemyHealthBar';
import EnemyStaggerBar from './EnemyStaggerBar';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';

interface ZombieRendererProps {
  id: string;
  position: Position3;
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

const ZOMBIE_HP_BAR_WIDTH = 1.8;
const ZOMBIE_HP_BAR_HEIGHT = 0.22;
const ZOMBIE_HP_BAR_FILL_HEIGHT = 0.2;

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
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [isAttacking, setIsAttacking] = useState(false);
  const [meleeTelegraph, setMeleeTelegraph] = useState<MeleeTelegraphVisual | null>(null);
  const [isWalking, setIsWalking] = useState(false);
  const [isSummoning, setIsSummoning] = useState(true);
  const isSummoningRef = useRef(true);

  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const isAttackingRef = useRef(false);
  const isWalkingRef = useRef(false);

  const lastMoveTimeRef = useRef(0);
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
    const dist = targetPosition.current.distanceTo(positionScratch.set(position.x, position.y, position.z));
    targetPosition.current.set(position.x, position.y, position.z);

    if (dist > 8.0 && groupRef.current) {
      groupRef.current.position.set(position.x, position.y, position.z);
    }
  }, [position.x, position.y, position.z]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
    };
  }, []);

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useEffect(() => {
    if (!socket) return;

    const handleTelegraph = (data: {
      zombieId: string;
      hitDelayMs?: number;
      swingLockMs?: number;
      attackRange?: number;
      arcDeg?: number;
      facing?: number;
      weightClass?: string;
      timestamp?: number;
    }) => {
      if (data.zombieId !== id) return;
      if (isSummoningRef.current) return;
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
      const visual = parseMeleeTelegraphPayload(data, GHOUL_MELEE_ATTACK_RANGE, ATTACK_DURATION);
      setMeleeTelegraph(visual);
      setIsAttacking(true);
      isAttackingRef.current = true;
      const duration = meleeAttackDurationFromTelegraph(visual, ATTACK_DURATION);
      attackTimerRef.current = setTimeout(() => {
        setIsAttacking(false);
        setMeleeTelegraph(null);
        isAttackingRef.current = false;
        attackTimerRef.current = null;
      }, duration);
    };

    socket.on('player-zombie-attack-telegraph', handleTelegraph);
    return () => {
      socket.off('player-zombie-attack-telegraph', handleTelegraph);
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
    };
  }, [id, socket]);

  useLayoutEffect(() => {
    applyEnemyHealthBarFill(hpFillRef.current, health, maxHealth, ZOMBIE_HP_BAR_WIDTH);
  }, [health, maxHealth]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth, ZOMBIE_HP_BAR_WIDTH);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

    const dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);
    updateEnemyWalkStateFromMoveDist(
      dist,
      isAttackingRef.current || isSummoningRef.current,
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

      {isAttacking && !isDying && (
        <EnemyMeleeAttackRangeRing
          radius={meleeTelegraph?.attackRange ?? GHOUL_MELEE_ATTACK_RANGE}
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

      <Billboard position={[0, 2.8, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && !isSummoning && (
          <>
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[ZOMBIE_HP_BAR_WIDTH, ZOMBIE_HP_BAR_HEIGHT]} />
              <meshBasicMaterial color="#0a1a0a" opacity={0.9} transparent />
            </mesh>

            <mesh
              ref={hpFillRef}
              position={[-ZOMBIE_HP_BAR_WIDTH / 2, 0, ENEMY_HP_BAR_FILL_Z]}
              scale={[1, 1, 1]}
            >
              <planeGeometry args={[ZOMBIE_HP_BAR_WIDTH, ZOMBIE_HP_BAR_FILL_HEIGHT]} />
              <meshBasicMaterial color="#33aa44" opacity={0.95} transparent />
            </mesh>

            <EnemyHealthBarTextLabel
              leading="🧟"
              numericRef={hpTextRef}
              health={health}
              maxHealth={maxHealth}
              fontSize={0.16}
              color="#ccffcc"
            />
            <EnemyStaggerBar enemyId={id} stagger={staggerBuildup} />
          </>
        )}
      </Billboard>
    </group>
  );
}

export default React.memo(ZombieRenderer);
