'use client';

import React, { useRef, useMemo, useState } from 'react';
import {
  Group,
  Vector3,
  RingGeometry,
  CircleGeometry,
  MeshBasicMaterial,
  AdditiveBlending,
  DoubleSide,
  Color,
  Mesh,
  PointLight,
} from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

const DURATION = 0.9;

interface TemplarBlinkSmiteGroundProps {
  position: Vector3;
  onComplete: () => void;
}

/** Red AOE ground burst for Templar Blink Smite (enemy telegraphed strike). */
export default function TemplarBlinkSmiteGround({ position, onComplete }: TemplarBlinkSmiteGroundProps) {
  const groupRef = useRef<Group>(null);
  const tRef = useRef(0);
  const [lightColor] = useState(() => new Color(0xff2a1a));
  const ringGeo = useMemo(() => new RingGeometry(0.1, 3.0, 48), []);
  const coreGeo = useMemo(() => new CircleGeometry(0.1, 32), []);
  const ringMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: 0xff2200,
        transparent: true,
        opacity: 0.9,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    []
  );
  const coreMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: 0xff5533,
        transparent: true,
        opacity: 0.8,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    []
  );
  const doneRef = useRef(false);

  const ringRef = useRef<Mesh | null>(null);
  const coreRef = useRef<Mesh | null>(null);
  const lightRef = useRef<PointLight | null>(null);

  useFrame((_, delta) => {
    tRef.current += delta;
    const p = Math.min(tRef.current / DURATION, 1);
    const ease = 1 - Math.pow(1 - p, 2);
    if (ringRef.current) {
      const s = 0.2 + ease * 2.6;
      ringRef.current.scale.setScalar(s);
      const m = ringRef.current.material as MeshBasicMaterial;
      m.opacity = 0.9 * (1 - p);
    }
    if (coreRef.current) {
      const cs = 0.1 + ease * 2.4;
      coreRef.current.scale.setScalar(cs);
      const m = coreRef.current.material as MeshBasicMaterial;
      m.opacity = 0.75 * (1 - Math.min(p * 1.3, 1));
    }
    if (lightRef.current) {
      lightRef.current.intensity = 20 * (1 - p);
      lightRef.current.distance = 4 + ease * 4;
    }
    if (p >= 1 && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group ref={groupRef} position={[position.x, position.y + 0.04, position.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={ringRef} geometry={ringGeo} material={ringMat} />
      <mesh ref={coreRef} geometry={coreGeo} material={coreMat} />
      <pointLight ref={lightRef} color={lightColor} intensity={20} distance={8} decay={2} position={[0, 0, 0.2]} />
    </group>
  );
}
