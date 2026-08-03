/**
 * Prep-room center decor for the throne staging space.
 * Positions are world-space (not grass-local). Shards sit on the grass plane (y ≈ 0.13).
 * Layout is deterministic — stable across reloads and multiplayer clients.
 */

export const THRONE_PRISM_GOLD_PATH = '/models/trinket/pylons/FANCYPRISM.glb';
export const THRONE_PRISM_RED_PATH = '/models/trinket/prismRed.glb';
export const THRONE_SPELLBOOK_PATH = '/models/trinket/spellbook.glb';

export type ThroneShardModel = 'amethyst' | 'goldCluster' | 'scarlet';

export const THRONE_SHARD_PATHS: Record<ThroneShardModel, string> = {
  amethyst: '/models/trinket/shardAmethyst.glb',
  goldCluster: '/models/trinket/shardGoldcluster.glb',
  scarlet: '/models/trinket/shardScarlet.glb',
};

/** Matches ThroneCenterSeal / ThroneOuterFloor default Z offset. */
export const THRONE_CENTER_WORLD_Z = 0.65;

/** Grass disc Y — shard feet sit on this plane. */
export const THRONE_CENTER_DECOR_GROUND_Y = 0.13;

export type ThroneFloatingMotion = 'prism' | 'book';

export type ThroneFloatingDecorDef = {
  position: readonly [number, number, number];
  scale: number;
  phase: number;
  /** Model-space Y offset applied before scale (centers / feet alignment). */
  modelOffsetY?: number;
  motion?: ThroneFloatingMotion;
};

/**
 * Raw GLB heights: prism ≈ 8.65m, spellbook ≈ 2.9m.
 * Scales target ~1.8m gold prism, ~1.0m red accent, ~0.75m spellbook.
 */
export const THRONE_GOLD_PRISM_DEF: ThroneFloatingDecorDef = {
  position: [0, 5.55, THRONE_CENTER_WORLD_Z - 0.7],
  scale: 0.245,
  phase: 0,
  // Bind origin sits ~5.1m up the crystal — pull mesh down so visual center ≈ float root.
  modelOffsetY: 1.13,
};

export const THRONE_RED_PRISM_DEF: ThroneFloatingDecorDef = {
  position: [1.35, 1.05, THRONE_CENTER_WORLD_Z - 0.5],
  scale: 0.12,
  phase: 2.1,
  modelOffsetY: -5.13,
};

export const THRONE_SPELLBOOK_DEF: ThroneFloatingDecorDef = {
  position: [-1.6, 0.42, THRONE_CENTER_WORLD_Z + 0.45],
  scale: 0.28,
  phase: 1.4,
  // Bind center ≈ 1.52m — lower so the book skims near the float root.
  modelOffsetY: -1.52,
  motion: 'book',
};

export type ThroneShardDef = {
  model: ThroneShardModel;
  /** World XZ; Y comes from groundY × scale + ground plane. */
  position: readonly [number, number];
  rotationY?: number;
  /** Multiplies the model’s defaultScale. */
  scale?: number;
};

/**
 * Per-model ground alignment: lift so mesh min-Y sits at local 0, then × scale.
 * defaultScale targets rock heights ≈ 0.7–1.2m (gold cluster is ~34m raw).
 */
export const THRONE_SHARD_MODEL_META: Record<
  ThroneShardModel,
  { groundY: number; defaultScale: number }
> = {
  amethyst: { groundY: 0.199, defaultScale: 0.24 },
  goldCluster: { groundY: 2.794, defaultScale: 0.032 },
  scarlet: { groundY: 0.171, defaultScale: 0.22 },
};

/**
 * ~14 hand-placed shards in an annulus r ≈ 3–7 around the center seal.
 * Avoids void portal (~2.5m), pillar ring, and south-rim portals (z < -12).
 */
export const THRONE_SHARD_LAYOUT: readonly ThroneShardDef[] = [

];

export function listUniqueThroneShardModels(
  layout: readonly ThroneShardDef[] = THRONE_SHARD_LAYOUT,
): ThroneShardModel[] {
  return Array.from(new Set(layout.map((p) => p.model)));
}

export function throneShardGlbUrl(model: ThroneShardModel): string {
  return THRONE_SHARD_PATHS[model];
}

