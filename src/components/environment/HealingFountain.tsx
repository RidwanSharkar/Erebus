'use client';

import React, { useRef } from 'react';
import type { Mesh, MeshBasicMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending } from '@/utils/three-exports';
import { PooledEffectLight } from '@/components/effects/DynamicLightPool';

export const HEALING_FOUNTAIN_INTERACT_RADIUS = 2.6;

interface HealingFountainProps {
  position?: [number, number, number];
  active?: boolean;
  used?: boolean;
}

export default function HealingFountain({
  position = [0, 0, 0],
  active = true,
  used = false,
}: HealingFountainProps) {
  const waterRef = useRef<Mesh>(null);
  const glowRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (!active || used) return;
    const t = clock.elapsedTime;
    if (waterRef.current) {
      waterRef.current.position.y = 0.72 + Math.sin(t * 2.2) * 0.04;
    }
    if (glowRef.current) {
      const pulse = 0.22 + Math.sin(t * 1.8) * 0.08;
      (glowRef.current.material as MeshBasicMaterial).opacity = pulse;
    }
  });

  if (!active) return null;

  const waterColor = used ? '#64748b' : '#38bdf8';
  const glowColor = used ? '#475569' : '#22d3ee';

  return (
    <group position={position}>
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.35, 1.55, 0.7, 16]} />
        <meshStandardMaterial color="#d4d4d8" roughness={0.55} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <cylinderGeometry args={[1.05, 1.15, 0.18, 16]} />
        <meshStandardMaterial color={waterColor} emissive={used ? '#000000' : '#0ea5e9'} emissiveIntensity={used ? 0 : 0.35} />
      </mesh>
      <mesh ref={waterRef} position={[0, 0.72, 0]}>
        <sphereGeometry args={[0.42, 16, 16]} />
        <meshStandardMaterial
          color={waterColor}
          transparent
          opacity={used ? 0.35 : 0.72}
          emissive={used ? '#000000' : '#0284c7'}
          emissiveIntensity={used ? 0 : 0.5}
        />
      </mesh>
      {!used && (
        <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[1.2, 1.65, 32]} />
          <meshBasicMaterial color={glowColor} transparent opacity={0.25} depthWrite={false} blending={AdditiveBlending} />
        </mesh>
      )}
      {!used && (
        <PooledEffectLight
          color="#22d3ee"
          intensity={1.4}
          distance={10}
          decay={2}
          position={[0, 1.2, 0]}
        />
      )}
    </group>
  );
}
