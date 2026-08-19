/** Explore-mode player buildings — keep in sync with backend/exploreBuildings.js */

export type ExploreBuildingKind =
  | 'fire-pit'
  | 'barracks'
  | 'tower'
  | 'watch-tower'
  | 'siege-tower'
  | 'research-station'
  | 'shrine'
  | 'obelisk'
  | 'shield-battery';

export type ExploreBuildMenuView = 'root' | 'towers';

export interface ExploreBuildingDef {
  kind: ExploreBuildingKind;
  label: string;
  hotkey: string;
  woodCost: number;
  /** Optional stone cost on placement (siege tower). */
  stoneCost?: number;
  /** Optional Flow cost on placement (research station / mage tower). */
  flowCost?: number;
  maxHp: number;
  hullRadius: number;
  /** When false, shown in build menu but not placeable yet. */
  enabled: boolean;
}

export const EXPLORE_BUILDING_PLACE_MAX_DIST = 32;

/** Barracks / towers / research station must sit within this XZ range of a live fire pit. */
export const EXPLORE_BUILDING_FIRE_PIT_RANGE = 20;

/** Live explore towers (watch + mage + siege) allowed at once. */
export const EXPLORE_MAX_TOWERS = 4;

/** Collision / placement disc — slightly tighter than the visual fireplace footprint. */
export const FIRE_PIT_HULL_RADIUS = 0.85;

/** Matches defense tower hull — keep in sync with `DEFENSE_TOWER_HULL_RADIUS`. */
export const EXPLORE_TOWER_HULL_RADIUS = 1.4;

export const RESEARCH_STATION_HULL_RADIUS = 1.6;

/** Native shrine XZ ≈ 3.82 scaled to a 3.2-unit footprint. */
export const SHRINE_HULL_RADIUS = 1.6;

/** Native obelisk XZ ≈ 3.12 scaled to a 3.0-unit footprint. */
export const OBELISK_HULL_RADIUS = 1.5;

/** Matches fire-pit collision — small utility structure. */
export const SHIELD_BATTERY_HULL_RADIUS = FIRE_PIT_HULL_RADIUS;

/** XZ range of a live shield battery's structure heal aura. */
export const EXPLORE_SHIELD_BATTERY_HEAL_RANGE = 5;

/** HP restored per second per overlapping shield battery. */
export const EXPLORE_SHIELD_BATTERY_HEAL_PER_SEC = 1;

export const EXPLORE_TOWER_CATEGORY_HOTKEY = 'H';

export const EXPLORE_BUILDING_DEFS: Readonly<Record<ExploreBuildingKind, ExploreBuildingDef>> = Object.freeze({
  'fire-pit': {
    kind: 'fire-pit',
    label: 'Fire Pit',
    hotkey: 'F',
    woodCost: 10,
    maxHp: 50,
    hullRadius: FIRE_PIT_HULL_RADIUS,
    enabled: true,
  },
  barracks: {
    kind: 'barracks',
    label: 'Spirit Lounge',
    hotkey: 'G',
    woodCost: 160,
    maxHp: 500,
    hullRadius: 2.0,
    enabled: true,
  },
  'watch-tower': {
    kind: 'watch-tower',
    label: 'Watch Tower',
    hotkey: '1',
    woodCost: 100,
    maxHp: 250,
    hullRadius: EXPLORE_TOWER_HULL_RADIUS,
    enabled: true,
  },
  tower: {
    kind: 'tower',
    label: 'Mage Tower',
    hotkey: '2',
    woodCost: 150,
    flowCost: 10,
    maxHp: 500,
    hullRadius: EXPLORE_TOWER_HULL_RADIUS,
    enabled: true,
  },
  'siege-tower': {
    kind: 'siege-tower',
    label: 'Siege Tower',
    hotkey: '3',
    woodCost: 100,
    stoneCost: 100,
    maxHp: 750,
    hullRadius: EXPLORE_TOWER_HULL_RADIUS,
    enabled: true,
  },
  'research-station': {
    kind: 'research-station',
    label: 'Research Station',
    hotkey: 'J',
    woodCost: 200,
    flowCost: 5,
    maxHp: 150,
    hullRadius: RESEARCH_STATION_HULL_RADIUS,
    enabled: true,
  },
  shrine: {
    kind: 'shrine',
    label: 'Shrine',
    hotkey: 'K',
    woodCost: 0,
    stoneCost: 150,
    flowCost: 10,
    maxHp: 300,
    hullRadius: SHRINE_HULL_RADIUS,
    enabled: true,
  },
  obelisk: {
    kind: 'obelisk',
    label: 'Obelisk',
    hotkey: 'L',
    woodCost: 100,
    stoneCost: 200,
    maxHp: 400,
    hullRadius: OBELISK_HULL_RADIUS,
    enabled: true,
  },
  'shield-battery': {
    kind: 'shield-battery',
    label: 'Shield Battery',
    hotkey: 'M',
    woodCost: 25,
    stoneCost: 5,
    maxHp: 200,
    hullRadius: SHIELD_BATTERY_HULL_RADIUS,
    enabled: true,
  },
});

