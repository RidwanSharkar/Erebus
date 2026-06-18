'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { EnemyDynamicLight } from '@/components/effects/DynamicLightPool';

import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, Group, MeshBasicMaterial, RingGeometry, Vector3 } from 'three';
import WeaverModel from './WeaverModel';
import AscendantBoneWings from '../dragon/AscendantBoneWings';
import EnemyStaggerBar from './EnemyStaggerBar';
import Boss3GreenBeam from './Boss3GreenBeam';
import { STAGGER_MAX_BOSS } from '@/utils/talents';
import { campHpTheme } from '@/utils/campHpTheme';
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

function Boss3NovaWindupTelegraph({ startTime, durationMs }: { startTime: number; durationMs: number }) {
  const wedgeRefs = useRef<(Group | null)[]>([]);
  const ringRef = useRef<Group | null>(null);

  const { wedgeMat, ringMat } = useMemo(() => {
    return {
      wedgeMat: new MeshBasicMaterial({
        color: new Color('#66ffaa'),
        transparent: true,
        opacity: 0.35,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      ringMat: new MeshBasicMaterial({
        color: new Color('#44ff99'),
        transparent: true,
        opacity: 0.22,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    };
  }, []);

  const ringGeom = useMemo(() => new RingGeometry(0.85, 1.15, 36), []);

  useEffect(() => {
    return () => {
      wedgeMat.dispose();
      ringMat.dispose();
      ringGeom.dispose();
    };
  }, [wedgeMat, ringMat, ringGeom]);

  useFrame(() => {
    const elapsed = Date.now() - startTime;
    const u = Math.min(1, elapsed / Math.max(1, durationMs));
    const pulse = 0.35 + 0.65 * u;
    const orbit = elapsed * 0.0012;

    wedgeMat.opacity = (0.25 + 0.55 * u) * pulse;
    ringMat.opacity = 0.15 + 0.35 * u;

    if (ringRef.current) {
      ringRef.current.rotation.x = -Math.PI / 2;
      ringRef.current.rotation.z = orbit;
      ringRef.current.position.y = 0.68 + 0.08 * Math.sin(elapsed * 0.006);
      ringRef.current.scale.setScalar(0.85 + 0.25 * u);
    }

    for (let i = 0; i < 3; i += 1) {
      const wedge = wedgeRefs.current[i];
      if (!wedge) continue;
      const angle = orbit + (i * Math.PI * 2) / 3;
      const radius = 1.05 + 0.12 * u;
      wedge.position.set(Math.sin(angle) * radius, 0.72 + 0.06 * Math.sin(elapsed * 0.008 + i), Math.cos(angle) * radius);
      wedge.rotation.set(-0.35, angle, 0);
      wedge.scale.set(0.55 + 0.35 * u, 0.12 + 0.08 * u, 0.95 + 0.25 * u);
    }
  });

  return (
    <group>
      <group ref={ringRef}>
        <mesh geometry={ringGeom} material={ringMat} />
      </group>
      {[0, 1, 2].map((i) => (
        <group
          key={i}
          ref={(el) => {
            wedgeRefs.current[i] = el;
          }}
        >
          <mesh material={wedgeMat}>
            <boxGeometry args={[1, 0.18, 0.55]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default function Boss3Renderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  staggerBuildup = 0,
}: Boss3RendererProps) {
  const theme = campHpTheme('green');
  const { socket } = useMultiplayer();
  const groupRef = useRef<Group | null>(null);
  const targetPosition = useRef(position.clone());
  const targetRotation = useRef(rotation);
  const walkStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);

  const [isWalking, setIsWalking] = useState(false);
  const [isCastingSummon, setIsCastingSummon] = useState(false);
  const [novaWindup, setNovaWindup] = useState<{ startTime: number; durationMs: number } | null>(null);
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
      const startTime = Date.now();
      setIsCastingSummon(true);
      setNovaWindup({ startTime, durationMs: w });
      setTimeout(() => {
        setIsCastingSummon(false);
        setNovaWindup(null);
      }, w);
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
        <group position={[0, 1.0, -0.18]} scale={[1.35, 1.25, 1.25]}>
          <AscendantBoneWings isLeftWing parentRef={groupRef as React.RefObject<Group>} isDashing={false} />
          <AscendantBoneWings isLeftWing={false} parentRef={groupRef as React.RefObject<Group>} isDashing={false} />
        </group>
        {novaWindup && (
          <Boss3NovaWindupTelegraph startTime={novaWindup.startTime} durationMs={novaWindup.durationMs} />
        )}
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
              {`WEAVER NEXUS ${Math.ceil(health)}/${maxHealth}`}
            </Text>
            <EnemyStaggerBar stagger={staggerBuildup} staggerMax={STAGGER_MAX_BOSS} />
          </>
        )}
      </Billboard>
    </group>
  );
}
