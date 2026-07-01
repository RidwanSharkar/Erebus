'use client';

import React, { useRef, useMemo } from 'react';
import { EnemyDynamicLight } from '@/components/effects/DynamicLightPool';

import { useFrame } from '@react-three/fiber';
import { Mesh, Group, AdditiveBlending } from 'three';

type CubeColor = 'green' | 'red' | 'purple' | 'blue';

interface CubeSoulEffectProps {
  color: CubeColor;
  /** Y-position of the floating soul above the model origin (default 2.0) */
  posY?: number;
}

const CUBE_COLORS: Record<CubeColor, { core: string; glow: string; light: string }> = {
  green:  { core: '#00ff88', glow: '#00cc55', light: '#00ff66' },
  red:    { core: '#ff3344', glow: '#cc1122', light: '#ff2233' },
  purple: { core: '#cc44ff', glow: '#8811cc', light: '#bb33ff' },
  blue:   { core: '#33ccff', glow: '#0099dd', light: '#44ddff' },
};

// 6 orbiting cube particles in a ring
const ORBIT_COUNT  = 6;
const ORBIT_RADIUS = 0.55;

export default function CubeSoulEffect({ color, posY = 2.0 }: CubeSoulEffectProps) {
  const groupRef      = useRef<Group>(null);
  const coreRef       = useRef<Mesh>(null);
  const glowRef       = useRef<Mesh>(null);
  const orbitGroupRef = useRef<Group>(null);
  const particleRefs  = useRef<(Mesh | null)[]>([]);

  const colors = CUBE_COLORS[color];

  // Random phase so multiple enemies of the same type don't pulse in lockstep
  const phaseOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + phaseOffset;

    // Float the soul up and down
    if (groupRef.current) {
      groupRef.current.position.y = posY + Math.sin(t * 1.4) * 0.02;
    }

    // Core cube: slow self-rotation + scale pulse
    if (coreRef.current) {
      coreRef.current.rotation.x = t * 0.9;
      coreRef.current.rotation.y = t * 1.2;
      const pulse = 1 + Math.sin(t * 2.8) * 0.22;
      coreRef.current.scale.setScalar(pulse);
    }

    // Outer glow cube: counter-rotation + opacity breath
    if (glowRef.current) {
      glowRef.current.rotation.x = -t * 0.6;
      glowRef.current.rotation.z =  t * 0.8;
      const glowPulse = 1 + Math.sin(t * 2.8 + Math.PI) * 0.28;
      glowRef.current.scale.setScalar(glowPulse);
      const mat = glowRef.current.material as any;
      if (mat) mat.opacity = 0.35 + Math.sin(t * 2.8) * 0.15;
    }

    // Orbit ring: tilted yaw + gentle wobble
    if (orbitGroupRef.current) {
      orbitGroupRef.current.rotation.y = t * 1.8;

    }

    // Each particle cube spins and pulses individually
    particleRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const particlePhase = t * 4 + (i / ORBIT_COUNT) * Math.PI * 2;
      const s = 0.6 + Math.sin(particlePhase) * 0.4;
      mesh.scale.setScalar(s);
      mesh.rotation.x = t * 2.5 + i;
      mesh.rotation.y = t * 1.8 + i * 0.5;
    });
  });

  return (
    <group ref={groupRef} position={[0, posY, 0]}>
      {/* Point light */}
      <EnemyDynamicLight position={[0, -0.25, 0]}
        color={colors.light}
        intensity={5}
        distance={6.0}
        decay={3}
      />



      {/* Orbiting cube particles */}
      <group ref={orbitGroupRef}>
        {Array.from({ length: ORBIT_COUNT }).map((_, i) => {
          const angle = (i / ORBIT_COUNT) * Math.PI * 2;
          const x = Math.cos(angle) * ORBIT_RADIUS;
          const z = Math.sin(angle) * ORBIT_RADIUS;
          return (
            <mesh
              key={i}
              position={[x, -1.5, z]}
              ref={el => { particleRefs.current[i] = el; }}
            >
              <boxGeometry args={[0.11, 0.11, 0.11]} />
              <meshBasicMaterial
                color={colors.core}
                toneMapped={false}
                transparent
                opacity={1.0}
                blending={AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
            
          );
        })}
      </group>


      {/* Wide aura disc beneath the orb — more visible */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.65, 0]}>
        <ringGeometry args={[0.5, 0.825, 32]} />
        <meshBasicMaterial
          color={'#ff0000'}
          transparent
          opacity={0.28}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
          side={2}
        />


        
      </mesh>
    </group>
  );
}
