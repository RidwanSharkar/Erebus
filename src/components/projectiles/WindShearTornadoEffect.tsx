import React, { useRef, useEffect } from 'react';
import { Vector3, Group, AdditiveBlending, DoubleSide, Color } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

interface WindShearTornadoEffectProps {
  getPlayerPosition: () => Vector3;
  startTime: number;
  duration: number;
  onComplete: () => void;
}

export default function WindShearTornadoEffect({
  getPlayerPosition,
  startTime,
  duration,
  onComplete
}: WindShearTornadoEffectProps) {
  const groupRef = useRef<Group>(null);
  const hasCompleted = useRef(false);

  useFrame(() => {
    if (!groupRef.current || hasCompleted.current) return;

    const now = Date.now();
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);

    if (progress >= 1) {
      if (!hasCompleted.current) {
        hasCompleted.current = true;
        onComplete();
      }
      return;
    }

    // Get current player position dynamically
    const playerPosition = getPlayerPosition();

    // Rotate the entire tornado effect
    const rotationSpeed = 0.02; // Rotation speed
    groupRef.current.rotation.y += rotationSpeed;

    // Scale effect based on progress (grows slightly then fades)
    const scale = 0.8 + (progress * 0.4); // Grows from 0.8 to 1.2
    groupRef.current.scale.setScalar(scale);

    // Position the effect at the exact player position (follow player)
    groupRef.current.position.copy(playerPosition);
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Main tornado cone - grey with some transparency - ROTATED RIGHT SIDE UP */}
      <mesh rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.8, 2.5, 8, 1, true]} />
        <meshStandardMaterial
          color="#666666" // Grey color
          emissive="#444444"
          emissiveIntensity={0.3}
          transparent
          opacity={0.6}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* FAST SPINNING OUTER RINGS - Multiple layers rotating at different speeds */}
      {[...Array(3)].map((_, ringIndex) => (
        <mesh
          key={`fast-ring-${ringIndex}`}
          rotation={[Math.PI / 2, 0, (Date.now() * 0.005) + (ringIndex * Math.PI / 3)]}
        >
          <torusGeometry args={[1.2 + (ringIndex * 0.3), 0.08, 12, 24]} />
          <meshStandardMaterial
            color="#888888"
            emissive="#666666"
            emissiveIntensity={0.4}
            transparent
            opacity={0.7 - (ringIndex * 0.1)}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}

      {/* FAST SPINNING PARTICLES AROUND THE TORNADO */}
      {[...Array(16)].map((_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const fastAngle = angle + (Date.now() * 0.01); // Much faster rotation
        const radius = 1.0 + (Math.sin(Date.now() * 0.008 + i) * 0.2); // Pulsing radius
        const height = (Math.sin(Date.now() * 0.006 + i * 0.5) * 0.8); // Oscillating height

        return (
          <mesh
            key={`fast-particle-${i}`}
            position={[
              Math.sin(fastAngle) * radius,
              height,
              Math.cos(fastAngle) * radius
            ]}
          >
            <sphereGeometry args={[0.05, 6, 6]} />
            <meshStandardMaterial
              color="#AAAAAA"
              emissive="#888888"
              emissiveIntensity={0.8}
              transparent
              opacity={0.9}
              blending={AdditiveBlending}
            />
          </mesh>
        );
      })}

      {/* Inner swirling particles - positioned relative to tornado center */}
      {[...Array(12)].map((_, i) => {
        const angle = (i / 12) * Math.PI * 2 + (Date.now() * 0.003); // Slow rotation
        const height = (i / 12) * 2.0; // Distribute along height
        const radius = 0.3 + (Math.sin(height * Math.PI) * 0.3); // Vary radius

        return (
          <mesh
            key={i}
            position={[
              Math.sin(angle) * radius,
              height - 1.0, // Center vertically around tornado
              Math.cos(angle) * radius
            ]}
          >
            <sphereGeometry args={[0.08, 6, 6]} />
            <meshStandardMaterial
              color="#888888"
              emissive="#666666"
              emissiveIntensity={0.5}
              transparent
              opacity={0.8}
              blending={AdditiveBlending}
            />
          </mesh>
        );
      })}

      {/* Outer swirling rings - now with rotation */}
      {[0.3, 0.6, 0.9, 1.2, 1.5].map((height, i) => (
        <mesh
          key={`ring-${i}`}
          position={[0, height - 1.0, 0]}
          rotation={[Math.PI / 2, 0, (Date.now() * 0.004) + (i * Math.PI / 5)]}
        >
          <torusGeometry args={[0.4 + (height * 0.1), 0.05, 8, 16]} />
          <meshStandardMaterial
            color="#777777"
            emissive="#555555"
            emissiveIntensity={0.3}
            transparent
            opacity={0.4 - (i * 0.05)} // Fade outer rings
            blending={AdditiveBlending}
          />
        </mesh>
      ))}

      {/* Top swirling particles */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2 + (Date.now() * 0.003);
        const radius = 0.2;

        return (
          <mesh
            key={`top-${i}`}
            position={[
              Math.sin(angle) * radius,
              1.0, // Top of tornado
              Math.cos(angle) * radius
            ]}
          >
            <sphereGeometry args={[0.06, 4, 4]} />
            <meshStandardMaterial
              color="#AAAAAA"
              emissive="#888888"
              emissiveIntensity={0.6}
              transparent
              opacity={0.7}
              blending={AdditiveBlending}
            />
          </mesh>
        );
      })}
    </group>
  );
}
