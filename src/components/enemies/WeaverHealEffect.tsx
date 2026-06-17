'use client';

import React, { useRef, useMemo } from 'react';
import {
  Vector3,
  AdditiveBlending,
  InstancedMesh,
  Object3D,
  Color,
  MathUtils,
  SphereGeometry,
  MeshBasicMaterial,
} from 'three';
import { useFrame } from '@react-three/fiber';

interface WeaverHealEffectProps {
  position: Vector3;
  onComplete: () => void;
}

const DURATION = 1.8;
const FLOOR_Y = 0.06;
const MOTE_N = 20;
const COL_GEOM_H = 1;

// Ground-anchored heal: ground glyph flash, soft vertical energy column, straight-rising motes
export default function WeaverHealEffect({ position, onComplete }: WeaverHealEffectProps) {
  const elapsed = useRef(0);
  const groundDiscRef = useRef<any>(null);
  const groundRingRef = useRef<any>(null);
  const columnOuterRef = useRef<any>(null);
  const columnInnerRef = useRef<any>(null);
  const baseGlowRef = useRef<any>(null);
  const moteInstRef = useRef<InstancedMesh>(null);
  const moteColorScratch = useRef(new Color());
  const completeRef = useRef(false);

  const moteData = useMemo(
    () =>
      Array.from({ length: MOTE_N }, () => ({
        r: 0.12 + Math.random() * 0.5,
        a: Math.random() * Math.PI * 2,
        speed: 1.3 + Math.random() * 1.3,
        phase: Math.random() * 3.5,
        wobble: Math.random() * Math.PI * 2,
        maxY: 2.0 + Math.random() * 1.2,
        scale: 0.05 + Math.random() * 0.06,
      })),
    []
  );

  const dummy = useMemo(() => new Object3D(), []);

  const moteColors = useMemo(() => {
    const alt = (i: number) => (i % 2 === 0 ? new Color(0.55, 1, 0.75) : new Color(1, 1, 0.55));
    return Array.from({ length: MOTE_N }, (_, i) => alt(i));
  }, []);

  const moteGeo = useMemo(() => new SphereGeometry(1, 7, 7), []);
  const moteMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.9,
        blending: AdditiveBlending,
        depthWrite: false,
        vertexColors: true,
      }),
    []
  );

  useFrame((_, delta) => {
    elapsed.current += delta;
    const t = Math.min(1, elapsed.current / DURATION);
    const easeOut = 1 - (1 - t) * (1 - t);

    const groundPeak = t < 0.22 ? t / 0.22 : Math.max(0, 1 - (t - 0.22) * 1.4);
    if (groundDiscRef.current?.material) {
      groundDiscRef.current.material.opacity = 0.52 * groundPeak;
    }
    if (groundRingRef.current) {
      const breathe = 1 + Math.sin(elapsed.current * 5) * 0.04;
      groundRingRef.current.scale.set(breathe, breathe, breathe);
      if (groundRingRef.current.material) {
        groundRingRef.current.material.opacity = 0.48 * groundPeak;
      }
    }

    const colH =
      t < 0.48
        ? MathUtils.lerp(0.12, 2.9, t / 0.48)
        : 2.9 * Math.max(0, 1 - (t - 0.48) * 1.45);
    const colOpacity = t < 0.5 ? 0.12 + 0.48 * (t / 0.5) : Math.max(0, 0.6 * (1 - (t - 0.5) * 1.15));
    if (columnOuterRef.current) {
      columnOuterRef.current.scale.set(1, colH, 1);
      columnOuterRef.current.position.y = FLOOR_Y + (colH * COL_GEOM_H) / 2;
      if (columnOuterRef.current.material) {
        columnOuterRef.current.material.opacity = colOpacity;
      }
    }
    if (columnInnerRef.current) {
      const innerH = colH * 0.78;
      columnInnerRef.current.scale.set(1, innerH, 1);
      columnInnerRef.current.position.y = FLOOR_Y + (innerH * COL_GEOM_H) / 2;
      if (columnInnerRef.current.material) {
        columnInnerRef.current.material.opacity = colOpacity * 0.85;
      }
    }

    if (baseGlowRef.current?.material) {
      const pulse = 0.4 * (1 - easeOut) * groundPeak;
      baseGlowRef.current.material.opacity = pulse;
    }

    const im = moteInstRef.current;
    if (im) {
      for (let i = 0; i < moteData.length; i++) {
        const m = moteData[i];
        const yRaw = (elapsed.current * m.speed + m.phase) % m.maxY;
        const w = Math.sin(elapsed.current * 3 + m.wobble) * 0.09;
        const y = yRaw + FLOOR_Y + 0.08;
        const x = Math.cos(m.a) * m.r + w;
        const z = Math.sin(m.a) * m.r - w * 0.5;
        dummy.position.set(x, y, z);
        const s = m.scale * (0.55 + 0.45 * (1 - t));
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
        const fadeT = Math.max(0, (1 - t * 1.1) * (0.35 + 0.65 * (1 - yRaw / m.maxY)));
        moteColorScratch.current.copy(moteColors[i]).multiplyScalar(0.4 + 0.6 * fadeT);
        im.setColorAt(i, moteColorScratch.current);
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }

    if (t >= 1 && !completeRef.current) {
      completeRef.current = true;
      onComplete();
    }
  });

  return (
    <group position={position}>
      <mesh ref={groundDiscRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]}>
        <circleGeometry args={[0.9, 40]} />
        <meshBasicMaterial
          color="#55eeaa"
          transparent
          opacity={0.5}
          blending={AdditiveBlending}
          depthWrite={false}
          side={2}
        />
      </mesh>

      <mesh ref={groundRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y + 0.01, 0]}>
        <ringGeometry args={[0.55, 0.75, 32]} />
        <meshBasicMaterial
          color="#aaffdd"
          transparent
          opacity={0.45}
          blending={AdditiveBlending}
          depthWrite={false}
          side={2}
        />
      </mesh>

      <mesh ref={baseGlowRef} position={[0, FLOOR_Y + 0.15, 0]}>
        <sphereGeometry args={[0.4, 12, 12]} />
        <meshBasicMaterial
          color="#44ff99"
          transparent
          opacity={0.25}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={columnOuterRef} position={[0, FLOOR_Y, 0]}>
        <cylinderGeometry args={[0.52, 0.58, COL_GEOM_H, 20, 1, true]} />
        <meshBasicMaterial
          color="#55ddaa"
          transparent
          opacity={0.45}
          blending={AdditiveBlending}
          depthWrite={false}
          side={2}
        />
      </mesh>

      <mesh ref={columnInnerRef} position={[0, FLOOR_Y, 0]}>
        <cylinderGeometry args={[0.22, 0.3, COL_GEOM_H, 12, 1, true]} />
        <meshBasicMaterial
          color="#ccffee"
          transparent
          opacity={0.4}
          blending={AdditiveBlending}
          depthWrite={false}
          side={2}
        />
      </mesh>

      <instancedMesh ref={moteInstRef} args={[moteGeo, moteMat, MOTE_N]} frustumCulled={false} />
    </group>
  );
}
