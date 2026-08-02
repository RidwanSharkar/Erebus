'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from '@/utils/three-exports';
import type { World } from '@/ecs/World';
import type { Entity } from '@/ecs/Entity';
import { Enemy } from '@/ecs/components/Enemy';
import { Health } from '@/ecs/components/Health';
import { Transform } from '@/ecs/components/Transform';
import { CombatSystem } from '@/systems/CombatSystem';
import {
  ARCTIC_BLIZZARD_DAMAGE_PER_TICK,
  ARCTIC_BLIZZARD_DURATION_SEC,
  ARCTIC_BLIZZARD_TICK_MS,
} from '@/utils/talents';
import { isCoopPlayerAllyEntity } from '@/utils/coopAllyTargeting';
import AvalancheEffect from './AvalancheEffect';
import { setSabresAvalancheSpawner } from './sabresAvalancheSpawnBridge';

export type AvalancheDebuff = {
  id: string;
  enemyId: string;
  expiresAtMs: number;
};

interface AvalancheEffectManagerProps {
  world: World | null;
  getDamagePerTick: () => number;
  /** MONSOON (duo: blue + purple) — each blizzard damage tick also applies 10 stagger. */
  hasMonsoon?: boolean;
}

/** MONSOON — stagger applied per avalanche damage tick (matches ArcticBlizzardManager). */
const MONSOON_STAGGER_PER_TICK = 10;

function findEnemyEntityForAvalanche(world: World, targetId: string): Entity | null {
  const candidates = world.queryEntities([Health, Enemy]);
  for (const e of candidates) {
    if (e.userData?.serverEnemyId === targetId) return e;
    if (e.id.toString() === targetId) return e;
  }
  return null;
}

/**
 * Frost Affinity Sabres avalanche debuffs — enemy-attached VFX + arctic blizzard tick damage.
 */
export default function AvalancheEffectManager({
  world,
  getDamagePerTick,
  hasMonsoon = false,
}: AvalancheEffectManagerProps) {
  const [debuffs, setDebuffs] = useState<AvalancheDebuff[]>([]);
  const debuffsRef = useRef(debuffs);
  debuffsRef.current = debuffs;

  const getDamagePerTickRef = useRef(getDamagePerTick);
  getDamagePerTickRef.current = getDamagePerTick;
  const hasMonsoonRef = useRef(hasMonsoon);
  hasMonsoonRef.current = hasMonsoon;

  /** Per-debuff last tick timestamp (ms). */
  const lastTickByEnemyRef = useRef<Map<string, number>>(new Map());
  const groupRefs = useRef<Map<string, Group>>(new Map());
  const scratchPos = useRef(new Vector3());

  const pushOrRefresh = useCallback(
    (enemyId: string, _position: Vector3) => {
      if (!world) return;
      const entity = findEnemyEntityForAvalanche(world, enemyId);
      if (entity && isCoopPlayerAllyEntity(entity)) return;

      const now = Date.now();
      const expiresAtMs = now + ARCTIC_BLIZZARD_DURATION_SEC * 1000;

      setDebuffs((prev) => {
        const existing = prev.find((d) => d.enemyId === enemyId);
        if (existing) {
          // Refresh duration only — keep same instance / VFX (no remount)
          return prev.map((d) =>
            d.enemyId === enemyId ? { ...d, expiresAtMs } : d,
          );
        }
        return [
          ...prev,
          {
            id: `avalanche-${enemyId}-${now}-${Math.random().toString(36).slice(2, 8)}`,
            enemyId,
            expiresAtMs,
          },
        ];
      });

      // Immediate first tick on apply (matches Blizzard lastDamageTime = 0)
      if (!lastTickByEnemyRef.current.has(enemyId)) {
        lastTickByEnemyRef.current.set(enemyId, now - ARCTIC_BLIZZARD_TICK_MS);
      }
    },
    [world],
  );

  useEffect(() => {
    setSabresAvalancheSpawner(pushOrRefresh);
    return () => setSabresAvalancheSpawner(null);
  }, [pushOrRefresh]);

  const dealTick = useCallback(
    (enemyId: string) => {
      if (!world) return;
      const combat = world.getSystem(CombatSystem) as CombatSystem | undefined;
      if (!combat) return;
      const entity = findEnemyEntityForAvalanche(world, enemyId);
      if (!entity) return;
      if (isCoopPlayerAllyEntity(entity)) return;
      const health = entity.getComponent(Health);
      if (!health || health.isDead) return;

      const localPlayer = (window as any).controlSystemRef?.current?.getPlayerEntity?.();
      const damage = getDamagePerTickRef.current() || ARCTIC_BLIZZARD_DAMAGE_PER_TICK;
      combat.queueDamageWithBlizzardArctic(
        entity,
        damage,
        localPlayer ?? undefined,
        localPlayer?.userData?.playerId,
        hasMonsoonRef.current ? MONSOON_STAGGER_PER_TICK : undefined,
      );
    },
    [world],
  );

  useFrame(() => {
    if (!world) return;
    const now = Date.now();
    const active = debuffsRef.current;
    if (active.length === 0) return;

    let needsPrune = false;

    for (const d of active) {
      if (now >= d.expiresAtMs) {
        needsPrune = true;
        lastTickByEnemyRef.current.delete(d.enemyId);
        continue;
      }

      const entity = findEnemyEntityForAvalanche(world, d.enemyId);
      if (!entity) {
        needsPrune = true;
        lastTickByEnemyRef.current.delete(d.enemyId);
        continue;
      }

      const health = entity.getComponent(Health);
      if (!health || health.isDead) {
        needsPrune = true;
        lastTickByEnemyRef.current.delete(d.enemyId);
        continue;
      }

      const transform = entity.getComponent(Transform);
      const group = groupRefs.current.get(d.enemyId);
      if (transform && group) {
        transform.getWorldPosition(scratchPos.current);
        group.position.copy(scratchPos.current);
      }

      const last = lastTickByEnemyRef.current.get(d.enemyId) ?? now;
      if (now - last >= ARCTIC_BLIZZARD_TICK_MS) {
        lastTickByEnemyRef.current.set(d.enemyId, now);
        dealTick(d.enemyId);
      }
    }

    if (needsPrune) {
      setDebuffs((prev) =>
        prev.filter((d) => {
          if (now >= d.expiresAtMs) return false;
          const entity = findEnemyEntityForAvalanche(world, d.enemyId);
          if (!entity) return false;
          const health = entity.getComponent(Health);
          return !!(health && !health.isDead);
        }),
      );
    }
  });

  return (
    <>
      {debuffs.map((d) => (
        <group
          key={d.id}
          ref={(el) => {
            if (el) groupRefs.current.set(d.enemyId, el);
            else groupRefs.current.delete(d.enemyId);
          }}
        >
          <AvalancheEffect />
        </group>
      ))}
    </>
  );
}
