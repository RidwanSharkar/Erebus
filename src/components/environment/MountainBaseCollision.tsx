import React, { useEffect, useRef } from 'react';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Collider, ColliderType, CollisionLayer } from '@/ecs/components/Collider';
import { Entity } from '@/ecs/Entity';
import { getRedCornerMountainDiscs, RED_CORNER_MOUNTAIN_COLLISION_CYLINDER } from '@/utils/cornerMountainsConstants';

interface MountainBaseCollisionProps {
  world: World;
  /** When false, no mountain collider entities (non-red room or throne prep). */
  enabled?: boolean;
}

/**
 * Static ECS cylinder colliders for red-room corner mountain bases — matches `getRedCornerMountainDiscs` radii.
 */
const MountainBaseCollision: React.FC<MountainBaseCollisionProps> = ({ world, enabled = true }) => {
  const entitiesRef = useRef<Entity[]>([]);

  useEffect(() => {
    const created: Entity[] = [];

    if (!enabled) {
      entitiesRef.current = [];
      return;
    }

    const discs = getRedCornerMountainDiscs();
    const { height, centerY } = RED_CORNER_MOUNTAIN_COLLISION_CYLINDER;
    for (const d of discs) {
      const entity = world.createEntity();
      const transform = world.createComponent(Transform);
      transform.setPosition(d.x, centerY, d.z);
      entity.addComponent(transform);

      const collider = world.createComponent(Collider);
      collider.type = ColliderType.CYLINDER;
      collider.radius = d.radius;
      collider.height = height;
      collider.layer = CollisionLayer.ENVIRONMENT;
      collider.isStatic = true;
      collider.isTrigger = false;
      collider.setOffset(0, 0, 0);
      entity.addComponent(collider);

      world.notifyEntityAdded(entity);
      created.push(entity);
    }

    entitiesRef.current = created;

    return () => {
      created.forEach((e) => {
        if (world.getEntity(e.id)) world.destroyEntity(e.id);
      });
      entitiesRef.current = [];
    };
  }, [world, enabled]);

  return null;
};

export default MountainBaseCollision;
