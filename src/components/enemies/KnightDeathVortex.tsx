'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface KnightDeathVortexProps {
  id: string;
  position: { x: number; y: number; z: number };
  onComplete: () => void;
}

const TOTAL_DURATION = 4.8;   // seconds before the effect is removed
const RISE_START    = 0.25;   // seconds — wait for burst before rising
const FADE_START    = 3.2;    // seconds — begin fading
const RISE_SPEED    = 2.2;    // units per second

const INNER_COUNT  = 9;
const OUTER_COUNT  = 14;
const INNER_RADIUS = 0.52;
const OUTER_RADIUS = 1.05;

// Pre-compute ring positions so they don't allocate every frame
function makeRingPositions(count: number, radius: number, vertAmp: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle * 0.5) * vertAmp,
      Math.sin(angle) * radius,
    );
  });
}

export default function KnightDeathVortex({ position, onComplete }: KnightDeathVortexProps) {
  const groupRef     = useRef<THREE.Group>(null);
  const innerRef     = useRef<THREE.Group>(null);
  const outerRef     = useRef<THREE.Group>(null);
  const coreRef      = useRef<THREE.Mesh>(null);
  const haloRef      = useRef<THREE.Mesh>(null);
  const beamRef      = useRef<THREE.Mesh>(null);
  const lightRef     = useRef<THREE.PointLight>(null);
  const elapsed      = useRef(0);
  const completed    = useRef(false);
  const riseOffset   = useRef(0);

  const startY = position.y + 0.6;

  const innerPositions = useMemo(() => makeRingPositions(INNER_COUNT, INNER_RADIUS, 0.18), []);
  const outerPositions = useMemo(() => makeRingPositions(OUTER_COUNT, OUTER_RADIUS, 0.32), []);

  useFrame((_, delta) => {
    if (completed.current) return;

    elapsed.current += delta;
    const t = elapsed.current;

    if (t >= TOTAL_DURATION) {
      completed.current = true;
      onComplete();
      return;
    }

    const group = groupRef.current;
    if (!group) return;

    // ── Rise ──────────────────────────────────────────────────────────────────
    if (t > RISE_START) {
      riseOffset.current += delta * RISE_SPEED;
    }
    group.position.y = startY + riseOffset.current;

    // ── Burst scale (0→1.3 in first 0.35 s then settles to 1) ────────────────
    let scale: number;
    if (t < 0.35) {
      const s = t / 0.35;
      scale = 1 - Math.pow(1 - s, 3); // easeOutCubic
      scale *= 1.3;
    } else if (t < 0.55) {
      // Overshoot settle
      const s = (t - 0.35) / 0.20;
      scale = 1.3 - 0.3 * (1 - Math.pow(1 - s, 2));
    } else {
      // Gentle breath
      scale = 1.0 + 0.06 * Math.sin(t * 5.0);
    }
    group.scale.setScalar(Math.max(0, scale));

    // ── Opacity / fade ────────────────────────────────────────────────────────
    let opacity = 1.0;
    if (t > FADE_START) {
      opacity = 1 - (t - FADE_START) / (TOTAL_DURATION - FADE_START);
      opacity = Math.max(0, opacity);
    }

    // ── Ring rotations ────────────────────────────────────────────────────────
    if (innerRef.current) {
      innerRef.current.rotation.y += delta * 4.8;
      innerRef.current.rotation.x  = Math.sin(t * 2.3) * 0.35;
    }
    if (outerRef.current) {
      outerRef.current.rotation.y -= delta * 2.2;
      outerRef.current.rotation.z  = Math.cos(t * 1.7) * 0.22;
    }

    // ── Core pulse ────────────────────────────────────────────────────────────
    if (coreRef.current) {
      const pulse = 1 + 0.18 * Math.sin(t * 9.0);
      coreRef.current.scale.setScalar(pulse);
      (coreRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
    }

    // ── Halo ─────────────────────────────────────────────────────────────────
    if (haloRef.current) {
      const haloPulse = 1 + 0.12 * Math.cos(t * 7.0);
      haloRef.current.scale.setScalar(haloPulse);
      (haloRef.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.38;
    }

    // ── Beam stretches upward as the orb rises ────────────────────────────────
    if (beamRef.current) {
      const beamScale = Math.min(3.5, 1 + riseOffset.current * 0.8);
      beamRef.current.scale.y = beamScale;
      (beamRef.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.22;
    }

    // ── Point light ──────────────────────────────────────────────────────────
    if (lightRef.current) {
      const pulse = 1 + 0.35 * Math.sin(t * 11.0);
      lightRef.current.intensity = 10 * opacity * pulse;
    }

    // ── Orb ring opacity (traverse inner/outer groups only) ───────────────────
    [innerRef.current, outerRef.current].forEach(grp => {
      if (!grp) return;
      grp.traverse((child: THREE.Object3D) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && mesh.material) {
          const mat = mesh.material as THREE.MeshBasicMaterial;
          if (mat.transparent) mat.opacity = opacity * (mat.userData.baseOpacity ?? 1);
        }
      });
    });
  });

  return (
    <group
      ref={groupRef}
      position={[position.x, startY, position.z]}
    >
      {/* Scene light */}
      <pointLight
        ref={lightRef}
        color="#ffe0a0"
        intensity={10}
        distance={14}
        decay={2}
      />

      {/* Core orb — bright white-gold */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.33, 20, 20]} />
        <meshBasicMaterial
          color="#fffff0"
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Outer halo — soft gold */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.58, 14, 14]} />
        <meshBasicMaterial
          color="#ffc840"
          transparent
          opacity={0.38}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Inner ring — fast counter-clockwise, gold + white alternating */}
      <group ref={innerRef}>
        {innerPositions.map((pos, i) => (
          <mesh key={i} position={pos}>
            <sphereGeometry args={[0.085, 8, 8]} />
            <meshBasicMaterial
              color={i % 2 === 0 ? '#ffffff' : '#ffd860'}
              transparent
              opacity={0.95}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              userData={{ baseOpacity: 0.95 }}
            />
          </mesh>
        ))}
      </group>

      {/* Outer ring — slower, counter-rotating, ethereal blue-white-purple */}
      <group ref={outerRef}>
        {outerPositions.map((pos, i) => {
          const color =
            i % 3 === 0 ? '#b8b8ff' : i % 3 === 1 ? '#90c8ff' : '#ffffff';
          return (
            <mesh key={i} position={pos}>
              <sphereGeometry args={[0.065, 8, 8]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.82}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                userData={{ baseOpacity: 0.82 }}
              />
            </mesh>
          );
        })}
      </group>

      {/* Vertical light beam — stretches as the orb ascends */}
      <mesh ref={beamRef} position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.04, 0.18, 3.5, 8, 1, true]} />
        <meshBasicMaterial
          color="#ffe0a0"
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
