'use client';

import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, AdditiveBlending, DoubleSide, RingGeometry } from 'three';

interface WeaverLightningStrikeProps {
  targetPosition: Vector3;
  /** Unix ms when the bolt hits and damage is resolved */
  strikeAt: number;
  damage: number;
  radius: number;
  onImpact: (damage: number, position: Vector3) => void;
  onComplete: () => void;
}

const RING_SEGMENTS = 32;

export default function WeaverLightningStrike({
  targetPosition,
  strikeAt,
  damage,
  radius,
  onImpact,
  onComplete,
}: WeaverLightningStrikeProps) {
  const struckRef = useRef(false);
  const [showBolt, setShowBolt] = useState(false);
  const impactPos = useMemo(
    () => new Vector3(targetPosition.x, 0, targetPosition.z),
    [targetPosition.x, targetPosition.z]
  );

  const warningRing = useMemo(
    () => new RingGeometry(radius - 0.25, radius, RING_SEGMENTS),
    [radius]
  );
  const innerPulse = useMemo(
    () => new RingGeometry(radius - 0.6, radius - 0.4, RING_SEGMENTS),
    [radius]
  );
  const finish = useCallback(() => {
    setTimeout(onComplete, 400);
  }, [onComplete]);

  useFrame(() => {
    if (struckRef.current) return;
    if (Date.now() < strikeAt) return;
    struckRef.current = true;
    setShowBolt(true);
    onImpact(damage, impactPos);
    finish();
  });

  return (
    <group position={[impactPos.x, 0.02, impactPos.z]}>
      {!showBolt && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <primitive object={warningRing} />
            <meshBasicMaterial
              color="#44aaff"
              transparent
              opacity={0.5}
              side={DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <primitive object={innerPulse} />
            <meshBasicMaterial
              color="#88ccff"
              transparent
              opacity={0.45}
              side={DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </>
      )}

      {showBolt && (
        <group>
          <mesh position={[0, 22, 0]}>
            <cylinderGeometry args={[0.15, 0.28, 48, 8]} />
            <meshBasicMaterial
              color="#aaddff"
              transparent
              opacity={0.95}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
          <pointLight color="#44aaff" intensity={6} distance={12} decay={2} position={[0, 2, 0]} />
          <pointLight color="#ffffff" intensity={3} distance={8} decay={2} position={[0, 1, 0]} />
        </group>
      )}
    </group>
  );
}
