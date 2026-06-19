'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Group,
  MeshBasicMaterial,
  Color,
  AdditiveBlending,
  Vector3,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

interface WarlockVoidBoltExplosionProps {
  position: Vector3;
  onComplete: () => void;
}

const DURATION = 0.42;

/** Brief void-chaos burst when a warlock chaos orb hits the player — matches WarlockProjectile palette. */
export default function WarlockVoidBoltExplosion({
  position,
  onComplete,
}: WarlockVoidBoltExplosionProps) {
  const tRef = useRef(0);
  const doneRef = useRef(false);
  const coreRef = useRef<Group>(null);
  const voidRef = useRef<Group>(null);
  const flashRef = useRef<Group>(null);
  const ring1Ref = useRef<Group>(null);
  const ring2Ref = useRef<Group>(null);
  const ring3Ref = useRef<Group>(null);

  const anchor = useMemo(
    () => [position.x, position.y + 1.0, position.z] as [number, number, number],
    [position.x, position.y, position.z],
  );

  const explosionLight = useDynamicLight({
    color: '#dd1133',
    distance: 7,
    decay: 2,
    priority: 2,
  });

  const voidMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#1a0005'),
        transparent: true,
        opacity: 0.92,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const coreMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#dd1133'),
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const midMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#880022'),
        transparent: true,
        opacity: 0.6,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const flashMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#ffffff'),
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const ring1Mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#ff2244'),
        transparent: true,
        opacity: 0.75,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const ring2Mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#aa1133'),
        transparent: true,
        opacity: 0.65,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const ring3Mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#660018'),
        transparent: true,
        opacity: 0.55,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  useEffect(
    () => () => {
      voidMat.dispose();
      coreMat.dispose();
      midMat.dispose();
      flashMat.dispose();
      ring1Mat.dispose();
      ring2Mat.dispose();
      ring3Mat.dispose();
    },
    [voidMat, coreMat, midMat, flashMat, ring1Mat, ring2Mat, ring3Mat],
  );

  useFrame((_, delta) => {
    tRef.current += delta;
    const t = tRef.current;
    const p = Math.min(t / DURATION, 1);
    const fadeOut = Math.max(0, 1 - p);
    const pulse = 0.85 + 0.15 * Math.sin(t * 14);

    explosionLight.current?.setPosition(position.x, position.y + 1.0, position.z);
    explosionLight.current?.setIntensity(14 + 28 * pulse * fadeOut);

    if (flashRef.current) {
      const ft = Math.min(t / 0.12, 1);
      flashRef.current.scale.setScalar(2.4 * (1 - ft) + 0.3);
      flashMat.opacity = Math.max(0, 0.95 * (1 - t / 0.1));
    }

    if (voidRef.current) {
      const voidScale = 0.15 + Math.sin(Math.min(p, 0.85) * Math.PI) * 1.35;
      voidRef.current.scale.setScalar(voidScale);
      voidMat.opacity = 0.92 * fadeOut * fadeOut;
    }

    if (coreRef.current) {
      const coreScale = 0.2 + Math.sin(Math.min(p, 0.9) * Math.PI) * 0.95;
      coreRef.current.scale.setScalar(coreScale);
      coreMat.opacity = 0.95 * fadeOut * pulse;
      midMat.opacity = 0.6 * fadeOut * pulse;
    }

    const ringFade = fadeOut * fadeOut;
    const shock1 = Math.max(0, Math.min((t - 0.01) / (DURATION * 0.75), 1));
    const shock2 = Math.max(0, Math.min((t - 0.05) / (DURATION * 0.8), 1));
    const shock3 = Math.max(0, Math.min((t - 0.09) / (DURATION * 0.85), 1));

    if (ring1Ref.current) {
      ring1Ref.current.scale.setScalar(0.2 + shock1 * 1.5);
      ring1Mat.opacity = 0.75 * ringFade * (0.35 + 0.65 * shock1);
    }
    if (ring2Ref.current) {
      ring2Ref.current.scale.setScalar(0.18 + shock2 * 1.65);
      ring2Mat.opacity = 0.65 * ringFade * (0.35 + 0.65 * shock2);
    }
    if (ring3Ref.current) {
      ring3Ref.current.scale.setScalar(0.16 + shock3 * 1.8);
      ring3Mat.opacity = 0.55 * ringFade * (0.35 + 0.65 * shock3);
    }

    if (p >= 1 && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group position={anchor}>
      <group ref={flashRef}>
        <mesh material={flashMat}>
          <sphereGeometry args={[0.35, 12, 12]} />
        </mesh>
      </group>

      <group ref={voidRef}>
        <mesh material={voidMat}>
          <sphereGeometry args={[0.95, 10, 10]} />
        </mesh>
      </group>

      <group ref={coreRef}>
        <mesh material={coreMat}>
          <sphereGeometry args={[0.5, 10, 10]} />
        </mesh>
        <mesh material={midMat}>
          <sphereGeometry args={[0.72, 10, 10]} />
        </mesh>
      </group>

      <group ref={ring1Ref} rotation={[Math.PI / 3, 0, 0]}>
        <mesh material={ring1Mat}>
          <torusGeometry args={[0.6, 0.038, 6, 28]} />
        </mesh>
      </group>
      <group ref={ring2Ref} rotation={[-Math.PI / 3.6, 0, Math.PI / 4]}>
        <mesh material={ring2Mat}>
          <torusGeometry args={[0.68, 0.028, 6, 28]} />
        </mesh>
      </group>
      <group ref={ring3Ref} rotation={[0, Math.PI / 4, Math.PI / 5]}>
        <mesh material={ring3Mat}>
          <torusGeometry args={[0.55, 0.032, 6, 24]} />
        </mesh>
      </group>
    </group>
  );
}
