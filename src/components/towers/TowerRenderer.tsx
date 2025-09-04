'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Color, Group, Mesh } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import { Tower } from '@/ecs/components/Tower';

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
  color
}: TowerRendererProps) {
  const groupRef = useRef<Group>(null);
  const barrelRef = useRef<Mesh>(null);
  
  // Tower dimensions
  const towerHeight = 4;
  const towerBaseRadius = 1.5;
  const towerTopRadius = 1;
  
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
  const damageColor = isDead ? new Color(0x666666) : towerColor.clone().lerp(new Color(0xFF0000), 1 - healthPercentage);
  
  // Update tower rotation to face current target
  useFrame(() => {
    if (!world || isDead) return;
    
    const entity = world.getEntity(entityId);
    if (!entity) return;
    
    const tower = entity.getComponent(Tower);
    if (!tower || !tower.currentTarget) return;
    
    const targetEntity = world.getEntity(tower.currentTarget);
    if (!targetEntity) return;
    
    const targetTransform = targetEntity.getComponent(Transform);
    if (!targetTransform) return;
    
    // Calculate direction to target
    const direction = new Vector3();
    direction.copy(targetTransform.position);
    direction.sub(position);
    direction.y = 0; // Keep rotation horizontal
    direction.normalize();
    
    // Rotate barrel to face target
    if (barrelRef.current) {
      const angle = Math.atan2(direction.x, direction.z);
      barrelRef.current.rotation.y = angle;
    }
  });
  
  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]}>
      {/* Tower Base */}
      <mesh
        position={[0, towerHeight * 0.5, 0]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[towerTopRadius, towerBaseRadius, towerHeight, 8]} />
        <meshStandardMaterial
          color={damageColor}
          metalness={0.3}
          roughness={0.7}
          transparent
          opacity={opacity}
        />
      </mesh>
      
      {/* Tower Top (Turret) */}
      <mesh
        position={[0, towerHeight + 0.25, 0]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[towerTopRadius * 0.8, towerTopRadius * 0.8, 0.5, 8]} />
        <meshStandardMaterial
          color={damageColor.clone().multiplyScalar(1.2)}
          metalness={0.5}
          roughness={0.5}
          transparent
          opacity={opacity}
        />
      </mesh>
      
      {/* Cannon Barrel */}
      <mesh
        ref={barrelRef}
        position={[0, towerHeight + 0.25, 0]}
        castShadow
      >
        <group>
          <mesh position={[0.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.1, 0.1, 1, 6]} />
            <meshStandardMaterial
              color={0x2C3E50}
              metalness={0.8}
              roughness={0.2}
              transparent
              opacity={opacity}
            />
          </mesh>
        </group>
      </mesh>
      
      {/* Detail Blocks */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2;
        const x = Math.cos(angle) * towerBaseRadius * 0.9;
        const z = Math.sin(angle) * towerBaseRadius * 0.9;
        
        return (
          <mesh
            key={i}
            position={[x, towerHeight * 0.3, z]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.2, 0.3, 0.2]} />
            <meshStandardMaterial
              color={damageColor.clone().multiplyScalar(0.8)}
              metalness={0.4}
              roughness={0.8}
              transparent
              opacity={opacity}
            />
          </mesh>
        );
      })}
      
      {/* Health Bar */}
      {!isDead && (
        <group position={[0, towerHeight + 1.5, 0]}>
          {/* Health Bar Background */}
          <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3, 0.3]} />
            <meshBasicMaterial color={0x333333} transparent opacity={0.8} />
          </mesh>
          
          {/* Health Bar Fill */}
          <mesh 
            position={[-(3 * (1 - healthPercentage)) / 2, 0.01, 0]} 
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[healthPercentage, 1, 1]}
          >
            <planeGeometry args={[3, 0.25]} />
            <meshBasicMaterial 
              color={healthPercentage > 0.5 ? 0x00ff00 : healthPercentage > 0.25 ? 0xffff00 : 0xff0000}
              transparent 
              opacity={0.9} 
            />
          </mesh>
          
          {/* Owner Name */}
          <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[4, 0.5]} />
            <meshBasicMaterial color={0x000000} transparent opacity={0.7} />
          </mesh>
        </group>
      )}
      
      {/* Death Effect */}
      {isDead && (
        <group>
          {/* Smoke/Debris particles could go here */}
          <mesh position={[0, towerHeight * 0.5, 0]}>
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
