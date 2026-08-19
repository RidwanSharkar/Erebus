/** Must match `src/utils/exploreBuildings.ts` gameplay numbers. */

const EXPLORE_BUILDING_PLACE_MAX_DIST = 32;
const EXPLORE_BUILDING_FIRE_PIT_RANGE = 20;
const EXPLORE_MAX_TOWERS = 5;
const FIRE_PIT_HULL_RADIUS = 0.85;
const EXPLORE_TOWER_HULL_RADIUS = 1.4;
const RESEARCH_STATION_HULL_RADIUS = 1.6;
const SHRINE_HULL_RADIUS = 1.6;
const OBELISK_HULL_RADIUS = 1.5;
const SHIELD_BATTERY_HULL_RADIUS = FIRE_PIT_HULL_RADIUS;
const CATHEDRAL_HULL_RADIUS = 2.0;
const EXPLORE_SHIELD_BATTERY_HEAL_RANGE = 5;
const EXPLORE_SHIELD_BATTERY_HEAL_PER_SEC = 1;
const EXPLORE_CATHEDRAL_HP_BONUS = 250;
const EXPLORE_CATHEDRAL_GOLD = 4;
const EXPLORE_CATHEDRAL_GOLD_INTERVAL_MS = 5000;
const EXPLORE_CATHEDRAL_OFFER_COUNT = 4;

const EXPLORE_BUILDING_DEFS = Object.freeze({
  'fire-pit': Object.freeze({
    kind: 'fire-pit',
    label: 'Fire Pit',
    hotkey: 'F',
    woodCost: 10,
    maxHp: 50,
    hullRadius: FIRE_PIT_HULL_RADIUS,
    enabled: true,
  }),
  barracks: Object.freeze({
    kind: 'barracks',
    label: 'Spirit Lounge',
    hotkey: 'G',
    woodCost: 160,
    maxHp: 500,
    hullRadius: RESEARCH_STATION_HULL_RADIUS,
    enabled: true,
  }),
  'watch-tower': Object.freeze({
    kind: 'watch-tower',
    label: 'Watch Tower',
    hotkey: '1',
    woodCost: 100,
    maxHp: 250,
    hullRadius: EXPLORE_TOWER_HULL_RADIUS,
    enabled: true,
  }),
  tower: Object.freeze({
    kind: 'tower',
    label: 'Mage Tower',
    hotkey: '2',
    woodCost: 150,
    flowCost: 10,
    maxHp: 500,
    hullRadius: EXPLORE_TOWER_HULL_RADIUS,
    enabled: true,
  }),
  'siege-tower': Object.freeze({
    kind: 'siege-tower',
    label: 'Siege Tower',
    hotkey: '3',
    woodCost: 100,
    stoneCost: 100,
    maxHp: 750,
    hullRadius: EXPLORE_TOWER_HULL_RADIUS,
    enabled: true,
  }),
  'research-station': Object.freeze({
    kind: 'research-station',
    label: 'Research Station',
    hotkey: 'J',
    woodCost: 200,
    flowCost: 5,
    maxHp: 150,
    hullRadius: RESEARCH_STATION_HULL_RADIUS,
    enabled: true,
  }),
  shrine: Object.freeze({
    kind: 'shrine',
    label: 'Shrine',
    hotkey: 'K',
    woodCost: 0,
    stoneCost: 150,
    flowCost: 10,
    maxHp: 300,
    hullRadius: SHRINE_HULL_RADIUS,
    enabled: true,
  }),
  obelisk: Object.freeze({
    kind: 'obelisk',
    label: 'Obelisk',
    hotkey: 'L',
    woodCost: 100,
    stoneCost: 200,
    maxHp: 400,
    hullRadius: OBELISK_HULL_RADIUS,
    enabled: true,
  }),
  'shield-battery': Object.freeze({
    kind: 'shield-battery',
    label: 'Shield Battery',
    hotkey: 'M',
    woodCost: 25,
    stoneCost: 5,
    maxHp: 200,
    hullRadius: SHIELD_BATTERY_HULL_RADIUS,
    enabled: true,
  }),
  cathedral: Object.freeze({
    kind: 'cathedral',
    label: 'Cathedral',
    hotkey: 'N',
    woodCost: 100,
    stoneCost: 400,
    flowCost: 15,
    maxHp: 1000,
    hullRadius: CATHEDRAL_HULL_RADIUS,
    enabled: true,
  }),
});

