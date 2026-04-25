'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Group,
  Vector3,
  RingGeometry,
  AdditiveBlending,
  DoubleSide,
  Color,
  MeshBasicMaterial,
} from '@/utils/three-exports';

const RING_SEGMENTS = 64;

export interface MartyrDetonationTelegraphProps {
  position: Vector3;
  radius: number;
  /** Unix ms when the telegraph should end (ring removed) */
  endAt: number;
  onComplete: () => void;
}

/** Ground danger ring (matches martyr self-detonation radius). */
export default function MartyrDetonationTelegraph({
  position,
  radius,
  endAt,
  onComplete,
}: MartyrDetonationTelegraphProps) {
  const groupRef = useRef<Group>(null);
  const doneRef = useRef(false);
  const tRef = useRef(0);

  const ringOuter = useMemo(
    () => new RingGeometry(Math.max(0.05, radius - 0.35), radius, RING_SEGMENTS),
    [radius]
  );
  const ringInner = useMemo(
    () => new RingGeometry(Math.max(0.02, radius - 0.8), Math.max(0.1, radius - 0.5), RING_SEGMENTS),
    [radius]
  );

  const matOuter = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(0xff3300),
        transparent: true,
        opacity: 0.55,
        side: DoubleSide,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    []
  );
  const matInner = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(0xffaa44),
        transparent: true,
        opacity: 0.4,
        side: DoubleSide,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    []
  );

  useFrame((_, delta) => {
    tRef.current += delta;
    if (Date.now() >= endAt && !doneRef.current) {
      doneRef.current = true;
      onComplete();
      return;
    }
    const pulse = 0.75 + 0.25 * Math.sin(tRef.current * 8);
    matOuter.opacity = 0.4 + 0.2 * pulse;
    matInner.opacity = 0.3 + 0.15 * pulse;
  });

  return (
    <group ref={groupRef} position={[position.x, 0.04, position.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={matOuter} geometry={ringOuter} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={matInner} geometry={ringInner} />
    </group>
  );
}
