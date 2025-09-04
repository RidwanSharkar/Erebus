import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, SphereGeometry, CylinderGeometry, ConeGeometry, BoxGeometry, MeshStandardMaterial, Vector3 } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Enemy } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import { ObjectPool } from '@/utils/ObjectPool';
import GruntModel from './GruntModel';

interface GruntRendererProps {
  entityId: number;
  world: World;
  onMeshReady?: (mesh: Group) => void;
}

// Object pools for performance optimization - smaller pools for grunt
const geometryPool = new ObjectPool(
  () => ({
    sphere: new SphereGeometry(0.3, 12, 12),
    cylinder: new CylinderGeometry(0.12, 0.12, 0.8, 4),
    cone: new ConeGeometry(0.06, 0.25, 4),
    box: new BoxGeometry(0.15, 0.12, 0.06)
  }),
  (geometries) => {
    // Geometries don't need reset
  },
  5
);

const materialPool = new ObjectPool(
  () => ({
    body: new MeshStandardMaterial({
      color: "#4169E1",
      emissive: "#1E3A8A",
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.85,
      metalness: 0.6,
      roughness: 0.3
    }),
    bone: new MeshStandardMaterial({
      color: "#e8e8e8",
      emissive: "#d4d4d4",
      emissiveIntensity: 0.1,
      transparent: true,
      opacity: 0.9,
      metalness: 0.3,
      roughness: 0.4
    }),
    claw: new MeshStandardMaterial({
      color: "#4169E1",
      emissive: "#4169E1",
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9,
      metalness: 0.7,
      roughness: 0.2
    })
  }),
  (materials) => {
    // Reset material properties
    Object.values(materials).forEach(material => {
      material.needsUpdate = true;
    });
  },
  5
);

export default function GruntRenderer({ 
  entityId, 
  world,
  onMeshReady
}: GruntRendererProps) {
  const groupRef = useRef<Group>(null);
  const positionRef = useRef(new Vector3());
  const healthRef = useRef(1.0);
  const isDeadRef = useRef(false);
  const isAttackingRef = useRef(false);
  const isWalkingRef = useRef(false);
  const timeRef = useRef(0);
  
  // Memoized materials and geometries for performance
  const { geometries, materials } = useMemo(() => {
    return {
      geometries: geometryPool.acquire(),
      materials: materialPool.acquire()
    };
  }, []);

  // Update entity data from ECS
  useFrame((_, delta) => {
    timeRef.current += delta;
    
    const entity = world.getEntity(entityId);
    if (!entity) return;

    const transform = entity.getComponent(Transform);
    const health = entity.getComponent(Health);
    const enemy = entity.getComponent(Enemy);

    if (transform && groupRef.current) {
      positionRef.current.copy(transform.position);
      groupRef.current.position.copy(transform.position);
    }

    if (health) {
      healthRef.current = health.currentHealth / health.maxHealth;
    }

    if (enemy) {
      isDeadRef.current = enemy.isDead;
      
      // Enhanced attack detection for Grunt
      const currentTime = Date.now() / 1000;
      const timeSinceLastAttack = currentTime - enemy.lastAttackTime;
      
      // Show attack animation if recently attacked OR do periodic demo attacks
      const isRecentlyAttacked = timeSinceLastAttack < 0.8; // Attack duration for Grunt
      const isDemoAttacking = Math.sin(timeRef.current * 0.5) > 0.9; // Occasional demo attacks
      
      isAttackingRef.current = isRecentlyAttacked || isDemoAttacking;
      
      // Simple walking detection based on movement
      const previousPosition = positionRef.current.clone();
      if (transform) {
        const distance = previousPosition.distanceTo(transform.position);
        isWalkingRef.current = distance > 0.01; // If moved more than threshold
      }
    }

    // Handle death state
    if (isDeadRef.current && groupRef.current) {
      groupRef.current.visible = false;
    } else if (groupRef.current) {
      groupRef.current.visible = true;
      
      // Keep grunt stationary - no floating or rotation animations
    }
  });

  useEffect(() => {
    if (groupRef.current && onMeshReady) {
      onMeshReady(groupRef.current);
    }
  }, [onMeshReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      geometryPool.release(geometries);
      materialPool.release(materials);
    };
  }, [geometries, materials]);

  // Health-based material opacity
  useEffect(() => {
    const opacity = Math.max(0.4, healthRef.current);
    materials.body.opacity = 0.85 * opacity;
    materials.bone.opacity = 0.9 * opacity;
    materials.claw.opacity = 0.9 * opacity;
    
    // Adjust emissive intensity based on health
    const emissiveMultiplier = Math.max(0.3, healthRef.current);
    materials.body.emissiveIntensity = 0.2 * emissiveMultiplier;
    materials.claw.emissiveIntensity = 0.8 * emissiveMultiplier;
  }, [materials, healthRef.current]);

  const handleHit = (damage: number) => {
    console.log(`🗡️ Grunt hit for ${damage} damage!`);
    // You can add hit effect logic here
  };

  return (
    <group ref={groupRef}>
      <GruntModel
        isAttacking={isAttackingRef.current}
        isWalking={isWalkingRef.current}
        onHit={handleHit}
      />
    </group>
  );
}
