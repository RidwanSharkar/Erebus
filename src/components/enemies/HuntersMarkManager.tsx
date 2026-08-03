'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Enemy } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import { isCoopPlayerAllyEntity } from '@/utils/coopAllyTargeting';
import { SNIPER_HUNTERS_MARK_DURATION_MS } from '@/utils/weaponAspects';
import HuntersMarkIndicator from './HuntersMarkIndicator';

interface MarkedEnemyData {
  enemyId: string;
  position: Vector3;
  startTime: number;
  duration: number;
  yOffset: number;
}

interface HuntersMarkManagerProps {
  world?: World;
}

let globalHuntersMarkManager: {
  addMarkedEnemy: (enemyId: string, position: Vector3, duration?: number, yOffset?: number) => void;
  clearMarkedEnemy: (enemyId: string) => void;
  hasMarkedEnemy: (enemyId: string) => boolean;
} | null = null;

export const addGlobalHuntersMark = (
  enemyId: string,
  position: Vector3,
  duration: number = SNIPER_HUNTERS_MARK_DURATION_MS,
  yOffset: number = 2.4,
): boolean => {
  if (!globalHuntersMarkManager) return false;
  globalHuntersMarkManager.addMarkedEnemy(enemyId, position, duration, yOffset);
  return true;
};

export const clearGlobalHuntersMark = (enemyId: string): void => {
  globalHuntersMarkManager?.clearMarkedEnemy(enemyId);
};

export const hasGlobalHuntersMark = (enemyId: string): boolean => {
  return globalHuntersMarkManager?.hasMarkedEnemy(enemyId) === true;
};

function resolveMarkYOffset(entity: { getComponent: (c: typeof Enemy) => Enemy | undefined; userData?: any }): number {
  const sk = entity.userData?.coopServerEnemyType as string | undefined;
  const enemy = entity.getComponent(Enemy);
  if (
    enemy?.type === 'boss' ||
    sk === 'boss' ||
    sk === 'boss2' ||
    sk === 'boss3' ||
    sk === 'destiny' ||
    sk === 'titan' ||
    sk === 'stone-giant' ||
    sk === 'eternal-oak' ||
    sk === 'colossus'
  ) {
    return 4.5;
  }
  return 2.4;
}

export default function HuntersMarkManager({ world }: HuntersMarkManagerProps) {
  const [markedEnemies, setMarkedEnemies] = useState<MarkedEnemyData[]>([]);
  const markedRef = useRef<MarkedEnemyData[]>([]);
  const lastUpdateTime = useRef(0);

  const syncMarked = useCallback((next: MarkedEnemyData[]) => {
    markedRef.current = next;
    setMarkedEnemies(next);
  }, []);

  const addMarkedEnemy = useCallback(
    (enemyId: string, position: Vector3, duration: number = SNIPER_HUNTERS_MARK_DURATION_MS, yOffset: number = 2.4) => {
      if (world) {
        const entity = world.getAllEntities().find((e) => e.id.toString() === enemyId);
        if (entity && isCoopPlayerAllyEntity(entity)) return;
      }
      const rest = markedRef.current.filter((m) => m.enemyId !== enemyId);
      syncMarked([
        ...rest,
        {
          enemyId,
          position: position.clone(),
          startTime: Date.now(),
          duration,
          yOffset,
        },
      ]);
    },
    [world, syncMarked],
  );

  const clearMarkedEnemy = useCallback(
    (enemyId: string) => {
      syncMarked(markedRef.current.filter((m) => m.enemyId !== enemyId));
    },
    [syncMarked],
  );

  const hasMarkedEnemy = useCallback((enemyId: string) => {
    const now = Date.now();
    return markedRef.current.some((m) => m.enemyId === enemyId && now < m.startTime + m.duration);
  }, []);

  useEffect(() => {
    globalHuntersMarkManager = {
      addMarkedEnemy,
      clearMarkedEnemy,
      hasMarkedEnemy,
    };
    return () => {
      globalHuntersMarkManager = null;
    };
  }, [addMarkedEnemy, clearMarkedEnemy, hasMarkedEnemy]);

  useFrame((state) => {
    const currentTime = state.clock.getElapsedTime();
    if (currentTime - lastUpdateTime.current < 0.08) return;
    lastUpdateTime.current = currentTime;
    if (!world) return;

    const now = Date.now();
    const allEntities = world.getAllEntities();

    const next = markedRef.current
      .map((mark) => {
        if (now >= mark.startTime + mark.duration) return null;
        const entity = allEntities.find((e) => e.id.toString() === mark.enemyId);
        if (!entity || isCoopPlayerAllyEntity(entity)) return null;
        const health = entity.getComponent(Health);
        if (health?.isDead) return null;
        const transform = entity.getComponent(Transform);
        if (!transform) return null;
        return {
          ...mark,
          position: transform.getWorldPosition().clone(),
          yOffset: resolveMarkYOffset(entity),
        };
      })
      .filter((m): m is MarkedEnemyData => m != null);

    // Avoid pointless React updates when nothing changed structurally.
    const changed =
      next.length !== markedRef.current.length ||
      next.some((m, i) => {
        const prev = markedRef.current[i];
        return !prev || prev.enemyId !== m.enemyId || prev.yOffset !== m.yOffset;
      });
    if (changed || next.some((m, i) => {
      const prev = markedRef.current[i];
      return !prev || prev.position.distanceToSquared(m.position) > 0.0001;
    })) {
      syncMarked(next);
    }
  });

  return (
    <>
      {markedEnemies.map((mark) => (
        <HuntersMarkIndicator
          key={mark.enemyId}
          position={mark.position}
          yOffset={mark.yOffset}
        />
      ))}
    </>
  );
}
