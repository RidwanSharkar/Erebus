import type { Vector3 } from '@/utils/three-exports';

export type FrostShatterSpikeSpawner = (position: Vector3) => void;

let frostShatterSpikeSpawner: FrostShatterSpikeSpawner | null = null;

export function setFrostShatterSpikeSpawner(
  fn: FrostShatterSpikeSpawner | null,
): void {
  frostShatterSpikeSpawner = fn;
}

/** Invoked from CombatSystem when Frost Affinity Shatter should spawn React VFX. */
export function spawnFrostShatterSpike(position: Vector3): boolean {
  if (!frostShatterSpikeSpawner) return false;
  frostShatterSpikeSpawner(position.clone());
  return true;
}
