'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Group,
  Color,
  MeshBasicMaterial,
  AdditiveBlending,
  RingGeometry,
  CylinderGeometry,
  TetrahedronGeometry,
  IcosahedronGeometry,
  DoubleSide,
} from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

interface EnemySummonFlameVFXProps {
  position: Vector3;
  onComplete: () => void;
}

// Elegant "summoned from the flames" portal that blooms beneath an enemy the
// instant it spawns into an enemy room, then collapses into embers.
const DURATION_SEC = 1.25;
const EMBER_COUNT = 9;

export default function EnemySummonFlameVFX({ position, onComplete }: EnemySummonFlameVFXProps) {
  const groupRef = useRef<Group>(null);
  const ringRef = useRef<any>(null);
  const haloRef = useRef<any>(null);
  const pillarRef = useRef<any>(null);
  const coreRef = useRef<any>(null);
  const emberRefs = useRef<(any | null)[]>(Array(EMBER_COUNT).fill(null));
  const elapsed = useRef(0);
  const done = useRef(false);

  // Stable per-ember swirl layout.
  const embers = useMemo(
    () =>
      Array.from({ length: EMBER_COUNT }, (_, i) => ({
        baseAngle: (i / EMBER_COUNT) * Math.PI * 2,
        radius: 0.45 + (i % 3) * 0.22,
        rise: 1.4 + (i % 4) * 0.45,
        spin: (i % 2 === 0 ? 1 : -1) * (3.5 + (i % 3) * 1.4),
        size: 0.05 + (i % 3) * 0.03,
      })),
    [],
  );

  // Geometries + materials are created once and explicitly disposed on unmount
  // so the repeated spawn bursts never leak GPU buffers.
  const geos = useMemo(
    () => ({
      ring: new RingGeometry(0.28, 0.92, 56),
      halo: new RingGeometry(0.92, 1.06, 56),
      pillar: new CylinderGeometry(0.16, 0.62, 2.0, 28, 1, true),
      core: new IcosahedronGeometry(0.26, 1),
      ember: new TetrahedronGeometry(1, 0),
    }),
    [],
  );

  const mats = useMemo(
    () => ({
      ring: new MeshBasicMaterial({ color: new Color('#ff8a2a'), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
      halo: new MeshBasicMaterial({ color: new Color('#ffd071'), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
      pillar: new MeshBasicMaterial({ color: new Color('#ff4d18'), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
      core: new MeshBasicMaterial({ color: new Color('#fff1b8'), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
      ember: new MeshBasicMaterial({ color: new Color('#ffb347'), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
    }),
    [],
  );

  useEffect(
    () => () => {
      Object.values(geos).forEach(g => g.dispose());
      Object.values(mats).forEach(m => m.dispose());
    },
    [geos, mats],
  );

  // Borrow a pooled flame light instead of mounting a fresh <pointLight>.
  const flameLight = useDynamicLight({ color: '#ff7a2a', distance: 6, priority: 1 });

  useFrame((_, delta) => {
    if (done.current) return;
    elapsed.current += delta;
    const t = Math.min(1, elapsed.current / DURATION_SEC);

    // Sharp bloom, lingering ember fade.
    const burst = t < 0.32 ? t / 0.32 : 1;
    const fade = t < 0.4 ? 1 : Math.max(0, 1 - (t - 0.4) / 0.6);
    const flicker = 0.82 + Math.sin(elapsed.current * 34) * 0.18;

    flameLight.current?.setPosition(position.x, position.y + 0.9, position.z);
    flameLight.current?.setIntensity(7.5 * fade * flicker);

    if (ringRef.current) {
      ringRef.current.scale.setScalar(0.25 + burst * 1.05);
      ringRef.current.rotation.z = elapsed.current * 1.6;
      mats.ring.opacity = 0.85 * fade;
    }
    if (haloRef.current) {
      haloRef.current.scale.setScalar(0.25 + burst * 1.35);
      haloRef.current.rotation.z = -elapsed.current * 1.1;
      mats.halo.opacity = 0.6 * fade;
    }
    if (pillarRef.current) {
      const grow = 0.2 + burst * 1.0;
      pillarRef.current.scale.set(0.7 + burst * 0.5, grow, 0.7 + burst * 0.5);
      pillarRef.current.rotation.y = elapsed.current * 2.4;
      mats.pillar.opacity = 0.5 * fade * flicker;
    }
    if (coreRef.current) {
      const boom = t < 0.22 ? t / 0.22 : Math.max(0, 1 - (t - 0.22) / 0.5);
      coreRef.current.scale.setScalar(Math.max(0.001, 0.2 + boom * 0.85));
      coreRef.current.rotation.y = elapsed.current * 3.5;
      mats.core.opacity = boom * flicker;
    }

    emberRefs.current.forEach((ref, i) => {
      if (!ref) return;
      const e = embers[i];
      const angle = e.baseAngle + elapsed.current * e.spin;
      const r = e.radius * (0.4 + burst * 0.9);
      ref.position.set(Math.cos(angle) * r, e.rise * t, Math.sin(angle) * r);
      const fl = 0.7 + Math.sin(elapsed.current * 26 + i) * 0.3;
      ref.scale.setScalar(e.size * (1 - t * 0.4));
      mats.ember.opacity = 0.9 * fade * fl;
    });

    if (t >= 1) {
      done.current = true;
      onComplete();
    }
  });

  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]}>
      {/* Ground flame disc */}
      <mesh ref={ringRef} geometry={geos.ring} material={mats.ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} />

      {/* Outer ember halo */}
      <mesh ref={haloRef} geometry={geos.halo} material={mats.halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} />

      {/* Rising flame column */}
      <mesh ref={pillarRef} geometry={geos.pillar} material={mats.pillar} position={[0, 1.0, 0]} />

      {/* Bright summon core */}
      <mesh ref={coreRef} geometry={geos.core} material={mats.core} position={[0, 0.85, 0]} />

      {/* Spiralling embers */}
      {embers.map((_, i) => (
        <mesh
          key={i}
          ref={el => {
            emberRefs.current[i] = el;
          }}
          geometry={geos.ember}
          material={mats.ember}
        />
      ))}
    </group>
  );
}
