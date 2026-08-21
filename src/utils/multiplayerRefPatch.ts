import type { MutableRefObject } from 'react';
import type { Enemy, Player } from '@/contexts/MultiplayerContext';

/** Patch enemy fields in-place on the live ref (no React setState). */
export function patchEnemyRef(
  enemiesRef: MutableRefObject<Map<string, Enemy>>,
  enemyId: string,
  patch: Partial<Enemy>,
): boolean {
  const enemy = enemiesRef.current.get(enemyId);
  if (!enemy) return false;
  Object.assign(enemy, patch);
  return true;
}

/** Patch player fields in-place on the live ref (no React setState). */
export function patchPlayerRef(
  playersRef: MutableRefObject<Map<string, Player>>,
  playerId: string,
  patch: Partial<Player>,
): boolean {
  const player = playersRef.current.get(playerId);
  if (!player) return false;
  Object.assign(player, patch);
  return true;
}

/** Sync roster React state map from ref after in-place ref patches (spawn/despawn/kill only). */
export function cloneEnemyRosterFromRef(
  enemiesRef: MutableRefObject<Map<string, Enemy>>,
): Map<string, Enemy> {
  return new Map(enemiesRef.current);
}

export function clonePlayerRosterFromRef(
  playersRef: MutableRefObject<Map<string, Player>>,
): Map<string, Player> {
  return new Map(playersRef.current);
}

export type ExploreHarvestHealth = {
  maxHealth: number;
  exploreHealth: Record<number, number>;
};

/** Mutate HP in place on hit; copy the record only when health reaches 0. */
export function applyExploreHarvestHealth(
  prev: ExploreHarvestHealth | null,
  index: number,
  newHealth: number,
  fallbackMaxHealth: number,
  incomingMaxHealth?: number,
): ExploreHarvestHealth {
  const maxHealth = incomingMaxHealth ?? prev?.maxHealth ?? fallbackMaxHealth;
  if (newHealth <= 0) {
    return {
      maxHealth,
      exploreHealth: { ...(prev?.exploreHealth ?? {}), [index]: 0 },
    };
  }
  if (prev) {
    if (!prev.exploreHealth) prev.exploreHealth = {};
    prev.exploreHealth[index] = newHealth;
    if (incomingMaxHealth != null && incomingMaxHealth !== prev.maxHealth) {
      return { maxHealth: incomingMaxHealth, exploreHealth: prev.exploreHealth };
    }
    return prev;
  }
  return { maxHealth, exploreHealth: { [index]: newHealth } };
}

export type ExploreMushroomHealthState = {
  health: number[];
  maxHealth: number;
  exploreHealth?: Record<number, number>;
};

export function applyExploreMushroomHealth(
  prev: ExploreMushroomHealthState | null,
  index: number,
  newHealth: number,
  fallbackMaxHealth: number,
  incomingMaxHealth?: number,
): ExploreMushroomHealthState {
  const maxHealth = incomingMaxHealth ?? prev?.maxHealth ?? fallbackMaxHealth;
  if (newHealth <= 0) {
    return {
      health: prev?.health ?? [],
      maxHealth,
      exploreHealth: { ...(prev?.exploreHealth ?? {}), [index]: 0 },
    };
  }
  if (prev) {
    if (!prev.exploreHealth) prev.exploreHealth = {};
    prev.exploreHealth[index] = newHealth;
    return prev;
  }
  return { health: [], maxHealth, exploreHealth: { [index]: newHealth } };
}
