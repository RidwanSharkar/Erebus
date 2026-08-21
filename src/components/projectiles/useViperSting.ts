import { useCallback, useRef, useEffect, useState } from 'react';
import { Vector3, Group } from 'three';
import { WeaponType } from '@/components/dragon/weapons';
import { calculateDamage } from '@/core/DamageCalculator';
import {
  WRATHFUL_TALONS_RETURN_CRIT_CHANCE_ADD,
  WRATHFUL_TALONS_RETURN_CRIT_DAMAGE_MULT_ADD,
  WRATHFUL_TALONS_EXPLOSION_CRIT_CHANCE_ADD,
  REAPING_TALONS_MAX_TRAVEL_DISTANCE,
  EXPLOSIVE_TALONS_REAPING_TALONS_MAX_TRAVEL_DISTANCE,
  EXPLOSIVE_TALONS_EXPLOSION_DAMAGE,
  EXPLOSIVE_TALONS_EXPLOSION_RADIUS,
  GIANTKILLER_MAX_HP_DAMAGE_FRAC,
  GIANTKILLER_MAX_HP_DAMAGE_FRAC_BOSS,
} from '@/utils/talents';
import { spawnArcticGroundBlizzardAtFromReact } from '@/components/weapons/Blizzard/arcticBlizzardSpawnBridge';
import { applyDungeonChestY } from '@/utils/dungeonLayout';
import type { ViperExplosionTarget } from './viperExplosionTargets';

/** Reaping Talons base hit damage (forward / return). Keep in sync with PVP manager. */
export const REAPING_TALONS_BASE_DAMAGE = 91;

const VIPER_ENEMY_HIT_RADIUS = 1.3;

export type ViperFlightTarget = {
  id: string;
  position: Vector3;
  health: number;
  maxHealth?: number;
  isBoss?: boolean;
  isDying?: boolean;
  /** Harvest collider radius; omitted for enemies (uses VIPER_ENEMY_HIT_RADIUS only). */
  radius?: number;
};
const _viperReturnDir = new Vector3();

function viperFlightHitsTarget(projX: number, projZ: number, target: ViperFlightTarget): boolean {
  const hitR = VIPER_ENEMY_HIT_RADIUS + (target.radius ?? 0);
  const dx = projX - target.position.x;
  const dz = projZ - target.position.z;
  return dx * dx + dz * dz < hitR * hitR;
}

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
  casterId?: string;
  casterPosition?: Vector3;
  wrathfulTalonsReturnCrit?: boolean;
  wrathfulTalonsExplosionCrit?: boolean;
  explosiveTalons?: boolean;
  explosiveTalonsPvpAoEDone?: boolean;
  forwardExecuteResolved: boolean;
  glacialBlizzardSpawned?: boolean;
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
  onHit: (
    targetId: string,
    damage: number,
    isCritical?: boolean,
    position?: Vector3,
    isBlizzard?: boolean,
    viperPhase?: 'forward' | 'return' | 'explosion',
  ) => void;
  enemyData: ViperFlightTarget[];
  harvestHittables?: ViperFlightTarget[];
  setDamageNumbers: React.Dispatch<React.SetStateAction<Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isViperSting?: boolean;
  }>>>;
  nextDamageNumberId: React.MutableRefObject<number>;
  onHealthChange?: (deltaHealth: number) => void;
  createBeamEffect?: (
    position: Vector3,
    direction: Vector3,
    isReturning?: boolean,
    beamLength?: number,
    glacialTalonsTheme?: boolean,
  ) => void;
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
  localSocketId?: string;
  players?: Array<{
    id: string;
    position: { x: number; y: number; z: number };
    health: number;
  }>;
  wrathfulTalonsReturnCrit?: boolean;
  wrathfulTalonsExplosionCrit?: boolean;
  explosiveTalons?: boolean;
  onExecuteFirstForwardHit?: () => number;
  giantKiller?: boolean;
  glacialTalonsTheme?: boolean;
  onExplosiveTalonsDetonate?: (position: Vector3) => void;
  /** Live ECS AoE query for Explosive Talons detonation (co-op). */
  queryExplosionTargets?: (cx: number, cz: number, radius: number) => ViperExplosionTarget[];
  /** Sniper Terminal Velocity — flat bonus when horizontal shot-origin→target distance > 10. */
  getTerminalVelocityBonus?: (horizontalDistance: number) => number;
}

