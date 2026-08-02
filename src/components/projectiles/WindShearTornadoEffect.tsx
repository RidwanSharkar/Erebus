import React, { useRef, useMemo } from 'react';
import { Vector3, Group, AdditiveBlending, DoubleSide, Mesh } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

interface LightningSpark {
  id: number;
  position: [number, number, number];
  segments: Array<{
    position: [number, number, number];
    radius: number;
    emissiveIntensity: number;
  }>;
  miniSparks: Array<{
    position: [number, number, number];
    radius: number;
    emissiveIntensity: number;
  }>;
}

interface CrackleSpark {
  position: [number, number, number];
  radius: number;
  emissiveIntensity: number;
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
      const angle = (i / 12) * Math.PI * 2;
      const distance = 0.3 + Math.random() * 0.5;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const y = (Math.random() - 0.5) * 0.3;

      const segments = Array(3 + Math.floor(Math.random() * 3))
        .fill(0)
        .map(() => {
          const segAngle = angle + (Math.random() - 0.5) * 0.5;
          const segDistance = distance + (Math.random() - 0.5) * 0.2;
          const segX = Math.cos(segAngle) * segDistance;
          const segZ = Math.sin(segAngle) * segDistance;
          const segY = y + (Math.random() - 0.5) * 0.1;
          return {
            position: [segX, segY, segZ] as [number, number, number],
            radius: 0.02 + Math.random() * 0.02,
            emissiveIntensity: 0.5 + Math.random() * 2,
          };
        });

      const miniSparks = Array.from({ length: 3 }, (_, miniIdx) => {
        const miniAngle = (miniIdx / 3) * Math.PI * 2 + Math.random() * Math.PI;
        const miniDistance = 0.08 + Math.random() * 0.05;
        const miniX = x + Math.cos(miniAngle) * miniDistance;
        const miniZ = z + Math.sin(miniAngle) * miniDistance;
        const miniY = y + (Math.random() - 0.5) * 0.05;
        return {
          position: [miniX, miniY, miniZ] as [number, number, number],
          radius: 0.015 + Math.random() * 0.01,
          emissiveIntensity: 0.5 + Math.random() * 1.5,
        };
      });

      sparks.push({
        id: i,
        position: [x, y, z] as [number, number, number],
        segments,
        miniSparks,
      });
    }
    return sparks;
  }, []);

  const crackleSparks: CrackleSpark[] = useMemo(
    () =>
      Array.from({ length: 8 }, () => {
        const randomAngle = Math.random() * Math.PI * 2;
        const randomDistance = 0.2 + Math.random() * 0.8;
        return {
          position: [
            Math.cos(randomAngle) * randomDistance,
            (Math.random() - 0.5) * 0.4,
            Math.sin(randomAngle) * randomDistance,
          ] as [number, number, number],
          radius: 0.02 + Math.random() * 0.015,
          emissiveIntensity: 0.5 + Math.random() * 1.5,
        };
      }),
    [],
  );

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
    const waveScale = progress * 5; // Expand to ~3 units radius (smaller than prior yellow wave)
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
        <ringGeometry args={[0.5, 0.65, 32]} />
        <meshStandardMaterial
          color="#ff3333"
          emissive="#ff3333"
          emissiveIntensity={1}
          transparent
          opacity={0.8}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Secondary inner wave */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
        <ringGeometry args={[0.25, 0.4, 24]} />
        <meshStandardMaterial
          color="#ff6600"
          emissive="#ff6600"
          emissiveIntensity={1}
          transparent
          opacity={0.6}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Violent Red Lightning Sparks */}
      {lightningSparks.map((spark: LightningSpark) => (
        <group key={spark.id}>
          {spark.segments.map((segment, segIdx) => (
            <mesh key={`spark-${spark.id}-seg-${segIdx}`} position={segment.position}>
              <sphereGeometry args={[segment.radius, 4, 4]} />
              <meshStandardMaterial
                color="#ff3333"
                emissive="#ff6600"
                emissiveIntensity={segment.emissiveIntensity}
                transparent
                opacity={1}
                blending={AdditiveBlending}
              />
            </mesh>
          ))}

          {spark.miniSparks.map((mini, miniIdx) => (
            <mesh key={`mini-spark-${spark.id}-${miniIdx}`} position={mini.position}>
              <sphereGeometry args={[mini.radius, 3, 3]} />
              <meshStandardMaterial
                color="#ff8844"
                emissive="#ff6600"
                emissiveIntensity={mini.emissiveIntensity}
                transparent
                opacity={0.9}
                blending={AdditiveBlending}
              />
            </mesh>
          ))}
        </group>
      ))}

      {crackleSparks.map((crackle, i) => (
        <mesh key={`crackle-${i}`} position={crackle.position}>
          <sphereGeometry args={[crackle.radius, 3, 3]} />
          <meshStandardMaterial
            color="#ff3333"
            emissive="#ff6600"
            emissiveIntensity={crackle.emissiveIntensity}
            transparent
            opacity={0.8}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}
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
