import React, { useState, useRef, useCallback } from 'react';
import { Vector3 } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import FrostNova from './FrostNova';
import FrozenEffect from './FrozenEffect';
import { World } from '@/ecs/World';
import { Enemy } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';

interface FrostNovaData {
  id: number;
  position: Vector3;
  startTime: number;
  duration: number;
}

interface FrozenEnemyData {
  enemyId: string;
  position: Vector3;
  startTime: number;
  duration: number;
}

interface FrostNovaManagerProps {
  world?: World;
}

const DEFAULT_FROZEN_VFX_MS = 5000;

let globalFrostNovaManager: {
  triggerFrostNova: (position: Vector3) => void;
  addFrozenEnemy: (enemyId: string, position: Vector3, durationMs?: number) => void;
  getActiveFrostNovas: () => FrostNovaData[];
} | null = null;

export const triggerGlobalFrostNova = (position: Vector3): boolean => {
  if (globalFrostNovaManager) {
    globalFrostNovaManager.triggerFrostNova(position);
    return true;
  }
  return false;
};

export const addGlobalFrozenEnemy = (
  enemyId: string,
  position: Vector3,
  durationMs?: number,
): boolean => {
  if (globalFrostNovaManager) {
    globalFrostNovaManager.addFrozenEnemy(enemyId, position, durationMs);
    return true;
  }
  return false;
};

export const getActiveFrostNovas = (): FrostNovaData[] => {
  if (globalFrostNovaManager && (globalFrostNovaManager as any).getActiveFrostNovas) {
    return (globalFrostNovaManager as any).getActiveFrostNovas();
  }
  return [];
};

export default function FrostNovaManager({ world }: FrostNovaManagerProps) {
  const [activeFrostNovas, setActiveFrostNovas] = useState<FrostNovaData[]>([]);
  const [frozenEnemies, setFrozenEnemies] = useState<FrozenEnemyData[]>([]);
  const frostNovaIdCounter = useRef(0);
  const lastUpdateTime = useRef(0);

  const getEnemyData = useCallback(() => {
    if (!world) return [];

    const allEntities = world.getAllEntities();
    return allEntities
      .filter(entity => entity.hasComponent(Enemy) && entity.hasComponent(Transform) && entity.hasComponent(Health))
      .map(entity => {
        const enemy = entity.getComponent(Enemy)!;
        const transform = entity.getComponent(Transform)!;
        const health = entity.getComponent(Health)!;

        return {
          id: entity.id.toString(),
          position: transform.position.clone(),
          health: health.currentHealth,
          isDying: health.isDead,
          deathStartTime: health.isDead ? Date.now() : undefined,
        };
      });
  }, [world]);

  const triggerFrostNova = useCallback((position: Vector3) => {
    const newFrostNova: FrostNovaData = {
      id: frostNovaIdCounter.current++,
      position: position.clone(),
      startTime: Date.now(),
      duration: 1200,
    };

    setActiveFrostNovas(prev => [...prev, newFrostNova]);
  }, []);

  const addFrozenEnemy = useCallback(
    (enemyId: string, position: Vector3, durationMs: number = DEFAULT_FROZEN_VFX_MS) => {
      setFrozenEnemies(prev => {
        const rest = prev.filter(fe => fe.enemyId !== enemyId);
        return [
          ...rest,
          {
            enemyId,
            position: position.clone(),
            startTime: Date.now(),
            duration: durationMs,
          },
        ];
      });
    },
    [],
  );

  const getActiveFrostNovas = useCallback(() => activeFrostNovas, [activeFrostNovas]);

  React.useEffect(() => {
    globalFrostNovaManager = {
      triggerFrostNova,
      addFrozenEnemy,
      getActiveFrostNovas,
    };

    return () => {
      globalFrostNovaManager = null;
    };
  }, [triggerFrostNova, addFrozenEnemy, getActiveFrostNovas]);

  useFrame(state => {
    const currentTime = state.clock.getElapsedTime();
    if (currentTime - lastUpdateTime.current < 0.1) return;
    lastUpdateTime.current = currentTime;

    if (!world) return;

    const now = Date.now();

    const allEntities = world.getAllEntities();

    setFrozenEnemies(prev => {
      return prev.filter(frozenEnemy => {
        const effectElapsed = now - frozenEnemy.startTime;
        if (effectElapsed >= frozenEnemy.duration) {
          return false;
        }

        const entity = allEntities.find(e => e.id.toString() === frozenEnemy.enemyId);
        if (!entity) {
          return false;
        }

        const enemy = entity.getComponent(Enemy);
        const health = entity.getComponent(Health);

        if (!enemy || !health) {
          return false;
        }

        if (health.isDead) {
          return false;
        }

        return true;
      });
    });

    setActiveFrostNovas(prev =>
      prev.filter(frostNova => {
        const effectElapsed = now - frostNova.startTime;
        return effectElapsed < frostNova.duration;
      }),
    );
  });

  const handleFrostNovaComplete = (frostNovaId: number) => {
    setActiveFrostNovas(prev => prev.filter(fn => fn.id !== frostNovaId));
  };

  const handleFrozenEffectComplete = (enemyKey: string) => {
    setFrozenEnemies(prev => prev.filter(fe => fe.enemyId !== enemyKey));
  };

  const enemyData = getEnemyData();

  return (
    <>
      {activeFrostNovas.map(frostNova => (
        <FrostNova
          key={frostNova.id}
          position={frostNova.position}
          duration={frostNova.duration}
          startTime={frostNova.startTime}
          onComplete={() => handleFrostNovaComplete(frostNova.id)}
        />
      ))}

      {frozenEnemies.map(frozenEnemy => (
        <FrozenEffect
          key={frozenEnemy.enemyId}
          position={frozenEnemy.position}
          duration={frozenEnemy.duration}
          startTime={frozenEnemy.startTime}
          enemyId={frozenEnemy.enemyId}
          enemyData={enemyData}
          onComplete={() => handleFrozenEffectComplete(frozenEnemy.enemyId)}
        />
      ))}
    </>
  );
}
