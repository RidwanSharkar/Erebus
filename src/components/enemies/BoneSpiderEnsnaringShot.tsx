'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, Mesh, MeshBasicMaterial, Color, AdditiveBlending } from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import EntropicBoltTrail from '@/components/projectiles/EntropicBoltTrail';

export interface BoneSpiderEnsnaringShotProps {
  startPosition: Vector3;
  targetPosition: Vector3;
  onComplete: () => void;
}

/** Match BONE_SPIDER_SHOT_SPEED in backend/enemyAI.js */
const SPEED = 10;
const trailColor = new Color('#2f7a26');
const trailAccent = new Color('#66ff66');

export default function BoneSpiderEnsnaringShot({
  startPosition,
  targetPosition,
  onComplete,
}: BoneSpiderEnsnaringShotProps) {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const spinRef = useRef<Group>(null);
  const timeRef = useRef(0);
  const doneRef = useRef(false);
  const dirRef = useRef(new Vector3(0, 0, -1));
  const ensnareLight = useDynamicLight({ color: '#33ff55', distance: 6.5, priority: 1, intensity: 0 });
  const maxLifetimeRef = useRef(1);

  useEffect(() => {
    const d = targetPosition.clone().sub(startPosition);
    const len = d.length();
    if (len > 1e-4) dirRef.current.copy(d).multiplyScalar(1 / len);
    maxLifetimeRef.current = (Math.max(len, 0.01) / SPEED) * 1.3;
  }, [startPosition, targetPosition]);

  const coreMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#aaffaa'),
    transparent: true, opacity: 0.95,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const midMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#33ff55'),
    transparent: true, opacity: 0.75,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  const auraMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#1a5c1a'),
    transparent: true, opacity: 0.35,
    blending: AdditiveBlending, depthWrite: false,
  }), []);

  useEffect(() => () => {
    coreMat.dispose();
    midMat.dispose();
    auraMat.dispose();
  }, [coreMat, midMat, auraMat]);

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
    ensnareLight.current?.setPosition(gp.x, gp.y, gp.z);
    ensnareLight.current?.setIntensity(14);
    const pulse = 0.85 + 0.15 * Math.sin(t * 20);
    if (coreRef.current) coreRef.current.scale.setScalar(pulse);
    if (t >= maxLifetimeRef.current) {
      doneRef.current = true;
      ensnareLight.current?.setIntensity(0);
      onComplete();
    }
  });

  return (
    <>
      <EntropicBoltTrail
        color={trailColor}
        accentColor={trailAccent}
        size={0.0675}
        meshRef={groupRef}
        opacity={0.95}
        flightDirectionRef={dirRef}
      />
      <group ref={groupRef} position={startPosition.clone()}>
        <group ref={spinRef}>
          <mesh ref={coreRef} material={coreMat}>
            <sphereGeometry args={[0.24, 10, 10]} />
          </mesh>
          <mesh material={midMat}>
            <sphereGeometry args={[0.4, 10, 10]} />
          </mesh>
          <mesh material={auraMat}>
            <sphereGeometry args={[0.62, 8, 8]} />
          </mesh>
        </group>
      </group>
    </>
  );
}
