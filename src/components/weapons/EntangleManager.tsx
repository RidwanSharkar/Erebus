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
  theme?: 'default' | 'spider';
}

interface EntangledPlayerData {
  playerId: string;
  position: Vector3;
  startTime: number;
  duration: number;
}

interface EntangleManagerProps {
  world?: World;
  getPlayerPositions?: () => Array<{ id: string; position: Vector3; health: number }>;
}

let globalEntangleManager: {
  addEntangledEnemy: (
    enemyId: string,
    position: Vector3,
    duration?: number,
    theme?: 'default' | 'spider',
  ) => void;
  addEntangledPlayer: (playerId: string, position: Vector3, duration?: number) => void;
  getActiveEntangledEnemies: () => EntangledEnemyData[];
} | null = null;

const ENTANGLE_PROC_SFX_DEBOUNCE_MS = 650;
let lastEntangleProcSoundMs = 0;

export const addGlobalEntangledEnemy = (
  enemyId: string,
  position: Vector3,
  duration: number = 5000,
  theme: 'default' | 'spider' = 'default',
): boolean => {
  if (globalEntangleManager) {
    globalEntangleManager.addEntangledEnemy(enemyId, position, duration, theme);
    return true;
  }
  return false;
};

export const addGlobalEntangledPlayer = (
  playerId: string,
  position: Vector3,
  duration: number = 5000,
): boolean => {
  if (globalEntangleManager) {
    globalEntangleManager.addEntangledPlayer(playerId, position, duration);
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

export default function EntangleManager({ world, getPlayerPositions }: EntangleManagerProps) {
  const [entangledEnemies, setEntangledEnemies] = useState<EntangledEnemyData[]>([]);
  const [entangledPlayers, setEntangledPlayers] = useState<EntangledPlayerData[]>([]);
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

  const playEntangleSound = useCallback((position: Vector3) => {
    const now = Date.now();
    if (now - lastEntangleProcSoundMs >= ENTANGLE_PROC_SFX_DEBOUNCE_MS) {
      lastEntangleProcSoundMs = now;
      (window as any).audioSystem?.playEntangleStatusSound?.(position.clone());
    }
  }, []);

  const addEntangledEnemy = useCallback((
    enemyId: string,
    position: Vector3,
    duration: number = 5000,
    theme: 'default' | 'spider' = 'default',
  ) => {
    playEntangleSound(position);

    setEntangledEnemies(prev => {
      const rest = prev.filter(entangled => entangled.enemyId !== enemyId);
      return [
        ...rest,
        {
          enemyId,
          position: position.clone(),
          startTime: Date.now(),
          duration,
          theme,
        },
      ];
    });
  }, [playEntangleSound]);

  const addEntangledPlayer = useCallback((playerId: string, position: Vector3, duration: number = 5000) => {
    playEntangleSound(position);

    setEntangledPlayers(prev => {
      const rest = prev.filter(entangled => entangled.playerId !== playerId);
      return [
        ...rest,
        {
          playerId,
          position: position.clone(),
          startTime: Date.now(),
          duration,
        },
      ];
    });
  }, [playEntangleSound]);

  const getActiveEntangledEnemies = useCallback(() => entangledEnemies, [entangledEnemies]);

  React.useEffect(() => {
    globalEntangleManager = {
      addEntangledEnemy,
      addEntangledPlayer,
      getActiveEntangledEnemies,
    };

    return () => {
      globalEntangleManager = null;
    };
  }, [addEntangledEnemy, addEntangledPlayer, getActiveEntangledEnemies]);

  useFrame(state => {
    const currentTime = state.clock.getElapsedTime();
    if (currentTime - lastUpdateTime.current < 0.1) return;
    lastUpdateTime.current = currentTime;

    const now = Date.now();

    if (world) {
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
    }

    const playerPositions = getPlayerPositions?.() ?? [];
    setEntangledPlayers(prev =>
      prev.filter(entangledPlayer => {
        if (now - entangledPlayer.startTime >= entangledPlayer.duration) {
          return false;
        }
        const live = playerPositions.find(p => p.id === entangledPlayer.playerId);
        return !!live && live.health > 0;
      }),
    );
  });

  const enemyData = getEnemyData();
  const playerData = getPlayerPositions?.() ?? [];

  return (
    <>
      {entangledEnemies.map(entangledEnemy => (
        <EntangledEffect
          key={`enemy-${entangledEnemy.enemyId}`}
          position={entangledEnemy.position}
          duration={entangledEnemy.duration}
          startTime={entangledEnemy.startTime}
          enemyId={entangledEnemy.enemyId}
          enemyData={enemyData}
          theme={entangledEnemy.theme ?? 'default'}
          onComplete={() => {
            setEntangledEnemies(prev => prev.filter(entangled => entangled.enemyId !== entangledEnemy.enemyId));
          }}
        />
      ))}
      {entangledPlayers.map(entangledPlayer => {
        const live = playerData.find(p => p.id === entangledPlayer.playerId);
        return (
          <EntangledEffect
            key={`player-${entangledPlayer.playerId}`}
            position={live?.position ?? entangledPlayer.position}
            duration={entangledPlayer.duration}
            startTime={entangledPlayer.startTime}
            followTargetId={entangledPlayer.playerId}
            followTargetData={playerData.map(p => ({
              id: p.id,
              position: p.position,
              health: p.health,
            }))}
            onComplete={() => {
              setEntangledPlayers(prev => prev.filter(entangled => entangled.playerId !== entangledPlayer.playerId));
            }}
          />
        );
      })}
    </>
  );
}
