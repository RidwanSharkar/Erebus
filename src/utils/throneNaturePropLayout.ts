/**
 * Curated outer-ring nature props for the throne prep / boss-arena shell.
 * Positions are in grass-local XZ (parented under THRONE_GRASS_POSITION).
 * Radius band ≈ 11–14.5 — outside the center seal, clear of pillars / south portals.
 */

export type ThroneNaturePropModel =
  | 'TwistedTree_1'
  | 'CommonTree_2'
  | 'Pine_3'
  | 'DeadTree_1'
  | 'DeadTree_3'
  | 'Bush_Common'
  | 'Bush_Common_Flowers'
  | 'Rock_Medium_1'
  | 'Rock_Medium_2'
  | 'Pebble_Round_1'
  | 'Pebble_Round_3'
  | 'Fern_1'
  | 'Plant_1'
  | 'Flower_3_Group';

export type ThroneNaturePropDef = {
  model: ThroneNaturePropModel;
  /** Grass-local position; Y is usually 0 — ground lift comes from model meta × scale. */
  position: [number, number, number];
  rotationY?: number;
  /** Multiplies the model’s defaultScale. */
  scale?: number;
};

/** Per-model ground alignment (mesh feet sit at y = groundY × scale) and visual size.
 *  Scales assume Assimp’s FBX node scale=100 has been normalized to 1 at load time.
 *  Target heights for a 15m throne disc: trees ~3.5–4.5m, bushes ~1m, rocks ~0.8m.
 */
export const NATURE_PROP_MODEL_META: Record<
  ThroneNaturePropModel,
  { groundY: number; defaultScale: number }
> = {
  TwistedTree_1: { groundY: 4.8226, defaultScale: 0.32 },
  CommonTree_2: { groundY: 2.4244, defaultScale: 0.85 },
  Pine_3: { groundY: 1.7035, defaultScale: 0.95 },
  DeadTree_1: { groundY: 2.8452, defaultScale: 0.65 },
  DeadTree_3: { groundY: 3.0434, defaultScale: 0.6 },
  Bush_Common: { groundY: 0.9908, defaultScale: 0.55 },
  Bush_Common_Flowers: { groundY: 0.9908, defaultScale: 0.55 },
  Rock_Medium_1: { groundY: 1.8393, defaultScale: 0.28 },
  Rock_Medium_2: { groundY: 1.3199, defaultScale: 0.32 },
  Pebble_Round_1: { groundY: 0.2074, defaultScale: 0.9 },
  Pebble_Round_3: { groundY: 0.2633, defaultScale: 0.85 },
  Fern_1: { groundY: 4.3961, defaultScale: 0.1 },
  Plant_1: { groundY: 0.6224, defaultScale: 0.7 },
  Flower_3_Group: { groundY: 0.7894, defaultScale: 0.65 },
};

export const THRONE_NATURE_PROP_BASE_PATH = '/props/glb';

export function naturePropGlbUrl(model: ThroneNaturePropModel): string {
  return `${THRONE_NATURE_PROP_BASE_PATH}/${model}.glb`;
}

/**
 * ~20 hand-placed props on the outer grass annulus.
 * Avoids south-rim portals (±5.25, z≈-14.4 local), pillars (inner), and north pedestals.
 */
export const THRONE_NATURE_PROP_LAYOUT: readonly ThroneNaturePropDef[] = [
  // Live trees — NW / NE / SW / SE
  //{ model: 'TwistedTree_1', position: [-0.15, -2, -0.6], rotationY: 0.6, scale: 1.5 },
  //{ model: 'Pine_3', position: [-4.4, 0, -7.2], rotationY: 1.2, scale: 1 },

  // Dead trees — west / east mid-ring
  //{ model: 'DeadTree_1', position: [-0.15, -3, -10.6], rotationY: -0.4, scale: 1.5 },
 
  //{ model: 'Rock_Medium_1', position: [-3.8, 0, 4.6], rotationY: 1.4, scale: 0.85 },
  //{ model: 'Rock_Medium_1', position: [2.6, 0, -11.4], rotationY: -1.3, scale: 0.8 },

  { model: 'Flower_3_Group', position: [-5.0, -0.4, -7.1], rotationY: 1.0, scale: 1.075 },
  { model: 'Flower_3_Group', position: [2.0, -0.4, -8.3], rotationY: 2.0, scale: 0.95 },

  // Pebbles as ground dressing
 ];

export function listUniqueThroneNaturePropModels(
  layout: readonly ThroneNaturePropDef[] = THRONE_NATURE_PROP_LAYOUT,
): ThroneNaturePropModel[] {
  return Array.from(new Set(layout.map((p) => p.model)));
}
