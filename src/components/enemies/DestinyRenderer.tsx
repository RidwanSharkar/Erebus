'use client';

import { positionScratch, type Position3 } from '@/utils/position3';
import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import DestinyModel from './DestinyModel';
import EnemyMeleeAttackRangeRing, { DESTINY_MELEE_ATTACK_RANGE } from './EnemyMeleeAttackRangeRing';
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
import EnemyHpBarPlanes from './EnemyHpBarPlanes';
import { STAGGER_MAX_BOSS } from '@/utils/talents';
import {
  DESTINY_FLY_ATTACK_CAST_MS,
  isDestinyAirPhase,
  type DestinyPhase,
} from '@/utils/destinyCoopConstants';

interface DestinyRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  staggerBuildup?: number;
  destinyPhase?: DestinyPhase;
}

const ATTACK_DURATION = 1500; // matches backend DESTINY_SWING_LOCK_MS
const BREATH_DURATION_MS = 2000; // matches DESTINY_BREATH_ROAR_CAST_LOCK_MS
/** Short pulse when an air firebolt arrives without a prior telegraph. */
const FLY_ATTACK_FIREBOLT_PULSE_MS = 500;
const FADE_DURATION = 1.5;
const LERP_SPEED = 14;
const WALK_STOP_DELAY = 250;
const VISUAL_SCALE = 1.8;
const HP_BAR_Y_GROUND = 4.2;
const HP_BAR_Y_AIR = 2.4;

