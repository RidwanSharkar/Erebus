'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, Mesh, MeshBasicMaterial, Color, AdditiveBlending } from 'three';
import { acquireDynamicLight, type DynamicLightHandle } from '@/utils/dynamicLights';
import ViperArrowTrail from './ViperArrowTrail';

interface ViperArrowProjectileProps {
  startPosition: Vector3;
  targetPosition: Vector3;
  damage: number;
  maxRange?: number;
  /** Units per second. Watch-tower / viper default is 25. */
  speed?: number;
  getPlayerPosition: () => Vector3 | null;
  onHitPlayer: () => void;
  onComplete: () => void;
  /** Persistent tower shots stay mounted and replay; default true for viper enemies. */
  active?: boolean;
  enableLight?: boolean;
  trailLength?: number;
  shotSeq?: number;
}

const SPEED = 25; // units per second
const HIT_RADIUS = 1.05;
const _arrowPosScratch = new Vector3();
/** Must match `VIPER_ARROW_MAX_RANGE` in backend `enemyAI.js` → `telegraphViperAttack`. */
export const VIPER_ARROW_MAX_RANGE = 18;
export const VIPER_ARROW_SPEED = SPEED;

export default function ViperArrowProjectile({
  startPosition,
  targetPosition,
  damage: _damage,
  maxRange = VIPER_ARROW_MAX_RANGE,
  speed = SPEED,
  getPlayerPosition,
  onHitPlayer,
  onComplete,
  active = true,
  enableLight = true,
  trailLength,
  shotSeq = 0,
}: ViperArrowProjectileProps) {
  const groupRef = useRef<Group>(null);
  const arrowTipRef = useRef<Mesh>(null);
  const timeRef  = useRef(0);
  const doneRef  = useRef(false);
  const arrowLight = useRef<DynamicLightHandle | null>(null);

  useEffect(() => {
    if (!active || !enableLight) {
      arrowLight.current?.release();
      arrowLight.current = null;
      return;
    }
    arrowLight.current = acquireDynamicLight({
      color: new Color('#aaff00'),
      distance: 6,
      decay: 2,
      priority: 1,
    });
    return () => {
      arrowLight.current?.release();
      arrowLight.current = null;
    };
  }, [active, enableLight]);

  // `targetPosition` is the aim point; the arrow always travels `VIPER_ARROW_MAX_RANGE` along that ray.
  const { direction, totalDist, duration, yaw, pitch } = useMemo(() => {
    const d = new Vector3().subVectors(targetPosition, startPosition);
    const lenSq = d.lengthSq();
    if (lenSq < 1e-8) d.set(0, 0, -1);
    else d.normalize();
    const dist = maxRange;
    return {
      direction: d,
      totalDist: dist,
      duration:  dist / speed,
      yaw:   Math.atan2(d.x, d.z),
      pitch: Math.atan2(-d.y, Math.sqrt(d.x * d.x + d.z * d.z)),
    };
  }, [startPosition, targetPosition, maxRange, speed]);

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

  useEffect(() => {
    const mats = [coreMat, midMat, glowMat, outerMat, streakMat];
    return () => { mats.forEach((m) => m.dispose()); };
  }, [coreMat, midMat, glowMat, outerMat, streakMat]);

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(startPosition);
    groupRef.current.rotation.set(pitch, yaw, 0, 'YXZ');
    timeRef.current = 0;
    doneRef.current = false;
    if (groupRef.current) groupRef.current.visible = active;
  }, [startPosition, pitch, yaw, shotSeq, active]);

  useFrame((_, delta) => {
    if (!active || doneRef.current || !groupRef.current) {
      if (!active) arrowLight.current?.setIntensity(0);
      return;
    }

    timeRef.current += delta;
    const t        = timeRef.current;
    const progress = Math.min(t / duration, 1.0);

    // Advance position along the fixed direction vector.
    groupRef.current.position.copy(
      _arrowPosScratch.copy(startPosition).addScaledVector(direction, progress * totalDist)
    );

    // Drive the pooled light at the arrow's world position.
    const ap = groupRef.current.position;
    if (enableLight) {
      arrowLight.current?.setPosition(ap.x, ap.y, ap.z);
      arrowLight.current?.setIntensity(14);
    }

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
    <>
    <group ref={groupRef} visible={active}>

      {/* ── Arrowhead ─────────────────────────────────────────────────────── */}
      {/* White-hot tip cone — points forward along -Z (cone opens toward +Z) */}
      <mesh ref={arrowTipRef} material={coreMat} position={[0, 0, -0.3]} rotation={[Math.PI / 2, 0, 0]}>
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

    </group>

    <ViperArrowTrail
      color="#ccff00"
      size={0.2}
      arrowHeadRef={arrowTipRef}
      opacity={active ? 1 : 0}
      maxLength={trailLength}
      resetSeq={shotSeq}
    />
    </>
  );
}
