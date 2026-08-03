'use client';

import React, { useMemo, useRef } from 'react';
import type { Group, Mesh } from 'three';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending } from '@/utils/three-exports';
import { PooledEffectLight } from '@/components/effects/DynamicLightPool';

export const EDEN_FINALE_DAISY_INTERACT_RADIUS = 2.6;

interface EdenFinaleDaisyProps {
  position?: [number, number, number];
  onInteract?: () => void;
}

const PETAL_COUNT = 12;

export default function EdenFinaleDaisy({
  position = [0, 0, 0],
  onInteract,
}: EdenFinaleDaisyProps) {
  const groupRef = useRef<Group>(null);
  const glowRef = useRef<Mesh>(null);

  const petalAngles = useMemo(
    () => Array.from({ length: PETAL_COUNT }, (_, i) => (i / PETAL_COUNT) * Math.PI * 2),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.55) * 0.08;
      groupRef.current.position.y = Math.sin(t * 1.4) * 0.03;
    }
    if (glowRef.current) {
      (glowRef.current.material as { opacity: number }).opacity = 0.18 + Math.sin(t * 1.6) * 0.06;
    }
  });

  return (
    <group position={position}>
      <group
        ref={groupRef}
        onClick={(e) => {
          e.stopPropagation();
          onInteract?.();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        {/* Stem */}
        <mesh position={[0, 0.55, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.09, 1.1, 8]} />
          <meshStandardMaterial color="#3f7a3a" roughness={0.7} />
        </mesh>

        {/* Leaves */}
        <mesh position={[-0.18, 0.35, 0.05]} rotation={[0.3, 0.4, -0.7]} castShadow>
          <sphereGeometry args={[0.18, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color="#4a9a42" roughness={0.65} />
        </mesh>
        <mesh position={[0.2, 0.48, -0.04]} rotation={[-0.2, -0.5, 0.75]} castShadow>
          <sphereGeometry args={[0.16, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color="#4a9a42" roughness={0.65} />
        </mesh>

        {/* Yellow center disk */}
        <mesh position={[0, 1.12, 0]} castShadow>
          <sphereGeometry args={[0.28, 16, 12]} />
          <meshStandardMaterial
            color="#f5c518"
            emissive="#eab308"
            emissiveIntensity={0.35}
            roughness={0.45}
          />
        </mesh>
        <mesh position={[0, 1.12, 0]}>
          <sphereGeometry args={[0.16, 12, 10]} />
          <meshStandardMaterial color="#fde68a" roughness={0.4} />
        </mesh>

        {/* White petals */}
        {petalAngles.map((angle) => {
          const x = Math.cos(angle) * 0.42;
          const z = Math.sin(angle) * 0.42;
          return (
            <mesh
              key={angle}
              position={[x, 1.12, z]}
              rotation={[Math.PI / 2, 0, angle]}
              castShadow
            >
              <sphereGeometry args={[0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.55} />
            </mesh>
          );
        })}
      </group>

      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.7, 1.35, 32]} />
        <meshBasicMaterial
          color="#fde68a"
          transparent
          opacity={0.22}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      <PooledEffectLight
        color="#facc15"
        intensity={1.1}
        distance={9}
        decay={2}
        position={[0, 1.4, 0]}
      />

      {/* Invisible click / proximity helper volume */}
      <mesh
        visible={false}
        position={[0, 0.7, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onInteract?.();
        }}
      >
        <sphereGeometry args={[1.2, 8, 8]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}
