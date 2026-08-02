import type { AnimationClip } from 'three';

/** Pick the first WoW-style clip whose name starts with any of the given prefixes. */
export function pickWowClip(clips: AnimationClip[], ...prefixes: string[]): AnimationClip[] {
  for (const prefix of prefixes) {
    const match = clips.find((c) => c.name.startsWith(prefix));
    if (match) return [match];
  }
  return clips.length > 0 ? [clips[0]] : [];
}
