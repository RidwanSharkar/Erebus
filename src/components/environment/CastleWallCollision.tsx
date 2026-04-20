import React, { useEffect, useRef } from 'react';
import { Vector3 } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Collider, ColliderType, CollisionLayer } from '@/ecs/components/Collider';
import { Entity } from '@/ecs/Entity';
import { WALL_SEGMENTS } from './CastleWalls';

interface CastleWallCollisionProps {
  world: World;
  /** When false, no wall entities are created (e.g. co-op throne prep room). */
  enabled?: boolean;
}

/**
 * Creates invisible ECS BOX-collider entities for every castle wall segment.
 * Static environment colliders — handled by CollisionSystem for both player
 * and enemy movement blocking (same pattern as PillarCollision).
 */
const CastleWallCollision: React.FC<CastleWallCollisionProps> = ({ world, enabled = true }) => {
  const entitiesRef = useRef<Entity[]>([]);

  useEffect(() => {
    const created: Entity[] = [];

    if (!enabled) {
      entitiesRef.current = [];
      return;
    }

    for (const seg of WALL_SEGMENTS) {
      const entity = world.createEntity();

      const transform = world.createComponent(Transform);
      transform.setPosition(seg.center[0], seg.center[1], seg.center[2]);
      entity.addComponent(transform);

      const collider = world.createComponent(Collider);
      collider.type     = ColliderType.BOX;
      collider.size     = new Vector3(seg.sizeX, seg.sizeY, seg.sizeZ);
      collider.layer    = CollisionLayer.ENVIRONMENT;
      collider.isStatic = true;
      collider.isTrigger = false;
      collider.setOffset(0, 0, 0);
      entity.addComponent(collider);

      world.notifyEntityAdded(entity);
      created.push(entity);
    }

    entitiesRef.current = created;

    return () => {
      created.forEach(e => {
        if (world.getEntity(e.id)) world.destroyEntity(e.id);
      });
      entitiesRef.current = [];
    };
  }, [world, enabled]);

  return null;
};

export default CastleWallCollision;
