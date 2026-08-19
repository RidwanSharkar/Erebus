/** Explore destructible trees — keep numeric values in sync with `backend/exploreTreeConstants.js`. */

/** Legacy flat cap; per-tree max HP uses `exploreTreeMaxHpFromScale`. */
export const EXPLORE_TREE_MAX_HP = 750;
export const EXPLORE_TREE_MAX_DAMAGE_PER_HIT = 1500;

/** Server accepts tree damage when player is within this XZ distance of the tree trunk. */
export const EXPLORE_TREE_DAMAGE_RANGE = 24;

/** Worldgen scale range (`0.85 + rand() * 0.55`). */
export const EXPLORE_TREE_SCALE_MIN = 0.85;
export const EXPLORE_TREE_SCALE_RANGE = 0.55;

/** HP range by worldgen scale (matches wood drop scaling). */
export const EXPLORE_TREE_HP_MIN = 250;
export const EXPLORE_TREE_HP_MAX = 750;

/** Trunk-plus combat hit radius by scale (not full canopy). */
export const EXPLORE_TREE_COMBAT_RADIUS_MIN = 1.7;
export const EXPLORE_TREE_COMBAT_RADIUS_MAX = 2.3;

/** Y center for combat collider / melee aim point. */
export const EXPLORE_TREE_COMBAT_CENTER_Y = 2.0;

function exploreTreeScaleT(scale: number): number {
  return Math.max(0, Math.min(1, (scale - EXPLORE_TREE_SCALE_MIN) / EXPLORE_TREE_SCALE_RANGE));
}

export function exploreTreeMaxHpFromScale(scale: number): number {
  const t = exploreTreeScaleT(scale);
  return Math.round(EXPLORE_TREE_HP_MIN + t * (EXPLORE_TREE_HP_MAX - EXPLORE_TREE_HP_MIN));
}

export function exploreTreeCombatRadius(scale: number): number {
  const t = exploreTreeScaleT(scale);
  return EXPLORE_TREE_COMBAT_RADIUS_MIN + t * (EXPLORE_TREE_COMBAT_RADIUS_MAX - EXPLORE_TREE_COMBAT_RADIUS_MIN);
}

/** Wood [min, max] by variant: dead, brown, blue, forest. */
export const EXPLORE_TREE_WOOD_BY_VARIANT: readonly (readonly [number, number])[] = [
  [30, 70],
  [30, 80],
  [50, 90],
  [20, 40],
];

export function exploreTreeWoodFromScale(variant: number, scale: number): number {
  const range = EXPLORE_TREE_WOOD_BY_VARIANT[variant] ?? EXPLORE_TREE_WOOD_BY_VARIANT[0]!;
  const t = Math.max(0, Math.min(1, (scale - EXPLORE_TREE_SCALE_MIN) / EXPLORE_TREE_SCALE_RANGE));
  return Math.round(range[0] + t * (range[1] - range[0]));
}

/** Flat wood bonus from wilderness level (1–4), applied to trees and roots. */
export function exploreWildernessWoodBonus(level: number): number {
  return (Math.min(4, Math.max(1, Math.floor(level) || 1)) - 1) * 20;
}

/** Explore destructible roots — keep numeric values in sync with `backend/exploreTreeConstants.js`. */

export const EXPLORE_ROOT_MAX_HP = 500;
export const EXPLORE_ROOT_HP_MIN = 250;
export const EXPLORE_ROOT_HP_MAX = 500;
export const EXPLORE_ROOT_WOOD_MIN = 20;
export const EXPLORE_ROOT_WOOD_MAX = 40;
export const EXPLORE_ROOT_COMBAT_RADIUS_MIN = 1.2;
export const EXPLORE_ROOT_COMBAT_RADIUS_MAX = 1.8;
export const EXPLORE_ROOT_COMBAT_CENTER_Y = 1.0;
export const EXPLORE_ROOT_DAMAGE_RANGE = EXPLORE_TREE_DAMAGE_RANGE;
export const EXPLORE_ROOT_MAX_DAMAGE_PER_HIT = EXPLORE_TREE_MAX_DAMAGE_PER_HIT;

export function exploreRootMaxHpFromScale(scale: number): number {
  const t = exploreTreeScaleT(scale);
  return Math.round(EXPLORE_ROOT_HP_MIN + t * (EXPLORE_ROOT_HP_MAX - EXPLORE_ROOT_HP_MIN));
}

