'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Group,
  Mesh,
  MeshBasicMaterial,
  Color,
  AdditiveBlending,
} from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

interface RunebladeSlashImpactProps {
  position: Vector3;
  /** Player facing direction at the moment of impact — used to orient the crescent. */
  direction: Vector3;
  onComplete: () => void;
}

const DURATION = 0.35; // seconds
const SPARK_COUNT = 1;

// Runeblade primary cyan-blue palette
const COLOR_CRESCENT = new Color('#1097B5');
const COLOR_SPARK_A  = new Color('#ffffff');
const COLOR_SPARK_B  = new Color('#60e8ff');
const COLOR_FLASH    = new Color('#d0f8ff');

function buildSparkParams(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const baseAngle = (i / count) * Math.PI * 2;
    const angle  = baseAngle + (Math.random() * 0.4 - 0.2);
    const speed  = 4.5 + Math.random() * 3.5;
    const delay  = Math.random() * 0.06;
    const size   = 0.05 + Math.random() * 0.1;
    const yBias  = Math.random() * 0.4; // slight upward drift
    return { angle, speed, delay, size, yBias };
  });
}

export default function RunebladeSlashImpact({
  position,
  direction,
  onComplete,
}: RunebladeSlashImpactProps) {
  const groupRef  = useRef<Group>(null);
  const timeRef   = useRef(0);
  const doneRef   = useRef(false);

  const crescentRef = useRef<Mesh | null>(null);
  const flashRef    = useRef<Mesh | null>(null);
  const sparkRefs   = useRef<(Mesh | null)[]>(Array(SPARK_COUNT).fill(null));

  // Borrow a pooled point light for the impact flash instead of mounting a <pointLight>
  // (which would churn the scene light count and force lit-shader recompiles).
  const impactLight = useDynamicLight({ color: COLOR_FLASH, distance: 10, decay: 6, priority: 1 });

  const sparkParams = useMemo(() => buildSparkParams(SPARK_COUNT), []);

  // Crescent facing angle from direction vector (XZ plane yaw)
  const crescentYaw = useMemo(
    () => Math.atan2(direction.x, direction.z),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [direction.x, direction.z],
  );

  const crescentMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: COLOR_CRESCENT,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2, // DoubleSide
      }),
    [],
  );

  const flashMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: COLOR_FLASH,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  const sparkMats = useMemo(
    () =>
      Array.from({ length: SPARK_COUNT }, (_, i) =>
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

  useEffect(() => {
    const cm = crescentMat;
    const fm = flashMat;
    const sm = sparkMats;
    return () => {
      cm.dispose();
      fm.dispose();
      sm.forEach((m) => m.dispose());
    };
  }, [crescentMat, flashMat, sparkMats]);

  useFrame((_, delta) => {
    if (doneRef.current) return;

    timeRef.current += delta;
    const t = timeRef.current;

    if (t >= DURATION) {
      doneRef.current = true;
      onComplete();
      return;
    }

    // ── Impact burst disc ─────────────────────────────────────────────────
    if (flashRef.current) {
      // Burst in very fast (0–0.08s), fade by 0.25s
      const flashFade = t < 0.08 ? t / 0.08 : Math.max(0, 1 - (t - 0.08) / 0.17);
      const scale = 0.3 + t * 6.0;
      flashRef.current.scale.set(scale, scale, 1);
      flashMat.opacity = Math.max(0, flashFade * 0.85);

      // Drive the pooled light at the impact point (world space), tracking the flash.
      impactLight.current?.setPosition(position.x, position.y + 1, position.z);
      impactLight.current?.setIntensity(10 * flashFade);
    }

    // ── Crescent arc ──────────────────────────────────────────────────────
    if (crescentRef.current) {
      // Scales from 0 → 1.4, fades in fast then out slowly
      const progress = Math.min(t / (DURATION * 0.7), 1.0);
      const scale = progress * 1.275;
      crescentRef.current.scale.set(scale, scale, scale);
      const fadeIn  = t < 0.07 ? t / 0.07 : 1.0;
      const fadeOut = t > DURATION * 0.45
        ? 1 - (t - DURATION * 0.45) / (DURATION * 0.55)
        : 1.0;
      crescentMat.opacity = Math.max(0, fadeIn * fadeOut * 0.9);
    }

    // ── Radial sparks ─────────────────────────────────────────────────────
    for (let i = 0; i < SPARK_COUNT; i++) {
      const mesh = sparkRefs.current[i];
      const mat  = sparkMats[i];
      if (!mesh) continue;
      const { angle, speed, delay, size, yBias } = sparkParams[i];
      const localT = t - delay;
      if (localT <= 0) { mat.opacity = 0; continue; }

      const dist = localT * speed;
      mesh.position.set(
        Math.sin(angle) * dist,
        yBias + localT * 1.5,
        Math.cos(angle) * dist,
      );
      const s = size * (0.6 + localT * 1.8);
      mesh.scale.set(s, s, s);
      const localFade = localT < 0.08
        ? localT / 0.08
        : Math.max(0, 1 - (localT - 0.08) / (DURATION * 0.8));
      mat.opacity = Math.max(0, 0.85 * localFade);
    }
  });

  return (
    <group ref={groupRef} position={[position.x, position.y + 1, position.z]}>

      {/* Central impact burst disc — the "hit flash" */}
      <mesh ref={flashRef} rotation={[-Math.PI / 3, 0, 0]} scale={[0.01, 0.01, 1]}>
        <circleGeometry args={[1, 24]} />
        <primitive object={flashMat} attach="material" />
      </mesh>

      {/* Crescent arc — partial torus rotated to face the swing direction.
          arc ≈ 1.4π gives ~252° sweep for a crescent silhouette.
          Rotated so the arc faces the player's attack direction. */}
      <mesh
        ref={crescentRef}
        rotation={[Math.PI / 2, -0.2, crescentYaw]}
        scale={[0.01, 0.01, 0.01]}
      >
        <torusGeometry args={[1, 0.08, 6, 48, Math.PI * 1.4]} />
        <primitive object={crescentMat} attach="material" />
      </mesh>

      {/* Radial sparks */}
      {sparkParams.map((_, i) => (
        <mesh key={i} ref={(el) => { sparkRefs.current[i] = el; }}>
          <planeGeometry args={[1, 1]} />
          <primitive object={sparkMats[i]} attach="material" />
        </mesh>
      ))}

    </group>
  );
}
