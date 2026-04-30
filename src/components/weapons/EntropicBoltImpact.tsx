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

interface EntropicBoltImpactProps {
  position: Vector3;
  /** Normalized projectile travel direction at point of impact. */
  direction: Vector3;
  onComplete: () => void;
}

const DURATION    = 0.4;  // seconds
const SPARK_COUNT = 1;

// Void-purple palette — matches EntropicBolt color theme
const COLOR_FLASH     = new Color('#f0e0ff');
const COLOR_RING_DEEP = new Color('#9333ea');
const COLOR_RING_LITE = new Color('#c084fc');
const COLOR_SPARK_A   = new Color('#c084fc');
const COLOR_SPARK_B   = new Color('#e9d5ff');

function buildSparkParams(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const base  = (i / count) * Math.PI * 2;
    const angle = base + (Math.random() * 0.3 - 0.15);
    const speed = 4.0 + Math.random() * 3.0;
    const delay = Math.random() * 0.05;
    const size  = 0.10 + Math.random() * 0.14;
    const yBias = Math.random() * 0.35;
    return { angle, speed, delay, size, yBias };
  });
}

export default function EntropicBoltImpact({
  position,
  onComplete,
}: EntropicBoltImpactProps) {
  const groupRef  = useRef<Group>(null);
  const timeRef   = useRef(0);
  const doneRef   = useRef(false);

  const flashRef     = useRef<Mesh | null>(null);
  // Two converging rings — start large, shrink inward (implosion feel)
  const ring1Ref     = useRef<Mesh | null>(null);
  const ring2Ref     = useRef<Mesh | null>(null);
  const sparkRefs    = useRef<(Mesh | null)[]>(Array(SPARK_COUNT).fill(null));

  const sparkParams = useMemo(() => buildSparkParams(SPARK_COUNT), []);

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

  const ring1Mat = useMemo(
    () => new MeshBasicMaterial({
      color: COLOR_RING_DEEP,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      side: 2,
    }),
    [],
  );

  const ring2Mat = useMemo(
    () => new MeshBasicMaterial({
      color: COLOR_RING_LITE,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      side: 2,
    }),
    [],
  );

  const sparkMats = useMemo(
    () => Array.from({ length: SPARK_COUNT }, (_, i) =>
      new MeshBasicMaterial({
        color: i % 2 === 0 ? COLOR_SPARK_A : COLOR_SPARK_B,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
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
      const flashFade = t < 0.07 ? t / 0.07 : Math.max(0, 1 - (t - 0.07) / 0.15);
      const scale     = 0.2 + t * 7.0;
      flashRef.current.scale.set(scale, scale, 1);
      flashMat.opacity = Math.max(0, flashFade * 0.9);
    }

    // ── Converging ring 1 (deep purple) — starts at 1.5, shrinks to 0.1 ─
    if (ring1Ref.current) {
      const progress = Math.min(t / DURATION, 1.0);
      // Invert: 1.5 at start → 0.1 at end
      const scale    = 1.5 - progress * 1.4;
      ring1Ref.current.scale.set(scale, scale, scale);
      const fadeIn  = t < 0.06 ? t / 0.06 : 1.0;
      const fadeOut = t > DURATION * 0.6 ? 1 - (t - DURATION * 0.6) / (DURATION * 0.4) : 1.0;
      ring1Mat.opacity = Math.max(0, fadeIn * fadeOut * 0.85);
    }

    // ── Converging ring 2 (light purple) — offset delay, slightly different ──
    if (ring2Ref.current) {
      const localT   = Math.max(0, t - 0.04);
      const progress = Math.min(localT / DURATION, 1.0);
      const scale    = 1.3 - progress * 1.15;
      ring2Ref.current.scale.set(scale, scale, scale);
      const fadeIn  = localT < 0.06 ? localT / 0.06 : 1.0;
      const fadeOut = localT > DURATION * 0.55 ? 1 - (localT - DURATION * 0.55) / (DURATION * 0.45) : 1.0;
      ring2Mat.opacity = Math.max(0, fadeIn * fadeOut * 0.7);
    }

    // ── Radial sparks ────────────────────────────────────────────────────
    for (let i = 0; i < SPARK_COUNT; i++) {
      const mesh = sparkRefs.current[i];
      const mat  = sparkMats[i];
      if (!mesh) continue;
      const { angle, speed, delay, size, yBias } = sparkParams[i];
      const localT = t - delay;
      if (localT <= 0) { mat.opacity = 0; continue; }

      const dist = localT * speed;
      mesh.position.set(Math.sin(angle) * dist, yBias + localT * 1.2, Math.cos(angle) * dist);
      const s = size * (0.5 + localT * 1.6);
      mesh.scale.set(s, s, s);
      const localFade = localT < 0.06
        ? localT / 0.06
        : Math.max(0, 1 - (localT - 0.06) / (DURATION * 0.85));
      mat.opacity = Math.max(0, 0.85 * localFade);
    }
  });

  return (
    <group ref={groupRef} position={[position.x, position.y + 0.5, position.z]}>

      {/* Central flash disc */}
      <mesh ref={flashRef} rotation={[-Math.PI / 2, 0, 0]} scale={[0.01, 0.01, 1]}>
        <circleGeometry args={[1, 22]} />
        <primitive object={flashMat} attach="material" />
      </mesh>

      {/* Converging ring 1 — deep purple */}
      <mesh ref={ring1Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.07, 5, 44]} />
        <primitive object={ring1Mat} attach="material" />
      </mesh>

      {/* Converging ring 2 — light purple, slight offset */}
      <mesh ref={ring2Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.055, 5, 44]} />
        <primitive object={ring2Mat} attach="material" />
      </mesh>

      {/* Radial purple sparks */}
      {sparkParams.map((_, i) => (
        <mesh key={i} ref={(el) => { sparkRefs.current[i] = el; }}>
          <planeGeometry args={[1, 1]} />
          <primitive object={sparkMats[i]} attach="material" />
        </mesh>
      ))}
    </group>
  );
}
