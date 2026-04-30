'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Group,
  Mesh,
  MeshBasicMaterial,
  Color,
  AdditiveBlending,
} from 'three';

interface BossLeapShockwaveProps {
  position: Vector3;
  onComplete: () => void;
}

const DURATION = 1.8; // seconds
const RING_COUNT = 4;
const DUST_COUNT = 16;
const GROUND_Y = 0.04;

// Staggered ring parameters: [startDelay, maxRadius, thickness, baseOpacity]
const RING_PARAMS: [number, number, number, number][] = [
  [0.00, 6.5, 0.28, 0.90],
  [0.07, 5.2, 0.18, 0.75],
  [0.15, 7.8, 0.12, 0.55],
  [0.25, 4.0, 0.22, 0.65],
];

// Dust quad parameters precomputed per instance
function buildDustParams(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (Math.random() * 0.3 - 0.15);
    const speed = 5.5 + Math.random() * 3.5;
    const delay = Math.random() * 0.12;
    const size  = 0.35 + Math.random() * 0.55;
    const yOff  = Math.random() * 0.25;
    return { angle, speed, delay, size, yOff };
  });
}

export default function BossLeapShockwave({ position, onComplete }: BossLeapShockwaveProps) {
  const groupRef   = useRef<Group>(null);
  const timeRef    = useRef(0);
  const doneRef    = useRef(false);

  // Refs for the animated ring meshes
  const ringRefs   = useRef<(Mesh | null)[]>(Array(RING_COUNT).fill(null));
  // Refs for animated dust quads
  const dustRefs   = useRef<(Mesh | null)[]>(Array(DUST_COUNT).fill(null));
  // Ground flash disk ref
  const flashRef   = useRef<Mesh | null>(null);

  const dustParams = useMemo(() => buildDustParams(DUST_COUNT), []);

  // Ring materials (one per ring so opacity can be animated independently)
  const ringMats = useMemo(() =>
    Array.from({ length: RING_COUNT }, (_, i) =>
      new MeshBasicMaterial({
        color: new Color(i % 2 === 0 ? '#e8dfc8' : '#c4b898'),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2, // DoubleSide
      })
    ), []);

  // Dust materials — two alternating dusty tones
  const dustMats = useMemo(() =>
    Array.from({ length: DUST_COUNT }, (_, i) =>
      new MeshBasicMaterial({
        color: new Color(i % 3 === 0 ? '#d4c8a8' : i % 3 === 1 ? '#b8aa88' : '#e0d4b4'),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      })
    ), []);

  // Ground flash material
  const flashMat = useMemo(() =>
    new MeshBasicMaterial({
      color: new Color('#c8b888'),
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    }), []);

  useFrame((_, delta) => {
    if (doneRef.current) return;

    timeRef.current += delta;
    const t = timeRef.current;

    if (t >= DURATION) {
      doneRef.current = true;
      onComplete();
      return;
    }

    const globalFade = t > DURATION * 0.6
      ? 1 - (t - DURATION * 0.6) / (DURATION * 0.4)
      : 1.0;

    // ── Ground flash disk ──────────────────────────────────────────────────
    if (flashRef.current) {
      const flashT = Math.min(t / 0.25, 1.0); // fully expanded in 0.25s
      const flashFade = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.8;
      const scale = flashT * 6.5;
      flashRef.current.scale.set(scale, scale, 1);
      flashMat.opacity = Math.max(0, flashFade * 0.55);
    }

    // ── Expanding rings ────────────────────────────────────────────────────
    for (let i = 0; i < RING_COUNT; i++) {
      const mesh = ringRefs.current[i];
      const mat  = ringMats[i];
      if (!mesh) continue;
      const [delay, maxR, , baseOpacity] = RING_PARAMS[i];
      const localT = t - delay;
      if (localT <= 0) { mat.opacity = 0; continue; }
      const progress = Math.min(localT / (DURATION * 0.75), 1.0);
      const radius = progress * maxR;
      // Scale the torus by stretching the group scale — easier than re-creating geometry
      mesh.scale.set(radius, radius, 1);
      // Fade: burst in fast, linger, fade with global
      const burstFade = localT < 0.12 ? localT / 0.12 : 1.0;
      mat.opacity = Math.max(0, baseOpacity * burstFade * globalFade * (1 - progress * 0.55));
    }

    // ── Radial dust quads ──────────────────────────────────────────────────
    for (let i = 0; i < DUST_COUNT; i++) {
      const mesh = dustRefs.current[i];
      const mat  = dustMats[i];
      if (!mesh) continue;
      const { angle, speed, delay, size, yOff } = dustParams[i];
      const localT = t - delay;
      if (localT <= 0) { mat.opacity = 0; continue; }
      const dist = localT * speed;
      mesh.position.set(
        Math.sin(angle) * dist,
        yOff + localT * 0.8,  // slight upward drift
        Math.cos(angle) * dist
      );
      // Scale up as they expand
      const s = size * (0.5 + localT * 1.2);
      mesh.scale.set(s, s, s);
      // Fade: bloom in first 0.15s, then fade out
      const localFade = localT < 0.15 ? localT / 0.15 : Math.max(0, 1 - (localT - 0.15) / (DURATION - 0.15));
      mat.opacity = Math.max(0, 0.72 * localFade * globalFade);
    }
  });

  return (
    <group ref={groupRef} position={[position.x, GROUND_Y, position.z]}>

      {/* Ground flash disk */}
      <mesh ref={flashRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1, 32]} />
        <primitive object={flashMat} attach="material" />
      </mesh>

      {/* Expanding torus rings */}
      {RING_PARAMS.map(([, , thickness], i) => (
        <mesh
          key={i}
          ref={(el) => { ringRefs.current[i] = el; }}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          {/* tubeRadius drives visual thickness; arc radius will be set via scale */}
          <torusGeometry args={[1, thickness, 6, 48]} />
          <primitive object={ringMats[i]} attach="material" />
        </mesh>
      ))}

      {/* Radial dust quads — initial positions near origin, animated in useFrame */}
      {dustParams.map((_, i) => (
        <mesh key={i} ref={(el) => { dustRefs.current[i] = el; }}>
          <planeGeometry args={[1, 1]} />
          <primitive object={dustMats[i]} attach="material" />
        </mesh>
      ))}
    </group>
  );
}
