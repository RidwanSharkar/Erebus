import React, { useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Projectile } from '@/ecs/components/Projectile';
import { Renderer } from '@/ecs/components/Renderer';
import RegularArrow from './RegularArrow';
import { Vector3 } from '@/utils/three-exports';

interface RegularArrowData {
  id: number;
  position: Vector3;
  direction: Vector3;
  entityId: number;
}

interface RegularArrowManagerProps {
  world: World;
}

export default function RegularArrowManager({ world }: RegularArrowManagerProps) {
  const [activeArrows, setActiveArrows] = useState<RegularArrowData[]>([]);
  const arrowIdCounter = useRef(0);
  const lastUpdateTime = useRef(0);
  const arrowByEntityRef = useRef(new Map<number, RegularArrowData>());
  const renderListRef = useRef<RegularArrowData[]>([]);

  useFrame((state) => {
    const currentTime = state.clock.getElapsedTime();
    if (currentTime - lastUpdateTime.current < 0.016) return;
    lastUpdateTime.current = currentTime;

    if (!world) return;

    const projectileEntities = world.queryEntities([Transform, Projectile, Renderer]);
    const map = arrowByEntityRef.current;
    const seen = new Set<number>();
    let rosterChanged = false;

    for (const entity of projectileEntities) {
      const renderer = entity.getComponent(Renderer);
      const transform = entity.getComponent(Transform);
      const projectile = entity.getComponent(Projectile);

      if (!renderer?.mesh?.userData?.isRegularArrow || !transform || !projectile) continue;

      seen.add(entity.id);
      let arrow = map.get(entity.id);
      if (arrow) {
        arrow.position.copy(transform.position);
      } else {
        arrow = {
          id: arrowIdCounter.current++,
          position: transform.position.clone(),
          direction: projectile.velocity.clone().normalize(),
          entityId: entity.id,
        };
        map.set(entity.id, arrow);
        rosterChanged = true;
      }
    }

    Array.from(map.keys()).forEach((entityId) => {
      if (!seen.has(entityId)) {
        map.delete(entityId);
        rosterChanged = true;
      }
    });

    if (rosterChanged) {
      renderListRef.current = Array.from(map.values());
      setActiveArrows(renderListRef.current);
    }
  });

  return (
    <>
      {activeArrows.map((arrow) => (
        <RegularArrow
          key={arrow.id}
          position={arrow.position}
          direction={arrow.direction}
        />
      ))}
    </>
  );
}
