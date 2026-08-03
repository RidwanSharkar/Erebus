'use client';

import { positionScratch, type Position3 } from '@/utils/position3';
import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import WolfModel from './WolfModel';
import EnemyMeleeAttackRangeRing, { WOLF_MELEE_ATTACK_RANGE } from './EnemyMeleeAttackRangeRing';
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
import { getUnitNameplateName } from '@/utils/enemyDisplayNames';
import EnemyHpBarPlanes from './EnemyHpBarPlanes';

interface WolfRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  staggerBuildup?: number;
  visualScale?: number;
  /** Ally (fae beast) vs hostile enemy wolf. */
  variant?: 'ally' | 'enemy';
}

/** Match WOLF_SWING_LOCK_MS in backend/enemyAI.js */
const ENEMY_ATTACK_DURATION = 600;
const ALLY_ATTACK_DURATION = 600;
const FADE_DURATION = 1.5;
const LERP_SPEED = 14;
const WALK_STOP_DELAY = 250;

export default function WolfRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  staggerBuildup = 0,
  visualScale = 1,
  variant = 'enemy',
}: WolfRendererProps) {
  const isEnemy = variant === 'enemy';
  const attackDuration = isEnemy ? ENEMY_ATTACK_DURATION : ALLY_ATTACK_DURATION;
  const telegraphEvent = isEnemy ? 'wolf-attack-telegraph' : 'allied-wolf-attack-telegraph';
  const theme = campHpTheme(campType);
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [isWalking, setIsWalking] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);
  const [meleeTelegraph, setMeleeTelegraph] = useState<MeleeTelegraphVisual | null>(null);
  const [attackVariant, setAttackVariant] = useState<1 | 2>(1);
  const [isHowling, setIsHowling] = useState(false);

  const isWalkingRef = useRef(false);
  const isAttackingRef = useRef(false);
  const isHowlingRef = useRef(false);
  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const lastMoveTimeRef = useRef(0);
  const attackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const howlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);
  const isDyingRef = useRef(isDying);

  useEffect(() => {
    isDyingRef.current = isDying;
  }, [isDying]);

  const restoreWalkIfUnlocked = () => {
    if (!isAttackingRef.current && !isHowlingRef.current && !isDyingRef.current) {
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
    const locked = isAttackingRef.current || isHowlingRef.current;
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
      if (howlTimer.current) clearTimeout(howlTimer.current);
    };
  }, []);

  // Auto-start howl from spawn timing fields if present (covers late-join / missed socket)
  useEffect(() => {
    if (!isEnemy) return;
    const enemy = enemiesRef.current.get(id) as
      | { howlStartsAt?: number; howlEndsAt?: number }
      | undefined;
    if (!enemy?.howlEndsAt) return;
    const now = Date.now();
    if (now >= enemy.howlEndsAt) return;
    const startAt = enemy.howlStartsAt ?? now;
    const delay = Math.max(0, startAt - now);
    const duration = Math.max(0, enemy.howlEndsAt - Math.max(now, startAt));
    const t = setTimeout(() => {
      isHowlingRef.current = true;
      setIsHowling(true);
      isWalkingRef.current = false;
      setIsWalking(false);
      howlTimer.current = setTimeout(() => {
        isHowlingRef.current = false;
        setIsHowling(false);
        restoreWalkIfUnlocked();
      }, duration);
    }, delay);
    return () => clearTimeout(t);
  }, [id, isEnemy]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!socket) return;

    const handleHowlStart = (data: { wolfId?: string; durationMs?: number }) => {
      if (!isEnemy || data.wolfId !== id) return;
      if (howlTimer.current) clearTimeout(howlTimer.current);
      isHowlingRef.current = true;
      setIsHowling(true);
      isWalkingRef.current = false;
      setIsWalking(false);
      howlTimer.current = setTimeout(() => {
        isHowlingRef.current = false;
        setIsHowling(false);
        restoreWalkIfUnlocked();
      }, data.durationMs ?? 2000);
    };

    const handleWolfTelegraph = (data: {
      wolfId?: string;
      beastId?: string;
      attackVariant?: 1 | 2;
      hitDelayMs?: number;
      swingLockMs?: number;
      attackRange?: number;
      arcDeg?: number;
      facing?: number;
      weightClass?: string;
      timestamp?: number;
    }) => {
      const matchId = data.wolfId ?? data.beastId;
      if (matchId !== id) return;
      if (attackTimer.current) clearTimeout(attackTimer.current);
      setAttackVariant(data.attackVariant === 2 ? 2 : 1);
      const visual = parseMeleeTelegraphPayload(data, WOLF_MELEE_ATTACK_RANGE, attackDuration);
      setMeleeTelegraph(visual);
      setIsAttacking(true);
      isAttackingRef.current = true;
      isWalkingRef.current = false;
      setIsWalking(false);
      const duration = meleeAttackDurationFromTelegraph(visual, attackDuration);
      attackTimer.current = setTimeout(() => {
        setIsAttacking(false);
        setMeleeTelegraph(null);
        isAttackingRef.current = false;
        restoreWalkIfUnlocked();
      }, duration);
    };

    const handleWolfWhiff = (data: { wolfId?: string; beastId?: string }) => {
      const matchId = data.wolfId ?? data.beastId;
      if (matchId !== id) return;
      setMeleeTelegraph((prev) => (prev ? { ...prev, whiffed: true } : prev));
    };

    if (isEnemy) {
      socket.on('wolf-howl-start', handleHowlStart);
      socket.on('wolf-attack-whiff', handleWolfWhiff);
    }
    socket.on(telegraphEvent, handleWolfTelegraph);
    return () => {
      if (isEnemy) {
        socket.off('wolf-howl-start', handleHowlStart);
        socket.off('wolf-attack-whiff', handleWolfWhiff);
      }
      socket.off(telegraphEvent, handleWolfTelegraph);
    };
  }, [id, socket, isEnemy, telegraphEvent, attackDuration]);

  useLayoutEffect(() => {
    applyEnemyHealthBarFill(hpFillRef.current, health, maxHealth);
  }, [health, maxHealth]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;
    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

    const locked = isAttackingRef.current || isHowlingRef.current;
    let dist = 0;
    if (!locked) {
      dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);
      if (dist > 5.0) {
        group.position.copy(targetPosition.current);
      }
    }

    updateEnemyWalkStateFromMoveDist(
      dist,
      locked,
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
      <WolfModel
        isWalking={isWalking && !isAttacking && !isHowling}
        isAttacking={isAttacking}
        attackVariant={attackVariant}
        isDying={isDying}
        isHowling={isHowling}
        scaleMultiplier={visualScale}
      />
      {isEnemy && isAttacking && !isDying && (
        <EnemyMeleeAttackRangeRing
          radius={meleeTelegraph?.attackRange ?? WOLF_MELEE_ATTACK_RANGE}
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
      <Billboard position={[0, 2.4 * visualScale, 0]}>
        {health > 0 && !isDying && (
          <>
            <EnemyHpBarPlanes fillRef={hpFillRef} backgroundColor={theme.background} fillColor={theme.fill} />
            <EnemyHealthBarTextLabel
              name={getUnitNameplateName('wolf', campType)}
              numericRef={hpTextRef}
              health={health}
              maxHealth={maxHealth}
              fontSize={0.16}
              color={theme.text}
            />
            {isEnemy && <EnemyStaggerBar enemyId={id} stagger={staggerBuildup} />}
          </>
        )}
      </Billboard>
    </group>
  );
}
