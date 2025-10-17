import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, DoubleSide, AdditiveBlending } from '@/utils/three-exports';

interface RejuvenatingShotProps {
  position: Vector3;
  direction: Vector3;
  onImpact?: (position: Vector3) => void;
  distanceTraveled?: number;
  maxDistance?: number;
  projectileType?: string;
}

export default function RejuvenatingShot({ position, direction, onImpact, distanceTraveled = 0, maxDistance = 25, projectileType }: RejuvenatingShotProps) {

  const arrowRef = useRef<Group>(null);
  const [time, setTime] = useState(0);

  // Enhanced healing-themed colors - brighter and more vibrant
  const color = "#00ffaa"; // Brighter healing green
  const emissiveColor = "#00ff77"; // Brighter green for emissive
  const shaftEmissiveColor = "#00ff99"; // Brighter green for shaft
  const fletchingColor = "#99ffcc"; // Lighter green for fletching
  const fletchingEmissiveColor = "#55ffaa"; // Brighter green for fletching emissive
  const auraColor = "#00ffaa"; // Healing green for aura
  const coreColor = "#ffffff"; // White core for extra brilliance

  const size = 0.18; // Slightly larger for more presence

  // Calculate fade based on distance traveled
  const fadeStartDistance = maxDistance * 0.7; // Start fading at 70% of max distance
  const fadeProgress = Math.max(0, Math.min(1, (distanceTraveled - fadeStartDistance) / (maxDistance - fadeStartDistance)));
  const opacity = Math.max(0.1, 1 - fadeProgress); // Minimum opacity of 0.1

  useFrame((_, delta) => {
    if (!arrowRef.current) return;

    // Update animation time
    setTime(prev => prev + delta);

    // Use the position directly from the ECS system (passed via props)
    // The RejuvenatingShotManager updates this position from the Transform component
    arrowRef.current.position.copy(position);

    // Orient arrow to face movement direction
    const lookAtTarget = position.clone().add(direction.clone().normalize());
    arrowRef.current.lookAt(lookAtTarget);
  });

  return (
    <group name="rejuvenating-shot-group">
      <group ref={arrowRef} position={position}>
        {/* Bright white core for the arrow head */}
        <mesh position={[0, 0, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.05, 0.18, 8]} />
          <meshStandardMaterial
            color={coreColor}
            emissive={coreColor}
            emissiveIntensity={6 * opacity}
            transparent
            opacity={0.95 * opacity}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>

        {/* Arrow Head - Healing crystal shape (outer glow) */}
        <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.1, 0.28, 8]} />
          <meshStandardMaterial
            color={color}
            emissive={emissiveColor}
            emissiveIntensity={5 * opacity}
            transparent
            opacity={0.85 * opacity}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>

        {/* Arrow Shaft - Bright healing energy core */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.035, 0.45, 8]} />
          <meshStandardMaterial
            color={color}
            emissive={shaftEmissiveColor}
            emissiveIntensity={4 * opacity}
            transparent
            opacity={0.9 * opacity}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>

        {/* Arrow Fletching - Animated healing leaves/energy wings */}
        <group position={[0, 0, -0.15]} rotation={[0, 0, time * 2]}>
          {[0, 120, 240].map((angle, index) => (
            <mesh
              key={index}
              position={[
                Math.cos((angle * Math.PI) / 180) * 0.05,
                Math.sin((angle * Math.PI) / 180) * 0.05,
                0
              ]}
              rotation={[0, 0, (angle * Math.PI) / 180]}
            >
              <planeGeometry args={[0.1, 0.15]} />
              <meshStandardMaterial
                color={fletchingColor}
                emissive={fletchingEmissiveColor}
                emissiveIntensity={3 * opacity}
                transparent
                opacity={0.75 * opacity}
                side={DoubleSide}
                depthWrite={false}
                blending={AdditiveBlending}
              />
            </mesh>
          ))}
        </group>

        {/* Inner bright aura */}
        <mesh>
          <sphereGeometry args={[size * 1.2, 16, 16]} />
          <meshStandardMaterial
            color={coreColor}
            emissive={coreColor}
            emissiveIntensity={3 * opacity}
            transparent
            opacity={0.5 * opacity}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>

        {/* Outer healing aura - brighter and larger */}
        <mesh>
          <sphereGeometry args={[size * 2.2, 16, 16]} />
          <meshStandardMaterial
            color={auraColor}
            emissive={color}
            emissiveIntensity={2.5 * opacity}
            transparent
            opacity={0.35 * opacity}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>

        {/* Spiraling healing particles */}
        {[...Array(6)].map((_, i) => {
          const spiralAngle = time * 3 + i * (Math.PI * 2 / 6);
          const spiralRadius = size * 1.8;
          return (
            <mesh
              key={`healing-particle-${i}`}
              position={[
                Math.cos(spiralAngle) * spiralRadius,
                Math.sin(spiralAngle * 1.5) * size * 0.7,
                Math.sin(spiralAngle) * spiralRadius
              ]}
            >
              <sphereGeometry args={[size * 0.35, 8, 8]} />
              <meshStandardMaterial
                color={coreColor}
                emissive="#99ffcc"
                emissiveIntensity={4 * opacity}
                transparent
                opacity={0.75 * opacity}
                depthWrite={false}
                blending={AdditiveBlending}
                toneMapped={false}
              />
            </mesh>
          );
        })}

        {/* Trailing particles */}
        {[...Array(4)].map((_, i) => (
          <mesh
            key={`trail-particle-${i}`}
            position={[0, 0, -0.3 - i * 0.15]}
            scale={[(1 - i * 0.2), (1 - i * 0.2), (1 - i * 0.2)]}
          >
            <sphereGeometry args={[size * 0.6, 8, 8]} />
            <meshStandardMaterial
              color={auraColor}
              emissive={emissiveColor}
              emissiveIntensity={2.5 * opacity * (1 - i * 0.2)}
              transparent
              opacity={0.5 * opacity * (1 - i * 0.25)}
              depthWrite={false}
              blending={AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        ))}

        {/* Point light for extra glow */}
        <pointLight
          color={color}
          intensity={3 * opacity}
          distance={4}
          decay={2}
        />
      </group>
    </group>
  );
}
