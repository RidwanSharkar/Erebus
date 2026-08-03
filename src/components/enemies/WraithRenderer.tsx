'use client';
import { positionScratch, type Position3 } from '@/utils/position3';

import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import WraithModel from './WraithModel';
import KnightSoulEffect from './KnightSoulEffect';
import WraithBuzzsawVfx from '@/components/weapons/WraithBuzzsawVfx';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation, updateEnemyWalkStateFromMoveDist } from '@/utils/enemyLiveTransform';
import { campHpTheme } from '@/utils/campHpTheme';
import {
  ENEMY_HP_BAR_WIDTH,
  applyEnemyHealthBarFill,
  syncEnemyHealthBarFillFromRef,
  syncEnemyHealthBarNumericTextFromRef,
} from '@/utils/enemyHealthBar';
import EnemyStaggerBar from './EnemyStaggerBar';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';
import { getEnemyDisplayName } from '@/utils/enemyDisplayNames';
import EnemyHpBarPlanes from './EnemyHpBarPlanes';

interface WraithRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  staggerBuildup?: number;
}

const BUZZSAW_DURATION_MS = 1400;
const FADE_DURATION = 1.5;
const LERP_SPEED = 12;
const WALK_STOP_DELAY = 250;

function WraithRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  staggerBuildup = 0,
}: WraithRendererProps) {
  const theme = campHpTheme(campType);
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [isAttacking, setIsAttacking] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [isInvisible, setIsInvisible] = useState(false);
  const [buzzsawPlayKey, setBuzzsawPlayKey] = useState(0);
  const [buzzsawDurationMs, setBuzzsawDurationMs] = useState(BUZZSAW_DURATION_MS);
  const isWalkingRef = useRef(false);
  const isAttackingRef = useRef(false);
  const buzzsawEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const lastMoveTimeRef = useRef(0);
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
    return () => {
      if (buzzsawEndTimerRef.current) clearTimeout(buzzsawEndTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const dist = targetPosition.current.distanceTo(positionScratch.set(position.x, position.y, position.z));
    const isAttackLocked = isAttackingRef.current;
    if (!isAttackLocked) {
      targetPosition.current.set(position.x, position.y, position.z);
    }
    if (dist > 8.0 && groupRef.current && !isAttackLocked) {
      groupRef.current.position.set(position.x, position.y, position.z);
    }
  }, [position.x, position.y, position.z]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useEffect(() => {
    if (!socket) return;

    const handleStealthCloak = (data: { wraithId: string }) => {
      if (data.wraithId !== id) return;
      setIsInvisible(true);
    };

    const handleStealthReveal = (data: { wraithId: string }) => {
      if (data.wraithId !== id) return;
      setIsInvisible(false);
    };

    const handleBuzzsawTelegraph = (data: { wraithId: string; durationMs?: number }) => {
      if (data.wraithId !== id) return;

      const duration = data.durationMs ?? BUZZSAW_DURATION_MS;
      const wasAttacking = isAttackingRef.current;

      if (process.env.NODE_ENV !== 'production') {
        console.debug('[WraithBuzzsaw] telegraph', {
          wraithId: id,
          wasAttacking,
          durationMs: duration,
        });
      }

      if (buzzsawEndTimerRef.current) clearTimeout(buzzsawEndTimerRef.current);

      setIsInvisible(false);
      setBuzzsawDurationMs(duration);
      setBuzzsawPlayKey((k) => k + 1);
      setIsAttacking(true);
      isAttackingRef.current = true;

      buzzsawEndTimerRef.current = setTimeout(() => {
        setIsAttacking(false);
        isAttackingRef.current = false;
        buzzsawEndTimerRef.current = null;
      }, duration);

      const pos = groupRef.current?.position;
      if (pos) {
        (window as any).audioSystem?.playEnemyBuzzsawSound?.(pos);
      }
    };

    socket.on('wraith-stealth-cloak', handleStealthCloak);
    socket.on('wraith-stealth-reveal', handleStealthReveal);
    socket.on('wraith-buzzsaw-telegraph', handleBuzzsawTelegraph);
    return () => {
      socket.off('wraith-stealth-cloak', handleStealthCloak);
      socket.off('wraith-stealth-reveal', handleStealthReveal);
      socket.off('wraith-buzzsaw-telegraph', handleBuzzsawTelegraph);
    };
  }, [id, socket]);

  useLayoutEffect(() => {
    applyEnemyHealthBarFill(hpFillRef.current, health, maxHealth, ENEMY_HP_BAR_WIDTH);
  }, [health, maxHealth]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth, ENEMY_HP_BAR_WIDTH);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

    const isAttackLocked = isAttackingRef.current;
    const dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);

    if (dist > 8.0 && !isAttackLocked) {
      group.position.copy(targetPosition.current);
    }

    updateEnemyWalkStateFromMoveDist(
      dist,
      isAttackLocked,
      isDying,
      WALK_STOP_DELAY,
      lastMoveTimeRef,
      isWalkingRef,
      setIsWalking,
    );

    if (!isAttackLocked) {
      group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));

      let deltaAngle = targetRotation.current - group.rotation.y;
      while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
      while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
      group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);
    }

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

  const showBody = !isInvisible && (!isDying || opacity.current > 0);

  return (
    <group ref={setGroupRef} visible={showBody}>
      <WraithModel
        isWalking={isWalking}
        isAttacking={isAttacking}
        isDying={isDying}
        attackPlayKey={buzzsawPlayKey}
      />
      <WraithBuzzsawVfx
        key={buzzsawPlayKey}
        active={isAttacking}
        durationMs={buzzsawDurationMs}
      />
      {!isDying && !isInvisible && <KnightSoulEffect soulType="orange" />}

      <Billboard position={[0, 3, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && !isInvisible && (
          <>
            <EnemyHpBarPlanes
              fillRef={hpFillRef}
              backgroundColor={theme.background}
              fillColor={theme.fill}
            />
            <EnemyHealthBarTextLabel
              name={getEnemyDisplayName('wraith')}
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

export default React.memo(WraithRenderer);
