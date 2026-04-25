import { useCallback, useRef, useEffect } from 'react';
import { Vector3, Group } from 'three';
import { WeaponType } from '@/components/dragon/weapons';
import { calculateDamage } from '@/core/DamageCalculator';
import {
  WRATHFUL_TALONS_RETURN_CRIT_CHANCE_ADD,
  WRATHFUL_TALONS_RETURN_CRIT_DAMAGE_MULT_ADD,
  REAPING_TALONS_MAX_TRAVEL_DISTANCE,
  EXPLOSIVE_TALONS_REAPING_TALONS_MAX_TRAVEL_DISTANCE,
  EXPLOSIVE_TALONS_EXPLOSION_DAMAGE,
  EXPLOSIVE_TALONS_EXPLOSION_RADIUS,
} from '@/utils/talents';

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
  casterId?: string; // For PVP: remember which player cast this projectile
  casterPosition?: Vector3; // For PVP: remember the caster's position for return
  /** Set at spawn: local caster with Wrathful Talons talent (remote spawns omit). */
  wrathfulTalonsReturnCrit?: boolean;
  /** EXPLOSIVE TALONS: no return; detonate at max range (from local prop or remote opts). */
  explosiveTalons?: boolean;
  /** PVP: player AoE from OptimizedPVPViperStingManager applied once per cast. */
  explosiveTalonsPvpAoEDone?: boolean;
  /** EXECUTE: after first forward hit resolution (consume attempt once per cast). */
  forwardExecuteResolved: boolean;
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
  onHit: (targetId: string, damage: number, isCritical?: boolean) => void;
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
  localSocketId?: string; // Add this to properly identify local player
  players?: Array<{ // For PVP dynamic targeting
    id: string;
    position: { x: number; y: number; z: number };
    health: number;
  }>;
  /** Local Reaping Talons: return-arrow preset crit (stored on projectile at spawn). */
  wrathfulTalonsReturnCrit?: boolean;
  /** EXPLOSIVE TALONS: forward-only + end-of-range explosion (local prop; remote via spawn opts). */
  explosiveTalons?: boolean;
  /** EXECUTE talent: first forward hit only — return bonus damage to add (0 if no dash consumed). */
  onExecuteFirstForwardHit?: () => number;
  /** EXPLOSIVE TALONS: one-shot VFX at detonation center (max range). */
  onExplosiveTalonsDetonate?: (position: Vector3) => void;
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
  setCharges,
  localSocketId,
  players,
  wrathfulTalonsReturnCrit = false,
  explosiveTalons = false,
  onExecuteFirstForwardHit,
  onExplosiveTalonsDetonate,
}: UseViperStingProps) {
  const projectilePool = useRef<ViperStingProjectile[]>([]);
  const soulStealEffects = useRef<SoulStealEffect[]>([]);
  const lastShotTime = useRef(0);
  const nextProjectileId = useRef(0);
  const nextSoulStealId = useRef(0);
  
  const POOL_SIZE = 3;
  const SHOT_COOLDOWN = 2000; // 7 seconds
  const PROJECTILE_SPEED = 0.625; // Slightly faster than regular arrows
  const PROJECTILE_RETURN_SPEED = 0.525; // Slightly slower for return phase
  const DAMAGE = 91;
  const FADE_DURATION = 350;
  const SOUL_STEAL_DURATION = 1250; // 1.25 seconds to travel back

  // Initialize projectile pool
  useEffect(() => {
    projectilePool.current = Array(POOL_SIZE).fill(null).map((_, index) => ({
      id: index,
      position: new Vector3(),
      direction: new Vector3(),
      startPosition: new Vector3(),
      maxDistance: REAPING_TALONS_MAX_TRAVEL_DISTANCE,
      active: false,
      startTime: 0,
      hitEnemies: new Set(),
      opacity: 1,
      fadeStartTime: null,
      isReturning: false,
      returnHitEnemies: new Set(),
      wrathfulTalonsReturnCrit: false,
      explosiveTalons: false,
      explosiveTalonsPvpAoEDone: false,
      forwardExecuteResolved: false,
    }));
  }, []);

  const getInactiveProjectile = useCallback(() => {
    return projectilePool.current.find(p => !p.active);
  }, []);

  const shootViperSting = useCallback((
    overridePosition?: Vector3,
    overrideDirection?: Vector3,
    casterId?: string,
    opts?: { explosiveTalons?: boolean },
  ) => {
    const now = Date.now();
    if (now - lastShotTime.current < SHOT_COOLDOWN) return false;

    // Use override parameters if provided (for PVP remote player effects)
    let unitPosition: Vector3;
    let direction: Vector3;
    
    if (overridePosition && overrideDirection) {
      // PVP mode: use provided position and direction from remote player
      unitPosition = overridePosition.clone();
      direction = overrideDirection.clone().normalize();
    } else {
      // Local mode: use parentRef
      if (!parentRef.current) return false;
      
      unitPosition = parentRef.current.position.clone();
      unitPosition.y += 0; // Shoot from chest level

      direction = new Vector3(0, 0, 1);
      // Check if quaternion exists and is a proper Three.js Quaternion
      if (parentRef.current.quaternion && typeof parentRef.current.quaternion.x === 'number') {
        direction.applyQuaternion(parentRef.current.quaternion);
      } else {
        // Fallback: use forward direction (for PVP mode where we don't have proper quaternion)
        direction.set(0, 0, 1);
      }
    }

    const projectile = getInactiveProjectile();
    if (!projectile) return false;

    lastShotTime.current = now;

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

    // Set caster information for PVP return targeting
    projectile.casterId = casterId || localSocketId;
    projectile.casterPosition = unitPosition.clone();
    const isRemoteSpawn = !!(overridePosition && overrideDirection);
    projectile.wrathfulTalonsReturnCrit = !isRemoteSpawn && wrathfulTalonsReturnCrit;
    projectile.explosiveTalons = isRemoteSpawn ? !!opts?.explosiveTalons : explosiveTalons;
    projectile.explosiveTalonsPvpAoEDone = false;
    projectile.forwardExecuteResolved = false;
    projectile.maxDistance = projectile.explosiveTalons
      ? EXPLOSIVE_TALONS_REAPING_TALONS_MAX_TRAVEL_DISTANCE
      : REAPING_TALONS_MAX_TRAVEL_DISTANCE;

    // Create beam effect for forward shot
    if (createBeamEffect) {
      createBeamEffect(unitPosition, direction, false);
    }

    return true;
  }, [createBeamEffect, parentRef, getInactiveProjectile, charges, setCharges, wrathfulTalonsReturnCrit, explosiveTalons, localSocketId]);

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

              // CRITICAL: Prevent self-damage in PVP
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

                let forwardDamage = DAMAGE;
                if (!projectile.forwardExecuteResolved && onExecuteFirstForwardHit) {
                  const bonus = onExecuteFirstForwardHit();
                  projectile.forwardExecuteResolved = true;
                  forwardDamage = DAMAGE + bonus;
                }

                // Apply damage through the onHit callback (which routes to CombatSystem)
                onHit(enemy.id, forwardDamage);

                // Apply DoT effect
                if (applyDoT) {
                  applyDoT(enemy.id);
                }

                // Create damage number for visual feedback (like Sword weapon does)
                if (setDamageNumbers && nextDamageNumberId) {
                  setDamageNumbers(prev => [...prev, {
                    id: nextDamageNumberId.current++,
                    damage: forwardDamage,
                    position: enemy.position.clone(),
                    isCritical: false,
                    isViperSting: true // Flag for Viper Sting specific styling
                  }]);
                }

                // Create soul steal effect at enemy position
                createSoulStealEffect(enemy.position);
              }
            }
          } else if (!projectile.fadeStartTime) {
            if (projectile.explosiveTalons) {
              const cx = projectile.position.x;
              const cz = projectile.position.z;
              if (onExplosiveTalonsDetonate) {
                onExplosiveTalonsDetonate(projectile.position.clone());
              }
              for (const enemy of enemyData) {
                if (enemy.isDying || enemy.health <= 0) continue;
                if (localSocketId && enemy.id === localSocketId) continue;

                const horiz = Math.hypot(enemy.position.x - cx, enemy.position.z - cz);
                if (horiz > EXPLOSIVE_TALONS_EXPLOSION_RADIUS) continue;

                onHit(enemy.id, EXPLOSIVE_TALONS_EXPLOSION_DAMAGE);
                if (applyDoT) {
                  applyDoT(enemy.id);
                }
                if (setDamageNumbers && nextDamageNumberId) {
                  setDamageNumbers(prev => [...prev, {
                    id: nextDamageNumberId.current++,
                    damage: EXPLOSIVE_TALONS_EXPLOSION_DAMAGE,
                    position: enemy.position.clone(),
                    isCritical: false,
                    isViperSting: true,
                  }]);
                }
                createSoulStealEffect(enemy.position);
              }
              projectile.fadeStartTime = now;
            } else {
              // Switch to return mode when max distance reached
              projectile.isReturning = true;
              projectile.direction = new Vector3().subVectors(projectile.startPosition, projectile.position).normalize();

              if (createBeamEffect) {
                createBeamEffect(projectile.position, projectile.direction, true);
              }
            }
          }
        } else {
          // Return movement phase - dynamically follow caster's current position

          // Determine the current target position based on caster
          let returnTargetPosition: Vector3;

          if (projectile.casterId === localSocketId) {
            // Local player projectile - use current local position
            if (!parentRef.current) return;
            returnTargetPosition = parentRef.current.position.clone();
          } else if (projectile.casterId && players) {
            // Remote player projectile - find caster in players array
            const casterPlayer = players.find(p => p.id === projectile.casterId);
            if (casterPlayer) {
              returnTargetPosition = new Vector3(
                casterPlayer.position.x,
                casterPlayer.position.y,
                casterPlayer.position.z
              );
            } else {
              // Fallback to stored caster position if player not found
              returnTargetPosition = projectile.casterPosition || projectile.startPosition.clone();
            }
          } else {
            // Fallback for non-PVP or missing data
            returnTargetPosition = projectile.casterPosition || projectile.startPosition.clone();
          }

          returnTargetPosition.y += 0; // Match the chest level used for launching

          const distanceToTarget = projectile.position.distanceTo(returnTargetPosition);

          if (distanceToTarget > 1.5 && !projectile.fadeStartTime) {
            // Update direction toward caster's current position (dynamic following)
            projectile.direction = new Vector3().subVectors(returnTargetPosition, projectile.position).normalize();

            // Move projectile back toward caster's current position
            projectile.position.add(
              projectile.direction.clone().multiplyScalar(PROJECTILE_RETURN_SPEED)
            );

            // Check for enemy collisions during return phase (allow hitting different enemies)
            for (const enemy of enemyData) {
              if (enemy.isDying || enemy.health <= 0) continue;
              // Use separate hit tracking for return phase
              if (projectile.returnHitEnemies.has(enemy.id)) continue;

              // CRITICAL: Prevent self-damage in PVP
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

                let returnDamage = DAMAGE;
                let returnIsCritical: boolean | undefined = undefined;
                if (projectile.wrathfulTalonsReturnCrit) {
                  const r = calculateDamage(DAMAGE, WeaponType.BOW, {
                    critChanceAdd: WRATHFUL_TALONS_RETURN_CRIT_CHANCE_ADD,
                    critDamageMultAdd: WRATHFUL_TALONS_RETURN_CRIT_DAMAGE_MULT_ADD,
                  });
                  returnDamage = r.damage;
                  returnIsCritical = r.isCritical;
                }

                onHit(enemy.id, returnDamage, returnIsCritical);

                // Apply DoT effect for return shot as well
                if (applyDoT) {
                  applyDoT(enemy.id);
                }

                // Create damage number for visual feedback (like Sword weapon does)
                if (setDamageNumbers && nextDamageNumberId) {
                  setDamageNumbers(prev => [...prev, {
                    id: nextDamageNumberId.current++,
                    damage: returnDamage,
                    position: enemy.position.clone(),
                    isCritical: !!returnIsCritical,
                    isViperSting: true // Flag for Viper Sting specific styling
                  }]);
                }

                // Create soul steal effect at enemy position
                createSoulStealEffect(enemy.position);
              }
            }
          } else if (!projectile.fadeStartTime) {
            // Start fading when projectile reaches caster's current position
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
  }, [enemyData, onHit, setDamageNumbers, nextDamageNumberId, onHealthChange, createSoulStealEffect, parentRef, createBeamEffect, applyDoT, localSocketId, players, onExecuteFirstForwardHit, onExplosiveTalonsDetonate]);

  return {
    shootViperSting,
    projectilePool,
    soulStealEffects,
    createSoulStealEffect
  };
}
