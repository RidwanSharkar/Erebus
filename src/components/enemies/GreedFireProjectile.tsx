'use client';

import React, { useRef, useEffect, useMemo } from 'react';
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
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const spinRef = useRef<Group>(null);
  const telegraphRef = useRef<Mesh>(null);
  const timeRef = useRef(0);
  const doneRef = useRef(false);
  const dirRef = useRef(new Vector3(0, 0, -1));

  const fireLight = useDynamicLight({
    color: '#ff6a00',
    distance: fromAir ? 9.5 : 6.5,
    priority: 1,
    intensity: 0,
  });

  const maxLifetimeRef = useRef(1);

  useEffect(() => {
    const d = targetPosition.clone().sub(startPosition);
    const len = d.length();
    if (len > 1e-4) dirRef.current.copy(d).multiplyScalar(1 / len);
    maxLifetimeRef.current = (Math.max(len, 0.01) / SPEED) * 1.3;
  }, [startPosition, targetPosition]);

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

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = Math.atan2(dirRef.current.x, dirRef.current.z);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      {fromAir && (
        <mesh
          ref={telegraphRef}
          position={[targetPosition.x, 0.05, targetPosition.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={telegraphMat}
        >
          <ringGeometry args={[0.55, 1.15, 28]} />
        </mesh>
      )}
      <group ref={groupRef} position={startPosition.clone()}>
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
