/**
 * Prep / boss-arena throne statues: small Deathwing + GIANTSPINE pair on the north grass.
 * Positions are world-space (parented at throne-room root).
 */

export type ThroneStatueModel = 'deathwing' | 'giantSpine';

export const THRONE_STATUE_PATHS: Record<ThroneStatueModel, string> = {
  deathwing: '/models/trinket/Deathwing.glb',
  giantSpine: '/models/trinket/pylons/GIANTSPINE.glb',
};

export type ThroneStatueDef = {
  model: ThroneStatueModel;
  /** World position; Y is usually 0 — ground lift comes from model meta × scale. */
  position: [number, number, number];
  rotationY?: number;
  /** Multiplies the model’s defaultScale. */
  scale?: number;
};

/**
 * Per-model ground alignment (mesh feet sit at y = groundY × scale) and visual size.
 * Raw GLB heights: Deathwing ≈ 22.6m, GIANTSPINE ≈ 19.8m.
 * Scales target ~2.0m decorative statues.
 */
export const THRONE_STATUE_MODEL_META: Record<
  ThroneStatueModel,
  { groundY: number; defaultScale: number }
> = {
  deathwing: { groundY: 2.784, defaultScale: 0.19 },
  giantSpine: { groundY: 2.385, defaultScale: 0.1 },
};

/** Grass disc Y — statue feet sit on this plane (matches center decor shards). */
export const THRONE_STATUE_GROUND_Y = 0.13;

/**
 * North-center pair (z ≈ 9), facing the seal (−Z).
 * ~3.2m X gap so they read as adjacent statues.
 */
export const THRONE_STATUE_LAYOUT: readonly ThroneStatueDef[] = [

  {
    model: 'giantSpine',
    position: [4.33, 0, 11.0],
    rotationY: Math.PI,
    scale: 0.9,
  },
];

export function listUniqueThroneStatueModels(
  layout: readonly ThroneStatueDef[] = THRONE_STATUE_LAYOUT,
): ThroneStatueModel[] {
  return Array.from(new Set(layout.map((p) => p.model)));
}

export function throneStatueGlbUrl(model: ThroneStatueModel): string {
  return THRONE_STATUE_PATHS[model];
}
