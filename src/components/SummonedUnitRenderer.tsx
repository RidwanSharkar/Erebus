'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Color, Group, Mesh, MeshBasicMaterial } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import { SummonedUnit } from '@/ecs/components/SummonedUnit';

interface SummonedUnitRendererProps {
  entityId: number;
  world: World;
  position: Vector3;
  ownerId: string;
  health: number;
  maxHealth: number;
  isDead?: boolean;
  color?: Color;
}

export default function SummonedUnitRenderer({
  entityId,
  world,
  position,
  ownerId,
  health,
  maxHealth,
  isDead = false,
  color
}: SummonedUnitRendererProps) {
  const groupRef = useRef<Group>(null);
  const healthBarRef = useRef<Mesh>(null);
  const healthBarMaterialRef = useRef<MeshBasicMaterial>(null);

  // Unit dimensions (simple and small to maintain framerate)
  const unitHeight = 1.2;
  const unitBaseRadius = 0.3;

  // Default colors for different players
  const playerColors = useMemo(() => [
    new Color(0x4A90E2), // Blue
    new Color(0xFF6B35), // Orange
    new Color(0x50C878), // Green
    new Color(0x9B59B6), // Purple
    new Color(0xF39C12)  // Yellow
  ], []);

  // Generate a consistent color based on ownerId
  const ownerColor = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < ownerId.length; i++) {
      hash = ((hash << 5) - hash) + ownerId.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    const index = Math.abs(hash) % playerColors.length;
    return playerColors[index];
  }, [ownerId, playerColors]);

  const unitColor = color || ownerColor;

  // Calculate health-based opacity and color
  const healthPercentage = Math.max(0, health / maxHealth);
  const opacity = isDead ? 0.3 : Math.max(0.5, healthPercentage);
  const damageColor = isDead ? new Color(0x666666) : unitColor.clone().lerp(new Color(0xFF0000), 1 - healthPercentage);

  // Handle animations and health bar updates
  useFrame((state) => {
    if (!groupRef.current || isDead) return;

    // Gentle floating motion
    const time = state.clock.elapsedTime;
    groupRef.current.position.y = position.y + Math.sin(time * 2) * 0.05;

    // Update health bar scale and color every frame
    const healthPercentage = Math.max(0, Math.min(1, health / maxHealth));

    // Update health bar fill scale and position
    if (healthBarRef.current) {
      healthBarRef.current.scale.x = healthPercentage;
      healthBarRef.current.position.x = -(1.5 * (1 - healthPercentage)) / 2;
    }

    // Update health bar color based on percentage
    if (healthBarMaterialRef.current) {
      if (healthPercentage > 0.5) {
        healthBarMaterialRef.current.color.setHex(0x00ff00); // Green
      } else if (healthPercentage > 0.25) {
        healthBarMaterialRef.current.color.setHex(0xffff00); // Yellow
      } else {
        healthBarMaterialRef.current.color.setHex(0xff0000); // Red
      }
    }
  });

  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]}>
      {/* Main Body - Simple Cylinder */}
      <mesh
        position={[0, unitHeight * 0.4, 0]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[unitBaseRadius, unitBaseRadius * 1.2, unitHeight * 0.6, 6]} />
        <meshStandardMaterial
          color={damageColor}
          metalness={0.2}
          roughness={0.8}
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* Head - Simple Sphere */}
      <mesh
        position={[0, unitHeight * 0.8, 0]}
        castShadow
      >
        <sphereGeometry args={[unitBaseRadius * 0.8, 8, 6]} />
        <meshStandardMaterial
          color={damageColor.clone().multiplyScalar(1.1)}
          metalness={0.1}
          roughness={0.9}
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* Simple Arms - Two small cylinders */}
      {[-1, 1].map((side) => (
        <mesh
          key={`arm-${side}`}
          position={[side * unitBaseRadius * 1.2, unitHeight * 0.6, 0]}
          rotation={[0, 0, side * 0.3]}
          castShadow
        >
          <cylinderGeometry args={[unitBaseRadius * 0.2, unitBaseRadius * 0.2, unitHeight * 0.4, 4]} />
          <meshStandardMaterial
            color={damageColor.clone().multiplyScalar(0.9)}
            metalness={0.1}
            roughness={0.9}
            transparent
            opacity={opacity}
          />
        </mesh>
      ))}

      {/* Simple Legs - Two small cylinders */}
      {[-1, 1].map((side) => (
        <mesh
          key={`leg-${side}`}
          position={[side * unitBaseRadius * 0.6, unitHeight * 0.1, 0]}
          castShadow
        >
          <cylinderGeometry args={[unitBaseRadius * 0.25, unitBaseRadius * 0.25, unitHeight * 0.2, 4]} />
          <meshStandardMaterial
            color={damageColor.clone().multiplyScalar(0.8)}
            metalness={0.1}
            roughness={1.0}
            transparent
            opacity={opacity}
          />
        </mesh>
      ))}

      {/* Simple Weapon - Small cube */}
      <mesh
        position={[unitBaseRadius * 1.5, unitHeight * 0.6, 0]}
        rotation={[0, 0, 0.2]}
        castShadow
      >
        <boxGeometry args={[unitBaseRadius * 0.3, unitHeight * 0.3, unitBaseRadius * 0.1]} />
        <meshStandardMaterial
          color={new Color(0x333333)}
          metalness={0.8}
          roughness={0.2}
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* Health Bar */}
      {!isDead && (
        <group position={[0, unitHeight + 0.8, 0]}>
          {/* Health Bar Background */}
          <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.5, 0.15]} />
            <meshBasicMaterial color={0x333333} transparent opacity={0.8} />
          </mesh>

          {/* Health Bar Fill */}
          <mesh
            ref={healthBarRef}
            position={[-(1.5 * (1 - healthPercentage)) / 2, 0.01, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[healthPercentage, 1, 1]}
          >
            <planeGeometry args={[1.5, 0.12]} />
            <meshBasicMaterial
              ref={healthBarMaterialRef}
              color={healthPercentage > 0.5 ? 0x00ff00 : healthPercentage > 0.25 ? 0xffff00 : 0xff0000}
              transparent
              opacity={0.9}
            />
          </mesh>
        </group>
      )}

      {/* Death Effect */}
      {isDead && (
        <group>
          {/* Simple death particles */}
          <mesh position={[0, unitHeight * 0.4, 0]}>
            <sphereGeometry args={[1, 6, 4]} />
            <meshBasicMaterial
              color={0x666666}
              transparent
              opacity={0.1}
              wireframe
            />
          </mesh>
        </group>
      )}

      {/* Selection/Target Indicator (subtle glow) */}
      <mesh position={[0, unitHeight * 0.4, 0]}>
        <cylinderGeometry args={[unitBaseRadius * 1.5, unitBaseRadius * 1.5, 0.05, 8]} />
        <meshBasicMaterial
          color={unitColor}
          transparent
          opacity={0.2}
        />
      </mesh>
    </group>
  );
}
