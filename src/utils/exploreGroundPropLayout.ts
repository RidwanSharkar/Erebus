/**
 * Explore-mode ground props (roots + GIANTSPINE). Positions come from worldgen;
 * these constants only control GLB URL, ground alignment, and visual size.
 *
 * root.glb baked height ~7.48m (feet at y=0); defaultScale targets ~2.0m at scale 1.0.
 * GIANTSPINE reuses Fae/throne meta (raw ~19.8m, defaultScale 0.1 → ~2m) plus a
 * visual multiplier so explore instances read as sparse landmarks.
 */

export type ExploreRootInstance = {
  index: number;
  x: number;
  z: number;
  radius: number;
  scale: number;
};

export const EXPLORE_ROOT_URL = '/models/environ/root.glb';
export const EXPLORE_ROOT_META = { groundY: 0, defaultScale: 0.167 } as const;
/** Visual-only multiplier; collision still uses worldgen disc radius. */
export const EXPLORE_ROOT_VISUAL_SCALE = 1.35;

export const EXPLORE_SPINE_URL = '/models/trinket/pylons/GIANTSPINE.glb';
export const EXPLORE_SPINE_META = { groundY: 2.385, defaultScale: 0.035 } as const;
/** Visual-only multiplier; collision still uses worldgen disc radius. */
export const EXPLORE_SPINE_VISUAL_SCALE = 2.0;
