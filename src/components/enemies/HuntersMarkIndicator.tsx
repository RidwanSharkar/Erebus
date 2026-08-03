'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshBasicMaterial } from '@/utils/three-exports';

/**
 * Overhead circular aiming reticle for Sniper Hunter's Mark.
 */
export default function HuntersMarkIndicator({
  position,
  yOffset = 0,
}: {
  position: { x: number; y: number; z: number };
  yOffset?: number;
}) {
  const groupRef = useRef<any>(null);
  const outerRingRef = useRef<any>(null);
  const innerRingRef = useRef<any>(null);
  const crossHRef = useRef<any>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      const bob = Math.sin(t * 3.2) * 0.08;
      groupRef.current.position.y = position.y + yOffset + bob;
      groupRef.current.rotation.y = t * 1.6;
    }
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z = -t * 2.4;
      const mat = outerRingRef.current.material as MeshBasicMaterial;
      mat.opacity = 0.55 + Math.sin(t * 5) * 0.2;
    }
    if (innerRingRef.current) {
      innerRingRef.current.rotation.z = t * 3.1;
      const mat = innerRingRef.current.material as MeshBasicMaterial;
      mat.opacity = 0.7 + Math.sin(t * 6.5) * 0.15;
    }
    if (crossHRef.current) {
      const pulse = 1 + Math.sin(t * 7) * 0.08;
      crossHRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={groupRef} position={[position.x, position.y + yOffset, position.z]}>
      {/* Outer targeting ring */}
      <mesh ref={outerRingRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.72, 32]} />
        <meshBasicMaterial color="#e8c44a" transparent opacity={0.65} side={2} depthWrite={false} />
      </mesh>

      {/* Inner ring */}
      <mesh ref={innerRingRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.38, 24]} />
        <meshBasicMaterial color="#ff6b2d" transparent opacity={0.8} side={2} depthWrite={false} />
      </mesh>

      {/* Center pip */}
      <mesh>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshBasicMaterial color="#ffe08a" transparent opacity={0.95} depthWrite={false} />
      </mesh>

      {/* Crosshair ticks */}
      <group ref={crossHRef}>
        <mesh position={[0.42, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.04, 0.22, 0.04]} />
          <meshBasicMaterial color="#e8c44a" transparent opacity={0.9} depthWrite={false} />
        </mesh>
        <mesh position={[-0.42, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.04, 0.22, 0.04]} />
          <meshBasicMaterial color="#e8c44a" transparent opacity={0.9} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0, 0.42]}>
          <boxGeometry args={[0.04, 0.22, 0.04]} />
          <meshBasicMaterial color="#e8c44a" transparent opacity={0.9} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0, -0.42]}>
          <boxGeometry args={[0.04, 0.22, 0.04]} />
          <meshBasicMaterial color="#e8c44a" transparent opacity={0.9} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}
