import React, { useCallback, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Enemy } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import EntangledEffect from './EntangledEffect';

interface EntangledEnemyData {
  enemyId: string;
  position: Vector3;
  startTime: number;
  duration: number;
}

interface EntangleManagerProps {
  world?: World;
}

let globalEntangleManager: {
  addEntangledEnemy: (enemyId: string, position: Vector3, duration?: number) => void;
  getActiveEntangledEnemies: () => EntangledEnemyData[];
} | null = null;

const ENTANGLE_PROC_SFX_DEBOUNCE_MS = 650;
let lastEntangleProcSoundMs = 0;

export const addGlobalEntangledEnemy = (
  enemyId: string,
  position: Vector3,
  duration: number = 5000,
): boolean => {
  if (globalEntangleManager) {
    globalEntangleManager.addEntangledEnemy(enemyId, position, duration);
    return true;
  }
  return false;
};

export const getActiveEntangledEnemies = (): EntangledEnemyData[] => {
  if (globalEntangleManager) {
    return globalEntangleManager.getActiveEntangledEnemies();
  }
  return [];
};

export default function EntangleManager({ world }: EntangleManagerProps) {
  const [entangledEnemies, setEntangledEnemies] = useState<EntangledEnemyData[]>([]);
  const lastUpdateTime = useRef(0);

  const getEnemyData = useCallback(() => {
    if (!world) return [];

    return world
      .getAllEntities()
      .filter(entity => entity.hasComponent(Enemy) && entity.hasComponent(Transform) && entity.hasComponent(Health))
      .map(entity => {
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

  const addEntangledEnemy = useCallback((enemyId: string, position: Vector3, duration: number = 5000) => {
    const now = Date.now();
    if (now - lastEntangleProcSoundMs >= ENTANGLE_PROC_SFX_DEBOUNCE_MS) {
      lastEntangleProcSoundMs = now;
      (window as any).audioSystem?.playEntangleStatusSound?.(position.clone());
    }

    setEntangledEnemies(prev => {
      const rest = prev.filter(entangled => entangled.enemyId !== enemyId);
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

  const getActiveEntangledEnemies = useCallback(() => entangledEnemies, [entangledEnemies]);

  React.useEffect(() => {
    globalEntangleManager = {
      addEntangledEnemy,
      getActiveEntangledEnemies,
    };

    return () => {
      globalEntangleManager = null;
    };
  }, [addEntangledEnemy, getActiveEntangledEnemies]);

  useFrame(state => {
    const currentTime = state.clock.getElapsedTime();
    if (currentTime - lastUpdateTime.current < 0.1) return;
    lastUpdateTime.current = currentTime;

    if (!world) return;

    const now = Date.now();
    const allEntities = world.getAllEntities();

    setEntangledEnemies(prev =>
      prev.filter(entangledEnemy => {
        if (now - entangledEnemy.startTime >= entangledEnemy.duration) {
          return false;
        }

        const entity = allEntities.find(e => e.id.toString() === entangledEnemy.enemyId);
        if (!entity) return false;

        const health = entity.getComponent(Health);
        if (health?.isDead) return false;

        const enemy = entity.getComponent(Enemy);
        if (enemy && !enemy.isEntangled) return false;

        return true;
      }),
    );
  });

  const enemyData = getEnemyData();

  return (
    <>
      {entangledEnemies.map(entangledEnemy => (
        <EntangledEffect
          key={entangledEnemy.enemyId}
          position={entangledEnemy.position}
          duration={entangledEnemy.duration}
          startTime={entangledEnemy.startTime}
          enemyId={entangledEnemy.enemyId}
          enemyData={enemyData}
          onComplete={() => {
            setEntangledEnemies(prev => prev.filter(entangled => entangled.enemyId !== entangledEnemy.enemyId));
          }}
        />
      ))}
    </>
  );
}
