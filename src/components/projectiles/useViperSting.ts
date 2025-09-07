import { useCallback, useRef, useEffect } from 'react';
import { Vector3, Group } from 'three';

interface ViperStingProjectile {
  id: number;
  position: Vector3;
  direction: Vector3;
  startPosition: Vector3;
  maxDistance: number;
  active: boolean;
  startTime: number;
  hitEnemies: Set<string>;
  opacity: number;
  fadeStartTime: number | null;
  isReturning: boolean;
  returnHitEnemies: Set<string>;
}

interface SoulStealEffect {
  id: number;
  position: Vector3;
  targetPosition: Vector3;
  startTime: number;
  duration: number;
  active: boolean;
}

interface UseViperStingProps {
  parentRef: React.RefObject<Group>;
  onHit: (targetId: string, damage: number) => void;
  enemyData: Array<{
    id: string;
    position: Vector3;
    health: number;
    isDying?: boolean;
  }>;
  setDamageNumbers: React.Dispatch<React.SetStateAction<Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isViperSting?: boolean;
  }>>>;
  nextDamageNumberId: React.MutableRefObject<number>;
  onHealthChange?: (deltaHealth: number) => void;
  createBeamEffect?: (position: Vector3, direction: Vector3, isReturning?: boolean) => void;
  applyDoT?: (enemyId: string) => void;
  charges: Array<{
    id: number;
    available: boolean;
    cooldownStartTime: number | null;
  }>;
  setCharges: React.Dispatch<React.SetStateAction<Array<{
    id: number;
    available: boolean;
    cooldownStartTime: number | null;
  }>>>;
}

