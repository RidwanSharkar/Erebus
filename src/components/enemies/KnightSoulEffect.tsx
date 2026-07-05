'use client';

import React, { useRef, useMemo } from 'react';
import { EnemyDynamicLight } from '@/components/effects/DynamicLightPool';

import { useFrame } from '@react-three/fiber';
import { Mesh, Group, AdditiveBlending } from 'three';
import {
  SOUL_ORB_CORE_GEO,
  SOUL_ORB_GLOW_GEO,
  SOUL_ORB_PARTICLE_GEO,
  SOUL_ORB_RING_GEO,
  SOUL_TYPE_MATERIALS,
  type SharedSoulType,
} from '@/utils/sharedEnemyUiGeometry';
import { SharedMesh } from '@/utils/SharedMesh';

type SoulType = 'green' | 'red' | 'blue' | 'purple' | 'yellow';

interface KnightSoulEffectProps {
  soulType: SoulType;
  /** Smaller, lower variant for ally_idle-sized units (Greed, Merchant). Knights use default. */
  compact?: boolean;
}

const SOUL_COLORS: Record<SoulType, { core: string; glow: string; light: string }> = {
  green:  { core: '#00ff88', glow: '#00cc55', light: '#00ff66' },
  red:    { core: '#ff3344', glow: '#cc1122', light: '#ff2233' },
  blue:   { core: '#44aaff', glow: '#2266dd', light: '#3399ff' },
  purple: { core: '#cc44ff', glow: '#8811cc', light: '#bb33ff' },
  yellow: { core: '#ffe433', glow: '#cc9900', light: '#fff176' },
};

const ORBIT_COUNT = 4;

const KNIGHT_CFG = {
  baseY: 1.5,
  scale: 1.0,
  ringY: -1.35,
  lightIntensity: 7.5,
  floatAmplitude: 0.025,
};

const COMPACT_CFG = {
  baseY: 0.9,
  scale: 0.675,
  ringY: -0.8,
  lightIntensity: 5.5,
  floatAmplitude: 0.018,
};

function KnightSoulEffect({ soulType, compact = false }: KnightSoulEffectProps) {
  const cfg = compact ? COMPACT_CFG : KNIGHT_CFG;
  const orbitRadius = 0.5 * cfg.scale;
  const coreRadius = 0.14 * cfg.scale;
  const glowRadius = 0.3 * cfg.scale;
  const particleRadius = 0.08 * cfg.scale;
  const coreYOffset = 0.325 * cfg.scale;
  const orbitYOffset = 0.25 * cfg.scale;
  const lightYOffset = 0.2 * cfg.scale;

  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const glowRef = useRef<Mesh>(null);
  const orbitGroupRef = useRef<Group>(null);
  const particleRefs = useRef<(Mesh | null)[]>([]);

  const colors = SOUL_COLORS[soulType];
  const soulMats = SOUL_TYPE_MATERIALS[soulType as SharedSoulType] ?? SOUL_TYPE_MATERIALS.green;

  // Unique phase offset per soul so multiple knights don't pulse in lockstep
  const phaseOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + phaseOffset;

    if (groupRef.current) {
      groupRef.current.position.y = cfg.baseY + Math.sin(t * 1.4) * cfg.floatAmplitude;
    }

    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 2.8) * 0.22;
      coreRef.current.scale.setScalar(pulse);
    }

    if (glowRef.current) {
      const glowPulse = 1 + Math.sin(t * 2.8 + Math.PI) * 0.28;
      glowRef.current.scale.setScalar(glowPulse);
      const mat = glowRef.current.material as any;
      if (mat) mat.opacity = 0.35 + Math.sin(t * 2.8) * 0.15;
    }

    if (orbitGroupRef.current) {
      orbitGroupRef.current.rotation.y = t * 1.8;
      orbitGroupRef.current.rotation.x = Math.sin(t * 0.6) * 0.45;
    }

    particleRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const particlePhase = t * 4 + (i / ORBIT_COUNT) * Math.PI * 2;
      const s = 0.6 + Math.sin(particlePhase) * 0.4;
      mesh.scale.setScalar(s);
    });
  });

  return (
    <group ref={groupRef} position={[0, cfg.baseY, 0]}>
      <EnemyDynamicLight
        position={[0, lightYOffset, 0]}
        color={colors.light}
        intensity={cfg.lightIntensity}
        distance={6.0}
        decay={5}
      />

      <SharedMesh ref={coreRef} position={[0, coreYOffset, 0]} geometry={SOUL_ORB_CORE_GEO} material={soulMats.core} scale={[coreRadius / 0.14, coreRadius / 0.14, coreRadius / 0.14]} />

      <SharedMesh ref={glowRef} geometry={SOUL_ORB_GLOW_GEO} material={soulMats.glow} scale={[glowRadius / 0.3, glowRadius / 0.3, glowRadius / 0.3]} />

      <group ref={orbitGroupRef} position={[0, orbitYOffset, 0]}>
        {Array.from({ length: ORBIT_COUNT }).map((_, i) => {
          const angle = (i / ORBIT_COUNT) * Math.PI * 2;
          const x = Math.cos(angle) * orbitRadius;
          const z = Math.sin(angle) * orbitRadius;
          return (
            <SharedMesh
              key={i}
              position={[x, 0, z]}
              ref={el => { particleRefs.current[i] = el; }}
              geometry={SOUL_ORB_PARTICLE_GEO}
              material={soulMats.particle}
              scale={[particleRadius / 0.08, particleRadius / 0.08, particleRadius / 0.08]}
            />
          );
        })}
      </group>

      <SharedMesh rotation={[-Math.PI / 2, 0, 0]} position={[0, cfg.ringY, 0]} geometry={SOUL_ORB_RING_GEO} material={soulMats.ring} scale={[cfg.scale, cfg.scale, cfg.scale]} />
    </group>
  );
}

export default React.memo(KnightSoulEffect);
