'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Group,
  Mesh,
  Color,
  AdditiveBlending,
  DoubleSide,
  RingGeometry,
  SphereGeometry,
  MeshBasicMaterial,
} from '@/utils/three-exports';
import { EnemyDynamicLight } from '@/components/effects/DynamicLightPool';

const SPHERE_GEOMETRY = new SphereGeometry(1, 24, 12);
const RING_GEOMETRY = new RingGeometry(0.55, 0.95, 32);
const ORBITAL_COUNT = 4;
const ORBITAL_RADIUS = 1.15;
const ORBITAL_SIZE = 0.14;

export interface EnemyAbilityChargeTelegraphProps {
  active: boolean;
  primaryColor: string;
  accentColor?: string;
  yCenter?: number;
  sphereRadius?: number;
  lightIntensity?: number;
}

const EnemyAbilityChargeTelegraph = React.memo(function EnemyAbilityChargeTelegraph({
  active,
  primaryColor,
  accentColor,
  yCenter = 1.1,
  sphereRadius = 1,
  lightIntensity = 6,
}: EnemyAbilityChargeTelegraphProps) {
  const groupRef = useRef<Group>(null);
  const outerRef = useRef<Mesh>(null);
  const innerRef = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);
  const orbitalRefs = useRef<(Mesh | null)[]>([]);
  const tRef = useRef(0);

  const accent = accentColor ?? primaryColor;

  const outerMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(primaryColor),
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [primaryColor]
  );
  const innerMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(accent),
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [accent]
  );
  const ringMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(primaryColor),
        transparent: true,
        opacity: 0.45,
        side: DoubleSide,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [primaryColor]
  );
  const orbitalMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(accent),
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [accent]
  );

  useFrame((_, delta) => {
    if (!active) return;
    tRef.current += delta;
    const t = tRef.current;
    const breathe = 0.5 + 0.5 * Math.sin(t * 6);
    const outerScale = sphereRadius * (1 + 0.15 * breathe);
    const innerScale = sphereRadius * (0.55 + 0.1 * (1 - breathe));

    if (outerRef.current) {
      outerRef.current.scale.setScalar(outerScale);
      outerMat.opacity = 0.24 + 0.14 * breathe;
    }
    if (innerRef.current) {
      innerRef.current.scale.setScalar(innerScale);
      innerMat.opacity = 0.35 + 0.2 * (1 - breathe);
    }
    if (ringRef.current) {
      const ringPulse = 0.75 + 0.25 * Math.sin(t * 8);
      ringMat.opacity = 0.3 + 0.2 * ringPulse;
      ringRef.current.rotation.z = t * 1.5;
    }

    orbitalRefs.current.forEach((orbital, index) => {
      if (!orbital) return;
      const angle = (index / ORBITAL_COUNT) * Math.PI * 2 + t * 2;
      orbital.position.set(
        Math.cos(angle) * ORBITAL_RADIUS * sphereRadius,
        Math.sin(t * 3 + index) * 0.12,
        Math.sin(angle) * ORBITAL_RADIUS * sphereRadius
      );
    });
  });

  if (!active) return null;

  return (
    <group ref={groupRef} position={[0, yCenter, 0]}>
      <EnemyDynamicLight
        position={[0, 0.15, 0]}
        color={primaryColor}
        intensity={lightIntensity}
        distance={5}
      />
      <mesh ref={outerRef} geometry={SPHERE_GEOMETRY} material={outerMat} />
      <mesh ref={innerRef} geometry={SPHERE_GEOMETRY} material={innerMat} />
      <mesh
        ref={ringRef}
        geometry={RING_GEOMETRY}
        material={ringMat}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[sphereRadius, sphereRadius, 1]}
      />
      {Array.from({ length: ORBITAL_COUNT }).map((_, index) => (
        <mesh
          key={index}
          ref={(el) => { orbitalRefs.current[index] = el; }}
          geometry={SPHERE_GEOMETRY}
          material={orbitalMat}
          scale={[ORBITAL_SIZE, ORBITAL_SIZE, ORBITAL_SIZE]}
        />
      ))}
    </group>
  );
});

export default EnemyAbilityChargeTelegraph;
