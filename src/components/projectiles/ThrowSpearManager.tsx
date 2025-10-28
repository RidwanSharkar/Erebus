import { useState, useEffect, useCallback } from 'react';
import { Vector3 } from 'three';
import ThrowSpear from './ThrowSpear';
import { World } from '@/ecs/World';
import { Enemy } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { calculateDamage } from '@/core/DamageCalculator';
import { WeaponType } from '@/components/dragon/weapons';
import { CombatSystem } from '@/systems/CombatSystem';

export interface ThrowSpearProjectile {
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
  hitEnemies: Set<string>; // Track which enemies were hit going out
  isReturning: boolean;
  returnHitEnemies: Set<string>; // Track which enemies were hit returning
  chargeTime: number; // 0-2 seconds
  damage: number; // Base damage calculated from charge time
}

interface ThrowSpearManagerProps {
  world: World;
}

// Global registry for throw spear projectiles
let globalThrowSpearProjectiles: ThrowSpearProjectile[] = [];
let nextThrowSpearId = 0;

export function triggerGlobalThrowSpear(position: Vector3, direction: Vector3, chargeTime: number): void {
  console.log('🎯 Throw Spear triggered!', {
    position: position.toArray(),
    direction: direction.toArray(),
    chargeTime
  });

  // Calculate distance based on charge time (10 to 20 units)
  const minDistance = 8;
  const maxDistance = 20;
  const distance = minDistance + (maxDistance - minDistance) * (chargeTime / 2.0);

  // Calculate damage based on charge time (50 to 200)
  const minDamage = 50;
  const maxDamage = 200;
  const baseDamage = minDamage + (maxDamage - minDamage) * (chargeTime / 2.0);

  const projectile: ThrowSpearProjectile = {
    id: nextThrowSpearId++,
    position: position.clone(),
    direction: direction.clone().normalize(),
    startPosition: position.clone(),
    maxDistance: distance,
    active: true,
    startTime: performance.now(),
    distanceTraveled: 0,
    opacity: 1.0,
    fadeStartTime: null,
    hitEnemies: new Set(),
    isReturning: false,
    returnHitEnemies: new Set(),
    chargeTime: chargeTime,
    damage: baseDamage
  };

  console.log('🎯 Projectile created:', projectile.id, 'Total projectiles:', globalThrowSpearProjectiles.length + 1);

  globalThrowSpearProjectiles.push(projectile);
}

export function getGlobalThrowSpearProjectiles(): ThrowSpearProjectile[] {
  return globalThrowSpearProjectiles;
}

