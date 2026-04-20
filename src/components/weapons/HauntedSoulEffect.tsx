import React, { useMemo, useRef } from 'react';
import { Group, Vector3 } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

interface HauntedSoulEffectProps {
  position: Vector3;
  /** Wrathful Strike talent (talents.ts): red spectral palette instead of purple */
  wrathfulStrike?: boolean;
  /** INFESTED STRIKE talent: green palette (wins over wrathful when both true) */
  infestedStrike?: boolean;
  onComplete?: () => void;
}

const SOUL_PALETTE = {
  spectral: {
    main: '#4a148c',
    mainEmissive: '#6a1b9a',
    inner: '#ba68c8',
    innerEmissive: '#e1bee7',
    trail: '#9c27b0',
    trailEmissive: '#ce93d8',
    wisp: '#7b1fa2',
    wispEmissive: '#ab47bc',
  },
  wrathful: {
    main: '#7f0000',
    mainEmissive: '#b71c1c',
    inner: '#ff5252',
    innerEmissive: '#ffcdd2',
    trail: '#c62828',
    trailEmissive: '#ff8a80',
    wisp: '#b71c1c',
    wispEmissive: '#ff1744',
  },
  infested: {
    main: '#1b5e20',
    mainEmissive: '#2e7d32',
    inner: '#66bb6a',
    innerEmissive: '#c8e6c9',
    trail: '#388e3c',
    trailEmissive: '#a5d6a7',
    wisp: '#2e7d32',
    wispEmissive: '#69f0ae',
  },
} as const;

export default function HauntedSoulEffect({
  position,
  wrathfulStrike = false,
  infestedStrike = false,
  onComplete,
}: HauntedSoulEffectProps) {
  const soulRef = useRef<Group>(null);
  const progressRef = useRef(0);
  const startPosition = useRef(position.clone());
  const colors = useMemo(() => {
    if (infestedStrike) return SOUL_PALETTE.infested;
    if (wrathfulStrike) return SOUL_PALETTE.wrathful;
    return SOUL_PALETTE.spectral;
  }, [wrathfulStrike, infestedStrike]);
  const emissiveBoost = infestedStrike || wrathfulStrike;

  useFrame((_, delta) => {
    if (!soulRef.current) return;

    progressRef.current += delta * 2; // Speed of the soul rising

    if (progressRef.current >= 1) {
      // Effect complete
      if (onComplete) {
        onComplete();
      }
      return;
    }

    // Move the soul upwards in a curved path
    const height = progressRef.current * 8; // Rise 8 units up
    const horizontalDrift = Math.sin(progressRef.current * Math.PI * 2) * 0.5; // Slight horizontal drift

    soulRef.current.position.set(
      startPosition.current.x + horizontalDrift,
      startPosition.current.y + height,
      startPosition.current.z
    );
  });

  return (
    <group ref={soulRef} position={[startPosition.current.x, startPosition.current.y, startPosition.current.z]}>
      {/* Main soul orb */}
      <mesh>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial
          color={colors.main}
          transparent
          opacity={1 - progressRef.current}
          emissive={colors.mainEmissive}
          emissiveIntensity={emissiveBoost ? 0.65 : 0.5}
        />
      </mesh>

      {/* Inner glowing core */}
      <mesh>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial
          color={colors.inner}
          transparent
          opacity={1 - progressRef.current}
          emissive={colors.innerEmissive}
          emissiveIntensity={emissiveBoost ? 1.15 : 1.0}
        />
      </mesh>

      {/* Particle trail effect */}
      <group>
        {Array.from({ length: 5 }, (_, i) => {
          const angle = (i / 5) * Math.PI * 2;
          const radius = 0.2;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const y = (progressRef.current - i * 0.1) * 2;

          if (y < 0) return null;

          return (
            <mesh key={i} position={[x, y, z]}>
              <sphereGeometry args={[0.05, 6, 6]} />
              <meshStandardMaterial
                color={colors.trail}
                transparent
                opacity={(1 - progressRef.current) * 0.7}
                emissive={colors.trailEmissive}
                emissiveIntensity={emissiveBoost ? 0.4 : 0.3}
              />
            </mesh>
          );
        })}
      </group>

      {/* Spectral wisps */}
      {Array.from({ length: 3 }, (_, i) => {
        const angle = (i / 3) * Math.PI * 2 + progressRef.current * Math.PI;
        const radius = 0.4 + Math.sin(progressRef.current * Math.PI * 3) * 0.1;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        return (
          <mesh key={`wisp-${i}`} position={[x, progressRef.current * 6, z]}>
            <planeGeometry args={[0.1, 0.8]} />
            <meshStandardMaterial
              color={colors.wisp}
              transparent
              opacity={(1 - progressRef.current) * 0.4}
              emissive={colors.wispEmissive}
              emissiveIntensity={emissiveBoost ? 0.28 : 0.2}
              side={2} // DoubleSide
            />
          </mesh>
        );
      })}
    </group>
  );
}
