/** Explore-mode reward camp kinds and shared tables (mirrored in backend/gameRoom.js). */

export type ExploreCampKind =
  | 'gold'
  | 'stat'
  | 'tempest'
  | 'eldritch'
  | 'infernal'
  | 'abyssal'
  | 'boss';

export type ExploreCampBoonColor = 'blue' | 'green' | 'red' | 'purple';

/** Chance that a wilderness pack becomes a reward camp, by wilderness level. */
export const EXPLORE_CAMP_CHANCE_BY_LEVEL: Readonly<Record<1 | 2 | 3 | 4, number>> = Object.freeze({
  1: 0.10,
  2: 0.17,
  3: 0.25,
  4: 0.35,
});

export const EXPLORE_CAMP_GOLD_BY_LEVEL: Readonly<Record<1 | 2 | 3 | 4, number>> = Object.freeze({
  1: 75,
  2: 150,
  3: 250,
  4: 350,
});

export const EXPLORE_CAMP_STAT_BY_LEVEL: Readonly<Record<1 | 2 | 3 | 4, number>> = Object.freeze({
  1: 3,
  2: 4,
  3: 5,
  4: 6,
});

export const EXPLORE_CAMP_BOON_COLOR: Readonly<
  Record<'tempest' | 'eldritch' | 'infernal' | 'abyssal', ExploreCampBoonColor>
> = Object.freeze({
  tempest: 'blue',
  eldritch: 'green',
  infernal: 'red',
  abyssal: 'purple',
});

export const EXPLORE_CAMP_PROP_URL: Readonly<Record<ExploreCampKind, string>> = Object.freeze({
  gold: '/models/trinket/shardGoldcluster.glb',
  stat: '/models/trinket/pylons/redProp.glb', // blueProp.glb
  tempest: '/models/trinket/pylons/statProp.glb',
  eldritch: '/models/trinket/pylons/greenProp.glb',
  infernal: '/models/trinket/shardScarlet.glb',
  abyssal: '/models/trinket/shardAmethyst.glb',
  boss: '/models/trinket/pylons/bossProp.glb',
});

/** Soft albedo fill so charcoal pylons stay readable in explore night lighting. */
export const EXPLORE_CAMP_PROP_SELF_ILLUMINATION = 0.45;

/** Collision disc radius for reward camp props (boss prop has no collision). */
export const EXPLORE_CAMP_COLLIDE_RADIUS = 1.4;

/** XZ interaction radius — matches MAIN_COMBAT_PEDESTAL_INTERACT_RADIUS. */
export const EXPLORE_CAMP_INTERACT_RADIUS = 3.0;

/** Cap on unclaimed / in-progress camps so the world cannot stockpile forever. */
export const EXPLORE_CAMP_MAX_ACTIVE = 3;

/**
 * Leave-despawn (mirrored in backend/gameRoom.js).
 * ~40ft at meter-scale. Timer starts only after a player has approached within this range,
 * then stayed farther away for EXPLORE_CAMP_DESPAWN_DELAY_MS.
 */
export const EXPLORE_CAMP_DESPAWN_DIST = 12;
export const EXPLORE_CAMP_DESPAWN_DELAY_MS = 30000;

/**
 * Stream unload (mirrored in backend/gameRoom.js).
 * Matches EXPLORE_BUILDING_RENDER_RADIUS — camps beyond this are despawned immediately
 * so discovered packs/props do not linger over the horizon like trees/stones.
 */
export const EXPLORE_CAMP_STREAM_RADIUS = 36;

/** Pack-member kill thresholds for explore boss encounters 1 / 2 / 3. */
export const EXPLORE_BOSS_KILL_THRESHOLDS = Object.freeze([35, 80, 150] as const);

export const EXPLORE_BOSS_SPAWN_DIST = 15;

/** Non-boss camp kinds used when rolling a pack into a reward camp. */
export const EXPLORE_REWARD_CAMP_KINDS = Object.freeze([
  'gold',
  'stat',
  'tempest',
  'eldritch',
  'infernal',
  'abyssal',
] as const satisfies readonly ExploreCampKind[]);

export type ExploreRewardCampKind = (typeof EXPLORE_REWARD_CAMP_KINDS)[number];

/** Weighted reward-camp kinds by wilderness level. Level 1 has no stat camps. Mirrored in backend/gameRoom.js. */
export const EXPLORE_REWARD_CAMP_WEIGHTS_BY_LEVEL: Readonly<
  Record<1 | 2 | 3 | 4, Readonly<Partial<Record<ExploreRewardCampKind, number>>>>
> = Object.freeze({
  1: Object.freeze({ gold: 90, tempest: 2.5, eldritch: 2.5, infernal: 2.5, abyssal: 2.5 }),
  2: Object.freeze({ gold: 70, stat: 18, tempest: 3, eldritch: 3, infernal: 3, abyssal: 3 }),
  3: Object.freeze({ gold: 50, stat: 32, tempest: 4.5, eldritch: 4.5, infernal: 4.5, abyssal: 4.5 }),
  4: Object.freeze({ gold: 40, stat: 40, tempest: 5, eldritch: 5, infernal: 5, abyssal: 5 }),
});

export type ExploreCampPublic = {
  id: string;
  kind: ExploreCampKind;
  level: number | null;
  x: number;
  z: number;
  cleared: boolean;
  collides: boolean;
  claimedBy: string[];
};

export function isExploreCampKind(value: unknown): value is ExploreCampKind {
  return (
    value === 'gold'
    || value === 'stat'
    || value === 'tempest'
    || value === 'eldritch'
    || value === 'infernal'
    || value === 'abyssal'
    || value === 'boss'
  );
}

export function exploreCampCollideRadius(kind: ExploreCampKind): number {
  return kind === 'boss' ? 0 : EXPLORE_CAMP_COLLIDE_RADIUS;
}
