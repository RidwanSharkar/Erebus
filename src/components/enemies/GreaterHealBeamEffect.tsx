'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, DoubleSide, Group, Vector3 } from 'three';
import type { Enemy, Player } from '@/contexts/MultiplayerContext';

interface GreaterHealBeamEffectProps {
  position: Vector3;
  targetKind?: 'player' | 'ally';
  targetId?: string;
  enemiesRef?: React.MutableRefObject<Map<string, Enemy>>;
  playersRef?: React.MutableRefObject<Map<string, Player>>;
  socketId?: string;
  localPlayerWorldPosRef?: React.MutableRefObject<Vector3>;
  enemyPlayerPositionRefs?: React.MutableRefObject<Map<string, { current: Vector3 }>>;
  onComplete: () => void;
}

const DURATION = 1.25;

export default function GreaterHealBeamEffect({
  position,
  targetKind,
  targetId,
  enemiesRef,
  playersRef,
  socketId,
  localPlayerWorldPosRef,
  enemyPlayerPositionRefs,
  onComplete,
}: GreaterHealBeamEffectProps) {
  const [time, setTime] = useState(0);
  const doneRef = useRef(false);
  const groupRef = useRef<Group | null>(null);
  const trackedPosition = useRef(position.clone());
  const motes = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        angle: (i / 26) * Math.PI * 2,
        radius: 0.35 + Math.random() * 0.75,
        heightOffset: Math.random() * 1.4,
        speed: 1.4 + Math.random() * 1.2,
        size: 0.045 + Math.random() * 0.055,
      })),
    [],
  );

  const resolveTrackedPosition = (out: Vector3) => {
    if (targetKind === 'ally' && targetId) {
      const ally = enemiesRef?.current.get(targetId);
      if (ally && !ally.isDying && ally.health > 0) {
        out.set(ally.position.x, ally.position.y ?? 0, ally.position.z);
        return;
      }
    }

    if (targetKind === 'player' && targetId) {
      if (targetId === socketId && localPlayerWorldPosRef?.current) {
        out.copy(localPlayerWorldPosRef.current);
        return;
      }

      const remotePosition = enemyPlayerPositionRefs?.current.get(targetId)?.current;
      if (remotePosition) {
        out.copy(remotePosition);
        return;
      }

      const player = playersRef?.current.get(targetId);
      if (player) {
        out.set(player.position.x, player.position.y ?? 0, player.position.z);
        return;
      }
    }

    out.copy(position);
  };

  useFrame((_, delta) => {
    resolveTrackedPosition(trackedPosition.current);
    if (groupRef.current) {
      groupRef.current.position.copy(trackedPosition.current);
    }

    setTime(prev => {
      const next = prev + delta;
      if (next >= DURATION && !doneRef.current) {
        doneRef.current = true;
        onComplete();
      }
      return next;
    });
  });

  const progress = Math.min(1, time / DURATION);
  const fadeIn = Math.min(1, progress / 0.18);
  const fadeOut = 1 - Math.max(0, (progress - 0.62) / 0.38);
  const opacity = Math.max(0, fadeIn * fadeOut);
  const beamHeight = 7 + progress * 5;
  const beamY = beamHeight / 2;
  const beamRadius = 0.45 + progress * 0.18;
  const ringScale = 0.8 + progress * 2.2;

  return (
    <group ref={groupRef} position={[trackedPosition.current.x, trackedPosition.current.y, trackedPosition.current.z]}>
      <pointLight color="#ccfbf1" intensity={7 * opacity} distance={8} decay={2} />
      <pointLight position={[0, 3.5, 0]} color="#14b8a6" intensity={5 * opacity} distance={10} decay={2} />

      <mesh position={[0, beamY, 0]}>
        <cylinderGeometry args={[beamRadius, beamRadius * 0.65, beamHeight, 32, 1, true]} />
        <meshBasicMaterial
          color="#14b8a6"
          transparent
          opacity={0.2 * opacity}
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>

      <mesh position={[0, beamY, 0]}>
        <cylinderGeometry args={[0.12, 0.2, beamHeight, 18, 1, true]} />
        <meshBasicMaterial
          color="#ccfbf1"
          transparent
          opacity={0.5 * opacity}
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>

      {[0, 1, 2].map(i => (
        <mesh
          key={`ring-${i}`}
          position={[0, 0.05 + i * 0.34 + progress * 1.2, 0]}
          rotation={[Math.PI / 2, 0, time * (1.6 + i * 0.45)]}
          scale={[ringScale * (1 - i * 0.12), ringScale * (1 - i * 0.12), 1]}
        >
          <torusGeometry args={[0.45 + i * 0.18, 0.035, 12, 48]} />
          <meshBasicMaterial
            color={i === 0 ? '#ccfbf1' : '#10b981'}
            transparent
            opacity={opacity * (0.55 - i * 0.1)}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {motes.map((mote, i) => {
        const y = (progress * beamHeight * mote.speed + mote.heightOffset) % beamHeight;
        const spiral = mote.angle + time * (2.8 + (i % 3) * 0.35);
        const radius = mote.radius * (1 - progress * 0.35);
        return (
          <mesh
            key={`mote-${i}`}
            position={[Math.cos(spiral) * radius, y, Math.sin(spiral) * radius]}
            scale={[mote.size, mote.size, mote.size]}
          >
            <sphereGeometry args={[1, 8, 8]} />
            <meshBasicMaterial
              color={i % 4 === 0 ? '#ccfbf1' : '#2dd4bf'}
              transparent
              opacity={opacity * 0.9}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        );
      })}

      <mesh position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[ringScale, ringScale, 1]}>
        <ringGeometry args={[0.42, 0.95, 48]} />
        <meshBasicMaterial
          color="#059669"
          transparent
          opacity={opacity * 0.45}
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}
