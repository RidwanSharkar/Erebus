'use client';
import { positionScratch, type Position3 } from '@/utils/position3';

import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import ShadeModel from './ShadeModel';
import CubeSoulEffect from './CubeSoulEffect';
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
import EnemyHpBarPlanes from './EnemyHpBarPlanes';
import GhostTrail from '../dragon/GhostTrail';
import { WeaponType } from '../dragon/weapons';

interface ShadeRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  soulType?: string;
  staggerBuildup?: number;
}

// How long the throw animation plays before blending back to idle/walk.
// Tune to match shade_throw.glb; must match backend enemyAI SHADE_THROW_ANIMATION_MS.
const ATTACK_DURATION = 1500; // ms
// How long the blink "teleport" lasts before we hard-snap the mesh.
const BLINK_DURATION  = 600;  // ms — must match shadeCastBlinkAndAttack in enemyAI.js
const FADE_DURATION   = 1.5;  // seconds for death fade-out
const LERP_SPEED      = 12;   // match Knight/Viper smooth walk interpolation
const BLINK_LERP_SPEED = 20;  // fast slide during blink telegraph
// Debounce: server must stop sending moves for this long before we switch to Idle.
const WALK_STOP_DELAY = 250; // ms
const HIT_REACT_IMPACT_COOLDOWN_MS = 1500; // min time between shade_impact.glb hit-react plays

function ShadeRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  soulType,
  staggerBuildup = 0,
}: ShadeRendererProps) {
  const theme = campHpTheme(campType);
  const isBlueShade = soulType === 'blue';
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [isAttacking, setIsAttacking] = useState(false);
  const [isWalking,   setIsWalking]   = useState(false);
  const isWalkingRef = useRef(false);
  const [isBlinking,  setIsBlinking]  = useState(false);
  const [isImpacting,  setIsImpacting]  = useState(false);
  const [impactPlayKey, setImpactPlayKey] = useState(0);

  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const isAttackingRef = useRef(false);
  const isBlinkingRef  = useRef(false);
  const prevHealthRef  = useRef(health);
  const lastHitImpactAtRef = useRef(0);

  const lastMoveTimeRef = useRef(0);
  const pendingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const trackTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      pendingTimersRef.current = pendingTimersRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    pendingTimersRef.current.push(id);
    return id;
  }, []);
  const fadeTimer  = useRef(0);
  const opacity    = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);

  // Callback ref — positions the group at the server location before the first render
  // so the shade never flickers from world-origin.
  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      pendingTimersRef.current.forEach(clearTimeout);
      pendingTimersRef.current = [];
    };
  }, []);

  // Keep spawn/teleport snap in sync with React position prop updates.
  useEffect(() => {
    const dist = targetPosition.current.distanceTo(positionScratch.set(position.x, position.y, position.z));
    const isAttackLocked = isAttackingRef.current;
    if (!isAttackLocked && !isBlinkingRef.current) {
      targetPosition.current.set(position.x, position.y, position.z);
    }
    if (dist > 8.0 && groupRef.current && !isAttackLocked && !isBlinkingRef.current) {
      groupRef.current.position.set(position.x, position.y, position.z);
    }
  }, [position.x, position.y, position.z]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  const handleImpactFinished = useCallback(() => {
    setIsImpacting(false);
  }, []);

  // Hit-react: health drop while idle (not walk / attack / blink).
  useEffect(() => {
    if (
      health < prevHealthRef.current &&
      !isDying &&
      !isWalking &&
      !isAttacking &&
      !isBlinking
    ) {
      const now = performance.now();
      if (now - lastHitImpactAtRef.current >= HIT_REACT_IMPACT_COOLDOWN_MS) {
        lastHitImpactAtRef.current = now;
        setIsImpacting(true);
        setImpactPlayKey(k => k + 1);
      }
    }
    prevHealthRef.current = health;
  }, [health, isDying, isWalking, isAttacking, isBlinking]);

  useEffect(() => {
    if (isWalking || isAttacking || isBlinking) {
      setIsImpacting(false);
    }
  }, [isWalking, isAttacking, isBlinking]);

  // Blink telegraph: set the target position and let the high-speed lerp pull the
  // mesh there — this produces the same fast-slide look as the Warlock's blink.
  useEffect(() => {
    if (!socket) return;

    const handleShadeBlink = (data: {
      shadeId: string;
      startPosition: { x: number; y: number; z: number };
      endPosition: { x: number; y: number; z: number };
      rotation: number;
    }) => {
      if (data.shadeId !== id) return;

      setIsBlinking(true);
      isBlinkingRef.current = true;

      const startPos = new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
      const newPos   = new Vector3(data.endPosition.x,   data.endPosition.y,   data.endPosition.z);
      targetPosition.current.copy(newPos);
      targetRotation.current = data.rotation;
      if (groupRef.current) {
        groupRef.current.position.copy(startPos);
        groupRef.current.rotation.y = data.rotation;
      }

      // Play blink sound at the departure position
      (window as any).audioSystem?.playEnemyBlinkSound(startPos);

      trackTimeout(() => {
        setIsBlinking(false);
        isBlinkingRef.current = false;
        if (groupRef.current) {
          groupRef.current.position.copy(newPos);
          groupRef.current.rotation.y = data.rotation;
        }
      }, BLINK_DURATION);
    };

    socket.on('shade-blink-telegraph', handleShadeBlink);
    return () => { socket.off('shade-blink-telegraph', handleShadeBlink); };
  }, [id, socket, trackTimeout]);

  // Listen for the server throw telegraph and drive the attack animation.
  useEffect(() => {
    if (!socket) return;

    const handleShadeTelegraph = (data: any) => {
      if (data.shadeId !== id) return;
      setIsAttacking(true);
      isAttackingRef.current = true;
      trackTimeout(() => {
        setIsAttacking(false);
        isAttackingRef.current = false;
      }, ATTACK_DURATION);
    };

    socket.on('shade-attack-telegraph', handleShadeTelegraph);
    return () => { socket.off('shade-attack-telegraph', handleShadeTelegraph); };
  }, [id, socket, trackTimeout]);

  useLayoutEffect(() => {
    applyEnemyHealthBarFill(hpFillRef.current, health, maxHealth, ENEMY_HP_BAR_WIDTH);
  }, [health, maxHealth]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth, ENEMY_HP_BAR_WIDTH);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

    const isAttackLocked = isAttackingRef.current;

    if (isBlinkingRef.current) {
      group.position.lerp(targetPosition.current, Math.min(1, delta * BLINK_LERP_SPEED));
      let deltaAngle = targetRotation.current - group.rotation.y;
      while (deltaAngle >  Math.PI) deltaAngle -= Math.PI * 2;
      while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
      group.rotation.y += deltaAngle * Math.min(1, delta * BLINK_LERP_SPEED);
    } else {
      const dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);

      if (dist > 8.0 && !isAttackLocked) {
        group.position.copy(targetPosition.current);
      }

      updateEnemyWalkStateFromMoveDist(
        dist,
        isAttackLocked || isBlinkingRef.current,
        isDying,
        WALK_STOP_DELAY,
        lastMoveTimeRef,
        isWalkingRef,
        setIsWalking,
      );

      if (!isAttackLocked) {
        group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));

        let deltaAngle = targetRotation.current - group.rotation.y;
        while (deltaAngle >  Math.PI) deltaAngle -= Math.PI * 2;
        while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
        group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);
      }
    }

    syncEnemyVisualRotation(id, enemyVisualRotationsRef, group.rotation.y);

    // Death fade-out (death clip on model underneath)
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
    <>
      <GhostTrail
        parentRef={groupRef as React.RefObject<Group>}
        weaponType={WeaponType.NONE}
        fixedTrailColor={isBlueShade ? '#33ccff' : '#9b30ff'}
        isTrailMotionRef={isBlinkingRef}
        yOffset={1.0}
      />

    <group ref={setGroupRef} visible={!isDying || opacity.current > 0}>
      <ShadeModel
        isWalking={isWalking}
        isAttacking={isAttacking}
        isBlinking={isBlinking}
        isDying={isDying}
        isImpacting={isImpacting}
        impactPlayKey={impactPlayKey}
        onImpactFinished={handleImpactFinished}
      />
      {!isDying && <CubeSoulEffect color={isBlueShade ? 'blue' : 'purple'} posY={2.5} />}

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
              leading="👻"
              numericRef={hpTextRef}
              health={health}
              maxHealth={maxHealth}
              fontSize={0.18}
              color={theme.text}
            />
            <EnemyStaggerBar stagger={staggerBuildup} />
          </>
        )}
      </Billboard>
    </group>
    </>
  );
}

export default React.memo(ShadeRenderer);
