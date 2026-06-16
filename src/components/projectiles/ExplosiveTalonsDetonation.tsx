import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Group,
  Mesh,
  Material,
  AdditiveBlending,
  Color,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import { EXPLOSIVE_TALONS_EXPLOSION_RADIUS } from '@/utils/talents';

const VENOM = new Color('#2ee6a8');
const ACCENT = new Color('#ff9a3c');
const DURATION = 0.45;

interface ExplosiveTalonsDetonationProps {
  position: Vector3;
  onComplete: () => void;
}

/**
 * One-shot AoE read for Explosive Talons at max range; scale tracks gameplay radius.
 */
export default function ExplosiveTalonsDetonation({
  position,
  onComplete,
}: ExplosiveTalonsDetonationProps) {
  const groupRef = useRef<Group>(null);
  const ringOuterRef = useRef<Mesh>(null);
  const ringInnerRef = useRef<Mesh>(null);
  const startTime = useRef<number | null>(null);

  const px = position.x;
  const py = Math.max(1.0, position.y);
  const pz = position.z;

  // Collapse the two near-coincident <pointLight>s into one pooled light at the
  // detonation origin (world space). Use the brighter accent color.
  const detonationLight = useDynamicLight({
    color: ACCENT,
    distance: EXPLOSIVE_TALONS_EXPLOSION_RADIUS * 3,
    decay: 2,
    priority: 1,
  });

  useFrame((state) => {
    if (!groupRef.current) return;

    if (startTime.current === null) {
      startTime.current = state.clock.getElapsedTime();
    }

    const t = (state.clock.getElapsedTime() - startTime.current) / DURATION;
    if (t >= 1) {
      onComplete();
      return;
    }

    const fade = 1 - t;

    // Replicate the original accent light intensity (2.2) faded out over the burst.
    detonationLight.current?.setPosition(px, py, pz);
    detonationLight.current?.setIntensity(2.2 * fade);
    // Expand from ~0 to ~match explosion radius (major torus radius grows with group scale)
    const pulse = 0.15 + t * 0.85;

    groupRef.current.scale.setScalar(pulse);

    const outer = ringOuterRef.current;
    const inner = ringInnerRef.current;
    for (const mesh of [outer, inner]) {
      if (!mesh?.material || !(mesh.material instanceof Material)) continue;
      const mat = mesh.material as any;
      mat.opacity = fade * (mesh === outer ? 0.75 : 0.55);
      mat.emissiveIntensity = fade * (mesh === outer ? 2.2 : 1.6);
    }
  });

  const baseR = EXPLOSIVE_TALONS_EXPLOSION_RADIUS * 0.42;
  const tubeOuter = Math.max(0.08, EXPLOSIVE_TALONS_EXPLOSION_RADIUS * 0.11);
  const tubeInner = tubeOuter * 0.65;

  return (
    <group ref={groupRef} position={[px, py, pz]}>
      <mesh ref={ringOuterRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[baseR, tubeOuter, 10, 40]} />
        <meshStandardMaterial
          color={VENOM}
          emissive={VENOM}
          emissiveIntensity={2}
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh ref={ringInnerRef} rotation={[Math.PI / 2, 0, 0.35]}>
        <torusGeometry args={[baseR * 0.72, tubeInner, 8, 32]} />
        <meshStandardMaterial
          color={ACCENT}
          emissive={ACCENT}
          emissiveIntensity={1.6}
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