/** Floating center prism choices for special co-op maps (one per room). */
export type MapCenterPrismModel = 'prismGold' | 'prismRed' | 'goldCracked';

export const MAP_CENTER_PRISM_MODELS: readonly MapCenterPrismModel[] = [
  'prismGold',
  'prismRed',
  'goldCracked',
] as const;

export const THRONE_GOLD_SHARD_CRACKED_PATH = '/models/trinket/pylons/7.glb';

export const MAP_CENTER_PRISM_PATHS: Record<MapCenterPrismModel, string> = {
  prismGold: THRONE_PRISM_GOLD_PATH,
  prismRed: THRONE_PRISM_RED_PATH,
  goldCracked: THRONE_GOLD_SHARD_CRACKED_PATH,
};

/** Per-model bind offset before scale — cracked shard uses prism alignment until tuned. */
export const MAP_CENTER_PRISM_MODEL_OFFSET_Y: Record<MapCenterPrismModel, number> = {
  prismGold: -5.13,
  prismRed: -5.13,
  goldCracked: -5.13,
};

export const MAP_CENTER_PRISM_LIGHT: Record<
  MapCenterPrismModel,
  { color: string; intensity: number }
> = {
  prismGold: { color: '#fbbf24', intensity: 1.4 },
  prismRed: { color: '#f87171', intensity: 1.2 },
  goldCracked: { color: '#fbbf24', intensity: 1.1 },
};

export type MapCenterDecorRoomKind =
  | 'deep_sanctum'
  | 'sunken_temple'
  | 'fae_realm'
  | 'eternity_palace';

export type MapCenterDecorConfig = {
  /** World Z of the float root (map center). */
  centerZ: number;
  /** Float root Y — matches throne gold prism. */
  floatY: number;
  /** Uniform scale — matches throne gold prism. */
  scale: number;
  /** SkyRay orbit radius (arena radius + margin). Used for Sunken Temple only. */
  orbitRadius: number;
};

const MAP_CENTER_ORBIT_MARGIN = 4;

export const MAP_CENTER_DECOR_BY_KIND: Record<
  MapCenterDecorRoomKind,
  MapCenterDecorConfig
> = {
  deep_sanctum: {
    centerZ: -0.2,
    floatY: 4.55,
    scale: 0.475,
    orbitRadius: 14 + MAP_CENTER_ORBIT_MARGIN,
  },
  sunken_temple: {
    centerZ: 0,
    floatY: 4.55,
    scale: 0.475,
    orbitRadius: 14 + MAP_CENTER_ORBIT_MARGIN,
  },
  fae_realm: {
    centerZ: 0,
    floatY: 4.55,
    scale: 0.475,
    orbitRadius: 21 + MAP_CENTER_ORBIT_MARGIN,
  },
  eternity_palace: {
    centerZ: 0,
    floatY: 4.55,
    scale: 0.475,
    orbitRadius: 18 + MAP_CENTER_ORBIT_MARGIN,
  },
};

function hashSeedString(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic pick so all multiplayer clients agree on the center model. */
export function pickMapCenterPrismModel(seed: string): MapCenterPrismModel {
  const idx = hashSeedString(seed) % MAP_CENTER_PRISM_MODELS.length;
  return MAP_CENTER_PRISM_MODELS[idx]!;
}

export function buildMapCenterPrismDef(
  model: MapCenterPrismModel,
  config: MapCenterDecorConfig,
  phase = 0,
): ThroneFloatingDecorDef {
  return {
    position: [0, config.floatY, config.centerZ],
    scale: config.scale,
    phase,
    modelOffsetY: MAP_CENTER_PRISM_MODEL_OFFSET_Y[model],
  };
}

export function mapCenterDecorSeed(
  roomKind: string,
  roomIndex: number,
  enterSeq: number,
): string {
  return `${roomKind}:${roomIndex}:${enterSeq}`;
}

export function isMapCenterDecorRoomKind(
  kind: string | null | undefined,
): kind is MapCenterDecorRoomKind {
  return (
    kind === 'deep_sanctum'
    || kind === 'sunken_temple'
    || kind === 'fae_realm'
    || kind === 'eternity_palace'
  );
}
