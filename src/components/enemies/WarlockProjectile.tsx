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

const SPEED      = 9;    // units per second
const TURN_RATE  = 1.8;  // radians per second — moderate homing, still dodge-able
const HIT_RADIUS = 1.6;

export default function WarlockProjectile({
  startPosition,
  targetPosition,
  damage: _damage,
  getPlayerPosition,
  onHitPlayer,
  onComplete,
}: WarlockProjectileProps) {
  const groupRef    = useRef<Group>(null);
  const spinRef     = useRef<Group>(null); // inner cosmetic-spin group (orb layers + trail)
  const ring1Ref    = useRef<Group>(null);
  const ring2Ref    = useRef<Group>(null);
  const ring3Ref    = useRef<Group>(null);
  const timeRef     = useRef(0);
  const doneRef     = useRef(false);

  // Mutable travel direction — updated each frame for homing.
  const currentDirRef = useRef(
    targetPosition.clone().sub(startPosition).normalize()
  );

  const totalDist  = useMemo(() => startPosition.distanceTo(targetPosition), []); // eslint-disable-line react-hooks/exhaustive-deps
  // Give the orb 50% more time than a straight-line shot in case it curves.
  const maxLifetime = (totalDist / SPEED) * 1.5;

  // ─── Materials ─────────────────────────────────────────────────────────────

  // Void core — near-black blood red; creates a "dark star" silhouette.
  const voidMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#1a0005'),
    transparent: true, opacity: 0.92,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  // Inner crimson orb — the churning energy heart.
  const coreMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#dd1133'),
    transparent: true, opacity: 0.95,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  // Mid violet chaos swirl.
  const midMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#8800ff'),
    transparent: true, opacity: 0.60,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  // Orange hot aura — unstable chaotic energy radiating outward.
  const auraMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#ff5500'),
    transparent: true, opacity: 0.28,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  // Dark outer haze — the "gravity well" shell.
  const hazeMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#220033'),
    transparent: true, opacity: 0.18,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  // Rings — each with its own colour for contrast.
  const ring1Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#cc0044'),
    transparent: true, opacity: 0.75,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const ring2Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#9900ff'),
    transparent: true, opacity: 0.65,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const ring3Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#ff6600'),
    transparent: true, opacity: 0.55,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  // Trail blobs — progressively darker and smaller.
  const trail1Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#880022'),
    transparent: true, opacity: 0.55,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const trail2Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#550019'),
    transparent: true, opacity: 0.38,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const trail3Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#330010'),
    transparent: true, opacity: 0.22,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const trail4Mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#1a0008'),
    transparent: true, opacity: 0.12,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  // Snap to start before the first frame.
  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(startPosition);
    // Face the initial target direction.
    const dir = currentDirRef.current;
    groupRef.current.rotation.y = Math.atan2(dir.x, dir.z);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    if (doneRef.current || !groupRef.current) return;

    timeRef.current += delta;
    const t = timeRef.current;

    // ── Homing ─────────────────────────────────────────────────────────────
    const playerPos = getPlayerPosition();
    if (playerPos) {
      const toPlayer = playerPos.clone().sub(groupRef.current.position);
      if (toPlayer.length() > 0.5) {
        toPlayer.normalize();
        // Gradually steer currentDir toward the player — TURN_RATE controls how
        // aggressively the orb curves; high enough to track but still dodge-able.
        currentDirRef.current
          .lerp(toPlayer, Math.min(1, TURN_RATE * delta))
          .normalize();
      }
    }

    // ── Advance position ───────────────────────────────────────────────────
    const dir = currentDirRef.current;
    groupRef.current.position.addScaledVector(dir, SPEED * delta);

    // ── Orient group to face travel direction ──────────────────────────────
    groupRef.current.rotation.y = Math.atan2(dir.x, dir.z);

    // ── Cosmetic animations ────────────────────────────────────────────────
    if (spinRef.current)  spinRef.current.rotation.z  += delta * 2.6;
    if (ring1Ref.current) ring1Ref.current.rotation.y += delta * 3.5;
    if (ring2Ref.current) ring2Ref.current.rotation.x -= delta * 2.3;
    if (ring3Ref.current) ring3Ref.current.rotation.z += delta * 2.9;

    // ── Pulsing opacity ────────────────────────────────────────────────────
    const progress = Math.min(t / maxLifetime, 1.0);
    const fade     = progress > 0.70 ? 1 - (progress - 0.70) / 0.30 : 1.0;
    const pulse    = 0.85 + 0.15 * Math.sin(t * 14);
    const pulse2   = 0.78 + 0.22 * Math.sin(t * 9 + 1.3);

    voidMat.opacity   = 0.92 * fade;
    coreMat.opacity   = 0.95 * fade * pulse;
    midMat.opacity    = 0.60 * fade * pulse;
    auraMat.opacity   = 0.28 * fade;
    hazeMat.opacity   = 0.18 * fade;
    ring1Mat.opacity  = 0.75 * fade * pulse2;
    ring2Mat.opacity  = 0.65 * fade * pulse2;
    ring3Mat.opacity  = 0.55 * fade * pulse2;
    trail1Mat.opacity = 0.55 * fade;
    trail2Mat.opacity = 0.38 * fade;
    trail3Mat.opacity = 0.22 * fade;
    trail4Mat.opacity = 0.12 * fade;

    // ── Collision ──────────────────────────────────────────────────────────
    if (playerPos && groupRef.current.position.distanceTo(playerPos) < HIT_RADIUS) {
      doneRef.current = true;
      onHitPlayer();
      onComplete();
      return;
    }

    if (t >= maxLifetime) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    // groupRef — world position + facing direction (updated imperatively)
    <group ref={groupRef}>

      {/* ── Spinning orb layers + trail ─────────────────────────────────── */}
      {/* spinRef rotates around the travel axis for a churning look */}
      <group ref={spinRef}>

        {/* Void core — near-black, creates a "consumed" dark-star look */}
        <mesh material={voidMat}>
          <sphereGeometry args={[0.20, 8, 8]} />
        </mesh>

        {/* Hot crimson inner orb */}
        <mesh material={coreMat}>
          <sphereGeometry args={[0.30, 10, 10]} />
        </mesh>

        {/* Violet chaos swirl — slightly larger, very transparent */}
        <mesh material={midMat}>
          <sphereGeometry args={[0.50, 10, 10]} />
        </mesh>

        {/* Unstable orange aura */}
        <mesh material={auraMat}>
          <sphereGeometry args={[0.72, 10, 10]} />
        </mesh>

        {/* Dark gravity-well haze — outermost shell */}
        <mesh material={hazeMat}>
          <sphereGeometry args={[0.95, 8, 8]} />
        </mesh>

        {/* ── Trail ─────────────────────────────────────────────────────── */}
        {/* Trail blobs are positioned along local +Z (behind the orb as it travels) */}
        <mesh material={trail1Mat} position={[0, 0, 1.0]}>
          <sphereGeometry args={[0.26, 8, 8]} />
        </mesh>
        <mesh material={trail2Mat} position={[0, 0, 1.8]}>
          <sphereGeometry args={[0.18, 7, 7]} />
        </mesh>
        <mesh material={trail3Mat} position={[0, 0, 2.6]}>
          <sphereGeometry args={[0.11, 6, 6]} />
        </mesh>
        <mesh material={trail4Mat} position={[0, 0, 3.4]}>
          <sphereGeometry args={[0.06, 5, 5]} />
        </mesh>
      </group>

      {/* ── Orbital rings ───────────────────────────────────────────────── */}
      {/* Each ring lives in its own group so it can spin independently
          without affecting the orb layers or other rings. */}

      {/* Ring 1 — crimson, horizontal plane, fast y-spin */}
      <group ref={ring1Ref}>
        <mesh material={ring1Mat}>
          <torusGeometry args={[0.60, 0.038, 6, 28]} />
        </mesh>
      </group>

      {/* Ring 2 — violet, tilted 60° on X, medium x-spin (counter) */}
      <group ref={ring2Ref} rotation={[Math.PI / 3, 0, 0]}>
        <mesh material={ring2Mat}>
          <torusGeometry args={[0.68, 0.028, 6, 28]} />
        </mesh>
      </group>

      {/* Ring 3 — orange, tilted -50° on both X and Z, slower z-spin */}
      <group ref={ring3Ref} rotation={[-Math.PI / 3.6, 0, Math.PI / 4]}>
        <mesh material={ring3Mat}>
          <torusGeometry args={[0.55, 0.032, 6, 24]} />
        </mesh>
      </group>

      {/* ── Lights ──────────────────────────────────────────────────────── */}
      {/* Main crimson bloom at the core */}
      <pointLight color="#dd1133" intensity={18} distance={6.5} decay={2} />
      {/* Violet aura wash — slightly offset to make lighting asymmetric */}
      <pointLight color="#8800ff" intensity={9}  distance={4.5} decay={2} position={[0, 0.3, 0]} />
      {/* Orange trail glow */}
      <pointLight color="#ff5500" intensity={5}  distance={3.5} decay={2} position={[0, 0, 1.5]} />
    </group>
  );
}
