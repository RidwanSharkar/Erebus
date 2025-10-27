import React, { useRef, useMemo } from 'react';
import { Vector3, Group, AdditiveBlending, DoubleSide, Mesh } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

interface LightningSpark {
  id: number;
  position: [number, number, number];
  segments: Array<[number, number, number]>;
}

// Whirlwind Radial Wave Effect Component
export function WhirlwindRadialWaveEffect({
  getPlayerPosition,
  startTime,
  duration,
  onComplete
}: {
  getPlayerPosition: () => Vector3;
  startTime: number;
  duration: number;
  onComplete: () => void;
}) {
  const groupRef = useRef<Group>(null);
  const hasCompleted = useRef(false);

  // Generate lightning sparks
  const lightningSparks: LightningSpark[] = useMemo(() => {
    const sparks: LightningSpark[] = [];
    for (let i = 0; i < 12; i++) {
      // Random positions within expanding radius
      const angle = (i / 12) * Math.PI * 2;
      const distance = 0.3 + Math.random() * 0.5; // Random distance from center
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const y = (Math.random() - 0.5) * 0.3; // Slight vertical variation

      sparks.push({
        id: i,
        position: [x, y, z] as [number, number, number],
        // Create jagged lightning segments
        segments: Array(3 + Math.floor(Math.random() * 3)).fill(0).map((_, segIdx) => {
          const segAngle = angle + (Math.random() - 0.5) * 0.5;
          const segDistance = distance + (Math.random() - 0.5) * 0.2;
          const segX = Math.cos(segAngle) * segDistance;
          const segZ = Math.sin(segAngle) * segDistance;
          const segY = y + (Math.random() - 0.5) * 0.1;
          return [segX, segY, segZ] as [number, number, number];
        })
      });
    }
    return sparks;
  }, []);

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

    const playerPosition = getPlayerPosition();
    groupRef.current.position.copy(playerPosition);

    // Create expanding wave effect - faster and more explosive
    const waveScale = progress * 10; // Expand to 6 units radius (faster expansion)
    groupRef.current.scale.setScalar(waveScale);

    // Add opacity fading - fade out as it expands
    const opacity = Math.max(0, 1 - progress * 2); // Fade out faster than expansion
    groupRef.current.traverse((child) => {
      if (child instanceof Mesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => {
            if (mat.opacity !== undefined) {
              mat.opacity = opacity;
            }
          });
        } else if (child.material.opacity !== undefined) {
          child.material.opacity = opacity;
        }
      }
    });
  });

  return (
    <group ref={groupRef}>
      {/* Main radial wave ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.155, 0]}>
        <ringGeometry args={[0.8, 1, 32]} />
        <meshStandardMaterial
          color="#FFFF00"
          emissive="#FFFF00"
          emissiveIntensity={1}
          transparent
          opacity={0.8}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Secondary inner wave */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
        <ringGeometry args={[0.4, 0.6, 24]} />
        <meshStandardMaterial
          color="#FFFF00"
          emissive="#FFFF00"
          emissiveIntensity={1}
          transparent
          opacity={0.6}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Violent Yellow Lightning Sparks */}
      {lightningSparks.map((spark: LightningSpark) => (
        <group key={spark.id}>
          {/* Main spark segments */}
          {spark.segments.map((segment: [number, number, number], segIdx) => (
            <mesh
              key={`spark-${spark.id}-seg-${segIdx}`}
              position={segment}
            >
              <sphereGeometry args={[0.02 + Math.random() * 0.02, 4, 4]} />
              <meshStandardMaterial
                color="#FFFF00" // Pure yellow
                emissive="#FFD700" // Golden yellow
                emissiveIntensity={0.5 + Math.random() * 2}
                transparent
                opacity={1}
                blending={AdditiveBlending}
              />
            </mesh>
          ))}

          {/* Crackling mini sparks around main spark */}
          {[...Array(3)].map((_, miniIdx) => {
            const miniAngle = (miniIdx / 3) * Math.PI * 2 + Math.random() * Math.PI;
            const miniDistance = 0.08 + Math.random() * 0.05;
            const miniX = spark.position[0] + Math.cos(miniAngle) * miniDistance;
            const miniZ = spark.position[2] + Math.sin(miniAngle) * miniDistance;
            const miniY = spark.position[1] + (Math.random() - 0.5) * 0.05;

            return (
              <mesh
                key={`mini-spark-${spark.id}-${miniIdx}`}
                position={[miniX, miniY, miniZ]}
              >
                <sphereGeometry args={[0.015 + Math.random() * 0.01, 3, 3]} />
                <meshStandardMaterial
                  color="#FFFF88" // Bright yellow-white
                  emissive="#FFD700" // Golden yellow
                  emissiveIntensity={0.5 + Math.random() * 1.5}
                  transparent
                  opacity={0.9}
                  blending={AdditiveBlending}
                />
              </mesh>
            );
          })}
        </group>
      ))}

      {/* Additional random crackling sparks */}
      {[...Array(8)].map((_, i) => {
        const randomAngle = Math.random() * Math.PI * 2;
        const randomDistance = 0.2 + Math.random() * 0.8;
        const crackleX = Math.cos(randomAngle) * randomDistance;
        const crackleZ = Math.sin(randomAngle) * randomDistance;
        const crackleY = (Math.random() - 0.5) * 0.4;

        return (
          <mesh
            key={`crackle-${i}`}
            position={[crackleX, crackleY, crackleZ]}
          >
            <sphereGeometry args={[0.02 + Math.random() * 0.015, 3, 3]} />
            <meshStandardMaterial
              color="#FFFF00" // Pure yellow
              emissive="#FFD700" // Golden yellow
              emissiveIntensity={0.5 + Math.random() * 1.5}
              transparent
              opacity={0.8}
              blending={AdditiveBlending}
            />
          </mesh>
        );
      })}
    </group>
  );
}

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

  // Initialize position on first render
  const initialPosition = getPlayerPosition();

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
    const rotationSpeed =2; // Rotation speed
    groupRef.current.rotation.y += rotationSpeed;

    // Scale effect based on progress (grows slightly then fades)
    const scale = 0.425 + (progress * 0.3); // Grows from 0.8 to 1.2
    groupRef.current.scale.setScalar(scale);

    // Position the effect at the exact player position (follow player)
    groupRef.current.position.copy(playerPosition);
  });

  return (
    <group ref={groupRef} position={[initialPosition.x, initialPosition.y, initialPosition.z]}>
      {/* Main tornado cone - grey with some transparency - ROTATED RIGHT SIDE UP */}
      <mesh rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[1.25, 3.75, 8, 1, true]} />
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

      {/* FAST SPINNING OUTER RINGS - Multiple layers rotating at different heights */}
      {[...Array(4)].map((_, ringIndex) => {
        // Distribute rings vertically from bottom to top of tornado
        const heightOffset = (ringIndex - 0.5 ) * 0.75; // -0.8, 0, +0.8

        return (
          <mesh
            key={`fast-ring-${ringIndex}`}
            position={[0, heightOffset, 0]}
            rotation={[Math.PI / 2, 0, (Date.now() * 0.005) + (ringIndex * Math.PI / 3)]}
          >
            <torusGeometry args={[0.625 + (ringIndex * 0.25), 0.07, 12, 24]} />
            <meshStandardMaterial
              color="#888888"
              emissive="#666666"
              emissiveIntensity={0.4}
              transparent
              opacity={0.7 - (ringIndex * 0.1)}
              blending={AdditiveBlending}
            />
          </mesh>
        );
      })}

      {/* FAST SPINNING PARTICLES AROUND THE TORNADO */}
      {[...Array(16)].map((_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const fastAngle = angle + (Date.now() * 0.0025); // Much faster rotation
        const radius = 0.75 + (Math.sin(Date.now() * 0.008 + i) * 0.2); // Pulsing radius
        const height = (Math.sin(Date.now() * 0.006 + i * 0.5) * 0.65); // Oscillating height

        return (
          <mesh
            key={`fast-particle-${i}`}
            position={[
              Math.sin(fastAngle) * radius,
              height + 1,
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



      {/* Top swirling particles */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2 + (Date.now() * 0.003);
        const radius = 0.2;

        return (
          <mesh
            key={`top-${i}`}
            position={[
              Math.sin(angle) * radius,
              0.75, // Top of tornado
              Math.cos(angle) * radius
            ]}
          >
            <sphereGeometry args={[0.06, 6, 6]} />
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
