'use client';
import { positionScratch, type Position3 } from '@/utils/position3';

import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import WarlockModel from './WarlockModel';
import CubeSoulEffect from './CubeSoulEffect';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation, updateEnemyWalkStateFromMoveDist } from '@/utils/enemyLiveTransform';
import { applyDungeonFeetY } from '@/utils/dungeonLayout';
import { detachSharedMaterialsForMutation } from '@/utils/sharedEnemyMaterials';
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
import GhostTrail from '../dragon/GhostTrail';
import { WeaponType } from '../dragon/weapons';

interface WarlockRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  /** Co-op camp soul colour; drives CubeSoulEffect (purple = meteor warlock, red = default). */
  soulType?: 'red' | 'purple' | 'green' | 'blue' | 'yellow' | 'orange';
  staggerBuildup?: number;
}

// How long the blink animation plays before we snap to the new position
const BLINK_ANIMATION_DURATION = 800;  // ms
// How long the launch animation plays
const LAUNCH_ANIMATION_DURATION = 1400; // ms
const FADE_DURATION = 1.5; // seconds for death fade-out
const WALK_STOP_DELAY = 250; // ms — purple warlock walks on server; debounce idle
const HIT_REACT_IMPACT_COOLDOWN_MS = 1500; // min time between warlock_impact.glb hit-react plays

// Match Knight/Viper for smooth walk; blink uses a faster slide lerp.
const LERP_SPEED = 12;
const BLINK_LERP_SPEED = 20;

function WarlockRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  soulType,
  staggerBuildup = 0,
}: WarlockRendererProps) {
  const theme = campHpTheme(campType);
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [isBlinking,  setIsBlinking]  = useState(false);
  const isBlinkingRef = useRef(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const isLaunchingRef = useRef(false);
  const [isWalking,   setIsWalking]   = useState(false);
  const isWalkingRef = useRef(false);
  const [isImpacting, setIsImpacting] = useState(false);
  const [impactPlayKey, setImpactPlayKey] = useState(0);

  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const prevHealthRef  = useRef(health);
  const lastHitImpactAtRef = useRef(0);
  const fadeTimer      = useRef(0);
  const opacity        = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);
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

  // Snap to server position before the first frame so the warlock is never rendered at the world origin
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

  // Keep spawn snap in sync with React position prop updates.
  useEffect(() => {
    const dist = targetPosition.current.distanceTo(positionScratch.set(position.x, position.y, position.z));
    const isLaunchLocked = isLaunchingRef.current;
    if (!isLaunchLocked && !isBlinkingRef.current) {
      targetPosition.current.set(position.x, position.y, position.z);
    }
    if (dist > 2.0 && groupRef.current && !isLaunchLocked && !isBlinkingRef.current) {
      groupRef.current.position.set(position.x, position.y, position.z);
    }
  }, [position.x, position.y, position.z]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  const handleImpactFinished = useCallback(() => {
    setIsImpacting(false);
  }, []);

  // Hit-react: health drop while not blinking / launching.
  useEffect(() => {
    if (
      health < prevHealthRef.current &&
      !isDying &&
      !isBlinking &&
      !isLaunching
    ) {
      const now = performance.now();
      if (now - lastHitImpactAtRef.current >= HIT_REACT_IMPACT_COOLDOWN_MS) {
        lastHitImpactAtRef.current = now;
        setIsImpacting(true);
        setImpactPlayKey(k => k + 1);
      }
    }
    prevHealthRef.current = health;
  }, [health, isDying, isBlinking, isLaunching]);

  useEffect(() => {
    if (isBlinking || isLaunching) {
      setIsImpacting(false);
    }
  }, [isBlinking, isLaunching]);

  // Blink telegraph: plays blink animation then snaps the rendered position to endPosition
  useEffect(() => {
    if (!socket) return;

    const handleWarlockBlink = (data: {
      warlockId: string;
      startPosition: { x: number; y: number; z: number };
      endPosition: { x: number; y: number; z: number };
      rotation: number;
    }) => {
      if (data.warlockId !== id) return;

      setIsBlinking(true);
      isBlinkingRef.current = true;

      const startPos = new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
      const newPos   = new Vector3(data.endPosition.x,   data.endPosition.y,   data.endPosition.z);

      // Immediately chase the new position so the lerp is already pulling there during the animation
      targetPosition.current.copy(newPos);
      targetRotation.current = data.rotation;
      if (groupRef.current) {
        groupRef.current.position.copy(startPos);
        groupRef.current.rotation.y = data.rotation;
      }

      trackTimeout(() => {
        setIsBlinking(false);
        isBlinkingRef.current = false;
        // Hard snap after animation completes to ensure the position is exact
        if (groupRef.current) {
          groupRef.current.position.copy(newPos);
          groupRef.current.rotation.y = data.rotation;
        }
      }, BLINK_ANIMATION_DURATION);
    };

    socket.on('warlock-blink-telegraph', handleWarlockBlink);
    return () => { socket.off('warlock-blink-telegraph', handleWarlockBlink); };
  }, [id, socket, trackTimeout]);

  // Launch telegraph: drives the launch animation (projectile is spawned by CoopGameScene)
  useEffect(() => {
    if (!socket) return;

    const handleWarlockLaunch = (data: { warlockId: string }) => {
      if (data.warlockId !== id) return;
      setIsLaunching(true);
      isLaunchingRef.current = true;
      trackTimeout(() => {
        setIsLaunching(false);
        isLaunchingRef.current = false;
      }, LAUNCH_ANIMATION_DURATION);
    };

    socket.on('warlock-attack-telegraph', handleWarlockLaunch);
    return () => { socket.off('warlock-attack-telegraph', handleWarlockLaunch); };
  }, [id, socket, trackTimeout]);

  // Archon Shock (post-boss-2): same cast animation as chaos orb launch
  useEffect(() => {
    if (!socket) return;

    const handleArchonShock = (data: { warlockId: string }) => {
      if (data.warlockId !== id) return;
      setIsLaunching(true);
      isLaunchingRef.current = true;
      trackTimeout(() => {
        setIsLaunching(false);
        isLaunchingRef.current = false;
      }, LAUNCH_ANIMATION_DURATION);
    };

    socket.on('warlock-archon-shock', handleArchonShock);
    return () => { socket.off('warlock-archon-shock', handleArchonShock); };
  }, [id, socket, trackTimeout]);

  useLayoutEffect(() => {
    applyEnemyHealthBarFill(hpFillRef.current, health, maxHealth, ENEMY_HP_BAR_WIDTH);
  }, [health, maxHealth]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth, ENEMY_HP_BAR_WIDTH);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

    const isLaunchLocked = isLaunchingRef.current;

    if (isBlinkingRef.current) {
      group.position.lerp(targetPosition.current, Math.min(1, delta * BLINK_LERP_SPEED));
      applyDungeonFeetY(group.position);
      let deltaAngle = targetRotation.current - group.rotation.y;
      while (deltaAngle >  Math.PI) deltaAngle -= Math.PI * 2;
      while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
      group.rotation.y += deltaAngle * Math.min(1, delta * BLINK_LERP_SPEED);
    } else {
      const dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);

      if (dist > 2.0 && !isLaunchLocked) {
        group.position.copy(targetPosition.current);
      }

      if (soulType === 'purple') {
        updateEnemyWalkStateFromMoveDist(
          dist,
          isLaunchLocked || isBlinkingRef.current,
          isDying,
          WALK_STOP_DELAY,
          lastMoveTimeRef,
          isWalkingRef,
          setIsWalking,
        );
      }

      if (!isLaunchLocked) {
        group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));
        applyDungeonFeetY(group.position);

        let deltaAngle = targetRotation.current - group.rotation.y;
        while (deltaAngle >  Math.PI) deltaAngle -= Math.PI * 2;
        while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
        group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);
      }
    }

    syncEnemyVisualRotation(id, enemyVisualRotationsRef, group.rotation.y);

    // Death fade-out (death clip plays on the model underneath)
    if (isDying) {
      fadeTimer.current += delta;
      opacity.current = Math.max(0, 1 - fadeTimer.current / FADE_DURATION);

      if (!deathCacheBuilt.current) {
        detachSharedMaterialsForMutation(group);
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
        fixedTrailColor="#ff5500"
        isTrailMotionRef={isBlinkingRef}
        yOffset={1.0}
      />

    <group ref={setGroupRef} visible={!isDying || opacity.current > 0}>
      <WarlockModel
        isWalking={isWalking}
        isBlinking={isBlinking}
        isLaunching={isLaunching}
        isDying={isDying}
        isImpacting={isImpacting}
        impactPlayKey={impactPlayKey}
        onImpactFinished={handleImpactFinished}
      />
      {!isDying && (
        <CubeSoulEffect
          color={soulType === 'purple' ? 'purple' : 'red'}
          posY={2.75}
        />
      )}

      {/* Billboard health bar */}
      <Billboard position={[0, 4.5, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            <EnemyHpBarPlanes
              fillRef={hpFillRef}
              backgroundColor={theme.background}
              fillColor={theme.fill}
            />

            <EnemyHealthBarTextLabel
              name={getEnemyDisplayName('warlock')}
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
    </>
  );
}

export default React.memo(WarlockRenderer);
