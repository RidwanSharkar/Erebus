'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import RejuvenatingShot from './RejuvenatingShot';
import RejuvenatingShotHealingEffect from './RejuvenatingShotHealingEffect';
import { World } from '@/ecs/World';
import { getRejuvenatingShotHealAmount } from '@/utils/bowConstants';
import { ENTANGLEMENT_DURATION_MS } from '@/utils/talents';
import { addGlobalEntangledEnemy } from '@/components/weapons/EntangleManager';

const _scratchMovement = new Vector3();

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
  hasHealed: boolean;
  healedTargetId: string | null;
  healAmount: number;
  authoritative: boolean;
}

export interface RejuvenatingShotTriggerOptions {
  healAmount?: number;
  authoritative?: boolean;
}

interface HealTarget {
  id: string;
  position: Vector3;
  health: number;
  maxHealth: number;
}

interface EnemyTarget {
  id: string;
  position: Vector3;
  health: number;
}

interface RejuvenatingShotManagerProps {
  world: World;
  playerPositions?: HealTarget[];
  alliedTargets?: HealTarget[];
  /** Hostile enemies — Druid Rejuvenating Shot can Entangle these. */
  enemyTargets?: EnemyTarget[];
  onPlayerHealed?: (playerId: string, healAmount: number, position: Vector3) => void;
  onAlliedHealed?: (enemyId: string, healAmount: number, position: Vector3) => void;
  onEnemyEntangled?: (enemyId: string, position: Vector3) => void;
}

let globalRejuvenatingShotTrigger: ((
  position: Vector3,
  direction: Vector3,
  options?: RejuvenatingShotTriggerOptions,
) => void) | null = null;
let globalRejuvenatingShotProjectilePool: (() => RejuvenatingShotProjectile[]) | null = null;

export function triggerGlobalRejuvenatingShot(
  position: Vector3,
  direction: Vector3,
  options?: RejuvenatingShotTriggerOptions,
): void {
  if (globalRejuvenatingShotTrigger) {
    globalRejuvenatingShotTrigger(position, direction, options);
  }
}

export function getGlobalRejuvenatingShotProjectiles(): RejuvenatingShotProjectile[] {
  if (globalRejuvenatingShotProjectilePool) {
    return globalRejuvenatingShotProjectilePool();
  }
  return [];
}

const HEALING_RANGE = 2.0;

interface HealingEffectData {
  id: number;
  position: Vector3;
  startTime: number;
}

type HitResult =
  | { kind: 'player' | 'ally'; target: HealTarget; distance: number }
  | { kind: 'enemy'; target: EnemyTarget; distance: number };

function findClosestHit(
  projectilePosition: Vector3,
  playerPositions: HealTarget[],
  alliedTargets: HealTarget[],
  enemyTargets: EnemyTarget[],
): HitResult | null {
  let closest: HitResult | null = null;

  const considerHeal = (kind: 'player' | 'ally', target: HealTarget) => {
    if (target.health >= target.maxHealth) return;
    const distance = projectilePosition.distanceTo(target.position);
    if (distance > HEALING_RANGE) return;
    if (!closest || distance < closest.distance) {
      closest = { kind, target, distance };
    }
  };

  const considerEnemy = (target: EnemyTarget) => {
    if (target.health <= 0) return;
    const distance = projectilePosition.distanceTo(target.position);
    if (distance > HEALING_RANGE) return;
    if (!closest || distance < closest.distance) {
      closest = { kind: 'enemy', target, distance };
    }
  };

  for (const player of playerPositions) {
    considerHeal('player', player);
  }
  for (const ally of alliedTargets) {
    considerHeal('ally', ally);
  }
  for (const enemy of enemyTargets) {
    considerEnemy(enemy);
  }

  return closest;
}

