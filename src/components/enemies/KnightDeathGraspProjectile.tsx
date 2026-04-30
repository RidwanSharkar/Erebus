'use client';

import { useRef, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, MeshBasicMaterial, Color, AdditiveBlending } from 'three';

/** Enemy Death Grasp travel VFX (server hit/dodge is authoritative). */
interface KnightDeathGraspProjectileProps {
  startPosition: Vector3;
  endPosition: Vector3;
  travelMs: number;
  onComplete: () => void;
}

export default function KnightDeathGraspProjectile({
  startPosition,
  endPosition,
  travelMs,
  onComplete,
}: KnightDeathGraspProjectileProps) {
  const groupRef = useRef<Group>(null);
  const spinRef = useRef<Group>(null);
  const startTimeRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const endFixedRef = useRef(endPosition.clone());

  const coreMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#e9d5ff'),
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const midMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#a855f7'),
        transparent: true,
        opacity: 0.7,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const auraMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#6b21a8'),
        transparent: true,
        opacity: 0.4,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const trail1Mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#c4b5fd'),
        transparent: true,
        opacity: 0.55,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const trail2Mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#9333ea'),
        transparent: true,
        opacity: 0.4,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const trail3Mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#7c3aed'),
        transparent: true,
        opacity: 0.25,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const trail4Mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#5b21b6'),
        transparent: true,
        opacity: 0.14,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

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

    if (spinRef.current) {
      spinRef.current.rotation.y += delta * 5.5;
      spinRef.current.rotation.x += delta * 2.4;
    }

    const pulse = 0.85 + Math.sin(elapsed * 0.014) * 0.15;
    coreMat.opacity = 0.95 * pulse;
    midMat.opacity = 0.7 * pulse;
    const trailFade = 1 - k * 0.35;
    trail1Mat.opacity = 0.55 * trailFade;
    trail2Mat.opacity = 0.4 * trailFade;
    trail3Mat.opacity = 0.25 * trailFade;
    trail4Mat.opacity = 0.14 * trailFade;

    if (k >= 1 && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group ref={groupRef} position={startPosition.clone()}>
      <group ref={spinRef}>
        <mesh material={auraMat}>
          <sphereGeometry args={[0.45, 12, 12]} />
        </mesh>
        <mesh material={midMat}>
          <sphereGeometry args={[0.3, 12, 12]} />
        </mesh>
        <mesh material={coreMat}>
          <sphereGeometry args={[0.16, 10, 10]} />
        </mesh>
      </group>
      <mesh material={trail1Mat} position={[0, 0, -0.85]}>
        <sphereGeometry args={[0.24, 8, 8]} />
      </mesh>
      <mesh material={trail2Mat} position={[0, 0, -1.55]}>
        <sphereGeometry args={[0.18, 7, 7]} />
      </mesh>
      <mesh material={trail3Mat} position={[0, 0, -2.2]}>
        <sphereGeometry args={[0.11, 6, 6]} />
      </mesh>
      <mesh material={trail4Mat} position={[0, 0, -2.8]}>
        <sphereGeometry args={[0.07, 5, 5]} />
      </mesh>
      <pointLight color="#a78bfa" intensity={12} distance={10} decay={2} />
    </group>
  );
}
