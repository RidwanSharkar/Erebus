'use client';
import { positionScratch, type Position3 } from '@/utils/position3';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import ViperModel from './ViperModel';
import CubeSoulEffect from './CubeSoulEffect';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation, updateEnemyWalkStateFromMoveDist } from '@/utils/enemyLiveTransform';
import { campHpTheme } from '@/utils/campHpTheme';
import {
  ENEMY_HP_BAR_WIDTH,
  syncEnemyHealthBarFillFromRef,
  syncEnemyHealthBarNumericTextFromRef,
} from '@/utils/enemyHealthBar';
import EnemyStaggerBar from './EnemyStaggerBar';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';
import EnemyHpBarPlanes from './EnemyHpBarPlanes';

interface ViperRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  staggerBuildup?: number;
  /** Cube soul glow palette — defaults to green for enemy vipers. */
  soulColor?: 'green' | 'red' | 'purple' | 'blue' | 'yellow';
}

// How long isAttacking stays true — used to suppress walk state during the bow cycle.
// DrawBow ~1s + ReleaseBow ~0.6s = ~1.6s; 3s gives comfortable headroom.
const ATTACK_DURATION = 3000; // ms
const FADE_DURATION   = 1.5;  // seconds for death fade-out
const LERP_SPEED      = 12;
const WALK_STOP_DELAY = 250;  // ms
const HIT_REACT_IMPACT_COOLDOWN_MS = 1500; // min time between viper_impact.glb hit-react plays

function ViperRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  staggerBuildup = 0,
  soulColor = 'green',
}: ViperRendererProps) {
  const theme = campHpTheme(campType);
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  // Increments on every telegraph — passed to ViperModel so it always restarts DrawBow.
  const [attackKey,   setAttackKey]   = useState(0);
  const [isAttacking, setIsAttacking] = useState(false);
  const [isWalking,   setIsWalking]   = useState(false);
  const isWalkingRef = useRef(false);
  const [isImpacting,  setIsImpacting]  = useState(false);
  const [impactPlayKey, setImpactPlayKey] = useState(0);

  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const isAttackingRef = useRef(false);
  const prevHealthRef  = useRef(health);
  const lastHitImpactAtRef = useRef(0);

  const lastMoveTimeRef = useRef(0);
  const attackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer     = useRef(0);
  const opacity       = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);
  const soulEnabledRef = useRef(true);

  const SOUL_CULL_DISTANCE = 48;

  // Callback ref — positions the group at the server location before the first render
  // so the viper never flickers from world-origin.
  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track server position changes and derive walking state from them.
  useEffect(() => {
    const dist = targetPosition.current.distanceTo(positionScratch.set(position.x, position.y, position.z));
    const isLocked = isAttackingRef.current;
    if (!isLocked) {
      targetPosition.current.set(position.x, position.y, position.z);
    }

    if (dist > 8.0 && groupRef.current && !isLocked) {
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

  const handleImpactFinished = useCallback(() => {
    setIsImpacting(false);
  }, []);

  // Hit-react: health drop while idle (not walk / bow attack).
  useEffect(() => {
    if (
      health < prevHealthRef.current &&
      !isDying &&
      !isWalking &&
      !isAttacking
    ) {
      const now = performance.now();
      if (now - lastHitImpactAtRef.current >= HIT_REACT_IMPACT_COOLDOWN_MS) {
        lastHitImpactAtRef.current = now;
        setIsImpacting(true);
        setImpactPlayKey(k => k + 1);
      }
    }
    prevHealthRef.current = health;
  }, [health, isDying, isWalking, isAttacking]);

  useEffect(() => {
    if (isWalking || isAttacking) {
      setIsImpacting(false);
    }
  }, [isWalking, isAttacking]);

  // Listen for the server's attack telegraph to drive the bow-draw animation.
  useEffect(() => {
    if (!socket) return;

    const handleViperTelegraph = (data: { viperId: string }) => {
      if (data.viperId !== id) return;
      // Increment key unconditionally so ViperModel always restarts DrawBow,
      // even if a previous attack cycle hasn't fully finished yet.
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
      setAttackKey(k => k + 1);
      setIsAttacking(true);
      isAttackingRef.current = true;
      attackTimerRef.current = setTimeout(() => {
        setIsAttacking(false);
        isAttackingRef.current = false;
        attackTimerRef.current = null;
      }, ATTACK_DURATION);
    };

    socket.on('viper-attack-telegraph', handleViperTelegraph);
    return () => {
      socket.off('viper-attack-telegraph', handleViperTelegraph);
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
    };
  }, [id, socket]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    soulEnabledRef.current = group.position.distanceTo(state.camera.position) < SOUL_CULL_DISTANCE;

    const dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);
    updateEnemyWalkStateFromMoveDist(
      dist,
      isAttackingRef.current,
      isDying,
      WALK_STOP_DELAY,
      lastMoveTimeRef,
      isWalkingRef,
      setIsWalking,
    );

    group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));

    // Shortest-arc rotation lerp.
    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle >  Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);
    syncEnemyVisualRotation(id, enemyVisualRotationsRef, group.rotation.y);

    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth, ENEMY_HP_BAR_WIDTH);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

    // Death fade-out.
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

  return (
    <group ref={setGroupRef} visible={!isDying || opacity.current > 0}>
      <ViperModel
        isWalking={isWalking}
        attackKey={attackKey}
        isDying={isDying}
        isImpacting={isImpacting}
        impactPlayKey={impactPlayKey}
        onImpactFinished={handleImpactFinished}
      />
      {!isDying && <CubeSoulEffect color={soulColor} posY={2.5} enabledRef={soulEnabledRef} />}

      {/* Billboard health bar */}
      <Billboard position={[0, 3, 0]} follow lockX={false} lockY={false} lockZ={false}>
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

export default React.memo(ViperRenderer);
