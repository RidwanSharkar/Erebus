import { useState, useCallback, useRef } from 'react';
import { Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import ThrowSpear from './ThrowSpear';
import { World } from '@/ecs/World';
import { Enemy } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { calculateDamage } from '@/core/DamageCalculator';
import { WeaponType } from '@/components/dragon/weapons';
import { CombatSystem } from '@/systems/CombatSystem';
import { applyDungeonChestY, getDungeonMeshCollider } from '@/utils/dungeonLayout';

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

// Module-level scratch vectors — avoids per-frame allocations inside useFrame
const _scratchMovement = new Vector3();
const _scratchReturnDir = new Vector3();

export function triggerGlobalThrowSpear(position: Vector3, direction: Vector3, chargeTime: number): void {
  // Calculate distance based on charge time (10 to 20 units)
  const minDistance = 8;
  const maxDistance = 20;
  const distance = minDistance + (maxDistance - minDistance) * (chargeTime / 2.0);

  // Calculate damage based on charge time (50 to 200)
  const minDamage = 50;
  const maxDamage = 200;
  const damage = minDamage + (maxDamage - minDamage) * (chargeTime / 2.0);

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
    damage: damage
  };

  globalThrowSpearProjectiles.push(projectile);
}

export function getGlobalThrowSpearProjectiles(): ThrowSpearProjectile[] {
  return globalThrowSpearProjectiles;
}

/** In-place swap-remove — avoids allocating a new array every frame. */
function swapRemoveProjectile(index: number): void {
  const last = globalThrowSpearProjectiles.length - 1;
  if (index !== last) {
    globalThrowSpearProjectiles[index] = globalThrowSpearProjectiles[last];
  }
  globalThrowSpearProjectiles.pop();
}

export default function ThrowSpearManager({ world }: ThrowSpearManagerProps) {
  const [projectiles, setProjectiles] = useState<ThrowSpearProjectile[]>([]);
  // Track last-seen active count to batch state updates only when projectiles arrive/depart
  const lastActiveCount = useRef(-1);
  const playerEntityCache = useRef<any>(null);

  const checkCollisions = useCallback((projectile: ThrowSpearProjectile, playerEntity: any) => {
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
      const distance = getDungeonMeshCollider()
        ? Math.hypot(
            projectile.position.x - transform.position.x,
            projectile.position.z - transform.position.z,
          )
        : projectile.position.distanceTo(transform.position);
      const hitRadius = 1.0; // Spear hit radius

      if (distance < hitRadius) {
        // Mark as hit
        hitSet.add(enemyId);

        // Calculate damage with critical hits
        const damageResult = calculateDamage(projectile.damage, WeaponType.SPEAR);
        const actualDamage = damageResult.damage;

        // Apply damage
        if (combatSystem) {
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

  useFrame((_, delta) => {
    if (globalThrowSpearProjectiles.length === 0) {
      if (lastActiveCount.current !== 0) {
        lastActiveCount.current = 0;
        setProjectiles([]);
      }
      playerEntityCache.current = null;
      return;
    }

    const currentTime = performance.now();
    let changed = false;

    // Resolve player once per frame for all spears
    let playerEntity = playerEntityCache.current;
    if (!playerEntity || !playerEntity.userData?.isPlayer) {
      playerEntity = world.getAllEntities().find((e: any) => e.userData?.isPlayer) ?? null;
      playerEntityCache.current = playerEntity;
    }
    let playerPosition: Vector3 | null = null;
    if (playerEntity) {
      const playerTransform = playerEntity.getComponent(Transform);
      if (playerTransform) playerPosition = playerTransform.position;
    }

    for (let i = globalThrowSpearProjectiles.length - 1; i >= 0; i--) {
      const projectile = globalThrowSpearProjectiles[i];
      const minSpeed = 16;
      const maxSpeed = 42;
      const speed = minSpeed + (maxSpeed - minSpeed) * (projectile.chargeTime / 2.0);
      const returnSpeed = speed * 1.1;

      if (!projectile.active) {
        swapRemoveProjectile(i);
        changed = true;
        continue;
      }

      if (projectile.fadeStartTime) {
        const fadeElapsed = (currentTime - projectile.fadeStartTime) / 1000;
        const fadeDuration = 0.3;
        projectile.opacity = Math.max(0, 1 - (fadeElapsed / fadeDuration));
        if (projectile.opacity <= 0) {
          projectile.active = false;
          swapRemoveProjectile(i);
          changed = true;
          continue;
        }
      }

      if (!projectile.isReturning) {
        const distanceFromStart = projectile.position.distanceTo(projectile.startPosition);
        if (distanceFromStart < projectile.maxDistance && !projectile.fadeStartTime) {
          projectile.position.add(_scratchMovement.copy(projectile.direction).multiplyScalar(speed * delta));
          applyDungeonChestY(projectile.position);
          checkCollisions(projectile, playerEntity);
        } else if (!projectile.fadeStartTime) {
          projectile.isReturning = true;
          if (playerPosition) {
            projectile.direction.copy(
              _scratchReturnDir.subVectors(playerPosition, projectile.position).normalize(),
            );
          }
        }
      } else {
        if (playerPosition) {
          const distanceToPlayer = projectile.position.distanceTo(playerPosition);
          if (distanceToPlayer > 1.5 && !projectile.fadeStartTime) {
            projectile.direction.copy(
              _scratchReturnDir.subVectors(playerPosition, projectile.position).normalize(),
            );
            projectile.position.add(_scratchMovement.copy(projectile.direction).multiplyScalar(returnSpeed * delta));
            applyDungeonChestY(projectile.position);
            checkCollisions(projectile, playerEntity);
          } else if (!projectile.fadeStartTime) {
            projectile.fadeStartTime = currentTime;
          }
        } else if (!projectile.fadeStartTime) {
          projectile.fadeStartTime = currentTime;
        }
      }
    }

    // Sync React state only when projectiles arrive/depart — movement/fade mutate refs in place.
    const activeCount = globalThrowSpearProjectiles.length;
    if (changed || activeCount !== lastActiveCount.current) {
      lastActiveCount.current = activeCount;
      setProjectiles(globalThrowSpearProjectiles.slice());
    }
  });

  return <ThrowSpear activeProjectiles={projectiles} />;
}