export default function DestinyRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  staggerBuildup = 0,
  destinyPhase: initialPhase = 'ground',
}: DestinyRendererProps) {
  const theme = campHpTheme(campType);
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [phase, setPhase] = useState<DestinyPhase>(initialPhase);
  const [isWalking, setIsWalking] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);
  const [meleeTelegraph, setMeleeTelegraph] = useState<MeleeTelegraphVisual | null>(null);
  const [isBreathing, setIsBreathing] = useState(false);
  const [isFlyAttacking, setIsFlyAttacking] = useState(false);
  const [swipeVariant, setSwipeVariant] = useState<1 | 2>(1);

  const isWalkingRef = useRef(false);
  const isAttackingRef = useRef(false);
  const isBreathingRef = useRef(false);
  const isFlyAttackingRef = useRef(false);
  const phaseRef = useRef<DestinyPhase>(initialPhase);
  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const lastMoveTimeRef = useRef(0);
  const attackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const breathFailsafeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flyAttackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);
  const isDyingRef = useRef(isDying);

  useEffect(() => {
    isDyingRef.current = isDying;
  }, [isDying]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const restoreWalkIfUnlocked = () => {
    if (
      !isAttackingRef.current &&
      !isBreathingRef.current &&
      !isFlyAttackingRef.current &&
      !isDyingRef.current &&
      phaseRef.current === 'ground'
    ) {
      isWalkingRef.current = true;
      setIsWalking(true);
    }
  };

  const startFlyAttackAnim = useCallback((durationMs: number = DESTINY_FLY_ATTACK_CAST_MS) => {
    if (flyAttackTimer.current) clearTimeout(flyAttackTimer.current);
    // Cancel any lingering ground breath so roar cannot stick through air volleys.
    if (breathFailsafeTimer.current) {
      clearTimeout(breathFailsafeTimer.current);
      breathFailsafeTimer.current = null;
    }
    setIsBreathing(false);
    isBreathingRef.current = false;
    setIsAttacking(false);
    isAttackingRef.current = false;
    setPhase('fly_attack');
    phaseRef.current = 'fly_attack';
    setIsFlyAttacking(true);
    isFlyAttackingRef.current = true;
    isWalkingRef.current = false;
    setIsWalking(false);
    flyAttackTimer.current = setTimeout(() => {
      setIsFlyAttacking(false);
      isFlyAttackingRef.current = false;
    }, durationMs);
  }, []);

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []);

  useEffect(() => {
    const dist = targetPosition.current.distanceTo(positionScratch.set(position.x, position.y, position.z));
    const locked = isAttackingRef.current || isBreathingRef.current || isFlyAttackingRef.current;
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
      if (flyAttackTimer.current) clearTimeout(flyAttackTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleDestinyTelegraph = (data: {
      destinyId?: string;
      swipeVariant?: 1 | 2;
      hitDelayMs?: number;
      swingLockMs?: number;
      attackRange?: number;
      arcDeg?: number;
      facing?: number;
      weightClass?: string;
      timestamp?: number;
    }) => {
      if (data.destinyId !== id) return;
      if (isBreathingRef.current || isFlyAttackingRef.current) return;
      if (phaseRef.current !== 'ground') return;
      if (attackTimer.current) clearTimeout(attackTimer.current);
      setSwipeVariant(data.swipeVariant === 2 ? 2 : 1);
      const visual = parseMeleeTelegraphPayload(data, DESTINY_MELEE_ATTACK_RANGE / VISUAL_SCALE, ATTACK_DURATION);
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

    const handleDestinyWhiff = (data: { destinyId?: string }) => {
      if (data.destinyId !== id) return;
      setMeleeTelegraph((prev) => (prev ? { ...prev, whiffed: true } : prev));
    };

    const clearBreathFailsafe = () => {
      if (breathFailsafeTimer.current) {
        clearTimeout(breathFailsafeTimer.current);
        breathFailsafeTimer.current = null;
      }
    };

    const handleBreathTelegraph = (data: {
      destinyId?: string;
      durationMs?: number;
    }) => {
      if (data.destinyId !== id) return;
      if (phaseRef.current !== 'ground') return;
      if (attackTimer.current) {
        clearTimeout(attackTimer.current);
        attackTimer.current = null;
      }
      setIsAttacking(false);
      setMeleeTelegraph(null);
      isAttackingRef.current = false;
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

    const handleBreathEnd = (data: { destinyId?: string }) => {
      if (data.destinyId !== id) return;
      clearBreathFailsafe();
      setIsBreathing(false);
      isBreathingRef.current = false;
      restoreWalkIfUnlocked();
    };

    const handleTakeoff = (data: { destinyId?: string }) => {
      if (data.destinyId !== id) return;
      if (attackTimer.current) {
        clearTimeout(attackTimer.current);
        attackTimer.current = null;
      }
      clearBreathFailsafe();
      setIsAttacking(false);
      isAttackingRef.current = false;
      setIsBreathing(false);
      isBreathingRef.current = false;
      setIsFlyAttacking(false);
      isFlyAttackingRef.current = false;
      isWalkingRef.current = false;
      setIsWalking(false);
      setPhase('takeoff');
      phaseRef.current = 'takeoff';
    };

    const handleFlyAttack = (data: { destinyId?: string; durationMs?: number }) => {
      if (data.destinyId !== id) return;
      startFlyAttackAnim(data.durationMs ?? DESTINY_FLY_ATTACK_CAST_MS);
    };

    /** Fallback: air firebolts should still trigger flyIdleAttack if telegraph was missed. */
    const handleAirFirebolt = (data: { destinyId?: string; fromAir?: boolean }) => {
      if (data.destinyId !== id) return;
      if (!data.fromAir) return;
      if (!isDestinyAirPhase(phaseRef.current)) return;
      if (isFlyAttackingRef.current) return;
      startFlyAttackAnim(FLY_ATTACK_FIREBOLT_PULSE_MS);
    };

    const handleLand = (data: { destinyId?: string }) => {
      if (data.destinyId !== id) return;
      if (flyAttackTimer.current) {
        clearTimeout(flyAttackTimer.current);
        flyAttackTimer.current = null;
      }
      setIsFlyAttacking(false);
      isFlyAttackingRef.current = false;
      setIsBreathing(false);
      isBreathingRef.current = false;
      setPhase('land');
      phaseRef.current = 'land';
    };

    socket.on('destiny-attack-telegraph', handleDestinyTelegraph);
    socket.on('destiny-attack-whiff', handleDestinyWhiff);
    socket.on('destiny-breath-telegraph', handleBreathTelegraph);
    socket.on('destiny-breath-end', handleBreathEnd);
    socket.on('destiny-takeoff-start', handleTakeoff);
    socket.on('destiny-fly-attack-telegraph', handleFlyAttack);
    socket.on('destiny-breath-firebolt', handleAirFirebolt);
    socket.on('destiny-land-start', handleLand);
    return () => {
      socket.off('destiny-attack-telegraph', handleDestinyTelegraph);
      socket.off('destiny-attack-whiff', handleDestinyWhiff);
      socket.off('destiny-breath-telegraph', handleBreathTelegraph);
      socket.off('destiny-breath-end', handleBreathEnd);
      socket.off('destiny-takeoff-start', handleTakeoff);
      socket.off('destiny-fly-attack-telegraph', handleFlyAttack);
      socket.off('destiny-breath-firebolt', handleAirFirebolt);
      socket.off('destiny-land-start', handleLand);
    };
  }, [id, socket, startFlyAttackAnim]);

  useLayoutEffect(() => {
    applyEnemyHealthBarFill(hpFillRef.current, health, maxHealth);
  }, [health, maxHealth]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;
    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

    // Sync phase from live enemy ref (enemies-moved batch).
    const live = enemiesRef.current.get(id) as { destinyPhase?: DestinyPhase } | undefined;
    if (live?.destinyPhase && live.destinyPhase !== phaseRef.current && !isFlyAttackingRef.current) {
      const next = live.destinyPhase;
      phaseRef.current = next;
      setPhase(next);
      if (next === 'ground') {
        setIsFlyAttacking(false);
        isFlyAttackingRef.current = false;
      } else if (next === 'fly_attack') {
        // Phase arrived via enemies-moved before (or without) telegraph — still play flyIdleAttack.
        startFlyAttackAnim(DESTINY_FLY_ATTACK_CAST_MS);
      }
    }

    const airPhase = isDestinyAirPhase(phaseRef.current);
    const locked =
      isAttackingRef.current ||
      isBreathingRef.current ||
      isFlyAttackingRef.current;

    let dist = 0;
    if (!locked) {
      dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);
      if (dist > 5.0) {
        group.position.copy(targetPosition.current);
      }
    }

    if (!airPhase) {
      updateEnemyWalkStateFromMoveDist(
        dist,
        locked,
        isDying,
        WALK_STOP_DELAY,
        lastMoveTimeRef,
        isWalkingRef,
        setIsWalking,
      );
    } else if (isWalkingRef.current) {
      isWalkingRef.current = false;
      setIsWalking(false);
    }

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

  const hpBarY = isDestinyAirPhase(phase) ? HP_BAR_Y_AIR : HP_BAR_Y_GROUND;

  return (
    <group ref={setGroupRef} visible={!isDying || opacity.current > 0} scale={VISUAL_SCALE}>
      <DestinyModel
        isWalking={isWalking && !isAttacking && !isBreathing && phase === 'ground'}
        isAttacking={isAttacking && !isBreathing && phase === 'ground'}
        swipeVariant={swipeVariant}
        isBreathing={isBreathing && phase === 'ground'}
        isFlyAttacking={isFlyAttacking}
        phase={phase}
        isDying={isDying}
      />
      {isAttacking && !isDying && phase === 'ground' && (
        <EnemyMeleeAttackRangeRing
          radius={meleeTelegraph?.attackRange ?? DESTINY_MELEE_ATTACK_RANGE / VISUAL_SCALE}
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
      <Billboard position={[0, hpBarY, 0]}>
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
            <EnemyStaggerBar enemyId={id} stagger={staggerBuildup} staggerMax={STAGGER_MAX_BOSS} />
          </>
        )}
      </Billboard>
    </group>
  );
}
