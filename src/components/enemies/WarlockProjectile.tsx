'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, MeshBasicMaterial, Color, AdditiveBlending } from 'three';

interface WarlockProjectileProps {
  startPosition: Vector3;
  targetPosition: Vector3;
  damage: number;
  getPlayerPosition: () => Vector3 | null;
  onHitPlayer: () => void;
  onComplete: () => void;
}

// Slower than shade daggers — this is a massive spell projectile
const SPEED     = 9;
// Larger hit radius than shade daggers (1.1) — big chaotic orb
const HIT_RADIUS = 1.6;

export default function WarlockProjectile({
  startPosition,
  targetPosition,
  damage: _damage,
  getPlayerPosition,
  onHitPlayer,
  onComplete,
}: WarlockProjectileProps) {
  const groupRef = useRef<Group>(null);
  const timeRef  = useRef(0);
  const doneRef  = useRef(false);

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

  const yaw   = Math.atan2(direction.x, direction.z);
  const pitch  = Math.atan2(-direction.y, Math.sqrt(direction.x ** 2 + direction.z ** 2));

  // Crimson inner core — hot chaotic energy
  const coreMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#cc1133'),
    transparent: true,
    opacity: 0.95,
    blending: AdditiveBlending,
    depthWrite: false,
  }), []);

  // Mid violet swirl layer
  const midMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#7700ee'),
    transparent: true,
    opacity: 0.65,
    blending: AdditiveBlending,
    depthWrite: false,
  }), []);

  // Outer dark-orange chaotic aura
  const auraMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#ff5500'),
    transparent: true,
    opacity: 0.30,
    blending: AdditiveBlending,
    depthWrite: false,
  }), []);

  // Trailing wake
  const trailMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#330055'),
    transparent: true,
    opacity: 0.25,
    blending: AdditiveBlending,
    depthWrite: false,
  }), []);

  // Snap to start and set orientation before the first frame
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
    // Slow spin around the travel axis gives the orb a chaotic, churning look
    groupRef.current.rotation.z += delta * 2.5;

    // Fade out in the final 20% of travel
    const opacity = progress > 0.80 ? 1 - (progress - 0.80) / 0.20 : 1.0;
    coreMat.opacity  = 0.95 * opacity;
    midMat.opacity   = 0.65 * opacity;
    auraMat.opacity  = 0.30 * opacity;
    trailMat.opacity = 0.25 * opacity;

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
    // groupRef position and rotation are set imperatively; JSX values are fallback only
    <group ref={groupRef}>
      {/* Solid crimson core */}
      <mesh material={coreMat}>
        <sphereGeometry args={[0.28, 10, 10]} />
      </mesh>

      {/* Mid violet swirl */}
      <mesh material={midMat}>
        <sphereGeometry args={[0.46, 10, 10]} />
      </mesh>

      {/* Outer chaotic aura */}
      <mesh material={auraMat}>
        <sphereGeometry args={[0.68, 10, 10]} />
      </mesh>

      {/* Elongated trailing wake along local +Z */}
      <mesh material={trailMat} position={[0, 0, 0.85]}>
        <sphereGeometry args={[0.22, 8, 8]} />
      </mesh>
      <mesh material={trailMat} position={[0, 0, 1.4]}>
        <sphereGeometry args={[0.13, 6, 6]} />
      </mesh>

      {/* Dual point lights for dramatic scene illumination */}
      <pointLight color="#cc1133" intensity={14} distance={5.5} decay={2} />
      <pointLight color="#7700ee" intensity={7}  distance={3.5} decay={2} />
    </group>
  );
}
