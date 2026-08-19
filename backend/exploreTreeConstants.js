/** Must match `src/utils/exploreTreeConstants.ts` gameplay numbers. */

const EXPLORE_TREE_MAX_HP = 450;
const EXPLORE_TREE_MAX_DAMAGE_PER_HIT = 1500;
const EXPLORE_TREE_DAMAGE_RANGE = 32;
const EXPLORE_TREE_SCALE_MIN = 0.85;
const EXPLORE_TREE_SCALE_RANGE = 0.55;
const EXPLORE_TREE_HP_MIN = 225;
const EXPLORE_TREE_HP_MAX = 450;
const EXPLORE_TREE_COMBAT_RADIUS_MIN = 1.7;
const EXPLORE_TREE_COMBAT_RADIUS_MAX = 2.3;
const EXPLORE_TREE_WOOD_BY_VARIANT = [
  [30, 40],
  [20, 30],
  [40, 60],
  [10, 20],
];

function exploreTreeScaleT(scale) {
  return Math.max(0, Math.min(1, (Number(scale) - EXPLORE_TREE_SCALE_MIN) / EXPLORE_TREE_SCALE_RANGE));
}

function exploreTreeMaxHpFromScale(scale) {
  const t = exploreTreeScaleT(scale);
  return Math.round(EXPLORE_TREE_HP_MIN + t * (EXPLORE_TREE_HP_MAX - EXPLORE_TREE_HP_MIN));
}

function exploreTreeCombatRadius(scale) {
  const t = exploreTreeScaleT(scale);
  return EXPLORE_TREE_COMBAT_RADIUS_MIN + t * (EXPLORE_TREE_COMBAT_RADIUS_MAX - EXPLORE_TREE_COMBAT_RADIUS_MIN);
}

function exploreTreeWoodFromScale(variant, scale) {
  const range = EXPLORE_TREE_WOOD_BY_VARIANT[variant] || EXPLORE_TREE_WOOD_BY_VARIANT[0];
  const t = exploreTreeScaleT(scale);
  return Math.round(range[0] + t * (range[1] - range[0]));
}

const EXPLORE_ROOT_MAX_HP = 750;
const EXPLORE_ROOT_HP_MIN = 375;
const EXPLORE_ROOT_HP_MAX = 750;
const EXPLORE_ROOT_WOOD_MIN = 20;
const EXPLORE_ROOT_WOOD_MAX = 40;
const EXPLORE_ROOT_COMBAT_RADIUS_MIN = 1.2;
const EXPLORE_ROOT_COMBAT_RADIUS_MAX = 1.8;
const EXPLORE_ROOT_DAMAGE_RANGE = EXPLORE_TREE_DAMAGE_RANGE;
const EXPLORE_ROOT_MAX_DAMAGE_PER_HIT = EXPLORE_TREE_MAX_DAMAGE_PER_HIT;

function exploreRootMaxHpFromScale(scale) {
  const t = exploreTreeScaleT(scale);
  return Math.round(EXPLORE_ROOT_HP_MIN + t * (EXPLORE_ROOT_HP_MAX - EXPLORE_ROOT_HP_MIN));
}

function exploreRootCombatRadius(scale) {
  const t = exploreTreeScaleT(scale);
  return EXPLORE_ROOT_COMBAT_RADIUS_MIN + t * (EXPLORE_ROOT_COMBAT_RADIUS_MAX - EXPLORE_ROOT_COMBAT_RADIUS_MIN);
}

function exploreRootWoodFromScale(scale) {
  const t = exploreTreeScaleT(scale);
  return Math.round(EXPLORE_ROOT_WOOD_MIN + t * (EXPLORE_ROOT_WOOD_MAX - EXPLORE_ROOT_WOOD_MIN));
}

const EXPLORE_ROCK_SCALE_MIN = 1.0;
const EXPLORE_ROCK_SCALE_RANGE = 1.8;
const EXPLORE_ROCK_HP_MIN = 1500;
const EXPLORE_ROCK_HP_MAX = 3000;
const EXPLORE_ROCK_STONE_MIN = 50;
const EXPLORE_ROCK_STONE_MAX = 100;
const EXPLORE_ROCK_DAMAGE_RANGE = EXPLORE_TREE_DAMAGE_RANGE;
const EXPLORE_ROCK_MAX_DAMAGE_PER_HIT = EXPLORE_TREE_MAX_DAMAGE_PER_HIT;

