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
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

export type DeathFlashScale = 'boss' | 'titan';

export interface DeathFlashExplosionProps {
  position: { x: number; y: number; z: number };
  scale?: DeathFlashScale;
  onComplete: () => void;
}

const RING_SEGMENTS = 48;

const SCALE_CONFIG: Record<DeathFlashScale, { maxRadius: number; duration: number; lightColor: string }> = {
  boss: { maxRadius: 4.5, duration: 0.55, lightColor: '#ffe8c0' },
  titan: { maxRadius: 2.0, duration: 0.45, lightColor: '#fff0d8' },
};

/** Brief flash + shock rings at boss/titan death locations. */
export default function DeathFlashExplosion({
  position,
  scale = 'boss',
  onComplete,
}: DeathFlashExplosionProps) {
  const { maxRadius, duration, lightColor } = SCALE_CONFIG[scale];

  const tRef = useRef(0);
  const coreMeshRef = useRef<Group>(null);
  const ring1Ref = useRef<Group>(null);
  const ring2Ref = useRef<Group>(null);
  const flashRef = useRef<Group>(null);
  const doneRef = useRef(false);

  const anchorPosition = useMemo(
    () => [position.x, position.y, position.z] as [number, number, number],
    [position.x, position.y, position.z],
  );

  const explosionLight = useDynamicLight({
    color: lightColor,
    distance: maxRadius * 4.2,
    decay: 2,
    priority: 1,
  });

  const { ringGeo1, ringGeo2, coreGeo, flashGeo } = useMemo(() => {
    const r = Math.max(0.5, maxRadius);
    return {
      ringGeo1: new RingGeometry(Math.max(0.04, r * 0.1), Math.max(0.08, r * 0.22), RING_SEGMENTS),
      ringGeo2: new RingGeometry(Math.max(0.03, r * 0.08), Math.max(0.06, r * 0.18), RING_SEGMENTS),
      coreGeo: new SphereGeometry(1, 24, 24),
      flashGeo: new SphereGeometry(0.35, 16, 16),
    };
  }, [maxRadius]);

  const matRing1 = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(0xffeedd),
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
        color: new Color(0xffcc88),
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
        color: new Color(0xfff8e8),
        emissive: new Color(0xffdd88),
        emissiveIntensity: 3.2,
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
        color: new Color(0xffffff),
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
    const p = Math.min(tRef.current / duration, 1);

    const shock1 = Math.max(0, Math.min((tRef.current - 0.01) / (duration * 0.85), 1));
    const shock2 = Math.max(0, Math.min((tRef.current - 0.06) / (duration * 0.9), 1));

    if (ring1Ref.current) {
      ring1Ref.current.scale.setScalar(0.18 + shock1 * 1.42);
    }
    if (ring2Ref.current) {
      ring2Ref.current.scale.setScalar(0.14 + shock2 * 1.55);
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
      const ft = Math.min(tRef.current / 0.18, 1);
      flashRef.current.scale.setScalar(2.2 * (1 - ft) + 0.4);
      matFlash.opacity = Math.max(0, 0.95 * (1 - tRef.current / 0.14));
    }

    {
      const peak = Math.sin(Math.min(tRef.current * 12, Math.PI));
      explosionLight.current?.setPosition(position.x, position.y + 0.52, position.z);
      explosionLight.current?.setIntensity(18 + 42 * peak * (1 - p * 0.85));
    }

    if (p >= 1 && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group position={anchorPosition}>
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
      </group>
    </group>
  );
}
