export const ETERNITY_ENCOUNTER_ENTRY = Object.freeze({ x: 0, z: -10.5 });
export const ETERNITY_ENCOUNTER_MEET = Object.freeze({ x: 0, z: 3.5 });
/** Arc east of the center fountain so the Architect never cuts through it. */
export const ETERNITY_ENCOUNTER_WAYPOINTS: readonly { x: number; z: number }[] = [
  Object.freeze({ x: 3.5, z: -7 }),
  Object.freeze({ x: 3.5, z: 2 }),
  ETERNITY_ENCOUNTER_MEET,
];
export const ETERNITY_ENCOUNTER_WALK_SPEED = 2.4;
export const ETERNITY_ENCOUNTER_INTERACT_RADIUS = 2.75;

export interface EternityPalaceEncounterSnapshot {
  x: number;
  z: number;
  selectable: boolean;
}

export interface EternityPalaceEncounterRef {
  getSnapshot: () => EternityPalaceEncounterSnapshot | null;
}

export function isEternityPalaceLootSelectable(
  px: number,
  pz: number,
  encounterRef: EternityPalaceEncounterRef | null | undefined,
): boolean {
  const snap = encounterRef?.getSnapshot();
  if (!snap?.selectable) return false;
  const dx = px - snap.x;
  const dz = pz - snap.z;
  const r2 = ETERNITY_ENCOUNTER_INTERACT_RADIUS * ETERNITY_ENCOUNTER_INTERACT_RADIUS;
  return dx * dx + dz * dz <= r2;
}
