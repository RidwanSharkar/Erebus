/**
 * Shared constants + seeded rise-motion helpers for tectonic / impale ground spikes.
 * Mesh geometry now comes from GROUNDSPIKE.glb (see GroundSpikeModel).
 */

export const SPIKE_HEIGHT = 5.5;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turn a spike id string into a stable numeric sculpt seed. */
export function hashSpikeSeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface SpikeRiseMotion {
  emergenceYaw: number;
  leanDir: number;
  leanAmt: number;
  wobbleFreqX: number;
  wobbleFreqZ: number;
  wobbleAmp: number;
  tiltX: number;
  tiltZ: number;
}

/** Seeded lateral emergence params for a single spike instance. */
export function createSpikeRiseMotion(seed: number): SpikeRiseMotion {
  const rand = mulberry32(seed + 90210);
  return {
    emergenceYaw: rand() * Math.PI * 2,
    leanDir: rand() * Math.PI * 2,
    leanAmt: 0.12 + rand() * 0.1,
    wobbleFreqX: 8 + rand() * 6,
    wobbleFreqZ: 7 + rand() * 5,
    wobbleAmp: 0.06 + rand() * 0.04,
    tiltX: (rand() - 0.5) * 0.14,
    tiltZ: (rand() - 0.5) * 0.14,
  };
}
