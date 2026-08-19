/**
 * Explore-mode tree GLB variants. Variant is hashed from world XZ so every
 * client picks the same model at the same disc (no backend sync).
 *
 * Heights after bake (feet at y=0): dead ~36.6, brown ~29.4, blue ~64.3, forest ~20.2.
 * defaultScale targets ~4.5m at worldgen scale 1.0; worldgen still multiplies 0.85–1.4.
 */

export type ExploreTreeVariant = 0 | 1 | 2 | 3;

export type ExploreTreeInstance = {
  index: number;
  x: number;
  z: number;
  radius: number;
  scale: number;
  variant: ExploreTreeVariant;
};

export const EXPLORE_TREE_URLS = [
  '/models/environ/deadtree.glb',
  '/models/environ/browntree.glb',
  '/models/environ/deadtree.glb',
  '/models/environ/forestTree.glb',
] as const;

export const EXPLORE_TREE_META: readonly { groundY: number; defaultScale: number }[] = [
  { groundY: 0, defaultScale: 0.123 },
  { groundY: 0, defaultScale: 0.153 },
  { groundY: 0, defaultScale: 0.07 },
  { groundY: 0, defaultScale: 0.222 },
];

function hash2(seed: number, x: number, z: number): number {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export function exploreTreeVariant(x: number, z: number): ExploreTreeVariant {
  return (hash2(0x7e31, Math.round(x * 4), Math.round(z * 4)) % 4) as ExploreTreeVariant;
}
