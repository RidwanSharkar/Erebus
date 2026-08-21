/** Rank fire pits by camera distance; only the nearest few keep a pooled point light. */

const MAX_FIRE_PIT_LIGHTS = 2;
/** Sticky margin so 2nd/3rd nearest pits don't strobe when distances are close. */
const HYSTERESIS_DIST = 1.5;
const HYSTERESIS_DIST2 = HYSTERESIS_DIST * HYSTERESIS_DIST;
const ANIM_RADIUS = 18;
export const EXPLORE_FIRE_PIT_ANIM_RADIUS2 = ANIM_RADIUS * ANIM_RADIUS;

let lodFrame = -1;
const pending: { id: number; distSq: number }[] = [];
const lightOn = new Set<number>();

function flushLod(): void {
  pending.sort((a, b) => a.distSq - b.distSq);

  const next = new Set<number>();
  const n = Math.min(MAX_FIRE_PIT_LIGHTS, pending.length);

  // Keep previous winners if they remain within hysteresis of the cutoff distance.
  const cutoff = pending[n - 1]?.distSq ?? Number.POSITIVE_INFINITY;
  for (const id of lightOn) {
    if (next.size >= MAX_FIRE_PIT_LIGHTS) break;
    const entry = pending.find((p) => p.id === id);
    if (!entry) continue;
    if (entry.distSq <= cutoff + HYSTERESIS_DIST2) next.add(id);
  }

  for (let i = 0; i < pending.length && next.size < MAX_FIRE_PIT_LIGHTS; i++) {
    next.add(pending[i]!.id);
  }

  lightOn.clear();
  for (const id of next) lightOn.add(id);
  pending.length = 0;
}

/**
 * @param frameId Integer frame key shared by all pits this R3F frame
 *   (e.g. `(elapsedTime * 1000) | 0`). Do not pass a per-pit counter.
 */
export function submitExploreFirePitLod(frameId: number, id: number, distSq: number): boolean {
  if (frameId !== lodFrame) {
    flushLod();
    lodFrame = frameId;
  }
  pending.push({ id, distSq });
  return lightOn.has(id);
}
