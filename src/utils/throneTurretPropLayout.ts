/**
 * Curated center-seal turret props for the throne prep / boss-arena shell.
 * Positions are in grass-local XZ (parented under THRONE_GRASS_POSITION).
 * Ring around the void portal (~r = 4.2), inside THRONE_CENTER_SEAL_RADIUS.
 */

export type ThroneTurretPropModel =
  | 'Gun_3'
  | 'Gun_4'
  | 'Gun_5'
  | 'Gun_6'
  | 'Cannon_5'
  | 'Cannon_6'
  | 'Cannon_7'
  | 'GearCannon_1';

export type ThroneTurretPropDef = {
  model: ThroneTurretPropModel;
  /** Grass-local position; Y is usually 0 — ground lift comes from model meta × scale. */
  position: [number, number, number];
  rotationY?: number;
  /** Multiplies the model’s defaultScale. */
  scale?: number;
};

/** Ground alignment + size. Target height ~1.5m after Assimp scale/translation normalize. */
export const TURRET_PROP_MODEL_META: Record<
  ThroneTurretPropModel,
  { groundY: number; defaultScale: number }
> = {
  Gun_3: { groundY: 0.9414, defaultScale: 0.53 },
  Gun_4: { groundY: 0.6884, defaultScale: 0.56 },
  Gun_5: { groundY: 0.7, defaultScale: 0.55 },
  Gun_6: { groundY: 0.7, defaultScale: 0.55 },
  Cannon_5: { groundY: 0.6884, defaultScale: 0.61 },
  Cannon_6: { groundY: 0.7, defaultScale: 0.58 },
  Cannon_7: { groundY: 0.7, defaultScale: 0.55 },
  GearCannon_1: { groundY: 0.7, defaultScale: 0.55 },
};

export const THRONE_TURRET_PROP_BASE_PATH = '/props/turrets/glb';

export function turretPropGlbUrl(model: ThroneTurretPropModel): string {
  return `${THRONE_TURRET_PROP_BASE_PATH}/${model}.glb`;
}

/**
 * Four turrets on the center seal, facing outward from the void portal.
 * Assumes model forward is +Z at rotationY = 0.
 */
export const THRONE_TURRET_PROP_LAYOUT: readonly ThroneTurretPropDef[] = [
  { model: 'GearCannon_1', position: [4.2, -0.5, 0], rotationY: Math.PI / 2, scale: 1.25 },
  { model: 'Cannon_6', position: [-4.2, -0.5, 0], rotationY: -Math.PI / 2, scale: 1.2 },
  { model: 'Cannon_7', position: [0, -0.5, 4.2], rotationY: 0, scale: 1.2 },
  { model: 'Cannon_5', position: [0, -0.5, -4.2], rotationY: Math.PI, scale: 1.2 },
];

export function listUniqueThroneTurretPropModels(
  layout: readonly ThroneTurretPropDef[] = THRONE_TURRET_PROP_LAYOUT,
): ThroneTurretPropModel[] {
  return Array.from(new Set(layout.map((p) => p.model)));
}
