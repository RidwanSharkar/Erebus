'use client';

/**
 * Dynamic light pool.
 *
 * Problem this solves: VFX (impacts, spells, projectiles) used to mount/unmount their
 * own `<pointLight>` elements. three.js bakes the scene's light count into every lit
 * material's shader program, so every mount/unmount forced a mass shader recompile —
 * the `setProgram → getProgramInfoLog` stalls seen in the profiler.
 *
 * Fix: keep a FIXED number of point lights mounted for the whole session (constant
 * light count → each lit shader compiles once and stays cached). VFX *borrow* a slot
 * via `acquireDynamicLight()` / the `useDynamicLight()` hook, drive it each frame, and
 * release it on unmount. Released slots go to intensity 0 instead of unmounting.
 *
 * A global flag (`setDynamicLightsEnabled`) turns the whole system off: the pool then
 * mounts zero lights and every acquire returns a no-op handle, so migrated VFX emit no
 * light at all. Toggling the flag changes the light count exactly once (one recompile),
 * which is fine for a deliberate setting change.
 */

import { Color, PointLight } from '@/utils/three-exports';

export const DYNAMIC_LIGHT_POOL_SIZE = 12;

export type DynamicLightColor = string | number | Color;

export interface AcquireOptions {
  color?: DynamicLightColor;
  intensity?: number;
  distance?: number;
  decay?: number;
  /** Higher priority keeps its slot when the pool is exhausted. Default 0. */
  priority?: number;
}

export interface DynamicLightHandle {
  setPosition(x: number, y: number, z: number): void;
  setColor(color: DynamicLightColor): void;
  setIntensity(intensity: number): void;
  setDistance(distance: number): void;
  release(): void;
  /** True while this handle still owns a live pool slot. */
  readonly active: boolean;
}

interface Slot {
  light: PointLight;
  /** Bumped on every (re)acquire so stale handles become no-ops. */
  token: number;
  priority: number;
  inUse: boolean;
  /** Monotonic acquire order, used as an LRU tiebreaker when stealing. */
  order: number;
}

// A handle that silently does nothing — returned when the pool is full or disabled.
const NOOP_HANDLE: DynamicLightHandle = {
  setPosition() {},
  setColor() {},
  setIntensity() {},
  setDistance() {},
  release() {},
  active: false,
};

class DynamicLightPool {
  private slots: Slot[] = [];
  private enabled = true;
  private orderCounter = 0;
  private enabledListeners = new Set<(enabled: boolean) => void>();

  /** Called by <DynamicLightPool> once its <pointLight> refs are mounted. */
  register(lights: PointLight[]): void {
    this.slots = lights.map((light) => {
      light.intensity = 0;
      return { light, token: 0, priority: 0, inUse: false, order: 0 };
    });
  }

  unregister(): void {
    this.slots = [];
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      // Drop every borrower; the pool component will unmount the lights.
      for (const slot of this.slots) {
        slot.inUse = false;
        slot.token++;
        slot.light.intensity = 0;
      }
    }
    this.enabledListeners.forEach((fn) => fn(enabled));
  }

  /** Subscribe to enabled changes (used by the pool component to re-render). */
  subscribe(fn: (enabled: boolean) => void): () => void {
    this.enabledListeners.add(fn);
    return () => this.enabledListeners.delete(fn);
  }

  acquire(opts: AcquireOptions = {}): DynamicLightHandle {
    if (!this.enabled || this.slots.length === 0) return NOOP_HANDLE;

    const priority = opts.priority ?? 0;

    // Prefer a free slot; otherwise steal the lowest-priority active slot whose
    // priority is below ours (LRU among ties). If nothing is stealable, give up.
    let chosen: Slot | null = null;
    for (const slot of this.slots) {
      if (!slot.inUse) {
        chosen = slot;
        break;
      }
    }
    if (!chosen) {
      let victim: Slot | null = null;
      for (const slot of this.slots) {
        if (slot.priority >= priority) continue;
        if (
          !victim ||
          slot.priority < victim.priority ||
          (slot.priority === victim.priority && slot.order < victim.order)
        ) {
          victim = slot;
        }
      }
      chosen = victim;
    }
    if (!chosen) return NOOP_HANDLE;

    const slot = chosen;
    slot.inUse = true;
    slot.priority = priority;
    slot.order = ++this.orderCounter;
    const token = ++slot.token;

    const light = slot.light;
    if (opts.color !== undefined) light.color.set(opts.color as Color);
    light.intensity = opts.intensity ?? 1;
    light.distance = opts.distance ?? 0;
    light.decay = opts.decay ?? 2;

    const live = () => slot.inUse && slot.token === token;

    return {
      get active() {
        return live();
      },
      setPosition(x, y, z) {
        if (live()) light.position.set(x, y, z);
      },
      setColor(color) {
        if (live()) light.color.set(color as Color);
      },
      setIntensity(intensity) {
        if (live()) light.intensity = intensity;
      },
      setDistance(distance) {
        if (live()) light.distance = distance;
      },
      release() {
        if (!live()) return;
        slot.inUse = false;
        slot.token++;
        light.intensity = 0;
      },
    };
  }
}

