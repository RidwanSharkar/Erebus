import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { World } from '@/ecs/World';
import { Entity } from '@/ecs/Entity';
import { Enemy, EnemyType } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { Renderer } from '@/ecs/components/Renderer';
import GruntRenderer from './GruntRenderer';

interface GruntEnemyManagerProps {
  world: World;
}

export default function GruntEnemyManager({ world }: GruntEnemyManagerProps) {
  const gruntEntitiesRef = useRef<number[]>([]);

  useFrame(() => {
    // Get all entities with Enemy, Transform, and Renderer components
    const entities = world.queryEntities([Enemy, Transform, Renderer]);
    
    const currentGruntIds = entities
      .filter((entity: Entity) => {
        const enemy = entity.getComponent(Enemy)!;
        return enemy.type === EnemyType.GRUNT;
      })
      .map((entity: Entity) => entity.id);

    gruntEntitiesRef.current = currentGruntIds;
  });

  return (
    <>
      {gruntEntitiesRef.current.map(entityId => {
        const entity = world.getEntity(entityId);
        if (!entity) return null;

        const transform = entity.getComponent(Transform);
        if (!transform) return null;

        return (
          <GruntRenderer
            key={entityId}
            entityId={entityId}
            world={world}
          />
        );
      })}
    </>
  );
}
