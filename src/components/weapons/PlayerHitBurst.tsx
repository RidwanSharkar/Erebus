'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from '@/utils/three-exports';

interface PlayerHitBurstProps {
  position: Vector3;
  damageType?: string;
  intensity?: number;
  onComplete: () => void;
}

const DURATION = 0.28;

function getBurstColor(damageType?: string): Color {
  const type = (damageType ?? '').toLowerCase();
  if (type.includes('frost') || type.includes('ice')) return new Color('#7dd3fc');
  if (type.includes('void') || type.includes('shadow') || type.includes('warlock')) return new Color('#a855f7');
  if (type.includes('fire') || type.includes('meteor')) return new Color('#ff6a2a');
  if (type.includes('aegis') || type.includes('shield')) return new Color('#60a5fa');
  return new Color('#ff3344');
}

export default function PlayerHitBurst({
  position,
  damageType,
  intensity = 0.45,
  onComplete,
}: PlayerHitBurstProps) {
  const groupRef = useRef<Group>(null);
  const flashRef = useRef<Mesh | null>(null);
  const ringRef = useRef<Mesh | null>(null);
  const timeRef = useRef(0);
  const doneRef = useRef(false);
  const color = useMemo(() => getBurstColor(damageType), [damageType]);
  const clampedIntensity = Math.max(0.2, Math.min(1, intensity));

  const flashMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: color.clone().lerp(new Color('#ffffff'), 0.35),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [color],
  );

  const ringMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [color],
  );

  useFrame((_, delta) => {
    if (doneRef.current) return;

    timeRef.current += delta;
    const t = timeRef.current;
    if (t >= DURATION) {
      doneRef.current = true;
      onComplete();
      return;
    }

    const progress = Math.min(1, t / DURATION);
    const fadeOut = Math.max(0, 1 - progress);

    if (flashRef.current) {
      const flashScale = 0.22 + progress * (1.2 + clampedIntensity);
      flashRef.current.scale.set(flashScale, flashScale, 1);
      flashMat.opacity = Math.min(0.65, fadeOut * clampedIntensity * 0.9);
    }

    if (ringRef.current) {
      const ringScale = 0.18 + progress * (0.9 + clampedIntensity * 0.8);
      ringRef.current.scale.set(ringScale, ringScale, ringScale);
      ringMat.opacity = Math.min(0.7, fadeOut * clampedIntensity);
    }
  });

  return (
    <group ref={groupRef} position={[position.x, position.y + 0.85, position.z]}>
      <mesh ref={flashRef} rotation={[-Math.PI / 2, 0, 0]} scale={[0.01, 0.01, 1]}>
        <circleGeometry args={[1, 24]} />
        <primitive object={flashMat} attach="material" />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} scale={[0.01, 0.01, 0.01]}>
        <torusGeometry args={[1, 0.055, 6, 36]} />
        <primitive object={ringMat} attach="material" />
      </mesh>
    </group>
  );
}

