'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, AdditiveBlending, Color } from '@/utils/three-exports';
import { MeshStandardMaterial } from 'three';

export interface MartyrDetonationExplosionProps {
  position: { x: number; y: number; z: number };
  maxRadius: number;
  onComplete: () => void;
}

const DURATION = 0.65;

/** Short additive fireball at detonation. */
export default function MartyrDetonationExplosion({ position, maxRadius, onComplete }: MartyrDetonationExplosionProps) {
  const tRef = useRef(0);
  const groupRef = useRef<Group>(null);
  const doneRef = useRef(false);
  const mat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color(0xff4400),
        emissive: new Color(0xff2200),
        emissiveIntensity: 2.5,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    []
  );

  useFrame((_, delta) => {
    tRef.current += delta;
    const p = Math.min(tRef.current / DURATION, 1);
    if (groupRef.current) {
      const s = maxRadius * (0.2 + 0.85 * Math.sin(p * Math.PI * 0.5));
      groupRef.current.scale.setScalar(s / maxRadius);
    }
    mat.opacity = 0.75 * (1 - p);
    if (p >= 1 && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group ref={groupRef} position={[position.x, position.y + 0.5, position.z]}>
      <mesh scale={[maxRadius, maxRadius, maxRadius]}>
        <sphereGeometry args={[1, 32, 32]} />
        <primitive object={mat} attach="material" />
      </mesh>
      <pointLight color="#ff5500" intensity={28} distance={maxRadius * 3} decay={2} />
    </group>
  );
}
