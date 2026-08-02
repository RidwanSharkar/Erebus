'use client';

import { type Position3 } from '@/utils/position3';
import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import FrostQueenModel, { type FrostQueenAbilityClip } from './FrostQueenModel';
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
  FROST_QUEEN_TELEPORT_LOCK_MS,
  FROST_QUEEN_ICE_SHARDS_CAST_LOCK_MS,
} from '@/utils/frostQueenCoopAbilitiesConstants';

interface FrostQueenRendererProps {
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
const TELEPORT_LERP_SPEED = 20;
const FADE_DURATION = 1.5;

export default function FrostQueenRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  staggerBuildup = 0,
}: FrostQueenRendererProps) {
  const theme = campHpTheme(campType);
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [abilityClip, setAbilityClip] = useState<FrostQueenAbilityClip | null>(null);
  const isTeleportingRef = useRef(false);
  const isAbilityRef = useRef(false);
  const isChannelingRef = useRef(false);

  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const pendingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);
  const wasStunnedWhileChannelingRef = useRef(false);

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
    if (!isTeleportingRef.current && !isAbilityRef.current) {
      targetPosition.current.set(position.x, position.y, position.z);
    }
  }, [position.x, position.y, position.z]);

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useEffect(() => {
    if (!socket) return;

    const handleTeleport = (data: {
      frostQueenId: string;
      startPosition: { x: number; y: number; z: number };
      endPosition: { x: number; y: number; z: number };
      rotation: number;
    }) => {
      if (data.frostQueenId !== id) return;

      isTeleportingRef.current = true;
      isAbilityRef.current = true;
      setAbilityClip('RiseCast');

      const startPos = new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
      const endPos = new Vector3(data.endPosition.x, data.endPosition.y, data.endPosition.z);
      targetPosition.current.copy(endPos);
      targetRotation.current = data.rotation;
      if (groupRef.current) {
        groupRef.current.position.set(startPos.x, startPos.y, startPos.z);
        groupRef.current.rotation.y = data.rotation;
      }

      trackTimeout(() => {
        isTeleportingRef.current = false;
        isAbilityRef.current = false;
        setAbilityClip(null);
        if (groupRef.current) {
          groupRef.current.position.set(endPos.x, endPos.y, endPos.z);
          groupRef.current.rotation.y = data.rotation;
        }
      }, FROST_QUEEN_TELEPORT_LOCK_MS);
    };

    const handleIceShardsTelegraph = (data: { frostQueenId: string }) => {
      if (data.frostQueenId !== id) return;
      if (isChannelingRef.current) return;
      isAbilityRef.current = true;
      setAbilityClip('Cast');
      trackTimeout(() => {
        if (!isChannelingRef.current) {
          setAbilityClip(null);
          isAbilityRef.current = false;
        }
      }, FROST_QUEEN_ICE_SHARDS_CAST_LOCK_MS);
    };

    const handleIceStormStart = (data: { frostQueenId: string }) => {
      if (data.frostQueenId !== id) return;
      isChannelingRef.current = true;
      isAbilityRef.current = true;
      setAbilityClip('Channel');
    };

    const handleIceStormEnd = (data: { frostQueenId: string }) => {
      if (data.frostQueenId !== id) return;
      isChannelingRef.current = false;
      isAbilityRef.current = false;
      setAbilityClip(null);
    };

    socket.on('frost-queen-teleport', handleTeleport);
    socket.on('frost-queen-ice-shards-telegraph', handleIceShardsTelegraph);
    socket.on('frost-queen-ice-storm-start', handleIceStormStart);
    socket.on('frost-queen-ice-storm-end', handleIceStormEnd);
    return () => {
      socket.off('frost-queen-teleport', handleTeleport);
      socket.off('frost-queen-ice-shards-telegraph', handleIceShardsTelegraph);
      socket.off('frost-queen-ice-storm-start', handleIceStormStart);
      socket.off('frost-queen-ice-storm-end', handleIceStormEnd);
    };
  }, [id, socket, trackTimeout]);

  // Stun interrupt — clear channel clip if channeling
  useFrame(() => {
    if (!isChannelingRef.current) {
      wasStunnedWhileChannelingRef.current = false;
      return;
    }
    const enemy = enemiesRef.current.get(id);
    const stunnedUntil = enemy?.stunnedUntilMs ?? 0;
    const stunned = performance.now() < stunnedUntil;
    if (stunned && !wasStunnedWhileChannelingRef.current) {
      wasStunnedWhileChannelingRef.current = true;
      isChannelingRef.current = false;
      isAbilityRef.current = false;
      setAbilityClip(null);
    }
  });

  useLayoutEffect(() => {
    applyEnemyHealthBarFill(hpFillRef.current, health, maxHealth, ENEMY_HP_BAR_WIDTH);
  }, [health, maxHealth]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth, ENEMY_HP_BAR_WIDTH);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

    if (!isTeleportingRef.current) {
      syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);
    }

    const lerpSpeed = isTeleportingRef.current ? TELEPORT_LERP_SPEED : LERP_SPEED;
    group.position.lerp(targetPosition.current, Math.min(1, delta * lerpSpeed));

    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * lerpSpeed);
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
      <FrostQueenModel abilityClip={abilityClip} isDying={isDying} />

      <Billboard position={[0, 2.2, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            <EnemyHpBarPlanes
              fillRef={hpFillRef}
              backgroundColor={theme.background}
              fillColor={theme.fill}
            />
            <EnemyHealthBarTextLabel
              leading="❄️"
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
