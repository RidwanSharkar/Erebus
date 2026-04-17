'use client';

import React, { useRef } from 'react';
import { Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';

interface GhoulSummonRitualProps {
  position: Vector3;
  onComplete: () => void;
}

const DURATION = 2.5; // seconds — covers the ghoul_summon animation

// Slightly larger than CorruptedAura (1.5× scale), red theme
const INNER_RADIUS = 1.275;
const OUTER_RADIUS = 1.5;
const DISC_TOP    = 1.39;
const DISC_BOTTOM = 0.75;

export default function GhoulSummonRitual({ position, onComplete }: GhoulSummonRitualProps) {
  const elapsed    = useRef(0);
  const groupRef   = useRef<any>(null);
  const ringsRef   = useRef<any>(null);
  const discRef    = useRef<any>(null);

  useFrame((_, delta) => {
    elapsed.current += delta;
    const t = Math.min(1, elapsed.current / DURATION);

    // Fade out during the last 30% of the duration
    const opacity = t < 0.7 ? 1 : Math.max(0, (1 - t) * 3.33);

    if (groupRef.current) {
      groupRef.current.rotation.y += 0.15 * 0.008;
    }

    if (ringsRef.current) {
      ringsRef.current.children.forEach((mesh: any) => {
        if (mesh.material) mesh.material.opacity = 0.6 * opacity;
      });
    }

    if (discRef.current && discRef.current.material) {
      discRef.current.material.opacity = 0.45 * opacity;
    }

    if (t >= 1) onComplete();
  });

  return (
    <group position={[position.x, 0.001, position.z]}>
      <group ref={groupRef}>
        {/* Four rotating triangular ring segments — red theme, 1.5× scale */}
        <group ref={ringsRef} position={[0, -0.7, 0]}>
          {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((rot, i) => (
            <mesh key={i} rotation={[-Math.PI / 2, 0, rot]}>
              <ringGeometry args={[INNER_RADIUS, OUTER_RADIUS, 3]} />
              <meshStandardMaterial
                color="#ff2200"
                emissive="#cc0000"
                emissiveIntensity={2}
                transparent
                opacity={0.6}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>

        {/* Disc — red theme, 1.5× scale */}
        <mesh ref={discRef} position={[0, -0.6, 0]}>
          <cylinderGeometry args={[DISC_TOP, DISC_BOTTOM, -0.1, 32]} />
          <meshStandardMaterial
            color="#cc1100"
            emissive="#880000"
            emissiveIntensity={1}
            transparent
            opacity={0.45}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}