export function exploreRootCombatRadius(scale: number): number {
  const t = exploreTreeScaleT(scale);
  return EXPLORE_ROOT_COMBAT_RADIUS_MIN + t * (EXPLORE_ROOT_COMBAT_RADIUS_MAX - EXPLORE_ROOT_COMBAT_RADIUS_MIN);
}

export function exploreRootWoodFromScale(scale: number): number {
  const t = exploreTreeScaleT(scale);
  return Math.round(EXPLORE_ROOT_WOOD_MIN + t * (EXPLORE_ROOT_WOOD_MAX - EXPLORE_ROOT_WOOD_MIN));
}

/** Explore destructible rocks — keep numeric values in sync with `backend/exploreTreeConstants.js`. */

/** Worldgen rock scale range `(0.5 + rand() * 0.9) * 2` → ~1.0–2.8. */
export const EXPLORE_ROCK_SCALE_MIN = 1.0;
export const EXPLORE_ROCK_SCALE_RANGE = 1.8;

export const EXPLORE_ROCK_HP_MIN = 1500;
export const EXPLORE_ROCK_HP_MAX = 3000;
export const EXPLORE_ROCK_STONE_MIN = 50;
export const EXPLORE_ROCK_STONE_MAX = 100;
export const EXPLORE_ROCK_COMBAT_CENTER_Y = 0.85;
export const EXPLORE_ROCK_DAMAGE_RANGE = EXPLORE_TREE_DAMAGE_RANGE;
export const EXPLORE_ROCK_MAX_DAMAGE_PER_HIT = EXPLORE_TREE_MAX_DAMAGE_PER_HIT;

function exploreRockScaleT(scale: number): number {
  return Math.max(0, Math.min(1, (scale - EXPLORE_ROCK_SCALE_MIN) / EXPLORE_ROCK_SCALE_RANGE));
}

export function exploreRockMaxHpFromScale(scale: number): number {
  const t = exploreRockScaleT(scale);
  return Math.round(EXPLORE_ROCK_HP_MIN + t * (EXPLORE_ROCK_HP_MAX - EXPLORE_ROCK_HP_MIN));
}

export function exploreRockCombatRadius(discRadius: number): number {
  return Math.max(0.85, discRadius * 0.95);
}

export function exploreRockStoneFromScale(scale: number): number {
  const t = exploreRockScaleT(scale);
  return Math.round(EXPLORE_ROCK_STONE_MIN + t * (EXPLORE_ROCK_STONE_MAX - EXPLORE_ROCK_STONE_MIN));
}

/** Flat stone bonus from wilderness level (1–4), applied to rocks. */
export function exploreWildernessStoneBonus(level: number): number {
  return (Math.min(4, Math.max(1, Math.floor(level) || 1)) - 1) * 30;
}

/** Explore destructible GIANTSPINE — keep numeric values in sync with `backend/exploreTreeConstants.js`. */

/** Worldgen spine scale range `0.7 + rand() * 1.1` → ~0.7–1.8. */
export const EXPLORE_SPINE_SCALE_MIN = 0.7;
export const EXPLORE_SPINE_SCALE_RANGE = 1.1;

export const EXPLORE_SPINE_HP_MIN = 500;
export const EXPLORE_SPINE_HP_MAX = 1000;
export const EXPLORE_SPINE_FLOW_MIN = 10;
export const EXPLORE_SPINE_FLOW_MAX = 20;
export const EXPLORE_SPINE_COMBAT_CENTER_Y = 1.6;
export const EXPLORE_SPINE_DAMAGE_RANGE = EXPLORE_TREE_DAMAGE_RANGE;
export const EXPLORE_SPINE_MAX_DAMAGE_PER_HIT = EXPLORE_TREE_MAX_DAMAGE_PER_HIT;

function exploreSpineScaleT(scale: number): number {
  return Math.max(0, Math.min(1, (scale - EXPLORE_SPINE_SCALE_MIN) / EXPLORE_SPINE_SCALE_RANGE));
}

export function exploreSpineMaxHpFromScale(scale: number): number {
  const t = exploreSpineScaleT(scale);
  return Math.round(EXPLORE_SPINE_HP_MIN + t * (EXPLORE_SPINE_HP_MAX - EXPLORE_SPINE_HP_MIN));
}

export function exploreSpineCombatRadius(discRadius: number): number {
  return Math.max(1.0, discRadius * 0.9);
}

export function exploreSpineFlowFromScale(scale: number): number {
  const t = exploreSpineScaleT(scale);
  return Math.round(EXPLORE_SPINE_FLOW_MIN + t * (EXPLORE_SPINE_FLOW_MAX - EXPLORE_SPINE_FLOW_MIN));
}
