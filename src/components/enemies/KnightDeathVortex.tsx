'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

interface KnightDeathVortexProps {
  id: string;
  position: { x: number; y: number; z: number };
  soulType?: string | null;
  onComplete: () => void;
}

interface VortexPalette {
  light: string;
  core: string;
  halo: string;
  innerA: string; // alternating orb colour A (even indices)
  innerB: string; // alternating orb colour B (odd indices)
  outerA: string; // every 3rd === 0
  outerB: string; // every 3rd === 1
  outerC: string; // every 3rd === 2
  beam: string;
}

function getPalette(soulType?: string | null): VortexPalette {
  switch (soulType) {
    case 'red':
      return {
        light: '#ff3020', core: '#fff0f0', halo: '#ff3020',
        innerA: '#ffffff', innerB: '#ff5040',
        outerA: '#ff8080', outerB: '#ff4040', outerC: '#ffffff',
        beam: '#ff6040',
      };
    case 'purple':
      return {
        light: '#c060ff', core: '#f8f0ff', halo: '#9030e0',
        innerA: '#ffffff', innerB: '#c060ff',
        outerA: '#d080ff', outerB: '#b050f0', outerC: '#ffffff',
        beam: '#c060ff',
      };
    case 'green':
      return {
        light: '#30e060', core: '#f0fff4', halo: '#20c040',
        innerA: '#ffffff', innerB: '#40ff80',
        outerA: '#80ffa0', outerB: '#40c060', outerC: '#ffffff',
        beam: '#40ff80',
      };
    case 'blue':
      return {
        light: '#4080ff', core: '#f0f8ff', halo: '#2060e0',
        innerA: '#ffffff', innerB: '#4090ff',
        outerA: '#8090ff', outerB: '#5070f0', outerC: '#ffffff',
        beam: '#4090ff',
      };
    default:
      // Original gold palette
      return {
        light: '#ffe0a0', core: '#fffff0', halo: '#ffc840',
        innerA: '#ffffff', innerB: '#ffd860',
        outerA: '#b8b8ff', outerB: '#90c8ff', outerC: '#ffffff',
        beam: '#ffe0a0',
      };
  }
}

const TOTAL_DURATION = 2.0;   // seconds before the effect is removed
const RISE_START    = 0.25;   // seconds — wait for burst before rising
const FADE_START    = 1.25;    // seconds — begin fading
const RISE_SPEED    = 6.0;    // units per second

const INNER_COUNT  = 6;
const OUTER_COUNT  = 10;
const INNER_RADIUS = 0.375;
const OUTER_RADIUS = 0.75;

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

export default function KnightDeathVortex({ position, soulType, onComplete }: KnightDeathVortexProps) {
  const palette = getPalette(soulType);
  const groupRef     = useRef<THREE.Group>(null);
  const innerRef     = useRef<THREE.Group>(null);
  const outerRef     = useRef<THREE.Group>(null);
  const coreRef      = useRef<THREE.Mesh>(null);
  const haloRef      = useRef<THREE.Mesh>(null);
  const beamRef      = useRef<THREE.Mesh>(null);
  const elapsed      = useRef(0);
  const completed    = useRef(false);
  const riseOffset   = useRef(0);
  // Cache of { mat, baseOpacity } collected once from innerRef/outerRef on first frame.
  const cachedOrbMats = useRef<Array<{ mat: THREE.MeshBasicMaterial; base: number }>>([]);
  const orbMatsCached = useRef(false);

  const startY = position.y + 0.6;

  // Borrow a pooled light for the vortex glow instead of mounting a <pointLight>.
  const vortexLight = useDynamicLight({ color: palette.light, distance: 14, priority: 1 });

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
    {
      const pulse = 1 + 0.35 * Math.sin(t * 11.0);
      // Drive the pooled light at the orb's world position (light sat at the
      // group origin, which rises with the orb).
      vortexLight.current?.setPosition(position.x, startY + riseOffset.current, position.z);
      vortexLight.current?.setIntensity(10 * opacity * pulse);
    }

    // ── Orb ring opacity — build cache once, then iterate the flat list ──────
    if (!orbMatsCached.current && innerRef.current && outerRef.current) {
      const collected: Array<{ mat: THREE.MeshBasicMaterial; base: number }> = [];
      [innerRef.current, outerRef.current].forEach(grp => {
        grp.traverse((child: THREE.Object3D) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh && mesh.material) {
            const mat = mesh.material as THREE.MeshBasicMaterial;
            if (mat.transparent) {
              collected.push({ mat, base: mat.userData.baseOpacity ?? 1 });
            }
          }
        });
      });
      cachedOrbMats.current = collected;
      orbMatsCached.current = true;
    }

    for (let i = 0; i < cachedOrbMats.current.length; i++) {
      const { mat, base } = cachedOrbMats.current[i];
      mat.opacity = opacity * base;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[position.x, startY, position.z]}
    >
      {/* Core orb */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshBasicMaterial
          color={palette.core}
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Outer halo */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.425, 12, 12]} />
        <meshBasicMaterial
          color={palette.halo}
          transparent
          opacity={0.38}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Inner ring — fast spinning, two alternating colours */}
      <group ref={innerRef}>
        {innerPositions.map((pos, i) => (
          <mesh key={i} position={pos}>
            <sphereGeometry args={[0.085, 8, 8]} />
            <meshBasicMaterial
              color={i % 2 === 0 ? palette.innerA : palette.innerB}
              transparent
              opacity={0.95}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              userData={{ baseOpacity: 0.95 }}
            />
          </mesh>
        ))}
      </group>

      {/* Outer ring — slower, counter-rotating, three cycling colours */}
      <group ref={outerRef}>
        {outerPositions.map((pos, i) => {
          const color =
            i % 3 === 0 ? palette.outerA : i % 3 === 1 ? palette.outerB : palette.outerC;
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
        <cylinderGeometry args={[0.04, 0.15, 2.5, 8, 1, true]} />
        <meshBasicMaterial
          color={palette.beam}
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