export const dynamicLightPool = new DynamicLightPool();

export function acquireDynamicLight(opts?: AcquireOptions): DynamicLightHandle {
  return dynamicLightPool.acquire(opts);
}

// Separate fixed-size pool for per-enemy lights. Enemies are long-lived relative to
// VFX, so they get their own pool (sharing the VFX pool would starve it). A fixed
// count means spawning/dying enemies no longer change the scene light count — which
// was forcing every lit material to recompile (the spawn/death hitch). The cap also
// bounds the per-fragment lighting cost (it was climbing past 30 simultaneous lights).
export const ENEMY_LIGHT_POOL_SIZE = 10;
export const enemyLightPool = new DynamicLightPool();

export function acquireEnemyLight(opts?: AcquireOptions): DynamicLightHandle {
  return enemyLightPool.acquire(opts);
}

// Third fixed pool for per-player / per-ability lights (dragon cosmetics, weapon and
// ability glows). These mount/unmount as players spawn, die, and use abilities — each
// change shifted the scene light count and recompiled every lit material (e.g. the
// hitch when an ally dies and their dragon's lights vanish). Pooling keeps the count
// constant. Gated by the main dynamic-lights flag (not the enemy-lights flag).
export const EFFECT_LIGHT_POOL_SIZE = 10;
export const effectLightPool = new DynamicLightPool();

export function acquireEffectLight(opts?: AcquireOptions): DynamicLightHandle {
  return effectLightPool.acquire(opts);
}

// ── Global enable flag ──────────────────────────────────────────────────────

export function setDynamicLightsEnabled(enabled: boolean): void {
  dynamicLightPool.setEnabled(enabled);
  effectLightPool.setEnabled(enabled);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem('erebus:dynamicLights', enabled ? 'on' : 'off');
    } catch {
      /* ignore storage failures */
    }
  }
}

export function getDynamicLightsEnabled(): boolean {
  return dynamicLightPool.isEnabled();
}

/**
 * Resolve the initial flag value from `?nolights=1` / `?nolights` in the URL or the
 * `erebus:dynamicLights` localStorage key. URL wins over storage. Default: enabled.
 */
export function resolveInitialDynamicLightsFlag(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('nolights')) {
      const v = params.get('nolights');
      return v === '0' || v === 'false';
    }
    const stored = window.localStorage.getItem('erebus:dynamicLights');
    if (stored === 'off') return false;
    if (stored === 'on') return true;
  } catch {
    /* ignore */
  }
  return true;
}

// ── Enemy lights flag ────────────────────────────────────────────────────────
// Per-enemy model/soul lights mount and unmount as enemies spawn and die. Each
// mount/unmount changes the scene's light count, recompiling every lit material's
// shader — the hitch felt on spawn/death. This is a SEPARATE on/off flag (enemy
// lights are not pooled, since many enemies can be alive at once). When off, those
// lights render nothing, so spawning/dying enemies no longer churn the light count.

let enemyLightsEnabled = true;
const enemyLightListeners = new Set<(enabled: boolean) => void>();

export function getEnemyLightsEnabled(): boolean {
  return enemyLightsEnabled;
}

export function setEnemyLightsEnabled(enabled: boolean): void {
  if (enemyLightsEnabled === enabled) return;
  enemyLightsEnabled = enabled;
  // Mount/unmount the pooled enemy lights so the light count drops to baseline when
  // off (a single recompile on toggle, then constant).
  enemyLightPool.setEnabled(enabled);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem('erebus:enemyLights', enabled ? 'on' : 'off');
    } catch {
      /* ignore storage failures */
    }
  }
  enemyLightListeners.forEach((fn) => fn(enabled));
}

export function subscribeEnemyLights(fn: (enabled: boolean) => void): () => void {
  enemyLightListeners.add(fn);
  return () => {
    enemyLightListeners.delete(fn);
  };
}

/**
 * Resolve the initial enemy-lights flag from `?noenemylights=1` in the URL or the
 * `erebus:enemyLights` localStorage key. URL wins over storage. Default: enabled.
 */
export function resolveInitialEnemyLightsFlag(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('noenemylights')) {
      const v = params.get('noenemylights');
      return v === '0' || v === 'false';
    }
    const stored = window.localStorage.getItem('erebus:enemyLights');
    if (stored === 'off') return false;
    if (stored === 'on') return true;
  } catch {
    /* ignore */
  }
  return true;
}
