'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { EnemyDynamicLight } from '@/components/effects/DynamicLightPool';

import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import WeaverModel from './WeaverModel';
import BoneWings from '../dragon/BoneWings';
import EnemyStaggerBar from './EnemyStaggerBar';
import Boss3GreenBeam from './Boss3GreenBeam';
import { STAGGER_MAX_BOSS } from '@/utils/talents';
import { useMultiplayer } from '@/contexts/MultiplayerContext';

interface Boss3RendererProps {
  id: string;
  position: Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  staggerBuildup?: number;
}

const CAST_SUMMON_DURATION = 3000;
const FADE_DURATION = 1.5;
const LERP_SPEED = 12;
const WALK_STOP_DELAY = 250;
const BOSS_OUTER_SCALE = 1.75;

/** Server `BOSS3_NOVA_WINDUP_MS` — keeps castsummon in sync during nova wind-up */
const BOSS3_NOVA_WINDUP_MS = 3000;

/** Server `BOSS3_GREEN_BEAM_DURATION_MS` — cast-heal loop + beam VFX */
const BOSS3_GREEN_BEAM_DURATION_MS = 8000;

export default function Boss3Renderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  staggerBuildup = 0,
}: Boss3RendererProps) {
  const { socket } = useMultiplayer();
  const groupRef = useRef<Group | null>(null);
  const targetPosition = useRef(position.clone());
  const targetRotation = useRef(rotation);
  const walkStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);

  const [isWalking, setIsWalking] = useState(false);
  const [isCastingSummon, setIsCastingSummon] = useState(false);
  const [greenBeamHold, setGreenBeamHold] = useState<{ startTime: number; isActive: boolean } | null>(null);

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

    if (dist > 0.01 && !isCastingSummon && !isDying && !(greenBeamHold && greenBeamHold.isActive)) {
      setIsWalking(true);
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      walkStopTimer.current = setTimeout(() => setIsWalking(false), WALK_STOP_DELAY);
    }
  }, [
    position.x,
    position.y,
    position.z,
    isCastingSummon,
    isDying,
    greenBeamHold?.isActive,
    greenBeamHold?.startTime,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useEffect(
    () => () => {
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!socket) return;

    const handleSummonTelegraph = (data: { weaverId: string }) => {
      if (data.weaverId !== id) return;
      setIsCastingSummon(true);
      setTimeout(() => setIsCastingSummon(false), CAST_SUMMON_DURATION);
    };

    const handleNovaStart = (data: { bossId: string; windupMs?: number }) => {
      if (data.bossId !== id) return;
      const w = typeof data.windupMs === 'number' && data.windupMs > 0 ? data.windupMs : BOSS3_NOVA_WINDUP_MS;
      setIsCastingSummon(true);
      setTimeout(() => setIsCastingSummon(false), w);
    };

    const handleGreenBeamStart = (data: { bossId: string; durationMs?: number }) => {
      if (data.bossId !== id) return;
      const d =
        typeof data.durationMs === 'number' && data.durationMs > 0 ? data.durationMs : BOSS3_GREEN_BEAM_DURATION_MS;
      const startTime = Date.now();
      setGreenBeamHold({ startTime, isActive: true });
      setTimeout(() => {
        setGreenBeamHold((prev) => (prev && prev.startTime === startTime ? { ...prev, isActive: false } : prev));
      }, d);
    };

    const handleGreenBeamEnd = (data: { bossId: string }) => {
      if (data.bossId !== id) return;
      setGreenBeamHold((prev) => (prev ? { ...prev, isActive: false } : null));
    };

    socket.on('weaver-summon-telegraph', handleSummonTelegraph);
    socket.on('boss3-nova-start', handleNovaStart);
    socket.on('boss3-green-beam-start', handleGreenBeamStart);
    socket.on('boss3-green-beam-end', handleGreenBeamEnd);

    return () => {
      socket.off('weaver-summon-telegraph', handleSummonTelegraph);
      socket.off('boss3-nova-start', handleNovaStart);
      socket.off('boss3-green-beam-start', handleGreenBeamStart);
      socket.off('boss3-green-beam-end', handleGreenBeamEnd);
    };
  }, [id, socket]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));
    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);

    if (isDying) {
      fadeTimer.current += delta;
      opacity.current = Math.max(0, 1 - fadeTimer.current / FADE_DURATION);
      group.traverse((child: any) => {
        if (child.isMesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat: any) => {
            mat.transparent = true;
            mat.opacity = opacity.current;
          });
        }
      });
    }
  });

  const greenBeamChanneling = !!(greenBeamHold && greenBeamHold.isActive);
  const greenBeamIsActive = greenBeamHold?.isActive ?? false;

  return (
    <group ref={setGroupRef} visible={!isDying || opacity.current > 0}>
      <group scale={[BOSS_OUTER_SCALE, BOSS_OUTER_SCALE, BOSS_OUTER_SCALE]}>
        <WeaverModel
          isWalking={isWalking && !isCastingSummon && !greenBeamChanneling}
          isCastingHeal={greenBeamChanneling}
          castHealLoop={greenBeamChanneling}
          isCastingSummon={isCastingSummon}
          isDying={isDying}
        />
        <group position={[0, 1.85, 0.18]} scale={[1.65, 1.65, 1.65]}>
          <BoneWings isLeftWing parentRef={groupRef as React.RefObject<Group>} isDashing={false} />
          <BoneWings isLeftWing={false} parentRef={groupRef as React.RefObject<Group>} isDashing={false} />
        </group>
      </group>

      {greenBeamHold && (
        <Boss3GreenBeam
          isActive={greenBeamIsActive}
          startTime={greenBeamHold.startTime}
          onComplete={() => setGreenBeamHold(null)}
        />
      )}

      <EnemyDynamicLight color="#44ffaa" intensity={4} distance={14} decay={2} position={[0, 3.2, 0]} />

      <Billboard position={[0, 6.2, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[2.5, 0.3]} />
              <meshBasicMaterial color="#001a0d" opacity={0.92} transparent />
            </mesh>
            <mesh position={[-1.25 + (health / maxHealth) * 1.25, 0, 0.001]}>
              <planeGeometry args={[(health / maxHealth) * 2.5, 0.26]} />
              <meshBasicMaterial color="#22ff66" opacity={0.96} transparent />
            </mesh>
            <Text
              position={[0, 0, 0.002]}
              fontSize={0.18}
              color="#dcffe8"
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
            >
              {`WEAVER NEXUS ${Math.ceil(health)}/${maxHealth}`}
            </Text>
            <EnemyStaggerBar stagger={staggerBuildup} staggerMax={STAGGER_MAX_BOSS} />
          </>
        )}
      </Billboard>
    </group>
  );
}
