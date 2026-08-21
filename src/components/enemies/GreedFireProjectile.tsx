'use client';

import React, { useRef, useEffect, useLayoutEffect, useMemo, useCallback, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, Mesh, MeshBasicMaterial, Color, AdditiveBlending, DoubleSide } from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import EntropicBoltTrail from '@/components/projectiles/EntropicBoltTrail';

/** Non-homing fire comet — mirrors the server's straight-line simulation in `greedCastFireOrb`. */
export interface GreedFireProjectileProps {
  startPosition: Vector3;
  targetPosition: Vector3;
  onComplete: () => void;
  /** Air-to-ground destiny fly volley — larger trail + ground impact telegraph. */
  fromAir?: boolean;
}

const SPEED = 11; // matches backend GREED_FIREBALL_SPEED
const trailColor = new Color('#ff5500');
const trailAccent = new Color('#ffcc55');
const telegraphColor = new Color('#ff4400');

export default function GreedFireProjectile({
  startPosition,
  targetPosition,
  onComplete,
  fromAir = false,
}: GreedFireProjectileProps) {
  // MutableRefObject: React 19's `useRef<T>(null)` is RefObject (readonly `.current`).
  const groupRef: MutableRefObject<Group | null> = useRef(null);
  const coreRef = useRef<Mesh>(null);
  const spinRef = useRef<Group>(null);
  const telegraphRef = useRef<Mesh>(null);
  const timeRef = useRef(0);
  const doneRef = useRef(false);
  const dirRef = useRef(new Vector3(0, 0, -1));
  const maxLifetimeRef = useRef(1);
  /** Capture spawn coords once — parent re-renders must not reset flight. */
  const spawnRef = useRef<{
    sx: number; sy: number; sz: number;
    tx: number; ty: number; tz: number;
  } | null>(null);

  const fireLight = useDynamicLight({
    color: '#ff6a00',
    distance: fromAir ? 9.5 : 6.5,
    priority: 1,
    intensity: 0,
  });

  if (!spawnRef.current) {
    const sx = startPosition.x;
    const sy = startPosition.y;
    const sz = startPosition.z;
    const tx = targetPosition.x;
    const ty = targetPosition.y;
    const tz = targetPosition.z;
    spawnRef.current = { sx, sy, sz, tx, ty, tz };
    // Lifetime matches server XZ travel (server only advances x/z).
    const dx = tx - sx;
    const dy = ty - sy;
    const dz = tz - sz;
    const xzLen = Math.hypot(dx, dz);
    if (xzLen > 1e-4) {
      dirRef.current.set(dx, dy, dz).normalize();
    } else if (Math.hypot(dx, dy, dz) > 1e-4) {
      dirRef.current.set(dx, dy, dz).normalize();
    }
    maxLifetimeRef.current = (Math.max(xzLen, 0.01) / SPEED) * 1.3;
  }

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (!group || !spawnRef.current) return;
    const { sx, sy, sz } = spawnRef.current;
    group.position.set(sx, sy, sz);
    group.rotation.y = Math.atan2(dirRef.current.x, dirRef.current.z);
  }, []);

  const coreMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#fff3b0'),
    transparent: true, opacity: 0.95,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const midMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#ff7a1a'),
    transparent: true, opacity: 0.75,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const auraMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#dd2200'),
    transparent: true, opacity: 0.35,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const telegraphMat = useMemo(() => new MeshBasicMaterial({
    color: telegraphColor,
    transparent: true,
    opacity: 0.35,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  }), []);

  useEffect(() => {
    return () => {
      coreMat.dispose();
      midMat.dispose();
      auraMat.dispose();
      telegraphMat.dispose();
    };
  }, [coreMat, midMat, auraMat, telegraphMat]);

  useLayoutEffect(() => {
    if (!groupRef.current || !spawnRef.current) return;
    const { sx, sy, sz } = spawnRef.current;
    groupRef.current.position.set(sx, sy, sz);
    groupRef.current.rotation.y = Math.atan2(dirRef.current.x, dirRef.current.z);
  }, []);

  useFrame((_, delta) => {
    if (doneRef.current || !groupRef.current) return;

    timeRef.current += delta;
    const t = timeRef.current;

    groupRef.current.position.addScaledVector(dirRef.current, SPEED * delta);
    groupRef.current.rotation.y = Math.atan2(dirRef.current.x, dirRef.current.z);

    if (spinRef.current) spinRef.current.rotation.z += delta * 8;

    const gp = groupRef.current.position;
    fireLight.current?.setPosition(gp.x, gp.y, gp.z);
    fireLight.current?.setIntensity(fromAir ? 22 : 16);

    const pulse = 0.85 + 0.15 * Math.sin(t * 20);
    if (coreRef.current) coreRef.current.scale.setScalar(pulse * (fromAir ? 1.25 : 1));

    if (fromAir && telegraphRef.current) {
      const lifeT = Math.min(1, t / Math.max(0.01, maxLifetimeRef.current));
      telegraphMat.opacity = 0.2 + 0.35 * lifeT;
      const ringScale = 0.7 + 0.5 * lifeT;
      telegraphRef.current.scale.set(ringScale, ringScale, ringScale);
    }

    if (t >= maxLifetimeRef.current) {
      doneRef.current = true;
      fireLight.current?.setIntensity(0);
      onComplete();
    }
  });

  const coreRadius = fromAir ? 0.3 : 0.24;
  const midRadius = fromAir ? 0.52 : 0.4;
  const auraRadius = fromAir ? 0.8 : 0.62;
  const spawn = spawnRef.current;

  return (
    <>
      <EntropicBoltTrail
        color={trailColor}
        accentColor={trailAccent}
        size={fromAir ? 0.1 : 0.0675}
        meshRef={groupRef}
        opacity={0.95}
        flightDirectionRef={dirRef}
      />
      {fromAir && spawn && (
        <mesh
          ref={telegraphRef}
          position={[spawn.tx, 0.05, spawn.tz]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={telegraphMat}
        >
          <ringGeometry args={[0.55, 1.15, 28]} />
        </mesh>
      )}
      {/* No declarative position — parent burst re-renders must not snap flight back to muzzle. */}
      <group ref={setGroupRef}>
        <group ref={spinRef}>
          <mesh ref={coreRef} material={coreMat}>
            <sphereGeometry args={[coreRadius, 10, 10]} />
          </mesh>
          <mesh material={midMat}>
            <sphereGeometry args={[midRadius, 10, 10]} />
          </mesh>
          <mesh material={auraMat}>
            <sphereGeometry args={[auraRadius, 8, 8]} />
          </mesh>
        </group>
      </group>
    </>
  );
}
