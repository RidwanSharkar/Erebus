/**
 * Fae Realm decorative pylons: one GIANTSPINE (throne-scale) plus scattered
 * 1 / 3 / 6 / 13.glb props across the hex grass. Deterministic — stable for MP.
 */

export type FaeRealmDecorModel =
  | 'giantSpine'
  | 'pylon1'
  | 'pylon3'
  | 'pylon6'
  | 'pylon13';

export const FAE_REALM_DECOR_PATHS: Record<FaeRealmDecorModel, string> = {
  giantSpine: '/models/trinket/pylons/GIANTSPINE.glb',
  pylon1: '/models/trinket/pylons/1.glb',
  pylon3: '/models/trinket/pylons/3.glb',
  pylon6: '/models/trinket/pylons/6.glb',
  pylon13: '/models/trinket/pylons/13.glb',
};

export type FaeRealmDecorDef = {
  model: FaeRealmDecorModel;
  /** World position; Y is usually 0 — ground lift comes from model meta × scale. */
  position: [number, number, number];
  rotationY?: number;
  /** Multiplies the model’s defaultScale. */
  scale?: number;
};

/**
 * Per-model ground alignment (mesh feet sit at y = groundY × scale) and visual size.
 * Raw heights: GIANTSPINE ≈ 19.8m, 1 ≈ 4.65m, 3 ≈ 6.85m, 6 ≈ 6.05m, 13 ≈ 0.89m.
 * Numbered pylons target ~2.8–3.5m (rim 5.glb ≈ 3.5m); 13 is a shorter accent (~1.4m).
 */
export const FAE_REALM_DECOR_MODEL_META: Record<
  FaeRealmDecorModel,
  { groundY: number; defaultScale: number }
> = {
  giantSpine: { groundY: 2.385, defaultScale: 0.1 },
  pylon1: { groundY: 0.1937, defaultScale: 0.645 },
  pylon3: { groundY: 0.0789, defaultScale: 0.467 },
  pylon6: { groundY: 0.0403, defaultScale: 0.529 },
  pylon13: { groundY: 0.0458, defaultScale: 1.58 },
};

/** Fae grass plane Y (matches FaeRealmRoom perimeter pylons). */
export const FAE_REALM_DECOR_GROUND_Y = 0;

/**
 * Soft albedo fill for numbered charcoal pylons (matches rim 5.glb décor).
 * GIANTSPINE skips self-illumination (same as throne statues).
 */
export const FAE_REALM_NUMBERED_PYLON_SELF_ILLUMINATION = 0.45;

/**
 * 1× GIANTSPINE north of center + ~18 numbered pylons in an annulus r ≈ 6–14.
 * Clears center combat/portal (r ≥ 5) and rim 5.glb pylons (r ≤ 15).
 */
export const FAE_REALM_DECOR_LAYOUT: readonly FaeRealmDecorDef[] = [
  {
    model: 'giantSpine',
    position: [4.2, 0, 11.2],
    rotationY: Math.PI,
    scale: 0.9,
  },


];

export function listUniqueFaeRealmDecorModels(
  layout: readonly FaeRealmDecorDef[] = FAE_REALM_DECOR_LAYOUT,
): FaeRealmDecorModel[] {
  return Array.from(new Set(layout.map((p) => p.model)));
}

export function faeRealmDecorGlbUrl(model: FaeRealmDecorModel): string {
  return FAE_REALM_DECOR_PATHS[model];
}

export function isNumberedFaePylon(model: FaeRealmDecorModel): boolean {
  return model !== 'giantSpine';
}
