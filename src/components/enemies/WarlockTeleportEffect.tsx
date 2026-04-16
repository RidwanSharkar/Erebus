'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, MeshBasicMaterial, Color, AdditiveBlending } from 'three';

interface WarlockTeleportEffectProps {
  position: Vector3;
  type: 'start' | 'end';
  onComplete: () => void;
}

// Departure: 0.65 s — arcane rune flares then collapses into itself
// Arrival:   0.80 s — arcane gate tears open, rings spin out, rune blazes
const DURATION_START = 0.65;
const DURATION_END   = 0.80;

// Three orbiting arcane shards at different heights + angles
const SHARD_COUNT = 5;

export default function WarlockTeleportEffect({ position, type, onComplete }: WarlockTeleportEffectProps) {
  const groupRef = useRef<Group>(null);
  const timeRef  = useRef(0);
  const doneRef  = useRef(false);

  const duration = type === 'start' ? DURATION_START : DURATION_END;

  // Stable shard layout — angle + radius tier per shard
  const shards = useMemo(() =>
    Array.from({ length: SHARD_COUNT }, (_, i) => ({
      baseAngle: (i / SHARD_COUNT) * Math.PI * 2,
      radius:    0.35 + (i % 2) * 0.25,
      height:    0.15 + (i / SHARD_COUNT) * 0.7,
      speed:     (i % 2 === 0 ? 1 : -1) * (7 + i * 0.8),
    })),
  []);

  // Shared materials — updated in useFrame, disposed on unmount
  const mats = useMemo(() => ({
    core:  new MeshBasicMaterial({ color: new Color('#cc88ff'), transparent: true, opacity: 1.0,  blending: AdditiveBlending, depthWrite: false }),
    rune:  new MeshBasicMaterial({ color: new Color('#6600cc'), transparent: true, opacity: 0.8,  blending: AdditiveBlending, depthWrite: false, side: 2 }),
    ring:  new MeshBasicMaterial({ color: new Color('#9900ff'), transparent: true, opacity: 0.7,  blending: AdditiveBlending, depthWrite: false }),
    shard: new MeshBasicMaterial({ color: new Color('#ff2266'), transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false }),
  }), []);

  useEffect(() => () => { Object.values(mats).forEach(m => m.dispose()); }, [mats]);

  const coreRef    = useRef<any>(null);
  const outerRef   = useRef<any>(null);
  const runeRef    = useRef<any>(null);
  const ringARef   = useRef<any>(null);
  const ringBRef   = useRef<any>(null);
  const shardRefs  = useRef<(any | null)[]>(Array(SHARD_COUNT).fill(null));

  useFrame((_, delta) => {
    if (doneRef.current) return;

    timeRef.current += delta;
    const t = Math.min(timeRef.current / duration, 1.0);

    if (type === 'start') {
      // ── Departure: bright core flash → rune dims → whole thing implodes ──
      const flash   = t < 0.2 ? t / 0.2 : 1.0 - (t - 0.2) / 0.8;
      const collapse = 1.0 - t;

      if (coreRef.current) {
        coreRef.current.scale.setScalar(Math.max(0.001, 0.2 + flash * 0.6));
        mats.core.opacity = flash;
      }
      if (outerRef.current) {
        outerRef.current.scale.setScalar(Math.max(0.001, collapse * 1.0));
        mats.ring.opacity = collapse * 0.7;
      }
      if (runeRef.current) {
        runeRef.current.scale.setScalar(Math.max(0.001, collapse * 1.1));
        runeRef.current.rotation.z = timeRef.current * 3;
        mats.rune.opacity = collapse * 0.8;
      }

      // Spinning torus rings — contract inward
      if (ringARef.current) {
        const s = Math.max(0.001, 0.8 * collapse);
        ringARef.current.scale.setScalar(s);
        ringARef.current.rotation.x = timeRef.current * 4;
        ringARef.current.rotation.z = timeRef.current * -3;
      }
      if (ringBRef.current) {
        const s = Math.max(0.001, 0.9 * collapse);
        ringBRef.current.scale.setScalar(s);
        ringBRef.current.rotation.y = timeRef.current * 5;
        ringBRef.current.rotation.z = timeRef.current * 2;
      }

      // Shards spiral inward
      shardRefs.current.forEach((ref, i) => {
        if (!ref) return;
        const sh      = shards[i];
        const r       = sh.radius * collapse;
        const angle   = sh.baseAngle + timeRef.current * sh.speed;
        ref.position.set(Math.cos(angle) * r, sh.height * collapse, Math.sin(angle) * r);
        mats.shard.opacity = collapse * 0.85;
      });

    } else {
      // ── Arrival: gate rips open (torus rings burst out), shards orbit, core blazes ──
      const burst = t < 0.35 ? t / 0.35 : 1.0;
      const fade  = t < 0.4  ? 1.0 : 1.0 - (t - 0.4) / 0.6;

      if (coreRef.current) {
        const boom = t < 0.25 ? t / 0.25 : 1.0 - (t - 0.25) / 0.75;
        coreRef.current.scale.setScalar(Math.max(0.001, 0.15 + boom * 0.65));
        mats.core.opacity = boom;
      }
      if (outerRef.current) {
        outerRef.current.scale.setScalar(Math.max(0.001, 0.1 + burst * 1.1));
        mats.ring.opacity = fade * 0.75;
      }
      if (runeRef.current) {
        runeRef.current.scale.setScalar(Math.max(0.001, 0.1 + burst * 1.0));
        runeRef.current.rotation.z = -timeRef.current * 4;
        mats.rune.opacity = fade * 0.85;
      }

      if (ringARef.current) {
        const s = Math.max(0.001, burst * 0.9);
        ringARef.current.scale.setScalar(s);
        ringARef.current.rotation.x = timeRef.current * 5;
        ringARef.current.rotation.z = timeRef.current * -4;
      }
      if (ringBRef.current) {
        const s = Math.max(0.001, burst * 1.0);
        ringBRef.current.scale.setScalar(s);
        ringBRef.current.rotation.y = timeRef.current * -6;
        ringBRef.current.rotation.x = timeRef.current * 3;
      }

      // Shards burst outward then slow
      shardRefs.current.forEach((ref, i) => {
        if (!ref) return;
        const sh    = shards[i];
        const r     = sh.radius * (0.2 + burst * 0.8);
        const angle = sh.baseAngle + timeRef.current * sh.speed;
        ref.position.set(Math.cos(angle) * r, sh.height * burst, Math.sin(angle) * r);
        mats.shard.opacity = fade * 0.9;
      });
    }

    if (t >= 1.0) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]}>

      {/* Ground arcane rune disc */}
      <mesh ref={runeRef} material={mats.rune} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.15, 0.7, 6]} />
      </mesh>

      {/* Outer shimmering circle */}
      <mesh ref={outerRef} material={mats.ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.6, 0.75, 24]} />
      </mesh>

      {/* Central arcane core */}
      <mesh ref={coreRef} material={mats.core} position={[0, 0.6, 0]}>
        <icosahedronGeometry args={[0.2, 0]} />
      </mesh>

      {/* Spinning torus ring A — tilted */}
      <mesh ref={ringARef} material={mats.ring} position={[0, 0.55, 0]}>
        <torusGeometry args={[0.45, 0.035, 6, 20]} />
      </mesh>

      {/* Spinning torus ring B — tilted other axis */}
      <mesh ref={ringBRef} material={mats.shard} position={[0, 0.55, 0]}>
        <torusGeometry args={[0.38, 0.028, 6, 20]} />
      </mesh>

      {/* Orbiting arcane shards — positions driven by useFrame */}
      {shards.map((_, i) => (
        <mesh
          key={i}
          ref={el => { shardRefs.current[i] = el; }}
          material={mats.shard}
        >
          <tetrahedronGeometry args={[0.07, 0]} />
        </mesh>
      ))}

      {/* Violet arcane light */}
      <pointLight color="#9900ff" intensity={8} distance={5} decay={2} position={[0, 0.6, 0]} />
    </group>
  );
}