export function useViperSting({
  parentRef,
  onHit,
  enemyData,
  harvestHittables = [],
  setDamageNumbers: _setDamageNumbers,
  nextDamageNumberId: _nextDamageNumberId,
  onHealthChange: _onHealthChange,
  createBeamEffect,
  applyDoT,
  charges,
  setCharges,
  localSocketId,
  players,
  wrathfulTalonsReturnCrit = false,
  wrathfulTalonsExplosionCrit = false,
  explosiveTalons = false,
  onExecuteFirstForwardHit,
  giantKiller = false,
  glacialTalonsTheme = false,
  onExplosiveTalonsDetonate,
  queryExplosionTargets,
  getTerminalVelocityBonus,
}: UseViperStingProps) {
  const projectilePool = useRef<ViperStingProjectile[]>([]);
  const [soulStealEffects, setSoulStealEffects] = useState<SoulStealEffect[]>([]);
  const lastShotTime = useRef(0);
  const nextProjectileId = useRef(0);
  const nextSoulStealId = useRef(0);

  const POOL_SIZE = 3;
  const SHOT_COOLDOWN = 2000;
  const PROJECTILE_SPEED = 0.9375;
  const PROJECTILE_RETURN_SPEED = 0.7875;
  const DAMAGE = REAPING_TALONS_BASE_DAMAGE;
  const FADE_DURATION = 350;
  const SOUL_STEAL_DURATION = 1250;

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
      wrathfulTalonsExplosionCrit: false,
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

    let unitPosition: Vector3;
    let direction: Vector3;

    if (overridePosition && overrideDirection) {
      unitPosition = overridePosition.clone();
      direction = overrideDirection.clone().normalize();
    } else {
      if (!parentRef.current) return false;

      unitPosition = parentRef.current.position.clone();
      unitPosition.y += 0;

      direction = new Vector3(0, 0, 1);
      if (parentRef.current.quaternion && typeof parentRef.current.quaternion.x === 'number') {
        direction.applyQuaternion(parentRef.current.quaternion);
      } else {
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

    projectile.casterId = casterId || localSocketId;
    projectile.casterPosition = unitPosition.clone();
    const isRemoteSpawn = !!(overridePosition && overrideDirection);
    projectile.wrathfulTalonsReturnCrit = !isRemoteSpawn && wrathfulTalonsReturnCrit;
    projectile.wrathfulTalonsExplosionCrit = !isRemoteSpawn && wrathfulTalonsExplosionCrit;
    projectile.explosiveTalons = isRemoteSpawn ? !!opts?.explosiveTalons : explosiveTalons;
    projectile.explosiveTalonsPvpAoEDone = false;
    projectile.forwardExecuteResolved = false;
    projectile.glacialBlizzardSpawned = false;
    projectile.maxDistance = projectile.explosiveTalons
      ? EXPLOSIVE_TALONS_REAPING_TALONS_MAX_TRAVEL_DISTANCE
      : REAPING_TALONS_MAX_TRAVEL_DISTANCE;

    if (createBeamEffect) {
      createBeamEffect(unitPosition, direction, false, projectile.maxDistance, glacialTalonsTheme);
    }

    return true;
  }, [createBeamEffect, parentRef, getInactiveProjectile, charges, setCharges, wrathfulTalonsReturnCrit, wrathfulTalonsExplosionCrit, explosiveTalons, glacialTalonsTheme, localSocketId]);

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

    setSoulStealEffects((prev) => [...prev, soulSteal]);
  }, [parentRef]);

  const removeSoulStealEffect = useCallback((id: number) => {
    setSoulStealEffects((prev) => prev.filter((e) => e.id !== id));
  }, []);

  useEffect(() => {
    let animationFrameId: number;

    const updateProjectilesAndEffects = () => {
      const now = Date.now();
      const flightTargets = harvestHittables.length > 0
        ? enemyData.concat(harvestHittables)
        : enemyData;

      projectilePool.current.forEach(projectile => {
        if (!projectile.active) return;

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
          const distanceTraveled = projectile.position.distanceTo(projectile.startPosition);

          if (distanceTraveled < projectile.maxDistance && !projectile.fadeStartTime) {
            projectile.position.addScaledVector(projectile.direction, PROJECTILE_SPEED);
            applyDungeonChestY(projectile.position);

            for (const enemy of flightTargets) {
              if (enemy.isDying || enemy.health <= 0) continue;
              if (projectile.hitEnemies.has(enemy.id)) continue;
              if (localSocketId && enemy.id === localSocketId) continue;

              if (viperFlightHitsTarget(projectile.position.x, projectile.position.z, enemy)) {
                projectile.hitEnemies.add(enemy.id);

                if (glacialTalonsTheme && !projectile.glacialBlizzardSpawned) {
                  projectile.glacialBlizzardSpawned = true;
                  const bp = enemy.position.clone();
                  bp.y = Math.max(1.5, bp.y);
                  spawnArcticGroundBlizzardAtFromReact(bp);
                }

                let forwardDamage = DAMAGE;
                if (!projectile.forwardExecuteResolved && onExecuteFirstForwardHit) {
                  const bonus = onExecuteFirstForwardHit();
                  projectile.forwardExecuteResolved = true;
                  forwardDamage = DAMAGE + bonus;
                }

                if (getTerminalVelocityBonus) {
                  const horiz = Math.hypot(
                    enemy.position.x - projectile.startPosition.x,
                    enemy.position.z - projectile.startPosition.z,
                  );
                  forwardDamage += getTerminalVelocityBonus(horiz);
                }

                onHit(enemy.id, forwardDamage, undefined, undefined, undefined, 'forward');

                if (applyDoT) {
                  applyDoT(enemy.id);
                }

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

              const explosionTargets = queryExplosionTargets
                ? queryExplosionTargets(cx, cz, EXPLOSIVE_TALONS_EXPLOSION_RADIUS)
                : enemyData.filter((enemy) => {
                    if (enemy.isDying || enemy.health <= 0) return false;
                    if (localSocketId && enemy.id === localSocketId) return false;
                    return Math.hypot(enemy.position.x - cx, enemy.position.z - cz) <= EXPLOSIVE_TALONS_EXPLOSION_RADIUS;
                  });

              for (const enemy of explosionTargets) {
                if (localSocketId && enemy.id === localSocketId) continue;
                if (
                  projectile.hitEnemies.has(enemy.id) &&
                  harvestHittables.some((h) => h.id === enemy.id)
                ) {
                  continue;
                }

                let explosionDamage = EXPLOSIVE_TALONS_EXPLOSION_DAMAGE;
                let explosionIsCritical: boolean | undefined = undefined;
                if (projectile.wrathfulTalonsExplosionCrit) {
                  const r = calculateDamage(EXPLOSIVE_TALONS_EXPLOSION_DAMAGE, WeaponType.BOW, {
                    critChanceAdd: WRATHFUL_TALONS_EXPLOSION_CRIT_CHANCE_ADD,
                  });
                  explosionDamage = r.damage;
                  explosionIsCritical = r.isCritical;
                }

                onHit(enemy.id, explosionDamage, explosionIsCritical, undefined, undefined, 'explosion');
                if (applyDoT) {
                  applyDoT(enemy.id);
                }
                createSoulStealEffect(enemy.position);
              }
              projectile.fadeStartTime = now;
            } else {
              projectile.isReturning = true;
              projectile.direction = new Vector3().subVectors(projectile.startPosition, projectile.position).normalize();

              if (createBeamEffect) {
                createBeamEffect(projectile.position, projectile.direction, true, projectile.maxDistance, glacialTalonsTheme);
              }
            }
          }
        } else {
          let returnTargetPosition: Vector3;

          if (projectile.casterId === localSocketId) {
            if (!parentRef.current) return;
            returnTargetPosition = parentRef.current.position.clone();
          } else if (projectile.casterId && players) {
            const casterPlayer = players.find(p => p.id === projectile.casterId);
            if (casterPlayer) {
              returnTargetPosition = new Vector3(
                casterPlayer.position.x,
                casterPlayer.position.y,
                casterPlayer.position.z
              );
            } else {
              returnTargetPosition = projectile.casterPosition || projectile.startPosition.clone();
            }
          } else {
            returnTargetPosition = projectile.casterPosition || projectile.startPosition.clone();
          }

          returnTargetPosition.y += 0;

          const distanceToTarget = projectile.position.distanceTo(returnTargetPosition);

          if (distanceToTarget > 1.5 && !projectile.fadeStartTime) {
            projectile.direction.copy(_viperReturnDir.subVectors(returnTargetPosition, projectile.position).normalize());
            projectile.position.addScaledVector(projectile.direction, PROJECTILE_RETURN_SPEED);
            applyDungeonChestY(projectile.position);

            for (const enemy of flightTargets) {
              if (enemy.isDying || enemy.health <= 0) continue;
              if (projectile.returnHitEnemies.has(enemy.id)) continue;
              if (localSocketId && enemy.id === localSocketId) continue;

              if (viperFlightHitsTarget(projectile.position.x, projectile.position.z, enemy)) {
                projectile.returnHitEnemies.add(enemy.id);

                let returnBase = DAMAGE;
                if (getTerminalVelocityBonus) {
                  const horiz = Math.hypot(
                    enemy.position.x - projectile.startPosition.x,
                    enemy.position.z - projectile.startPosition.z,
                  );
                  returnBase += getTerminalVelocityBonus(horiz);
                }

                let returnDamage = returnBase;
                let returnIsCritical: boolean | undefined = undefined;
                if (projectile.wrathfulTalonsReturnCrit) {
                  const r = calculateDamage(returnBase, WeaponType.BOW, {
                    critChanceAdd: WRATHFUL_TALONS_RETURN_CRIT_CHANCE_ADD,
                    critDamageMultAdd: WRATHFUL_TALONS_RETURN_CRIT_DAMAGE_MULT_ADD,
                  });
                  returnDamage = r.damage;
                  returnIsCritical = r.isCritical;
                }

                if (
                  giantKiller &&
                  projectile.hitEnemies.has(enemy.id) &&
                  typeof enemy.maxHealth === 'number' &&
                  enemy.maxHealth > 0
                ) {
                  const frac = enemy.isBoss
                    ? GIANTKILLER_MAX_HP_DAMAGE_FRAC_BOSS
                    : GIANTKILLER_MAX_HP_DAMAGE_FRAC;
                  returnDamage += Math.floor(enemy.maxHealth * frac);
                }

                onHit(enemy.id, returnDamage, returnIsCritical, undefined, undefined, 'return');

                if (applyDoT) {
                  applyDoT(enemy.id);
                }

                createSoulStealEffect(enemy.position);
              }
            }
          } else if (!projectile.fadeStartTime) {
            projectile.fadeStartTime = now;
          }
        }
      });

      if (projectilePool.current.some(p => p.active)) {
        animationFrameId = requestAnimationFrame(updateProjectilesAndEffects);
      }
    };

    animationFrameId = requestAnimationFrame(updateProjectilesAndEffects);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [enemyData, harvestHittables, onHit, createSoulStealEffect, parentRef, createBeamEffect, applyDoT, localSocketId, players, onExecuteFirstForwardHit, giantKiller, glacialTalonsTheme, onExplosiveTalonsDetonate, queryExplosionTargets, getTerminalVelocityBonus]);

  return {
    shootViperSting,
    projectilePool,
    soulStealEffects,
    createSoulStealEffect,
    removeSoulStealEffect,
  };
}
