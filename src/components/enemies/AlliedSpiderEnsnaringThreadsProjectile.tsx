'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, Mesh, MeshBasicMaterial, Color, AdditiveBlending } from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import EntropicBoltTrail from '@/components/projectiles/EntropicBoltTrail';

/** Grey/white spider-web missile — Ensnaring Threads pet upgrade. */
export interface AlliedSpiderEnsnaringThreadsProjectileProps {
  startPosition: Vector3;
  targetPosition: Vector3;
  onComplete: () => void;
}

const SPEED = 11;
const trailColor = new Color('#9ca3af');
const trailAccent = new Color('#e5e7eb');

export default function AlliedSpiderEnsnaringThreadsProjectile({
  startPosition,
  targetPosition,
  onComplete,
}: AlliedSpiderEnsnaringThreadsProjectileProps) {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const spinRef = useRef<Group>(null);
  const timeRef = useRef(0);
  const doneRef = useRef(false);
  const dirRef = useRef(new Vector3(0, 0, -1));

  const webLight = useDynamicLight({ color: '#e5e7eb', distance: 5.5, priority: 1, intensity: 0 });

  const maxLifetimeRef = useRef(1);

  useEffect(() => {
    const d = targetPosition.clone().sub(startPosition);
    const len = d.length();
    if (len > 1e-4) dirRef.current.copy(d).multiplyScalar(1 / len);
    maxLifetimeRef.current = (Math.max(len, 0.01) / SPEED) * 1.3;
  }, [startPosition, targetPosition]);

  const coreMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#f8fafc'),
    transparent: true, opacity: 0.95,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const midMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#d1d5db'),
    transparent: true, opacity: 0.7,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const auraMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#6b7280'),
    transparent: true, opacity: 0.3,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  useEffect(() => {
    return () => {
      coreMat.dispose();
      midMat.dispose();
      auraMat.dispose();
    };
  }, [coreMat, midMat, auraMat]);

  useFrame((_, delta) => {
    if (doneRef.current || !groupRef.current) return;

    timeRef.current += delta;
    const t = timeRef.current;

    groupRef.current.position.addScaledVector(dirRef.current, SPEED * delta);
    groupRef.current.rotation.y = Math.atan2(dirRef.current.x, dirRef.current.z);

    if (spinRef.current) spinRef.current.rotation.z += delta * 12;

    const gp = groupRef.current.position;
    webLight.current?.setPosition(gp.x, gp.y, gp.z);
    webLight.current?.setIntensity(12);

    const pulse = 0.85 + 0.15 * Math.sin(t * 20);
    if (coreRef.current) coreRef.current.scale.setScalar(pulse * 0.9);

    if (t >= maxLifetimeRef.current) {
      doneRef.current = true;
      webLight.current?.setIntensity(0);
      onComplete();
    }
  });

  return (
    <>
      <EntropicBoltTrail
        color={trailColor}
        accentColor={trailAccent}
        size={0.06}
        meshRef={groupRef}
        opacity={0.9}
        flightDirectionRef={dirRef}
      />
      <group ref={groupRef} position={startPosition.clone()}>
        <group ref={spinRef}>
          <mesh ref={coreRef} material={coreMat}>
            <sphereGeometry args={[0.18, 10, 10]} />
          </mesh>
          <mesh material={midMat}>
            <sphereGeometry args={[0.3, 10, 10]} />
          </mesh>
          <mesh material={auraMat}>
            <sphereGeometry args={[0.48, 8, 8]} />
          </mesh>
        </group>
      </group>
    </>
  );
}