export default function RejuvenatingShotManager({
  world,
  playerPositions = [],
  alliedTargets = [],
  enemyTargets = [],
  onPlayerHealed,
  onAlliedHealed,
  onEnemyEntangled,
}: RejuvenatingShotManagerProps) {
  const projectilePool = useRef<RejuvenatingShotProjectile[]>([]);
  const nextProjectileId = useRef(0);
  const [activeProjectileIds, setActiveProjectileIds] = useState<number[]>([]);
  const lastActiveIdsKey = useRef('');
  const [healingEffects, setHealingEffects] = useState<HealingEffectData[]>([]);
  const nextHealingEffectId = useRef(0);
  const playerPositionsRef = useRef(playerPositions);
  const alliedTargetsRef = useRef(alliedTargets);
  const enemyTargetsRef = useRef(enemyTargets);

  useEffect(() => {
    playerPositionsRef.current = playerPositions;
  }, [playerPositions]);

  useEffect(() => {
    alliedTargetsRef.current = alliedTargets;
  }, [alliedTargets]);

  useEffect(() => {
    enemyTargetsRef.current = enemyTargets;
  }, [enemyTargets]);
  
  const POOL_SIZE = 3;
  const PROJECTILE_SPEED = 1.0;
  const MAX_DISTANCE = 20;
  const FADE_DURATION = 1000;

  const syncActiveProjectileIds = useCallback(() => {
    const active = projectilePool.current.filter((p) => p.active).map((p) => p.id);
    const key = active.join(',');
    if (key === lastActiveIdsKey.current) return;
    lastActiveIdsKey.current = key;
    setActiveProjectileIds(active);
  }, []);

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
      healedTargetId: null,
      healAmount: getRejuvenatingShotHealAmount(0),
      authoritative: false,
    }));
  }, []);

  const getInactiveProjectile = useCallback(() => {
    return projectilePool.current.find(p => !p.active);
  }, []);

  const shootRejuvenatingShot = useCallback((
    position: Vector3,
    direction: Vector3,
    options?: RejuvenatingShotTriggerOptions,
  ) => {
    const projectile = getInactiveProjectile();
    if (!projectile) {
      return;
    }

    const now = Date.now();

    projectile.position.copy(position);
    projectile.direction.copy(direction).normalize();
    projectile.startPosition.copy(position);
    projectile.active = true;
    projectile.startTime = now;
    projectile.distanceTraveled = 0;
    projectile.opacity = 1;
    projectile.fadeStartTime = null;
    projectile.hasHealed = false;
    projectile.healedTargetId = null;
    projectile.healAmount = options?.healAmount ?? getRejuvenatingShotHealAmount(0);
    projectile.authoritative = options?.authoritative ?? false;
    syncActiveProjectileIds();
  }, [getInactiveProjectile, syncActiveProjectileIds]);

  useEffect(() => {
    globalRejuvenatingShotTrigger = shootRejuvenatingShot;
    globalRejuvenatingShotProjectilePool = () => projectilePool.current;
    return () => {
      globalRejuvenatingShotTrigger = null;
      globalRejuvenatingShotProjectilePool = null;
    };
  }, [shootRejuvenatingShot]);

  useFrame(() => {
    const currentTime = Date.now();
    let activeChanged = false;

    projectilePool.current.forEach(projectile => {
      if (!projectile.active) return;

      const movement = _scratchMovement.copy(projectile.direction).multiplyScalar(PROJECTILE_SPEED);
      projectile.position.add(movement);

      projectile.distanceTraveled = projectile.position.distanceTo(projectile.startPosition);
      
      if (projectile.distanceTraveled > MAX_DISTANCE * 0.8 && !projectile.fadeStartTime) {
        projectile.fadeStartTime = currentTime;
      }

      if (projectile.fadeStartTime) {
        const fadeElapsed = currentTime - projectile.fadeStartTime;
        projectile.opacity = Math.max(0, 1 - (fadeElapsed / FADE_DURATION));
        
        if (projectile.opacity <= 0 || projectile.distanceTraveled > MAX_DISTANCE) {
          projectile.active = false;
          projectile.opacity = 1;
          projectile.fadeStartTime = null;
          projectile.hasHealed = false;
          projectile.healedTargetId = null;
          activeChanged = true;
          return;
        }
      }

      if (!projectile.hasHealed && projectile.authoritative) {
        const hit = findClosestHit(
          projectile.position,
          playerPositionsRef.current,
          alliedTargetsRef.current,
          enemyTargetsRef.current,
        );

        if (hit && hit.target.id !== projectile.healedTargetId) {
          if (hit.kind === 'enemy') {
            const entanglePos = hit.target.position.clone();
            addGlobalEntangledEnemy(hit.target.id, entanglePos.clone(), ENTANGLEMENT_DURATION_MS);
            if (onEnemyEntangled) {
              onEnemyEntangled(hit.target.id, entanglePos);
            }
            projectile.hasHealed = true;
            projectile.healedTargetId = hit.target.id;
            projectile.active = false;
            projectile.opacity = 1;
            projectile.fadeStartTime = null;
            activeChanged = true;
            return;
          }

          const healingEffectPosition = hit.target.position.clone();
          healingEffectPosition.y += 0;

          const healPos = hit.target.position.clone();
          healPos.y += 1.6;

          setHealingEffects(prev => [...prev, {
            id: nextHealingEffectId.current++,
            position: healingEffectPosition,
            startTime: Date.now(),
          }]);

          if (hit.kind === 'player' && onPlayerHealed) {
            onPlayerHealed(hit.target.id, projectile.healAmount, healPos);
          } else if (hit.kind === 'ally' && onAlliedHealed) {
            onAlliedHealed(hit.target.id, projectile.healAmount, healPos);
          }

          projectile.hasHealed = true;
          projectile.healedTargetId = hit.target.id;
          projectile.active = false;
          projectile.opacity = 1;
          projectile.fadeStartTime = null;
          activeChanged = true;
        }
      }
    });

    if (activeChanged) {
      syncActiveProjectileIds();
    }
  });

  const removeHealingEffect = useCallback((id: number) => {
    setHealingEffects(prev => prev.filter(effect => effect.id !== id));
  }, []);

  const activeProjectiles = projectilePool.current.filter((p) =>
    activeProjectileIds.includes(p.id),
  );

  return (
    <group name="rejuvenating-shot-manager">
      {activeProjectiles.map((projectile) => (
          <RejuvenatingShot
            key={projectile.id}
            position={projectile.position}
            direction={projectile.direction}
            distanceTraveled={projectile.distanceTraveled}
            maxDistance={MAX_DISTANCE}
          />
        ))}
      
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