/** Root build-menu rows that place immediately (Tower is a category, not a kind). */
export const EXPLORE_BUILDING_ROOT_ORDER: readonly ExploreBuildingKind[] = [
  'fire-pit',
  'barracks',
  'research-station',
  'shrine',
  'obelisk',
  'shield-battery',
];

export const EXPLORE_TOWER_PICK_ORDER: readonly ExploreBuildingKind[] = [
  'watch-tower',
  'tower',
  'siege-tower',
];

export function getExploreBuildingDef(kind: ExploreBuildingKind): ExploreBuildingDef {
  return EXPLORE_BUILDING_DEFS[kind];
}

export function isPlayerExploreBuildingType(type: string | undefined | null): boolean {
  return type === 'fire-pit'
    || type === 'barracks'
    || type === 'tower'
    || type === 'watch-tower'
    || type === 'siege-tower'
    || type === 'research-station'
    || type === 'shrine'
    || type === 'obelisk'
    || type === 'shield-battery';
}

export function isExploreTowerType(type: string | undefined | null): boolean {
  return type === 'tower' || type === 'watch-tower' || type === 'siege-tower';
}

export function isExploreUniqueReplaceKind(kind: ExploreBuildingKind): boolean {
  return kind === 'barracks' || kind === 'research-station';
}

export function exploreBuildingRequiresFirePit(kind: ExploreBuildingKind): boolean {
  return kind === 'barracks'
    || kind === 'tower'
    || kind === 'watch-tower'
    || kind === 'siege-tower'
    || kind === 'research-station'
    || kind === 'shrine'
    || kind === 'obelisk'
    || kind === 'shield-battery';
}

export function exploreBuildingRequiresSpiritLounge(kind: ExploreBuildingKind): boolean {
  return kind === 'shrine' || kind === 'obelisk';
}

export function isWithinExploreFirePitRange(
  x: number,
  z: number,
  firePits: readonly { x: number; z: number }[],
  range: number = EXPLORE_BUILDING_FIRE_PIT_RANGE,
): boolean {
  const r2 = range * range;
  for (const pit of firePits) {
    const dx = pit.x - x;
    const dz = pit.z - z;
    if (dx * dx + dz * dz <= r2) return true;
  }
  return false;
}

/** Gold cost to recruit one ally at a barracks in explore mode. */
export const EXPLORE_BARRACKS_ALLY_GOLD_COST = 50;

/** Interact radius to open barracks recruit UI. */
export const EXPLORE_BARRACKS_INTERACT_RADIUS = 3.5;

/** Interact radius to open fire-pit cook UI. */
export const EXPLORE_FIRE_PIT_INTERACT_RADIUS = 3.5;

