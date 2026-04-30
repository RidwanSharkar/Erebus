import React, { useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import CrossentropyBolt from './CrossentropyBolt';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Projectile } from '@/ecs/components/Projectile';
import { Renderer } from '@/ecs/components/Renderer';
import type { CrossentropyVisualTheme } from '@/utils/talents';

function crossentropyThemeFromUserData(ud: Record<string, unknown>): CrossentropyVisualTheme {
  if (ud.crossentropyInferno === true) return 'inferno';
  if (ud.crossentropyTempest === true) return 'tempest';
  if (ud.crossentropyPlague === true) return 'plague';
  return 'default';
}

interface CrossentropyBoltData {
  id: number;
  position: Vector3;
  direction: Vector3;
  entityId: number;
  visualTheme?: CrossentropyVisualTheme;
}

interface CrossentropyBoltManagerProps {
  world: World;
}

export default function CrossentropyBoltManager({ world }: CrossentropyBoltManagerProps) {
  const [activeBolts, setActiveBolts] = useState<CrossentropyBoltData[]>([]);
  const boltIdCounter = useRef(0);
  const lastUpdateTime = useRef(0);

  useFrame((state) => {
    // Throttle updates to avoid excessive re-renders
    const currentTime = state.clock.getElapsedTime();
    if (currentTime - lastUpdateTime.current < 0.016) return; // ~60fps
    lastUpdateTime.current = currentTime;

    if (!world) return;

    const projectileEntities = world.queryEntities([Transform, Projectile, Renderer]);
    const newBolts: CrossentropyBoltData[] = [];

    for (const entity of projectileEntities) {
      const renderer = entity.getComponent(Renderer);
      const transform = entity.getComponent(Transform);
      const projectile = entity.getComponent(Projectile);

      if (renderer?.mesh?.userData?.isCrossentropyBolt && transform && projectile) {
        // Check if this bolt already exists
        const existingBolt = activeBolts.find(bolt => bolt.entityId === entity.id);
        
        if (existingBolt) {
          existingBolt.position.copy(transform.position);
          existingBolt.visualTheme = crossentropyThemeFromUserData(
            renderer.mesh.userData as Record<string, unknown>,
          );
          newBolts.push(existingBolt);
        } else {
          const direction = renderer.mesh.userData.direction || projectile.velocity.clone().normalize();
          newBolts.push({
            id: boltIdCounter.current++,
            position: transform.position.clone(),
            direction: direction.clone(),
            entityId: entity.id,
            visualTheme: crossentropyThemeFromUserData(renderer.mesh.userData as Record<string, unknown>),
          });
        }
      }
    }

    // Clean up bolts whose entities no longer exist
    const validEntityIds = new Set(projectileEntities.map(e => e.id));
    const cleanedActiveBolts = activeBolts.filter(bolt => validEntityIds.has(bolt.entityId));
    
    // Update state if bolts have changed
    if (newBolts.length !== cleanedActiveBolts.length || 
        newBolts.some(bolt => !cleanedActiveBolts.find(existing => existing.entityId === bolt.entityId))) {
      setActiveBolts(newBolts);
    }
  });

  return (
    <>
      {activeBolts.map(bolt => (
        <CrossentropyBolt
          key={bolt.id}
          id={bolt.id}
          position={bolt.position}
          direction={bolt.direction}
          visualTheme={bolt.visualTheme ?? 'default'}
          onImpact={() => {
            // Visual component lifecycle - just remove from visual state
            // ECS system handles all collision detection and damage
            setActiveBolts(prev => prev.filter(b => b.id !== bolt.id));
          }}
        />
      ))}
    </>
  );
}
