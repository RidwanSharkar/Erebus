'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Color, Group, Mesh, AdditiveBlending, MathUtils } from '@/utils/three-exports';

interface TowerProjectileProps {
  position: Vector3;
  direction: Vector3;
  entityId: number;
  ownerId?: string;
  opacity?: number;
}

export default function TowerProjectile({
  position,
  direction,
  entityId,
  ownerId,
  opacity = 1.0
}: TowerProjectileProps) {
  const groupRef = useRef<Group>(null);
  const timeRef = useRef(0);

  // Determine color based on owner ID
  const projectileColor = useMemo(() => {
    if (!ownerId) {
      return new Color(0x888888); // Gray for unknown owner
    }
    
    // For PVP, use a more predictable color assignment
    // This ensures consistent colors for each player across all their towers
    const playerColors = [
      new Color(0x4A90E2), // Blue (Player 1)
      new Color(0xFF4444), // Red (Player 2)
      new Color(0x50C878), // Green (Player 3)
      new Color(0x9B59B6), // Purple (Player 4)
      new Color(0xF39C12)  // Orange (Player 5)
    ];
    
    // Simple hash to get consistent color index for each player
    const hash = ownerId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const colorIndex = Math.abs(hash) % playerColors.length;
    return playerColors[colorIndex];
  }, [ownerId]);

  const emissiveColor = useMemo(() => 
    projectileColor.clone().multiplyScalar(0.6), [projectileColor]);

  useFrame((_, delta) => {
    timeRef.current += delta;

    if (groupRef.current) {
      // Update position
      groupRef.current.position.copy(position);

      // Calculate rotation to face movement direction
      if (direction.length() > 0) {
        const normalizedDirection = direction.clone().normalize();
        const angle = Math.atan2(normalizedDirection.x, normalizedDirection.z);
        groupRef.current.rotation.y = angle;
        
        // Tilt slightly based on vertical movement
        groupRef.current.rotation.x = -normalizedDirection.y * 0.5;
      }

      // Spinning animation for the energy core
      const coreSpinner = groupRef.current.getObjectByName('CoreSpinner') as Group;
      if (coreSpinner) {
        coreSpinner.rotation.z += delta * 8;
        coreSpinner.rotation.x += delta * 4;
      }

      // Pulsing glow effect
      const glowSphere = groupRef.current.getObjectByName('GlowSphere') as Mesh;
      if (glowSphere && glowSphere.material) {
        const material = glowSphere.material as any;
        material.emissiveIntensity = 0.3 + Math.sin(timeRef.current * 6) * 0.2;
      }

      // Trailing particles rotation
      const trailParticles = groupRef.current.getObjectByName('TrailParticles') as Group;
      if (trailParticles) {
        trailParticles.rotation.y += delta * 3;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Main projectile body - crystalline energy shard */}
      <mesh>
        <octahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial
          color={projectileColor}
          emissive={emissiveColor}
          emissiveIntensity={0.8}
          transparent
          opacity={opacity}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* Energy core - spinning inner crystal */}
      <group name="CoreSpinner">
        <mesh>
          <octahedronGeometry args={[0.12, 0]} />
          <meshStandardMaterial
            color={projectileColor.clone().multiplyScalar(1.5)}
            emissive={projectileColor.clone().multiplyScalar(0.8)}
            emissiveIntensity={1.2}
            transparent
            opacity={opacity * 0.9}
            metalness={1.0}
            roughness={0.0}
          />
        </mesh>
      </group>

      {/* Outer glow sphere */}
      <mesh name="GlowSphere">
        <sphereGeometry args={[0.35, 12, 12]} />
        <meshStandardMaterial
          color={projectileColor}
          emissive={emissiveColor}
          emissiveIntensity={0.3}
          transparent
          opacity={opacity * 0.2}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Energy tendrils - 4 small spikes around the projectile */}
      {[...Array(4)].map((_, i) => {
        const angle = (i / 4) * Math.PI * 2;
        const radius = 0.25;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        return (
          <mesh
            key={`tendril-${i}`}
            position={[x, 0, z]}
            rotation={[0, angle, 0]}
          >
            <coneGeometry args={[0.03, 0.15, 4]} />
            <meshStandardMaterial
              color={projectileColor.clone().multiplyScalar(1.3)}
              emissive={emissiveColor}
              emissiveIntensity={0.6}
              transparent
              opacity={opacity * 0.8}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
        );
      })}

      {/* Trailing particles */}
      <group name="TrailParticles">
        {[...Array(6)].map((_, i) => {
          const angle = (i / 6) * Math.PI * 2;
          const radius = 0.15;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const y = -0.1 - (i * 0.05); // Trail behind

          return (
            <mesh
              key={`particle-${i}`}
              position={[x, y, z]}
            >
              <sphereGeometry args={[0.02, 6, 6]} />
              <meshStandardMaterial
                color={projectileColor}
                emissive={emissiveColor}
                emissiveIntensity={0.8}
                transparent
                opacity={opacity * (1 - i * 0.15)} // Fade out towards the back
                depthWrite={false}
                blending={AdditiveBlending}
              />
            </mesh>
          );
        })}
      </group>

      {/* Point light for dynamic lighting */}
      <pointLight
        color={projectileColor}
        intensity={0.5}
        distance={2}
        decay={2}
      />
    </group>
  );
}
