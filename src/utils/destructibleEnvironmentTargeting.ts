import type { Entity } from '@/ecs/Entity';
import type { World } from '@/ecs/World';
import { DestructibleRock } from '@/ecs/components/DestructibleRock';
import { DestructibleRoot } from '@/ecs/components/DestructibleRoot';
import { DestructibleSpine } from '@/ecs/components/DestructibleSpine';
import { DestructibleTree } from '@/ecs/components/DestructibleTree';
import { Enemy } from '@/ecs/components/Enemy';
import { Health } from '@/ecs/components/Health';
import { Transform } from '@/ecs/components/Transform';
import { isCoopPlayerAllyEntity } from '@/utils/coopAllyTargeting';

/** True when an entity can receive weapon HP damage (enemies or explore trees/roots/rocks/spines). */
export function isWeaponHittableEntity(entity: Entity): boolean {
  if (isCoopPlayerAllyEntity(entity)) return false;
  if (entity.getComponent(DestructibleTree)) return true;
  if (entity.getComponent(DestructibleRoot)) return true;
  if (entity.getComponent(DestructibleRock)) return true;
  if (entity.getComponent(DestructibleSpine)) return true;
  if (entity.getComponent(Enemy)) return true;
  return false;
}

/** Live ECS targets for enemyData-style weapon lists (enemies + destructible env props). */
export function queryWeaponHittableEntities(world: World): Entity[] {
  const out: Entity[] = [];
  const seen = new Set<number>();

  for (const entity of world.queryEntities([Transform, Health, Enemy])) {
    if (!isWeaponHittableEntity(entity)) continue;
    const health = entity.getComponent(Health);
    if (!health || health.isDead || health.currentHealth <= 0) continue;
    if (entity.userData?.coopEnemyDying) continue;
    out.push(entity);
    seen.add(entity.id);
  }

  for (const entity of world.queryEntities([Transform, Health, DestructibleTree])) {
    if (seen.has(entity.id)) continue;
    if (!isWeaponHittableEntity(entity)) continue;
    const health = entity.getComponent(Health);
    if (!health || health.isDead || health.currentHealth <= 0) continue;
    out.push(entity);
    seen.add(entity.id);
  }

  for (const entity of world.queryEntities([Transform, Health, DestructibleRoot])) {
    if (seen.has(entity.id)) continue;
    if (!isWeaponHittableEntity(entity)) continue;
    const health = entity.getComponent(Health);
    if (!health || health.isDead || health.currentHealth <= 0) continue;
    out.push(entity);
    seen.add(entity.id);
  }

  for (const entity of world.queryEntities([Transform, Health, DestructibleRock])) {
    if (seen.has(entity.id)) continue;
    if (!isWeaponHittableEntity(entity)) continue;
    const health = entity.getComponent(Health);
    if (!health || health.isDead || health.currentHealth <= 0) continue;
    out.push(entity);
    seen.add(entity.id);
  }

  for (const entity of world.queryEntities([Transform, Health, DestructibleSpine])) {
    if (seen.has(entity.id)) continue;
    if (!isWeaponHittableEntity(entity)) continue;
    const health = entity.getComponent(Health);
    if (!health || health.isDead || health.currentHealth <= 0) continue;
    out.push(entity);
  }

  return out;
}

/** True when an entity is an explore harvest prop (tree/root/rock/spine). */
export function isDestructibleHarvestEntity(entity: Entity): boolean {
  return !!(
    entity.getComponent(DestructibleTree) ||
    entity.getComponent(DestructibleRoot) ||
    entity.getComponent(DestructibleRock) ||
    entity.getComponent(DestructibleSpine)
  );
}

/** Live ECS harvest props only (not enemies). */
export function queryDestructibleHarvestEntities(world: World): Entity[] {
  const out: Entity[] = [];
  const seen = new Set<number>();

  for (const entity of world.queryEntities([Transform, Health, DestructibleTree])) {
    if (!isWeaponHittableEntity(entity)) continue;
    const health = entity.getComponent(Health);
    if (!health || health.isDead || health.currentHealth <= 0) continue;
    out.push(entity);
    seen.add(entity.id);
  }

  for (const entity of world.queryEntities([Transform, Health, DestructibleRoot])) {
    if (seen.has(entity.id)) continue;
    if (!isWeaponHittableEntity(entity)) continue;
    const health = entity.getComponent(Health);
    if (!health || health.isDead || health.currentHealth <= 0) continue;
    out.push(entity);
    seen.add(entity.id);
  }

  for (const entity of world.queryEntities([Transform, Health, DestructibleRock])) {
    if (seen.has(entity.id)) continue;
    if (!isWeaponHittableEntity(entity)) continue;
    const health = entity.getComponent(Health);
    if (!health || health.isDead || health.currentHealth <= 0) continue;
    out.push(entity);
    seen.add(entity.id);
  }

  for (const entity of world.queryEntities([Transform, Health, DestructibleSpine])) {
    if (seen.has(entity.id)) continue;
    if (!isWeaponHittableEntity(entity)) continue;
    const health = entity.getComponent(Health);
    if (!health || health.isDead || health.currentHealth <= 0) continue;
    out.push(entity);
  }

  return out;
}