/** Meat spent per fire-pit cook action. */
export const EXPLORE_FIRE_PIT_HEAL_MEAT_COST = 5;

/** HP restored to the cooking player (capped at max). */
export const EXPLORE_FIRE_PIT_HEAL_SELF_HP = 80;

/** Raw meat stack cap in the explore inventory slot. */
export const EXPLORE_MEAT_STACK_CAP = 20;

/** Hunger cap. At this value, starvation damage begins. */
export const EXPLORE_HUNGER_MAX = 100;

/** Hunger gained once per this interval while exploring. */
export const EXPLORE_HUNGER_GAIN_INTERVAL_MS = 5000;

/** HP lost per second while hunger is at max. */
export const EXPLORE_HUNGER_STARVE_DPS = 1;

/** Time spent at max hunger before critical starvation. */
export const EXPLORE_HUNGER_CRITICAL_AFTER_MS = 60000;

/** HP lost per second after starving at max hunger for the critical duration. */
export const EXPLORE_HUNGER_CRITICAL_DPS = 10;

export type ExploreFirePitHealAction = 'self' | 'allies';

export function isExploreFirePitHealAction(value: unknown): value is ExploreFirePitHealAction {
  return value === 'self' || value === 'allies';
}

/** Interact radius to open research station upgrade UI. */
export const EXPLORE_RESEARCH_INTERACT_RADIUS = 3.5;

/** Interact radius to open shrine gift UI. */
export const EXPLORE_SHRINE_INTERACT_RADIUS = 3.5;

/** Interact radius to open obelisk talent shop UI. */
export const EXPLORE_OBELISK_INTERACT_RADIUS = 3.5;

export type ExploreShrineGiftId = 'inferno' | 'tempest' | 'abyss' | 'plague';

export type ExploreShrineGiftColor = 'red' | 'blue' | 'purple' | 'green';

export const EXPLORE_SHRINE_GIFTS: readonly {
  id: ExploreShrineGiftId;
  label: string;
  hotkey: string;
  color: ExploreShrineGiftColor;
  description: string;
}[] = [
  {
    id: 'inferno',
    label: 'Gift of the Inferno',
    hotkey: '1',
    color: 'red',
    description: '3 red room boon choices',
  },
  {
    id: 'tempest',
    label: 'Gift of the Tempest',
    hotkey: '2',
    color: 'blue',
    description: '3 blue room talent choices',
  },
  {
    id: 'abyss',
    label: 'Gift of the Abyss',
    hotkey: '3',
    color: 'purple',
    description: '3 purple room talent choices',
  },
  {
    id: 'plague',
    label: 'Gift of the Plague',
    hotkey: '4',
    color: 'green',
    description: '3 green room talent choices',
  },
];

export function isExploreShrineGiftId(value: unknown): value is ExploreShrineGiftId {
  return value === 'inferno' || value === 'tempest' || value === 'abyss' || value === 'plague';
}

/** Gold cost per class talent at an explore obelisk. */
export const EXPLORE_OBELISK_TALENT_GOLD_COST = 500;

export type ExploreResearchUpgradeId = 'stone-breaker' | 'soul-stealer' | 'spirit-lineage' | 'greater-harvest';

/** Flow cost per one-shot research upgrade (Stone Breaker / Soul Stealer). */
export const EXPLORE_RESEARCH_FLOW_COST = 10;

/** Flow cost for Greater Harvest (doubles tree/root wood for the run). */
export const EXPLORE_GREATER_HARVEST_FLOW_COST = 20;

/** Spirit Lineage ranks: 0 (cap 1) through 4 (cap 5). */
export const EXPLORE_SPIRIT_LINEAGE_MAX_RANK = 4;

/** Cost to buy the next Spirit Lineage rank, indexed by current rank. */
export const EXPLORE_SPIRIT_LINEAGE_COSTS: readonly number[] = [10, 15, 20, 25];