export function useViperSting({
  parentRef,
  onHit,
  enemyData,
  setDamageNumbers,
  nextDamageNumberId,
  onHealthChange,
  createBeamEffect,
  applyDoT,
  charges,
  setCharges
}: UseViperStingProps) {
  const projectilePool = useRef<ViperStingProjectile[]>([]);
  const soulStealEffects = useRef<SoulStealEffect[]>([]);
  const lastShotTime = useRef(0);
  const nextProjectileId = useRef(0);
  const nextSoulStealId = useRef(0);
  
  const POOL_SIZE = 3;
  const SHOT_COOLDOWN = 2000; // 7 seconds
  const PROJECTILE_SPEED = 0.625; // Slightly faster than regular arrows
  const DAMAGE = 61;
  const MAX_DISTANCE = 20; // Reduced max distance for return mechanic
  const FADE_DURATION = 350;
  const SOUL_STEAL_DURATION = 1250; // 1.25 seconds to travel back

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
      hitEnemies: new Set(),
      opacity: 1,
      fadeStartTime: null,
      isReturning: false,
      returnHitEnemies: new Set()
    }));
  }, []);

  const getInactiveProjectile = useCallback(() => {
    return projectilePool.current.find(p => !p.active);
  }, []);

  const shootViperSting = useCallback(() => {
    const now = Date.now();
    if (now - lastShotTime.current < SHOT_COOLDOWN) return false;

    if (!parentRef.current) return false;


    const projectile = getInactiveProjectile();
    if (!projectile) return false;




    lastShotTime.current = now;

    const unitPosition = parentRef.current.position.clone();
    unitPosition.y += 0; // Shoot from chest level

    const direction = new Vector3(0, 0, 1);
    // Check if quaternion exists and is a proper Three.js Quaternion
    if (parentRef.current.quaternion && typeof parentRef.current.quaternion.x === 'number') {
      direction.applyQuaternion(parentRef.current.quaternion);
    } else {
      // Fallback: use forward direction (for PVP mode where we don't have proper quaternion)
      direction.set(0, 0, 1);
    }

    projectile.position.copy(unitPosition);
    projectile.direction.copy(direction);
    projectile.startPosition.copy(unitPosition);
    projectile.startTime = now;
    projectile.active = true;
    projectile.hitEnemies.clear();
    projectile.returnHitEnemies.clear();
    projectile.opacity = 1;
    projectile.fadeStartTime = null;
    projectile.isReturning = false;
    projectile.id = nextProjectileId.current++;

    // Create beam effect for forward shot
    if (createBeamEffect) {
      createBeamEffect(unitPosition, direction, false);
    }

    return true;
  }, [createBeamEffect, parentRef, getInactiveProjectile, charges, setCharges]);

  const createSoulStealEffect = useCallback((enemyPosition: Vector3) => {
    if (!parentRef.current) return;

    const soulSteal: SoulStealEffect = {
      id: nextSoulStealId.current++,
      position: enemyPosition.clone(),
      targetPosition: parentRef.current.position.clone(),
      startTime: Date.now(),
      duration: SOUL_STEAL_DURATION,
      active: true
    };

    soulStealEffects.current.push(soulSteal);
    // Note: No need for setActiveEffects since SoulStealEffect components handle rendering
  }, [parentRef]);

  // Update projectiles and effects
  useEffect(() => {
    let animationFrameId: number;

    const updateProjectilesAndEffects = () => {
      const now = Date.now();

      // Update projectiles
      projectilePool.current.forEach(projectile => {
        if (!projectile.active) return;

        // Handle fading
        if (projectile.fadeStartTime) {
          const fadeElapsed = now - projectile.fadeStartTime;
          const fadeProgress = fadeElapsed / FADE_DURATION;
          projectile.opacity = Math.max(0, 1 - fadeProgress);
          
          if (fadeProgress >= 1) {
            projectile.active = false;
            return;
          }
        }

        if (!projectile.isReturning) {
          // Forward movement phase
          const distanceTraveled = projectile.position.distanceTo(projectile.startPosition);
          
          if (distanceTraveled < projectile.maxDistance && !projectile.fadeStartTime) {
            // Move projectile forward
            projectile.position.add(
              projectile.direction.clone().multiplyScalar(PROJECTILE_SPEED)
            );

            // Check for enemy collisions during forward phase
            for (const enemy of enemyData) {
              if (enemy.isDying || enemy.health <= 0) continue;
              if (projectile.hitEnemies.has(enemy.id)) continue;

              // CRITICAL: Get the local socket ID to prevent self-damage in PVP
              const localSocketId = (window as any).localSocketId;
              
              // NEVER hit yourself - this is the critical fix for self-damage
              if (localSocketId && enemy.id === localSocketId) {
                continue; // Skip local player completely
              }

              const projectilePos2D = new Vector3(
                projectile.position.x,
                0,
                projectile.position.z
              );
              const enemyPos2D = new Vector3(
                enemy.position.x,
                0,
                enemy.position.z
              );
              
              if (projectilePos2D.distanceTo(enemyPos2D) < 1.3) {
                // Mark enemy as hit during forward phase
                projectile.hitEnemies.add(enemy.id);
                
                // Apply damage - but double-check we're not hitting ourselves
                if (enemy.id !== localSocketId) {
                  onHit(enemy.id, DAMAGE);
                  
                  // Apply DoT effect
                  if (applyDoT) {
                    applyDoT(enemy.id);
                  }
                  
                  // Add damage number
                  setDamageNumbers(prev => [...prev, {
                    id: nextDamageNumberId.current++,
                    damage: DAMAGE,
                    position: enemy.position.clone(),
                    isCritical: false,
                    isViperSting: true
                  }]);

                  // Create soul steal effect at enemy position
                  createSoulStealEffect(enemy.position);
                }
              }
            }
          } else if (!projectile.fadeStartTime) {
            // Switch to return mode when max distance reached
            projectile.isReturning = true;
            // Reverse direction to point back toward start position
            projectile.direction = new Vector3().subVectors(projectile.startPosition, projectile.position).normalize();
            
            // Create beam effect for return shot
            if (createBeamEffect) {
              createBeamEffect(projectile.position, projectile.direction, true);
            }
          }
        } else {
          // Return movement phase
          if (!parentRef.current) return;
          
          const distanceToPlayer = projectile.position.distanceTo(projectile.startPosition);
          
          if (distanceToPlayer > 1.5 && !projectile.fadeStartTime) {
            // Move projectile back toward player
            projectile.position.add(
              projectile.direction.clone().multiplyScalar(PROJECTILE_SPEED)
            );

            // Check for enemy collisions during return phase (allow hitting different enemies)
            for (const enemy of enemyData) {
              if (enemy.isDying || enemy.health <= 0) continue;
              // Use separate hit tracking for return phase
              if (projectile.returnHitEnemies.has(enemy.id)) continue;

              // CRITICAL: Get the local socket ID to prevent self-damage in PVP
              const localSocketId = (window as any).localSocketId;
              
              // NEVER hit yourself - this is the critical fix for self-damage
              if (localSocketId && enemy.id === localSocketId) {
                continue; // Skip local player completely
              }

              const projectilePos2D = new Vector3(
                projectile.position.x,
                0,
                projectile.position.z
              );
              const enemyPos2D = new Vector3(
                enemy.position.x,
                0,
                enemy.position.z
              );
              
              if (projectilePos2D.distanceTo(enemyPos2D) < 1.3) {
                // Mark enemy as hit during return phase
                projectile.returnHitEnemies.add(enemy.id);
                
                // Apply damage again - but double-check we're not hitting ourselves
                if (enemy.id !== localSocketId) {
                  onHit(enemy.id, DAMAGE);
                  
                  // Apply DoT effect for return shot as well
                  if (applyDoT) {
                    applyDoT(enemy.id);
                  }
                  
                  // Add damage number
                  setDamageNumbers(prev => [...prev, {
                    id: nextDamageNumberId.current++,
                    damage: DAMAGE,
                    position: enemy.position.clone(),
                    isCritical: false,
                    isViperSting: true
                  }]);

                  // Create soul steal effect at enemy position
                  createSoulStealEffect(enemy.position);
                }
              }
            }
          } else if (!projectile.fadeStartTime) {
            // Start fading when projectile reaches player
            projectile.fadeStartTime = now;
          }
        }
      });

      // Soul steal effects are now handled by SoulStealEffect components
      // No need for duplicate movement logic here

      // Continue animation if there are active projectiles
      if (projectilePool.current.some(p => p.active)) {
        animationFrameId = requestAnimationFrame(updateProjectilesAndEffects);
      }
    };

    animationFrameId = requestAnimationFrame(updateProjectilesAndEffects);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [enemyData, onHit, setDamageNumbers, nextDamageNumberId, onHealthChange, createSoulStealEffect, parentRef, createBeamEffect, applyDoT]);

  return {
    shootViperSting,
    projectilePool,
    soulStealEffects
  };
}
