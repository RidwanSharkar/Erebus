'use client';

import { positionScratch, type Position3 } from '@/utils/position3';
import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import WyvernModel from './WyvernModel';
import SpellChargeFlare from './SpellChargeFlare';
import EnemyMeleeAttackRangeRing, { WYVERN_MELEE_ATTACK_RANGE } from './EnemyMeleeAttackRangeRing';
import { parseMeleeTelegraphPayload, meleeAttackDurationFromTelegraph, type MeleeTelegraphVisual } from '@/utils/meleeTelegraphVisual';
import EnemyStaggerBar from './EnemyStaggerBar';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyRotationFromRef, syncEnemyVisualRotation, updateEnemyWalkStateFromMoveDist } from '@/utils/enemyLiveTransform';
import { detachSharedMaterialsForMutation } from '@/utils/sharedEnemyMaterials';
import { campHpTheme } from '@/utils/campHpTheme';
import {
  applyEnemyHealthBarFill,
  syncEnemyHealthBarFillFromRef,
  syncEnemyHealthBarNumericTextFromRef,
} from '@/utils/enemyHealthBar';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';
import { getEnemyDisplayName } from '@/utils/enemyDisplayNames';
import EnemyHpBarPlanes from './EnemyHpBarPlanes';

interface WyvernRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  staggerBuildup?: number;
}

const ATTACK_DURATION = 1500; // ms — matches backend WYVERN_SWING_LOCK_MS
const BREATH_DURATION_MS = 1500; // matches backend WYVERN_BREATH_CAST_LOCK_MS (variant 1); roar uses 2000 via durationMs
const BREATH_LAUNCH_EARLY_MS = 400; // matches backend WYVERN_BREATH_LAUNCH_EARLY_MS
const FADE_DURATION = 1.5;
const LERP_SPEED = 14;
const WALK_STOP_DELAY = 250;

function WyvernRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  staggerBuildup = 0,
}: WyvernRendererProps) {
  const theme = campHpTheme(campType);
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [isWalking, setIsWalking] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);
  const [meleeTelegraph, setMeleeTelegraph] = useState<MeleeTelegraphVisual | null>(null);
  const [isBreathing, setIsBreathing] = useState(false);
  const [breathVariant, setBreathVariant] = useState<1 | 2>(1);
  const [roarFlare, setRoarFlare] = useState<{ playKey: number; chargeMs: number } | null>(null);

  const isWalkingRef = useRef(false);
  const isAttackingRef = useRef(false);
  const isBreathingRef = useRef(false);
  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const lastMoveTimeRef = useRef(0);
  const attackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const breathFailsafeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);
  const isDyingRef = useRef(isDying);

  useEffect(() => {
    isDyingRef.current = isDying;
  }, [isDying]);

  const restoreWalkIfUnlocked = () => {
    if (!isAttackingRef.current && !isBreathingRef.current && !isDyingRef.current) {
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
    const locked = isAttackingRef.current || isBreathingRef.current;
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
      if (breathFailsafeTimer.current) clearTimeout(breathFailsafeTimer.current);
    };
  }, []);

  // Melee + breath animations — driven by server telegraphs.
  useEffect(() => {
    if (!socket) return;

    const handleWyvernTelegraph = (data: {
      wyvernId?: string;
      hitDelayMs?: number;
      swingLockMs?: number;
      attackRange?: number;
      arcDeg?: number;
      facing?: number;
      weightClass?: string;
      timestamp?: number;
    }) => {
      if (data.wyvernId !== id) return;
      if (isBreathingRef.current) return;
      if (attackTimer.current) clearTimeout(attackTimer.current);
      const visual = parseMeleeTelegraphPayload(data, WYVERN_MELEE_ATTACK_RANGE, ATTACK_DURATION);
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

    const handleWyvernWhiff = (data: { wyvernId?: string }) => {
      if (data.wyvernId !== id) return;
      setMeleeTelegraph((prev) => (prev ? { ...prev, whiffed: true } : prev));
    };

    const clearBreathFailsafe = () => {
      if (breathFailsafeTimer.current) {
        clearTimeout(breathFailsafeTimer.current);
        breathFailsafeTimer.current = null;
      }
    };

    const handleBreathTelegraph = (data: {
      wyvernId?: string;
      breathVariant?: 1 | 2;
      durationMs?: number;
    }) => {
      if (data.wyvernId !== id) return;
      if (attackTimer.current) {
        clearTimeout(attackTimer.current);
        attackTimer.current = null;
      }
      setIsAttacking(false);
      setMeleeTelegraph(null);
      isAttackingRef.current = false;
      setBreathVariant(data.breathVariant === 2 ? 2 : 1);
      if (data.breathVariant === 2) {
        const chargeMs = Math.max(0, (data.durationMs ?? BREATH_DURATION_MS) - BREATH_LAUNCH_EARLY_MS);
        setRoarFlare((prev) => ({ playKey: (prev?.playKey ?? 0) + 1, chargeMs }));
      }
      setIsBreathing(true);
      isBreathingRef.current = true;
      isWalkingRef.current = false;
      setIsWalking(false);
      clearBreathFailsafe();
      const duration = data.durationMs ?? BREATH_DURATION_MS;
      breathFailsafeTimer.current = setTimeout(() => {
        setIsBreathing(false);
        isBreathingRef.current = false;
        restoreWalkIfUnlocked();
      }, duration + 250);
    };

    const handleBreathEnd = (data: { wyvernId?: string }) => {
      if (data.wyvernId !== id) return;
      clearBreathFailsafe();
      setIsBreathing(false);
      isBreathingRef.current = false;
      restoreWalkIfUnlocked();
    };

    socket.on('wyvern-attack-telegraph', handleWyvernTelegraph);
    socket.on('wyvern-attack-whiff', handleWyvernWhiff);
    socket.on('wyvern-breath-telegraph', handleBreathTelegraph);
    socket.on('wyvern-breath-end', handleBreathEnd);
    return () => {
      socket.off('wyvern-attack-telegraph', handleWyvernTelegraph);
      socket.off('wyvern-attack-whiff', handleWyvernWhiff);
      socket.off('wyvern-breath-telegraph', handleBreathTelegraph);
      socket.off('wyvern-breath-end', handleBreathEnd);
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

    const movementLocked = isAttackingRef.current || isBreathingRef.current;
    let dist = 0;
    if (isBreathingRef.current) {
      syncEnemyRotationFromRef(id, enemyTransformsRef, targetRotation);
    } else if (!movementLocked) {
      dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);
      if (dist > 5.0) {
        group.position.copy(targetPosition.current);
      }
    }

    updateEnemyWalkStateFromMoveDist(
      dist,
      movementLocked,
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
        detachSharedMaterialsForMutation(group);
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
      <WyvernModel
        isWalking={isWalking && !isAttacking && !isBreathing}
        isAttacking={isAttacking && !isBreathing}
        isBreathing={isBreathing}
        breathVariant={breathVariant}
        isDying={isDying}
      />
      {roarFlare && (
        <SpellChargeFlare
          playKey={roarFlare.playKey}
          color="#ff5500"
          accentColor="#ffcc55"
          chargeMs={roarFlare.chargeMs}
          flareMs={340}
          offset={[0, 1.9, 1.6]}
          scale={1.6}
        />
      )}
      {isAttacking && !isDying && (
        <EnemyMeleeAttackRangeRing
          radius={meleeTelegraph?.attackRange ?? WYVERN_MELEE_ATTACK_RANGE}
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
      <Billboard position={[0, 3.5, 0]}>
        {health > 0 && !isDying && (
          <>
            <EnemyHpBarPlanes fillRef={hpFillRef} backgroundColor={theme.background} fillColor={theme.fill} />
            <EnemyHealthBarTextLabel
              name={getEnemyDisplayName('wyvern')}
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

export default React.memo(WyvernRenderer);
