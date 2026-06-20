import React, { useEffect, useRef } from 'react';
import { Vector3 } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Collider, ColliderType, CollisionLayer } from '@/ecs/components/Collider';
import { Entity } from '@/ecs/Entity';
import { WALL_SEGMENTS } from './CastleWalls';

const COLLISION_SAMPLE_SPACING = 1.0;

interface CastleWallCollisionProps {
  world: World;
  /** When false, no wall entities are created (e.g. co-op throne prep room). */
  enabled?: boolean;
}

/**
 * Creates invisible ECS BOX-collider entities for every castle wall segment.
 * Static environment colliders used by projectiles; player movement uses the
 * circular boundary projection in co-op rooms.
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
      const rotY = seg.rotationY ?? 0;
      const steps = rotY === 0 ? 1 : Math.max(1, Math.ceil(seg.sizeX / COLLISION_SAMPLE_SPACING));
      const step = seg.sizeX / steps;
      const tangentX = Math.cos(rotY);
      const tangentZ = -Math.sin(rotY);
      const start = -seg.sizeX / 2 + step / 2;

      for (let i = 0; i < steps; i++) {
        const offset = rotY === 0 ? 0 : start + i * step;
        const entity = world.createEntity();

        const transform = world.createComponent(Transform);
        transform.setPosition(
          seg.center[0] + tangentX * offset,
          seg.center[1],
          seg.center[2] + tangentZ * offset,
        );
        entity.addComponent(transform);

        const collider = world.createComponent(Collider);
        collider.type     = ColliderType.BOX;
        collider.size     = new Vector3(rotY === 0 ? seg.sizeX : step + 0.15, seg.sizeY, seg.sizeZ + 0.35);
        collider.layer    = CollisionLayer.ENVIRONMENT;
        collider.setMask(CollisionLayer.PROJECTILE);
        collider.isStatic = true;
        collider.isTrigger = false;
        collider.setOffset(0, 0, 0);
        entity.addComponent(collider);

        world.notifyEntityAdded(entity);
        created.push(entity);
      }
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
