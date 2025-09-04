import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, DoubleSide, AdditiveBlending } from '@/utils/three-exports';

interface RegularArrowProps {
  position: Vector3;
  direction: Vector3;
  onImpact?: (position: Vector3) => void;
}

export default function RegularArrow({ position, direction, onImpact }: RegularArrowProps) {
  
  const arrowRef = useRef<Group>(null);
  const color = "#ffaa00";
  const size = 0.15;

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
        <mesh position={[0, 0, 0.2]}>
          <coneGeometry args={[0.08, 0.25, 8]} />
          <meshStandardMaterial
            color={color}
            emissive="#ff6600"
            emissiveIntensity={3}
            transparent
            opacity={0.9}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
          <pointLight color={color} intensity={8} distance={6} />
        </mesh>
        
        {/* Arrow Shaft */}
        <mesh>
          <cylinderGeometry args={[0.02, 0.03, 0.4, 8]} />
          <meshStandardMaterial
            color={color}
            emissive="#ff8800"
            emissiveIntensity={2}
            transparent
            opacity={0.8}
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
                color="#ffcc44"
                emissive="#ff9900"
                emissiveIntensity={1.5}
                transparent
                opacity={0.7}
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
            color={color}
            emissive="#ffaa00"
            emissiveIntensity={1}
            transparent
            opacity={0.3}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        
        {/* Main point light */}
        <pointLight color={color} intensity={12} distance={8} decay={2} />
      </group>
    </group>
  );
}
