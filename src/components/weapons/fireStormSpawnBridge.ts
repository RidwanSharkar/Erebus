import type { Vector3 } from '@/utils/three-exports';

export type FireStormSpawner = (position: Vector3) => void;

let fireStormSpawner: FireStormSpawner | null = null;

export function setFireStormSpawner(fn: FireStormSpawner | null): void {
  fireStormSpawner = fn;
}

/** Invoked from ControlSystem when Fire Affinity should spawn React VFX. */
export function triggerGlobalFireStorm(position: Vector3): boolean {
  if (!fireStormSpawner) return false;
  fireStormSpawner(position.clone());
  return true;
}
