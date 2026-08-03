'use client';

import { positionScratch, type Position3 } from '@/utils/position3';
import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import SpectreModel from './SpectreModel';
import EnemyMeleeAttackRangeRing, { SPECTRE_MELEE_ATTACK_RANGE } from './EnemyMeleeAttackRangeRing';
import { parseMeleeTelegraphPayload, meleeAttackDurationFromTelegraph, type MeleeTelegraphVisual } from '@/utils/meleeTelegraphVisual';
import EnemyStaggerBar from './EnemyStaggerBar';
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

interface SpectreRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  staggerBuildup?: number;
}

const ATTACK_DURATION = 1200; // ms — matches backend meleeLockUntil / attack clip window
const WHIRLWIND_DURATION_MS = 5000;
const WHIRLWIND_RADIUS = 3;
const FADE_DURATION = 1.5;
const LERP_SPEED = 14;
const WALK_STOP_DELAY = 250;

export default function SpectreRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  staggerBuildup = 0,
}: SpectreRendererProps) {
  const theme = campHpTheme(campType);
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [isWalking, setIsWalking] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);
  const [meleeTelegraph, setMeleeTelegraph] = useState<MeleeTelegraphVisual | null>(null);
  const [isWhirlwinding, setIsWhirlwinding] = useState(false);
  const [attackVariant, setAttackVariant] = useState<1 | 2>(1);

  const isWalkingRef = useRef(false);
  const isAttackingRef = useRef(false);
  const isWhirlwindingRef = useRef(false);
  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const lastMoveTimeRef = useRef(0);
  const attackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const whirlwindFailsafeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);
  const isDyingRef = useRef(isDying);

  useEffect(() => {
    isDyingRef.current = isDying;
  }, [isDying]);

  const restoreWalkIfUnlocked = () => {
    if (!isAttackingRef.current && !isWhirlwindingRef.current && !isDyingRef.current) {
      isWalkingRef.current = true;
      setIsWalking(true);
    }
  };

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []);

  useEffect(() => {
    const dist = targetPosition.current.distanceTo(positionScratch.set(position.x, position.y, position.z));
    const locked = isAttackingRef.current;
    if (!locked) targetPosition.current.set(position.x, position.y, position.z);
    if (dist > 5.0 && groupRef.current && !locked) {
      groupRef.current.position.set(position.x, position.y, position.z);
    }
  }, [position.x, position.y, position.z]);

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useEffect(() => {
    return () => {
      if (attackTimer.current) clearTimeout(attackTimer.current);
      if (whirlwindFailsafeTimer.current) clearTimeout(whirlwindFailsafeTimer.current);
    };
  }, []);

  // Attack animation — driven by server telegraph; alternate attack0 / attack1.
  useEffect(() => {
    if (!socket) return;

    const handleSpectreTelegraph = (data: {
      spectreId?: string;
      attackVariant?: 1 | 2;
      hitDelayMs?: number;
      swingLockMs?: number;
      attackRange?: number;
      arcDeg?: number;
      facing?: number;
      weightClass?: string;
      timestamp?: number;
    }) => {
      if (data.spectreId !== id) return;
      if (isWhirlwindingRef.current) return;
      if (attackTimer.current) clearTimeout(attackTimer.current);
      setAttackVariant(data.attackVariant === 2 ? 2 : 1);
      const visual = parseMeleeTelegraphPayload(data, SPECTRE_MELEE_ATTACK_RANGE, ATTACK_DURATION);
      setMeleeTelegraph(visual);
      setIsAttacking(true);
      isAttackingRef.current = true;
      isWalkingRef.current = false;
      setIsWalking(false);
      const duration = meleeAttackDurationFromTelegraph(visual, ATTACK_DURATION);
      attackTimer.current = setTimeout(() => {
        setIsAttacking(false);
        setMeleeTelegraph(null);
        isAttackingRef.current = false;
        restoreWalkIfUnlocked();
      }, duration);
    };

    const handleSpectreWhiff = (data: { spectreId?: string }) => {
      if (data.spectreId !== id) return;
      setMeleeTelegraph((prev) => (prev ? { ...prev, whiffed: true } : prev));
    };

    const clearWhirlwindFailsafe = () => {
      if (whirlwindFailsafeTimer.current) {
        clearTimeout(whirlwindFailsafeTimer.current);
        whirlwindFailsafeTimer.current = null;
      }
    };

    const handleWhirlwindStart = (data: { spectreId?: string; durationMs?: number }) => {
      if (data.spectreId !== id) return;
      if (attackTimer.current) {
        clearTimeout(attackTimer.current);
        attackTimer.current = null;
      }
      setIsAttacking(false);
      setMeleeTelegraph(null);
      isAttackingRef.current = false;
      setIsWhirlwinding(true);
      isWhirlwindingRef.current = true;
      isWalkingRef.current = false;
      setIsWalking(false);
      clearWhirlwindFailsafe();
      const duration = data.durationMs ?? WHIRLWIND_DURATION_MS;
      whirlwindFailsafeTimer.current = setTimeout(() => {
        setIsWhirlwinding(false);
        isWhirlwindingRef.current = false;
        restoreWalkIfUnlocked();
      }, duration + 250);
    };

    const handleWhirlwindEnd = (data: { spectreId?: string }) => {
      if (data.spectreId !== id) return;
      clearWhirlwindFailsafe();
      setIsWhirlwinding(false);
      isWhirlwindingRef.current = false;
      restoreWalkIfUnlocked();
    };

    socket.on('spectre-attack-telegraph', handleSpectreTelegraph);
    socket.on('spectre-attack-whiff', handleSpectreWhiff);
    socket.on('spectre-whirlwind-start', handleWhirlwindStart);
    socket.on('spectre-whirlwind-end', handleWhirlwindEnd);
    return () => {
      socket.off('spectre-attack-telegraph', handleSpectreTelegraph);
      socket.off('spectre-attack-whiff', handleSpectreWhiff);
      socket.off('spectre-whirlwind-start', handleWhirlwindStart);
      socket.off('spectre-whirlwind-end', handleWhirlwindEnd);
    };
  }, [id, socket]);

  useLayoutEffect(() => {
    applyEnemyHealthBarFill(hpFillRef.current, health, maxHealth);
  }, [health, maxHealth]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;
    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

    // Melee swings lock transform; whirlwind does not (server still moves the unit).
    const locked = isAttackingRef.current;
    let dist = 0;
    if (!locked) {
      dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);
      if (dist > 5.0) {
        group.position.copy(targetPosition.current);
      }
    }

    updateEnemyWalkStateFromMoveDist(
      dist,
      locked || isWhirlwindingRef.current,
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
      cachedDeathMats.current.forEach((mat) => {
        mat.opacity = opacity.current;
      });
    }
  });

  return (
    <group ref={setGroupRef} visible={!isDying || opacity.current > 0}>
      <SpectreModel
        isWalking={isWalking && !isAttacking && !isWhirlwinding}
        isAttacking={isAttacking && !isWhirlwinding}
        attackVariant={attackVariant}
        isWhirlwinding={isWhirlwinding}
        isDying={isDying}
      />
      {isAttacking && !isWhirlwinding && !isDying && (
        <EnemyMeleeAttackRangeRing
          radius={meleeTelegraph?.attackRange ?? SPECTRE_MELEE_ATTACK_RANGE}
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
      {isWhirlwinding && !isDying && <EnemyMeleeAttackRangeRing radius={WHIRLWIND_RADIUS} />}
      <Billboard position={[0, 3.2, 0]}>
        {health > 0 && !isDying && (
          <>
            <EnemyHpBarPlanes fillRef={hpFillRef} backgroundColor={theme.background} fillColor={theme.fill} />
            <EnemyHealthBarTextLabel
              name={getEnemyDisplayName('spectre')}
              numericRef={hpTextRef}
              health={health}
              maxHealth={maxHealth}
              fontSize={0.16}
              color={theme.text}
            />
            <EnemyStaggerBar enemyId={id} stagger={staggerBuildup} />
          </>
        )}
      </Billboard>
    </group>
  );
}
