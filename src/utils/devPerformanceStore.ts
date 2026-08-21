/**
 * Shared dev performance metrics store.
 * Producers (R3F collector, game loop) publish snapshots; DevPerformanceMeter subscribes.
 */

export interface DevPerformanceSnapshot {
  timestamp: number;

  // GPU / Render
  drawCalls: number;
  triangles: number;
  points: number;
  lines: number;
  geometries: number;
  textures: number;
  programs: number;
  dpr: number;
  /** Explore orbit radius from exploreZoomLod (null outside explore / unset). */
  exploreZoomRadius: number | null;
  exploreZoomClose: boolean;
  exploreZoomVeryClose: boolean;

  // Memory (Chrome performance.memory)
  heapUsedMB: number | null;
  heapTotalMB: number | null;
  heapLimitMB: number | null;
  heapPercent: number | null;

  // Scene complexity
  sceneObjects: number;
  meshes: number;
  instancedMeshes: number;
  lights: number;
  shadowCasters: number;

  // CPU / Engine
  fps: number;
  frameTimeMs: number;
  updateTimeMs: number;
  renderTimeMs: number;
  ecsEntities: number;
  enemyCount: number;
  playerCount: number;

  // Systems / pools
  collisionChecks: number;
  activeCollisions: number;
  spatialHashCells: number;
  vector3PoolSize: number;
  calcCacheEntries: number;
  effectPoolActive: number;

  // React activity (Profiler proxy)
  reactLastCommitMs: number;
  reactCommitsPerSec: number;
  reactBaseDurationMs: number;

  // Session deltas (vs first sample)
  deltaGeometries: number;
  deltaTextures: number;
  deltaPrograms: number;
  deltaHeapMB: number;
}

const EMPTY_SNAPSHOT: DevPerformanceSnapshot = {
  timestamp: 0,
  drawCalls: 0,
  triangles: 0,
  points: 0,
  lines: 0,
  geometries: 0,
  textures: 0,
  programs: 0,
  dpr: 1,
  exploreZoomRadius: null,
  exploreZoomClose: false,
  exploreZoomVeryClose: false,
  heapUsedMB: null,
  heapTotalMB: null,
  heapLimitMB: null,
  heapPercent: null,
  sceneObjects: 0,
  meshes: 0,
  instancedMeshes: 0,
  lights: 0,
  shadowCasters: 0,
  fps: 0,
  frameTimeMs: 0,
  updateTimeMs: 0,
  renderTimeMs: 0,
  ecsEntities: 0,
  enemyCount: 0,
  playerCount: 0,
  collisionChecks: 0,
  activeCollisions: 0,
  spatialHashCells: 0,
  vector3PoolSize: 0,
  calcCacheEntries: 0,
  effectPoolActive: 0,
  reactLastCommitMs: 0,
  reactCommitsPerSec: 0,
  reactBaseDurationMs: 0,
  deltaGeometries: 0,
  deltaTextures: 0,
  deltaPrograms: 0,
  deltaHeapMB: 0,
};

type PartialSnapshot = Partial<DevPerformanceSnapshot>;

type Listener = () => void;

class DevPerformanceStore {
  private snapshot: DevPerformanceSnapshot = { ...EMPTY_SNAPSHOT };
  private listeners = new Set<Listener>();
  private baseline: {
    geometries: number;
    textures: number;
    programs: number;
    heapMB: number;
  } | null = null;

  getSnapshot(): DevPerformanceSnapshot {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Merge partial update; recompute session deltas when render/memory fields change. */
  publish(partial: PartialSnapshot): void {
    const next = { ...this.snapshot, ...partial, timestamp: Date.now() };

    if (
      this.baseline === null &&
      (next.geometries > 0 || next.heapUsedMB !== null)
    ) {
      this.baseline = {
        geometries: next.geometries,
        textures: next.textures,
        programs: next.programs,
        heapMB: next.heapUsedMB ?? 0,
      };
    }

    if (this.baseline) {
      next.deltaGeometries = next.geometries - this.baseline.geometries;
      next.deltaTextures = next.textures - this.baseline.textures;
      next.deltaPrograms = next.programs - this.baseline.programs;
      next.deltaHeapMB =
        next.heapUsedMB !== null ? next.heapUsedMB - this.baseline.heapMB : 0;
    }

    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }

  reset(): void {
    this.snapshot = { ...EMPTY_SNAPSHOT };
    this.baseline = null;
    this.listeners.forEach((listener) => listener());
  }
}

export const devPerformanceStore = new DevPerformanceStore();

const reactProfilerWindow = { startMs: 0, commitCount: 0 };

/** Track React Profiler commits for the dev HUD. */
export function recordReactProfilerCommit(
  actualDuration: number,
  baseDuration: number,
): void {
  const now = Date.now();
  if (reactProfilerWindow.startMs === 0) {
    reactProfilerWindow.startMs = now;
  }
  reactProfilerWindow.commitCount++;

  const patch: Partial<DevPerformanceSnapshot> = {
    reactLastCommitMs: actualDuration,
    reactBaseDurationMs: baseDuration,
  };

  if (now - reactProfilerWindow.startMs >= 1000) {
    patch.reactCommitsPerSec = reactProfilerWindow.commitCount;
    reactProfilerWindow.startMs = now;
    reactProfilerWindow.commitCount = 0;
  }

  devPerformanceStore.publish(patch);
}
