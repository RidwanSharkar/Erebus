'use client';
import { positionScratch, type Position3 } from '@/utils/position3';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import VengefulSpiritModel from './VengefulSpiritModel';
import KnightSoulEffect from './KnightSoulEffect';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation } from '@/utils/enemyLiveTransform';
import {
  VENGEFUL_SPIRIT_SUMMON_LOCK_MS,
  VENGEFUL_SPIRIT_EXPIRE_ANIM_MS,
} from '@/utils/weaponAspects';
import { scheduleKnightStyleMiss } from '@/utils/knightStyleMeleeSound';

interface VengefulSpiritRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  isDying?: boolean;
  visualScale?: number;
}

const ATTACK_DURATION = 900;
const FADE_DURATION = 0.55;
const LERP_SPEED = 14;
/**
 * Safety only — primary clear is onSummonFinished.
 * Keep longer than SUMMON_LOCK so a successful Summon clip is not cut mid-play.
 */
const SUMMON_FALLBACK_CLEAR_MS = Math.max(VENGEFUL_SPIRIT_SUMMON_LOCK_MS * 2, 2500);

function VengefulSpiritRenderer({
  id,
  position,
  rotation,
  isDying = false,
  visualScale = 1,
}: VengefulSpiritRendererProps) {
  const { socket, enemyTransformsRef, enemyVisualRotationsRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);

  const [isAttacking, setIsAttacking] = useState(false);
  const [attackVariant, setAttackVariant] = useState<1 | 2>(1);
  const [isSummoning, setIsSummoning] = useState(true);
  const [isExpiring, setIsExpiring] = useState(false);
  const isSummoningRef = useRef(true);
  const isExpiringRef = useRef(false);

  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const isAttackingRef = useRef(false);

  const attackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);

  const clearSummoning = useCallback(() => {
    isSummoningRef.current = false;
    setIsSummoning((prev) => (prev ? false : prev));
  }, []);

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []);

  // Hybrid summon end: animation callback is primary; long fallback if mixer never fires.
  useEffect(() => {
    const t = setTimeout(() => {
      clearSummoning();
    }, SUMMON_FALLBACK_CLEAR_MS);
    return () => clearTimeout(t);
  }, [clearSummoning]);

  // Align summon clear with server attack unlock (same pattern as zombies).
  useEffect(() => {
    const t = setTimeout(() => {
      clearSummoning();
    }, VENGEFUL_SPIRIT_SUMMON_LOCK_MS);
    return () => clearTimeout(t);
  }, [clearSummoning]);

  useEffect(() => {
    const dist = targetPosition.current.distanceTo(
      positionScratch.set(position.x, position.y, position.z),
    );
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

    const handleAttack = (data: {
      spiritId: string;
      attackVariant?: number;
      position?: { x: number; y?: number; z: number };
    }) => {
      if (data.spiritId !== id) return;
      if (isSummoningRef.current || isExpiringRef.current) return;
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
      const variant = data.attackVariant === 2 ? 2 : 1;
      setAttackVariant(variant);
      setIsAttacking(true);
      isAttackingRef.current = true;
      const swingPos = data.position
        ? { x: data.position.x, y: data.position.y ?? 0, z: data.position.z }
        : targetPosition.current;
      scheduleKnightStyleMiss(data.spiritId, swingPos);
      attackTimerRef.current = setTimeout(() => {
        setIsAttacking(false);
        isAttackingRef.current = false;
        attackTimerRef.current = null;
      }, ATTACK_DURATION);
    };

    const handleExpire = (data: { spiritId: string }) => {
      if (data.spiritId !== id) return;
      isExpiringRef.current = true;
      setIsExpiring(true);
      setIsAttacking(false);
      isAttackingRef.current = false;
    };

    socket.on('vengeful-spirit-attack-telegraph', handleAttack);
    socket.on('vengeful-spirit-expire-telegraph', handleExpire);
    return () => {
      socket.off('vengeful-spirit-attack-telegraph', handleAttack);
      socket.off('vengeful-spirit-expire-telegraph', handleExpire);
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
    };
  }, [id, socket]);

  useEffect(() => {
    if (!isDying) return;
    isExpiringRef.current = true;
    setIsExpiring(true);
  }, [isDying]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);

    group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));

    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);
    syncEnemyVisualRotation(id, enemyVisualRotationsRef, group.rotation.y);

    // Fade from expire telegraph so despawn is smooth (not only on isDying removal).
    if (isExpiring || isDying) {
      fadeTimer.current += delta;
      const fadeDur = Math.max(FADE_DURATION, VENGEFUL_SPIRIT_EXPIRE_ANIM_MS / 1000);
      opacity.current = Math.max(0, 1 - fadeTimer.current / fadeDur);

      if (!deathCacheBuilt.current) {
        const collected: any[] = [];
        group.traverse((child: any) => {
          if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((mat: any) => {
              mat.transparent = true;
              mat.depthWrite = false;
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
    <group
      ref={setGroupRef}
      scale={[visualScale, visualScale, visualScale]}
      visible={!(isExpiring || isDying) || opacity.current > 0}
    >
      <VengefulSpiritModel
        isAttacking={isAttacking}
        attackVariant={attackVariant}
        isSummoning={isSummoning}
        isExpiring={isExpiring}
        onSummonFinished={clearSummoning}
      />
      {!isDying && !isExpiring && (
        <KnightSoulEffect soulType="green" compact />
      )}
    </group>
  );
}

export default React.memo(VengefulSpiritRenderer);
