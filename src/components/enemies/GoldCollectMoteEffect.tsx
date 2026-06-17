'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, DoubleSide, Group, Vector3 } from '@/utils/three-exports';

interface GoldCollectMoteEffectProps {
  id: string;
  startPosition: Vector3;
  startTime: number;
  duration: number;
  getCurrentPlayerPosition: () => Vector3;
  onComplete: () => void;
}

export default function GoldCollectMoteEffect({
  id,
  startPosition,
  startTime,
  duration,
  getCurrentPlayerPosition,
  onComplete,
}: GoldCollectMoteEffectProps) {
  const groupRef = useRef<Group>(null);
  const doneRef = useRef(false);

  useFrame(() => {
    if (!groupRef.current || doneRef.current) return;
    const elapsed = Date.now() - startTime;
    const t = Math.min(elapsed / duration, 1);

    if (t >= 1) {
      doneRef.current = true;
      onComplete();
      return;
    }

    const playerPos = getCurrentPlayerPosition();
    const lift = Math.sin(t * Math.PI) * 0.8;
    const next = new Vector3().lerpVectors(startPosition, playerPos, t);
    next.y += 0.45 + lift;
    groupRef.current.position.copy(next);
    groupRef.current.scale.setScalar(1 - t * 0.55);
    groupRef.current.rotation.y += 0.14;
  });

  return (
    <group ref={groupRef} position={startPosition} key={id}>
      <mesh>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshStandardMaterial color="#ffd35f" emissive="#ffcc45" emissiveIntensity={1.8} transparent opacity={0.95} blending={AdditiveBlending} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.08, 0.145, 8]} />
        <meshStandardMaterial color="#ffefad" emissive="#ffefad" emissiveIntensity={1.2} transparent opacity={0.55} blending={AdditiveBlending} side={DoubleSide} />
      </mesh>
    </group>
  );
}
