import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Vector3 } from '@/utils/three-exports';
import type { World } from '@/ecs/World';
import type { Entity } from '@/ecs/Entity';
import { Enemy } from '@/ecs/components/Enemy';
import { Health } from '@/ecs/components/Health';
import Blizzard from './Blizzard';
import { CombatSystem } from '@/systems/CombatSystem';
import {
  ARCTIC_BLIZZARD_DAMAGE_PER_TICK,
  ARCTIC_BLIZZARD_DURATION_SEC,
  ARCTIC_BLIZZARD_HIT_RADIUS,
  ARCTIC_BLIZZARD_TICK_MS,
} from '@/utils/talents';
import { setArcticGroundBlizzardSpawner } from './arcticBlizzardSpawnBridge';

export type ArcticBlizzardSpawn = {
  id: string;
  position: Vector3;
};

interface ArcticBlizzardManagerProps {
  world: World | null;
  getEnemyData: () => Array<{ id: string; position: Vector3; health: number }>;
}

function findEnemyEntityForBlizzard(world: World, targetId: string): Entity | null {
  const candidates = world.queryEntities([Health, Enemy]);
  for (const e of candidates) {
    if (e.userData?.serverEnemyId === targetId) return e;
    if (e.id.toString() === targetId) return e;
  }
  return null;
}

/**
 * Ground-fixed concentrated blizzards (Arctic Shards proc + Glacial Storm on hit).
 */
export default function ArcticBlizzardManager({ world, getEnemyData }: ArcticBlizzardManagerProps) {
  const [storms, setStorms] = useState<ArcticBlizzardSpawn[]>([]);
  const getEnemyDataRef = useRef(getEnemyData);
  getEnemyDataRef.current = getEnemyData;

  const pushStorm = useCallback((worldPosition: Vector3) => {
    const id = `arctic-bz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setStorms((prev) => [...prev, { id, position: worldPosition.clone() }]);
  }, []);

  useEffect(() => {
    setArcticGroundBlizzardSpawner(pushStorm);
    return () => setArcticGroundBlizzardSpawner(null);
  }, [pushStorm]);

  const handleBlizzardHit = useCallback(
    (targetId: string, damage: number, _isCritical: boolean, _hitPosition: Vector3, _isBlizzard: boolean) => {
      if (!world) return;
      const combat = world.getSystem(CombatSystem) as CombatSystem | undefined;
      if (!combat) return;
      const entity = findEnemyEntityForBlizzard(world, targetId);
      if (!entity) return;
      const localPlayer = (window as any).controlSystemRef?.current?.getPlayerEntity?.();
      combat.queueDamageWithBlizzardArctic(
        entity,
        damage,
        localPlayer ?? undefined,
        localPlayer?.userData?.playerId,
      );
    },
    [world],
  );

  return (
    <>
      {storms.map((s) => (
        <Blizzard
          key={s.id}
          position={s.position}
          resolveEnemyData={() => getEnemyDataRef.current() ?? []}
          durationSeconds={ARCTIC_BLIZZARD_DURATION_SEC}
          flatDamagePerTick={ARCTIC_BLIZZARD_DAMAGE_PER_TICK}
          damageTickIntervalMs={ARCTIC_BLIZZARD_TICK_MS}
          hitRadius={ARCTIC_BLIZZARD_HIT_RADIUS}
          visualPreset="concentrated"
          onHitTarget={handleBlizzardHit}
          onComplete={() => setStorms((prev) => prev.filter((x) => x.id !== s.id))}
        />
      ))}
    </>
  );
}
