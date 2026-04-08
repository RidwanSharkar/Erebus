'use client';

import React, { useRef, useMemo } from 'react';
import { Vector3, AdditiveBlending } from 'three';
import { useFrame } from '@react-three/fiber';

interface WeaverHealEffectProps {
  position: Vector3;
  onComplete: () => void;
}

const DURATION = 1.8; // seconds

// Lightweight, instanced-friendly heal burst:
// - 3 expanding rings that fade out
// - a bright core flash
// - rising motes animated via useFrame
export default function WeaverHealEffect({ position, onComplete }: WeaverHealEffectProps) {
  const elapsed = useRef(0);
  const groupRef = useRef<any>(null);

  // Pre-compute mote offsets so they don't change each render
  const moteOffsets = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2;
      return { angle, radius: 0.5 + Math.random() * 0.4, speed: 1.2 + Math.random() * 0.8 };
    }), []);

  useFrame((_, delta) => {
    elapsed.current += delta;
    const t = Math.min(1, elapsed.current / DURATION);

    if (!groupRef.current) return;

    // Animate each child by name via userData stored index
    const children = groupRef.current.children as any[];
    children.forEach((child: any) => {
      const idx = child.userData.moteIdx;
      if (idx === undefined) return;
      const mote = moteOffsets[idx];
      const rise = t * 3.0 * mote.speed;
      child.position.set(
        Math.cos(mote.angle + elapsed.current * 1.5) * mote.radius * (1 - t * 0.5),
        rise,
        Math.sin(mote.angle + elapsed.current * 1.5) * mote.radius * (1 - t * 0.5),
      );
      const matOpacity = Math.max(0, 1 - t * 1.4);
      if (child.material) {
        child.material.opacity = matOpacity;
      }
    });

    if (t >= 1) onComplete();
  });

  const t0 = 0; // Starting alpha (controlled in useFrame but set as initial)

  return (
    <group ref={groupRef} position={position}>
      {/* Core bright flash */}
      <mesh>
        <sphereGeometry args={[0.55, 10, 10]} />
        <meshBasicMaterial
          color="#88ffbb"
          transparent
          opacity={0.9}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Inner glow */}
      <mesh>
        <sphereGeometry args={[0.9, 10, 10]} />
        <meshBasicMaterial
          color="#44ff88"
          transparent
          opacity={0.5}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Ring 1 — expands fast */}
      <RingPulse color="#55ffaa" initialScale={0.1} targetScale={4.5} duration={DURATION * 0.55} />

      {/* Ring 2 — expands slower, delayed */}
      <RingPulse color="#aaffdd" initialScale={0.1} targetScale={3.2} duration={DURATION * 0.8} delay={0.15} />

      {/* Ring 3 — thin outer */}
      <RingPulse color="#ffffff" initialScale={0.1} targetScale={5.5} duration={DURATION} delay={0.3} />

      {/* Rising mote particles */}
      {moteOffsets.map((mote, i) => (
        <mesh key={i} userData={{ moteIdx: i }}>
          <sphereGeometry args={[0.12, 6, 6]} />
          <meshBasicMaterial
            color={i % 2 === 0 ? '#88ffbb' : '#ffff88'}
            transparent
            opacity={0.9}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// Animated expanding ring disc
function RingPulse({
  color,
  initialScale,
  targetScale,
  duration,
  delay = 0,
}: {
  color: string;
  initialScale: number;
  targetScale: number;
  duration: number;
  delay?: number;
}) {
  const meshRef = useRef<any>(null);
  const elapsed = useRef(-delay);

  useFrame((_, delta) => {
    elapsed.current += delta;
    if (elapsed.current < 0) return;
    const t = Math.min(1, elapsed.current / duration);
    if (!meshRef.current) return;
    const s = initialScale + (targetScale - initialScale) * t;
    meshRef.current.scale.set(s, 1, s);
    meshRef.current.material.opacity = Math.max(0, (1 - t) * 0.75);
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
      <ringGeometry args={[0.8, 1.0, 32]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.7}
        blending={AdditiveBlending}
        depthWrite={false}
        side={2}
      />
    </mesh>
  );
}
