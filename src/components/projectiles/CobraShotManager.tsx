'use client';

import React, { useRef, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import CobraShot, { CobraShotProjectile } from './CobraShot';
import CobraShotBeam from './CobraShotBeam';
import VenomEffect from './VenomEffect';
import VenomEffectManager, { addGlobalVenomousEnemy } from './VenomEffectManager';
import { World } from '@/ecs/World';
import { Entity } from '@/ecs/Entity';
import { Enemy } from '@/ecs/components/Enemy';
import { Health } from '@/ecs/components/Health';
import { Transform } from '@/ecs/components/Transform';
import { CombatSystem } from '@/systems/CombatSystem';
import {
  COBRA_SHOT_HIT_DAMAGE,
  COBRA_SHOT_VENOM_DAMAGE_PER_SECOND,
  COBRA_SHOT_VENOM_DURATION_SEC,
  getWyvernStingVenomDamagePerSecond,
  shouldApplyWyvernStingTalent,
} from '@/utils/talents';

interface VenomEffectInstance {
  id: number;
  position: Vector3;
  startTime: number;
}

interface CobraShotBeamInstance {
  id: number;
  position: Vector3;
  direction: Vector3;
  startTime: number;
}

interface CobraShotManagerProps {
  world: World;
}

const POOL_SIZE = 3;
const PROJECTILE_SPEED = 1.0;
const MAX_DISTANCE = 20;
const FADE_DURATION = 1000;
const VENOM_DURATION = COBRA_SHOT_VENOM_DURATION_SEC;
const HIT_RADIUS = 1.5;
const HITSCAN_STEP = 0.5;
const ENEMY_CENTER_Y_OFFSET = 1.0;

// Global function to trigger cobra shot from ControlSystem
let globalCobraShotTrigger: ((position: Vector3, direction: Vector3) => void) | null = null;
let globalCobraShotProjectilePool: (() => CobraShotProjectile[]) | null = null;

export function triggerGlobalCobraShot(position: Vector3, direction: Vector3): void {
  if (globalCobraShotTrigger) {
    globalCobraShotTrigger(position, direction);
  }
}

export function getGlobalCobraShotProjectiles(): CobraShotProjectile[] {
  if (globalCobraShotProjectilePool) {
    return globalCobraShotProjectilePool();
  }
  return [];
}

function resolveSourcePlayerId(): string | undefined {
  const cs = (window as any).controlSystemRef?.current;
  const playerEntity = cs?.getPlayerEntity?.();
  return playerEntity?.userData?.playerId as string | undefined;
}

function resolveCobraVenomDamagePerSecond(): number {
  const cs = (window as any).controlSystemRef?.current;
  const loadout = cs?.getTalentLoadout?.() ?? cs?.talentLoadout;
  if (cs && shouldApplyWyvernStingTalent(loadout)) {
    const intellect = cs.getAllocatedPlayerStats?.()?.intellect ?? 0;
    return getWyvernStingVenomDamagePerSecond(intellect);
  }
  return COBRA_SHOT_VENOM_DAMAGE_PER_SECOND;
}

function resolveWyvernStingVenomZombie(): boolean {
  const cs = (window as any).controlSystemRef?.current;
  if (!cs) return false;
  return shouldApplyWyvernStingTalent(cs.getTalentLoadout?.() ?? cs.talentLoadout);
}

function horizontalDistanceXZ(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function isCobraHitCandidate(entity: Entity): boolean {
  const enemy = entity.getComponent(Enemy);
  const health = entity.getComponent(Health);
  const transform = entity.getComponent(Transform);
  if (!enemy || !health || !transform || health.isDead) return false;
  if (entity.userData?.isCoopAlliedUnit) return false;
  return true;
}

function getEnemyHitCenter(transform: Transform): Vector3 {
  const center = transform.getWorldPosition().clone();
  center.y += ENEMY_CENTER_Y_OFFSET;
  return center;
}

function probeHitsEnemy(probe: Vector3, entity: Entity): boolean {
  if (!isCobraHitCandidate(entity)) return false;
  const transform = entity.getComponent(Transform)!;
  const center = getEnemyHitCenter(transform);
  return horizontalDistanceXZ(probe, center) <= HIT_RADIUS;
}

export default function CobraShotManager({ world }: CobraShotManagerProps) {
  const projectilePool = useRef<CobraShotProjectile[]>([]);
  const venomEffects = useRef<VenomEffectInstance[]>([]);
  const beamEffects = useRef<CobraShotBeamInstance[]>([]);
  const nextVenomEffectId = useRef(0);
  const nextBeamEffectId = useRef(0);

  const createVenomEffect = useCallback((position: Vector3) => {
    const effect: VenomEffectInstance = {
      id: nextVenomEffectId.current++,
      position: position.clone(),
      startTime: Date.now(),
    };
    venomEffects.current.push(effect);
  }, []);

  const applyCobraShotHit = useCallback(
    (entity: Entity, hitEnemies?: Set<number>) => {
      if (hitEnemies?.has(entity.id)) return false;

      const enemy = entity.getComponent(Enemy);
      const health = entity.getComponent(Health);
      const transform = entity.getComponent(Transform);
      if (!enemy || !health || !transform || health.isDead) return false;

      const combatSystem = world.getSystem(CombatSystem);
      if (!combatSystem) return false;

      const sourcePlayerId = resolveSourcePlayerId();
      combatSystem.queueDamage(
        entity,
        COBRA_SHOT_HIT_DAMAGE,
        undefined,
        'cobra_shot',
        sourcePlayerId,
      );

      const currentGameTime = Date.now() / 1000;
      enemy.applyVenom(VENOM_DURATION, resolveCobraVenomDamagePerSecond(), currentGameTime);

      addGlobalVenomousEnemy(entity.id.toString(), transform.position);
      createVenomEffect(transform.position);

      hitEnemies?.add(entity.id);
      return true;
    },
    [world, createVenomEffect],
  );

  const findFirstCobraHitscanTarget = useCallback(
    (spawnPosition: Vector3, direction: Vector3): Entity | null => {
      const dir = direction.clone().normalize();
      const probe = new Vector3();
      const entities = world.getAllEntities();

      for (let dist = 0; dist <= MAX_DISTANCE; dist += HITSCAN_STEP) {
        probe.copy(spawnPosition).addScaledVector(dir, dist);
        for (const entity of entities) {
          if (probeHitsEnemy(probe, entity)) {
            return entity;
          }
        }
      }
      return null;
    },
    [world],
  );

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
    }));
  }, []);

  const getInactiveProjectile = useCallback(() => {
    return projectilePool.current.find(p => !p.active);
  }, []);

  const createBeamEffect = useCallback((position: Vector3, direction: Vector3) => {
    const beam: CobraShotBeamInstance = {
      id: nextBeamEffectId.current++,
      position: position.clone(),
      direction: direction.clone(),
      startTime: Date.now(),
    };
    beamEffects.current.push(beam);
  }, []);

  const removeVenomEffect = useCallback((id: number) => {
    venomEffects.current = venomEffects.current.filter(effect => effect.id !== id);
  }, []);

  const removeBeamEffect = useCallback((id: number) => {
    beamEffects.current = beamEffects.current.filter(beam => beam.id !== id);
  }, []);

  const tryProjectileFrameHit = useCallback(
    (projectile: CobraShotProjectile): boolean => {
      const probe = projectile.position;
      const entities = world.getAllEntities();

      for (const entity of entities) {
        if (projectile.hitEnemies.has(entity.id)) continue;
        if (!probeHitsEnemy(probe, entity)) continue;

        applyCobraShotHit(entity, projectile.hitEnemies);
        projectile.active = false;
        projectile.opacity = 1;
        projectile.fadeStartTime = null;
        return true;
      }
      return false;
    },
    [world, applyCobraShotHit],
  );

  const shootCobraShot = useCallback(
    (position: Vector3, direction: Vector3) => {
      const projectile = getInactiveProjectile();
      if (!projectile) {
        return;
      }

      const now = Date.now();
      const normDir = direction.clone().normalize();

      projectile.position.copy(position);
      projectile.direction.copy(normDir);
      projectile.startPosition.copy(position);
      projectile.active = true;
      projectile.startTime = now;
      projectile.hitEnemies.clear();
      projectile.opacity = 1;
      projectile.fadeStartTime = null;

      createBeamEffect(position, normDir);

      const hitTarget = findFirstCobraHitscanTarget(position, normDir);
      if (hitTarget) {
        applyCobraShotHit(hitTarget, projectile.hitEnemies);
        projectile.active = false;
        projectile.opacity = 1;
        projectile.fadeStartTime = null;
      }
    },
    [getInactiveProjectile, createBeamEffect, findFirstCobraHitscanTarget, applyCobraShotHit],
  );

  // Set up global trigger and projectile pool access
  useEffect(() => {
    globalCobraShotTrigger = shootCobraShot;
    globalCobraShotProjectilePool = () => projectilePool.current;
    return () => {
      globalCobraShotTrigger = null;
      globalCobraShotProjectilePool = null;
    };
  }, [shootCobraShot]);

  // Update projectiles and handle collisions
  useFrame(() => {
    const currentTime = Date.now();

    projectilePool.current.forEach(projectile => {
      if (!projectile.active) return;

      const movement = projectile.direction.clone().multiplyScalar(PROJECTILE_SPEED);
      projectile.position.add(movement);

      const distanceTraveled = projectile.position.distanceTo(projectile.startPosition);

      if (distanceTraveled > MAX_DISTANCE * 0.8 && !projectile.fadeStartTime) {
        projectile.fadeStartTime = currentTime;
      }

      if (projectile.fadeStartTime) {
        const fadeElapsed = currentTime - projectile.fadeStartTime;
        projectile.opacity = Math.max(0, 1 - (fadeElapsed / FADE_DURATION));

        if (projectile.opacity <= 0 || distanceTraveled > MAX_DISTANCE) {
          projectile.active = false;
          projectile.opacity = 1;
          projectile.fadeStartTime = null;
          return;
        }
      }

      if (tryProjectileFrameHit(projectile)) {
        return;
      }
    });

    const combatSystem = world.getSystem(CombatSystem);
    const sourcePlayerId = resolveSourcePlayerId();
    const wyvernZombie = resolveWyvernStingVenomZombie();

    world.getAllEntities().forEach(entity => {
      const enemy = entity.getComponent(Enemy);
      const health = entity.getComponent(Health);
      const transform = entity.getComponent(Transform);

      if (!enemy || !health || !transform || health.isDead) return;

      const venomStatus = enemy.updateVenomStatus(currentTime / 1000);
      if (venomStatus.shouldDealDamage && combatSystem) {
        combatSystem.queueDamage(
          entity,
          venomStatus.damage,
          undefined,
          'venom',
          sourcePlayerId,
          false,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          wyvernZombie,
        );

        createVenomEffect(transform.position);
      }
    });
  });

  return (
    <>
      <CobraShot projectilePool={projectilePool.current} />

      <VenomEffectManager world={world} />

      {venomEffects.current.map(effect => (
        <VenomEffect
          key={effect.id}
          position={effect.position}
          onComplete={() => removeVenomEffect(effect.id)}
        />
      ))}

      {beamEffects.current.map(beam => (
        <CobraShotBeam
          key={beam.id}
          position={beam.position}
          direction={beam.direction}
          onComplete={() => removeBeamEffect(beam.id)}
        />
      ))}
    </>
  );
}
