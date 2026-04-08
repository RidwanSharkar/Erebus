'use client';

import React, { useRef } from 'react';
import { Vector3, AdditiveBlending } from 'three';
import { useFrame } from '@react-three/fiber';

interface GhoulSummonRitualProps {
  position: Vector3;
  onComplete: () => void;
}

const DURATION = 2.5; // seconds — covers the ghoul_summon animation

export default function GhoulSummonRitual({ position, onComplete }: GhoulSummonRitualProps) {
  const elapsed = useRef(0);
  const groupRef = useRef<any>(null);
  const innerRef = useRef<any>(null);
  const outerRef = useRef<any>(null);

  useFrame((_, delta) => {
    elapsed.current += delta;
    const t = Math.min(1, elapsed.current / DURATION);

    if (innerRef.current) {
      innerRef.current.rotation.y += delta * 2.5;
      innerRef.current.material.opacity = t < 0.7 ? 0.7 : Math.max(0, (1 - t) * 2.3);
    }
    if (outerRef.current) {
      outerRef.current.rotation.y -= delta * 1.2;
      outerRef.current.material.opacity = t < 0.7 ? 0.5 : Math.max(0, (1 - t) * 1.7);
    }

    if (t >= 1) onComplete();
  });

  return (
    <group ref={groupRef} position={[position.x, 0.04, position.z]}>
      {/* Ground rune glow base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.0, 32]} />
        <meshBasicMaterial
          color="#330033"
          transparent
          opacity={0.55}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Inner spinning rune ring */}
      <mesh ref={innerRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.0, 1.25, 32]} />
        <meshBasicMaterial
          color="#aa00ff"
          transparent
          opacity={0.7}
          blending={AdditiveBlending}
          depthWrite={false}
          side={2}
        />
      </mesh>

      {/* Outer counter-spinning ring */}
      <mesh ref={outerRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.6, 1.85, 32]} />
        <meshBasicMaterial
          color="#ff44ff"
          transparent
          opacity={0.5}
          blending={AdditiveBlending}
          depthWrite={false}
          side={2}
        />
      </mesh>

      {/* Central dark pillar of energy */}
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.15, 0.5, 1.6, 12, 1, true]} />
        <meshBasicMaterial
          color="#cc00cc"
          transparent
          opacity={0.6}
          blending={AdditiveBlending}
          depthWrite={false}
          side={2}
        />
      </mesh>
    </group>
  );
}
