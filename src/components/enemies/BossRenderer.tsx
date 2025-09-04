import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Enemy } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import BossModel from './BossModel';

interface BossRendererProps {
  entityId: number;
  position: Vector3;
  world: World;
  onMeshReady?: (mesh: Group) => void;
}

export default function BossRenderer({ 
  entityId, 
  position, 
  world,
  onMeshReady
}: BossRendererProps) {
  const groupRef = useRef<Group>(null);
  const timeRef = useRef(0);
  const isAttackingRef = useRef(false);
  const attackingHandRef = useRef<'left' | 'right' | null>(null);
  const healthRef = useRef(1.0);
  const isDeadRef = useRef(false);

  useFrame((_, delta) => {
    timeRef.current += delta;
    
    if (groupRef.current) {
      // Update position from ECS
      const entity = world.getEntity(entityId);
      if (entity) {
        const transform = entity.getComponent(Transform);
        const health = entity.getComponent(Health);
        const enemy = entity.getComponent(Enemy);

        if (transform) {
          groupRef.current.position.copy(transform.position);
        }

        if (health) {
          healthRef.current = health.currentHealth / health.maxHealth;
        }

        if (enemy) {
          isDeadRef.current = enemy.isDead;
          
          // Enhanced attack detection for Boss
          const currentTime = Date.now() / 1000;
          const timeSinceLastAttack = currentTime - enemy.lastAttackTime;
          
          // Show attack animation if recently attacked OR do periodic demo attacks
          const isRecentlyAttacked = timeSinceLastAttack < 1.0; // Longer attack duration for Boss
          const isDemoAttacking = Math.sin(timeRef.current * 0.3) > 0.8; // Less frequent but more dramatic attacks
          
          isAttackingRef.current = isRecentlyAttacked || isDemoAttacking;
          
          // Alternate between hands for attacks
          if (isAttackingRef.current) {
            attackingHandRef.current = Math.sin(timeRef.current * 0.6) > 0 ? 'left' : 'right';
          } else {
            attackingHandRef.current = null;
          }
        }
      }
      
      // Handle death state
      if (isDeadRef.current) {
        groupRef.current.visible = false;
      } else {
        groupRef.current.visible = true;
        
        // Gentle floating animation for Boss (more majestic)
        groupRef.current.position.y += Math.sin(timeRef.current * 1.5) * 0.15;
        
        // Slow rotation when not attacking
        if (!isAttackingRef.current) {
          groupRef.current.rotation.y += delta * 0.3;
        }
      }
    }
  });

  useEffect(() => {
    if (groupRef.current && onMeshReady) {
      onMeshReady(groupRef.current);
    }
  }, [onMeshReady]);

  const handleLightningStart = (hand: 'left' | 'right') => {
    console.log(`🌩️ Boss lightning attack from ${hand} hand!`);
    // You can add lightning effect logic here
  };

  return (
    <group ref={groupRef}>
      <BossModel
        isAttacking={isAttackingRef.current}
        attackingHand={attackingHandRef.current}
        onLightningStart={handleLightningStart}
        health={healthRef.current}
      />
    </group>
  );
}
