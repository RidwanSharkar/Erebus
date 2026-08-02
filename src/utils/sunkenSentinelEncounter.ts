export const SENTINEL_ENCOUNTER_ENTRY = Object.freeze({ x: 0, z: -10.5 });
export const SENTINEL_ENCOUNTER_MEET = Object.freeze({ x: 0, z: 3.5 });
/** Arc east of the center fountain so the Architect never cuts through it. */
export const SENTINEL_ENCOUNTER_WAYPOINTS: readonly { x: number; z: number }[] = [
  Object.freeze({ x: 3.5, z: -7 }),
  Object.freeze({ x: 3.5, z: 2 }),
  SENTINEL_ENCOUNTER_MEET,
];
export const SENTINEL_ENCOUNTER_WALK_SPEED = 2.4;
export const SENTINEL_ENCOUNTER_INTERACT_RADIUS = 2.75;

export interface SunkenSentinelEncounterSnapshot {
  x: number;
  z: number;
  selectable: boolean;
}

export interface SunkenSentinelEncounterRef {
  getSnapshot: () => SunkenSentinelEncounterSnapshot | null;
}

export function isSunkenSentinelSelectable(
  px: number,
  pz: number,
  encounterRef: SunkenSentinelEncounterRef | null | undefined,
): boolean {
  const snap = encounterRef?.getSnapshot();
  if (!snap?.selectable) return false;
  const dx = px - snap.x;
  const dz = pz - snap.z;
  const r2 = SENTINEL_ENCOUNTER_INTERACT_RADIUS * SENTINEL_ENCOUNTER_INTERACT_RADIUS;
  return dx * dx + dz * dz <= r2;
}
