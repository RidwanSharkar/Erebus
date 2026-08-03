'use client';

import { positionScratch, type Position3 } from '@/utils/position3';
import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import TerrorhawkModel from './TerrorhawkModel';
import EnemyMeleeAttackRangeRing, { TERRORHAWK_MELEE_ATTACK_RANGE } from './EnemyMeleeAttackRangeRing';
import { parseMeleeTelegraphPayload, meleeAttackDurationFromTelegraph, type MeleeTelegraphVisual } from '@/utils/meleeTelegraphVisual';
import EnemyStaggerBar from './EnemyStaggerBar';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation } from '@/utils/enemyLiveTransform';
import { campHpTheme } from '@/utils/campHpTheme';
import {
  applyEnemyHealthBarFill,
  syncEnemyHealthBarFillFromRef,
  syncEnemyHealthBarNumericTextFromRef,
} from '@/utils/enemyHealthBar';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';
import { getEnemyDisplayName } from '@/utils/enemyDisplayNames';
import EnemyHpBarPlanes from './EnemyHpBarPlanes';
import {
  TERRORHAWK_SWING_LOCK_MS,
  type TerrorhawkPhase,
} from '@/utils/terrorhawkCoopConstants';

interface TerrorhawkRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  staggerBuildup?: number;
  terrorhawkPhase?: TerrorhawkPhase;
}

const ATTACK_DURATION = TERRORHAWK_SWING_LOCK_MS;
const FADE_DURATION = 1.5;
const LERP_SPEED = 14;
const HP_BAR_Y_GROUND = 2.08;
const HP_BAR_Y_AIR = 1.12;

function isAirPhase(phase: TerrorhawkPhase): boolean {
  return phase === 'takeoff' || phase === 'hover' || phase === 'approach' || phase === 'dive';
}

export default function TerrorhawkRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  staggerBuildup = 0,
  terrorhawkPhase: initialPhase = 'takeoff',
}: TerrorhawkRendererProps) {
  const theme = campHpTheme(campType);
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [phase, setPhase] = useState<TerrorhawkPhase>(initialPhase);
  const [isAttacking, setIsAttacking] = useState(false);
  const [meleeTelegraph, setMeleeTelegraph] = useState<MeleeTelegraphVisual | null>(null);

  const isAttackingRef = useRef(false);
  const phaseRef = useRef<TerrorhawkPhase>(initialPhase);
  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const attackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []);

  useEffect(() => {
    const dist = targetPosition.current.distanceTo(positionScratch.set(position.x, position.y, position.z));
    if (!isAttackingRef.current) {
      targetPosition.current.set(position.x, position.y, position.z);
    }
    if (dist > 5.0 && groupRef.current && !isAttackingRef.current) {
      groupRef.current.position.set(position.x, position.y, position.z);
    }
  }, [position.x, position.y, position.z]);

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useEffect(() => {
    return () => {
      if (attackTimer.current) clearTimeout(attackTimer.current);
    };
  }, []);

  // Phase + attack animations driven by server telegraphs / enemiesRef.
  useEffect(() => {
    if (!socket) return;

    const handleTakeoff = (data: { terrorhawkId?: string }) => {
      if (data.terrorhawkId !== id) return;
      setPhase('takeoff');
      phaseRef.current = 'takeoff';
      setIsAttacking(false);
      isAttackingRef.current = false;
    };

    const handleDive = (data: { terrorhawkId?: string }) => {
      if (data.terrorhawkId !== id) return;
      setPhase('dive');
      phaseRef.current = 'dive';
      setIsAttacking(false);
      isAttackingRef.current = false;
    };

    const handleLand = (data: { terrorhawkId?: string }) => {
      if (data.terrorhawkId !== id) return;
      setPhase('land');
      phaseRef.current = 'land';
      setIsAttacking(false);
      isAttackingRef.current = false;
    };

    const handleTelegraph = (data: {
      terrorhawkId?: string;
      hitDelayMs?: number;
      swingLockMs?: number;
      attackRange?: number;
      arcDeg?: number;
      facing?: number;
      weightClass?: string;
      timestamp?: number;
    }) => {
      if (data.terrorhawkId !== id) return;
      if (attackTimer.current) clearTimeout(attackTimer.current);
      setPhase('ground_melee');
      phaseRef.current = 'ground_melee';
      const visual = parseMeleeTelegraphPayload(data, TERRORHAWK_MELEE_ATTACK_RANGE, ATTACK_DURATION);
      setMeleeTelegraph(visual);
      setIsAttacking(true);
      isAttackingRef.current = true;
      const duration = meleeAttackDurationFromTelegraph(visual, ATTACK_DURATION);
      attackTimer.current = setTimeout(() => {
        setIsAttacking(false);
        setMeleeTelegraph(null);
        isAttackingRef.current = false;
      }, duration);
    };

    const handleTerrorhawkWhiff = (data: { terrorhawkId?: string }) => {
      if (data.terrorhawkId !== id) return;
      setMeleeTelegraph((prev) => (prev ? { ...prev, whiffed: true } : prev));
    };

    socket.on('terrorhawk-takeoff-start', handleTakeoff);
    socket.on('terrorhawk-dive-start', handleDive);
    socket.on('terrorhawk-land', handleLand);
    socket.on('terrorhawk-attack-telegraph', handleTelegraph);
    socket.on('terrorhawk-attack-whiff', handleTerrorhawkWhiff);
    return () => {
      socket.off('terrorhawk-takeoff-start', handleTakeoff);
      socket.off('terrorhawk-dive-start', handleDive);
      socket.off('terrorhawk-land', handleLand);
      socket.off('terrorhawk-attack-telegraph', handleTelegraph);
      socket.off('terrorhawk-attack-whiff', handleTerrorhawkWhiff);
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

    // Sync phase from live enemy ref (enemies-moved batch).
    const live = enemiesRef.current.get(id) as { terrorhawkPhase?: TerrorhawkPhase } | undefined;
    if (live?.terrorhawkPhase && live.terrorhawkPhase !== phaseRef.current && !isAttackingRef.current) {
      // Don't override local land mid-dive unless server advanced past dive.
      const next = live.terrorhawkPhase;
      const allow =
        next === 'takeoff' ||
        next === 'hover' ||
        next === 'approach' ||
        next === 'dive' ||
        next === 'ground_melee' ||
        (next === 'land' && phaseRef.current === 'dive');
      if (allow) {
        phaseRef.current = next;
        setPhase(next);
      }
    }

    if (!isAttackingRef.current) {
      const dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);
      if (dist > 5.0) {
        group.position.copy(targetPosition.current);
      }
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

  const hpBarY = isAirPhase(phase) ? HP_BAR_Y_AIR : HP_BAR_Y_GROUND;

  return (
    <group ref={setGroupRef} visible={!isDying || opacity.current > 0}>
      <TerrorhawkModel
        phase={phase}
        isAttacking={isAttacking}
        isDying={isDying}
      />
      {isAttacking && !isDying && (
        <EnemyMeleeAttackRangeRing
          radius={meleeTelegraph?.attackRange ?? TERRORHAWK_MELEE_ATTACK_RANGE}
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
      <Billboard position={[0, hpBarY + 2.25, 0]}>
        {health > 0 && !isDying && (
          <>
            <EnemyHpBarPlanes fillRef={hpFillRef} backgroundColor={theme.background} fillColor={theme.fill} />
            <EnemyHealthBarTextLabel
              name={getEnemyDisplayName('terrorhawk')}
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
