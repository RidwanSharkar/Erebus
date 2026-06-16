'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, MeshBasicMaterial, Color, AdditiveBlending } from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import { VIPER_ARROW_MAX_RANGE } from './ViperArrowProjectile';

// Travel distance matches VIPER_ARROW_MAX_RANGE; keep in sync with backend enemyAI (shade-attack-telegraph maxRange).

interface ShadeDaggerProjectileProps {
  startPosition: Vector3;
  targetPosition: Vector3;
  damage: number;
  getPlayerPosition: () => Vector3 | null;
  onHitPlayer: () => void;
  onComplete: () => void;
}

// Must match backend enemyAI SHADE_DAGGER_PROJECTILE_SPEED (post-attack blink delay uses this).
const SPEED = 25; // units per second — match ViperArrowProjectile
const HIT_RADIUS = 1.05; // match ViperArrowProjectile

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

  // One pooled light follows the dagger (replaces a mounted <pointLight>).
  const daggerLight = useDynamicLight({ color: new Color('#9b30ff'), distance: 3.5, decay: 2, priority: 2 });

  // `targetPosition` is the aim point; the dagger always travels `VIPER_ARROW_MAX_RANGE` along that ray.
  const { direction, totalDist, duration, yaw, pitch } = useMemo(() => {
    const d = new Vector3().subVectors(targetPosition, startPosition);
    const lenSq = d.lengthSq();
    if (lenSq < 1e-8) d.set(0, 0, -1);
    else d.normalize();
    const dist = VIPER_ARROW_MAX_RANGE;
    return {
      direction: d,
      totalDist: dist,
      duration: dist / SPEED,
      yaw: Math.atan2(d.x, d.z),
      pitch: Math.atan2(-d.y, Math.sqrt(d.x * d.x + d.z * d.z)),
    };
  }, [startPosition, targetPosition]);

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

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(startPosition);
    groupRef.current.rotation.set(pitch, yaw, 0, 'YXZ');
  }, [startPosition, pitch, yaw]);

  useFrame((_, delta) => {
    if (doneRef.current || !groupRef.current) return;

    timeRef.current += delta;
    const t = timeRef.current;
    const progress = Math.min(t / duration, 1.0);

    groupRef.current.position.copy(
      startPosition.clone().addScaledVector(direction, progress * totalDist)
    );

    // Drive the pooled light at the dagger's world position.
    const dp = groupRef.current.position;
    daggerLight.current?.setPosition(dp.x, dp.y, dp.z);
    daggerLight.current?.setIntensity(5);

    // Fade out in the last 25% of travel — match ViperArrowProjectile
    const opacity = progress > 0.75 ? 1 - (progress - 0.75) / 0.25 : 1.0;
    daggerMat.opacity = 0.95 * opacity;
    glowMat.opacity   = 0.5  * opacity;
    trailMat.opacity  = 0.3  * opacity;

    const playerPos = getPlayerPosition();
    const currentPos = groupRef.current.position;
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
    <group ref={groupRef}>
      <mesh material={daggerMat}>
        <boxGeometry args={[0.07, 0.07, 0.55]} />
      </mesh>

      <mesh material={glowMat}>
        <boxGeometry args={[0.2, 0.2, 0.7]} />
      </mesh>

      <mesh material={trailMat} position={[0, 0, 0.55]}>
        <boxGeometry args={[0.13, 0.13, 0.9]} />
      </mesh>
    </group>
  );
}
