import type { Vector3 } from '@/utils/three-exports';

export type SabresAvalancheSpawner = (enemyId: string, position: Vector3) => void;

let sabresAvalancheSpawner: SabresAvalancheSpawner | null = null;

export function setSabresAvalancheSpawner(fn: SabresAvalancheSpawner | null): void {
  sabresAvalancheSpawner = fn;
}

/** Invoked from ControlSystem when Frost Affinity Sabres LMB hits an enemy. */
export function spawnSabresAvalancheOnEnemyFromReact(
  enemyId: string,
  position: Vector3,
): void {
  sabresAvalancheSpawner?.(enemyId, position.clone());
}
