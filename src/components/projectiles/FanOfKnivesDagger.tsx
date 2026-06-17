'use client';

import React from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import { AdditiveBlending, Euler } from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import type { FanOfKnivesDaggerColors } from '@/utils/talents';

export interface FanOfKnivesProjectileView {
  id: number;
  position: Vector3;
  direction: Vector3;
  startPosition: Vector3;
  maxDistance: number;
  distanceTraveled: number;
  colors: FanOfKnivesDaggerColors;
}

interface FanOfKnivesDaggerProps {
  projectiles: FanOfKnivesProjectileView[];
}

/**
 * One dagger instance. Lives as its own component so it can borrow a pooled point
 * light (Rules of Hooks forbid calling useDynamicLight inside the projectiles.map()).
 */
function FanOfKnivesDaggerInstance({ projectile }: { projectile: FanOfKnivesProjectileView }) {
  const p = projectile;
  const { dagger, glow, trail, light } = p.colors;
  const traveled = Math.max(0, p.distanceTraveled);
  const fadeStartDistance = Math.max(p.maxDistance * 0.75, 1e-3);
  const fadeEndDistance = Math.max(p.maxDistance, fadeStartDistance + 1e-3);
  const fadeProgress =
    traveled < fadeStartDistance
      ? 0
      : Math.min(1, (traveled - fadeStartDistance) / (fadeEndDistance - fadeStartDistance));
  const distOpacity = 1 - fadeProgress * fadeProgress;

  const yaw = Math.atan2(p.direction.x, p.direction.z);
  const xz = Math.sqrt(p.direction.x * p.direction.x + p.direction.z * p.direction.z);
  const pitch = Math.atan2(-p.direction.y, xz || 1e-8);
  const eulerRot = new Euler(pitch, yaw, 0, 'YXZ');

  // Pooled point light follows the dagger position (world space).
  const daggerLight = useDynamicLight({ color: light, distance: 3.5, decay: 2, priority: 2 });

  useFrame(() => {
    daggerLight.current?.setPosition(p.position.x, p.position.y, p.position.z);
    daggerLight.current?.setIntensity(5 * distOpacity);
  });

  return (
    <group position={p.position.toArray()} scale={1.225}>
      <group rotation={eulerRot}>
        <mesh renderOrder={1}>
          <boxGeometry args={[0.07, 0.07, 0.55]} />
          <meshBasicMaterial
            color={dagger}
            transparent
            opacity={0.95 * distOpacity}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
        <mesh renderOrder={2}>
          <boxGeometry args={[0.2, 0.2, 0.7]} />
          <meshBasicMaterial
            color={glow}
            transparent
            opacity={0.5 * distOpacity}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
        <mesh renderOrder={1} position={[0, 0, 0.55]}>
          <boxGeometry args={[0.13, 0.13, 0.9]} />
          <meshBasicMaterial
            color={trail}
            transparent
            opacity={0.3 * distOpacity}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      </group>
    </group>
  );
}

export default function FanOfKnivesDagger({ projectiles }: FanOfKnivesDaggerProps) {
  return (
    <>
      {projectiles.map((p) => (
        <FanOfKnivesDaggerInstance key={p.id} projectile={p} />
      ))}
    </>
  );
}