const EXPLORE_BARRACKS_ALLY_GOLD_COST = 50;
const EXPLORE_BARRACKS_INTERACT_RADIUS = 3.5;
const EXPLORE_FIRE_PIT_INTERACT_RADIUS = 3.5;
const EXPLORE_FIRE_PIT_HEAL_MEAT_COST = 5;
const EXPLORE_FIRE_PIT_HEAL_SELF_HP = 80;
const EXPLORE_MEAT_STACK_CAP = 20;
const EXPLORE_HUNGER_MAX = 100;
const EXPLORE_HUNGER_GAIN_INTERVAL_MS = 5000;
const EXPLORE_HUNGER_STARVE_DPS = 1;
const EXPLORE_HUNGER_CRITICAL_AFTER_MS = 60000;
const EXPLORE_HUNGER_CRITICAL_DPS = 10;
const EXPLORE_RESEARCH_INTERACT_RADIUS = 3.5;
const EXPLORE_RESEARCH_FLOW_COST = 10;
const EXPLORE_STONE_BREAKER_FLOW_COST = 5;
const EXPLORE_GREATER_HARVEST_FLOW_COST = 15;
const EXPLORE_SPIRIT_LINEAGE_MAX_RANK = 4;
const EXPLORE_SPIRIT_LINEAGE_COSTS = Object.freeze([10, 15, 20, 25]);

function getExploreAllyCap(spiritLineageRank) {
  const rank = Math.max(0, Math.min(EXPLORE_SPIRIT_LINEAGE_MAX_RANK, Math.floor(Number(spiritLineageRank) || 0)));
  return 1 + rank;
}

function getSpiritLineageNextCost(spiritLineageRank) {
  const rank = Math.max(0, Math.floor(Number(spiritLineageRank) || 0));
  if (rank >= EXPLORE_SPIRIT_LINEAGE_MAX_RANK) return null;
  return EXPLORE_SPIRIT_LINEAGE_COSTS[rank] ?? null;
}

const EXPLORE_SHRINE_INTERACT_RADIUS = 3.5;
const EXPLORE_OBELISK_INTERACT_RADIUS = 3.5;
const EXPLORE_CATHEDRAL_INTERACT_RADIUS = 3.5;
const EXPLORE_OBELISK_TALENT_GOLD_COST = 500;

const EXPLORE_SHRINE_GIFT_IDS = Object.freeze(['inferno', 'tempest', 'abyss', 'plague']);

/** Class talent ids sold at the obelisk — matches RULEBOOK_CLASS_TALENTS. */
const EXPLORE_OBELISK_CLASS_TALENT_IDS = new Set([
  'TRINITY',
  'VENGEANCE',
  'CRUSADER',
  'WINDFURY',
  'BLIZZARD',
  'DOUBLE_STRIKE',
  'SPELLBLADE',
  'CYCLONE_RUSH',
  'BREATH_WEAPON',
  'MORTAL_STRIKE',
  'EXECUTIONER',
  'TITANS_GRIP',
  'RELENTLESS',
  'KILLSTREAK',
  'CRESCENT_BLADES',
  'VORPAL_GUST',
  'FAN_OF_KNIVES',
  'PARRY',
  'WIND_SHEAR',
  'DOUBLE_STAB',
  'PSIONIC_BLADES',
  'FIRE_AFFINITY',
  'TEMPEST_ROUNDS',
  'DUAL_COIL',
  'EXECUTE',
  'CONCENTRATED_VOLLEY',
  'EXPLOSIVE_TALONS',
  'GIANTKILLER',
  'HIGH_CALIBER',
  'TRIGGER_FINGER',
  'ENTANGLEMENT',
  'CLOUDKILL',
  'WYVERN_STING',
  'DOUBLE_TALONS',
  'ICEBEAM',
  'REAPER',
  'SHAMAN',
  'FROSTPATH',
  'SOLAR_RECHARGE',
  'SUPERCONDUCTOR',
  'ACCELERATOR',
  'HEALING_STREAM',
  'METEOR',
  'FRAGMENTATION',
  'ARCANE_SYNERGY',
]);

function getExploreBuildingDef(kind) {
  return EXPLORE_BUILDING_DEFS[kind] || null;
}

