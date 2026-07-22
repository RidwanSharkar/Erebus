'use client';

import React, { useRef } from 'react';
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DoubleSide,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
} from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

interface RunePickupRiseEffectProps {
  position: { x: number; y: number; z: number };
  color: string;
  onComplete: () => void;
}

const DURATION_SEC = 1.1;
const SPARK_COUNT = 6;

const sharedRingGeo = new RingGeometry(0.28, 0.72, 24);
const sharedPillarGeo = new CylinderGeometry(0.18, 0.38, 1.4, 10, 1, true);
const sharedSparkGeo = new SphereGeometry(0.07, 8, 8);

const _colorScratch = new Color();

function makeAdditiveMaterial(color: string, opacity: number) {
  _colorScratch.set(color);
  return new MeshBasicMaterial({
    color: _colorScratch,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  });
}

/** Short stat-colored power burst at the player when a rune is auto-collected. */
export default function RunePickupRiseEffect({
  position,
  color,
  onComplete,
}: RunePickupRiseEffectProps) {
  const elapsed = useRef(0);
  const groupRef = useRef<any>(null);
  const ringRef = useRef<any>(null);
  const pillarRef = useRef<any>(null);
  const sparksRef = useRef<any[]>([]);
  const doneRef = useRef(false);

  const ringMat = useRef(makeAdditiveMaterial(color, 0.6));
  const pillarMat = useRef(makeAdditiveMaterial(color, 0.42));
  const sparkMats = useRef(
    Array.from({ length: SPARK_COUNT }, () => makeAdditiveMaterial(color, 0.55)),
  );

  const riseLight = useDynamicLight({ color, distance: 4, priority: 1 });

  useFrame((_, delta) => {
    if (doneRef.current) return;
    elapsed.current += delta;
    const t = Math.min(1, elapsed.current / DURATION_SEC);
    const rise = t * 1.6;
    const fade = t < 0.45 ? t / 0.45 : Math.max(0, 1 - (t - 0.45) / 0.55);

    const worldY = position.y + rise * 0.4;
    if (groupRef.current) {
      groupRef.current.position.set(position.x, worldY, position.z);
    }

    riseLight.current?.setPosition(position.x, worldY + 0.55, position.z);
    riseLight.current?.setIntensity(2.8 * fade);

    if (ringRef.current?.material) {
      ringRef.current.material.opacity = 0.6 * fade;
      ringRef.current.scale.setScalar(0.75 + t * 1.1);
    }
    if (pillarRef.current?.material) {
      pillarRef.current.material.opacity = 0.42 * fade;
      pillarRef.current.scale.y = 0.15 + t * 1.45;
    }
    sparksRef.current.forEach((m, i) => {
      if (!m?.material) return;
      const phase = (i * 0.27) % 1;
      const ft = Math.max(0, fade - phase * 0.18);
      m.material.opacity = 0.55 * ft;
      const sparkRise = rise * (0.6 + (i % 3) * 0.12);
      const a = (i / SPARK_COUNT) * Math.PI * 2;
      const r = 0.35 + (i % 2) * 0.1;
      m.position.set(Math.sin(a) * r, 0.25 + sparkRise + i * 0.06, Math.cos(a) * r);
    });

    if (t >= 1) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} geometry={sharedRingGeo} material={ringMat.current} />
      <mesh ref={pillarRef} position={[0, 0.75, 0]} geometry={sharedPillarGeo} material={pillarMat.current} />
      {Array.from({ length: SPARK_COUNT }, (_, i) => {
        const a = (i / SPARK_COUNT) * Math.PI * 2;
        const r = 0.35 + (i % 2) * 0.1;
        return (
          <mesh
            key={i}
            ref={(el) => {
              sparksRef.current[i] = el;
            }}
            position={[Math.sin(a) * r, 0.3 + i * 0.06, Math.cos(a) * r]}
            geometry={sharedSparkGeo}
            material={sparkMats.current[i]}
          />
        );
      })}
    </group>
  );
}
