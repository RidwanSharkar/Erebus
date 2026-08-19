import { Vector3 } from 'three';
import type { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import { Enemy, EnemyType } from '@/ecs/components/Enemy';
import { DestructibleRoot } from '@/ecs/components/DestructibleRoot';
import { DestructibleRock } from '@/ecs/components/DestructibleRock';
import { DestructibleSpine } from '@/ecs/components/DestructibleSpine';
import { DestructibleTree } from '@/ecs/components/DestructibleTree';
import { isCoopPlayerAllyEntity } from '@/utils/coopAllyTargeting';

export type ViperExplosionTarget = {
  id: string;
  position: Vector3;
  maxHealth?: number;
  isBoss?: boolean;
};

function pushExplosionTargetIfInRadius(
  entity: import('@/ecs/Entity').Entity,
  cx: number,
  cz: number,
  radiusSq: number,
  out: ViperExplosionTarget[],
): void {
  if (isCoopPlayerAllyEntity(entity)) return;

  const health = entity.getComponent(Health);
  if (!health || !health.enabled || health.isDead || health.currentHealth <= 0) return;
  if (entity.userData?.coopEnemyDying) return;

  const transform = entity.getComponent(Transform);
  if (!transform) return;

  const worldPos = transform.getWorldPosition();
  const dx = worldPos.x - cx;
  const dz = worldPos.z - cz;
  if (dx * dx + dz * dz > radiusSq) return;

  const ec = entity.getComponent(Enemy);
  out.push({
    id: entity.id.toString(),
    position: worldPos.clone(),
    maxHealth: health.maxHealth,
    isBoss: ec != null && ec.type === EnemyType.BOSS,
  });
}

/** Live ECS read for Explosive Talons detonation AoE (matches CombatSystem co-op guards). */
export function queryViperExplosionTargets(
  world: World,
  cx: number,
  cz: number,
  radius: number,
): ViperExplosionTarget[] {
  const radiusSq = radius * radius;
  const out: ViperExplosionTarget[] = [];
  const seen = new Set<number>();

  for (const entity of world.queryEntities([Transform, Health, Enemy])) {
    pushExplosionTargetIfInRadius(entity, cx, cz, radiusSq, out);
    seen.add(entity.id);
  }

  for (const entity of world.queryEntities([Transform, Health, DestructibleTree])) {
    if (seen.has(entity.id)) continue;
    pushExplosionTargetIfInRadius(entity, cx, cz, radiusSq, out);
    seen.add(entity.id);
  }

  for (const entity of world.queryEntities([Transform, Health, DestructibleRoot])) {
    if (seen.has(entity.id)) continue;
    pushExplosionTargetIfInRadius(entity, cx, cz, radiusSq, out);
  }

  for (const entity of world.queryEntities([Transform, Health, DestructibleRock])) {
    if (seen.has(entity.id)) continue;
    pushExplosionTargetIfInRadius(entity, cx, cz, radiusSq, out);
  }

  for (const entity of world.queryEntities([Transform, Health, DestructibleSpine])) {
    if (seen.has(entity.id)) continue;
    pushExplosionTargetIfInRadius(entity, cx, cz, radiusSq, out);
  }

  return out;
}
