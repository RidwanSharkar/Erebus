import React, { useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import { DEFAULT_ENTROPIC_COLOR_VARIANT } from '@/utils/entropicColorThemes';
import EntropicBolt from './EntropicBolt';
import { ENTROPIC_TRAIL_FADE_OUT_DURATION } from './EntropicBoltTrail';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Projectile } from '@/ecs/components/Projectile';
import { Renderer } from '@/ecs/components/Renderer';

interface EntropicBoltData {
  id: number;
  position: Vector3;
  direction: Vector3;
  entityId: number;
  isCryoflame: boolean;
  colorVariant: string;
  trailFadeOutStartElapsed?: number;
}

interface EntropicBoltManagerProps {
  world: World;
}

export default function EntropicBoltManager({ world }: EntropicBoltManagerProps) {
  const [activeBolts, setActiveBolts] = useState<EntropicBoltData[]>([]);
  const boltIdCounter = useRef(0);
  const lastUpdateTime = useRef(0);

  useFrame((state) => {
    const currentTime = state.clock.getElapsedTime();
    if (currentTime - lastUpdateTime.current < 0.016) return;
    lastUpdateTime.current = currentTime;

    if (!world) return;

    const projectileEntities = world.queryEntities([Transform, Projectile, Renderer]);
    const newBolts: EntropicBoltData[] = [];

    for (const entity of projectileEntities) {
      const renderer = entity.getComponent(Renderer);
      const transform = entity.getComponent(Transform);
      const projectile = entity.getComponent(Projectile);

      if (renderer?.mesh?.userData?.isEntropicBolt && transform && projectile) {
        const existingBolt = activeBolts.find((bolt) => bolt.entityId === entity.id);

        if (existingBolt) {
          existingBolt.position.copy(transform.position);
          delete existingBolt.trailFadeOutStartElapsed;
          newBolts.push(existingBolt);
        } else {
          const direction = renderer.mesh.userData.direction || projectile.velocity.clone().normalize();
          const isCryoflame = renderer.mesh.userData.isCryoflame || false;
          const colorVariant = renderer.mesh.userData.colorVariant || DEFAULT_ENTROPIC_COLOR_VARIANT;

          newBolts.push({
            id: boltIdCounter.current++,
            position: transform.position.clone(),
            direction: direction.clone(),
            entityId: entity.id,
            isCryoflame,
            colorVariant,
          });
        }
      }
    }

    const liveIds = new Set(newBolts.map((b) => b.entityId));
    const mergedBolts: EntropicBoltData[] = [...newBolts];
    for (const b of activeBolts) {
      if (!liveIds.has(b.entityId)) {
        if (b.trailFadeOutStartElapsed === undefined) {
          mergedBolts.push({ ...b, trailFadeOutStartElapsed: currentTime });
        } else if (currentTime - b.trailFadeOutStartElapsed < ENTROPIC_TRAIL_FADE_OUT_DURATION) {
          mergedBolts.push(b);
        }
      }
    }

    const boltsChanged =
      mergedBolts.length !== activeBolts.length ||
      mergedBolts.some((p) => {
        const ex = activeBolts.find((e) => e.entityId === p.entityId);
        if (!ex) return true;
        return (ex.trailFadeOutStartElapsed ?? -1) !== (p.trailFadeOutStartElapsed ?? -1);
      }) ||
      activeBolts.some((p) => !mergedBolts.find((e) => e.entityId === p.entityId));

    if (boltsChanged) {
      setActiveBolts(mergedBolts);
    }
  });

  return (
    <>
      {activeBolts.map((bolt) => (
        <EntropicBolt
          key={bolt.id}
          id={bolt.id}
          position={bolt.position}
          direction={bolt.direction}
          isCryoflame={bolt.isCryoflame}
          colorVariant={bolt.colorVariant}
          trailFadeOutStartElapsed={bolt.trailFadeOutStartElapsed}
        />
      ))}
    </>
  );
}