export function getExploreAllyCap(spiritLineageRank: number): number {
  const rank = Math.max(0, Math.min(EXPLORE_SPIRIT_LINEAGE_MAX_RANK, Math.floor(Number(spiritLineageRank) || 0)));
  return 1 + rank;
}

export function getSpiritLineageNextCost(spiritLineageRank: number): number | null {
  const rank = Math.max(0, Math.floor(Number(spiritLineageRank) || 0));
  if (rank >= EXPLORE_SPIRIT_LINEAGE_MAX_RANK) return null;
  return EXPLORE_SPIRIT_LINEAGE_COSTS[rank] ?? null;
}

export function getSpiritLineageLabel(spiritLineageRank: number): string {
  const rank = Math.max(0, Math.floor(Number(spiritLineageRank) || 0));
  if (rank <= 0) return 'Spirit Lineage';
  const numerals = ['I', 'II', 'III', 'IV'] as const;
  return `Spirit Lineage Level ${numerals[Math.min(rank, numerals.length - 1)]}`;
}

export function getSpiritLineageDescription(spiritLineageRank: number): string {
  const cap = getExploreAllyCap(spiritLineageRank);
  const nextCap = Math.min(cap + 1, getExploreAllyCap(EXPLORE_SPIRIT_LINEAGE_MAX_RANK));
  return `Raise Spirit Lounge ally cap ${cap} → ${nextCap}`;
}

export interface ExploreResearchState {
  stoneBreaker: boolean;
  soulStealer: boolean;
  spiritLineage: number;
  greaterHarvest: boolean;
}

export const EMPTY_EXPLORE_RESEARCH: ExploreResearchState = {
  stoneBreaker: false,
  soulStealer: false,
  spiritLineage: 0,
  greaterHarvest: false,
};

export function normalizeExploreResearch(raw: unknown): ExploreResearchState {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rank = Math.max(
    0,
    Math.min(EXPLORE_SPIRIT_LINEAGE_MAX_RANK, Math.floor(Number(r.spiritLineage) || 0)),
  );
  return {
    stoneBreaker: !!r.stoneBreaker,
    soulStealer: !!r.soulStealer,
    spiritLineage: rank,
    greaterHarvest: !!r.greaterHarvest,
  };
}

export function getExploreResearchFlowCost(id: ExploreResearchUpgradeId): number {
  if (id === 'greater-harvest') return EXPLORE_GREATER_HARVEST_FLOW_COST;
  return EXPLORE_RESEARCH_FLOW_COST;
}

export function isExploreResearchPurchased(
  id: ExploreResearchUpgradeId,
  research: ExploreResearchState,
): boolean {
  if (id === 'stone-breaker') return research.stoneBreaker;
  if (id === 'soul-stealer') return research.soulStealer;
  if (id === 'greater-harvest') return research.greaterHarvest;
  return false;
}

export function isExplorePurchasedAllyType(type: string | undefined | null): boolean {
  return type === 'allied-knight'
    || type === 'allied-huntress'
    || type === 'allied-phantom'
    || type === 'allied-demon'
    || type === 'allied-enchantress';
}

export const EXPLORE_RESEARCH_UPGRADES: readonly {
  id: ExploreResearchUpgradeId;
  label: string;
  hotkey: string;
  description: string;
}[] = [
  {
    id: 'stone-breaker',
    label: 'Stone Breaker',
    hotkey: '1',
    description: 'Break stone props for stone resource',
  },
  {
    id: 'soul-stealer',
    label: 'Soul Stealer',
    hotkey: '2',
    description: 'Destroy bone spines for Flow',
  },
  {
    id: 'spirit-lineage',
    label: 'Spirit Lineage',
    hotkey: '3',
    description: 'Raise Spirit Lounge ally cap',
  },
  {
    id: 'greater-harvest',
    label: 'Greater Harvest',
    hotkey: '4',
    description: 'Double wood from trees and roots',
  },
];
