'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Color, Group, Mesh, MeshBasicMaterial, AdditiveBlending, MathUtils } from '@/utils/three-exports';
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

    const time = state.clock.elapsedTime;

    // Gentle floating motion
    groupRef.current.position.y = position.y + Math.sin(time * 2) * 0.05;

    // Gentle rotation for crystal-like appearance
    groupRef.current.rotation.y += state.clock.getDelta() * 0.5;

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
      {/* Main Body - Crystal-like Octahedron */}
      <mesh
        position={[0, unitHeight * 0.725, 0]}
        castShadow
        receiveShadow
      >
        <octahedronGeometry args={[unitBaseRadius * 1.25, 0]} />
        <meshStandardMaterial
          color={damageColor}
          metalness={0.7}
          roughness={0.3}
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* Head - Crystal-like Octahedron */}
      <mesh
        position={[0, unitHeight * 1, 0]}
        castShadow
      >
        <octahedronGeometry args={[unitBaseRadius * 0.6, 0]} />
        <meshStandardMaterial
          color={damageColor.clone().multiplyScalar(1.2)}
          metalness={0.8}
          roughness={0.2}
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* Shoulders - Crystal spheres */}
      {[-1, 1].map((side) => (
        <mesh
          key={`shoulder-${side}`}
          position={[side * unitBaseRadius * 1.2, unitHeight * 0.9, 0]}
          castShadow
        >
          <sphereGeometry args={[unitBaseRadius * 0.4, 8, 8]} />
          <meshStandardMaterial
            color={damageColor.clone().multiplyScalar(1.1)}
            metalness={0.7}
            roughness={0.3}
            transparent
            opacity={opacity}
          />
        </mesh>
      ))}

      {/* Shoulder Rings - Energy rings */}
      {[-1, 1].map((side) => (
        <mesh
          key={`shoulder-ring-${side}`}
          position={[side * unitBaseRadius * 1.2, unitHeight * 0.9, 0]}
          rotation={[Math.PI / 2, side * Math.PI / 4, 0]}
        >
          <torusGeometry args={[unitBaseRadius * 0.5, unitBaseRadius * 0.03, 6, 12]} />
          <meshStandardMaterial
            color={damageColor.clone().multiplyScalar(1.3)}
            metalness={0.8}
            roughness={0.2}
            transparent
            opacity={opacity}
          />
        </mesh>
      ))}

      {/* Energy Arms - Crystal cylinders */}
      {[-1, 1].map((side) => (
        <mesh
          key={`arm-${side}`}
          position={[side * unitBaseRadius * 1.4, unitHeight * 0.7, side * unitBaseRadius * 0.1]}
          rotation={[0, 0, side * 0.3]}
          castShadow
        >
          <cylinderGeometry args={[unitBaseRadius * 0.25, unitBaseRadius * 0.15, unitHeight * 0.3, 6]} />
          <meshStandardMaterial
            color={damageColor.clone().multiplyScalar(0.9)}
            metalness={0.6}
            roughness={0.4}
            transparent
            opacity={opacity}
          />
        </mesh>
      ))}


      {/* Energy Tendrils - Orbiting crystal spikes */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const radius = unitBaseRadius * 1.35;
        const height = unitHeight * 1.1;
        return (
          <mesh
            key={`tendril-${i}`}
            position={[
              Math.cos(angle) * radius,
              height + Math.sin(angle) * radius * 0.3,
              Math.sin(angle) * radius
            ]}
            rotation={[Math.PI / 2, angle + Math.PI, -Math.PI / 2]}
          >
            <coneGeometry args={[unitBaseRadius * 0.08, unitBaseRadius * 0.3, 4]} />
            <meshStandardMaterial
              color={damageColor.clone().multiplyScalar(1.2)}
              metalness={0.9}
              roughness={0.1}
              transparent
              opacity={opacity}
            />
          </mesh>
        );
      })}

      {/* Energy Aura - Crystal glow effect */}
      <mesh position={[0, unitHeight * 0.75, 0]}>
        <sphereGeometry args={[unitBaseRadius * 1.75, 8, 8]} />
        <meshBasicMaterial
          color={damageColor}
          transparent
          opacity={opacity * 0.3}
          depthWrite={false}
          blending={AdditiveBlending}
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

      {/* Crystal Target Indicator - Enhanced glow */}
      <mesh position={[0, unitHeight * 0.35, 0]} rotation={[-1.5, 0, 1]}>
        <torusGeometry args={[unitBaseRadius * 1.2, unitBaseRadius * 0.05, 8, 16]} />
        <meshBasicMaterial
          color={unitColor}
          transparent
          opacity={opacity * 0.4}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