function isPlayerExploreBuildingType(type) {
  return type === 'fire-pit'
    || type === 'barracks'
    || type === 'tower'
    || type === 'watch-tower'
    || type === 'siege-tower'
    || type === 'research-station'
    || type === 'shrine'
    || type === 'obelisk'
    || type === 'shield-battery'
    || type === 'cathedral';
}

function isExploreTowerType(type) {
  return type === 'tower' || type === 'watch-tower' || type === 'siege-tower';
}

function isExploreUniqueReplaceKind(kind) {
  return kind === 'barracks' || kind === 'research-station';
}

function exploreBuildingRequiresFirePit(kind) {
  return kind === 'barracks'
    || kind === 'tower'
    || kind === 'watch-tower'
    || kind === 'siege-tower'
    || kind === 'research-station'
    || kind === 'shrine'
    || kind === 'obelisk'
    || kind === 'shield-battery'
    || kind === 'cathedral';
}

function exploreBuildingRequiresSpiritLounge(kind) {
  return kind === 'shrine' || kind === 'obelisk';
}

function exploreBuildingRequiresShrineOrObelisk(kind) {
  return kind === 'cathedral';
}

function isExploreShrineGiftId(value) {
  return EXPLORE_SHRINE_GIFT_IDS.includes(value);
}

function isExploreObeliskClassTalentId(value) {
  return typeof value === 'string' && EXPLORE_OBELISK_CLASS_TALENT_IDS.has(value);
}

module.exports = {
  EXPLORE_BUILDING_PLACE_MAX_DIST,
  EXPLORE_BUILDING_FIRE_PIT_RANGE,
  EXPLORE_MAX_TOWERS,
  FIRE_PIT_HULL_RADIUS,
  EXPLORE_TOWER_HULL_RADIUS,
  RESEARCH_STATION_HULL_RADIUS,
  SHRINE_HULL_RADIUS,
  OBELISK_HULL_RADIUS,
  SHIELD_BATTERY_HULL_RADIUS,
  CATHEDRAL_HULL_RADIUS,
  EXPLORE_SHIELD_BATTERY_HEAL_RANGE,
  EXPLORE_SHIELD_BATTERY_HEAL_PER_SEC,
  EXPLORE_CATHEDRAL_HP_BONUS,
  EXPLORE_CATHEDRAL_GOLD,
  EXPLORE_CATHEDRAL_GOLD_INTERVAL_MS,
  EXPLORE_CATHEDRAL_OFFER_COUNT,
  EXPLORE_BUILDING_DEFS,
  EXPLORE_BARRACKS_ALLY_GOLD_COST,
  EXPLORE_BARRACKS_INTERACT_RADIUS,
  EXPLORE_FIRE_PIT_INTERACT_RADIUS,
  EXPLORE_FIRE_PIT_HEAL_MEAT_COST,
  EXPLORE_FIRE_PIT_HEAL_SELF_HP,
  EXPLORE_MEAT_STACK_CAP,
  EXPLORE_HUNGER_MAX,
  EXPLORE_HUNGER_GAIN_INTERVAL_MS,
  EXPLORE_HUNGER_STARVE_DPS,
  EXPLORE_HUNGER_CRITICAL_AFTER_MS,
  EXPLORE_HUNGER_CRITICAL_DPS,
  EXPLORE_RESEARCH_INTERACT_RADIUS,
  EXPLORE_RESEARCH_FLOW_COST,
  EXPLORE_STONE_BREAKER_FLOW_COST,
  EXPLORE_GREATER_HARVEST_FLOW_COST,
  EXPLORE_SPIRIT_LINEAGE_MAX_RANK,
  EXPLORE_SPIRIT_LINEAGE_COSTS,
  EXPLORE_SHRINE_INTERACT_RADIUS,
  EXPLORE_OBELISK_INTERACT_RADIUS,
  EXPLORE_CATHEDRAL_INTERACT_RADIUS,
  EXPLORE_OBELISK_TALENT_GOLD_COST,
  getExploreBuildingDef,
  isPlayerExploreBuildingType,
  isExploreTowerType,
  isExploreUniqueReplaceKind,
  exploreBuildingRequiresFirePit,
  exploreBuildingRequiresSpiritLounge,
  exploreBuildingRequiresShrineOrObelisk,
  getExploreAllyCap,
  getSpiritLineageNextCost,
  isExploreShrineGiftId,
  isExploreObeliskClassTalentId,
};
