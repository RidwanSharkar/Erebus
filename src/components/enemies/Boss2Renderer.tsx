'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EnemyDynamicLight } from '@/components/effects/DynamicLightPool';

import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import WarlockModel from './WarlockModel';
import WarlockTeleportEffect from './WarlockTeleportEffect';
import GhostTrail from '../dragon/GhostTrail';
import BoneWings from '../dragon/BoneWings';
import BoneAura from '../dragon/BoneAura';
import { WeaponType } from '../dragon/weapons';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef } from '@/utils/enemyLiveTransform';
import EnemyStaggerBar from './EnemyStaggerBar';
import { STAGGER_MAX_BOSS } from '@/utils/talents';
import { campHpTheme } from '@/utils/campHpTheme';
import BossBoneWings from './BossBoneWings';

interface Boss2RendererProps {
  id: string;
  position: Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  staggerBuildup?: number;
}

const BLINK_ANIMATION_DURATION = 800;
const LAUNCH_ANIMATION_DURATION = 1400;
const DEATH_GRASP_ANIMATION_DURATION = 1000;
const WALK_STOP_DELAY = 250;
const LERP_SPEED = 12;
const FADE_DURATION = 1.5;
const BOSS_SCALE = 1.65;

function Boss2Renderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  staggerBuildup = 0,
}: Boss2RendererProps) {
  const theme = campHpTheme('red');
  const { socket, enemyTransformsRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const isBlinkingRef = useRef(false);
  const targetPosition = useRef(position.clone());
  const targetRotation = useRef(rotation);
  const walkStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const launchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const trackTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      pendingTimersRef.current = pendingTimersRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    pendingTimersRef.current.push(id);
    return id;
  }, []);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);

  const [isWalking, setIsWalking] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [blinkFx, setBlinkFx] = useState<{ id: string; position: Vector3; type: 'start' | 'end' }[]>([]);

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []);

  useEffect(() => {
    const dist = targetPosition.current.distanceTo(position);
    targetPosition.current.copy(position);

    if (dist > 8 && groupRef.current) {
      groupRef.current.position.copy(position);
    }

    if (dist > 0.01 && !isBlinking && !isLaunching && !isDying) {
      setIsWalking(true);
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      walkStopTimer.current = setTimeout(() => setIsWalking(false), WALK_STOP_DELAY);
    }
  }, [position.x, position.y, position.z, isBlinking, isLaunching, isDying]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useEffect(() => {
    return () => {
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      if (launchTimer.current) clearTimeout(launchTimer.current);
      pendingTimersRef.current.forEach(clearTimeout);
      pendingTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleBlink = (data: {
      warlockId: string;
      startPosition: { x: number; y: number; z: number };
      endPosition: { x: number; y: number; z: number };
      rotation: number;
    }) => {
      if (data.warlockId !== id) return;
      setIsBlinking(true);
      isBlinkingRef.current = true;

      const startPos = new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
      const endPos = new Vector3(data.endPosition.x, data.endPosition.y, data.endPosition.z);
      targetPosition.current.copy(endPos);
      targetRotation.current = data.rotation;

      (window as any).audioSystem?.playEnemyBlinkSound(startPos);
      const fxId = `${id}-${Date.now()}`;
      setBlinkFx(prev => [...prev, { id: `${fxId}-start`, position: startPos, type: 'start' }]);
      trackTimeout(() => {
        setBlinkFx(prev => [...prev, { id: `${fxId}-end`, position: endPos, type: 'end' }]);
      }, Math.round(BLINK_ANIMATION_DURATION * 0.45));

      trackTimeout(() => {
        setIsBlinking(false);
        isBlinkingRef.current = false;
        if (groupRef.current) {
          groupRef.current.position.copy(endPos);
          groupRef.current.rotation.y = data.rotation;
        }
      }, BLINK_ANIMATION_DURATION);
    };

    const playLaunchAnimation = (durationMs: number) => {
      if (launchTimer.current) clearTimeout(launchTimer.current);
      setIsLaunching(true);
      setIsWalking(false);
      launchTimer.current = setTimeout(() => {
        setIsLaunching(false);
        launchTimer.current = null;
      }, durationMs);
    };

    const handleArchonLightning = (data: { bossId: string }) => {
      if (data.bossId !== id) return;
      playLaunchAnimation(LAUNCH_ANIMATION_DURATION);
    };

    const handleDeathGrasp = (data: { bossId: string; castMs?: number }) => {
      if (data.bossId !== id) return;
      playLaunchAnimation(data.castMs ?? DEATH_GRASP_ANIMATION_DURATION);
    };

    socket.on('warlock-blink-telegraph', handleBlink);
    socket.on('boss2-archon-lightning', handleArchonLightning);
    socket.on('boss2-deathgrasp-telegraph', handleDeathGrasp);
    return () => {
      socket.off('warlock-blink-telegraph', handleBlink);
      socket.off('boss2-archon-lightning', handleArchonLightning);
      socket.off('boss2-deathgrasp-telegraph', handleDeathGrasp);
      if (launchTimer.current) {
        clearTimeout(launchTimer.current);
        launchTimer.current = null;
      }
    };
  }, [id, socket, trackTimeout]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);

    group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));
    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);

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
      {blinkFx.map(fx => (
        <WarlockTeleportEffect
          key={fx.id}
          position={fx.position}
          type={fx.type}
          onComplete={() => setBlinkFx(prev => prev.filter(f => f.id !== fx.id))}
        />
      ))}

      <BoneAura parentRef={groupRef as React.RefObject<Group>} />
      <GhostTrail
        parentRef={groupRef as React.RefObject<Group>}
        weaponType={WeaponType.NONE}
        fixedTrailColor="#ff3333"
        isTrailMotionRef={isBlinkingRef}
      />

      <group ref={setGroupRef} visible={!isDying || opacity.current > 0}>
        <group scale={[BOSS_SCALE, BOSS_SCALE, BOSS_SCALE]}>
          <WarlockModel
            isWalking={isWalking && !isLaunching && !isBlinking}
            isBlinking={isBlinking}
            isLaunching={isLaunching}
            isDying={isDying}
          />
          <group position={[0, 1.85, 0.-.28]} scale={[1.25, 1.25, 1.25]}>
            <BossBoneWings isLeftWing parentRef={groupRef as React.RefObject<Group>} isDashing={isBlinking || isLaunching} />
            <BossBoneWings isLeftWing={false} parentRef={groupRef as React.RefObject<Group>} isDashing={isBlinking || isLaunching} />
          </group>
      
        </group>

        <EnemyDynamicLight color="#ff2222" intensity={3.5} distance={12} decay={2} position={[0, 3, 0]} />

        <Billboard position={[0, 6.1, 0]} follow lockX={false} lockY={false} lockZ={false}>
          {health > 0 && !isDying && (
            <>
              <mesh position={[0, 0, 0]}>
                <planeGeometry args={[2.0, 0.25]} />
                <meshBasicMaterial color={theme.background} opacity={0.9} transparent />
              </mesh>
              <mesh position={[-1.0 + (health / maxHealth), 0, 0.001]}>
                <planeGeometry args={[(health / maxHealth) * 2.0, 0.23]} />
                <meshBasicMaterial color={theme.fill} opacity={0.95} transparent />
              </mesh>
              <Text
                position={[0, 0, 0.002]}
                fontSize={0.18}
                color={theme.text}
                anchorX="center"
                anchorY="middle"
                fontWeight="bold"
              >
                {`ENVY ${Math.ceil(health)}/${maxHealth}`}
              </Text>
              <EnemyStaggerBar stagger={staggerBuildup} staggerMax={STAGGER_MAX_BOSS} />
            </>
          )}
        </Billboard>
      </group>
    </>
  );
}

export default React.memo(Boss2Renderer);
