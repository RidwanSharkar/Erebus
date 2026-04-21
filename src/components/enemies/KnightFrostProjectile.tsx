'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, Mesh, PointLight, MeshBasicMaterial, Color, AdditiveBlending } from 'three';

const TRAVEL_MS = 1400;

interface KnightFrostProjectileProps {
  startPosition: Vector3;
  staleTarget: Vector3;
  /** When the local player is the victim, snap X/Z to their live position each frame; keep Y from stale. */
  refineTarget?: (stale: Vector3) => Vector3;
  onComplete: () => void;
}

export default function KnightFrostProjectile({
  startPosition,
  staleTarget,
  refineTarget,
  onComplete,
}: KnightFrostProjectileProps) {
  const groupRef = useRef<Group>(null);
  const spinRef = useRef<Group>(null);
  const startTimeRef = useRef<number | null>(null);
  const doneRef = useRef(false);

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

  useFrame((_, delta) => {
    if (doneRef.current || !groupRef.current) return;
    if (startTimeRef.current === null) startTimeRef.current = performance.now();
    const elapsed = performance.now() - startTimeRef.current;
    const k = Math.min(1, elapsed / TRAVEL_MS);

    let end = staleTarget.clone();
    if (refineTarget) end = refineTarget(end);

    groupRef.current.position.lerpVectors(startPosition, end, k);

    if (spinRef.current) {
      spinRef.current.rotation.y += delta * 5;
      spinRef.current.rotation.x += delta * 2.2;
    }

    const pulse = 0.85 + Math.sin(elapsed * 0.012) * 0.15;
    coreMat.opacity = 0.92 * pulse;
    midMat.opacity = 0.65 * pulse;

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
      <pointLight color="#7dd3fc" intensity={14} distance={10} decay={2} />
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
  const lightRef = useRef<PointLight>(null);
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

  useFrame(() => {
    if (startRef.current === null) startRef.current = performance.now();
    const t = Math.min(1, (performance.now() - startRef.current) / IMPACT_MS);
    const fade = 1 - t;
    ringMat.opacity = 0.55 * fade;
    flashMat.opacity = 0.4 * fade;
    const s = 0.45 + t * 1.6;
    if (flashRef.current) flashRef.current.scale.setScalar(s);
    if (ringRef.current) ringRef.current.scale.setScalar(1 + t * 2.2);
    if (lightRef.current) lightRef.current.intensity = 16 * fade;
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
      <pointLight ref={lightRef} color="#22d3ee" intensity={16} distance={8} decay={2} />
    </group>
  );
}
