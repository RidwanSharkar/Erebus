'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import RejuvenatingShot from './RejuvenatingShot';
import RejuvenatingShotHealingEffect from './RejuvenatingShotHealingEffect';
import { World } from '@/ecs/World';

export interface RejuvenatingShotProjectile {
  id: number;
  position: Vector3;
  direction: Vector3;
  startPosition: Vector3;
  maxDistance: number;
  active: boolean;
  startTime: number;
  distanceTraveled: number;
  opacity: number;
  fadeStartTime: number | null;
  hasHealed: boolean; // Track if this projectile has already healed someone
  healedPlayerId: string | null; // Track which player was healed to prevent double healing
}

interface RejuvenatingShotManagerProps {
  world: World;
  playerPositions?: Array<{
    id: string;
    position: Vector3;
    health: number;
    maxHealth: number;
  }>;
  onPlayerHealed?: (playerId: string, healAmount: number, position: Vector3) => void;
}

// Global function to trigger rejuvenating shot from ControlSystem
let globalRejuvenatingShotTrigger: ((position: Vector3, direction: Vector3) => void) | null = null;
let globalRejuvenatingShotProjectilePool: (() => RejuvenatingShotProjectile[]) | null = null;

export function triggerGlobalRejuvenatingShot(position: Vector3, direction: Vector3): void {
  if (globalRejuvenatingShotTrigger) {
    globalRejuvenatingShotTrigger(position, direction);
  }
}

export function getGlobalRejuvenatingShotProjectiles(): RejuvenatingShotProjectile[] {
  if (globalRejuvenatingShotProjectilePool) {
    return globalRejuvenatingShotProjectilePool();
  }
  return [];
}

const HEALING_RANGE = 2.0; // Range to detect player collision
const HEALING_AMOUNT = 80; // Amount to heal players

interface HealingEffectData {
  id: number;
  position: Vector3;
  startTime: number;
}

export default function RejuvenatingShotManager({ world, playerPositions = [], onPlayerHealed }: RejuvenatingShotManagerProps) {
  const projectilePool = useRef<RejuvenatingShotProjectile[]>([]);
  const nextProjectileId = useRef(0);
  const [healingEffects, setHealingEffects] = useState<HealingEffectData[]>([]);
  const nextHealingEffectId = useRef(0);
  
  const POOL_SIZE = 3;
  const PROJECTILE_SPEED = 1.0; // Same speed as Cobra Shot
  const MAX_DISTANCE = 25; // Same range as Cobra Shot
  const FADE_DURATION = 1000;

  // Initialize projectile pool
  useEffect(() => {
    projectilePool.current = Array(POOL_SIZE).fill(null).map((_, index) => ({
      id: index,
      position: new Vector3(),
      direction: new Vector3(),
      startPosition: new Vector3(),
      maxDistance: MAX_DISTANCE,
      active: false,
      startTime: 0,
      distanceTraveled: 0,
      opacity: 1,
      fadeStartTime: null,
      hasHealed: false,
      healedPlayerId: null
    }));
  }, []);

  const getInactiveProjectile = useCallback(() => {
    return projectilePool.current.find(p => !p.active);
  }, []);

  const shootRejuvenatingShot = useCallback((position: Vector3, direction: Vector3) => {
    const projectile = getInactiveProjectile();
    if (!projectile) {
      return;
    }

    const now = Date.now();

    // Set up projectile
    projectile.position.copy(position);
    projectile.direction.copy(direction).normalize();
    projectile.startPosition.copy(position);
    projectile.active = true;
    projectile.startTime = now;
    projectile.distanceTraveled = 0;
    projectile.opacity = 1;
    projectile.fadeStartTime = null;
    projectile.hasHealed = false;
    projectile.healedPlayerId = null;

    console.log('💚 Rejuvenating Shot fired!', { position: position.clone(), direction: direction.clone() });
  }, [getInactiveProjectile]);

  // Set up global trigger and projectile pool access
  useEffect(() => {
    globalRejuvenatingShotTrigger = shootRejuvenatingShot;
    globalRejuvenatingShotProjectilePool = () => projectilePool.current;
    return () => {
      globalRejuvenatingShotTrigger = null;
      globalRejuvenatingShotProjectilePool = null;
    };
  }, [shootRejuvenatingShot]);

  // Update projectiles and handle collisions
  useFrame(() => {
    const currentTime = Date.now();

    projectilePool.current.forEach(projectile => {
      if (!projectile.active) return;

      // Move projectile
      const movement = projectile.direction.clone().multiplyScalar(PROJECTILE_SPEED);
      projectile.position.add(movement);

      // Update distance traveled
      projectile.distanceTraveled = projectile.position.distanceTo(projectile.startPosition);
      
      // Start fading when approaching max distance
      if (projectile.distanceTraveled > MAX_DISTANCE * 0.8 && !projectile.fadeStartTime) {
        projectile.fadeStartTime = currentTime;
      }

      // Handle fading
      if (projectile.fadeStartTime) {
        const fadeElapsed = currentTime - projectile.fadeStartTime;
        projectile.opacity = Math.max(0, 1 - (fadeElapsed / FADE_DURATION));
        
        if (projectile.opacity <= 0 || projectile.distanceTraveled > MAX_DISTANCE) {
          projectile.active = false;
          projectile.opacity = 1;
          projectile.fadeStartTime = null;
          projectile.hasHealed = false;
          projectile.healedPlayerId = null;
          return;
        }
      }

      // Check collisions with players (only if not already healed someone)
      if (!projectile.hasHealed) {
        for (const player of playerPositions) {
          // Skip if we already healed this specific player
          if (projectile.healedPlayerId === player.id) {
            continue;
          }
          
          const distance = projectile.position.distanceTo(player.position);
          if (distance <= HEALING_RANGE) {
            // Create healing effect at player's position
            const healingEffectPosition = player.position.clone();
            healingEffectPosition.y += 0; // Ground level
            
            const newHealingEffect: HealingEffectData = {
              id: nextHealingEffectId.current++,
              position: healingEffectPosition,
              startTime: Date.now()
            };
            
            setHealingEffects(prev => [...prev, newHealingEffect]);
            
            // Heal the player
            if (onPlayerHealed) {
              onPlayerHealed(player.id, HEALING_AMOUNT, projectile.position.clone());
              console.log(`💚 RejuvenatingShot healed player ${player.id} for ${HEALING_AMOUNT} HP at position`, healingEffectPosition);
            }

            // Mark this projectile as having healed someone and track which player
            projectile.hasHealed = true;
            projectile.healedPlayerId = player.id;
            
            // Deactivate projectile after healing
            projectile.active = false;
            projectile.opacity = 1;
            projectile.fadeStartTime = null;
            break; // Only heal one player per shot
          }
        }
      }
    });
  });

  const removeHealingEffect = useCallback((id: number) => {
    setHealingEffects(prev => prev.filter(effect => effect.id !== id));
  }, []);

  return (
    <group name="rejuvenating-shot-manager">
      {/* Render active projectiles */}
      {projectilePool.current
        .filter(projectile => projectile.active)
        .map((projectile) => (
          <RejuvenatingShot
            key={projectile.id}
            position={projectile.position}
            direction={projectile.direction}
            distanceTraveled={projectile.distanceTraveled}
            maxDistance={MAX_DISTANCE}
          />
        ))}
      
      {/* Render healing effects */}
      {healingEffects.map((effect) => (
        <RejuvenatingShotHealingEffect
          key={effect.id}
          position={effect.position}
          onComplete={() => removeHealingEffect(effect.id)}
        />
      ))}
    </group>
  );
}