export default function ThrowSpearManager({ world }: ThrowSpearManagerProps) {
  const [projectiles, setProjectiles] = useState<ThrowSpearProjectile[]>([]);

  // Sync global projectiles with local state
  useEffect(() => {
    const interval = setInterval(() => {
      setProjectiles([...globalThrowSpearProjectiles]);
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, []);

  const checkCollisions = useCallback((projectile: ThrowSpearProjectile) => {
    if (!world) return;

    const entities = world.getAllEntities();
    const combatSystem = world.getSystem(CombatSystem as any) as CombatSystem;

    entities.forEach((entity: any) => {
      const enemy = entity.getComponent(Enemy);
      const transform = entity.getComponent(Transform);

      if (!enemy || !transform || enemy.isDying) return;

      // Check if this enemy was already hit (different set for going out vs returning)
      const hitSet = projectile.isReturning ? projectile.returnHitEnemies : projectile.hitEnemies;
      const enemyId = entity.id.toString();
      if (hitSet.has(enemyId)) return;

      // Check distance
      const distance = projectile.position.distanceTo(transform.position);
      const hitRadius = 1.0; // Spear hit radius

      if (distance < hitRadius) {
        // Mark as hit
        hitSet.add(enemyId);

        // Calculate damage with critical hits
        const damageResult = calculateDamage(projectile.damage, WeaponType.SPEAR);
        const actualDamage = damageResult.damage;

        // Apply damage
        if (combatSystem) {
          const playerEntity = world.getAllEntities().find((e: any) => e.userData?.isPlayer);
          (combatSystem as any).queueDamage(
            entity,
            actualDamage,
            playerEntity || undefined,
            'throw_spear',
            playerEntity?.userData?.playerId,
            damageResult.isCritical
          );
        }
      }
    });
  }, [world]);

  useEffect(() => {
    const updateInterval = setInterval(() => {
      if (globalThrowSpearProjectiles.length === 0) return;

      const currentTime = performance.now();
      const deltaTime = 16 / 1000; // 16ms in seconds

      globalThrowSpearProjectiles = globalThrowSpearProjectiles.filter((projectile) => {
        // Speed based on charge time (15-40 units per second)
        const minSpeed = 16;
        const maxSpeed = 42;
        const speed = minSpeed + (maxSpeed - minSpeed) * (projectile.chargeTime / 2.0); // chargeTime is 0-2
        const returnSpeed = speed * 1.1; // Return slightly faster
        if (!projectile.active) return false;

        // Handle fading first
        if (projectile.fadeStartTime) {
          const fadeElapsed = (currentTime - projectile.fadeStartTime) / 1000;
          const fadeDuration = 0.3; // 300ms fade
          projectile.opacity = Math.max(0, 1 - (fadeElapsed / fadeDuration));

          if (projectile.opacity <= 0) {
            projectile.active = false;
            return false;
          }
        }

        // Get player position for return tracking
        const playerEntity = world.getAllEntities().find((e: any) => e.userData?.isPlayer);
        let playerPosition: Vector3 | null = null;
        if (playerEntity) {
          const playerTransform = playerEntity.getComponent(Transform);
          if (playerTransform) {
            playerPosition = playerTransform.position;
          }
        }

        if (!projectile.isReturning) {
          // OUTBOUND PHASE - Calculate distance from start position
          const distanceFromStart = projectile.position.distanceTo(projectile.startPosition);

          if (distanceFromStart < projectile.maxDistance && !projectile.fadeStartTime) {
            // Move projectile forward
            const moveDistance = speed * deltaTime;
            const movement = projectile.direction.clone().multiplyScalar(moveDistance);
            projectile.position.add(movement);

            // Check collisions during outbound
            checkCollisions(projectile);
          } else if (!projectile.fadeStartTime) {
            // Reached max distance - start returning
            console.log('🎯 Spear reached max distance, starting return', {
              distanceFromStart,
              maxDistance: projectile.maxDistance,
              position: projectile.position.toArray(),
              hasPlayerPosition: !!playerPosition
            });
            projectile.isReturning = true;
            
            // Update direction to point back to player
            if (playerPosition) {
              projectile.direction = new Vector3()
                .subVectors(playerPosition, projectile.position)
                .normalize();
              console.log('🎯 Initial return direction set:', projectile.direction.toArray());
            } else {
              console.warn('⚠️ No player position found when starting return!');
            }
          }
        } else {
          // RETURN PHASE - Track player's current position dynamically
          if (playerPosition) {
            const distanceToPlayer = projectile.position.distanceTo(playerPosition);

            if (distanceToPlayer > 1.5 && !projectile.fadeStartTime) {
              // Update direction to current player position (dynamic tracking like Viper Sting)
              projectile.direction = new Vector3()
                .subVectors(playerPosition, projectile.position)
                .normalize();

              // Move projectile back toward player
              const moveDistance = returnSpeed * deltaTime;
              const movement = projectile.direction.clone().multiplyScalar(moveDistance);
              projectile.position.add(movement);

              // Debug log occasionally
              if (Math.random() < 0.01) { // 1% chance per frame
                console.log('🎯 Returning to player:', {
                  distanceToPlayer,
                  projectilePos: projectile.position.toArray(),
                  playerPos: playerPosition.toArray(),
                  direction: projectile.direction.toArray()
                });
              }

              // Check collisions during return
              checkCollisions(projectile);
            } else if (!projectile.fadeStartTime) {
              // Reached player - start fading
              console.log('🎯 Spear returned to player, fading out');
              projectile.fadeStartTime = currentTime;
            }
          } else {
            // No player position during return - this is a problem!
            console.warn('⚠️ No player position during return phase! Projectile ID:', projectile.id);
            // Try to fade out the projectile to prevent it being stuck forever
            if (!projectile.fadeStartTime) {
              projectile.fadeStartTime = currentTime;
            }
          }
        }

        return projectile.active;
      });
    }, 16); // ~60fps

    return () => clearInterval(updateInterval);
  }, [checkCollisions, world]);

  return <ThrowSpear activeProjectiles={projectiles} />;
}

