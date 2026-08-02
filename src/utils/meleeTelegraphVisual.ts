import type { MeleeWeightClass } from '@/components/enemies/EnemyMeleeAttackRangeRing';

/** Mirrors `MELEE_COMMIT_FRAC` in `backend/meleeProfiles.js`. */
export const MELEE_COMMIT_FRAC = 0.6;

/** Fade-out window after the hit frame, shared by the ring and its mount timer. */
export const MELEE_RECOVERY_TAIL_MS = 260;

export type MeleeTelegraphVisual = {
  hitDelayMs: number;
  swingLockMs: number;
  attackRange: number;
  arcDeg: number;
  facing: number;
  weightClass: MeleeWeightClass;
  /** Client-local monotonic ms when the telegraph was received. */
  startedAtMs: number;
  /** Ms from telegraph start until facing hard-locks (dodge window opens). */
  commitAtMs: number;
  whiffed: boolean;
};

const WEIGHT_CLASSES = new Set(['beast', 'large-beast', 'humanoid', 'giant']);

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Parse enriched `{type}-attack-telegraph` payload into ring props. */
export function parseMeleeTelegraphPayload(
  data: {
    hitDelayMs?: number;
    swingLockMs?: number;
    attackRange?: number;
    arcDeg?: number;
    facing?: number;
    weightClass?: string;
    commitAtMs?: number;
    timestamp?: number;
  },
  fallbackRange: number,
  fallbackDurationMs: number,
): MeleeTelegraphVisual {
  const hitDelayMs =
    typeof data.hitDelayMs === 'number' && data.hitDelayMs > 0
      ? data.hitDelayMs
      : Math.min(fallbackDurationMs, 900);
  const swingLockMs =
    typeof data.swingLockMs === 'number' && data.swingLockMs > 0
      ? data.swingLockMs
      : fallbackDurationMs;
  const weightClass = WEIGHT_CLASSES.has(data.weightClass || '')
    ? (data.weightClass as MeleeWeightClass)
    : 'humanoid';
  const commitAtMs =
    typeof data.commitAtMs === 'number' && data.commitAtMs > 0
      ? data.commitAtMs
      : Math.floor(hitDelayMs * MELEE_COMMIT_FRAC);

  return {
    hitDelayMs,
    swingLockMs,
    attackRange:
      typeof data.attackRange === 'number' && data.attackRange > 0
        ? data.attackRange
        : fallbackRange,
    arcDeg: typeof data.arcDeg === 'number' && data.arcDeg > 0 ? data.arcDeg : 110,
    facing: typeof data.facing === 'number' ? data.facing : 0,
    weightClass,
    // Always use client receive time — server `timestamp` is Date.now() epoch and
    // must never be mixed with performance.now() in the ring's elapsed math.
    startedAtMs: nowMs(),
    commitAtMs,
    whiffed: false,
  };
}

/**
 * Attack window duration from telegraph.
 *
 * `swingLockMs` is only the server's movement lock and can expire before the
 * hit lands (`setTimeout(hitDelayMs)` in `performMeleeSwing`), so the window
 * must always cover the hit frame plus the recovery tail — otherwise the arc
 * telegraph unmounts mid-charge and never reaches its commit snap or flash.
 */
export function meleeAttackDurationFromTelegraph(
  visual: MeleeTelegraphVisual | null | undefined,
  fallbackMs: number,
): number {
  const lock = visual?.swingLockMs && visual.swingLockMs > 0 ? visual.swingLockMs : 0;
  const hit = visual?.hitDelayMs && visual.hitDelayMs > 0 ? visual.hitDelayMs : 0;
  if (!lock && !hit) return fallbackMs;
  return Math.max(lock, hit + MELEE_RECOVERY_TAIL_MS);
}
