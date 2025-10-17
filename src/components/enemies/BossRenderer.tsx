import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Enemy } from '@/ecs/components/Enemy';
import { Movement } from '@/ecs/components/Movement';
import BossModel from './BossModel';

interface BossRendererProps {
  entityId: number;
  position: Vector3;
  world: World;
  onMeshReady?: (mesh: Group) => void;
  isAttacking?: boolean;
  attackingHand?: 'left' | 'right' | null;
  targetPosition?: Vector3 | null;
  rotation?: number; // Server-authoritative rotation in radians
  isStunned?: boolean; // Whether the enemy is currently stunned
}

export default function BossRenderer({
  entityId,
  position,
  world,
  onMeshReady,
  isAttacking = false,
  attackingHand = null,
  targetPosition = null,
  rotation,
  isStunned = false
}: BossRendererProps) {
  const groupRef = useRef<Group>(null);
  const timeRef = useRef(0);
  const currentRotationRef = useRef(0);

  // Lightning effect handler
  const handleLightningStart = (hand: 'left' | 'right') => {
    // You can add lightning effect logic here
    console.log(`Boss casting lightning from ${hand} hand`);
  };

  useFrame((_, delta) => {
    timeRef.current += delta;

    if (groupRef.current) {
      // Update position from ECS
      groupRef.current.position.copy(position);

      // Gentle floating animation for boss
      groupRef.current.position.y += Math.sin(timeRef.current * 1.5) * 0.02;

      // Prevent rotation if stunned
      if (isStunned) {
        // Keep current rotation, don't update it
        return;
      }

      // Use server rotation if available (preferred for multiplayer sync)
      if (rotation !== undefined) {
        // Server provides authoritative rotation - use smooth interpolation for visual smoothness
        const ROTATION_SPEED = 6.0; // Fast but smooth rotation
        const currentRotationY = groupRef.current.rotation.y;

        // Calculate shortest rotation path to server rotation
        let rotationDiff = rotation - currentRotationY;

        // Normalize angle difference to [-π, π] (avoid spinning wrong way)
        while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
        while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

        // Apply smooth rotation (clamped to avoid overshooting)
        groupRef.current.rotation.y += rotationDiff * Math.min(1, ROTATION_SPEED * delta);

        // Update ref for next frame
        currentRotationRef.current = groupRef.current.rotation.y;
      }
      // Fallback: Rotate boss to face target if no server rotation (backward compatibility)
      else if (targetPosition) {
        // Calculate direction to target
        const direction = new Vector3()
          .subVectors(targetPosition, position)
          .setY(0) // Ignore Y difference for rotation
          .normalize();

        // Calculate target rotation angle using same formula as AscendantUnit
        // Math.atan2(x, z) gives rotation in world space
        const targetRotation = Math.atan2(direction.x, direction.z);

        // Smooth rotation interpolation (like AscendantUnit)
        const ROTATION_SPEED = 6.0; // Fast but smooth rotation
        const currentRotationY = groupRef.current.rotation.y;
        
        // Calculate shortest rotation path
        let rotationDiff = targetRotation - currentRotationY;
        
        // Normalize angle difference to [-π, π] (avoid spinning wrong way)
        while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
        while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
        
        // Apply smooth rotation (clamped to avoid overshooting)
        groupRef.current.rotation.y += rotationDiff * Math.min(1, ROTATION_SPEED * delta);
        
        // Update ref for next frame
        currentRotationRef.current = groupRef.current.rotation.y;
      } else {
        // No target and no server rotation, gentle idle rotation
        groupRef.current.rotation.y = Math.sin(timeRef.current * 0.3) * 0.3;
        currentRotationRef.current = groupRef.current.rotation.y;
      }
    }
  });

  useEffect(() => {
    if (groupRef.current && onMeshReady) {
      onMeshReady(groupRef.current);
    }
  }, [onMeshReady]);

  return (
    <group ref={groupRef}>
      <BossModel
        isAttacking={isAttacking}
        attackingHand={attackingHand}
        onLightningStart={handleLightningStart}
      />
    </group>
  );
}

