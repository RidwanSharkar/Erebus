'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, MeshBasicMaterial, Color, AdditiveBlending } from 'three';

interface ShadeDaggerProjectileProps {
  startPosition: Vector3;
  targetPosition: Vector3;
  damage: number;
  getPlayerPosition: () => Vector3 | null;
  onHitPlayer: () => void;
  onComplete: () => void;
}

const SPEED = 18;       // units per second
const HIT_RADIUS = 1.1; // collision radius against the local player

export default function ShadeDaggerProjectile({
  startPosition,
  targetPosition,
  damage: _damage, // consumed by the caller's onHitPlayer
  getPlayerPosition,
  onHitPlayer,
  onComplete,
}: ShadeDaggerProjectileProps) {
  const groupRef = useRef<Group>(null);
  const timeRef = useRef(0);
  const doneRef = useRef(false);

  const direction = useMemo(
    () => targetPosition.clone().sub(startPosition).normalize(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const totalDist = useMemo(
    () => startPosition.distanceTo(targetPosition),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const duration = totalDist / SPEED;

  // Euler to align the dagger's local +Z axis with the travel direction.
  const yaw   = Math.atan2(direction.x, direction.z);
  const pitch  = Math.atan2(-direction.y, Math.sqrt(direction.x ** 2 + direction.z ** 2));

  const daggerMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#9b30ff'),
    transparent: true,
    opacity: 0.95,
    blending: AdditiveBlending,
    depthWrite: false,
  }), []);

  const glowMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#cc44ff'),
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
    depthWrite: false,
  }), []);

  const trailMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#5500bb'),
    transparent: true,
    opacity: 0.3,
    blending: AdditiveBlending,
    depthWrite: false,
  }), []);

  // Snap to start position and set fixed rotation before the first frame.
  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(startPosition);
    groupRef.current.rotation.set(pitch, yaw, 0, 'YXZ');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    if (doneRef.current || !groupRef.current) return;

    timeRef.current += delta;
    const progress = Math.min(timeRef.current / duration, 1.0);

    const currentPos = startPosition
      .clone()
      .addScaledVector(direction, progress * totalDist);

    groupRef.current.position.copy(currentPos);

    // Fade out in the final 15% of travel
    const opacity = progress > 0.85 ? 1 - (progress - 0.85) / 0.15 : 1.0;
    daggerMat.opacity = 0.95 * opacity;
    glowMat.opacity   = 0.5  * opacity;
    trailMat.opacity  = 0.3  * opacity;

    // Client-side collision check against the local player
    const playerPos = getPlayerPosition();
    if (playerPos && currentPos.distanceTo(playerPos) < HIT_RADIUS) {
      doneRef.current = true;
      onHitPlayer();
      onComplete();
      return;
    }

    if (progress >= 1.0) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    // groupRef position and rotation are set imperatively; the JSX values
    // serve as fallback initial values only.
    <group ref={groupRef}>
      {/* Blade core — thin box aligned along local +Z */}
      <mesh material={daggerMat}>
        <boxGeometry args={[0.07, 0.07, 0.55]} />
      </mesh>

      {/* Soft outer glow */}
      <mesh material={glowMat}>
        <boxGeometry args={[0.2, 0.2, 0.7]} />
      </mesh>

      {/* Trailing wake — offset behind the blade tip */}
      <mesh material={trailMat} position={[0, 0, 0.55]}>
        <boxGeometry args={[0.13, 0.13, 0.9]} />
      </mesh>

      <pointLight color="#9b30ff" intensity={5} distance={3.5} decay={2} />
    </group>
  );
}
