'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, MeshBasicMaterial, Color, AdditiveBlending } from 'three';

interface BossSpearProjectileProps {
  startPosition: Vector3;
  targetPosition: Vector3;
  damage: number;
  getPlayerPosition: () => Vector3 | null;
  onHitPlayer: () => void;
  onComplete: () => void;
}

const BOSS_SPEAR_SPEED = 22; // units per second
const HIT_RADIUS = 0.9;
/** Must match `BOSS_THROW_MAX_RANGE` in backend `enemyAI.js`. */
export const BOSS_SPEAR_MAX_RANGE = 12;

export default function BossSpearProjectile({
  startPosition,
  targetPosition,
  damage: _damage,
  getPlayerPosition,
  onHitPlayer,
  onComplete,
}: BossSpearProjectileProps) {
  const groupRef = useRef<Group>(null);
  const timeRef  = useRef(0);
  const doneRef  = useRef(false);

  const { direction, totalDist, duration, yaw, pitch } = useMemo(() => {
    const d = new Vector3().subVectors(targetPosition, startPosition);
    const lenSq = d.lengthSq();
    if (lenSq < 1e-8) d.set(0, 0, -1);
    else d.normalize();
    const dist = BOSS_SPEAR_MAX_RANGE;
    return {
      direction: d,
      totalDist: dist,
      duration:  dist / BOSS_SPEAR_SPEED,
      yaw:   Math.atan2(d.x, d.z),
      pitch: Math.atan2(-d.y, Math.sqrt(d.x * d.x + d.z * d.z)),
    };
  }, [startPosition, targetPosition]);

  // ── Materials ──────────────────────────────────────────────────────────────
  // Bronze/iron spear: white-hot tip fading through orange-gold to dark iron.

  const tipMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#ffffff'),
    transparent: true, opacity: 1.0,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const coreMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#ff9900'),
    transparent: true, opacity: 0.95,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const midMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#cc5500'),
    transparent: true, opacity: 0.75,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const glowMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#ff6600'),
    transparent: true, opacity: 0.45,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const outerMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#882200'),
    transparent: true, opacity: 0.22,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const trailMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#cc4400'),
    transparent: true, opacity: 0.38,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const trailFarMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#441100'),
    transparent: true, opacity: 0.16,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(startPosition);
    groupRef.current.rotation.set(pitch, yaw, 0, 'YXZ');
  }, [startPosition, pitch, yaw]);

  useFrame((_, delta) => {
    if (doneRef.current || !groupRef.current) return;

    timeRef.current += delta;
    const t        = timeRef.current;
    const progress = Math.min(t / duration, 1.0);

    groupRef.current.position.copy(
      startPosition.clone().addScaledVector(direction, progress * totalDist)
    );

    // Fade out in last 20% of travel
    const fade = progress > 0.80 ? 1 - (progress - 0.80) / 0.20 : 1.0;

    // Subtle pulse on the hot tip
    const pulse = 0.88 + 0.12 * Math.sin(t * 22);

    tipMat.opacity     = 1.0  * fade * pulse;
    coreMat.opacity    = 0.95 * fade * pulse;
    midMat.opacity     = 0.75 * fade;
    glowMat.opacity    = 0.45 * fade;
    outerMat.opacity   = 0.22 * fade;
    trailMat.opacity   = 0.38 * fade;
    trailFarMat.opacity = 0.16 * fade;

    // Hit detection against local player
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
    <group ref={groupRef} scale={1.5}>

      {/* ── Spear tip ─────────────────────────────────────────────────────── */}
      {/* White-hot pointed tip cone, opening toward +Z */}
      <mesh material={tipMat} position={[0, 0, -0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.055, 0.45, 5]} />
      </mesh>

      {/* Orange halo around tip */}
      <mesh material={coreMat} position={[0, 0, -0.28]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.11, 0.38, 5]} />
      </mesh>

      {/* ── Spear shaft ───────────────────────────────────────────────────── */}
      {/* Narrow core shaft — elongated to look like a long spear */}
      <mesh material={coreMat} position={[0, 0, 0.55]}>
        <boxGeometry args={[0.05, 0.05, 1.4]} />
      </mesh>

      {/* Mid glow around shaft */}
      <mesh material={midMat} position={[0, 0, 0.55]}>
        <boxGeometry args={[0.1, 0.1, 1.55]} />
      </mesh>

      {/* Outer bloom */}
      <mesh material={glowMat} position={[0, 0, 0.45]}>
        <boxGeometry args={[0.2, 0.2, 1.8]} />
      </mesh>

      {/* Wide outer haze */}
      <mesh material={outerMat} position={[0, 0, 0.35]}>
        <boxGeometry args={[0.38, 0.38, 2.1]} />
      </mesh>

      {/* ── Tail / wake ───────────────────────────────────────────────────── */}
      <mesh material={trailMat} position={[0, 0, 1.8]}>
        <boxGeometry args={[0.1, 0.1, 2.2]} />
      </mesh>

      <mesh material={trailFarMat} position={[0, 0, 3.4]}>
        <boxGeometry args={[0.06, 0.06, 3.6]} />
      </mesh>

      {/* ── Lights ────────────────────────────────────────────────────────── */}
      <pointLight color="#ff7700" intensity={18} distance={7} decay={2} />
      <pointLight color="#cc4400" intensity={6} distance={5} decay={2} position={[0, 0, 1.8]} />
    </group>
  );
}