function exploreRockScaleT(scale) {
  return Math.max(0, Math.min(1, (Number(scale) - EXPLORE_ROCK_SCALE_MIN) / EXPLORE_ROCK_SCALE_RANGE));
}

function exploreRockMaxHpFromScale(scale) {
  const t = exploreRockScaleT(scale);
  return Math.round(EXPLORE_ROCK_HP_MIN + t * (EXPLORE_ROCK_HP_MAX - EXPLORE_ROCK_HP_MIN));
}

function exploreRockCombatRadius(discRadius) {
  return Math.max(0.85, discRadius * 0.95);
}

function exploreRockStoneFromScale(scale) {
  const t = exploreRockScaleT(scale);
  return Math.round(EXPLORE_ROCK_STONE_MIN + t * (EXPLORE_ROCK_STONE_MAX - EXPLORE_ROCK_STONE_MIN));
}

const EXPLORE_SPINE_SCALE_MIN = 0.7;
const EXPLORE_SPINE_SCALE_RANGE = 1.1;
const EXPLORE_SPINE_HP_MIN = 500;
const EXPLORE_SPINE_HP_MAX = 1000;
const EXPLORE_SPINE_FLOW_MIN = 10;
const EXPLORE_SPINE_FLOW_MAX = 20;
const EXPLORE_SPINE_DAMAGE_RANGE = EXPLORE_TREE_DAMAGE_RANGE;
const EXPLORE_SPINE_MAX_DAMAGE_PER_HIT = EXPLORE_TREE_MAX_DAMAGE_PER_HIT;

function exploreSpineScaleT(scale) {
  return Math.max(0, Math.min(1, (Number(scale) - EXPLORE_SPINE_SCALE_MIN) / EXPLORE_SPINE_SCALE_RANGE));
}

function exploreSpineMaxHpFromScale(scale) {
  const t = exploreSpineScaleT(scale);
  return Math.round(EXPLORE_SPINE_HP_MIN + t * (EXPLORE_SPINE_HP_MAX - EXPLORE_SPINE_HP_MIN));
}

function exploreSpineCombatRadius(discRadius) {
  return Math.max(1.0, discRadius * 0.9);
}

function exploreSpineFlowFromScale(scale) {
  const t = exploreSpineScaleT(scale);
  return Math.round(EXPLORE_SPINE_FLOW_MIN + t * (EXPLORE_SPINE_FLOW_MAX - EXPLORE_SPINE_FLOW_MIN));
}

module.exports = {
  EXPLORE_TREE_MAX_HP,
  EXPLORE_TREE_MAX_DAMAGE_PER_HIT,
  EXPLORE_TREE_DAMAGE_RANGE,
  exploreTreeMaxHpFromScale,
  exploreTreeCombatRadius,
  exploreTreeWoodFromScale,
  EXPLORE_ROOT_MAX_HP,
  EXPLORE_ROOT_MAX_DAMAGE_PER_HIT,
  EXPLORE_ROOT_DAMAGE_RANGE,
  exploreRootMaxHpFromScale,
  exploreRootCombatRadius,
  exploreRootWoodFromScale,
  EXPLORE_ROCK_HP_MIN,
  EXPLORE_ROCK_HP_MAX,
  EXPLORE_ROCK_DAMAGE_RANGE,
  EXPLORE_ROCK_MAX_DAMAGE_PER_HIT,
  exploreRockMaxHpFromScale,
  exploreRockCombatRadius,
  exploreRockStoneFromScale,
  EXPLORE_SPINE_HP_MIN,
  EXPLORE_SPINE_HP_MAX,
  EXPLORE_SPINE_DAMAGE_RANGE,
  EXPLORE_SPINE_MAX_DAMAGE_PER_HIT,
  exploreSpineMaxHpFromScale,
  exploreSpineCombatRadius,
  exploreSpineFlowFromScale,
};
