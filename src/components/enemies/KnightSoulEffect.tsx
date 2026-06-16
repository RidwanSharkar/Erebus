'use client';

import React, { useRef, useMemo } from 'react';
import { EnemyDynamicLight } from '@/components/effects/DynamicLightPool';

import { useFrame } from '@react-three/fiber';
import { Mesh, Group, AdditiveBlending, Color } from 'three';

type SoulType = 'green' | 'red' | 'blue' | 'purple' | 'yellow';

interface KnightSoulEffectProps {
  soulType: SoulType;
}

const SOUL_COLORS: Record<SoulType, { core: string; glow: string; light: string }> = {
  green:  { core: '#00ff88', glow: '#00cc55', light: '#00ff66' },
  red:    { core: '#ff3344', glow: '#cc1122', light: '#ff2233' },
  blue:   { core: '#44aaff', glow: '#2266dd', light: '#3399ff' },
  purple: { core: '#cc44ff', glow: '#8811cc', light: '#bb33ff' },
  yellow: { core: '#ffe433', glow: '#cc9900', light: '#fff176' },
};

// 6 small orbiting particles for a denser ring
const ORBIT_COUNT = 4;
const ORBIT_RADIUS = 0.5;

export default function KnightSoulEffect({ soulType }: KnightSoulEffectProps) {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const glowRef = useRef<Mesh>(null);
  const orbitGroupRef = useRef<Group>(null);
  const particleRefs = useRef<(Mesh | null)[]>([]);

  const colors = SOUL_COLORS[soulType];

  // Unique phase offset per soul so multiple knights don't pulse in lockstep
  const phaseOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + phaseOffset;

    // Float the whole soul up and down — lowered base height
    if (groupRef.current) {
      groupRef.current.position.y = 1.5 + Math.sin(t * 1.4) * 0.025;
    }

    // Pulse the core orb scale — stronger throb
    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 2.8) * 0.22;
      coreRef.current.scale.setScalar(pulse);
    }

    // Pulse the outer glow (opposite phase for breathing effect)
    if (glowRef.current) {
      const glowPulse = 1 + Math.sin(t * 2.8 + Math.PI) * 0.28;
      glowRef.current.scale.setScalar(glowPulse);
      const mat = glowRef.current.material as any;
      if (mat) mat.opacity = 0.35 + Math.sin(t * 2.8) * 0.15;
    }

    // Rotate the orbit ring faster
    if (orbitGroupRef.current) {
      orbitGroupRef.current.rotation.y = t * 1.8;
      orbitGroupRef.current.rotation.x = Math.sin(t * 0.6) * 0.45;
    }

    // Individual particle pulse — more dramatic
    particleRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const particlePhase = t * 4 + (i / ORBIT_COUNT) * Math.PI * 2;
      const s = 0.6 + Math.sin(particlePhase) * 0.4;
      mesh.scale.setScalar(s);
    });
  });

  return (
    // Positioned relative to the knight group origin; Y handled in useFrame
    <group ref={groupRef} position={[0, 1.5, 0]}>
      {/* Point light — stronger radius and intensity */}
      <EnemyDynamicLight position={[0, 0.2, 0]}
        color={colors.light}
        intensity={7.5}
        distance={6.0}
        decay={5}
      />

      {/* Core orb — larger */}
      <mesh ref={coreRef} position={[0, 0.325, 0]}>
        <sphereGeometry args={[0.14, 14, 14]} />
        <meshBasicMaterial
          color={colors.core}
          toneMapped={false}
        />
      </mesh>

      {/* Outer glow shell — wider and more opaque */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.3, 14, 14]} />
        <meshBasicMaterial
          color={colors.glow}
          transparent
          opacity={0.38}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* Orbiting particles */}
      <group ref={orbitGroupRef} position={[0, 0.25, 0]}>
        {Array.from({ length: ORBIT_COUNT }).map((_, i) => {
          const angle = (i / ORBIT_COUNT) * Math.PI * 2;
          const x = Math.cos(angle) * ORBIT_RADIUS;
          const z = Math.sin(angle) * ORBIT_RADIUS;
          return (
            <mesh
              key={i}
              position={[x, 0, z]}
              ref={el => { particleRefs.current[i] = el; }}
            >
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshBasicMaterial
                color={colors.core}
                toneMapped={false}
                transparent
                opacity={1.0}
                blending={AdditiveBlending}
                depthWrite={false}
              />
              <EnemyDynamicLight position={[0, 0.35, 0]}
                color={colors.light}
                intensity={1.25}
                distance={6.0}
                decay={5}
              />
            </mesh>
          );
        })}
      </group>
      

      {/* Wide aura disc beneath the orb — more visible */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.35, 0]}>
        <ringGeometry args={[0.60, 0.825, 32]} />
        <meshBasicMaterial
          color={colors.glow}
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
          side={2}
        />

<EnemyDynamicLight position={[0, -0.125, 0]}
        color={colors.light}
        intensity={2.5}
        distance={6.0}
        decay={5}
      />


        
      </mesh>
    </group>
  );
}
