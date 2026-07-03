'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Group,
  Mesh,
  Color,
  AdditiveBlending,
  BackSide,
  DoubleSide,
  SphereGeometry,
  MeshStandardMaterial,
} from '@/utils/three-exports';
import { EnemyDynamicLight } from '@/components/effects/DynamicLightPool';

const SPHERE_GEOMETRY = new SphereGeometry(1, 24, 16);

const GOLD_MAIN = '#ffc107';
const GOLD_EMISSIVE = '#ffb300';
const GOLD_INNER = '#fff59d';
const GOLD_INNER_EMISSIVE = '#ffd54f';
const GOLD_ACCENT = '#ffe082';

const Y_CENTER = 1.05;
const BASE_RADIUS = 1.35;
const INNER_SCALE_MUL = 1.06;
const ACCENT_SCALE_MUL = 1.12;

export interface KnightBlockShieldProps {
  active: boolean;
  visualScale?: number;
}

const KnightBlockShield = React.memo(function KnightBlockShield({
  active,
  visualScale = 1,
}: KnightBlockShieldProps) {
  const groupRef = useRef<Group>(null);
  const outerRef = useRef<Mesh>(null);
  const innerRef = useRef<Mesh>(null);
  const accentRef = useRef<Mesh>(null);
  const tRef = useRef(0);

  const sphereRadius = BASE_RADIUS * visualScale;
  const yCenter = Y_CENTER * visualScale;

  const outerMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color(GOLD_MAIN),
        emissive: new Color(GOLD_EMISSIVE),
        emissiveIntensity: 1.1,
        transparent: true,
        opacity: 0.35,
        side: BackSide,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    []
  );
  const innerMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color(GOLD_INNER),
        emissive: new Color(GOLD_INNER_EMISSIVE),
        emissiveIntensity: 0.85,
        transparent: true,
        opacity: 0.22,
        side: DoubleSide,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    []
  );
  const accentMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color(GOLD_ACCENT),
        emissive: new Color(GOLD_EMISSIVE),
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.14,
        side: DoubleSide,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  useEffect(() => {
    return () => {
      outerMat.dispose();
      innerMat.dispose();
      accentMat.dispose();
    };
  }, [outerMat, innerMat, accentMat]);

  useEffect(() => {
    if (!active) tRef.current = 0;
  }, [active]);

  useFrame((_, delta) => {
    if (!active) return;
    tRef.current += delta;
    const t = tRef.current;
    const breathe = 0.5 + 0.5 * Math.sin(t * 6);
    const pulse = 1 + 0.08 * breathe;

    if (outerRef.current) {
      outerRef.current.scale.setScalar(sphereRadius * pulse);
      outerMat.opacity = 0.28 + 0.12 * breathe;
      outerMat.emissiveIntensity = 1.0 + 0.25 * breathe;
    }
    if (innerRef.current) {
      innerRef.current.scale.setScalar(sphereRadius * INNER_SCALE_MUL * pulse);
      innerMat.opacity = 0.16 + 0.1 * (1 - breathe);
      innerMat.emissiveIntensity = 0.7 + 0.2 * breathe;
    }
    if (accentRef.current) {
      accentRef.current.scale.setScalar(sphereRadius * ACCENT_SCALE_MUL * pulse);
      accentMat.opacity = 0.1 + 0.06 * breathe;
    }
  });

  if (!active) return null;

  return (
    <group ref={groupRef} position={[0, yCenter, 0]}>
      <EnemyDynamicLight
        position={[0, 0.1, 0]}
        color={GOLD_MAIN}
        intensity={4.5 * visualScale}
        distance={5 * visualScale}
      />
      <mesh ref={outerRef} geometry={SPHERE_GEOMETRY} material={outerMat} />
      <mesh ref={innerRef} geometry={SPHERE_GEOMETRY} material={innerMat} />
      <mesh ref={accentRef} geometry={SPHERE_GEOMETRY} material={accentMat} />
    </group>
  );
});

export default KnightBlockShield;
