import { BufferGeometry, ConeGeometry, Color, Float32BufferAttribute } from '@/utils/three-exports';
import type { TectonicSpikeTheme } from '@/components/enemies/BossTectonicSpikeTelegraph';

export const SPIKE_BASE_RADIUS = 0.85;
export const SPIKE_HEIGHT = 5.5;
const RADIAL_SEGMENTS = 9;
const HEIGHT_SEGMENTS = 6;
const SCULPT_INTENSITY = 1.4;

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

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

const THEME_PALETTES: Record<
  TectonicSpikeTheme,
  { base: Color; mid: Color; high: Color; strata: Color }
> = {
  earth: {
    base: new Color('#4a3d2a'),
    mid: new Color('#5c4a35'),
    high: new Color('#6c5d4a'),
    strata: new Color('#3d3225'),
  },
  blue: {
    base: new Color('#1a5080'),
    mid: new Color('#2060a0'),
    high: new Color('#2a5a8d'),
    strata: new Color('#143d66'),
  },
  green: {
    base: new Color('#1a6030'),
    mid: new Color('#228844'),
    high: new Color('#2a6d4a'),
    strata: new Color('#144d22'),
  },
};

function sculptSpikeMountain(geometry: BufferGeometry, seed: number, intensity: number): void {
  const rand = mulberry32(seed);
  const pA = rand() * Math.PI * 2;
  const pB = rand() * Math.PI * 2;
  const pC = rand() * Math.PI * 2;
  const freqMajor = 3 + Math.floor(rand() * 3);
  const freqMinor = 7 + Math.floor(rand() * 5);
  const freqMicro = 14 + Math.floor(rand() * 7);
  const leanDir = rand() * Math.PI * 2;
  const leanAmt = (0.12 + rand() * 0.16) * SPIKE_BASE_RADIUS;

  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const radial = Math.hypot(x, z);
    if (radial < 1e-4) continue;

    const angle = Math.atan2(z, x);
    const t = clamp01(y / SPIKE_HEIGHT);

    const major = 1 - Math.abs(Math.sin(angle * freqMajor * 0.5 + pA));
    const minor = Math.sin(angle * freqMinor + pB) * 0.5;
    const micro = Math.sin(angle * freqMicro + y * 0.5 + pC) * 0.22;

    const env = Math.sin(Math.PI * Math.min(1, t * 1.02));
    const ridge = (major - 0.45) * 2.1 + minor + micro;
    const push = ridge * intensity * (0.35 + 0.65 * env);

    const nx = x / radial;
    const nz = z / radial;
    const lean = leanAmt * t * t;

    pos.setX(i, x + nx * push + Math.cos(leanDir) * lean);
    pos.setZ(i, z + nz * push + Math.sin(leanDir) * lean);
    pos.setY(i, y + Math.sin(angle * freqMajor + pB) * intensity * 0.3 * env);
  }

  pos.needsUpdate = true;
}

function paintSpikeMountain(geometry: BufferGeometry, seed: number, theme: TectonicSpikeTheme): void {
  const rand = mulberry32(seed + 31337);
  const strataPhase = rand() * Math.PI * 2;
  const strataFreq = 0.9 + rand() * 0.6;
  const palette = THEME_PALETTES[theme];

  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const ny = nrm.getY(i);
    const slope = clamp01(ny);
    const t = clamp01(y / SPIKE_HEIGHT);

    c.copy(palette.base)
      .lerp(palette.mid, smoothstep(0.0, 0.45, t))
      .lerp(palette.high, smoothstep(0.5, 0.95, t));

    const strata = 0.5 + 0.5 * Math.sin(y * strataFreq + strataPhase);
    c.lerp(palette.strata, strata * 0.2);

    // Slight highlight on upward-facing facets near the summit.
    const highlight = smoothstep(0.7, 0.98, t) * smoothstep(0.35, 0.75, slope) * 0.15;
    if (highlight > 0) {
      c.lerp(palette.high, highlight);
    }

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
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

/**
 * Build a small ridged mountain spike mesh. Caller must call `.dispose()` when done.
 */
export function createTectonicSpikeGeometry(
  seed: number,
  theme: TectonicSpikeTheme,
): BufferGeometry {
  const cone = new ConeGeometry(
    SPIKE_BASE_RADIUS,
    SPIKE_HEIGHT,
    RADIAL_SEGMENTS,
    HEIGHT_SEGMENTS,
  );
  cone.translate(0, SPIKE_HEIGHT / 2, 0);
  sculptSpikeMountain(cone, seed, SCULPT_INTENSITY);

  const geo: BufferGeometry = cone.toNonIndexed();
  cone.dispose();
  geo.computeVertexNormals();
  paintSpikeMountain(geo, seed, theme);
  return geo;
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
