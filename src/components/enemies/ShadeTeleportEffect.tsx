'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, MeshBasicMaterial, Color, AdditiveBlending } from 'three';

interface ShadeTeleportEffectProps {
  position: Vector3;
  type: 'start' | 'end';
  onComplete: () => void;
}

// Departure: 0.55 s — shadow collapses inward and vanishes
// Arrival:   0.65 s — shadow explodes outward then fades
const DURATION_START = 0.55;
const DURATION_END   = 0.65;

export default function ShadeTeleportEffect({ position, type, onComplete }: ShadeTeleportEffectProps) {
  const groupRef = useRef<Group>(null);
  const timeRef  = useRef(0);
  const doneRef  = useRef(false);

  const duration = type === 'start' ? DURATION_START : DURATION_END;

  // Four shadow-wisp orbs distributed at cardinal points
  const orbAngles = useMemo(() => [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2], []);

  // Two shared materials — mutated each frame, disposed on unmount
  const mats = useMemo(() => ({
    core:  new MeshBasicMaterial({ color: new Color('#00ccbb'), transparent: true, opacity: 1.0, blending: AdditiveBlending, depthWrite: false }),
    wisp:  new MeshBasicMaterial({ color: new Color('#004444'), transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false }),
    ring:  new MeshBasicMaterial({ color: new Color('#00ffcc'), transparent: true, opacity: 0.6,  blending: AdditiveBlending, depthWrite: false, side: 2 }),
    smoke: new MeshBasicMaterial({ color: new Color('#002233'), transparent: true, opacity: 0.5,  blending: AdditiveBlending, depthWrite: false }),
  }), []);

  useEffect(() => () => { Object.values(mats).forEach(m => m.dispose()); }, [mats]);

  // Refs for animated meshes (avoid React state to stay allocation-free per frame)
  const coreRef  = useRef<any>(null);
  const ringRef  = useRef<any>(null);
  const smokeRef = useRef<any>(null);
  const orbRefs  = useRef<(any | null)[]>([null, null, null, null]);

  useFrame((_, delta) => {
    if (doneRef.current) return;

    timeRef.current += delta;
    const t = Math.min(timeRef.current / duration, 1.0);

    if (type === 'start') {
      // ── Departure: core shrinks + fades, ring expands outward, wisps implode ──
      const fadeOut = 1.0 - t;

      if (coreRef.current) {
        const s = Math.max(0.001, 1.0 - t * 0.9);
        coreRef.current.scale.setScalar(s);
        mats.core.opacity = fadeOut * 0.9;
      }

      if (ringRef.current) {
        // Ring expands outward as shadow dissipates
        const rs = 0.4 + t * 1.2;
        ringRef.current.scale.setScalar(rs);
        mats.ring.opacity = fadeOut * 0.6;
      }

      if (smokeRef.current) {
        const ss = 0.8 + t * 0.6;
        smokeRef.current.scale.set(ss, 1, ss);
        mats.smoke.opacity = fadeOut * 0.5;
      }

      // Wisps: implode toward center
      orbRefs.current.forEach((ref, i) => {
        if (!ref) return;
        const angle  = orbAngles[i] + timeRef.current * 6;
        const radius = Math.max(0, 0.7 * (1.0 - t));
        ref.position.set(Math.cos(angle) * radius, 0.3, Math.sin(angle) * radius);
        mats.wisp.opacity = fadeOut * 0.85;
      });

    } else {
      // ── Arrival: core blooms then shrinks, ring bursts outward, wisps scatter ──
      const boom  = t < 0.3 ? t / 0.3 : 1.0 - (t - 0.3) / 0.7;
      const fade  = t < 0.25 ? 1.0 : 1.0 - (t - 0.25) / 0.75;

      if (coreRef.current) {
        const s = 0.3 + boom * 0.9;
        coreRef.current.scale.setScalar(Math.max(0.001, s));
        mats.core.opacity = boom * 0.95;
      }

      if (ringRef.current) {
        const rs = 0.2 + t * 1.6;
        ringRef.current.scale.setScalar(rs);
        mats.ring.opacity = fade * 0.65;
      }

      if (smokeRef.current) {
        const ss = 0.2 + t * 1.1;
        smokeRef.current.scale.set(ss, 1, ss);
        mats.smoke.opacity = fade * 0.45;
      }

      // Wisps: scatter outward from center
      orbRefs.current.forEach((ref, i) => {
        if (!ref) return;
        const angle  = orbAngles[i] + timeRef.current * -5;
        const radius = t * 0.9;
        ref.position.set(Math.cos(angle) * radius, 0.2 + t * 0.4, Math.sin(angle) * radius);
        mats.wisp.opacity = fade * 0.85;
      });
    }

    if (t >= 1.0) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]}>

      {/* Hollow ground ring */}
      <mesh ref={ringRef} material={mats.ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.25, 0.55, 20]} />
      </mesh>

      {/* Smoke disc on ground */}
      <mesh ref={smokeRef} material={mats.smoke} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.7, 16]} />
      </mesh>

      {/* Central energy core */}
      <mesh ref={coreRef} material={mats.core} position={[0, 0.5, 0]}>
        <octahedronGeometry args={[0.22, 0]} />
      </mesh>

      {/* Four shadow wisps — positions driven by useFrame */}
      {orbAngles.map((_, i) => (
        <mesh
          key={i}
          ref={el => { orbRefs.current[i] = el; }}
          material={mats.wisp}
        >
          <sphereGeometry args={[0.09, 6, 6]} />
        </mesh>
      ))}

      {/* Soft cyan light pulse */}
      <pointLight color="#00bbaa" intensity={6} distance={4} decay={2} position={[0, 0.5, 0]} />
    </group>
  );
}
