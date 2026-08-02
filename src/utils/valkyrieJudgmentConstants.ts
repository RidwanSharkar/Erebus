/** Valkyrie Judgment — falling sword orientation and default timings (server payload overrides). */

export const VALKYRIE_JUDGMENT_CAST_MS = 750;
export const VALKYRIE_JUDGMENT_HOVER_MS = 0;
export const VALKYRIE_JUDGMENT_FALL_MS = 850;
export const VALKYRIE_JUDGMENT_SKY_HEIGHT = 18;
export const VALKYRIE_JUDGMENT_IMPACT_BURST_MS = 320;

export const VALKYRIE_JUDGMENT_MODEL_PATH = '/models/items/deathdealer0.glb';

// GLB model basis: horizontal (+X blade) → upright weapon (+Y blade) is [0, -π/2, π/2].
// Judgment should point into the ground during the fall, so flip 180° on X.
export const VALKYRIE_JUDGMENT_SWORD_ROTATION: [number, number, number] = [
  Math.PI,
  -Math.PI / 2,
  Math.PI / 2,
];

export const VALKYRIE_JUDGMENT_MODEL_SCALE = 1.45;
export const VALKYRIE_JUDGMENT_MODEL_POSITION: [number, number, number] = [0, 0.65, 0];
