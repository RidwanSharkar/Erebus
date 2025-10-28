import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, DoubleSide, AdditiveBlending } from '@/utils/three-exports';

interface RegularArrowProps {
  position: Vector3;
  direction: Vector3;
  onImpact?: (position: Vector3) => void;
  distanceTraveled?: number;
  maxDistance?: number;
  projectileType?: string; // Add projectile type to support different colors
}

export default function RegularArrow({ position, direction, onImpact, distanceTraveled = 0, maxDistance = 25, projectileType }: RegularArrowProps) {

  const arrowRef = useRef<Group>(null);

  // Determine colors based on projectile type
  const isBurstArrow = projectileType === 'burst_arrow';
  const color = isBurstArrow ? "#ff5500" : "#00ffff"; // Teal for burst arrows, red-orange for regular
  const emissiveColor = isBurstArrow ? "#aa2200" : "#0088aa"; // Darker teal for burst, dark red-orange for regular
  const shaftEmissiveColor = isBurstArrow ? "#ff4400" : "#0099cc"; // Medium teal for burst, red-orange for regular
  const fletchingColor = isBurstArrow ? "#ff7722" : "#66ffff"; // Light teal for burst, light red-orange for regular
  const fletchingEmissiveColor = isBurstArrow ? "#ff5500" : "#00aaff"; // Bright teal for burst, bright red-orange for regular
  const auraColor = isBurstArrow ? "#ff5500" : "#00ffff"; // Teal for burst, red-orange for regular

  const size = 0.15;

  // Calculate fade based on distance traveled
  const fadeStartDistance = maxDistance * 0.7; // Start fading at 70% of max distance
  const fadeProgress = Math.max(0, Math.min(1, (distanceTraveled - fadeStartDistance) / (maxDistance - fadeStartDistance)));
  const opacity = Math.max(0.1, 1 - fadeProgress); // Minimum opacity of 0.1

  useFrame((_, delta) => {
    if (!arrowRef.current) return;

    // Use the position directly from the ECS system (passed via props)
    // The RegularArrowManager updates this position from the Transform component
    arrowRef.current.position.copy(position);
    
    // Orient arrow to face movement direction
    const lookAtTarget = position.clone().add(direction.clone().normalize());
    arrowRef.current.lookAt(lookAtTarget);
  });

  return (
    <group name="regular-arrow-group">
      <group ref={arrowRef} position={position}>
        {/* Arrow Head */}
        <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.08, 0.25, 8]} />
          <meshStandardMaterial
            color={color}
            emissive={emissiveColor}
            emissiveIntensity={3 * opacity}
            transparent
            opacity={0.9 * opacity}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />

        </mesh>
        
        {/* Arrow Shaft */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.03, 0.4, 8]} />
          <meshStandardMaterial
            color={color}
            emissive={shaftEmissiveColor}
            emissiveIntensity={2 * opacity}
            transparent
            opacity={0.8 * opacity}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        
        {/* Arrow Fletching */}
        <group position={[0, 0, -0.15]}>
          {/* Three fletching vanes */}
          {[0, 120, 240].map((angle, index) => (
            <mesh 
              key={index}
              position={[
                Math.cos((angle * Math.PI) / 180) * 0.04,
                Math.sin((angle * Math.PI) / 180) * 0.04,
                0
              ]}
              rotation={[0, 0, (angle * Math.PI) / 180]}
            >
              <planeGeometry args={[0.08, 0.12]} />
              <meshStandardMaterial
                color={fletchingColor}
                emissive={fletchingEmissiveColor}
                emissiveIntensity={1.5 * opacity}
                transparent
                opacity={0.7 * opacity}
                side={DoubleSide}
                depthWrite={false}
                blending={AdditiveBlending}
              />
            </mesh>
          ))}
        </group>
        
        {/* Energy Aura around arrow */}
        <mesh>
          <sphereGeometry args={[size * 1.5, 16, 16]} />
          <meshStandardMaterial
            color={auraColor}
            emissive={color}
            emissiveIntensity={1 * opacity}
            transparent
            opacity={0.3 * opacity}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        
 
      </group>
    </group>
  );
}
