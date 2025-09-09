'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Color, Group, Mesh, AdditiveBlending, MathUtils } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import { Tower } from '@/ecs/components/Tower';
import ElementalVortex from '../enemies/ElementalVortex';

interface TowerRendererProps {
  entityId: number;
  world: World;
  position: Vector3;
  ownerId: string;
  towerIndex: number;
  health: number;
  maxHealth: number;
  isDead?: boolean;
  color?: Color;
  camera?: any;
}

export default function TowerRenderer({
  entityId,
  world,
  position,
  ownerId,
  towerIndex,
  health,
  maxHealth,
  isDead = false,
  color,
  camera
}: TowerRendererProps) {
  const groupRef = useRef<Group>(null);
  const healthBarRef = useRef<Group>(null);
  const timeRef = useRef(0);
  const isAttackingRef = useRef(false);

  // Default colors for different players
  const playerColors = useMemo(() => [
    new Color(0x4A90E2), // Blue
    new Color(0xFF6B35), // Orange
    new Color(0x50C878), // Green
    new Color(0x9B59B6), // Purple
    new Color(0xF39C12)  // Yellow
  ], []);

  const towerColor = color || playerColors[towerIndex % playerColors.length];

  // Calculate health-based opacity and color
  const healthPercentage = Math.max(0, health / maxHealth);
  const opacity = isDead ? 0.3 : Math.max(0.5, healthPercentage);

  // Convert player color to hex for material colors
  const colorHex = towerColor.getHex();
  const emissiveHex = towerColor.clone().multiplyScalar(0.3).getHex();

  useFrame((_, delta) => {
    timeRef.current += delta;

    if (groupRef.current) {
      // Update position from props
      groupRef.current.position.copy(position);

      // Check if tower is attacking (has target)
      const entity = world.getEntity(entityId);
      if (entity) {
        const tower = entity.getComponent(Tower);
        if (tower && tower.currentTarget) {
          // Check if recently attacked (simulate attack animation)
          const currentTime = Date.now() / 1000;
          const timeSinceLastAttack = currentTime - tower.lastAttackTime;

          // Show attack animation if recently fired
          isAttackingRef.current = timeSinceLastAttack < 0.5;
        } else {
          isAttackingRef.current = false;
        }
      }

      // Handle targeting rotation
      if (isAttackingRef.current && entity) {
        const tower = entity.getComponent(Tower);
        if (tower && tower.currentTarget) {
          const targetEntity = world.getEntity(tower.currentTarget);
          if (targetEntity) {
            const targetTransform = targetEntity.getComponent(Transform);
            if (targetTransform) {
              const direction = new Vector3();
              direction.copy(targetTransform.position);
              direction.sub(position);
              direction.y = 0;
              direction.normalize();

              const angle = Math.atan2(direction.x, direction.z);
              groupRef.current.rotation.y = angle;
            }
          }
        }
      }

      // Gentle floating animation
      groupRef.current.position.y += Math.sin(timeRef.current * 2) * 0.1;

      // Only rotate when not attacking
      if (!isAttackingRef.current) {
        groupRef.current.rotation.y += delta * 0.5;
      }

      // Make health bar face the camera
      if (healthBarRef.current && camera) {
        healthBarRef.current.lookAt(camera.position);
      }

      // Attack animation for "arms" (energy tendrils)
      const leftArm = groupRef.current.getObjectByName('LeftArm') as Mesh;
      if (leftArm) {
        if (isAttackingRef.current) {
          // Raise left arm for casting
          const targetRotation = -Math.PI / 3;
          const currentRotation = leftArm.rotation.x;
          const lerpFactor = 8 * delta;

          leftArm.rotation.x = MathUtils.lerp(currentRotation, targetRotation, lerpFactor);
          leftArm.rotation.z = MathUtils.lerp(leftArm.rotation.z, 0.2, lerpFactor);
        } else {
          // Return to neutral position
          const currentRotation = leftArm.rotation.x;
          const currentZ = leftArm.rotation.z;
          const lerpFactor = 6 * delta;

          leftArm.rotation.x = MathUtils.lerp(currentRotation, 0, lerpFactor);
          leftArm.rotation.z = MathUtils.lerp(currentZ, 0, lerpFactor);
        }
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Main body - crystal structure adapted for tower */}
      <mesh position={[0, 2.0, 0]}>
        <octahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial
          color={colorHex}
          emissive={emissiveHex}
          emissiveIntensity={0.3}
          transparent
          opacity={0.9 * opacity}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Head */}
      <mesh position={[0, 2.7, 0]}>
        <octahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial
          color={colorHex}
          emissive={emissiveHex}
          emissiveIntensity={0.4}
          transparent
          opacity={0.85 * opacity}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Left Shoulder */}
      <mesh position={[-0.7, 2.35, 0]}>
        <sphereGeometry args={[0.325, 16, 16]} />
        <meshStandardMaterial
          color={colorHex}
          emissive={emissiveHex}
          emissiveIntensity={0.3}
          transparent
          opacity={0.85 * opacity}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Left Shoulder Ring */}
      <mesh position={[-0.7, 2.35, 0]} rotation={[Math.PI / 2, -Math.PI / 4, 0]}>
        <torusGeometry args={[0.4, 0.05, 8, 16]} />
        <meshStandardMaterial
          color={towerColor.clone().multiplyScalar(1.2).getHex()}
          emissive={towerColor.clone().multiplyScalar(0.6).getHex()}
          emissiveIntensity={0.5}
          transparent
          opacity={0.9 * opacity}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Left Arm - animated for attacks */}
      <mesh
        name="LeftArm"
        position={[-0.7, 2.0, 0.2]}
        rotation={[0, 0, 0]}
      >
        <cylinderGeometry args={[0.15, 0.15, 1.0, 6]} />
        <meshStandardMaterial
          color={colorHex}
          emissive={emissiveHex}
          emissiveIntensity={0.2}
          transparent
          opacity={0.675 * opacity}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      {/* Right Shoulder */}
      <mesh position={[0.7, 2.35, 0]}>
        <sphereGeometry args={[0.325, 16, 16]} />
        <meshStandardMaterial
          color={colorHex}
          emissive={emissiveHex}
          emissiveIntensity={0.3}
          transparent
          opacity={0.85 * opacity}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Right Shoulder Ring */}
      <mesh position={[0.7, 2.35, 0]} rotation={[Math.PI / 2,  Math.PI / 4, 0]}>
        <torusGeometry args={[0.4, 0.05, 8, 16]} />
        <meshStandardMaterial
          color={towerColor.clone().multiplyScalar(1.2).getHex()}
          emissive={towerColor.clone().multiplyScalar(0.6).getHex()}
          emissiveIntensity={0.5}
          transparent
          opacity={0.9 * opacity}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Right Arm - stays down */}
      <mesh position={[0.7, 2.0, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 1.0, 6]} />
        <meshStandardMaterial
          color={colorHex}
          emissive={emissiveHex}
          emissiveIntensity={0.2}
          transparent
          opacity={0.675 * opacity}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      {/* Energy aura effect */}
      <mesh position={[0, 2.0, 0]}>
        <sphereGeometry args={[1.35, 16, 16]} />
        <meshStandardMaterial
          color={colorHex}
          emissive={emissiveHex}
          emissiveIntensity={0.1}
          transparent
          opacity={0.4 * opacity}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Constant elemental vortex - adapted for tower */}


      {/* Attack animation - energy spikes when attacking */}
      {isAttackingRef.current && (
        <>
          <mesh position={[0, 2.2, 1.5]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.1, 0.8, 6]} />
            <meshStandardMaterial
              color={towerColor.clone().multiplyScalar(1.5).getHex()}
              emissive={towerColor.clone().multiplyScalar(0.8).getHex()}
              emissiveIntensity={0.8}
              transparent
              opacity={0.9}
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>

          <mesh position={[0.5, 2.2, 1.3]} rotation={[Math.PI / 2, 0, Math.PI / 6]}>
            <coneGeometry args={[0.08, 0.6, 6]} />
            <meshStandardMaterial
              color={towerColor.clone().multiplyScalar(1.5).getHex()}
              emissive={towerColor.clone().multiplyScalar(0.8).getHex()}
              emissiveIntensity={0.8}
              transparent
              opacity={0.9}
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>

          <mesh position={[-0.5, 2.2, 1.3]} rotation={[Math.PI / 2, 0, -Math.PI / 6]}>
            <coneGeometry args={[0.08, 0.6, 6]} />
            <meshStandardMaterial
              color={towerColor.clone().multiplyScalar(1.5).getHex()}
              emissive={towerColor.clone().multiplyScalar(0.8).getHex()}
              emissiveIntensity={0.8}
              transparent
              opacity={0.9}
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
        </>
      )}

      {/* Energy tendrils orbital rings */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2 + timeRef.current * 1.2;
        const radius = 0.8;
        const x = Math.cos(angle) * radius;
        const y = 2.5 + Math.sin(angle) * radius;
        const z = Math.cos(timeRef.current * 1.5 + i) * 0.2;

        return (
          <group
            key={`horizontal-${i}`}
            position={[x, y, z]}
            rotation={[
              Math.PI/2,
              angle + Math.PI ,
              -Math.PI/2
            ]}
          >
            <mesh>
              <coneGeometry args={[0.075, 0.3, 6]} />
              <meshStandardMaterial
                color={colorHex}
                emissive={emissiveHex}
                emissiveIntensity={0.8}
                transparent
                opacity={opacity}
              />
            </mesh>
          </group>
        );
      })}

      {/* Vertical Energy tendrils */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2 + timeRef.current * 1.2 + Math.PI / 8;
        const radius = 0.8;
        const x = Math.cos(angle) * radius;
        const y = 2.5 + Math.sin(angle) * radius;
        const z = Math.cos(timeRef.current * 1.5 + i) * 0.2;

        return (
          <group
            key={`vertical-${i}`}
            position={[x, y, z]}
            rotation={[
              Math.PI / 2,
              angle,
              0
            ]}
          >
            <mesh>
            <coneGeometry args={[0.075, 0.3, 6]} />
              <meshStandardMaterial
                color={towerColor.clone().multiplyScalar(0.8).getHex()}
                emissive={towerColor.clone().multiplyScalar(0.4).getHex()}
                emissiveIntensity={0.8}
                transparent
                opacity={opacity}
              />
            </mesh>
          </group>
        );
      })}

      {/* Point light for glow effect */}
      <pointLight
        color={colorHex}
        intensity={0.5}
        distance={3}
        decay={2}
      />


      {/* Death Effect */}
      {isDead && (
        <group>
          <mesh position={[0, 2.0, 0]}>
            <sphereGeometry args={[2, 8, 8]} />
            <meshBasicMaterial
              color={0x666666}
              transparent
              opacity={0.1}
              wireframe
            />
          </mesh>
        </group>
      )}
    </group>
  );
}
