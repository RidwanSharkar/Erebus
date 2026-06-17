import React, { useState, useCallback, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Enemy } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import StunnedEffect from './StunnedEffect';

interface StunnedEnemyData {
  enemyId: string;
  position: Vector3;
  startTime: number;
  duration: number;
}

interface StunManagerProps {
  world?: World;
}

let globalStunManager: {
  addStunnedEnemy: (enemyId: string, position: Vector3, duration?: number) => void;
  getActiveStunnedEnemies: () => StunnedEnemyData[];
} | null = null;

export const addGlobalStunnedEnemy = (enemyId: string, position: Vector3, duration: number = 4000): boolean => {
  if (globalStunManager) {
    globalStunManager.addStunnedEnemy(enemyId, position, duration);
    return true;
  }
  return false;
};

export const getActiveStunnedEnemies = (): StunnedEnemyData[] => {
  if (globalStunManager) {
    return globalStunManager.getActiveStunnedEnemies();
  }
  return [];
};

export default function StunManager({ world }: StunManagerProps) {
  const [stunnedEnemies, setStunnedEnemies] = useState<StunnedEnemyData[]>([]);
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

  const addStunnedEnemy = useCallback((enemyId: string, position: Vector3, duration: number = 4000) => {
    setStunnedEnemies(prev => {
      const rest = prev.filter(se => se.enemyId !== enemyId);
      return [
        ...rest,
        {
          enemyId,
          position: position.clone(),
          startTime: Date.now(),
          duration,
        },
      ];
    });
  }, []);

  const getActiveStunnedEnemies = useCallback(() => stunnedEnemies, [stunnedEnemies]);

  React.useEffect(() => {
    globalStunManager = {
      addStunnedEnemy,
      getActiveStunnedEnemies,
    };

    return () => {
      globalStunManager = null;
    };
  }, [addStunnedEnemy, getActiveStunnedEnemies]);

  useFrame(state => {
    const currentTime = state.clock.getElapsedTime();
    if (currentTime - lastUpdateTime.current < 0.1) return;
    lastUpdateTime.current = currentTime;

    if (!world) return;

    const now = Date.now();
    const allEntities = world.getAllEntities();

    setStunnedEnemies(prev =>
      prev.filter(stunnedEnemy => {
        const elapsed = now - stunnedEnemy.startTime;

        if (elapsed >= stunnedEnemy.duration) {
          return false;
        }

        const entity = allEntities.find(e => e.id.toString() === stunnedEnemy.enemyId);
        if (!entity) {
          return false;
        }

        const health = entity.getComponent(Health);
        if (health && health.isDead) {
          return false;
        }

        const enemy = entity.getComponent(Enemy);
        if (enemy && !enemy.isStunned) {
          return false;
        }

        return true;
      }),
    );
  });

  const enemyData = getEnemyData();

  return (
    <>
      {stunnedEnemies.map(stunnedEnemy => (
        <StunnedEffect
          key={stunnedEnemy.enemyId}
          position={stunnedEnemy.position}
          duration={stunnedEnemy.duration}
          startTime={stunnedEnemy.startTime}
          enemyId={stunnedEnemy.enemyId}
          enemyData={enemyData}
          onComplete={() => {
            setStunnedEnemies(prev => prev.filter(se => se.enemyId !== stunnedEnemy.enemyId));
          }}
        />
      ))}
    </>
  );
}
