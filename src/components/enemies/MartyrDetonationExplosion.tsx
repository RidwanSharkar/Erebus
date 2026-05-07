'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Group,
  RingGeometry,
  SphereGeometry,
  AdditiveBlending,
  DoubleSide,
  Color,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
} from '@/utils/three-exports';

export interface MartyrDetonationExplosionProps {
  position: { x: number; y: number; z: number };
  maxRadius: number;
  onComplete: () => void;
}

const DURATION = 1.05;
const RING_SEGMENTS = 56;

/** Fireball + ground shock + flash; matches Martyr telegraph palette. */
export default function MartyrDetonationExplosion({ position, maxRadius, onComplete }: MartyrDetonationExplosionProps) {
  const tRef = useRef(0);
  const coreMeshRef = useRef<Group>(null);
  const ring1Ref = useRef<Group>(null);
  const ring2Ref = useRef<Group>(null);
  const flashRef = useRef<Group>(null);
  const lightRef = useRef<PointLight>(null);
  const doneRef = useRef(false);

  const { ringGeo1, ringGeo2, coreGeo, flashGeo } = useMemo(() => {
    const r = Math.max(0.5, maxRadius);
    return {
      ringGeo1: new RingGeometry(Math.max(0.04, r * 0.1), Math.max(0.08, r * 0.22), RING_SEGMENTS),
      ringGeo2: new RingGeometry(Math.max(0.03, r * 0.08), Math.max(0.06, r * 0.18), RING_SEGMENTS),
      coreGeo: new SphereGeometry(1, 32, 32),
      flashGeo: new SphereGeometry(0.35, 16, 16),
    };
  }, [maxRadius]);

  const matRing1 = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(0xff3300),
        transparent: true,
        opacity: 0.65,
        side: DoubleSide,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );
  const matRing2 = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(0xffaa44),
        transparent: true,
        opacity: 0.5,
        side: DoubleSide,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );
  const matCore = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color(0xff5500),
        emissive: new Color(0xff2200),
        emissiveIntensity: 2.8,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );
  const matFlash = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(0xffeedd),
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );

  useEffect(
    () => () => {
      ringGeo1.dispose();
      ringGeo2.dispose();
      coreGeo.dispose();
      flashGeo.dispose();
      matRing1.dispose();
      matRing2.dispose();
      matCore.dispose();
      matFlash.dispose();
    },
    [ringGeo1, ringGeo2, coreGeo, flashGeo, matRing1, matRing2, matCore, matFlash],
  );

  useFrame((_, delta) => {
    tRef.current += delta;
    const p = Math.min(tRef.current / DURATION, 1);

    const shock1 = Math.max(0, Math.min((tRef.current - 0.02) / 0.48, 1));
    const shock2 = Math.max(0, Math.min((tRef.current - 0.1) / 0.52, 1));

    if (ring1Ref.current) {
      const s1 = 0.18 + shock1 * 1.42;
      ring1Ref.current.scale.setScalar(s1);
    }
    if (ring2Ref.current) {
      const s2 = 0.14 + shock2 * 1.55;
      ring2Ref.current.scale.setScalar(s2);
    }

    const ringFade = (1 - p) * (1 - p);
    matRing1.opacity = 0.62 * ringFade * (0.35 + 0.65 * shock1);
    matRing2.opacity = 0.48 * ringFade * (0.35 + 0.65 * shock2);

    const corePulse = Math.sin(Math.min(tRef.current * 14, Math.PI)) * 0.12;
    if (coreMeshRef.current) {
      const cs = maxRadius * (0.18 + 0.78 * Math.sin(Math.min(p, 0.92) * Math.PI * 0.5) + corePulse);
      coreMeshRef.current.scale.setScalar(cs / maxRadius);
    }
    matCore.opacity = 0.82 * (1 - Math.pow(p, 1.35));

    if (flashRef.current) {
      const ft = Math.min(tRef.current / 0.22, 1);
      const flashScale = 2.2 * (1 - ft) + 0.4;
      flashRef.current.scale.setScalar(flashScale);
      matFlash.opacity = Math.max(0, 0.95 * (1 - tRef.current / 0.18));
    }

    if (lightRef.current) {
      const peak = Math.sin(Math.min(tRef.current * 12, Math.PI));
      lightRef.current.intensity = 22 + 48 * peak * (1 - p * 0.85);
    }

    if (p >= 1 && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  });

  const gx = position.x;
  const gy = position.y;
  const gz = position.z;

  return (
    <group position={[gx, gy, gz]}>
      <group ref={ring1Ref} position={[0, 0.08, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={ringGeo1} material={matRing1} />
      </group>
      <group ref={ring2Ref} position={[0, 0.1, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={ringGeo2} material={matRing2} />
      </group>

      <group position={[0, 0.52, 0]}>
        <group ref={flashRef}>
          <mesh geometry={flashGeo} material={matFlash} />
        </group>
        <group ref={coreMeshRef}>
          <mesh scale={[maxRadius, maxRadius, maxRadius]} geometry={coreGeo} material={matCore} />
        </group>
        <pointLight
          ref={lightRef}
          color="#ff5500"
          intensity={38}
          distance={maxRadius * 4.2}
          decay={2}
        />
      </group>
    </group>
  );
}
