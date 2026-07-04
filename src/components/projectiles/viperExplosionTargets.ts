import { Vector3 } from 'three';
import type { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import { Enemy, EnemyType } from '@/ecs/components/Enemy';
import { isCoopPlayerAllyEntity } from '@/utils/coopAllyTargeting';

export type ViperExplosionTarget = {
  id: string;
  position: Vector3;
  maxHealth?: number;
  isBoss?: boolean;
};

/** Live ECS read for Explosive Talons detonation AoE (matches CombatSystem co-op guards). */
export function queryViperExplosionTargets(
  world: World,
  cx: number,
  cz: number,
  radius: number,
): ViperExplosionTarget[] {
  const radiusSq = radius * radius;
  const out: ViperExplosionTarget[] = [];

  for (const entity of world.queryEntities([Transform, Health, Enemy])) {
    if (isCoopPlayerAllyEntity(entity)) continue;

    const health = entity.getComponent(Health);
    if (!health || !health.enabled || health.isDead || health.currentHealth <= 0) continue;
    if (entity.userData?.coopEnemyDying) continue;

    const transform = entity.getComponent(Transform);
    if (!transform) continue;

    const worldPos = transform.getWorldPosition();
    const dx = worldPos.x - cx;
    const dz = worldPos.z - cz;
    if (dx * dx + dz * dz > radiusSq) continue;

    const ec = entity.getComponent(Enemy);
    out.push({
      id: entity.id.toString(),
      position: worldPos.clone(),
      maxHealth: health.maxHealth,
      isBoss: ec != null && ec.type === EnemyType.BOSS,
    });
  }

  return out;
}
