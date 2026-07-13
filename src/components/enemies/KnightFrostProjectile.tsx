'use client';

import { useRef, useMemo, useLayoutEffect, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, Mesh, MeshBasicMaterial, Color, AdditiveBlending } from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import EntropicBoltTrail from '@/components/projectiles/EntropicBoltTrail';

interface KnightFrostProjectileProps {
  startPosition: Vector3;
  endPosition: Vector3;
  travelMs: number;
  onComplete: () => void;
}

const trailColor = new Color('#0ea5e9');
const trailAccent = new Color('#cffafe');

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
  const dirRef = useRef(new Vector3(0, 0, -1));

  const projectileLight = useDynamicLight({ color: '#38bdf8', distance: 6.5, priority: 1 });

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

  useEffect(() => {
    const mats = [coreMat, midMat, auraMat];
    return () => { mats.forEach((m) => m.dispose()); };
  }, [coreMat, midMat, auraMat]);

  useLayoutEffect(() => {
    const d = endPosition.clone().sub(startPosition);
    const len = d.length();
    if (len > 1e-4) dirRef.current.copy(d).multiplyScalar(1 / len);

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

    const gp = groupRef.current.position;
    projectileLight.current?.setPosition(gp.x, gp.y, gp.z);
    projectileLight.current?.setIntensity(16);

    if (spinRef.current) {
      spinRef.current.rotation.y += delta * 5;
      spinRef.current.rotation.x += delta * 2.2;
    }

    const pulse = 0.85 + Math.sin(elapsed * 0.012) * 0.15;
    coreMat.opacity = 0.92 * pulse;
    midMat.opacity = 0.65 * pulse;

    if (k >= 1 && !doneRef.current) {
      doneRef.current = true;
      projectileLight.current?.setIntensity(0);
      onComplete();
    }
  });

  return (
    <>
      <EntropicBoltTrail
        color={trailColor}
        accentColor={trailAccent}
        size={0.075}
        meshRef={groupRef}
        opacity={0.95}
        flightDirectionRef={dirRef}
      />
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
      </group>
    </>
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
