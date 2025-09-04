import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { World } from '@/ecs/World';
import { Entity } from '@/ecs/Entity';
import { Enemy, EnemyType } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { Renderer } from '@/ecs/components/Renderer';
import BossRenderer from './BossRenderer';

interface BossEnemyManagerProps {
  world: World;
}

export default function BossEnemyManager({ world }: BossEnemyManagerProps) {
  const bossEntitiesRef = useRef<number[]>([]);

  useFrame(() => {
    // Get all entities with Enemy, Transform, and Renderer components
    const entities = world.queryEntities([Enemy, Transform, Renderer]);
    
    const currentBossIds = entities
      .filter((entity: Entity) => {
        const enemy = entity.getComponent(Enemy)!;
        return enemy.type === EnemyType.BOSS;
      })
      .map((entity: Entity) => entity.id);



    bossEntitiesRef.current = currentBossIds;
  });

  return (
    <>
      {bossEntitiesRef.current.map(entityId => {
        const entity = world.getEntity(entityId);
        if (!entity) return null;

        const transform = entity.getComponent(Transform);
        if (!transform) return null;

        return (
          <BossRenderer
            key={entityId}
            entityId={entityId}
            position={transform.position}
            world={world}
          />
        );
      })}
    </>
  );
}
