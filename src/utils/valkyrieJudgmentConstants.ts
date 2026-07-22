/** Valkyrie Judgment — falling sword orientation and default timings (server payload overrides). */

export const VALKYRIE_JUDGMENT_CAST_MS = 1000;
export const VALKYRIE_JUDGMENT_HOVER_MS = 0;
export const VALKYRIE_JUDGMENT_FALL_MS = 400;
export const VALKYRIE_JUDGMENT_SKY_HEIGHT = 22;
export const VALKYRIE_JUDGMENT_IMPACT_BURST_MS = 320;

/** Titan Bladestorm points up: [-π/2, π/2, 0] — Judgment points down. */
export const VALKYRIE_JUDGMENT_SWORD_ROTATION: [number, number, number] = [
  Math.PI / 2,
  Math.PI / 2,
  0,
];
