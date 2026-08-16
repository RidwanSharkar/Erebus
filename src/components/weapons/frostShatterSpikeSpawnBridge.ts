import type { Vector3 } from '@/utils/three-exports';

export type FrostShatterSpikeSpawner = (position: Vector3) => void;
export type FrostShatterSpikeBroadcaster = (position: Vector3) => void;

let frostShatterSpikeSpawner: FrostShatterSpikeSpawner | null = null;
let frostShatterSpikeBroadcaster: FrostShatterSpikeBroadcaster | null = null;

export function setFrostShatterSpikeSpawner(
  fn: FrostShatterSpikeSpawner | null,
): void {
  frostShatterSpikeSpawner = fn;
}

export function setFrostShatterSpikeBroadcaster(
  fn: FrostShatterSpikeBroadcaster | null,
): void {
  frostShatterSpikeBroadcaster = fn;
}

/** Invoked from CombatSystem when Frost Affinity Shatter should spawn React VFX. */
export function spawnFrostShatterSpike(position: Vector3): boolean {
  if (!frostShatterSpikeSpawner) return false;
  frostShatterSpikeSpawner(position.clone());
  return true;
}

/** Replicates a local Shatter to other players; no-op outside coop. */
export function broadcastFrostShatterSpike(position: Vector3): void {
  frostShatterSpikeBroadcaster?.(position.clone());
}
