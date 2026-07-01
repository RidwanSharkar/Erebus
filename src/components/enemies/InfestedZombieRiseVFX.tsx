'use client';

import React, { useRef } from 'react';
import { Vector3, AdditiveBlending, Color } from 'three';
import { useFrame } from '@react-three/fiber';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

interface InfestedZombieRiseVFXProps {
  position: Vector3;
  onComplete: () => void;
}

const DURATION_SEC = 2.2;
const _green = new Color('#44ff99');
const _greenDeep = new Color('#00aa55');

/** Small green spectral "rise from the grave" burst at infested zombie spawn. */
export default function InfestedZombieRiseVFX({ position, onComplete }: InfestedZombieRiseVFXProps) {
  const elapsed = useRef(0);
  const groupRef = useRef<any>(null);
  const ringRef = useRef<any>(null);
  const pillarRef = useRef<any>(null);
  const sparksRef = useRef<any[]>([]);

  // Borrow a pooled light for the rise glow instead of mounting a <pointLight>.
  const riseLight = useDynamicLight({ color: '#66ffaa', distance: 4, priority: 1 });

  useFrame((_, delta) => {
    elapsed.current += delta;
    const t = Math.min(1, elapsed.current / DURATION_SEC);

    const rise = t * 2.2;
    const fade = t < 0.55 ? t / 0.55 : Math.max(0, 1 - (t - 0.55) / 0.45);

    if (groupRef.current) {
      groupRef.current.position.set(position.x, position.y + rise * 0.35, position.z);
    }

    // Drive the pooled light at the effect's world position (light sat at local
    // [0, 0.5, 0] under the rising group).
    riseLight.current?.setPosition(position.x, position.y + rise * 0.35 + 0.5, position.z);
    riseLight.current?.setIntensity(2.5 * fade);
    if (ringRef.current?.material) {
      ringRef.current.material.opacity = 0.55 * fade;
      ringRef.current.scale.setScalar(0.85 + t * 0.9);
    }
    if (pillarRef.current?.material) {
      pillarRef.current.material.opacity = 0.35 * fade;
      pillarRef.current.scale.y = 0.2 + t * 1.6;
    }
    sparksRef.current.forEach((m, i) => {
      if (!m?.material) return;
      const phase = (i * 0.31) % 1;
      const ft = Math.max(0, fade - phase * 0.2);
      m.material.opacity = 0.5 * ft;
    });

    if (t >= 1) onComplete();
  });

  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.85, 32]} />
        <meshBasicMaterial
          color={_green}
          transparent
          opacity={0.55}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={pillarRef} position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.25, 0.45, 1.8, 12, 1, true]} />
        <meshBasicMaterial
          color={_greenDeep}
          transparent
          opacity={0.35}
          blending={AdditiveBlending}
          depthWrite={false}
          side={2}
        />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        const r = 0.55 + (i % 3) * 0.12;
        return (
          <mesh
            key={i}
            ref={(el) => {
              sparksRef.current[i] = el;
            }}
            position={[Math.sin(a) * r, 0.4 + i * 0.15, Math.cos(a) * r]}
          >
            <sphereGeometry args={[0.08 + (i % 2) * 0.04, 8, 8]} />
            <meshBasicMaterial
              color={i % 2 === 0 ? _green : _greenDeep}
              transparent
              opacity={0.5}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
