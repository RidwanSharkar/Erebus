import { useMemo, useRef } from 'react';
import { Group } from 'three';
import { useFrame } from '@react-three/fiber';
import type { TotemBoltVariant } from '@/utils/talents';

function auraPalette(variant?: TotemBoltVariant) {
  switch (variant) {
    case 'wrathful':
      return {
        outer: '#ef4444',
        plane: '#fca5a5',
        innerColor: '#b91c1c',
        streamColor: '#7f1d1d',
        streamEmissive: '#ef4444',
        ambient: '#fca5a5',
      };
    case 'staggering':
      return {
        outer: '#3b82f6',
        plane: '#93c5fd',
        innerColor: '#1d4ed8',
        streamColor: '#1e3a8a',
        streamEmissive: '#3b82f6',
        ambient: '#93c5fd',
      };
    case 'infesting':
      return {
        outer: '#22c55e',
        plane: '#86efac',
        innerColor: '#15803d',
        streamColor: '#14532d',
        streamEmissive: '#22c55e',
        ambient: '#86efac',
      };
    case 'frost':
      return {
        outer: '#0369a1',
        plane: '#7dd3fc',
        innerColor: '#0c4a6e',
        streamColor: '#082f49',
        streamEmissive: '#0284c7',
        ambient: '#bae6fd',
      };
    default:
      return {
        outer: '#0099ff',
        plane: '#0099ff',
        innerColor: '#0088cc',
        streamColor: '#002244',
        streamEmissive: '#0099ff',
        ambient: '#0099ff',
      };
  }
}

interface UnholyAuraProps {
  totemBoltVariant?: TotemBoltVariant;
}

export default function UnholyAura({ totemBoltVariant }: UnholyAuraProps) {
  const auraRef = useRef<Group>(null);
  const rotationSpeed = 0.12;

  const pal = useMemo(() => auraPalette(totemBoltVariant), [totemBoltVariant]);

  useFrame(() => {
    if (auraRef.current) {
      auraRef.current.position.set(0, -0.925, 0);
      auraRef.current.rotation.y += rotationSpeed * 0.008;
    }
  });

  return (
    <group ref={auraRef} scale={0.7}>
      {/* Outer corrupted circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[1.0, 1.2, 64]} />
        <meshStandardMaterial
          color={pal.outer}
          emissive={pal.outer}
          emissiveIntensity={1.5}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </mesh>

      {/* Spinning rune marks */}
      <group position={[0, 0.02, 0]}>
        {[...Array(8)].map((_, i) => (
          <mesh
            key={i}
            rotation={[-Math.PI / 2, 0, (i / 8) * Math.PI * 2 + Date.now() * 0.001]}
            position={[0, 0, 0]}
          >
            <planeGeometry args={[0.2, 1.3]} />
            <meshStandardMaterial
              color={pal.plane}
              emissive={pal.plane}
              emissiveIntensity={2}
              transparent
              opacity={0.4 + Math.sin(Date.now() * 0.003 + i) * 0.2}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Inner pulsing sigils */}
      <group position={[0, 0.03, 0]}>
        {[...Array(5)].map((_, i) => {
          const angle = (i / 5) * Math.PI * 2;
          const radius = 0.6;
          return (
            <mesh
              key={i}
              position={[
                Math.cos(angle + Date.now() * 0.001) * radius,
                0,
                Math.sin(angle + Date.now() * 0.001) * radius
              ]}
              rotation={[-Math.PI / 2, 0, angle + Math.PI / 2]}
            >
              <planeGeometry args={[0.3, 0.3]} />
              <meshStandardMaterial
                color={pal.innerColor}
                emissive={pal.outer}
                emissiveIntensity={2}
                transparent
                opacity={0.3 + Math.sin(Date.now() * 0.002 + i * 0.5) * 0.2}
                depthWrite={false}
              />
            </mesh>
          );
        })}
      </group>

      {/* Corrupted energy streams */}
      <group position={[0, 0.01, 0]}>
        {[...Array(12)].map((_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          const radius = 0.9 + Math.sin(Date.now() * 0.002 + i) * 0.1;
          return (
            <mesh
              key={i}
              position={[
                Math.cos(angle) * radius,
                0,
                Math.sin(angle) * radius
              ]}
              rotation={[-Math.PI / 2, 0, angle + Date.now() * 0.0015]}
            >
              <planeGeometry args={[0.1, 0.4]} />
              <meshStandardMaterial
                color={pal.streamColor}
                emissive={pal.streamEmissive}
                emissiveIntensity={3}
                transparent
                opacity={0.2 + Math.sin(Date.now() * 0.004 + i) * 0.1}
                depthWrite={false}
              />
            </mesh>
          );
        })}
      </group>

      {/* Center dark core */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.5, 32]} />
        <meshStandardMaterial
          color="#001122"
          emissive={pal.outer}
          emissiveIntensity={1.5}
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </mesh>

      {/* Ambient glow */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.0, 1.1, 64, 1]} />
        <meshStandardMaterial
          color={pal.ambient}
          emissive={pal.ambient}
          emissiveIntensity={0.3}
          transparent
          opacity={0.6}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
