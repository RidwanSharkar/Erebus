import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, Mesh, DoubleSide, AdditiveBlending } from '@/utils/three-exports';
import ChargedArrowTrail from './ChargedArrowTrail';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

const _lookAtTarget = new Vector3();
const _dirNorm = new Vector3();

interface ChargedArrowProps {
  position: Vector3;
  direction: Vector3;
  onImpact?: (position: Vector3) => void;
}

export default function ChargedArrow({ position, direction, onImpact }: ChargedArrowProps) {
  
  const arrowRef = useRef<Group>(null);
  const color = "#ffaa00";
  const size = 0.15;
  
  // Arrow geometry refs for trail
  const arrowHeadRef = useRef<Mesh>(null);
  const arrowShaftRef = useRef<Mesh>(null);

  // One pooled light follows the arrow (replaces the head + main <pointLight>s).
  const arrowLight = useDynamicLight({ color, distance: 8, priority: 2 });

  useFrame((_, delta) => {
    if (!arrowRef.current) return;

    // Use the position directly from the ECS system (passed via props)
    // The ChargedArrowManager updates this position from the Transform component
    arrowRef.current.position.copy(position);

    // Drive the pooled light at the arrow's world position.
    arrowLight.current?.setPosition(position.x, position.y, position.z);
    arrowLight.current?.setIntensity(12);
    
    // Orient arrow to face movement direction
    _lookAtTarget.copy(position).add(_dirNorm.copy(direction).normalize());
    arrowRef.current.lookAt(_lookAtTarget);
    
    // Trail components will track the arrow head world position automatically
    // No need to manually set positions since they're positioned relative to the arrow group
  });

  return (
    <group name="charged-arrow-group">
      <group ref={arrowRef} position={position}>
        {/* Arrow Head */}
        <mesh ref={arrowHeadRef} position={[0, 0, 0.2]}>
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
        </mesh>

        {/* Arrow Shaft */}
        <mesh ref={arrowShaftRef}>
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
        
      </group>
      
      {/* Trail Effect */}
      <ChargedArrowTrail
        color={color}
        size={size}
        arrowHeadRef={arrowHeadRef}
        arrowShaftRef={arrowShaftRef}
        opacity={1}
      />
    </group>
  );
}
