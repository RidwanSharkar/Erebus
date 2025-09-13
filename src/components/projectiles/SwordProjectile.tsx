import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, DoubleSide, AdditiveBlending } from '@/utils/three-exports';

interface SwordProjectileProps {
  position: Vector3;
  direction: Vector3;
  onImpact?: (position: Vector3) => void;
}

export default function SwordProjectile({ position, direction, onImpact }: SwordProjectileProps) {
  console.log('⚔️ SwordProjectile component mounted with position:', position, 'direction:', direction);

  const swordRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!swordRef.current) return;

    // Use the position directly from the ECS system (passed via props)
    swordRef.current.position.copy(position);

    // Orient sword to face movement direction
    const lookAtTarget = position.clone().add(direction.clone().normalize());
    swordRef.current.lookAt(lookAtTarget);
    
    // Add spinning rotation for visual effect
    swordRef.current.rotateZ(delta * 10); // Spin around the Z-axis
  });

  return (
    <group name="sword-projectile-group">
      <group ref={swordRef}>
        {/* Sword Blade */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.08, 1.2, 0.03]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#4444ff"
            emissiveIntensity={3}
            transparent
            opacity={1.0}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>

        {/* Sword Glow Effect */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.12, 1.4, 0.06]} />
          <meshStandardMaterial
            color="#6666ff"
            emissive="#3333ff"
            emissiveIntensity={2}
            transparent
            opacity={0.6}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>

        {/* Sword Handle */}
        <mesh position={[0, -0.8, 0]}>
          <boxGeometry args={[0.05, 0.3, 0.05]} />
          <meshStandardMaterial
            color="#8B4513"
            emissive="#4B2F20"
            emissiveIntensity={1}
            transparent
            opacity={1.0}
            depthWrite={false}
          />
        </mesh>

        {/* Crossguard */}
        <mesh position={[0, -0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.4, 0.03, 0.03]} />
          <meshStandardMaterial
            color="#C0C0C0"
            emissive="#808080"
            emissiveIntensity={1.5}
            transparent
            opacity={1.0}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}
