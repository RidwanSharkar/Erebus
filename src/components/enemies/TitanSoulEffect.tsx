'use client';

import React, { useRef, useMemo } from 'react';
import { EnemyDynamicLight } from '@/components/effects/DynamicLightPool';

import { useFrame } from '@react-three/fiber';
import { Mesh, Group, AdditiveBlending } from 'three';

type SoulType = 'green' | 'red' | 'blue' | 'purple';

interface TitanSoulEffectProps {
  soulType: SoulType;
}

const SOUL_COLORS: Record<SoulType, { core: string; glow: string; light: string }> = {
  green:  { core: '#00ff88', glow: '#00cc55', light: '#00ff66' },
  red:    { core: '#ff3344', glow: '#cc1122', light: '#ff2233' },
  blue:   { core: '#44aaff', glow: '#2266dd', light: '#3399ff' },
  purple: { core: '#cc44ff', glow: '#8811cc', light: '#bb33ff' },
};

const ORBIT_COUNT  = 8;   // denser ring than the knight (6)
const ORBIT_RADIUS = 0.6; // wider orbit to match the titan's scale

export default function TitanSoulEffect({ soulType }: TitanSoulEffectProps) {
  const groupRef      = useRef<Group>(null);
  const coreRef       = useRef<Mesh>(null);
  const glowRef       = useRef<Mesh>(null);
  const orbitGroupRef = useRef<Group>(null);
  const particleRefs  = useRef<(Mesh | null)[]>([]);

  const colors = SOUL_COLORS[soulType];

  // Unique phase offset so multiple titans (if ever spawned) don't pulse in lockstep
  const phaseOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + phaseOffset;

    // Float higher than the knight (1.5) so the orb clears the titan's head
    if (groupRef.current) {
      groupRef.current.position.y = 5.0 + Math.sin(t * 1.2) * 0.2;
    }

    if (coreRef.current) {
      const pulse = 1.25 + Math.sin(t * 2.8) * 0.22;
      coreRef.current.scale.setScalar(pulse);
    }

    if (glowRef.current) {
      const glowPulse = 1 + Math.sin(t * 2.8 + Math.PI) * 0.28;
      glowRef.current.scale.setScalar(glowPulse);
      const mat = glowRef.current.material as any;
      if (mat) mat.opacity = 0.35 + Math.sin(t * 2.8) * 0.15;
    }

    if (orbitGroupRef.current) {
      orbitGroupRef.current.rotation.y = t * 1.6;
      orbitGroupRef.current.rotation.x = Math.sin(t * 0.5) * 0.4;
    }

    particleRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const particlePhase = t * 3.5 + (i / ORBIT_COUNT) * Math.PI * 2;
      const s = 0.6 + Math.sin(particlePhase) * 0.4;
      mesh.scale.setScalar(s);
    });
  });

  return (
    <group ref={groupRef} position={[0, 0.025, 0.38]}>
      {/* Stronger point light — wider radius to illuminate the large titan body */}
      <EnemyDynamicLight
        color={colors.light}
        intensity={7}
        distance={9}
        decay={2}
      />

      {/* Core orb — larger than the knight's 0.18 */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.55, 14, 14]} />
        <meshBasicMaterial color={colors.core} toneMapped={false} />
      </mesh>

      {/* Outer glow shell */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.6, 14, 14]} />
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
      <group ref={orbitGroupRef}>
        {Array.from({ length: ORBIT_COUNT }).map((_, i) => {
          const angle = (i / ORBIT_COUNT) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * ORBIT_RADIUS, 0, Math.sin(angle) * ORBIT_RADIUS]}
              ref={el => { particleRefs.current[i] = el; }}
            >
              <sphereGeometry args={[0.125, 8, 8]} />
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

      {/* Wide aura disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <ringGeometry args={[0.18, 1.1, 32]} />
        <meshBasicMaterial
          color={colors.glow}
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
