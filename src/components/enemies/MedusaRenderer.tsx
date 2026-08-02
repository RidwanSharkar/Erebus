'use client';

import { type Position3 } from '@/utils/position3';
import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import MedusaModel, { type MedusaAbilityClip } from './MedusaModel';
import EnemyStaggerBar from './EnemyStaggerBar';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation } from '@/utils/enemyLiveTransform';
import { campHpTheme } from '@/utils/campHpTheme';
import {
  ENEMY_HP_BAR_WIDTH,
  applyEnemyHealthBarFill,
  syncEnemyHealthBarFillFromRef,
  syncEnemyHealthBarNumericTextFromRef,
} from '@/utils/enemyHealthBar';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';
import EnemyHpBarPlanes from './EnemyHpBarPlanes';
import {
  MEDUSA_RAPIDFIRE_CAST_LOCK_MS,
  MEDUSA_VOIDWARP_DURATION_MS,
} from '@/utils/medusaCoopAbilitiesConstants';

interface MedusaRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  staggerBuildup?: number;
}

const LERP_SPEED = 12;
const FADE_DURATION = 1.5;

export default function MedusaRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  staggerBuildup = 0,
}: MedusaRendererProps) {
  const theme = campHpTheme(campType);
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [abilityClip, setAbilityClip] = useState<MedusaAbilityClip | null>(null);
  const isAbilityRef = useRef(false);

  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const pendingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);

  const trackTimeout = useCallback((fn: () => void, ms: number) => {
    const tid = setTimeout(() => {
      pendingTimersRef.current = pendingTimersRef.current.filter((t) => t !== tid);
      fn();
    }, ms);
    pendingTimersRef.current.push(tid);
    return tid;
  }, []);

  const clearAbilityTimers = useCallback(() => {
    pendingTimersRef.current.forEach(clearTimeout);
    pendingTimersRef.current = [];
  }, []);

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.set(
        targetPosition.current.x,
        targetPosition.current.y,
        targetPosition.current.z,
      );
      group.rotation.y = targetRotation.current;
    }
  }, []);

  useEffect(() => () => clearAbilityTimers(), [clearAbilityTimers]);

  useEffect(() => {
    if (!isAbilityRef.current) {
      targetPosition.current.set(position.x, position.y, position.z);
    }
  }, [position.x, position.y, position.z]);

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useEffect(() => {
    if (!socket) return;

    const handleCastTelegraph = (data: {
      medusaId: string;
      castVariant: number;
    }) => {
      if (data.medusaId !== id) return;
      isAbilityRef.current = true;
      setAbilityClip(data.castVariant === 2 ? 'CastRight' : 'CastLeft');
      trackTimeout(() => {
        setAbilityClip(null);
        isAbilityRef.current = false;
      }, MEDUSA_RAPIDFIRE_CAST_LOCK_MS);
    };

    const handleVoidWarpTelegraph = (data: {
      medusaId: string;
      durationMs?: number;
    }) => {
      if (data.medusaId !== id) return;
      clearAbilityTimers();
      isAbilityRef.current = true;
      setAbilityClip('Special');
      const duration = data.durationMs ?? MEDUSA_VOIDWARP_DURATION_MS;
      trackTimeout(() => {
        setAbilityClip(null);
        isAbilityRef.current = false;
      }, duration);
    };

    socket.on('medusa-cast-telegraph', handleCastTelegraph);
    socket.on('medusa-voidwarp-telegraph', handleVoidWarpTelegraph);
    return () => {
      socket.off('medusa-cast-telegraph', handleCastTelegraph);
      socket.off('medusa-voidwarp-telegraph', handleVoidWarpTelegraph);
    };
  }, [id, socket, trackTimeout, clearAbilityTimers]);

  useLayoutEffect(() => {
    applyEnemyHealthBarFill(hpFillRef.current, health, maxHealth, ENEMY_HP_BAR_WIDTH);
  }, [health, maxHealth]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth, ENEMY_HP_BAR_WIDTH);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

    syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);

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
      <MedusaModel abilityClip={abilityClip} isDying={isDying} />

      <Billboard position={[0, 6.2, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            <EnemyHpBarPlanes
              fillRef={hpFillRef}
              backgroundColor={theme.background}
              fillColor={theme.fill}
            />
            <EnemyHealthBarTextLabel
              leading="🐍"
              numericRef={hpTextRef}
              health={health}
              maxHealth={maxHealth}
              fontSize={0.18}
              color={theme.text}
            />
            <EnemyStaggerBar enemyId={id} stagger={staggerBuildup} />
          </>
        )}
      </Billboard>
    </group>
  );
}
