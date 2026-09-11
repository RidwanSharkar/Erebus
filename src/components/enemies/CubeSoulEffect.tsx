'use client';

import React, { useRef, useMemo } from 'react';
import { EnemyDynamicLight } from '@/components/effects/DynamicLightPool';
import { useFrame } from '@react-three/fiber';
import { Mesh, Group } from 'three';
import SoulGroundRing from './SoulGroundRing';
import {
  CUBE_SOUL_PARTICLE_GEO,
  SOUL_TYPE_MATERIALS,
  type SharedSoulType,
} from '@/utils/sharedEnemyUiGeometry';
import { SharedMesh } from '@/utils/SharedMesh';

type CubeColor = 'green' | 'red' | 'purple' | 'blue' | 'yellow';

interface CubeSoulEffectProps {
  color: CubeColor;
  /** Y-position of the floating soul above the model origin (default 2.0) */
  posY?: number;
  /** When false, skips animation and hides the effect (e.g. camera distance cull). */
  enabledRef?: React.RefObject<boolean>;
}

const CUBE_COLORS: Record<CubeColor, { core: string; glow: string; light: string }> = {
  green:  { core: '#00ff88', glow: '#00cc55', light: '#00ff66' },
  red:    { core: '#ff3344', glow: '#cc1122', light: '#ff2233' },
  purple: { core: '#cc44ff', glow: '#8811cc', light: '#bb33ff' },
  blue:   { core: '#33ccff', glow: '#0099dd', light: '#44ddff' },
  yellow: { core: '#ffe14d', glow: '#e6b800', light: '#ffd700' },
};

// 6 orbiting cube particles in a ring
const ORBIT_COUNT = 6;
const ORBIT_RADIUS = 0.55;
/** Keep ground ring at ~world y=0.12 regardless of soul float height. */
const GROUND_RING_WORLD_Y = 0.12;

export default function CubeSoulEffect({ color, posY = 2.0, enabledRef }: CubeSoulEffectProps) {
  const groupRef = useRef<Group>(null);
  const orbitGroupRef = useRef<Group>(null);
  const particleRefs = useRef<(Mesh | null)[]>([]);

  const colors = CUBE_COLORS[color];
  const particleMat =
    (SOUL_TYPE_MATERIALS[color as SharedSoulType] ?? SOUL_TYPE_MATERIALS.green).particle;

  // Random phase so multiple enemies of the same type don't pulse in lockstep
  const phaseOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame(({ clock }) => {
    if (enabledRef && !enabledRef.current) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }
    if (groupRef.current) groupRef.current.visible = true;

    const t = clock.getElapsedTime() + phaseOffset;

    if (groupRef.current) {
      groupRef.current.position.y = posY + Math.sin(t * 1.4) * 0.02;
    }

    if (orbitGroupRef.current) {
      orbitGroupRef.current.rotation.y = t * 1.8;
    }

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
      <EnemyDynamicLight
        position={[0, -0.25, 0]}
        color={colors.light}
        intensity={5}
        distance={6.0}
        decay={3}
      />

      <group ref={orbitGroupRef}>
        {Array.from({ length: ORBIT_COUNT }).map((_, i) => {
          const angle = (i / ORBIT_COUNT) * Math.PI * 2;
          const x = Math.cos(angle) * ORBIT_RADIUS;
          const z = Math.sin(angle) * ORBIT_RADIUS;
          return (
            <SharedMesh
              key={i}
              position={[x, -1.5, z]}
              ref={(el) => { particleRefs.current[i] = el; }}
              geometry={CUBE_SOUL_PARTICLE_GEO}
              material={particleMat}
            />
          );
        })}
      </group>

      <SoulGroundRing soulType={color} y={GROUND_RING_WORLD_Y - posY} />
    </group>
  );
}
