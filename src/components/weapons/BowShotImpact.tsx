'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Group,
  Mesh,
  MeshBasicMaterial,
  Color,
  AdditiveBlending,
} from 'three';

interface BowShotImpactProps {
  position: Vector3;
  /** Normalized projectile travel direction — used to orient the streak burst. */
  direction: Vector3;
  onComplete: () => void;
}

const DURATION     = 0.35; // seconds
const STREAK_COUNT = 1;

// Warm orange / amber palette
const COLOR_FLASH    = new Color('#fffde0');
const COLOR_RING     = new Color('#ff7722');
const COLOR_STREAK_A = new Color('#ff7722');
const COLOR_STREAK_B = new Color('#ffaa44');

function buildStreakParams(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const base  = (i / count) * Math.PI * 2;
    const angle = base + (Math.random() * 0.25 - 0.125);
    const speed = 5.0 + Math.random() * 3.0;
    const delay = Math.random() * 0.04;
    return { angle, speed, delay };
  });
}

export default function BowShotImpact({
  position,
  onComplete,
}: BowShotImpactProps) {
  const groupRef   = useRef<Group>(null);
  const timeRef    = useRef(0);
  const doneRef    = useRef(false);

  const flashRef  = useRef<Mesh | null>(null);
  const ringRef   = useRef<Mesh | null>(null);
  const streakRefs = useRef<(Mesh | null)[]>(Array(STREAK_COUNT).fill(null));

  const streakParams = useMemo(() => buildStreakParams(STREAK_COUNT), []);

  const flashMat = useMemo(
    () => new MeshBasicMaterial({
      color: COLOR_FLASH,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
    [],
  );

  const ringMat = useMemo(
    () => new MeshBasicMaterial({
      color: COLOR_RING,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      side: 2,
    }),
    [],
  );

  const streakMats = useMemo(
    () => Array.from({ length: STREAK_COUNT }, (_, i) =>
      new MeshBasicMaterial({
        color: i % 2 === 0 ? COLOR_STREAK_A : COLOR_STREAK_B,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    ),
    [],
  );

  useFrame((_, delta) => {
    if (doneRef.current) return;

    timeRef.current += delta;
    const t = timeRef.current;

    if (t >= DURATION) {
      doneRef.current = true;
      onComplete();
      return;
    }

    // ── Central flash disc ───────────────────────────────────────────────
    if (flashRef.current) {
      const flashFade = t < 0.06 ? t / 0.06 : Math.max(0, 1 - (t - 0.06) / 0.14);
      const scale     = 0.2 + t * 8.0;
      flashRef.current.scale.set(scale, scale, 1);
      flashMat.opacity = Math.max(0, flashFade * 0.9);
    }

    // ── Expanding amber ring ─────────────────────────────────────────────
    if (ringRef.current) {
      const progress = Math.min(t / DURATION, 1.0);
      const scale    = progress * 1.2;
      ringRef.current.scale.set(scale, scale, scale);
      const fadeIn  = t < 0.06 ? t / 0.06 : 1.0;
      const fadeOut = t > DURATION * 0.5 ? 1 - (t - DURATION * 0.5) / (DURATION * 0.5) : 1.0;
      ringMat.opacity = Math.max(0, fadeIn * fadeOut * 0.75);
    }

    // ── Radial streaks ───────────────────────────────────────────────────
    for (let i = 0; i < STREAK_COUNT; i++) {
      const mesh = streakRefs.current[i];
      const mat  = streakMats[i];
      if (!mesh) continue;
      const { angle, speed, delay } = streakParams[i];
      const localT = t - delay;
      if (localT <= 0) { mat.opacity = 0; continue; }

      const dist = localT * speed;
      mesh.position.set(Math.sin(angle) * dist, 0, Math.cos(angle) * dist);
      // Rotate streak to face outward
      mesh.rotation.y = -angle;

      const localFade = localT < 0.05
        ? localT / 0.05
        : Math.max(0, 1 - (localT - 0.05) / (DURATION * 0.85));
      mat.opacity = Math.max(0, 0.9 * localFade);
    }
  });

  return (
    <group ref={groupRef} position={[position.x, position.y + 1.25, position.z]}>

      {/* Central flash disc */}
      <mesh ref={flashRef} rotation={[-Math.PI / 2, 0, 0]} scale={[0.01, 0.01, 1]}>
        <circleGeometry args={[1, 20]} />
        <primitive object={flashMat} attach="material" />
      </mesh>

      {/* Expanding amber ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} scale={[0.01, 0.01, 0.01]}>
        <torusGeometry args={[1, 0.06, 5, 40]} />
        <primitive object={ringMat} attach="material" />
      </mesh>

      {/* Radial streaks — elongated thin planes */}
      {streakParams.map((_, i) => (
        <mesh key={i} ref={(el) => { streakRefs.current[i] = el; }}>
          {/* width 0.05, length 0.55 — oriented along Z so rotation.y points outward */}
          <planeGeometry args={[0.05, 0.55]} />
          <primitive object={streakMats[i]} attach="material" />
        </mesh>
      ))}
    </group>
  );
}
