import { AnimationClip, VectorKeyframeTrack } from 'three';

const sessionClipCaches = new Map<string, AnimationClip[]>();

/** Zero root-motion X/Z on Hips position tracks so server position stays authoritative. */
export function stripRootMotionXZ(clip: AnimationClip): AnimationClip {
  const result = clip.clone();
  result.tracks = result.tracks.map((track) => {
    if (!track.name.endsWith('.position')) return track;
    if (!track.name.toLowerCase().includes('hips')) return track;
    const values = Float32Array.from(track.values);
    for (let i = 0; i < values.length; i += 3) {
      values[i] = 0;
      values[i + 2] = 0;
    }
    return new VectorKeyframeTrack(track.name, Array.from(track.times), Array.from(values));
  });
  return result;
}

export function renameAnimationClips(clips: AnimationClip[], name: string): AnimationClip[] {
  return clips.map((clip) => {
    const renamed = clip.clone();
    renamed.name = name;
    return renamed;
  });
}

/** Session-level clip cache — safe to share across instances (each gets its own AnimationMixer). */
export function getCachedEnemyAnimationClips(
  cacheId: string,
  build: () => AnimationClip[],
): AnimationClip[] {
  const cached = sessionClipCaches.get(cacheId);
  if (cached) return cached;
  const built = build();
  sessionClipCaches.set(cacheId, built);
  return built;
}

/** Cache processed clips keyed by canonical animation name (for deferred/lazy loaders). */
const processedClipCaches = new Map<string, AnimationClip[]>();

export function getCachedProcessedClips(
  cacheKey: string,
  rawClips: AnimationClip[],
  options: { stripRootMotion?: boolean; renameTo?: string } = {},
): AnimationClip[] {
  const { stripRootMotion = false, renameTo } = options;
  const key = `${cacheKey}:${renameTo ?? 'raw'}:${stripRootMotion ? 'strip' : 'keep'}`;
  const cached = processedClipCaches.get(key);
  if (cached) return cached;

  // Deferred/async loaders call this with `[]` before their GLB has loaded.
  // Don't cache that placeholder — otherwise the real clips arrive later but
  // this key stays stuck returning an empty array forever, leaving affected
  // enemies without their Walk/Attack/etc. clips (T-pose).
  if (rawClips.length === 0) return rawClips;

  let clips = rawClips;
  if (renameTo) clips = renameAnimationClips(clips, renameTo);
  if (stripRootMotion) clips = clips.map(stripRootMotionXZ);
  processedClipCaches.set(key, clips);
  return clips;
}
