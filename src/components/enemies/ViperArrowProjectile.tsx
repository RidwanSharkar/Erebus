'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, MeshBasicMaterial, Color, AdditiveBlending } from 'three';

interface ViperArrowProjectileProps {
  startPosition: Vector3;
  targetPosition: Vector3;
  damage: number;
  getPlayerPosition: () => Vector3 | null;
  onHitPlayer: () => void;
  onComplete: () => void;
}

const SPEED      = 28;   // units per second
const HIT_RADIUS = 1.05;

export default function ViperArrowProjectile({
  startPosition,
  targetPosition,
  damage: _damage,
  getPlayerPosition,
  onHitPlayer,
  onComplete,
}: ViperArrowProjectileProps) {
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

  // Align local +Z with travel direction.
  const yaw   = Math.atan2(direction.x, direction.z);
  const pitch = Math.atan2(-direction.y, Math.sqrt(direction.x ** 2 + direction.z ** 2));

  // ─── Materials ─────────────────────────────────────────────────────────────
  // White-hot core → lime outer glow → dark-green trail — all additive so they
  // stack and bloom correctly over each other.

  const coreMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#ffffff'),
    transparent: true, opacity: 1.0,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const midMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#ccff00'),
    transparent: true, opacity: 0.9,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const glowMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#55dd00'),
    transparent: true, opacity: 0.5,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const outerMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#22aa00'),
    transparent: true, opacity: 0.25,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  // Discharge streaks — thin bright lines at radial offsets that fork off the
  // central beam, simulating arcing energy discharge.
  const streakMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#aaff44'),
    transparent: true, opacity: 0.7,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  // Mid trail — the bulk of the visible wake behind the arrow.
  const trailMidMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#44bb00'),
    transparent: true, opacity: 0.4,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  // Far trail — long faint smear that evokes explosive speed.
  const trailFarMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#115500'),
    transparent: true, opacity: 0.18,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(startPosition);
    groupRef.current.rotation.set(pitch, yaw, 0, 'YXZ');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    if (doneRef.current || !groupRef.current) return;

    timeRef.current += delta;
    const t        = timeRef.current;
    const progress = Math.min(t / duration, 1.0);

    // Advance position along the fixed direction vector.
    groupRef.current.position.copy(
      startPosition.clone().addScaledVector(direction, progress * totalDist)
    );

    // Fade out in the last 25 % of travel.
    const fade = progress > 0.75 ? 1 - (progress - 0.75) / 0.25 : 1.0;

    // Pulse the core and streaks at two different frequencies for an unstable,
    // overcharged feel — sin oscillates the materials in place of shader uniforms.
    const pulse  = 0.85 + 0.15 * Math.sin(t * 28);   // fast shimmer on core
    const pulse2 = 0.75 + 0.25 * Math.sin(t * 18 + 1.2); // slightly slower for streaks

    coreMat.opacity     = 1.0  * fade * pulse;
    midMat.opacity      = 0.9  * fade * pulse;
    glowMat.opacity     = 0.50 * fade;
    outerMat.opacity    = 0.25 * fade;
    streakMat.opacity   = 0.70 * fade * pulse2;
    trailMidMat.opacity = 0.40 * fade;
    trailFarMat.opacity = 0.18 * fade;

    // Collision check.
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

      {/* ── Arrowhead ─────────────────────────────────────────────────────── */}
      {/* White-hot tip cone — points forward along -Z (cone opens toward +Z) */}
      <mesh material={coreMat} position={[0, 0, -0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.065, 0.32, 6]} />
      </mesh>

      {/* Lime halo around the tip */}
      <mesh material={midMat} position={[0, 0, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.13, 0.28, 6]} />
      </mesh>

      {/* ── Core shaft ────────────────────────────────────────────────────── */}
      <mesh material={coreMat} position={[0, 0, 0.2]}>
        <boxGeometry args={[0.045, 0.045, 0.55]} />
      </mesh>

      {/* Mid shaft glow */}
      <mesh material={midMat} position={[0, 0, 0.2]}>
        <boxGeometry args={[0.1, 0.1, 0.65]} />
      </mesh>

      {/* Outer bloom around shaft */}
      <mesh material={glowMat} position={[0, 0, 0.1]}>
        <boxGeometry args={[0.22, 0.22, 0.85]} />
      </mesh>

      {/* Wide outer haze */}
      <mesh material={outerMat} position={[0, 0, 0.05]}>
        <boxGeometry args={[0.4, 0.4, 1.1]} />
      </mesh>

      {/* ── Discharge streaks ─────────────────────────────────────────────── */}
      {/* Four thin arcs forking radially, angled very slightly outward.
          Each is offset and rotated so they look like energy arcing off the shaft. */}

      {/* +Y streak */}
      <mesh material={streakMat} position={[0, 0.09, 0.35]} rotation={[0.09, 0, 0]}>
        <boxGeometry args={[0.025, 0.025, 1.4]} />
      </mesh>
      {/* -Y streak */}
      <mesh material={streakMat} position={[0, -0.09, 0.35]} rotation={[-0.09, 0, 0]}>
        <boxGeometry args={[0.025, 0.025, 1.4]} />
      </mesh>
      {/* +X streak */}
      <mesh material={streakMat} position={[0.09, 0, 0.35]} rotation={[0, 0, 0.09]}>
        <boxGeometry args={[0.025, 0.025, 1.4]} />
      </mesh>
      {/* -X streak */}
      <mesh material={streakMat} position={[-0.09, 0, 0.35]} rotation={[0, 0, -0.09]}>
        <boxGeometry args={[0.025, 0.025, 1.4]} />
      </mesh>

      {/* Diagonal streaks — 45° rotations for a full starburst cross-section */}
      <mesh material={streakMat} position={[0.065, 0.065, 0.4]} rotation={[0.07, 0, 0.07]}>
        <boxGeometry args={[0.018, 0.018, 1.2]} />
      </mesh>
      <mesh material={streakMat} position={[-0.065, 0.065, 0.4]} rotation={[0.07, 0, -0.07]}>
        <boxGeometry args={[0.018, 0.018, 1.2]} />
      </mesh>
      <mesh material={streakMat} position={[0.065, -0.065, 0.4]} rotation={[-0.07, 0, 0.07]}>
        <boxGeometry args={[0.018, 0.018, 1.2]} />
      </mesh>
      <mesh material={streakMat} position={[-0.065, -0.065, 0.4]} rotation={[-0.07, 0, -0.07]}>
        <boxGeometry args={[0.018, 0.018, 1.2]} />
      </mesh>

      {/* ── Trail layers ──────────────────────────────────────────────────── */}
      {/* Medium wake — bright green smear directly behind shaft */}
      <mesh material={trailMidMat} position={[0, 0, 1.2]}>
        <boxGeometry args={[0.12, 0.12, 2.0]} />
      </mesh>

      {/* Far wake — very long faint smear for explosive speed feel */}
      <mesh material={trailFarMat} position={[0, 0, 2.8]}>
        <boxGeometry args={[0.07, 0.07, 4.0]} />
      </mesh>

      {/* ── Lights ────────────────────────────────────────────────────────── */}
      {/* Main point light at the tip — bright lime bloom */}
      <pointLight color="#aaff00" intensity={14} distance={6} decay={2} />

      {/* Secondary softer light trailing behind, lighting up the environment */}
      <pointLight color="#44cc00" intensity={5} distance={4} decay={2} position={[0, 0, 1.5]} />
    </group>
  );
}
