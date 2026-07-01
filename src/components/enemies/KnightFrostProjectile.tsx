'use client';

import { useRef, useMemo, useLayoutEffect, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, Mesh, MeshBasicMaterial, Color, AdditiveBlending } from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

interface KnightFrostProjectileProps {
  startPosition: Vector3;
  endPosition: Vector3;
  travelMs: number;
  onComplete: () => void;
}

export default function KnightFrostProjectile({
  startPosition,
  endPosition,
  travelMs,
  onComplete,
}: KnightFrostProjectileProps) {
  const groupRef = useRef<Group>(null);
  const spinRef = useRef<Group>(null);
  const startTimeRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const endFixedRef = useRef(endPosition.clone());

  // Borrow a pooled point light that follows the projectile (replaces a mounted <pointLight>).
  const projectileLight = useDynamicLight({ color: new Color('#7dd3fc'), distance: 10, decay: 2, priority: 2 });

  const coreMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#e0f2fe'),
        transparent: true,
        opacity: 0.92,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const midMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#38bdf8'),
        transparent: true,
        opacity: 0.65,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const auraMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#0ea5e9'),
        transparent: true,
        opacity: 0.35,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  const trail1Mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#bae6fd'),
        transparent: true,
        opacity: 0.5,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const trail2Mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#7dd3fc'),
        transparent: true,
        opacity: 0.35,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const trail3Mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#38bdf8'),
        transparent: true,
        opacity: 0.22,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const trail4Mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#0284c7'),
        transparent: true,
        opacity: 0.12,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => {
    const mats = [coreMat, midMat, auraMat, trail1Mat, trail2Mat, trail3Mat, trail4Mat];
    return () => { mats.forEach((m) => m.dispose()); };
  }, [coreMat, midMat, auraMat, trail1Mat, trail2Mat, trail3Mat, trail4Mat]);

  useLayoutEffect(() => {
    if (!groupRef.current) return;
    const dx = endPosition.x - startPosition.x;
    const dz = endPosition.z - startPosition.z;
    if (dx !== 0 || dz !== 0) {
      groupRef.current.rotation.y = Math.atan2(dx, dz);
    }
  }, [startPosition, endPosition]);

  useFrame((_, delta) => {
    if (doneRef.current || !groupRef.current) return;
    if (startTimeRef.current === null) startTimeRef.current = performance.now();
    const elapsed = performance.now() - startTimeRef.current;
    const k = Math.min(1, elapsed / travelMs);

    groupRef.current.position.lerpVectors(startPosition, endFixedRef.current, k);

    // Drive the pooled light at the projectile's world position.
    const gp = groupRef.current.position;
    projectileLight.current?.setPosition(gp.x, gp.y, gp.z);
    projectileLight.current?.setIntensity(14);

    if (spinRef.current) {
      spinRef.current.rotation.y += delta * 5;
      spinRef.current.rotation.x += delta * 2.2;
    }

    const pulse = 0.85 + Math.sin(elapsed * 0.012) * 0.15;
    coreMat.opacity = 0.92 * pulse;
    midMat.opacity = 0.65 * pulse;
    const trailFade = 1 - k * 0.35;
    trail1Mat.opacity = 0.5 * trailFade;
    trail2Mat.opacity = 0.35 * trailFade;
    trail3Mat.opacity = 0.22 * trailFade;
    trail4Mat.opacity = 0.12 * trailFade;

    if (k >= 1 && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group ref={groupRef} position={startPosition.clone()}>
      <group ref={spinRef}>
        <mesh material={auraMat}>
          <sphereGeometry args={[0.42, 12, 12]} />
        </mesh>
        <mesh material={midMat}>
          <sphereGeometry args={[0.28, 12, 12]} />
        </mesh>
        <mesh material={coreMat}>
          <sphereGeometry args={[0.14, 10, 10]} />
        </mesh>
      </group>
      <mesh material={trail1Mat} position={[0, 0, -0.85]}>
        <sphereGeometry args={[0.22, 8, 8]} />
      </mesh>
      <mesh material={trail2Mat} position={[0, 0, -1.5]}>
        <sphereGeometry args={[0.16, 7, 7]} />
      </mesh>
      <mesh material={trail3Mat} position={[0, 0, -2.15]}>
        <sphereGeometry args={[0.1, 6, 6]} />
      </mesh>
      <mesh material={trail4Mat} position={[0, 0, -2.75]}>
        <sphereGeometry args={[0.06, 5, 5]} />
      </mesh>
    </group>
  );
}

const IMPACT_MS = 320;

interface KnightFrostImpactProps {
  position: Vector3;
  onComplete: () => void;
}

/** Brief cyan flash when Frost Ray connects (all clients). */
export function KnightFrostImpact({ position, onComplete }: KnightFrostImpactProps) {
  const startRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const flashRef = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);

  // Borrow a pooled point light for the impact flash (replaces a mounted <pointLight>).
  const impactLight = useDynamicLight({ color: new Color('#22d3ee'), distance: 8, decay: 2, priority: 1 });

  const ringMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#67e8f9'),
        transparent: true,
        opacity: 0.55,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const flashMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#cffafe'),
        transparent: true,
        opacity: 0.4,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => {
    const rm = ringMat;
    const fm = flashMat;
    return () => {
      rm.dispose();
      fm.dispose();
    };
  }, [ringMat, flashMat]);

  useFrame(() => {
    if (startRef.current === null) startRef.current = performance.now();
    const t = Math.min(1, (performance.now() - startRef.current) / IMPACT_MS);
    const fade = 1 - t;
    ringMat.opacity = 0.55 * fade;
    flashMat.opacity = 0.4 * fade;
    const s = 0.45 + t * 1.6;
    if (flashRef.current) flashRef.current.scale.setScalar(s);
    if (ringRef.current) ringRef.current.scale.setScalar(1 + t * 2.2);
    impactLight.current?.setPosition(position.x, position.y, position.z);
    impactLight.current?.setIntensity(16 * fade);
    if (t >= 1 && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh ref={flashRef} material={flashMat}>
        <sphereGeometry args={[1.2, 10, 10]} />
      </mesh>
      <mesh ref={ringRef} material={ringMat} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.4, 1.4, 24]} />
      </mesh>
    </group>
  );
}
