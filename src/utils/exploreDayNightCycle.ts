import type { SkyThemeUniforms } from '@/components/environment/CustomSky';
import {
  SKY_APRICOT_DAWN,
  SKY_CHERRY_SUNSET,
  SKY_EMBER_DUSK,
  SKY_HONEY_GOLD,
  SKY_INDIGO_NIGHT,
  SKY_SAPPHIRE_NOON,
} from '@/components/environment/CustomSky';

/** Full day-night loop while a fire pit is alive (ms). */
export const EXPLORE_DAY_NIGHT_PERIOD_MS = 300_000;

/** Phase >= this is considered night for raid spawns (last 90s of the 5-min loop). */
export const EXPLORE_NIGHT_PHASE_START = 0.7;

/** Seconds between the two night raid packs. */
export const EXPLORE_NIGHT_RAID_GAP_MS = 45_000;

/** Distance from fire pit to spawn night raid packs. */
export const EXPLORE_NIGHT_RAID_SPAWN_DIST = 20;

export type ExploreDayNightKeyframe = {
  phase: number;
  theme: SkyThemeUniforms;
};

/** Sky color keyframes for the 5-minute explore camp cycle. */
export const EXPLORE_DAY_NIGHT_KEYFRAMES: readonly ExploreDayNightKeyframe[] = [
  { phase: 0.0, theme: SKY_APRICOT_DAWN },
  { phase: 0.2, theme: SKY_HONEY_GOLD },
  { phase: 0.35, theme: SKY_SAPPHIRE_NOON },
  { phase: 0.55, theme: SKY_CHERRY_SUNSET },
  { phase: 0.7, theme: SKY_EMBER_DUSK },
  { phase: 1.0, theme: SKY_INDIGO_NIGHT },
];

function lerpHex(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '');
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ] as const;
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

function lerpDir(a: readonly [number, number, number], b: readonly [number, number, number], t: number): [number, number, number] {
  const x = a[0] + (b[0] - a[0]) * t;
  const y = a[1] + (b[1] - a[1]) * t;
  const z = a[2] + (b[2] - a[2]) * t;
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

/** Interpolate sky theme uniforms for a normalized phase in [0, 1). */
export function resolveExploreDayNightTheme(phase: number): SkyThemeUniforms {
  const p = ((phase % 1) + 1) % 1;
  const frames = EXPLORE_DAY_NIGHT_KEYFRAMES;
  let lo = frames[0]!;
  let hi = frames[frames.length - 1]!;
  for (let i = 0; i < frames.length - 1; i += 1) {
    const a = frames[i]!;
    const b = frames[i + 1]!;
    if (p >= a.phase && p <= b.phase) {
      lo = a;
      hi = b;
      break;
    }
  }
  const span = hi.phase - lo.phase || 1;
  const t = Math.max(0, Math.min(1, (p - lo.phase) / span));
  const a = lo.theme;
  const b = hi.theme;
  return {
    zenith: lerpHex(a.zenith, b.zenith, t),
    upperMid: lerpHex(a.upperMid, b.upperMid, t),
    midHorizon: lerpHex(a.midHorizon, b.midHorizon, t),
    horizon: lerpHex(a.horizon, b.horizon, t),
    ground: lerpHex(a.ground, b.ground, t),
    sunColor: lerpHex(a.sunColor, b.sunColor, t),
    sunDir: lerpDir(a.sunDir, b.sunDir, t),
    sunHalo0: lerpHex(a.sunHalo0, b.sunHalo0, t),
    sunHalo1: lerpHex(a.sunHalo1, b.sunHalo1, t),
    sunHalo2: lerpHex(a.sunHalo2, b.sunHalo2, t),
    cloudWarmth: a.cloudWarmth + (b.cloudWarmth - a.cloudWarmth) * t,
  };
}

/** Normalized phase from server start timestamp. */
export function exploreDayNightPhaseFromStartedAt(startedAt: number, now = Date.now()): number {
  if (!startedAt) return 0;
  const elapsed = (now - startedAt) % EXPLORE_DAY_NIGHT_PERIOD_MS;
  return elapsed / EXPLORE_DAY_NIGHT_PERIOD_MS;
}

export function isExploreNightPhase(phase: number): boolean {
  return phase >= EXPLORE_NIGHT_PHASE_START;
}

/** Hemisphere / directional fill that tracks the sky cycle. */
export function resolveExploreDayNightLighting(phase: number): {
  hemiColor: string;
  hemiGround: string;
  hemiIntensity: number;
  dirColor: string;
  dirIntensity: number;
} {
  const night = isExploreNightPhase(phase);
  if (night) {
    return {
      hemiColor: '#a8b8e0',
      hemiGround: '#0a0c18',
      hemiIntensity: 0.45,
      dirColor: '#c8d0ff',
      dirIntensity: 0.4,
    };
  }
  const dayT = Math.min(1, phase / EXPLORE_NIGHT_PHASE_START);
  return {
    hemiColor: lerpHex('#fff8e8', '#b8d8ff', dayT),
    hemiGround: lerpHex('#201810', '#182038', dayT),
    hemiIntensity: 0.35 + dayT * 0.25,
    dirColor: lerpHex('#ffe8c0', '#fff8f0', dayT),
    dirIntensity: 0.35 + dayT * 0.35,
  };
}
