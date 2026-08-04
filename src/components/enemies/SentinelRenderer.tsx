'use client';

import { type Position3 } from '@/utils/position3';
import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import SentinelModel, { type SentinelAbilityClip } from './SentinelModel';
import EnemyStaggerBar from './EnemyStaggerBar';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation, updateEnemyWalkStateFromMoveDist } from '@/utils/enemyLiveTransform';
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

interface SentinelRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  staggerBuildup?: number;
}

const ENTANGLE_CAST_MS = 1000;
const ORB_CAST_MS = 2000;
const LERP_SPEED = 10;
const WALK_STOP_DELAY = 250;
const FADE_DURATION = 1.5;

function SentinelRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  staggerBuildup = 0,
}: SentinelRendererProps) {
  const theme = campHpTheme(campType);
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [isWalking, setIsWalking] = useState(false);
  const [isStunned, setIsStunned] = useState(false);
  const [isSlowed, setIsSlowed] = useState(false);
  const [abilityClip, setAbilityClip] = useState<SentinelAbilityClip | null>(null);

  const isWalkingRef = useRef(false);
  const isAbilityRef = useRef(false);
  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const lastMoveTimeRef = useRef(0);
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

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []);

  useEffect(() => {
    const isLocked = isAbilityRef.current;
    if (!isLocked) targetPosition.current.set(position.x, position.y, position.z);
  }, [position.x, position.y, position.z]);

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useEffect(() => () => pendingTimersRef.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (!socket) return;

    const handleEntangleCast = (data: { sentinelId: string; durationMs?: number }) => {
      if (data.sentinelId !== id) return;
      isAbilityRef.current = true;
      setAbilityClip('ThrowUp');
      trackTimeout(() => {
        setAbilityClip(null);
        isAbilityRef.current = false;
      }, data.durationMs ?? ENTANGLE_CAST_MS);
    };

    const handleOrbCast = (data: { sentinelId: string; durationMs?: number }) => {
      if (data.sentinelId !== id) return;
      isAbilityRef.current = true;
      setAbilityClip('HoldCast');
      trackTimeout(() => {
        setAbilityClip(null);
        isAbilityRef.current = false;
      }, data.durationMs ?? ORB_CAST_MS);
    };

    socket.on('sentinel-entangle-cast', handleEntangleCast);
    socket.on('sentinel-orb-cast', handleOrbCast);
    return () => {
      socket.off('sentinel-entangle-cast', handleEntangleCast);
      socket.off('sentinel-orb-cast', handleOrbCast);
    };
  }, [id, socket, trackTimeout]);

  useLayoutEffect(() => {
    applyEnemyHealthBarFill(hpFillRef.current, health, maxHealth);
  }, [health, maxHealth]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;
    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

    const now = performance.now();
    const enemy = enemiesRef.current.get(id);
    const stunnedUntil = enemy?.stunnedUntilMs ?? 0;
    const slowedUntil = enemy?.slowedUntilMs ?? 0;
    const stunned = now < stunnedUntil;
    const slowed = !stunned && now < slowedUntil;
    if (stunned !== isStunned) setIsStunned(stunned);
    if (slowed !== isSlowed) setIsSlowed(slowed);

    const dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);
    updateEnemyWalkStateFromMoveDist(
      dist,
      isAbilityRef.current,
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
            mats.forEach((mat: any) => { mat.transparent = true; collected.push(mat); });
          }
        });
        cachedDeathMats.current = collected;
        deathCacheBuilt.current = true;
      }
      cachedDeathMats.current.forEach((mat) => { mat.opacity = opacity.current; });
    }
  });

  return (
    <group ref={setGroupRef}>
      <SentinelModel
        isWalking={isWalking}
        isStunned={isStunned}
        isSlowed={isSlowed}
        abilityClip={abilityClip}
        isDying={isDying}
      />

      <Billboard position={[0, 2.5, 0]}>
        {health > 0 && !isDying && (
          <>
            <EnemyHpBarPlanes fillRef={hpFillRef} backgroundColor={theme.background} fillColor={theme.fill} />
            <EnemyHealthBarTextLabel
              name={getEnemyDisplayName('sentinel')}
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

export default React.memo(SentinelRenderer);
